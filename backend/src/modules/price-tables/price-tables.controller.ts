import { Request, Response } from 'express';
import { getLinkedSellerId, buildIndustryFilterClause } from '../../shared/permissions';
import { pool } from '../../config/database';

function cleanInd(v: string | number | string[]): number {
  const s = String(Array.isArray(v) ? v[0] : v);
  return parseInt(s.includes(':') ? s.split(':')[0] : s);
}

// ─── GET /api/price-tables/ ───────────────────────────────────────────────────
export async function listAllPriceTablesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = req.user?.userId;
    const sellerId = await getLinkedSellerId(db, userId);
    const { filterClause, params } = buildIndustryFilterClause(sellerId, 't.itab_idindustria');

    const result = await db.query(`
      SELECT
        itab_tabela        AS nome_tabela,
        itab_idindustria   AS industria,
        f.for_nomered      AS industria_nome,
        COUNT(*)           AS total_produtos,
        MIN(itab_datatabela)   AS data_criacao,
        MAX(itab_datavencimento) AS data_vencimento
      FROM cad_tabelaspre t
      INNER JOIN fornecedores f ON f.for_codigo = t.itab_idindustria
      WHERE 1=1 ${filterClause}
      GROUP BY itab_tabela, itab_idindustria, f.for_nomered
      ORDER BY itab_idindustria, itab_tabela
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] list all:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/price-tables/:industria ────────────────────────────────────────
export async function getPriceTablesByIndustriaHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const db = req.db!;
    const cleanId = cleanInd(industria);
    if (isNaN(cleanId)) { res.json({ success: true, data: [] }); return; }

    const result = await db.query(`
      SELECT
        itab_tabela        AS nome_tabela,
        COUNT(*)           AS total_produtos,
        MIN(itab_datatabela)     AS data_criacao,
        MAX(itab_datavencimento) AS data_vencimento
      FROM cad_tabelaspre
      WHERE itab_idindustria = $1
      GROUP BY itab_tabela
      ORDER BY itab_tabela
    `, [cleanId]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] by industria:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/price-tables/adjust-linear/:industria?tabela= ─────────────────
export async function adjustLinearHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela     = String(req.query.tabela || '').trim();
    const percentual = parseFloat(req.body?.percentual ?? req.query.percentual as string);

    if (!tabela)              { res.status(400).json({ success: false, message: 'tabela obrigatória.' }); return; }
    if (isNaN(percentual))   { res.status(400).json({ success: false, message: 'percentual inválido.' }); return; }
    if (Math.abs(percentual) > 100) { res.status(400).json({ success: false, message: 'Percentual deve estar entre -100 e 100.' }); return; }

    const db      = req.db!;
    const indId   = parseInt(String(industria));
    const fator   = 1 + percentual / 100;

    const r = await db.query(`
      UPDATE cad_tabelaspre
      SET
        itab_precobruto  = ROUND((itab_precobruto::NUMERIC  * $3), 4),
        itab_precopromo  = CASE WHEN COALESCE(itab_precopromo, 0) > 0
                           THEN ROUND((itab_precopromo::NUMERIC * $3), 4)
                           ELSE itab_precopromo END,
        itab_precoespecial = CASE WHEN COALESCE(itab_precoespecial, 0) > 0
                             THEN ROUND((itab_precoespecial::NUMERIC * $3), 4)
                             ELSE itab_precoespecial END
      WHERE itab_idindustria = $1 AND itab_tabela = $2
      RETURNING itab_idprod
    `, [indId, tabela, fator]);

    res.json({
      success: true,
      message: `Ajuste de ${percentual > 0 ? '+' : ''}${percentual}% aplicado a ${r.rowCount} produto(s).`,
      total: r.rowCount,
    });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] adjust-linear:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/price-tables/:industria?tabela= ─────────────────────────────
export async function deletePriceTableHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    if (!tabela) { res.status(400).json({ success: false, message: 'tabela obrigatória.' }); return; }
    const db = req.db!;

    const result = await db.query(
      `DELETE FROM cad_tabelaspre WHERE itab_idindustria = $1 AND itab_tabela = $2 RETURNING *`,
      [parseInt(String(industria)), tabela]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Tabela não encontrada.' });
      return;
    }
    res.json({ success: true, message: `Tabela ${tabela} excluída.`, total: result.rows.length });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] delete table:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/price-tables/product/:industria/:productId?tabela= ──────────
export async function deletePriceTableProductHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria, productId } = req.params;
    const tabela = String(req.query.tabela || '');
    const db = req.db!;

    const result = await db.query(
      `DELETE FROM cad_tabelaspre
       WHERE itab_idprod = $1 AND itab_idindustria = $2 AND itab_tabela = $3
       RETURNING *`,
      [parseInt(String(productId)), parseInt(String(industria)), tabela]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Produto não encontrado nesta tabela.' });
      return;
    }
    res.json({ success: true, message: 'Produto removido da tabela.' });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] delete product:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/price-tables/rename/:industria?tabela= ─────────────────────────
export async function renamePriceTableHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const { novoNome } = req.body;
    if (!tabela) { res.status(400).json({ success: false, message: 'tabela obrigatória.' }); return; }
    if (!novoNome?.trim()) { res.status(400).json({ success: false, message: 'novoNome obrigatório.' }); return; }
    const db = req.db!;

    const result = await db.query(
      `UPDATE cad_tabelaspre SET itab_tabela = $1
       WHERE itab_idindustria = $2 AND itab_tabela = $3
       RETURNING itab_tabela`,
      [novoNome.trim(), parseInt(String(industria)), tabela]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Tabela não encontrada.' });
      return;
    }
    res.json({ success: true, message: `Tabela renomeada para "${novoNome.trim()}".`, total: result.rows.length });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] rename:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/price-tables/update-ipi/:industria?tabela= ─────────────────────
export async function updateIpiHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const { percentage } = req.body;
    const db = req.db!;

    if (percentage === undefined || percentage === null) {
      res.status(400).json({ success: false, message: 'Percentual é obrigatório.' });
      return;
    }

    const result = await db.query(
      `UPDATE cad_tabelaspre SET itab_ipi = $1 WHERE itab_idindustria = $2 AND itab_tabela = $3 RETURNING *`,
      [parseFloat(String(percentage)), parseInt(String(industria)), tabela]
    );

    res.json({ success: true, message: `IPI atualizado em ${result.rows.length} produtos.`, total: result.rows.length });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] update-ipi:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/price-tables/:industria/items?tabela= — itens da tabela para uso no pedido ──
export async function getPriceTableItemsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const db = req.db!;
    const cleanId = cleanInd(industria);

    if (isNaN(cleanId) || !tabela) {
      res.status(400).json({ success: false, message: 'industria e tabela são obrigatórios.' });
      return;
    }

    const result = await db.query(`
      SELECT
        t.itab_idprod        AS pro_id,
        p.pro_codprod        AS pro_codigo,
        p.pro_nome           AS pro_nome,
        p.pro_grupo          AS pro_grupo,
        p.pro_embalagem      AS pro_embalagem,
        p.pro_peso           AS pro_peso,
        p.pro_conversao      AS pro_conversao,
        t.itab_precobruto    AS preco_bruto,
        t.itab_precopromo    AS preco_promo,
        t.itab_precoespecial AS preco_especial,
        t.itab_prepeso       AS preco_peso,
        t.itab_ipi           AS ipi,
        t.itab_st            AS st,
        p.pro_codigooriginal AS pro_codigooriginal,
        t.itab_grupodesconto AS grupo_desconto,
        t.itab_descontoadd   AS desconto_add
      FROM cad_tabelaspre t
      INNER JOIN cad_prod p ON p.pro_id = t.itab_idprod
      WHERE t.itab_idindustria = $1
        AND t.itab_tabela = $2
      ORDER BY p.pro_nome
    `, [cleanId, tabela]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] items:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/price-tables/update-st/:industria?tabela= ──────────────────────
export async function updateStHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const { percentage } = req.body;
    const db = req.db!;

    if (percentage === undefined || percentage === null) {
      res.status(400).json({ success: false, message: 'Percentual é obrigatório.' });
      return;
    }

    const result = await db.query(
      `UPDATE cad_tabelaspre SET itab_st = $1 WHERE itab_idindustria = $2 AND itab_tabela = $3 RETURNING *`,
      [parseFloat(String(percentage)), parseInt(String(industria)), tabela]
    );

    res.json({ success: true, message: `ST atualizado em ${result.rows.length} produtos.`, total: result.rows.length });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] update-st:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/price-tables/set-discount-group/:industria?tabela= ─────────────
export async function setDiscountGroupHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const { itab_grupodesconto } = req.body;
    const db = req.db!;

    if (!itab_grupodesconto) {
      res.status(400).json({ success: false, message: 'Grupo de desconto é obrigatório.' });
      return;
    }

    const result = await db.query(
      `UPDATE cad_tabelaspre SET itab_grupodesconto = $1 WHERE itab_idindustria = $2 AND itab_tabela = $3 RETURNING *`,
      [parseInt(String(itab_grupodesconto)), parseInt(String(industria)), tabela]
    );

    res.json({ success: true, message: `Grupo de desconto aplicado a ${result.rows.length} produtos.` });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] set-discount-group:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/price-tables/remove-discount-group/:industria?tabela= ──────────
export async function removeDiscountGroupHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const db = req.db!;

    const result = await db.query(
      `UPDATE cad_tabelaspre SET itab_grupodesconto = NULL WHERE itab_idindustria = $1 AND itab_tabela = $2 RETURNING *`,
      [parseInt(String(industria)), tabela]
    );

    res.json({ success: true, message: `Grupo de desconto removido de ${result.rows.length} produtos.` });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] remove-discount-group:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/price-tables/import ───────────────────────────────────────────
export async function importPriceTableHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  try {
    const { industria, nomeTabela, grupoDesconto, produtos, dataTabela, dataVencimento } = req.body;

    if (!industria || !nomeTabela || !Array.isArray(produtos) || produtos.length === 0) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios: industria, nomeTabela, produtos (array).' });
      return;
    }

    const indId = Number(industria);
    const today = dataTabela || new Date().toISOString().split('T')[0];

    const safeFloat = (v: any): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? null : n;
    };
    const safeInt = (v: any): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseInt(String(v));
      return isNaN(n) ? null : n;
    };
    const normalizeCode = (c: string) =>
      c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() || null : null;

    // ── Query 1: carregar lookups de grupos ────────────────────────────────────
    const [discRes, grpRes] = await Promise.all([
      db.query('SELECT gde_id, gid, gde_nome FROM grupo_desc'),
      db.query('SELECT gru_codigo, gru_nome FROM grupos'),
    ]);
    const discMap: Record<string, number> = {};
    discRes.rows.forEach((g: any) => {
      if (g.gid)      discMap[String(g.gid).toUpperCase().trim()]      = g.gde_id;
      if (g.gde_nome) discMap[String(g.gde_nome).toUpperCase().trim()] = g.gde_id;
      discMap[String(g.gde_id)] = g.gde_id;
    });
    const grpMap: Record<string, number> = {};
    grpRes.rows.forEach((g: any) => {
      if (g.gru_nome) grpMap[String(g.gru_nome).toUpperCase().trim()] = g.gru_codigo;
      grpMap[String(g.gru_codigo)] = g.gru_codigo;
    });

    // ── Pré-processar produtos no JS (zero round-trips) ───────────────────────
    type ProdProcessed = {
      codigo: string; normalizedCode: string;
      nome: string | null; peso: number | null; embalagem: number | null;
      grupoProd: number | null; linha: string | null; ncm: string | null;
      aplicacao: string | null; codbarras: string | null; conversao: string | null;
      precobruto: number; precopromo: number | null; precoespecial: number | null;
      ipi: number | null; st: number | null; grupoDesc: number | null;
      descontoadd: number | null; prepeso: number | null;
    };

    const processed: ProdProcessed[] = [];
    for (const p of produtos) {
      const nc = normalizeCode(String(p.codigo || ''));
      if (!nc) continue;
      const gDescVal = (grupoDesconto && grupoDesconto !== 'none') ? grupoDesconto : p.grupodesconto;
      processed.push({
        codigo:        String(p.codigo || '').substring(0, 100),
        normalizedCode: nc,
        nome:          p.descricao ? String(p.descricao).substring(0, 100) : null,
        peso:          safeFloat(p.peso),
        embalagem:     safeInt(p.embalagem),
        grupoProd:     p.grupo ? (grpMap[String(p.grupo).toUpperCase().trim()] ?? safeInt(p.grupo)) : null,
        linha:         p.linha ? String(p.linha).substring(0, 50) : null,
        ncm:           p.ncm || null,
        aplicacao:     p.aplicacao || null,
        codbarras:     p.codbarras || null,
        conversao:     p.conversao || null,
        precobruto:    safeFloat(p.precobruto) ?? 0,
        precopromo:    safeFloat(p.precopromo),
        precoespecial: safeFloat(p.precoespecial),
        ipi:           safeFloat(p.ipi),
        st:            safeFloat(p.st),
        grupoDesc:     gDescVal ? (discMap[String(gDescVal).toUpperCase().trim()] ?? safeInt(gDescVal)) : null,
        descontoadd:   safeFloat(p.descontoadd),
        prepeso:       safeFloat(p.prepeso),
      });
    }

    if (processed.length === 0) {
      res.json({ success: true, message: 'Nenhum produto válido.', resumo: { total: 0, produtosNovos: 0, produtosAtualizados: 0, erros: 0, detalhesErros: [] } });
      return;
    }

    // ── Query 2: buscar produtos existentes de uma vez ────────────────────────
    const allNormCodes = processed.map(p => p.normalizedCode);
    const existingRes = await db.query(
      `SELECT pro_id, pro_codigonormalizado FROM cad_prod
       WHERE pro_industria = $1 AND pro_codigonormalizado = ANY($2::text[])`,
      [indId, allNormCodes]
    );
    const existingMap = new Map<string, number>(
      existingRes.rows.map((r: any) => [r.pro_codigonormalizado as string, r.pro_id as number])
    );

    const newProds = processed.filter(p => !existingMap.has(p.normalizedCode));
    const updProds = processed.filter(p =>  existingMap.has(p.normalizedCode));

    await db.query('BEGIN');

    const insertedMap = new Map<string, number>();

    // ── Query 3: bulk INSERT novos produtos ───────────────────────────────────
    if (newProds.length > 0) {
      const insRes = await db.query(
        `INSERT INTO cad_prod
           (pro_industria, pro_codprod, pro_codigonormalizado, pro_nome,
            pro_peso, pro_embalagem, pro_grupo, pro_linha, pro_ncm,
            pro_aplicacao, pro_codbarras, pro_conversao)
         SELECT
           unnest($1::int[]), unnest($2::text[]), unnest($3::text[]), unnest($4::text[]),
           unnest($5::float8[]), unnest($6::int[]), unnest($7::int[]), unnest($8::text[]),
           unnest($9::text[]), unnest($10::text[]), unnest($11::text[]), unnest($12::text[])
         ON CONFLICT DO NOTHING
         RETURNING pro_id, pro_codigonormalizado`,
        [
          newProds.map(() => indId),
          newProds.map(p => p.codigo),
          newProds.map(p => p.normalizedCode),
          newProds.map(p => p.nome),
          newProds.map(p => p.peso),
          newProds.map(p => p.embalagem),
          newProds.map(p => p.grupoProd),
          newProds.map(p => p.linha),
          newProds.map(p => p.ncm),
          newProds.map(p => p.aplicacao),
          newProds.map(p => p.codbarras),
          newProds.map(p => p.conversao),
        ]
      );
      insRes.rows.forEach((r: any) => insertedMap.set(r.pro_codigonormalizado, r.pro_id));
    }

    // ── Query 4: bulk UPDATE produtos existentes ──────────────────────────────
    if (updProds.length > 0) {
      await db.query(
        `UPDATE cad_prod SET
           pro_nome        = COALESCE(NULLIF(v.nome, ''), pro_nome),
           pro_peso        = COALESCE(v.peso,       pro_peso),
           pro_embalagem   = COALESCE(v.embalagem,  pro_embalagem),
           pro_grupo       = COALESCE(v.grupo,      pro_grupo),
           pro_linha       = COALESCE(NULLIF(v.linha,''),      pro_linha),
           pro_ncm         = COALESCE(NULLIF(v.ncm,''),        pro_ncm),
           pro_aplicacao   = COALESCE(NULLIF(v.aplicacao,''),  pro_aplicacao),
           pro_codbarras   = COALESCE(NULLIF(v.codbarras,''),  pro_codbarras),
           pro_conversao   = COALESCE(NULLIF(v.conversao,''),  pro_conversao)
         FROM (SELECT
           unnest($1::int[])    AS pro_id,
           unnest($2::text[])   AS nome,
           unnest($3::float8[]) AS peso,
           unnest($4::int[])    AS embalagem,
           unnest($5::int[])    AS grupo,
           unnest($6::text[])   AS linha,
           unnest($7::text[])   AS ncm,
           unnest($8::text[])   AS aplicacao,
           unnest($9::text[])   AS codbarras,
           unnest($10::text[])  AS conversao
         ) AS v
         WHERE cad_prod.pro_id = v.pro_id`,
        [
          updProds.map(p => existingMap.get(p.normalizedCode)!),
          updProds.map(p => p.nome),
          updProds.map(p => p.peso),
          updProds.map(p => p.embalagem),
          updProds.map(p => p.grupoProd),
          updProds.map(p => p.linha),
          updProds.map(p => p.ncm),
          updProds.map(p => p.aplicacao),
          updProds.map(p => p.codbarras),
          updProds.map(p => p.conversao),
        ]
      );
    }

    // Mapa completo normCode → pro_id
    const allIdMap = new Map<string, number>([...existingMap, ...insertedMap]);
    const prodsWithId = processed
      .map(p => ({ ...p, proId: allIdMap.get(p.normalizedCode) }))
      .filter(p => p.proId != null) as (ProdProcessed & { proId: number })[];

    // ── Query 5: bulk UPSERT preços ───────────────────────────────────────────
    if (prodsWithId.length > 0) {
      await db.query(
        `INSERT INTO cad_tabelaspre
           (itab_idprod, itab_idindustria, itab_tabela,
            itab_precobruto, itab_precopromo, itab_precoespecial,
            itab_ipi, itab_st, itab_grupodesconto, itab_descontoadd,
            itab_datatabela, itab_datavencimento, itab_prepeso, itab_status)
         SELECT
           unnest($1::int[]), $2, $3,
           unnest($4::float8[]), unnest($5::float8[]), unnest($6::float8[]),
           unnest($7::float8[]), unnest($8::float8[]), unnest($9::int[]),
           unnest($10::float8[]), $11, $12,
           unnest($13::float8[]), true
         ON CONFLICT (itab_idprod, itab_tabela) DO UPDATE SET
           itab_precobruto    = COALESCE(NULLIF(EXCLUDED.itab_precobruto, 0), cad_tabelaspre.itab_precobruto),
           itab_precopromo    = COALESCE(EXCLUDED.itab_precopromo,    cad_tabelaspre.itab_precopromo),
           itab_precoespecial = COALESCE(EXCLUDED.itab_precoespecial, cad_tabelaspre.itab_precoespecial),
           itab_ipi           = COALESCE(EXCLUDED.itab_ipi,           cad_tabelaspre.itab_ipi),
           itab_st            = COALESCE(EXCLUDED.itab_st,            cad_tabelaspre.itab_st),
           itab_grupodesconto = COALESCE(EXCLUDED.itab_grupodesconto, cad_tabelaspre.itab_grupodesconto),
           itab_descontoadd   = COALESCE(EXCLUDED.itab_descontoadd,   cad_tabelaspre.itab_descontoadd),
           itab_datatabela    = COALESCE(EXCLUDED.itab_datatabela, cad_tabelaspre.itab_datatabela),
           itab_datavencimento= COALESCE(EXCLUDED.itab_datavencimento,cad_tabelaspre.itab_datavencimento),
           itab_prepeso       = COALESCE(EXCLUDED.itab_prepeso,       cad_tabelaspre.itab_prepeso),
           itab_status        = true`,
        [
          prodsWithId.map(p => p.proId),
          indId,
          nomeTabela,
          prodsWithId.map(p => p.precobruto),
          prodsWithId.map(p => p.precopromo),
          prodsWithId.map(p => p.precoespecial),
          prodsWithId.map(p => p.ipi),
          prodsWithId.map(p => p.st),
          prodsWithId.map(p => p.grupoDesc),
          prodsWithId.map(p => p.descontoadd),
          today,
          dataVencimento || null,
          prodsWithId.map(p => p.prepeso),
        ]
      );
    }

    await db.query('COMMIT');
    res.json({
      success: true,
      message: 'Importação concluída.',
      resumo: {
        total: processed.length,
        produtosNovos: insertedMap.size,
        produtosAtualizados: updProds.length,
        erros: 0,
        detalhesErros: [],
      },
    });
  } catch (error: any) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('❌ [PRICE-TABLES] import:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
