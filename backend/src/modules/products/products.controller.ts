import { Request, Response } from 'express';
import { getLinkedSellerId, buildIndustryFilterClause } from '../../shared/permissions';
import { pool } from '../../config/database';

function cleanInd(v: string | number | string[]): number {
  const s = String(Array.isArray(v) ? v[0] : v);
  return parseInt(s.includes(':') ? s.split(':')[0] : s);
}

const safeInt   = (v: any): number | null => { if (v === null || v === undefined || v === '') return null; const n = parseInt(String(v)); return isNaN(n) ? null : n; };
const safeFloat = (v: any): number | null => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };

// ─── GET /api/products/tables/:industria ─────────────────────────────────────
export async function getPriceTablesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const db = req.db!;
    const userId = req.user?.userId;

    const cleanId = cleanInd(industria);
    if (isNaN(cleanId)) { res.json({ success: true, data: [] }); return; }

    const sellerId = await getLinkedSellerId(db, userId);
    if (sellerId !== null) {
      const access = await db.query(
        'SELECT 1 FROM vendedor_ind WHERE vin_codigo = $1 AND vin_industria = $2',
        [sellerId, cleanId]
      );
      if (access.rows.length === 0) { res.json({ success: true, data: [] }); return; }
    }

    const result = await db.query(`SELECT * FROM fn_listar_tabelas_industria($1) ORDER BY 1`, [cleanId]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] tables:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/products/catalog/:industria ────────────────────────────────────
