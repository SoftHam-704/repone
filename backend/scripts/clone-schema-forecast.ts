/**
 * clone-schema-forecast.ts
 *
 * ⛔ DEPRECADO / NÃO USAR PARA PROVISIONAR TENANT. ⛔
 *
 * Este script clona o schema via `CREATE TABLE ... (LIKE public.x INCLUDING ...)`
 * + `CREATE SEQUENCE` manual + `ALTER COLUMN ... SET DEFAULT nextval(...)`.
 * Esse caminho TORCE as sequences de PK:
 *   - LIKE ... INCLUDING DEFAULTS copia o DEFAULT do molde apontando p/ a
 *     sequence do public (vazamento da sequence COMPARTILHADA).
 *   - CREATE SEQUENCE + SET DEFAULT manual NUNCA cria o vínculo OWNED BY, então
 *     pg_get_serial_sequence retorna NULL e pg_dump/DROP CASCADE não levam a
 *     sequence junto.
 * Foi a RAIZ do defeito de fin_plano_contas/fin_centro_custo (basesales 2026-06-03).
 *
 * CAMINHO CORRETO para criar tenant:
 *   1. `npm run tenant:create -- <schema>`  (roda 001_create_base_tables.sql sob
 *      SET search_path TO <schema>,public — todo SERIAL nasce com sequence LOCAL,
 *      DEFAULT qualificado e OWNED BY automáticos).
 *   2. `npm run tenant:migrate`             (aplica migrations pendentes 003+).
 *   3. migrations/pgadmin_provision_tenant_financeiro_despesas.sql (financeiro + despesas).
 *
 * Mantido apenas como referência histórica. A trava abaixo impede execução
 * acidental. Para reabilitar conscientemente: ALLOW_BROKEN_CLONE=1.
 */

import { pool } from '../src/config/database';

if (process.env.ALLOW_BROKEN_CLONE !== '1') {
  console.error([
    '⛔ clone-schema-forecast.ts está DEPRECADO — gera sequences de PK tortas',
    '   (sem OWNED BY / DEFAULT vazando p/ a sequence do public).',
    '',
    '   Use o caminho correto:',
    '     npm run tenant:create -- <schema>',
    '     npm run tenant:migrate',
    '     migrations/pgadmin_provision_tenant_financeiro_despesas.sql',
    '',
    '   (Se realmente precisar rodar este script legado: ALLOW_BROKEN_CLONE=1)',
  ].join('\n'));
  process.exit(1);
}

const TARGET_SCHEMA = 'forecast';

async function safeExec(client: any, label: string, sql: string): Promise<boolean> {
  try {
    await client.query('SAVEPOINT sp');
    await client.query(sql);
    await client.query('RELEASE SAVEPOINT sp');
    return true;
  } catch (e: any) {
    await client.query('ROLLBACK TO SAVEPOINT sp');
    return false;
  }
}

