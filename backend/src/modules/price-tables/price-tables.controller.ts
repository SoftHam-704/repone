import { Request, Response } from 'express';
import { getLinkedSellerId, buildIndustryFilterClause } from '../../shared/permissions';
import { pool } from '../../config/database';

function cleanInd(v: string | number | string[]): number {
  const s = String(Array.isArray(v) ? v[0] : v);
  return parseInt(s.includes(':') ? s.split(':')[0] : s);
}

// ─── GET /api/price-tables/?incluirInativas=true ─────────────────────────────
export async function listAllPriceTablesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = req.user?.userId;
    const sellerId = await getLinkedSellerId(db, userId);
    const { filterClause, params } = buildIndustryFilterClause(sellerId, 't.itab_idindustria');
    const incluirInativas = String(req.query.incluirInativas || '').toLowerCase() === 'true';

    // BOOL_OR: tabela é "ativa" se PELO MENOS UM item tiver itab_status=true.
    // Se REP desativar a tabela inteira, todos viram false → ativa=false.
    const result = await db.query(`
      SELECT
        itab_tabela        AS nome_tabela,
        itab_idindustria   AS industria,
        f.for_nomered      AS industria_nome,
        COUNT(*)           AS total_produtos,
        MIN(itab_datatabela)   AS data_criacao,
        MAX(itab_datavencimento) AS data_vencimento,
        COALESCE(BOOL_OR(itab_status), true) AS ativa,
        CASE WHEN MAX(itab_datavencimento) IS NOT NULL
                  AND MAX(itab_datavencimento) < CURRENT_DATE
             THEN true ELSE false END AS vencida
      FROM cad_tabelaspre t
      INNER JOIN fornecedores f ON f.for_codigo = t.itab_idindustria
      WHERE 1=1 ${filterClause}
      GROUP BY itab_tabela, itab_idindustria, f.for_nomered
      ${incluirInativas ? '' : 'HAVING COALESCE(BOOL_OR(itab_status), true) = true'}
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

    const incluirInativas = String(req.query.incluirInativas || '').toLowerCase() === 'true';
    const result = await db.query(`
      SELECT
        itab_tabela        AS nome_tabela,
        COUNT(*)           AS total_produtos,
        MIN(itab_datatabela)     AS data_criacao,
        MAX(itab_datavencimento) AS data_vencimento,
        COALESCE(BOOL_OR(itab_status), true) AS ativa,
        CASE WHEN MAX(itab_datavencimento) IS NOT NULL
                  AND MAX(itab_datavencimento) < CURRENT_DATE
             THEN true ELSE false END AS vencida
      FROM cad_tabelaspre
      WHERE itab_idindustria = $1
      GROUP BY itab_tabela
      ${incluirInativas ? '' : 'HAVING COALESCE(BOOL_OR(itab_status), true) = true'}
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

// ─── PATCH /api/price-tables/:industria/status?tabela=  body: { ativa: boolean }
// Desativa ou reativa uma tabela inteira (todos os itens dela). Não apaga dados.
export async function setPriceTableStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '').trim();
    const ativa  = req.body?.ativa === true || String(req.body?.ativa) === 'true';
    if (!tabela) { res.status(400).json({ success: false, message: 'tabela obrigatória.' }); return; }
    const db = req.db!;

    const result = await db.query(
      `UPDATE cad_tabelaspre
          SET itab_status = $3
        WHERE itab_idindustria = $1 AND itab_tabela = $2
      RETURNING itab_idprod`,
      [parseInt(String(industria)), tabela, ativa]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Tabela não encontrada.' });
      return;
    }
    res.json({
      success: true,
      message: `Tabela "${tabela}" ${ativa ? 'reativada' : 'desativada'} (${result.rowCount} itens).`,
      total: result.rowCount,
    });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] set status:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/price-tables/desativar-vencidas?dryRun=true