export async function getCatalogHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const db = req.db!;
    const userId = req.user?.userId;

    const cleanId = cleanInd(industria);
    if (isNaN(cleanId)) { res.json({ success: true, data: [] }); return; }

    const sellerId = await getLinkedSellerId(db, userId);
    const { filterClause, params } = buildIndustryFilterClause(sellerId, 'pro_industria', [cleanId]);

    const result = await db.query(`
      SELECT
        pro_id, pro_codprod, pro_nome, pro_ncm, pro_peso,
        pro_embalagem, pro_grupo, pro_aplicacao, pro_codbarras,
        pro_status, pro_linhaleve, pro_linhapesada, pro_linhaagricola,
        pro_linhautilitarios, pro_motocicletas, pro_offroad,
        pro_origem, pro_codigonormalizado, pro_conversao, pro_ciclo
      FROM cad_prod
      WHERE pro_industria = $1 ${filterClause}
      ORDER BY pro_codprod
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] catalog:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/products/detail/:proId?tabela= ─────────────────────────────────
export async function getProductDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const { proId } = req.params;
    const tabela = req.query.tabela ? String(req.query.tabela) : '';
    const db = req.db!;

    const result = await db.query(`
      SELECT
        p.pro_id, p.pro_industria, p.pro_codprod, p.pro_codigooriginal,
        p.pro_codbarras, p.pro_conversao, p.pro_nome, p.pro_ncm,
        p.pro_grupo, p.pro_embalagem, p.pro_peso, p.pro_aplicacao,
        p.pro_linhaleve, p.pro_linhapesada, p.pro_linhaagricola,
        p.pro_linhautilitarios, p.pro_motocicletas, p.pro_offroad,
        p.pro_codigonormalizado, p.pro_setor, p.pro_linha, p.pro_ciclo,
        t.itab_idprod, t.itab_tabela, t.itab_idindustria,
        t.itab_precobruto, t.itab_precopromo, t.itab_precoespecial,
        t.itab_ipi, t.itab_st, t.itab_descontoadd,
        t.itab_grupodesconto, t.itab_prepeso,
        t.itab_datatabela, t.itab_datavencimento, t.itab_status
      FROM cad_prod p
      LEFT JOIN cad_tabelaspre t ON t.itab_idprod = p.pro_id AND t.itab_tabela = $2
      WHERE p.pro_id = $1
    `, [parseInt(String(proId)), String(tabela)]);

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Produto não encontrado.' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] detail:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/products/prices-for-order?industria=&tabela=&cliente= ──────────
// Retorna mapa de preços já com política comercial do cliente (cli_ind) aplicada.
// Prioridade: cli_ind.cli_tabela (tabela exclusiva) > tabela passada + descontos em cascata.
export async function getPricesForOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const db        = req.db!;
    const industria = parseInt(String(req.query.industria || '0'));
    const tabela    = String(req.query.tabela || '').trim();
    const cliente   = parseInt(String(req.query.cliente || '0'));

    if (!industria || !tabela) { res.json({ success: true, data: [] }); return; }

    let effectiveTabela = tabela;
    const descontos: number[] = new Array(11).fill(0);

    if (cliente > 0) {
      const cliRes = await db.query(
        `SELECT cli_tabela,
                cli_desc1, cli_desc2, cli_desc3, cli_desc4, cli_desc5,
                cli_desc6, cli_desc7, cli_desc8, cli_desc9, cli_desc10, cli_desc11
         FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1`,
        [cliente, industria]
      );
      if (cliRes.rows.length > 0) {
        const row = cliRes.rows[0];
        if (row.cli_tabela && String(row.cli_tabela).trim()) {
          effectiveTabela = String(row.cli_tabela).trim();
        }
        for (let i = 1; i <= 11; i++) {
          descontos[i - 1] = parseFloat(row[`cli_desc${i}`] || '0') || 0;
        }
      }
    }

    const result = await db.query(
      `SELECT p.pro_codprod, COALESCE(t.itab_precobruto, 0) AS preco_bruto
       FROM cad_tabelaspre t
       JOIN cad_prod p ON p.pro_id = t.itab_idprod
       WHERE t.itab_idindustria = $1
         AND TRIM(t.itab_tabela) = TRIM($2)
         AND COALESCE(t.itab_precobruto, 0) > 0`,
      [industria, effectiveTabela]
    );

    const descontosAtivos = descontos.filter(d => d > 0);
    const tabelaExclusiva = effectiveTabela !== tabela;

    const data = result.rows.map((row: any) => {
      let preco = parseFloat(row.preco_bruto) || 0;
      for (const d of descontos) {
        if (d > 0) preco = preco * (1 - d / 100);
      }
      return { pro_codprod: String(row.pro_codprod), preco: Math.round(preco * 100) / 100 };
    });

    res.json({
      success: true,
      data,
      meta: {
        tabela_usada:       effectiveTabela,
        tem_politica:       tabelaExclusiva || descontosAtivos.length > 0,
        tabela_exclusiva:   tabelaExclusiva,
        descontos_aplicados: descontosAtivos,
      },
    });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] prices-for-order:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/products/:industria?tabela=&q=&limit=700&offset=0 ──────────────
export async function getProductsWithPricesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria } = req.params;
    const db = req.db!;
    const cleanId = cleanInd(industria);
    const tabela  = req.query.tabela ? String(req.query.tabela) : '';
    const q       = req.query.q      ? `%${String(req.query.q).toLowerCase()}%` : null;
    const limit   = Math.min(parseInt(String(req.query.limit  || '700')) || 700, 5000);
    const offset  = Math.max(parseInt(String(req.query.offset || '0'))   || 0,   0);

    if (!tabela) { res.json({ success: true, data: [], total: 0 }); return; }

    const params: any[] = [cleanId, tabela];
    let searchClause = '';
    if (q) {
      params.push(q);
      searchClause = ` AND (LOWER(p.pro_codprod) LIKE $${params.length}
              OR LOWER(p.pro_nome)   LIKE $${params.length}
              OR LOWER(COALESCE(p.pro_codigonormalizado,'')) LIKE $${params.length})`;
    }
    params.push(limit, offset);
    const pLimit  = params.length - 1;
    const pOffset = params.length;

    const result = await db.query(`
      SELECT
        t.itab_idprod,
        p.pro_id,
        p.pro_codprod,
        p.pro_nome,
        p.pro_grupo,
        p.pro_embalagem,
        p.pro_peso,
        p.pro_codigonormalizado,
        p.pro_conversao,
        p.pro_ciclo,
        t.itab_precobruto,
        t.itab_precopromo,
        t.itab_precoespecial,
        t.itab_ipi,
        t.itab_st,
        t.itab_descontoadd,
        t.itab_grupodesconto,
        t.itab_prepeso,
        t.itab_tabela,
        t.itab_datatabela,
        t.itab_status,
        COUNT(*) OVER() AS total_count
      FROM cad_tabelaspre t
      INNER JOIN cad_prod p ON p.pro_id = t.itab_idprod
      WHERE t.itab_idindustria = $1
        AND t.itab_tabela = $2
        ${searchClause}
      ORDER BY p.pro_nome
      LIMIT $${pLimit} OFFSET $${pOffset}
    `, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) || 0 : 0;
    res.json({ success: true, data: result.rows, total });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] with-prices:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/products/save ──────────────────────────────────────────────────
export async function saveProductHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    const {
      codigo, codigoOriginal, codigoBarras, conversao,
      descricao, aplicacao, ncm, grupo, embalagem, peso,
      industria, tabela, precobruto, precopromo, precoespecial,
      ipi, st, descontoadd, grupodesconto, prepeso,
      linhaleve, linhapesada, linhaagricola, linhautilitarios,
      motocicletas, offroad, linhaamarela, ciclo, replicate,
    } = req.body;

    const cleanId = cleanInd(industria);
    const today = new Date().toISOString().split('T')[0];

    await client.query(`SET search_path TO ${schema}, public`);
    await client.query('BEGIN');

    const prodResult = await client.query(
      `SELECT fn_upsert_produto($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) as pro_id`,
      [
        cleanId,
        codigo || '',
        descricao || '',
        safeFloat(peso),
        safeInt(embalagem),
        safeInt(grupo),
        null,          // setor
        null,          // linha
        ncm || '',
        null,          // origem
        aplicacao || '',
        codigoBarras || '',
        conversao || '',
        linhaleve        || false,
        linhapesada      || false,
        linhaagricola    || false,
        linhautilitarios || false,
        motocicletas     || false,
        offroad          || false,
        linhaamarela     || false,
        ciclo            || 'C',
      ]
    );

    const proId = prodResult.rows[0].pro_id;

    if (codigoOriginal !== undefined) {
      await client.query(
        `UPDATE cad_prod SET pro_codigooriginal = $1 WHERE pro_id = $2`,
        [codigoOriginal || '', proId]
      );
    }

    if (tabela) {
      const tables: string[] = [];
      if (replicate) {
        const tablesRes = await client.query(
          `SELECT DISTINCT itab_tabela FROM cad_tabelaspre WHERE itab_idindustria = $1`,
          [cleanId]
        );
        tables.push(...tablesRes.rows.map((r: any) => r.itab_tabela));
        if (!tables.includes(tabela)) tables.push(tabela);
      } else {
        tables.push(tabela);
      }

      for (const t of tables) {
        await client.query(
          `SELECT fn_upsert_preco($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            proId, cleanId, t,
            safeFloat(precobruto) ?? 0,
            safeFloat(precopromo),
            safeFloat(precoespecial),
            safeFloat(ipi) ?? 0,
            safeFloat(st) ?? 0,
            safeInt(grupodesconto),
            safeFloat(descontoadd) ?? 0,
            today,
            null,
            safeFloat(prepeso) ?? 0,
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: replicate ? 'Produto salvo e replicado.' : 'Produto salvo.', pro_id: proId });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [PRODUCTS] save:', error.message);
    res.status(500).json({ success: false, message: error.message, detail: error.detail || null });
  } finally {
    client.release();
  }
}

