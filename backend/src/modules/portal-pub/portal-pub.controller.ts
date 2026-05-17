import { Request, Response } from 'express';
import { pool } from '../../config/database';

function validSchema(s: string) {
  return /^[a-zA-Z0-9_]+$/.test(s);
}

async function getTenantDb(schema: string) {
  const client = await pool.connect();
  await client.query(`SET search_path TO "${schema}", public`);
  return client;
}

async function assertToken(client: any, token: string): Promise<number | null> {
  const r = await client.query(
    `SELECT cli_codigo, ativo FROM portal_clientes WHERE token = $1`,
    [token]
  );
  if (r.rows.length === 0 || !r.rows[0].ativo) return null;
  return r.rows[0].cli_codigo;
}

// Remove tudo que não for letra ou número (ex: "ABC-789" → "ABC789")
function normCode(c: string): string {
  return c.replace(/[^A-Z0-9]/g, '');
}

// Parse "1905002 10" → { codigo: "1905002", qty: 10 }
function parseRawCodes(rawCodes: string): Array<{ codigo: string; qty: number }> {
  return rawCodes
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      const parts = l.split(/\s+/);
      const last  = parts[parts.length - 1];
      const qty   = parts.length > 1 && /^\d+([.,]\d+)?$/.test(last)
        ? parseFloat(last.replace(',', '.')) : 1;
      const codigo = parts.length > 1 && /^\d+([.,]\d+)?$/.test(last)
        ? parts.slice(0, -1).join(' ') : l;
      return { codigo: (codigo.trim() || l.trim()).toUpperCase(), qty: qty > 0 ? qty : 1 };
    });
}

