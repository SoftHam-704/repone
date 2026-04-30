/**
 * Migração CRM Firebird → PostgreSQL (schema: ndsrep)
 * Fonte: C:/SalesMasters/NDS/crm.json + crm_itens.json
 *
 * Execução: node backend/scripts/migrate_crm_ndsrep.js
 */
const { Pool } = require('pg');
const fs = require('fs');

const SCHEMA     = 'ndsrep';
const CRM_JSON   = 'C:/SalesMasters/NDS/crm.json';
const ITENS_JSON = 'C:/SalesMasters/NDS/crm_itens.json';

const pool = new Pool({
  host:     'node254557-salesmaster.sp1.br.saveincloud.net.br',
  port:     13062,
  database: 'basesales',
  user:     'webadmin',
  password: 'ytAyO0u043',
  connectionTimeoutMillis: 10000,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const clean = (s) => {
  if (!s || typeof s !== 'string') return null;
  const r = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return r || null;
};

// "20.03.2019" → "2019-03-20"
const parseDate = (s) => {
  if (!s) return null;
  const parts = s.split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
};

// ─── Mapeamentos com IDs reais do banco ─────────────────────────────────────

// AGE_TIPOINTERACAO → canal_id (crm_canal)
// 1=Ligação telefônica  2=Visita  3=E-mail  4=Whatsapp/Skype  5=Reunião  6=Outros
const CANAL_ID = { L: 1, V: 2, E: 3, M: 4, O: 6 };

// AGE_TIPOVISITA → tipo_interacao_id (crm_tipo_interacao)
// 1=Prom.Nacional  2=Prom.Regional  3=Comercial  4=Divergências  5=Prospecção  6=Garantia  7=Treinamento  8=Suporte
const TIPO_ID = { C: 3, D: 3, G: 6, P: 5, S: 8 };
const TIPO_DEFAULT = 3; // Comercial

// AGE_STATUS → resultado_id (crm_resultado)
// 1=Em aberto  2=Agendado  3=Realizado  4=Cancelado  5=Positivo  6=Negativo
const RESULTADO_ID = { A: 1, F: 3, E: 4 };

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' MIGRAÇÃO CRM → ndsrep');
  console.log('═══════════════════════════════════════════════════════════\n');

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${SCHEMA}", public`);

    // ── Leitura dos JSONs ────────────────────────────────────────────────
    console.log('📂 Lendo arquivos JSON...');
    const crm   = JSON.parse(fs.readFileSync(CRM_JSON,   'utf8')).RecordSet;
    const itens = JSON.parse(fs.readFileSync(ITENS_JSON, 'utf8')).RecordSet;
    console.log(`   CRM (pai):  ${crm.length} registros`);
    console.log(`   CRM_ITENS:  ${itens.length} registros`);

    // ── 1. Limpar tabelas CRM ────────────────────────────────────────────
    console.log('\n🗑️  Limpando dados CRM existentes em ndsrep...');
    await client.query('DELETE FROM crm_interacao_industria');
    await client.query('DELETE FROM crm_interacao');
    console.log('   ✅ crm_interacao_industria limpa');
    console.log('   ✅ crm_interacao limpa');

    // ── 2. Carregar dados auxiliares ─────────────────────────────────────
    console.log('\n🔍 Carregando clientes e vendedores...');

    const cliRes = await client.query('SELECT cli_codigo FROM clientes');
    const cliSet = new Set(cliRes.rows.map(r => r.cli_codigo));
    console.log(`   ${cliSet.size} clientes carregados`);

    const venRes = await client.query(
      `SELECT ven_codigo, TRIM(UPPER(ven_nome)) AS nome FROM vendedores`
    );
    // Mapa: primeira palavra UPPERCASE → ven_codigo
    const venByFirstWord = new Map();
    for (const r of venRes.rows) {
      const first = (r.nome || '').split(/\s+/)[0];
      if (first && !venByFirstWord.has(first)) venByFirstWord.set(first, r.ven_codigo);
    }
    console.log(`   ${venRes.rows.length} vendedores carregados`);

    // ── 3. CRM pai → cli_obsparticular ──────────────────────────────────
    console.log('\n📝 Importando obs do CRM pai → clientes.cli_obsparticular...');
    let obsOk = 0, obsSkip = 0;
    for (const row of crm) {
      const obs = clean(row.TELE_OBSCLI);
      if (!obs) { obsSkip++; continue; }
      const r = await client.query(
        `UPDATE clientes
         SET cli_obs = $1
         WHERE cli_codigo = $2
           AND (cli_obs IS NULL OR TRIM(cli_obs) = '')`,
        [obs, row.TELE_CLIENTE]
      );
      if (r.rowCount > 0) obsOk++; else obsSkip++;
    }
    console.log(`   ✅ ${obsOk} clientes atualizados | ${obsSkip} sem obs ou já preenchido`);

    // ── 4. CRM_ITENS → crm_interacao + crm_interacao_industria ──────────
    console.log('\n📥 Importando CRM_ITENS → crm_interacao...\n');

    let inserted = 0, noCliente = 0, errCount = 0;
    const BATCH = 200;

    await client.query('BEGIN');

    for (let i = 0; i < itens.length; i++) {
      const row = itens[i];

      // Pular se cliente não existe no schema
      if (!cliSet.has(row.AGE_CLIENTE)) { noCliente++; continue; }

      // Resolver IDs dos lookups
      const canalIdVal    = CANAL_ID[row.AGE_TIPOINTERACAO] ?? 6;
      const tipoIdVal     = TIPO_ID[row.AGE_TIPOVISITA] ?? TIPO_DEFAULT;
      const resultadoIdVal = row.AGE_STATUS ? (RESULTADO_ID[row.AGE_STATUS] ?? null) : null;

      // Montar descrição preservando contexto histórico do Delphi
      const contato = clean(row.AGE_CONTATO);
      const tel     = clean(row.AGE_TELEFONE);
      const assunto = clean(row.AGE_ASSUNTO);

      const headerParts = [];
      if (contato) headerParts.push(`Contato: ${contato}`);
      if (tel)     headerParts.push(`Tel: ${tel}`);

      const descParts = [];
      if (headerParts.length) descParts.push(headerParts.join(' | '));
      if (assunto)            descParts.push(assunto);

      const descricao = descParts.join('\n') || null;

      // Data
      const dataFinal = parseDate(row.AGE_DATA) ?? new Date().toISOString().slice(0, 10);

      // Resolver ven_codigo pela primeira palavra do nome do operador
      let venCodigo = 1;
      const firstWord = (row.AGE_OPERADOR ?? '').toUpperCase().trim().split(/\s+/)[0];
      if (firstWord && venByFirstWord.has(firstWord)) venCodigo = venByFirstWord.get(firstWord);

      try {
        const res = await client.query(`
          INSERT INTO crm_interacao
            (cli_codigo, ven_codigo, tipo_interacao_id, canal_id, resultado_id, descricao, data_interacao)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING interacao_id
        `, [row.AGE_CLIENTE, venCodigo, tipoIdVal, canalIdVal, resultadoIdVal, descricao, dataFinal]);

        const interacaoId = res.rows[0].interacao_id;

        if (row.AGE_INDUSTRIA) {
          await client.query(
            `INSERT INTO crm_interacao_industria (interacao_id, for_codigo)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [interacaoId, row.AGE_INDUSTRIA]
          );
        }

        inserted++;
      } catch (e) {
        errCount++;
        if (errCount <= 5) console.error(`\n   ⚠️  Erro no lançto ${row.AGE_LANCTO}: ${e.message}`);
      }

      // Commit por lote + progress
      if ((i + 1) % BATCH === 0) {
        await client.query('COMMIT');
        await client.query('BEGIN');
        process.stdout.write(
          `\r   [${i+1}/${itens.length}] ✅ ${inserted} inseridos | ❌ ${errCount} erros | 👤 ${noCliente} sem-cliente`
        );
      }
    }

    await client.query('COMMIT');
    process.stdout.write('\n');

    // ── Resultado final ──────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(' RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Interações inseridas:     ${inserted}`);
    console.log(`  Clientes não mapeados:    ${noCliente}`);
    console.log(`  Erros de inserção:        ${errCount}`);
    console.log(`  Obs de clientes salvas:   ${obsOk}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Migração concluída!\n');

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ ERRO FATAL:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