// ─── DELETE /api/products/:proId ──────────────────────────────────────────────
export async function deleteProductHandler(req: Request, res: Response): Promise<void> {
  try {
    const { proId } = req.params;
    const db = req.db!;
    await db.query('DELETE FROM cad_prod WHERE pro_id = $1', [parseInt(String(proId))]);
    res.json({ success: true, message: 'Produto excluído com sucesso.' });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ success: false, message: 'Produto em uso — não pode ser excluído.' });
      return;
    }
    console.error('❌ [PRODUCTS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
// ─── GET /api/products/:proId/purchase-history ──────────────────────────────
export async function getProductPurchaseHistoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { proId } = req.params;
    const db = req.db!;

    const result = await db.query(`
      SELECT
        c.cli_nomred AS cliente_nome,
        MAX(p.ped_data) AS ultima_compra
      FROM itens_ped i
      JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      JOIN clientes c ON c.cli_codigo = p.ped_cliente
      WHERE i.ite_idproduto = $1
        AND p.ped_situacao IN ('P', 'F')
      GROUP BY c.cli_nomred
      ORDER BY ultima_compra DESC
    `, [parseInt(String(proId))]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] purchase-history:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
// ─── GET /api/products/:proId/sales-summary ──────────────────────────────────
export async function getProductSalesSummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { proId } = req.params;
    const db = req.db!;

    const result = await db.query(`
      SELECT
        TO_CHAR(p.ped_data, 'MM/YYYY') AS periodo,
        SUM(i.ite_quant) AS total_qtd
      FROM itens_ped i
      JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      WHERE i.ite_idproduto = $1
        AND p.ped_situacao IN ('P', 'F')
      GROUP BY periodo, DATE_TRUNC('month', p.ped_data)
      ORDER BY DATE_TRUNC('month', p.ped_data) ASC
    `, [parseInt(String(proId))]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PRODUCTS] sales-summary:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