// Resolução completa de códigos — cobre todos os campos em ordem de prioridade:
// 1. Exato: pro_codprod, pro_conversao, pro_codigooriginal, pro_codigonormalizado, pro_codbarras
// 2. Normalizado (sem hífens/pontos): mesmos campos
// 3. Fallback: nome ILIKE (um por um, apenas para os ainda não encontrados)
async function resolveLinhasParaCotacao(
  client: any,
  indId: number,
  tabela: string,
  descontos: number[],
  linhas: Array<{ codigo: string; qty: number }>,
  startSeq = 1
): Promise<{ itens: any[]; totBruto: number; totLiq: number }> {

  const allCodes     = [...new Set(linhas.map(l => l.codigo))];
  const allNormCodes = [...new Set(allCodes.map(normCode).filter(c => c.length >= 2))];

  // ── Batch 1: match exato + normalizado em todos os campos de código ──────────
  const prodRes = await client.query(
    `SELECT pro_id, pro_codprod, pro_nome, pro_embalagem,
            UPPER(TRIM(pro_codprod))                                              AS c1,
            UPPER(TRIM(COALESCE(pro_conversao,'')))                              AS c2,
            UPPER(TRIM(COALESCE(pro_codigooriginal,'')))                         AS c3,
            UPPER(TRIM(COALESCE(pro_codigonormalizado,'')))                      AS c4,
            UPPER(TRIM(COALESCE(pro_codbarras,'')))                              AS c5,
            REGEXP_REPLACE(UPPER(TRIM(pro_codprod)),          '[^A-Z0-9]','','g') AS n1,
            REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_conversao,''))),  '[^A-Z0-9]','','g') AS n2,
            REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_codigooriginal,''))), '[^A-Z0-9]','','g') AS n3
     FROM cad_prod
     WHERE pro_industria = $1
       AND pro_status IS NOT FALSE
       AND (
         UPPER(TRIM(pro_codprod))                                              = ANY($2::text[])
         OR UPPER(TRIM(COALESCE(pro_conversao,'')))                           = ANY($2::text[])
         OR UPPER(TRIM(COALESCE(pro_codigooriginal,'')))                      = ANY($2::text[])
         OR UPPER(TRIM(COALESCE(pro_codigonormalizado,'')))                   = ANY($2::text[])
         OR UPPER(TRIM(COALESCE(pro_codbarras,'')))                           = ANY($2::text[])
         OR REGEXP_REPLACE(UPPER(TRIM(pro_codprod)),         '[^A-Z0-9]','','g') = ANY($3::text[])
         OR REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_conversao,''))),  '[^A-Z0-9]','','g') = ANY($3::text[])
         OR REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_codigooriginal,''))), '[^A-Z0-9]','','g') = ANY($3::text[])
       )`,
    [indId, allCodes, allNormCodes]
  );

  const prodMap = new Map<string, any>();
  for (const p of prodRes.rows) {
    const exactAliases = [p.c1, p.c2, p.c3, p.c4, p.c5] as string[];
    const normAliases  = [p.n1, p.n2, p.n3] as string[];

    // Exact match tem prioridade
    for (const alias of exactAliases) {
      if (alias && allCodes.includes(alias) && !prodMap.has(alias)) prodMap.set(alias, p);
    }
    // Normalized match como fallback
    for (const normAlias of normAliases) {
      if (!normAlias) continue;
      for (const origCode of allCodes) {
        if (!prodMap.has(origCode) && normCode(origCode) === normAlias) prodMap.set(origCode, p);
      }
    }
  }

  // ── Fallback: nome ILIKE para os ainda não encontrados ──────────────────────
  const unmatched = allCodes.filter(c => !prodMap.has(c));
  for (const codigo of unmatched) {
    if (codigo.length < 3) continue;
    const nameRes = await client.query(
      `SELECT pro_id, pro_codprod, pro_nome, pro_embalagem
       FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE
         AND UPPER(pro_nome) LIKE '%' || $2 || '%'
       ORDER BY LENGTH(pro_nome) LIMIT 1`,
      [indId, codigo]
    );
    if (nameRes.rows.length > 0) prodMap.set(codigo, nameRes.rows[0]);
  }

  // ── Batch 2: preços ─────────────────────────────────────────────────────────
  const foundProIds = [...new Set([...prodMap.values()].map((p: any) => p.pro_id as number))];
  const priceMap = new Map<number, any>();
  if (foundProIds.length > 0) {
    const priceRes = await client.query(
      `SELECT DISTINCT ON (itab_idprod) itab_idprod, itab_precobruto, itab_precopromo
       FROM cad_tabelaspre
       WHERE itab_idprod = ANY($1::int[])
       ORDER BY itab_idprod, (itab_tabela = $2) DESC, itab_precobruto DESC`,
      [foundProIds, tabela || '']
    );
    priceRes.rows.forEach((r: any) => priceMap.set(r.itab_idprod, r));
  }

  // ── Monta itens em memória ─────────────────────────────────────────────────
  const itens: any[] = [];
  let seq = startSeq, totBruto = 0, totLiq = 0;

  for (const { codigo, qty } of linhas) {
    const prod = prodMap.get(codigo);
    if (!prod) {
      itens.push({ seq, ite_produto: codigo, ite_nomeprod: `⚠ Não encontrado: ${codigo}`, ite_embuch: null, ite_quant: qty, ite_puni: 0, ite_puniliq: 0, ite_totliquido: 0, found: false });
      seq++; continue;
    }
    const price = priceMap.get(prod.pro_id);
    let puni    = price ? parseFloat(price.itab_precopromo || price.itab_precobruto || '0') : 0;
    let puniliq = puni;
    for (const d of descontos) puniliq = puniliq * (1 - d / 100);
    puniliq = Math.round(puniliq * 10000) / 10000;
    const totItem = Math.round(puniliq * qty * 10000) / 10000;
    totBruto += puni * qty;
    totLiq   += totItem;
    itens.push({ seq, pro_id: prod.pro_id, ite_produto: prod.pro_codprod, ite_nomeprod: prod.pro_nome, ite_embuch: prod.pro_embalagem, ite_quant: qty, ite_puni: puni, ite_puniliq: puniliq, ite_totliquido: totItem, found: true });
    seq++;
  }

  return { itens, totBruto, totLiq };
}