// Lista (dryRun=true) ou desativa tabelas com data de vencimento < hoje.
// Permission: respeita filterClause (só vê indústrias permitidas).
export async function desativarTabelasVencidasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = req.user?.userId;
    const sellerId = await getLinkedSellerId(db, userId);
    const { filterClause, params } = buildIndustryFilterClause(sellerId, 't.itab_idindustria');
    const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true';

    // Preview das tabelas candidatas (ainda ativas + vencidas)
    const preview = await db.query(`
      SELECT
        t.itab_idindustria   AS industria,
        f.for_nomered        AS industria_nome,
        t.itab_tabela        AS nome_tabela,
        MAX(t.itab_datavencimento) AS data_vencimento,
        COUNT(*)             AS total_produtos
      FROM cad_tabelaspre t
      INNER JOIN fornecedores f ON f.for_codigo = t.itab_idindustria
      WHERE 1=1 ${filterClause}
        AND t.itab_status = true
        AND t.itab_datavencimento IS NOT NULL
        AND t.itab_datavencimento < CURRENT_DATE
      GROUP BY t.itab_idindustria, f.for_nomered, t.itab_tabela
      HAVING MAX(t.itab_datavencimento) < CURRENT_DATE
      ORDER BY t.itab_idindustria, t.itab_tabela
    `, params);

    if (dryRun) {
      res.json({ success: true, dryRun: true, count: preview.rowCount, data: preview.rows });
      return;
    }

    // Aplica desativação em todos os itens encontrados
    const upd = await db.query(`
      UPDATE cad_tabelaspre t
         SET itab_status = false
        FROM (
          SELECT DISTINCT t2.itab_idindustria, t2.itab_tabela
            FROM cad_tabelaspre t2
           WHERE t2.itab_status = true
             AND t2.itab_datavencimento IS NOT NULL
             AND t2.itab_datavencimento < CURRENT_DATE
        ) v
       WHERE t.itab_idindustria = v.itab_idindustria
         AND t.itab_tabela = v.itab_tabela
      RETURNING t.itab_idprod
    `);
    res.json({
      success: true,
      message: `${preview.rowCount} tabela(s) desativada(s), ${upd.rowCount} itens afetados.`,
      tabelas: preview.rows,
      total: upd.rowCount,
    });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] desativar vencidas:', error.message);
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
        p.pro_codbarras      AS pro_codbarras,
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

// ─── PUT /api/price-tables/clear-price/:industria?tabela=&campo= ─────────────
// Zera em massa um dos campos de preço da tabela inteira (bruto/promo/especial).
// Usado quando uma promoção expira ou o gerente quer redefinir um nível de preço.
const CAMPOS_PRECO: Record<string, { col: string; label: string }> = {
  bruto:    { col: 'itab_precobruto',    label: 'Preço bruto' },
  promo:    { col: 'itab_precopromo',    label: 'Preço promo' },
  especial: { col: 'itab_precoespecial', label: 'Preço especial' },
};

