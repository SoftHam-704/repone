import { pool } from '../../config/database';

// Roda a cada 60s — detecta pedidos 'J' sem itens e monta a cotação automaticamente
export function startIrisCotacaoCron() {
  console.log('🤖 [IRIS] Cotação cron iniciado (60s)');
  setInterval(processarPendentes, 60_000);
}

async function processarPendentes() {
  const client = await pool.connect();
  try {
    // Busca todos os schemas de tenant (exclui schemas do sistema)
    const schemas = await client.query(
      `SELECT nspname AS schema FROM pg_namespace
       WHERE nspname NOT IN ('public','information_schema','pg_catalog','pg_toast','basesales')
         AND nspname NOT LIKE 'pg_%'
       ORDER BY nspname`
    );

    for (const { schema } of schemas.rows) {
      await processarSchema(schema);
    }
  } catch (e: any) {
    console.error('❌ [IRIS] cron error:', e.message);
  } finally {
    client.release();
  }
}

async function processarSchema(schema: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}", public`);

    // Pedidos 'J' que ainda não têm itens
    const pending = await client.query(
      `SELECT p.ped_numero, p.ped_pedido, p.ped_cliente, p.ped_industria,
              p.ped_obs, p.ped_tabela
       FROM pedidos p
       WHERE p.ped_situacao = 'J'
         AND p.ped_obs IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM itens_ped ip WHERE ip.ite_pedido = p.ped_pedido
         )`
    );

    if (pending.rows.length === 0) return;

    console.log(`🤖 [IRIS][${schema}] ${pending.rows.length} cotação(ões) pendente(s)`);

    for (const ped of pending.rows) {
      await resolverCotacao(client, schema, ped);
    }
  } catch (e: any) {
    console.error(`❌ [IRIS][${schema}] erro:`, e.message);
  } finally {
    client.release();
  }
}