// GET /api/portal-pub/validate?t=<uuid>&s=<schema>
export async function validatePortalTokenHandler(req: Request, res: Response): Promise<void> {
  const { t, s } = req.query as { t?: string; s?: string };
  if (!t || !s || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Token ou schema inválido.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const r = await client.query(
      `SELECT pc.cli_codigo, pc.ativo,
              c.cli_nomred AS nome, c.cli_cidade AS cidade, c.cli_uf AS uf
       FROM portal_clientes pc
       JOIN clientes c ON c.cli_codigo = pc.cli_codigo
       WHERE pc.token = $1`,
      [t]
    );
    if (r.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token não encontrado.' });
      return;
    }
    const row = r.rows[0];
    if (!row.ativo) {
      res.status(403).json({ success: false, message: 'Acesso revogado.' });
      return;
    }

    await client.query(
      `UPDATE portal_clientes SET ultimo_acesso = NOW() WHERE token = $1`, [t]
    );

    const indR = await client.query(
      `SELECT DISTINCT f.for_codigo AS id, f.for_nomered AS nome
       FROM pedidos p
       JOIN fornecedores f ON f.for_codigo = p.ped_industria
       WHERE p.ped_cliente = $1 AND p.ped_situacao NOT IN ('E', 'J')
       ORDER BY f.for_nomered`,
      [row.cli_codigo]
    );

    const statsR = await client.query(
      `SELECT COUNT(*) AS total_pedidos,
              SUM(COALESCE(ped_totliq, ped_totbruto, 0)) FILTER (WHERE ped_situacao = 'F') AS total_faturado
       FROM pedidos
       WHERE ped_cliente = $1 AND ped_situacao NOT IN ('E', 'J')`,
      [row.cli_codigo]
    );

    res.json({
      success: true,
      cliente: { codigo: row.cli_codigo, nome: row.nome, cidade: row.cidade, uf: row.uf },
      industrias: indR.rows,
      stats: {
        total_pedidos: parseInt(statsR.rows[0].total_pedidos || '0'),
        total_faturado: parseFloat(statsR.rows[0].total_faturado || '0'),
      },
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] validate error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// GET /api/portal-pub/orders?t=<uuid>&s=<schema>&industria=<id>&page=<n>
export async function portalOrdersHandler(req: Request, res: Response): Promise<void> {
  const { t, s, industria, page } = req.query as Record<string, string>;
  if (!t || !s || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Token ou schema inválido.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const params: any[] = [cliCodigo];
    let idx = 2;
    let indFilter = '';
    if (industria && industria !== '0') {
      indFilter = ` AND p.ped_industria = $${idx++}`;
      params.push(parseInt(industria));
    }

    const limit  = 50;
    const offset = (parseInt(page || '1') - 1) * limit;
    params.push(limit, offset);

    const r = await client.query(
      `SELECT
          p.ped_numero AS ped_codigo,
          p.ped_pedido,
          p.ped_oc,
          p.ped_pedcli,
          p.ped_data,
          p.ped_situacao,
          COALESCE(p.ped_totliq, p.ped_totbruto, 0) AS ped_totalped,
          f.for_nomered AS industria_nome,
          COUNT(*) OVER() AS total_count
       FROM pedidos p
       JOIN fornecedores f ON f.for_codigo = p.ped_industria
       WHERE p.ped_cliente = $1
         AND p.ped_situacao NOT IN ('E', 'J')
         ${indFilter}
       ORDER BY p.ped_data DESC, p.ped_numero DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    const total = r.rows.length > 0 ? parseInt(r.rows[0].total_count) : 0;
    res.json({
      success: true,
      data: r.rows,
      pagination: { total, page: parseInt(page || '1'), limit },
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] orders error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// GET /api/portal-pub/policy?t=<uuid>&s=<schema>&industria=<id>
export async function portalPolicyHandler(req: Request, res: Response): Promise<void> {
  const { t, s, industria } = req.query as Record<string, string>;
  if (!t || !s || !industria || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const r = await client.query(
      `SELECT
          ci.cli_tabela,
          ci.cli_comprador,
          ci.cli_frete,
          ci.cli_prazopg,
          ci.cli_desc1, ci.cli_desc2, ci.cli_desc3, ci.cli_desc4,
          ci.cli_desc5, ci.cli_desc6, ci.cli_desc7,
          f.for_nomered AS transportadora_nome
       FROM cli_ind ci
       LEFT JOIN fornecedores f ON f.for_codigo = ci.cli_transportadora
       WHERE ci.cli_codigo = $1 AND ci.cli_forcodigo = $2
       LIMIT 1`,
      [cliCodigo, parseInt(industria)]
    );

    if (r.rows.length === 0) {
      res.json({ success: true, policy: null });
      return;
    }

    const row = r.rows[0];
    const descontos: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const v = parseFloat(row[`cli_desc${i}`] || '0');
      if (v > 0) descontos.push(v);
    }

    res.json({
      success: true,
      policy: {
        tabela: row.cli_tabela,
        comprador: row.cli_comprador,
        frete: row.cli_frete,
        prazo: row.cli_prazopg,
        transportadora: row.transportadora_nome,
        descontos,
      },
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] policy error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// POST /api/portal-pub/cotacao  body: { t, s, industria, rawCodes }
// Resolve produtos + preços sincronamente (mesmo fluxo do SmartImporter),
// cria pedido 'J' + insere itens em transação, devolve itens resolvidos na resposta.
export async function portalCotacaoCreateHandler(req: Request, res: Response): Promise<void> {
  const { t, s, industria, rawCodes } = req.body as Record<string, string>;
  if (!t || !s || !industria || !rawCodes?.trim() || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const indId = parseInt(industria);

    // 1. Política comercial
    const polR = await client.query(
      `SELECT cli_tabela, cli_comprador, cli_frete, cli_prazopg,
              COALESCE(cli_transportadora, 0) AS cli_transportadora,
              COALESCE(cli_desc1,0) AS desc1, COALESCE(cli_desc2,0) AS desc2,
              COALESCE(cli_desc3,0) AS desc3, COALESCE(cli_desc4,0) AS desc4,
              COALESCE(cli_desc5,0) AS desc5, COALESCE(cli_desc6,0) AS desc6,
              COALESCE(cli_desc7,0) AS desc7
       FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1`,
      [cliCodigo, indId]
    );
    const pol = polR.rows[0] || {};
    const descontos = [1,2,3,4,5,6,7]
      .map(i => parseFloat(pol[`desc${i}`] || '0'))
      .filter(d => d > 0);

    // 2. Parse + resolve (cobre pro_codprod, conversao, codigooriginal, codigonormalizado,
    //    codbarras, normalizado sem hífens/pontos, e nome ILIKE como fallback)
    const linhas = parseRawCodes(rawCodes);
    const { itens, totBruto, totLiq } = await resolveLinhasParaCotacao(
      client, indId, pol.cli_tabela || '', descontos, linhas
    );

    // 6. Transação: cria pedido + insere itens (igual ao SmartImporter checkout)
    await client.query('BEGIN');

    const ins = await client.query(
      `WITH next AS (SELECT nextval('pedidos_ped_numero_seq') AS n)
       INSERT INTO pedidos
         (ped_numero, ped_pedido, ped_situacao, ped_cliente, ped_industria,
          ped_tabela, ped_condpag, ped_tipofrete, ped_comprador, ped_transp, ped_vendedor,
          ped_obs, ped_data, ped_totbruto, ped_totliq,
          ped_pri, ped_seg, ped_ter, ped_qua, ped_qui, ped_sex, ped_set)
       SELECT n, 'PT' || LPAD(n::text, 6, '0'), 'J', $1, $2, $3, $4, $5, $6, $7, 0,
              $8, CURRENT_DATE, $9, $10,
              $11, $12, $13, $14, $15, $16, $17
       FROM next
       RETURNING ped_numero, ped_pedido`,
      [
        cliCodigo, indId,
        pol.cli_tabela || null, pol.cli_prazopg || null,
        (pol.cli_frete || 'C').slice(0, 1).toUpperCase(),
        (pol.cli_comprador || '').slice(0, 30) || null,
        parseInt(pol.cli_transportadora) || 0,
        rawCodes.trim(), totBruto, totLiq,
        ...[1,2,3,4,5,6,7].map((_, i) => descontos[i] || 0),
      ]
    );

    const pedNumero = ins.rows[0].ped_numero;
    const pedPedido = ins.rows[0].ped_pedido;

    const descValues = [1,2,3,4,5,6,7].map((_, i) => descontos[i] || 0);
    for (const item of itens.filter((i: any) => i.found)) {
      await client.query(
        `INSERT INTO itens_ped
           (ite_pedido, ite_industria, ite_idproduto, ite_seq, ite_produto, ite_nomeprod, ite_embuch,
            ite_quant, ite_puni, ite_puniliq, ite_totliquido, ite_totbruto,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5, ite_des6, ite_des7)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [pedPedido, indId, item.pro_id, item.seq, item.ite_produto, item.ite_nomeprod, item.ite_embuch,
         item.ite_quant, item.ite_puni, item.ite_puniliq, item.ite_totliquido, item.ite_puni,
         ...descValues]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, ped_numero: pedNumero, ped_pedido: pedPedido, itens });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [PORTAL-PUB] cotacao create error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// GET /api/portal-pub/cotacao/:pedNumero?t=<uuid>&s=<schema>
// Retorna status da cotação: pendente (sem itens) ou pronta (com itens)
export async function portalCotacaoStatusHandler(req: Request, res: Response): Promise<void> {
  const { t, s } = req.query as Record<string, string>;
  const pedNumero = req.params.pedNumero as string;
  if (!t || !s || !pedNumero || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const pedR = await client.query(
      `SELECT ped_numero, ped_pedido, ped_situacao, ped_obs, ped_data,
              ped_tabela, ped_condpag, ped_tipofrete, ped_comprador,
              ped_totbruto, ped_totliq
       FROM pedidos
       WHERE ped_numero = $1 AND ped_cliente = $2 AND ped_situacao = 'J'`,
      [parseInt(pedNumero), cliCodigo]
    );

    if (pedR.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cotação não encontrada.' });
      return;
    }

    const pedido = pedR.rows[0];

    const itensR = await client.query(
      `SELECT ite_seq, ite_produto, ite_nomeprod, ite_embuch,
              ite_quant, ite_puni, ite_puniliq, ite_totliquido,
              ite_des1, ite_des2, ite_des3, ite_des4, ite_des5, ite_des6, ite_des7
       FROM itens_ped
       WHERE ite_pedido = $1
       ORDER BY ite_seq`,
      [pedido.ped_pedido]
    );

    const status = itensR.rows.length > 0 ? 'pronta' : 'pendente';

    res.json({
      success: true,
      status,
      pedido,
      itens: itensR.rows,
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] cotacao status error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// POST /api/portal-pub/cotacao/:pedNumero/itens  body: { t, s, rawCodes }
// Adiciona mais itens a uma cotação 'J' existente
export async function portalCotacaoAddItemsHandler(req: Request, res: Response): Promise<void> {
  const { t, s, rawCodes } = req.body as Record<string, string>;
  const pedNumero = parseInt(String(req.params.pedNumero));
  if (!t || !s || !rawCodes?.trim() || !validSchema(s) || isNaN(pedNumero)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const pedR = await client.query(
      `SELECT ped_pedido, ped_industria, ped_tabela
       FROM pedidos WHERE ped_numero = $1 AND ped_cliente = $2 AND ped_situacao = 'J'`,
      [pedNumero, cliCodigo]
    );
    if (pedR.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cotação não encontrada ou já confirmada.' });
      return;
    }
    const ped = pedR.rows[0];
    const indId = ped.ped_industria;

    const polR = await client.query(
      `SELECT cli_tabela,
              COALESCE(cli_desc1,0) AS desc1, COALESCE(cli_desc2,0) AS desc2,
              COALESCE(cli_desc3,0) AS desc3, COALESCE(cli_desc4,0) AS desc4,
              COALESCE(cli_desc5,0) AS desc5, COALESCE(cli_desc6,0) AS desc6,
              COALESCE(cli_desc7,0) AS desc7
       FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1`,
      [cliCodigo, indId]
    );
    const pol = polR.rows[0] || {};
    const descontos = [1,2,3,4,5,6,7]
      .map(i => parseFloat(pol[`desc${i}`] || '0'))
      .filter(d => d > 0);

    const seqR = await client.query(
      `SELECT COALESCE(MAX(ite_seq), 0) AS max_seq FROM itens_ped WHERE ite_pedido = $1`,
      [ped.ped_pedido]
    );
    let seq = parseInt(seqR.rows[0].max_seq) + 1;

    const linhas = parseRawCodes(rawCodes);
    const { itens: novosItens, totBruto: addBruto, totLiq: addLiq } =
      await resolveLinhasParaCotacao(client, indId, pol.cli_tabela || '', descontos, linhas, seq);
    const descValues = [1,2,3,4,5,6,7].map((_,i) => descontos[i] || 0);

    await client.query('BEGIN');
    for (const item of novosItens.filter((i: any) => i.found)) {
      await client.query(
        `INSERT INTO itens_ped
           (ite_pedido, ite_industria, ite_idproduto, ite_seq, ite_produto, ite_nomeprod, ite_embuch,
            ite_quant, ite_puni, ite_puniliq, ite_totliquido, ite_totbruto,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5, ite_des6, ite_des7)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [ped.ped_pedido, indId, item.pro_id, item.seq, item.ite_produto, item.ite_nomeprod, item.ite_embuch,
         item.ite_quant, item.ite_puni, item.ite_puniliq, item.ite_totliquido, item.ite_puni,
         ...descValues]
      );
    }
    await client.query(
      `UPDATE pedidos SET ped_totbruto = COALESCE(ped_totbruto,0) + $1, ped_totliq = COALESCE(ped_totliq,0) + $2
       WHERE ped_numero = $3`,
      [addBruto, addLiq, pedNumero]
    );
    await client.query('COMMIT');

    res.json({ success: true, itens: novosItens });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [PORTAL-PUB] add-items error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// GET /api/portal-pub/insights?t=<uuid>&s=<schema>&industria=<id>
export async function portalInsightsHandler(req: Request, res: Response): Promise<void> {
  const { t, s, industria } = req.query as Record<string, string>;
  if (!t || !s || !industria || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const indId = parseInt(industria);

    const mensalR = await client.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', p.ped_data), 'YYYY-MM') AS mes,
             SUM(COALESCE(p.ped_totliq, p.ped_totbruto, 0)) AS total
      FROM pedidos p
      WHERE p.ped_cliente = $1 AND p.ped_industria = $2
        AND p.ped_situacao IN ('P','F')
        AND p.ped_data >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
      GROUP BY 1 ORDER BY 1`, [cliCodigo, indId]);

    const esquecidasR = await client.query(`
      SELECT ip.ite_produto AS codigo, MIN(ip.ite_nomeprod) AS nome,
             MAX(p.ped_data)::date AS ultima_compra
      FROM itens_ped ip
      JOIN pedidos p ON p.ped_pedido = ip.ite_pedido
      WHERE p.ped_cliente = $1 AND p.ped_industria = $2
        AND p.ped_situacao IN ('P','F')
        AND ip.ite_produto NOT IN (
          SELECT DISTINCT ip2.ite_produto FROM itens_ped ip2
          JOIN pedidos p2 ON p2.ped_pedido = ip2.ite_pedido
          WHERE p2.ped_cliente = $1 AND p2.ped_industria = $2
            AND p2.ped_situacao IN ('P','F')
            AND p2.ped_data >= NOW() - INTERVAL '90 days'
        )
      GROUP BY ip.ite_produto ORDER BY ultima_compra DESC LIMIT 6`, [cliCodigo, indId]);

    const topR = await client.query(`
      SELECT ip.ite_produto AS codigo, MIN(ip.ite_nomeprod) AS nome,
             SUM(COALESCE(ip.ite_totliquido, 0)) AS total_comprado
      FROM itens_ped ip
      JOIN pedidos p ON p.ped_pedido = ip.ite_pedido
      WHERE p.ped_cliente = $1 AND p.ped_industria = $2
        AND p.ped_situacao IN ('P','F')
        AND p.ped_data >= NOW() - INTERVAL '12 months'
      GROUP BY ip.ite_produto ORDER BY total_comprado DESC LIMIT 5`, [cliCodigo, indId]);

    const sugestaoR = await client.query(`
      SELECT ip.ite_produto AS codigo, MIN(ip.ite_nomeprod) AS nome,
             COUNT(DISTINCT p.ped_cliente) AS num_clientes
      FROM itens_ped ip
      JOIN pedidos p ON p.ped_pedido = ip.ite_pedido
      WHERE p.ped_industria = $2 AND p.ped_situacao IN ('P','F')
        AND p.ped_cliente <> $1
        AND ip.ite_produto NOT IN (
          SELECT DISTINCT ip2.ite_produto FROM itens_ped ip2
          JOIN pedidos p2 ON p2.ped_pedido = ip2.ite_pedido
          WHERE p2.ped_cliente = $1 AND p2.ped_industria = $2
            AND p2.ped_situacao IN ('P','F')
        )
      GROUP BY ip.ite_produto ORDER BY num_clientes DESC LIMIT 5`, [cliCodigo, indId]);

    // Último pedido itens
    let ultimoPedidoItens: Array<{ codigo: string; nome: string; quantidade: number }> = [];
    let diasUltimoPedido: number | null = null;

    const ultimoPedR = await client.query(
      `SELECT ped_pedido, ped_data FROM pedidos
       WHERE ped_cliente = $1 AND ped_industria = $2 AND ped_situacao IN ('P','F')
       ORDER BY ped_data DESC, ped_numero DESC LIMIT 1`,
      [cliCodigo, indId]
    );

    if (ultimoPedR.rows.length > 0) {
      const { ped_pedido, ped_data } = ultimoPedR.rows[0];
      diasUltimoPedido = Math.floor(
        (Date.now() - new Date(ped_data).getTime()) / (1000 * 60 * 60 * 24)
      );
      const itensR = await client.query(
        `SELECT ite_produto AS codigo,
                MIN(ite_nomeprod) AS nome,
                SUM(ite_quant)::int AS quantidade
         FROM itens_ped
         WHERE ite_pedido = $1
         GROUP BY ite_produto
         ORDER BY quantidade DESC`,
        [ped_pedido]
      );
      ultimoPedidoItens = itensR.rows;
    }

    res.json({
      success: true,
      mensal: mensalR.rows,
      esquecidos: esquecidasR.rows,
      topProdutos: topR.rows,
      sugestoes: sugestaoR.rows,
      ultimoPedidoItens,
      diasUltimoPedido,
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] insights error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// GET /api/portal-pub/produtos?t=<uuid>&s=<schema>&industria=<id>&q=&categoria=&limit=20&offset=0
export async function portalProdutosHandler(req: Request, res: Response): Promise<void> {
  const { t, s, industria, q = '', categoria = '', limit = '20', offset = '0' } = req.query as Record<string, string>;
  const indId = parseInt(industria);
  if (!t || !s || !industria || !validSchema(s) || isNaN(indId)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const lim   = Math.min(parseInt(limit) || 20, 50);
    const off   = parseInt(offset) || 0;

    const totalR = await client.query(
      `SELECT COUNT(*)::int AS total FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE
         AND ($2 = '' OR pro_codprod ILIKE '%' || $2 || '%' OR pro_nome ILIKE '%' || $2 || '%')
         AND ($3 = '' OR pro_grupo = $3)`,
      [indId, q, categoria]
    );

    const produtosR = await client.query(
      `SELECT pro_codprod AS codigo, pro_nome AS nome, pro_grupo AS categoria
       FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE
         AND ($2 = '' OR pro_codprod ILIKE '%' || $2 || '%' OR pro_nome ILIKE '%' || $2 || '%')
         AND ($3 = '' OR pro_grupo = $3)
       ORDER BY pro_codprod
       LIMIT $4 OFFSET $5`,
      [indId, q, categoria, lim, off]
    );

    const categoriasR = await client.query(
      `SELECT DISTINCT pro_grupo AS categoria FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE AND pro_grupo IS NOT NULL
       ORDER BY pro_grupo`,
      [indId]
    );

    res.json({
      success: true,
      total: totalR.rows[0].total,
      produtos: produtosR.rows,
      categorias: categoriasR.rows.map((r: any) => r.categoria),
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] produtos error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}

// POST /api/portal-pub/cotacao/:pedNumero/confirmar  body: { t, s }
// Lojista aprova → 'J' vira 'C' para o representante processar
export async function portalCotacaoConfirmHandler(req: Request, res: Response): Promise<void> {
  const { t, s } = req.body as Record<string, string>;
  const pedNumero = parseInt(String(req.params.pedNumero));
  if (!t || !s || !validSchema(s) || isNaN(pedNumero)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const r = await client.query(
      `UPDATE pedidos SET ped_situacao = 'C'
       WHERE ped_numero = $1 AND ped_cliente = $2 AND ped_situacao = 'J'
       RETURNING ped_pedido`,
      [pedNumero, cliCodigo]
    );
    if (r.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cotação não encontrada ou já confirmada.' });
      return;
    }
    res.json({ success: true, ped_pedido: r.rows[0].ped_pedido });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] confirmar error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}