export async function clearPrecoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const tabela = String(req.query.tabela || '');
    const campo  = String(req.query.campo || '').toLowerCase();
    const db = req.db!;

    const def = CAMPOS_PRECO[campo];
    if (!def) {
      res.status(400).json({ success: false, message: 'Campo inválido (use bruto, promo ou especial).' });
      return;
    }
    if (!tabela) {
      res.status(400).json({ success: false, message: 'Tabela é obrigatória.' });
      return;
    }

    const result = await db.query(
      `UPDATE cad_tabelaspre SET ${def.col} = 0 WHERE itab_idindustria = $1 AND itab_tabela = $2 RETURNING itab_idprod`,
      [parseInt(String(industria)), tabela]
    );

    res.json({
      success: true,
      message: `${def.label} zerado em ${result.rows.length} produto(s).`,
      total:   result.rows.length,
    });
  } catch (error: any) {
    console.error('❌ [PRICE-TABLES] clear-preco:', error.message);
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
    const { industria, nomeTabela: rawNomeTabela, grupoDesconto, produtos, dataTabela, dataVencimento } = req.body;
    const nomeTabela = String(rawNomeTabela || '').trim().substring(0, 60);

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
    const safeBool = (v: any): boolean | null => {
      if (v === null || v === undefined || v === '') return null;
      const s = String(v).trim().toUpperCase();
      if (s === 'S' || s === 'SIM' || s === '1' || s === 'X' || s === 'TRUE' || s === 'YES' || s === 'T') return true;
      if (s === 'N' || s === 'NAO' || s === 'NÃO' || s === '0' || s === 'NO' || s === 'FALSE' || s === 'F') return false;
      return null;
    };
    const normalizeCode = (c: string) =>
      c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() || null : null;

    // Deriva flags de segmento a partir do texto livre da coluna "linha"
    const parseLinhaFlags = (raw: string | null | undefined) => {
      if (!raw) return { linhaleve: null, linhapesada: null, linhaagricola: null, linhautilitarios: null, motocicletas: null, offroad: null, linhaamarela: null };
      // Normaliza: maiúsculo, sem acento, hífen→espaço, espaços múltiplos→um
      const s = ` ${String(raw).toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[-\/]/g, ' ').replace(/\s+/g, ' ').trim()} `;
      // word: checa palavra inteira; sub: checa substring (para frases)
      const word = (...kws: string[]) => kws.some(k => s.includes(` ${k} `));
      const sub  = (...kws: string[]) => kws.some(k => s.includes(k));
      return {
        linhaleve:        word('LEVE','PASSEIO','HATCH','SEDAN','POPULAR','AUTOMOVEL','VUC') || null,
        linhapesada:      word('PESADA','CAMINHAO','CAMINHOES','ONIBUS','CARRETA','SEMIRREBOQUE','REBOQUE','TRUCK','BUS') || null,
        linhaagricola:    word('AGRICOLA','COLHEITADEIRA','PLANTADEIRA','PULVERIZADOR','PULVERIZADORA','SEMEADEIRA','CEIFEIRA','IMPLEMENTOS') || null,
        linhautilitarios: word('UTILITARIO','UTILITARIOS','PICKUP','PICKUPS','SUV','CAMIONETE','CAMIONETA','VAN','FURGAO','FURGOES') || sub(' PICK UP ') || null,
        motocicletas:     word('MOTO','MOTOCICLETA','MOTOCICLETAS','SCOOTER','CICLOMOTOR','TRICICLO') || null,
        offroad:          word('OFFROAD','4X4','ATV','UTV','BUGGY','ENDURO','TRILHA','TODOTERRENO','QUADRICICLO') || sub('FORA DE ESTRADA') || sub(' OFF ROAD ') || null,
        linhaamarela:     word('AMARELA','TRATOR','TRATORES','ESCAVADEIRA','RETROESCAVADEIRA','MOTONIVELADORA','COMPACTADOR','EMPILHADEIRA','FORKLIFT','RETRO','OBRAS') || sub('PA CARREGADEIRA') || sub('LINHA AMARELA') || null,
      };
    };

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
    const ng = (s: any) => String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    // Normalização semântica: remove prefixo #NNN, artigos/preposições, ordena palavras
    const STOP = new Set(['DE','DO','DA','DOS','DAS','E','A','O','AS','OS','EM','NO','NA','NOS','NAS','DU','DEL']);
    const ngSem = (s: any) => String(s).toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/^#?\d+\s*/, '')        // strip prefixo tipo "#068 "
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/).filter(w => w.length > 0 && !STOP.has(w))
      .sort().join(' ');
    const grpMap: Record<string, number> = {};
    grpRes.rows.forEach((g: any) => {
      if (g.gru_nome) {
        grpMap[ng(g.gru_nome)]    = g.gru_codigo; // match exato normalizado
        grpMap[ngSem(g.gru_nome)] = g.gru_codigo; // match semântico (sem stop words, ordenado)
      }
      if (g.gid)     grpMap[ng(g.gid)]    = g.gru_codigo; // por gid
      grpMap[String(g.gru_codigo)]         = g.gru_codigo; // por ID numérico direto
    });

    // ── Pré-processar produtos no JS (zero round-trips) ───────────────────────
    type ProdProcessed = {
      idx: number;  // índice no array recebido (linha do Excel para o rep)
      codigo: string; normalizedCode: string;
      codigooriginal: string | null;
      nome: string | null; peso: number | null; embalagem: number | null;
      grupoProd: number | null; linha: string | null; ncm: string | null;
      aplicacao: string | null; codbarras: string | null; conversao: string | null;
      precobruto: number; precopromo: number | null; precoespecial: number | null;
      ipi: number | null; st: number | null; grupoDesc: number | null;
      descontoadd: number | null; prepeso: number | null;
      ciclo: string;
      origem: string | null;  // '0' Nacional, '1' Importada (CST SEFAZ). NULL = não informado
      linhaleve: boolean | null; linhapesada: boolean | null; linhaagricola: boolean | null;
      linhautilitarios: boolean | null; motocicletas: boolean | null;
      offroad: boolean | null; linhaamarela: boolean | null;
    };

    // Registro de duplicatas para o rep auditar
    type DuplicateRow = {
      codigo_normalizado: string;
      total_ocorrencias: number;
      ocorrencias: Array<{ idx: number; codigo: string; descricao: string | null }>;
      mantido_idx: number;
    };

    // Tolerante a variações: aceita 0, 1, N, I, NAC, IMP, NACIONAL, IMPORTADA, etc.
    const normOrigem = (v: any): string | null => {
      if (v == null) return null;
      const s = String(v).trim().toUpperCase();
      if (!s) return null;
      if (s === '0' || s === 'N' || s.startsWith('NAC')) return '0';
      if (s === '1' || s === 'I' || s.startsWith('IMP') || s.startsWith('EST')) return '1';
      if (/^[2-8]$/.test(s)) return s;  // outros códigos SEFAZ avançados são preservados
      return null;
    };

    const processed: ProdProcessed[] = [];
    for (let i = 0; i < produtos.length; i++) {
      const p = produtos[i];
      const nc = normalizeCode(String(p.codigo || ''));
      if (!nc) continue;
      const gDescVal = (grupoDesconto && grupoDesconto !== 'none') ? grupoDesconto : p.grupodesconto;
      const linhaFlags = parseLinhaFlags(p.linha);
      // Linha do Excel: front envia `idx` (1-based). Sem ele, fallback para offset+1.
      const rowIdx = Number.isFinite(p.idx) ? Number(p.idx) : (i + 1);
      processed.push({
        idx: rowIdx,
        // Limites alinhados com o schema do banco (cad_prod):
        //   pro_codprod varchar(25), pro_codigooriginal varchar(50),
        //   pro_nome varchar(100),    pro_linha varchar(50), pro_ncm varchar(10).
        // Em 2026-05-21 o tenant ro_consult quebrou ao importar tabela IGUAÇU porque
        // o handler truncava NCM em 20 (estourando varchar(10)) e código em 100.
        codigo:         String(p.codigo || '').substring(0, 25),
        normalizedCode: nc,
        codigooriginal: p.codigooriginal ? String(p.codigooriginal).substring(0, 50) : null,
        nome:           p.descricao ? String(p.descricao).substring(0, 100) : null,
        peso:          safeFloat(p.peso),
        embalagem:     safeInt(p.embalagem),
        grupoProd:     p.grupo ? (grpMap[ng(p.grupo)] ?? grpMap[ngSem(p.grupo)] ?? null) : null,
        linha:         p.linha ? String(p.linha).substring(0, 50) : null,
        ncm:           p.ncm ? String(p.ncm).substring(0, 10) : null,
        aplicacao:     p.aplicacao ? String(p.aplicacao).substring(0, 200) : null,
        codbarras:     p.codbarras ? String(p.codbarras).substring(0, 13) : null,
        conversao:     p.conversao ? String(p.conversao) : null,
        precobruto:    safeFloat(p.precobruto) ?? 0,
        precopromo:    safeFloat(p.precopromo),
        precoespecial: safeFloat(p.precoespecial),
        ipi:           safeFloat(p.ipi),
        st:            safeFloat(p.st),
        grupoDesc:     gDescVal ? (discMap[String(gDescVal).toUpperCase().trim()] ?? safeInt(gDescVal)) : null,
        descontoadd:      safeFloat(p.descontoadd),
        prepeso:          safeFloat(p.prepeso),
        ciclo:            (p.ciclo === 'L' || p.ciclo === 'l') ? 'L' : 'C',
        origem:           normOrigem(p.origem),
        linhaleve:        safeBool(p.linhaleve) ?? linhaFlags.linhaleve,
        linhapesada:      safeBool(p.linhapesada) ?? linhaFlags.linhapesada,
        linhaagricola:    safeBool(p.linhaagricola) ?? linhaFlags.linhaagricola,
        linhautilitarios: safeBool(p.linhautilitarios) ?? linhaFlags.linhautilitarios,
        motocicletas:     safeBool(p.motocicletas) ?? linhaFlags.motocicletas,
        offroad:          safeBool(p.offroad) ?? linhaFlags.offroad,
        linhaamarela:     safeBool(p.linhaamarela) ?? linhaFlags.linhaamarela,
      });
    }

    if (processed.length === 0) {
      res.json({ success: true, message: 'Nenhum produto válido.', resumo: { total: 0, produtosNovos: 0, produtosAtualizados: 0, erros: 0, detalhesErros: [] } });
      return;
    }

    // ── Query 2: buscar produtos existentes de uma vez ────────────────────────
    // IMPORTANTE: usa o pro_codprod (chave real) como fonte da verdade, recalculando
    // o normalizado em runtime. NÃO confia no pro_codigonormalizado armazenado,
    // porque há ~24k produtos legados com normalizado divergente (sem zeros à esquerda).
    // Isso garante que produtos como '02-334' sejam encontrados mesmo quando o
    // pro_codigonormalizado no banco está como '2334' em vez de '02334'.
    //
    // DISTINCT ON (match_code) é necessário porque alguns tenants têm duplicatas
    // legadas (ex: ro_consult/IGUAÇU tinha 4 linhas por código, 1 com normalizado
    // preenchido + 3 com NULL). Sem isso, o UPDATE self-healing tenta setar o
    // mesmo pro_codigonormalizado em N linhas e estoura o índice unique parcial.
    // Priorizamos a linha que já tem normalizado preenchido (mais "canônica");
    // empate, escolhe o menor pro_id. As duplicatas ghost ficam intocadas.
    const allNormCodes = processed.map(p => p.normalizedCode);
    // Lookup com 2 caminhos para garantir cobertura mesmo com legado divergente:
    //   1) regexp_replace(upper(pro_codprod)) — fonte da verdade (chave real)
    //   2) pro_codigonormalizado armazenado — defensivo contra legados onde
    //      pro_codigonormalizado diverge do código real.
    // ATENÇÃO: a ordem é regexp_replace(UPPER(...)), não upper(regexp_replace(...)).
    // O regex [^A-Z0-9] só matcha maiúsculas, então se o pro_codprod tem
    // letra minúscula e a gente fizer regex ANTES do upper, a letra é DEVORADA
    // (ex: 'abc123' → '123' em vez de 'ABC123'). Bug zumbi corrigido em
    // 2026-05-28 alinhado com a fn_normalizar_codigo da migration 063.
    const existingRes = await db.query(
      `SELECT DISTINCT ON (match_code) pro_id, match_code
       FROM (
         SELECT pro_id, pro_codigonormalizado,
                regexp_replace(upper(pro_codprod), '[^A-Z0-9]', '', 'g') AS match_code
         FROM cad_prod
         WHERE pro_industria = $1
           AND regexp_replace(upper(pro_codprod), '[^A-Z0-9]', '', 'g') = ANY($2::text[])
         UNION ALL
         SELECT pro_id, pro_codigonormalizado,
                pro_codigonormalizado AS match_code
         FROM cad_prod
         WHERE pro_industria = $1
           AND pro_codigonormalizado = ANY($2::text[])
       ) sub
       WHERE match_code IS NOT NULL
       ORDER BY match_code,
                (pro_codigonormalizado = match_code) DESC,   -- match EXATO vence (canônica)
                (pro_codigonormalizado IS NOT NULL) DESC,    -- normalizado preenchido vence
                pro_id ASC`,
      [indId, allNormCodes]
    );
    const existingMap = new Map<string, number>(
      existingRes.rows.map((r: any) => [r.match_code as string, r.pro_id as number])
    );

    // ── Detectar duplicatas no lote ────────────────────────────────────────
    // Conta TODAS as ocorrências por normalizedCode (sem distinguir new/upd) e
    // captura quais colidiram para mostrar ao rep em um memo. Quando há
    // duplicata, mantemos a ÚLTIMA ocorrência (comportamento típico de planilha).
    const ocorrenciasMap = new Map<string, typeof processed>();
    for (const p of processed) {
      const arr = ocorrenciasMap.get(p.normalizedCode) ?? [];
      arr.push(p);
      ocorrenciasMap.set(p.normalizedCode, arr);
    }
    const duplicatas: DuplicateRow[] = [];
    for (const [normcode, arr] of ocorrenciasMap.entries()) {
      if (arr.length <= 1) continue;
      const mantido = arr[arr.length - 1];
      duplicatas.push({
        codigo_normalizado: normcode,
        total_ocorrencias:  arr.length,
        ocorrencias: arr.map(o => ({ idx: o.idx, codigo: o.codigo, descricao: o.nome })),
        mantido_idx: mantido.idx,
      });
    }

    // Itens marcados como suspensos/inativos no arquivo entram INATIVOS (pro_status=false):
    // somem do catálogo/pedidos/portal/IRIS (todos filtram pro_status IS NOT FALSE), mas ficam
    // rastreáveis e reativáveis. No update, só inativa — nunca ressuscita um inativado na mão.
    const isInativo = (nome: string) =>
      /venda\s*suspensa|suspens[ãa]|\binativ|descontinuad|fora\s*de\s*linha|obsolet|n[ãa]o\s*comercializ/i.test(nome || '');

    const newProdsRaw = processed.filter(p => !existingMap.has(p.normalizedCode));
    const updProds    = processed.filter(p =>  existingMap.has(p.normalizedCode));

    // Dedup intra-lote por normalizedCode. Quando duas linhas do Excel normalizam
    // para o mesmo código (ex: 'ABC-123' e 'ABC123' viram 'ABC123'), o ON CONFLICT
    // DO NOTHING não protege porque o conflito é entre as próprias linhas do INSERT
    // — Postgres aborta toda a transação. Mantemos a ÚLTIMA ocorrência (comportamento
    // típico de planilha onde a linha mais recente sobrescreve a anterior).
    const newProdsMap = new Map<string, typeof newProdsRaw[number]>();
    for (const p of newProdsRaw) newProdsMap.set(p.normalizedCode, p);
    const newProds = Array.from(newProdsMap.values());

    const insertedMap = new Map<string, number>();

    // Verifica se coluna legada existe (nem todos os tenants têm)
    const colCheck = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'cad_tabelaspre' AND column_name = 'itab_industria'
       ) AS has_col`
    );
    const hasItabIndustria: boolean = colCheck.rows[0].has_col;

    await db.transaction(async (client) => {
      // ── Query 3: bulk INSERT novos produtos ─────────────────────────────────
      if (newProds.length > 0) {
        const insRes = await client.query(
          `INSERT INTO cad_prod
             (pro_industria, pro_codprod, pro_codigonormalizado, pro_codigooriginal, pro_nome,
              pro_peso, pro_embalagem, pro_grupo, pro_linha, pro_ncm,
              pro_aplicacao, pro_codbarras, pro_conversao, pro_ciclo,
              pro_linhaleve, pro_linhapesada, pro_linhaagricola, pro_linhautilitarios,
              pro_motocicletas, pro_offroad, pro_linhaamarela, pro_origem, pro_status)
           SELECT
             unnest($1::int[]), unnest($2::text[]), unnest($3::text[]), unnest($4::text[]), unnest($5::text[]),
             unnest($6::float8[]), unnest($7::int[]), unnest($8::int[]), unnest($9::text[]),
             unnest($10::text[]), unnest($11::text[]), unnest($12::text[]), unnest($13::text[]),
             unnest($14::char[]),
             unnest($15::bool[]), unnest($16::bool[]), unnest($17::bool[]), unnest($18::bool[]),
             unnest($19::bool[]), unnest($20::bool[]), unnest($21::bool[]),
             unnest($22::text[]),
             unnest($23::bool[])
           ON CONFLICT DO NOTHING
           RETURNING pro_id, pro_codigonormalizado`,
          [
            newProds.map(() => indId),
            newProds.map(p => p.codigo),
            newProds.map(p => p.normalizedCode),
            newProds.map(p => p.codigooriginal),
            newProds.map(p => p.nome),
            newProds.map(p => p.peso),
            newProds.map(p => p.embalagem),
            newProds.map(p => p.grupoProd),
            newProds.map(p => p.linha),
            newProds.map(p => p.ncm),
            newProds.map(p => p.aplicacao),
            newProds.map(p => p.codbarras),
            newProds.map(p => p.conversao),
            newProds.map(p => p.ciclo),
            newProds.map(p => p.linhaleve ?? false),
            newProds.map(p => p.linhapesada ?? false),
            newProds.map(p => p.linhaagricola ?? false),
            newProds.map(p => p.linhautilitarios ?? false),
            newProds.map(p => p.motocicletas ?? false),
            newProds.map(p => p.offroad ?? false),
            newProds.map(p => p.linhaamarela ?? false),
            newProds.map(p => p.origem),
            newProds.map(p => !isInativo(p.nome)),   // pro_status: false se suspenso/inativo
          ]
        );
        insRes.rows.forEach((r: any) => insertedMap.set(r.pro_codigonormalizado, r.pro_id));
      }

      // ── Query 4: bulk UPDATE produtos existentes ───────────────────────────
      // pro_codigonormalizado é sobrescrito SEMPRE com a versão recalculada
      // (self-healing: cada importação corrige os ~24k produtos com normalizado
      // legado divergente que tocarem).
      if (updProds.length > 0) {
        await client.query(
          `UPDATE cad_prod SET
             pro_codigonormalizado= v.normcode,
             pro_codigooriginal   = COALESCE(NULLIF(v.codigooriginal,''), pro_codigooriginal),
             pro_nome             = COALESCE(NULLIF(v.nome, ''),      pro_nome),
             pro_peso             = COALESCE(v.peso,                  pro_peso),
             pro_embalagem        = COALESCE(v.embalagem,             pro_embalagem),
             pro_grupo            = COALESCE(v.grupo,                 pro_grupo),
             pro_linha            = COALESCE(NULLIF(v.linha,''),      pro_linha),
             pro_ncm              = COALESCE(NULLIF(v.ncm,''),        pro_ncm),
             pro_aplicacao        = COALESCE(NULLIF(v.aplicacao,''),  pro_aplicacao),
             pro_codbarras        = COALESCE(NULLIF(v.codbarras,''),  pro_codbarras),
             pro_conversao        = COALESCE(NULLIF(v.conversao,''),  pro_conversao),
             pro_ciclo            = v.ciclo,
             pro_linhaleve        = COALESCE(v.linhaleve,        pro_linhaleve),
             pro_linhapesada      = COALESCE(v.linhapesada,      pro_linhapesada),
             pro_linhaagricola    = COALESCE(v.linhaagricola,    pro_linhaagricola),
             pro_linhautilitarios = COALESCE(v.linhautilitarios, pro_linhautilitarios),
             pro_motocicletas     = COALESCE(v.motocicletas,     pro_motocicletas),
             pro_offroad          = COALESCE(v.offroad,          pro_offroad),
             pro_linhaamarela     = COALESCE(v.linhaamarela,     pro_linhaamarela),
             pro_origem           = COALESCE(NULLIF(v.origem,''), pro_origem),
             pro_status           = CASE WHEN v.inativo THEN false ELSE pro_status END
           FROM (SELECT
             unnest($1::int[])    AS pro_id,
             unnest($2::text[])   AS normcode,
             unnest($3::text[])   AS codigooriginal,
             unnest($4::text[])   AS nome,
             unnest($5::float8[]) AS peso,
             unnest($6::int[])    AS embalagem,
             unnest($7::int[])    AS grupo,
             unnest($8::text[])   AS linha,
             unnest($9::text[])   AS ncm,
             unnest($10::text[])  AS aplicacao,
             unnest($11::text[])  AS codbarras,
             unnest($12::text[])  AS conversao,
             unnest($13::char[])  AS ciclo,
             unnest($14::bool[])  AS linhaleve,
             unnest($15::bool[])  AS linhapesada,
             unnest($16::bool[])  AS linhaagricola,
             unnest($17::bool[])  AS linhautilitarios,
             unnest($18::bool[])  AS motocicletas,
             unnest($19::bool[])  AS offroad,
             unnest($20::bool[])  AS linhaamarela,
             unnest($21::text[])  AS origem,
             unnest($22::bool[])  AS inativo
           ) AS v
           WHERE cad_prod.pro_id = v.pro_id`,
          [
            updProds.map(p => existingMap.get(p.normalizedCode)!),
            updProds.map(p => p.normalizedCode),
            updProds.map(p => p.codigooriginal),
            updProds.map(p => p.nome),
            updProds.map(p => p.peso),
            updProds.map(p => p.embalagem),
            updProds.map(p => p.grupoProd),
            updProds.map(p => p.linha),
            updProds.map(p => p.ncm),
            updProds.map(p => p.aplicacao),
            updProds.map(p => p.codbarras),
            updProds.map(p => p.conversao),
            updProds.map(p => p.ciclo),
            updProds.map(p => p.linhaleve),
            updProds.map(p => p.linhapesada),
            updProds.map(p => p.linhaagricola),
            updProds.map(p => p.linhautilitarios),
            updProds.map(p => p.motocicletas),
            updProds.map(p => p.offroad),
            updProds.map(p => p.linhaamarela),
            updProds.map(p => p.origem ?? ''),
            updProds.map(p => isInativo(p.nome)),   // inativa se a nova descrição é suspensa
          ]
        );
      }

      // Mapa completo normCode → pro_id
      const allIdMap = new Map<string, number>([...existingMap, ...insertedMap]);
      const prodsWithId = processed
        .map(p => ({ ...p, proId: allIdMap.get(p.normalizedCode) }))
        .filter(p => p.proId != null) as (ProdProcessed & { proId: number })[];

      // Dedup por proId — ON CONFLICT DO UPDATE falha se o mesmo id aparecer 2x no lote
      const seenIds = new Set<number>();
      const dedupedProds = prodsWithId.filter(p => {
        if (seenIds.has(p.proId)) return false;
        seenIds.add(p.proId);
        return true;
      });

      // ── Query 5: bulk UPSERT preços ─────────────────────────────────────────
      if (dedupedProds.length > 0) {
        const params = [
          dedupedProds.map(p => p.proId),
          indId,
          nomeTabela,
          dedupedProds.map(p => p.precobruto),
          dedupedProds.map(p => p.precopromo),
          dedupedProds.map(p => p.precoespecial),
          dedupedProds.map(p => p.ipi),
          dedupedProds.map(p => p.st),
          dedupedProds.map(p => p.grupoDesc),
          dedupedProds.map(p => p.descontoadd),
          today,
          dataVencimento || null,
          dedupedProds.map(p => p.prepeso),
        ];
        const onConflict = `ON CONFLICT (itab_idprod, itab_tabela) DO UPDATE SET
             itab_precobruto    = COALESCE(NULLIF(EXCLUDED.itab_precobruto,    0), cad_tabelaspre.itab_precobruto),
             itab_precopromo    = COALESCE(NULLIF(EXCLUDED.itab_precopromo,    0), cad_tabelaspre.itab_precopromo),
             itab_precoespecial = COALESCE(NULLIF(EXCLUDED.itab_precoespecial, 0), cad_tabelaspre.itab_precoespecial),
             itab_ipi           = COALESCE(NULLIF(EXCLUDED.itab_ipi,           0), cad_tabelaspre.itab_ipi),
             itab_st            = COALESCE(NULLIF(EXCLUDED.itab_st,            0), cad_tabelaspre.itab_st),
             itab_grupodesconto = COALESCE(EXCLUDED.itab_grupodesconto, cad_tabelaspre.itab_grupodesconto),
             itab_descontoadd   = COALESCE(EXCLUDED.itab_descontoadd,   cad_tabelaspre.itab_descontoadd),
             itab_datatabela    = COALESCE(EXCLUDED.itab_datatabela,    cad_tabelaspre.itab_datatabela),
             itab_datavencimento= COALESCE(EXCLUDED.itab_datavencimento,cad_tabelaspre.itab_datavencimento),
             itab_prepeso       = COALESCE(EXCLUDED.itab_prepeso,       cad_tabelaspre.itab_prepeso),
             itab_status        = true`;

        if (hasItabIndustria) {
          await client.query(
            `INSERT INTO cad_tabelaspre
               (itab_idprod, itab_idindustria, itab_industria, itab_tabela,
                itab_precobruto, itab_precopromo, itab_precoespecial,
                itab_ipi, itab_st, itab_grupodesconto, itab_descontoadd,
                itab_datatabela, itab_datavencimento, itab_prepeso, itab_status)
             SELECT
               unnest($1::int[]), $2, $2, $3,
               unnest($4::float8[]), unnest($5::float8[]), unnest($6::float8[]),
               unnest($7::float8[]), unnest($8::float8[]), unnest($9::int[]),
               unnest($10::float8[]), $11, $12,
               unnest($13::float8[]), true
             ${onConflict}`,
            params
          );
        } else {
          await client.query(
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
             ${onConflict}`,
            params
          );
        }
      }
    });

    res.json({
      success: true,
      message: 'Importação concluída.',
      resumo: {
        total: processed.length,
        produtosNovos: insertedMap.size,
        produtosAtualizados: updProds.length,
        erros: 0,
        detalhesErros: [],
        duplicatas,
      },
    });
  } catch (error: any) {
    // Log com todo o contexto útil do erro Postgres pra debug rápido:
    // - schema do tenant (pg só dá "VARCHAR(20)" sem dizer qual coluna)
    // - error.detail / error.column / error.table / error.code
    const schema = (req as any).schema || 'desconhecido';
    const det    = error.detail   ? ` | detail=${error.detail}`       : '';
    const col    = error.column   ? ` | col=${error.column}`          : '';
    const tbl    = error.table    ? ` | table=${error.table}`         : '';
    const code   = error.code     ? ` | code=${error.code}`           : '';
    console.error(`❌ [PRICE-TABLES] import [${schema}]: ${error.message}${det}${col}${tbl}${code}`);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/price-tables/catalog/:industria (Master) ────────────────────
// Apaga TODO o catálogo de uma indústria: produtos (cad_prod) + tabelas de preço
// (cad_tabelaspre). IRREVERSÍVEL — para refazer um import totalmente errado.
// Atômico: se algum FK externo barrar, a transação aborta inteira (não apaga pela metade).
export async function deleteCatalogHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const indId = parseInt(String(req.params.industria), 10);
    if (!indId) { res.status(400).json({ success: false, message: 'Indústria inválida.' }); return; }

    let produtos = 0, precos = 0;
    await db.transaction(async (client: any) => {
      // 1) tabelas de preço primeiro (FK itab_idprod → cad_prod)
      const tp = await client.query(
        `DELETE FROM cad_tabelaspre
          WHERE itab_idprod IN (SELECT pro_id FROM cad_prod WHERE pro_industria = $1)`,
        [indId],
      );
      precos = tp.rowCount || 0;
      // 2) produtos
      const pr = await client.query(`DELETE FROM cad_prod WHERE pro_industria = $1`, [indId]);
      produtos = pr.rowCount || 0;
    });

    res.json({
      success: true,
      message: `Catálogo apagado: ${produtos} produto(s) e ${precos} preço(s).`,
      produtos, precos,
    });
  } catch (error: any) {
    console.error(`❌ [PRICE-TABLES] delete-catalog: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
}