async function resolverCotacao(client: any, schema: string, ped: any) {
  const { ped_numero, ped_pedido, ped_cliente, ped_industria, ped_obs, ped_tabela } = ped;

  try {
    // Busca descontos da política comercial
    const polR = await client.query(
      `SELECT cli_desc1,cli_desc2,cli_desc3,cli_desc4,cli_desc5,cli_desc6,cli_desc7
       FROM cli_ind
       WHERE cli_codigo = $1 AND cli_forcodigo = $2
       LIMIT 1`,
      [ped_cliente, ped_industria]
    );
    const pol = polR.rows[0] || {};
    const descontos = [1,2,3,4,5,6,7]
      .map(i => parseFloat(pol[`cli_desc${i}`] || '0'))
      .filter(d => d > 0);

    // Parseia os códigos colados pelo lojista (um por linha)
    // Suporta: "1905002" ou "1905002  10" (código + quantidade separados por espaço/tab)
    const linhas = (ped_obs as string)
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => {
        const parts = l.split(/\s+/);
        const lastPart = parts[parts.length - 1];
        const qty = parts.length > 1 && /^\d+([.,]\d+)?$/.test(lastPart)
          ? parseFloat(lastPart.replace(',', '.'))
          : 1;
        const codigo = qty !== 1 || /^\d+([.,]\d+)?$/.test(lastPart)
          ? parts.slice(0, -1).join(' ')
          : l;
        return { codigo: codigo.trim() || l.trim(), qty: qty > 0 ? qty : 1 };
      });

    const itens: any[] = [];
    const ajustes: { codigo: string; original: number; ajustado: number; emb: number }[] = [];
    let seq = 1;
    let totBruto = 0;
    let totLiq = 0;

    for (const { codigo, qty } of linhas) {
      const prodR = await client.query(
        `SELECT pro_id, pro_codprod, pro_codigonormalizado, pro_nome, pro_embalagem, pro_conversao
         FROM cad_prod
         WHERE pro_industria = $1
           AND pro_status IS NOT FALSE
           AND (
             UPPER(TRIM($2)) = UPPER(pro_codprod)
             OR UPPER(TRIM($2)) = UPPER(COALESCE(pro_codigonormalizado,''))
             OR UPPER(TRIM($2)) = UPPER(COALESCE(pro_codbarras,''))
             OR UPPER(pro_nome) LIKE '%' || UPPER(TRIM($2)) || '%'
           )
         ORDER BY
           CASE
             WHEN UPPER(TRIM($2)) = UPPER(pro_codprod) THEN 0
             WHEN UPPER(TRIM($2)) = UPPER(COALESCE(pro_codigonormalizado,'')) THEN 1
             WHEN UPPER(TRIM($2)) = UPPER(COALESCE(pro_codbarras,'')) THEN 2
             ELSE 3
           END
         LIMIT 1`,
        [ped_industria, codigo]
      );

      if (prodR.rows.length === 0) {
        itens.push({
          seq, produto: codigo, nome: `⚠ Código não encontrado: ${codigo}`,
          emb: null, quant: qty, puni: 0, puniliq: 0, totliq: 0,
          descontos: [], obs: 'NÃO ENCONTRADO',
        });
        seq++;
        continue;
      }

      const prod = prodR.rows[0];

      // Ajuste de embalagem: arredonda qty para cima ao múltiplo da embalagem
      const emb = parseInt(prod.pro_embalagem) || 0;
      const qtyFinal = (emb > 1 && qty % emb !== 0) ? Math.ceil(qty / emb) * emb : qty;
      if (qtyFinal !== qty) {
        ajustes.push({ codigo: prod.pro_codprod, original: qty, ajustado: qtyFinal, emb });
        console.log(`📦 [IRIS][${schema}] ${prod.pro_codprod}: ${qty}→${qtyFinal} (emb ${emb})`);
      }

      const precoR = await client.query(
        `SELECT itab_precobruto, itab_precopromo, itab_ipi, itab_st
         FROM cad_tabelaspre
         WHERE itab_idprod = $1
           AND itab_tabela = $2
         LIMIT 1`,
        [prod.pro_id, ped_tabela || '']
      );

      let puni = 0;
      if (precoR.rows.length > 0) {
        const pr = precoR.rows[0];
        puni = parseFloat(pr.itab_precopromo || pr.itab_precobruto || '0');
      }

      let puniliq = puni;
      for (const d of descontos) {
        puniliq = puniliq * (1 - d / 100);
      }
      puniliq = Math.round(puniliq * 10000) / 10000;

      const totItem = Math.round(puniliq * qtyFinal * 10000) / 10000;
      totBruto += puni * qtyFinal;
      totLiq   += totItem;

      itens.push({
        seq, produto: prod.pro_codprod, nome: prod.pro_nome,
        emb: prod.pro_embalagem, quant: qtyFinal, puni, puniliq,
        totliq: totItem, descontos, obs: null,
      });
      seq++;
    }

    // Insere os itens no itens_ped
    for (const item of itens) {
      const descValues = [1,2,3,4,5,6,7].map((_, i) => item.descontos[i] || 0);
      await client.query(
        `INSERT INTO itens_ped
           (ite_pedido, ite_industria, ite_seq, ite_produto, ite_nomeprod, ite_embuch,
            ite_quant, ite_puni, ite_puniliq, ite_totliquido, ite_totbruto,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5, ite_des6, ite_des7)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          ped_pedido, ped_industria, item.seq, item.produto, item.nome, item.emb,
          item.quant, item.puni, item.puniliq, item.totliq, item.puni,
          ...descValues,
        ]
      );
    }

    // Atualiza totais do pedido + grava ajustes de embalagem no ped_obs
    const ajustesJson = ajustes.length > 0 ? `\n---iris_ajustes:${JSON.stringify(ajustes)}` : '';
    await client.query(
      `UPDATE pedidos
       SET ped_totbruto = $1, ped_totliq = $2, ped_iris_enviado_em = NOW(),
           ped_obs = ped_obs || $4
       WHERE ped_numero = $3`,
      [totBruto, totLiq, ped_numero, ajustesJson]
    );

    console.log(`✅ [IRIS][${schema}] Cotação ${ped_pedido} resolvida — ${itens.length} item(ns)`);
  } catch (e: any) {
    console.error(`❌ [IRIS][${schema}] Erro ao resolver ${ped_pedido}:`, e.message);
  }
}