async function cloneSchemaToForecast(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 0. Verificar se o schema já existe ──
    const existing = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [TARGET_SCHEMA]
    );
    if (existing.rows.length > 0) {
      console.log(`⚠️  Schema "${TARGET_SCHEMA}" já existe. Removendo para recriá-lo...`);
      await client.query(`DROP SCHEMA ${TARGET_SCHEMA} CASCADE`);
    }

    // ── 1. Criar schema ──
    console.log(`\n📦 Criando schema "${TARGET_SCHEMA}"...`);
    await client.query(`CREATE SCHEMA ${TARGET_SCHEMA}`);

    // ── 2. Clonar tabelas ──
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('spatial_ref_sys')
        AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map((r: { table_name: string }) => r.table_name);
    console.log(`\n📋 Clonando ${tables.length} tabelas (estrutura)...`);

    let tablesCreated = 0;
    for (const tableName of tables) {
      let ok = await safeExec(client, tableName,
        `CREATE TABLE ${TARGET_SCHEMA}."${tableName}" (LIKE public."${tableName}" INCLUDING ALL)`
      );
      if (!ok) {
        ok = await safeExec(client, tableName,
          `CREATE TABLE ${TARGET_SCHEMA}."${tableName}" (LIKE public."${tableName}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`
        );
      }
      if (ok) {
        console.log(`   ✅ ${tableName}`);
        tablesCreated++;
      } else {
        console.log(`   ❌ ${tableName}`);
      }
    }

    // ── 3. Sequences ──
    const seqResult = await client.query(`
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
    `);

    console.log(`\n🔢 Verificando ${seqResult.rows.length} sequences...`);
    for (const row of seqResult.rows) {
      await safeExec(client, row.sequence_name,
        `CREATE SEQUENCE IF NOT EXISTS ${TARGET_SCHEMA}."${row.sequence_name}"`
      );
    }

    // ── 4. Corrigir defaults de colunas serial ──
    console.log(`\n🔧 Corrigindo defaults de colunas seriais...`);
    const serialCols = await client.query(`
      SELECT
        c.table_name,
        c.column_name,
        c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.column_default LIKE 'nextval(%'
        AND c.table_name NOT IN ('spatial_ref_sys')
        AND c.table_name NOT LIKE 'pg_%'
    `);

    let serialFixed = 0;
    for (const col of serialCols.rows) {
      const { table_name, column_name, column_default } = col;
      const seqMatch = column_default.match(/nextval\('([^']+)'/);
      if (seqMatch) {
        let seqName = seqMatch[1].replace('public.', '');
        await safeExec(client, `seq-${seqName}`,
          `CREATE SEQUENCE IF NOT EXISTS ${TARGET_SCHEMA}."${seqName}"`
        );
        const ok = await safeExec(client, `alter-${table_name}-${column_name}`,
          `ALTER TABLE ${TARGET_SCHEMA}."${table_name}"
           ALTER COLUMN "${column_name}"
           SET DEFAULT nextval('${TARGET_SCHEMA}."${seqName}"'::regclass)`
        );
        if (ok) serialFixed++;
      }
    }
    console.log(`   ✅ ${serialFixed} colunas seriais corrigidas`);

    // ── 5. Views ──
    console.log(`\n👁️ Clonando views...`);
    const viewsResult = await client.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name NOT LIKE 'pg_%'
    `);

    let viewsCreated = 0;
    for (const view of viewsResult.rows) {
      const ok = await safeExec(client, `view-${view.table_name}`,
        `CREATE OR REPLACE VIEW ${TARGET_SCHEMA}."${view.table_name}" AS ${view.view_definition}`
      );
      if (ok) {
        console.log(`   ✅ VIEW: ${view.table_name}`);
        viewsCreated++;
      } else {
        console.log(`   ⚠️ VIEW: ${view.table_name} (skipped)`);
      }
    }

    // ── 6. Foreign keys ──
    console.log(`\n🔗 Clonando foreign keys...`);
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `);

    let fkCreated = 0;
    for (const fk of fkResult.rows) {
      const targetExists = tables.includes(fk.foreign_table_name);
      const refSchema = targetExists ? TARGET_SCHEMA : 'public';
      const ok = await safeExec(client, `fk-${fk.constraint_name}`,
        `ALTER TABLE ${TARGET_SCHEMA}."${fk.table_name}"
         ADD CONSTRAINT "${fk.constraint_name}_fk"
         FOREIGN KEY ("${fk.column_name}")
         REFERENCES ${refSchema}."${fk.foreign_table_name}" ("${fk.foreign_column_name}")`
      );
      if (ok) fkCreated++;
    }
    console.log(`   ✅ ${fkCreated} FKs adicionais criadas`);

    // ── 7. COPIAR DADOS - APENAS user_nomes ──
    console.log(`\n📊 Copiando dados de user_nomes...`);
    const userCount = await client.query(`
      INSERT INTO ${TARGET_SCHEMA}.user_nomes
      SELECT * FROM public.user_nomes
      RETURNING codigo
    `);
    console.log(`   ✅ ${userCount.rows.length} usuário(s) copiados`);

    // Sync sequence
    const ok = await safeExec(client, 'sync-user-seq', `
      SELECT setval(
        '${TARGET_SCHEMA}.user_nomes_codigo_seq',
        COALESCE((SELECT MAX(codigo) FROM ${TARGET_SCHEMA}.user_nomes), 0) + 1,
        false
      )
    `);
    if (ok) console.log(`   ✅ Sequence user_nomes sincronizada`);

    // ── 8. Registrar tenant ──
    console.log(`\n📝 Registrando tenant...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._tenants (
        id          SERIAL PRIMARY KEY,
        schema_name VARCHAR(63) NOT NULL UNIQUE,
        display_name VARCHAR(200),
        active      BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `INSERT INTO public._tenants (schema_name, display_name) VALUES ($1, $2)
       ON CONFLICT (schema_name) DO UPDATE SET active = true, display_name = $2`,
      [TARGET_SCHEMA, 'Forecast']
    );

    // ── 9. Registrar migrations ──
    console.log(`\n📋 Registrando migrations...`);
    await safeExec(client, 'create-migrations-table', `
      CREATE TABLE IF NOT EXISTS ${TARGET_SCHEMA}._migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const knownMigrations = [
      '001_create_base_tables.sql', '002_create_functions.sql',
      '003_industrias_complemento.sql', '003_product_functions.sql',
      '005_pedidos_v2_consolidacao.sql', '006_setores_itinerarios.sql',
      '007_itinerario_paradas.sql', '008_fix_indexes.sql',
      '009_itinerario_regiao.sql', '010_setores_cidade_cli_setor.sql',
      '011_parametros.sql', '012_pedidos_campos_v1.sql',
      '013_smart_importer_drafts.sql', '014_fix_dashboard_status_filter.sql',
      '015_parametros_baixa_xml.sql', '016_whatsapp_ia.sql',
      '017_email_central.sql', '018_repcrm_visita_cli_codigo.sql',
      '020_add_imap_server.sql', '021_fix_email_lead_public.sql',
      '022_campanhas_promocionais.sql', '023_fix_metas_status_e.sql',
      '024_add_linhaamarela.sql', '025_update_fn_upsert_produto_linhaamarela.sql',
      '026_fix_itinerarios_columns.sql', '027_dedup_cad_prod_unique_index.sql',
      '028_fix_ite_embuch_nullable.sql', '029_fix_get_industry_revenue.sql',
      '030_fix_cad_tabelaspre_indexes.sql', '031_add_grupos_percomiss.sql',
      '032_campanhas_tipo.sql', '033_add_pro_ciclo.sql',
      '034_add_cli_atividade.sql', '038_fix_ia_conhecimento_unique.sql',
      '039_widen_pro_conversao.sql',
    ];

    for (const mig of knownMigrations) {
      await safeExec(client, `mig-${mig}`,
        `INSERT INTO ${TARGET_SCHEMA}._migrations (name) VALUES ('${mig}') ON CONFLICT DO NOTHING`
      );
    }

    await client.query('COMMIT');

    // ── RESUMO ──
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ TENANT "forecast" CRIADO COM SUCESSO!`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`   📁 Schema: ${TARGET_SCHEMA}`);
    console.log(`   📋 Tabelas clonadas: ${tablesCreated}/${tables.length}`);
    console.log(`   👁️ Views criadas: ${viewsCreated}/${viewsResult.rows.length}`);
    console.log(`   🔢 Sequences: ${seqResult.rows.length}`);
    console.log(`   🔗 FKs extras: ${fkCreated}`);
    console.log(`   🔧 Serials corrigidos: ${serialFixed}`);
    console.log(`   👤 Usuários copiados: ${userCount.rows.length}`);
    console.log(`   📦 Migrations registradas: ${knownMigrations.length}`);
    console.log(`\n   ⚠️  Functions/procedures ficam no schema public`);
    console.log(`       e são compartilhadas via search_path.`);
    console.log(`${'═'.repeat(60)}\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao clonar schema:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cloneSchemaToForecast();
