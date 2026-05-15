import { Request, Response } from 'express';
import { getAllowedIndustries, getLinkedSellerId, buildIndustryFilterClause } from '../../shared/permissions';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pInt(v: any): number | null {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

function getUserId(req: Request): number | undefined {
  return req.user?.userId;
}

// ─── GET /api/dashboard/metrics ──────────────────────────────────────────────
export async function metricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ano, mes, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    if (!ano) {
      res.status(400).json({ success: false, message: 'Parâmetro "ano" é obrigatório' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: { total_vendido_current: 0 } });
      return;
    }

    // Filtro por indústria selecionada OU master → usa stored function
    if (for_codigo || !allowedIndustries) {
      const result = await db.query(
        'SELECT * FROM get_dashboard_metrics_v4($1, $2, $3, $4)',
        [parseInt(String(ano)), mes ? parseInt(String(mes)) : 0, pInt(for_codigo), pInt(cli_codigo)]
      );
      res.json({ success: true, data: result.rows[0] || { total_vendido_current: 0 } });
      return;
    }

    // Preposto sem indústria selecionada → query direta filtrada
    const result = await db.query(`
      SELECT
        COALESCE(ROUND(SUM(i.ite_totliquido), 2), 0)::NUMERIC  AS total_vendido_current,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC        AS quantidade_vendida_current,
        COUNT(DISTINCT p.ped_cliente)::INTEGER         AS clientes_atendidos_current,
        COUNT(DISTINCT p.ped_pedido)::INTEGER          AS total_pedidos_current
      FROM pedidos p
      LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
      WHERE EXTRACT(YEAR FROM p.ped_data) = $1
        AND ($2 = 0 OR EXTRACT(MONTH FROM p.ped_data) = $2)
        AND p.ped_situacao IN ('P', 'F')
        AND p.ped_industria = ANY($3)
    `, [parseInt(String(ano)), mes ? parseInt(String(mes)) : 0, allowedIndustries]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/metrics]', error.message);
    res.status(500).json({ success: false, message: error.message, data: { total_vendido_current: 0 } });
  }
}

// ─── GET /api/dashboard/aura-insights ────────────────────────────────────────
export async function auraInsightsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ano, mes, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    if (!ano) {
      res.status(400).json({ success: false, message: 'Parâmetro "ano" é obrigatório' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: {} });
      return;
    }

    const anoInt = parseInt(String(ano));
    const mesInt = mes && !isNaN(parseInt(String(mes))) ? parseInt(String(mes)) : 0;
    const forInt = pInt(for_codigo);
    const cliInt = pInt(cli_codigo);

    const result = await db.query(
      'SELECT get_aura_dashboard_insights($1, $2, $3, $4) AS insights',
      [anoInt, mesInt, forInt, cliInt]
    );

    res.json({ success: true, data: result.rows[0].insights });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/aura-insights]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/dashboard/industry-revenue ─────────────────────────────────────
export async function industryRevenueHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ano, mes, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    if (!ano) {
      res.status(400).json({ success: false, message: 'Parâmetro "ano" é obrigatório' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);

    let query = 'SELECT * FROM get_industry_revenue($1, $2, $3, $4)';
    const params: any[] = [parseInt(String(ano)), mes ? parseInt(String(mes)) : null, pInt(for_codigo), pInt(cli_codigo)];

    if (allowedIndustries) {
      query = `SELECT * FROM (${query}) AS sub WHERE sub.for_codigo = ANY($5)`;
      params.push(allowedIndustries);
    }

    const result = await db.query(query, params);
    const sorted = result.rows.sort((a: any, b: any) => parseFloat(b.total_faturamento) - parseFloat(a.total_faturamento));

    res.json({ success: true, data: sorted });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/industry-revenue]', error.message);
    res.json({ success: true, data: [] });
  }
}

// ─── GET /api/dashboard/industries-list ──────────────────────────────────────
export async function industriesListHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);

    const sellerId = await getLinkedSellerId(db, userId);
    const params: any[] = [];
    const { filterClause } = buildIndustryFilterClause(sellerId, 'f.for_codigo', params);

    const result = await db.query(`
      SELECT DISTINCT f.for_codigo, f.for_nomered
      FROM fornecedores f
      INNER JOIN pedidos p ON p.ped_industria = f.for_codigo
      WHERE f.for_nomered IS NOT NULL
        ${filterClause}
      ORDER BY f.for_nomered
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/industries-list]', error.message);
    res.json({ success: false, data: [] });
  }
}

// ─── GET /api/dashboard/sales-comparison ─────────────────────────────────────
export async function salesComparisonHandler(req: Request, res: Response): Promise<void> {
  try {
    const { anoAtual, anoAnterior, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: [] });
      return;
    }

    const result = await db.query(
      'SELECT * FROM fn_comparacao_vendas_mensais($1, $2, $3, $4)',
      [anoAtual || 2025, anoAnterior || 2024, pInt(for_codigo), pInt(cli_codigo)]
    );

    res.json({
      success: true,
      data: result.rows.map((row: any) => ({
        mes: row.mes,
        mes_nome: row.mes_nome,
        vendas_ano_atual: Number(row.vendas_ano_atual || 0),
        vendas_ano_anterior: Number(row.vendas_ano_anterior || 0),
      })),
    });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/sales-comparison]', error.message);
    res.json({ success: true, data: [] });
  }
}

// ─── GET /api/dashboard/quantities-comparison ────────────────────────────────
export async function quantitiesComparisonHandler(req: Request, res: Response): Promise<void> {
  try {
    const { anoAtual, anoAnterior, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: [] });
      return;
    }

    const result = await db.query(
      'SELECT * FROM fn_comparacao_quantidades_mensais($1, $2, $3, $4)',
      [anoAtual || 2025, anoAnterior || 2024, pInt(for_codigo), pInt(cli_codigo)]
    );

    res.json({
      success: true,
      data: result.rows.map((row: any) => ({
        mes: row.mes,
        mes_nome: row.mes_nome,
        quantidade_ano_atual: Number(row.quantidade_ano_atual || 0),
        quantidade_ano_anterior: Number(row.quantidade_ano_anterior || 0),
      })),
    });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/quantities-comparison]', error.message);
    res.json({ success: true, data: [] });
  }
}

// ─── GET /api/dashboard/top-clients ──────────────────────────────────────────
export async function topClientsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ano, mes, limit = 10, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    if (!ano) {
      res.status(400).json({ success: false, message: 'Parâmetro "ano" é obrigatório' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: [] });
      return;
    }

    const result = await db.query(
      'SELECT * FROM get_top_clients($1, $2, $3, $4, $5)',
      [parseInt(String(ano)), mes ? parseInt(String(mes)) : 0, parseInt(String(limit)), pInt(for_codigo), pInt(cli_codigo)]
    );

    res.json({
      success: true,
      data: result.rows.map((row: any) => ({
        cliente_codigo: row.cliente_codigo,
        cliente_nome: row.cliente_nome,
        total_vendido: Number(row.total_vendido || 0),
        quantidade_pedidos: Number(row.quantidade_pedidos || 0),
      })),
    });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/top-clients]', error.message);
    res.json({ success: true, data: [] });
  }
}

// ─── GET /api/dashboard/metas-industrias ─────────────────────────────────────
export async function metasIndustriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ano, mes, for_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    if (!ano) {
      res.status(400).json({ success: false, message: 'Parâmetro "ano" é obrigatório' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: { status: [], por_mes: [] } });
      return;
    }

    const anoInt = parseInt(String(ano));
    const today = new Date();
    const mesAte = mes ? parseInt(String(mes)) : (anoInt === today.getFullYear() ? today.getMonth() + 1 : 12);
    const industriaId = pInt(for_codigo);

    let statusQuery = 'SELECT * FROM fn_metas_status_industrias($1, $2, $3)';
    const statusParams: any[] = [anoInt, mesAte, industriaId];

    if (allowedIndustries) {
      statusQuery = `SELECT * FROM (${statusQuery}) AS s WHERE s.for_codigo = ANY($4)`;
      statusParams.push(allowedIndustries);
    }

    let porMesQuery = 'SELECT * FROM fn_metas_por_mes($1, $2)';
    const porMesParams: any[] = [anoInt, industriaId];

    if (allowedIndustries) {
      porMesQuery = `SELECT * FROM (${porMesQuery}) AS p WHERE p.for_codigo = ANY($3)`;
      porMesParams.push(allowedIndustries);
    }

    const [statusResult, porMesResult] = await Promise.all([
      db.query(statusQuery, statusParams),
      db.query(porMesQuery, porMesParams),
    ]);

    res.json({
      success: true,
      data: {
        status: statusResult.rows,
        por_mes: porMesResult.rows,
        mes_ate: mesAte,
        ano: anoInt,
      },
    });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/metas-industrias]', error.message);
    res.status(500).json({ success: false, message: error.message, data: { status: [], por_mes: [] } });
  }
}

// ─── GET /api/dashboard/insight-detail ───────────────────────────────────────
export async function insightDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const { tipo, ano, mes, for_codigo } = req.query;
    const db   = req.db!;
    const anoInt = parseInt(String(ano)) || new Date().getFullYear();
    const mesInt = mes ? parseInt(String(mes)) : 0;
    const forInt = for_codigo ? parseInt(String(for_codigo)) : null;

    switch (tipo) {

      case 'burnout': {
        // Clientes que compraram no mês anterior mas não compraram no mês atual
        const mesRef = mesInt || (new Date().getMonth() + 1);
        const anoRef = anoInt;
        const mesAnt = mesRef === 1 ? 12 : mesRef - 1;
        const anoAnt = mesRef === 1 ? anoRef - 1 : anoRef;

        const p: any[] = [anoAnt, mesAnt, anoRef, mesRef];
        const indFilter = forInt ? (() => { p.push(forInt); return `AND p.ped_industria = $${p.length}`; })() : '';

        const r = await db.query(`
          SELECT c.cli_codigo, COALESCE(c.cli_nomred, c.cli_nome) AS cli_nome,
            MAX(prev.ped_data)::date AS ultimo_pedido,
            (CURRENT_DATE - MAX(prev.ped_data)::date) AS dias_sem_pedido,
            (SELECT f.for_nomered FROM pedidos p2
             INNER JOIN fornecedores f ON f.for_codigo = p2.ped_industria
             WHERE p2.ped_cliente = c.cli_codigo
               AND p2.ped_situacao IN ('P','F')
             ORDER BY p2.ped_data DESC LIMIT 1
            ) AS ultima_industria
          FROM clientes c
          INNER JOIN pedidos prev ON prev.ped_cliente = c.cli_codigo
            AND prev.ped_situacao IN ('P','F')
            AND EXTRACT(YEAR  FROM prev.ped_data) = $1
            AND EXTRACT(MONTH FROM prev.ped_data) = $2
            ${indFilter}
          WHERE c.cli_codigo NOT IN (
            SELECT DISTINCT ped_cliente FROM pedidos
            WHERE ped_situacao IN ('P','F')
              AND EXTRACT(YEAR  FROM ped_data) = $3
              AND EXTRACT(MONTH FROM ped_data) = $4
              ${indFilter}
          )
          GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome
          ORDER BY dias_sem_pedido DESC
          LIMIT 200
        `, p);
        res.json({ success: true, tipo: 'burnout', data: r.rows });
        break;
      }

      case 'concentracao': {
        // Top clientes por faturamento — individual + rede de lojas
        const p: any[] = [anoInt, mesInt];
        if (forInt) p.push(forInt);
        const indFilter = forInt ? `AND p.ped_industria = $${p.length}` : '';

        const baseFrom = `
          FROM clientes c
          INNER JOIN pedidos p ON p.ped_cliente = c.cli_codigo
            AND p.ped_situacao IN ('P','F')
            AND EXTRACT(YEAR  FROM p.ped_data) = $1
            AND ($2 = 0 OR EXTRACT(MONTH FROM p.ped_data) = $2)
            ${indFilter}
          INNER JOIN itens_ped i ON i.ite_pedido = p.ped_pedido`;

        const [indR, redeR] = await Promise.all([
          db.query(`
            SELECT c.cli_codigo, COALESCE(c.cli_nomred, c.cli_nome) AS cli_nome,
              ROUND(SUM(i.ite_totliquido)::numeric, 2) AS total,
              COUNT(DISTINCT p.ped_pedido)::INTEGER AS pedidos,
              ROUND((SUM(i.ite_totliquido) * 100.0 /
                NULLIF(SUM(SUM(i.ite_totliquido)) OVER(), 0))::numeric, 1) AS pct_total
            ${baseFrom}
            GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome
            ORDER BY total DESC
            LIMIT 30
          `, p),
          db.query(`
            SELECT c.cli_redeloja AS grupo_nome,
              ROUND(SUM(i.ite_totliquido)::numeric, 2) AS total,
              COUNT(DISTINCT c.cli_codigo)::INTEGER AS lojas,
              COUNT(DISTINCT p.ped_pedido)::INTEGER AS pedidos,
              ROUND((SUM(i.ite_totliquido) * 100.0 /
                NULLIF(SUM(SUM(i.ite_totliquido)) OVER(), 0))::numeric, 1) AS pct_total
            ${baseFrom}
            WHERE c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''
            GROUP BY c.cli_redeloja
            ORDER BY total DESC
            LIMIT 30
          `, p),
        ]);
        res.json({ success: true, tipo: 'concentracao', data: { individual: indR.rows, rede: redeR.rows } });
        break;
      }

      case 'ativacao': {
        // Todos os clientes com status Ativo/Dormindo/Inativo baseado em último pedido
        const p: any[] = [];
        const indFilter = forInt ? (() => { p.push(forInt); return `AND p.ped_industria = $${p.length}`; })() : '';

        const r = await db.query(`
          SELECT c.cli_codigo, COALESCE(c.cli_nomred, c.cli_nome) AS cli_nome,
            MAX(p.ped_data)::date AS ultimo_pedido,
            (CURRENT_DATE - MAX(p.ped_data)::date) AS dias_sem_pedido,
            CASE
              WHEN (CURRENT_DATE - MAX(p.ped_data)::date) <= 60  THEN 'Ativo'
              WHEN (CURRENT_DATE - MAX(p.ped_data)::date) <= 120 THEN 'Dormindo'
              ELSE 'Inativo'
            END AS status
          FROM clientes c
          INNER JOIN pedidos p ON p.ped_cliente = c.cli_codigo
            AND p.ped_situacao IN ('P','F')
            ${indFilter}
          GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome
          ORDER BY dias_sem_pedido ASC
          LIMIT 500
        `, p);
        res.json({ success: true, tipo: 'ativacao', data: r.rows });
        break;
      }

      case 'crescendo': {
        // Clientes com tendência: compara últimos 90d vs 90d anteriores
        const p: any[] = [];
        const indFilter = forInt ? (() => { p.push(forInt); return `AND p.ped_industria = $${p.length}`; })() : '';

        const r = await db.query(`
          WITH atual AS (
            SELECT p.ped_cliente, ROUND(SUM(i.ite_totliquido)::numeric, 2) AS total
            FROM pedidos p
            INNER JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
            WHERE p.ped_situacao IN ('P','F')
              AND p.ped_data >= CURRENT_DATE - INTERVAL '90 days'
              ${indFilter}
            GROUP BY p.ped_cliente
          ),
          anterior AS (
            SELECT p.ped_cliente, ROUND(SUM(i.ite_totliquido)::numeric, 2) AS total
            FROM pedidos p
            INNER JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
            WHERE p.ped_situacao IN ('P','F')
              AND p.ped_data >= CURRENT_DATE - INTERVAL '180 days'
              AND p.ped_data <  CURRENT_DATE - INTERVAL '90 days'
              ${indFilter}
            GROUP BY p.ped_cliente
          )
          SELECT c.cli_codigo, COALESCE(c.cli_nomred, c.cli_nome) AS cli_nome,
            COALESCE(a.total, 0)::NUMERIC   AS total_atual,
            COALESCE(ant.total, 0)::NUMERIC AS total_anterior,
            CASE
              WHEN COALESCE(ant.total, 0) = 0 THEN NULL
              ELSE ROUND(((COALESCE(a.total,0) - ant.total) * 100.0 / NULLIF(ant.total,0))::numeric, 1)
            END AS delta_pct,
            CASE
              WHEN COALESCE(ant.total, 0) = 0           THEN 'Novo'
              WHEN COALESCE(a.total,0) > ant.total*1.05  THEN 'Crescendo'
              WHEN COALESCE(a.total,0) < ant.total*0.95  THEN 'Em Queda'
              ELSE 'Estável'
            END AS tendencia
          FROM clientes c
          LEFT JOIN atual a     ON a.ped_cliente = c.cli_codigo
          LEFT JOIN anterior ant ON ant.ped_cliente = c.cli_codigo
          WHERE a.ped_cliente IS NOT NULL OR ant.ped_cliente IS NOT NULL
          ORDER BY COALESCE(a.total, 0) DESC
          LIMIT 300
        `, p);
        console.log(`[DASHBOARD/crescendo] rows: ${r.rows.length}, params:`, p);
        res.json({ success: true, tipo: 'crescendo', data: r.rows });
        break;
      }

      case 'gap': {
        // Por indústria: clientes que compram de outras marcas mas não desta
        const p: any[] = [anoInt, mesInt];

        const r = await db.query(`
          WITH compradores_periodo AS (
            SELECT DISTINCT p.ped_industria, p.ped_cliente
            FROM pedidos p
            WHERE p.ped_situacao IN ('P','F')
              AND EXTRACT(YEAR  FROM p.ped_data) = $1
              AND ($2 = 0 OR EXTRACT(MONTH FROM p.ped_data) = $2)
          ),
          base_ativa AS (
            SELECT DISTINCT ped_cliente FROM compradores_periodo
          ),
          gap_por_industria AS (
            SELECT f.for_codigo, f.for_nomered,
              COUNT(DISTINCT CASE WHEN cp.ped_cliente IS NOT NULL THEN ba.ped_cliente END) AS compra,
              COUNT(DISTINCT ba.ped_cliente) AS base_total,
              COUNT(DISTINCT ba.ped_cliente) -
                COUNT(DISTINCT CASE WHEN cp.ped_cliente IS NOT NULL THEN ba.ped_cliente END) AS gap_count
            FROM fornecedores f
            CROSS JOIN base_ativa ba
            LEFT JOIN compradores_periodo cp
              ON cp.ped_industria = f.for_codigo AND cp.ped_cliente = ba.ped_cliente
            WHERE f.for_codigo IN (SELECT DISTINCT ped_industria FROM compradores_periodo)
            GROUP BY f.for_codigo, f.for_nomered
            HAVING COUNT(DISTINCT ba.ped_cliente) -
              COUNT(DISTINCT CASE WHEN cp.ped_cliente IS NOT NULL THEN ba.ped_cliente END) > 0
          )
          SELECT g.for_codigo, g.for_nomered, g.compra, g.base_total, g.gap_count,
            (
              SELECT json_agg(json_build_object('cli_codigo', c.cli_codigo, 'cli_nome', COALESCE(c.cli_nomred, c.cli_nome))
                ORDER BY COALESCE(c.cli_nomred, c.cli_nome))
              FROM base_ativa ba2
              INNER JOIN clientes c ON c.cli_codigo = ba2.ped_cliente
              WHERE NOT EXISTS (
                SELECT 1 FROM compradores_periodo cp2
                WHERE cp2.ped_industria = g.for_codigo AND cp2.ped_cliente = ba2.ped_cliente
              )
              LIMIT 50
            ) AS clientes_sem_compra
          FROM gap_por_industria g
          ORDER BY g.gap_count DESC
          LIMIT 20
        `, p);
        res.json({ success: true, tipo: 'gap', data: r.rows });
        break;
      }

      default:
        res.status(400).json({ success: false, message: 'Tipo inválido. Use: burnout, concentracao, ativacao, crescendo, gap' });
    }
  } catch (error: any) {
    console.error('❌ [DASHBOARD/insight-detail]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/dashboard/sales-performance ────────────────────────────────────
export async function salesPerformanceHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ano, mes, for_codigo, cli_codigo } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    if (!ano) {
      res.status(400).json({ success: false, message: 'Parâmetro "ano" é obrigatório' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);

    if (for_codigo && allowedIndustries && !allowedIndustries.includes(parseInt(String(for_codigo)))) {
      res.json({ success: true, data: [] });
      return;
    }

    let query = 'SELECT * FROM get_sales_performance_v2($1, $2, $3, $4)';
    const params: any[] = [parseInt(String(ano)), mes ? parseInt(String(mes)) : 0, pInt(for_codigo), pInt(cli_codigo)];

    if (allowedIndustries) {
      query = `SELECT * FROM (${query}) AS s WHERE s.for_codigo = ANY($5)`;
      params.push(allowedIndustries);
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/sales-performance]', error.message);
    res.json({ success: true, data: [] });
  }
}

// ─── GET /api/dashboard/mobile-summary ───────────────────────────────────────
export async function mobileSummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const now = new Date();
    const ano = req.query.ano ? parseInt(String(req.query.ano)) : now.getFullYear();
    const mes = req.query.mes ? parseInt(String(req.query.mes)) : now.getMonth() + 1;

    const allowedIndustries = await getAllowedIndustries(db, userId);

    // ── 1. Vendas do mês atual ────────────────────────────────────────────────
    let statsRow: any = { total_sales: 0, total_orders: 0, active_clients: 0, ticket_medio: 0 };
    try {
      let q: string;
      let params: any[];
      if (allowedIndustries?.length) {
        q = `
          SELECT
            COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)  AS total_sales,
            COUNT(DISTINCT p.ped_pedido)::INTEGER                   AS total_orders,
            COUNT(DISTINCT p.ped_cliente)::INTEGER                  AS active_clients,
            CASE WHEN COUNT(DISTINCT p.ped_pedido) > 0
              THEN ROUND((SUM(i.ite_totliquido) / COUNT(DISTINCT p.ped_pedido))::NUMERIC, 2)
              ELSE 0 END                                            AS ticket_medio
          FROM pedidos p
          LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE EXTRACT(YEAR  FROM p.ped_data) = $1
            AND EXTRACT(MONTH FROM p.ped_data) = $2
            AND p.ped_situacao IN ('P', 'F')
            AND p.ped_industria = ANY($3)
        `;
        params = [ano, mes, allowedIndustries];
      } else {
        q = `
          SELECT
            COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)  AS total_sales,
            COUNT(DISTINCT p.ped_pedido)::INTEGER                   AS total_orders,
            COUNT(DISTINCT p.ped_cliente)::INTEGER                  AS active_clients,
            CASE WHEN COUNT(DISTINCT p.ped_pedido) > 0
              THEN ROUND((SUM(i.ite_totliquido) / COUNT(DISTINCT p.ped_pedido))::NUMERIC, 2)
              ELSE 0 END                                            AS ticket_medio
          FROM pedidos p
          LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE EXTRACT(YEAR  FROM p.ped_data) = $1
            AND EXTRACT(MONTH FROM p.ped_data) = $2
            AND p.ped_situacao IN ('P', 'F')
        `;
        params = [ano, mes];
      }
      const r = await db.query(q, params);
      if (r.rows[0]) statsRow = r.rows[0];
    } catch (e: any) {
      console.error('❌ [mobile-summary/stats]', e.message);
    }

    // ── 2. Últimos 5 pedidos ──────────────────────────────────────────────────
    let recentOrders: any[] = [];
    try {
      let q: string;
      let params: any[];
      if (allowedIndustries?.length) {
        q = `
          SELECT p.ped_pedido, p.ped_data::TEXT AS ped_data,
            TRIM(c.cli_nomred) AS cli_nomred, TRIM(f.for_nomered) AS for_nomered, p.ped_totliq
          FROM pedidos p
          INNER JOIN clientes     c ON c.cli_codigo  = p.ped_cliente
          INNER JOIN fornecedores f ON f.for_codigo  = p.ped_industria
          WHERE p.ped_situacao IN ('P', 'F') AND p.ped_industria = ANY($1)
          ORDER BY p.ped_data DESC, p.ped_pedido DESC LIMIT 5
        `;
        params = [allowedIndustries];
      } else {
        q = `
          SELECT p.ped_pedido, p.ped_data::TEXT AS ped_data,
            TRIM(c.cli_nomred) AS cli_nomred, TRIM(f.for_nomered) AS for_nomered, p.ped_totliq
          FROM pedidos p
          INNER JOIN clientes     c ON c.cli_codigo  = p.ped_cliente
          INNER JOIN fornecedores f ON f.for_codigo  = p.ped_industria
          WHERE p.ped_situacao IN ('P', 'F')
          ORDER BY p.ped_data DESC, p.ped_pedido DESC LIMIT 5
        `;
        params = [];
      }
      const r = await db.query(q, params);
      recentOrders = r.rows;
    } catch (e: any) {
      console.error('❌ [mobile-summary/recent]', e.message);
    }

    // ── 3. Churn count ────────────────────────────────────────────────────────
    let churnCount = 0;
    try {
      const r = await db.query(`
        SELECT COUNT(DISTINCT p.ped_cliente)::INTEGER AS churn_count
        FROM pedidos p
        INNER JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE p.ped_situacao IN ('P', 'F', 'A')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '60 days'
        HAVING MAX(p.ped_data)::DATE < CURRENT_DATE - INTERVAL '30 days'
      `);
      churnCount = r.rows[0]?.churn_count ?? 0;
    } catch (e: any) {
      console.error('❌ [mobile-summary/churn]', e.message);
    }

    // ── 4. Meta mensal ────────────────────────────────────────────────────────
    let monthlyGoal = 0;
    try {
      const r = await db.query(
        `SELECT COALESCE(SUM(miv_valor), 0)::NUMERIC AS monthly_goal
         FROM metas_industrias_v WHERE met_ano = $1 AND met_mes = $2`,
        [ano, mes]
      );
      monthlyGoal = parseFloat(r.rows[0]?.monthly_goal ?? '0');
    } catch { /* view pode não existir — ignora */ }

    const totalSales = parseFloat(statsRow.total_sales ?? '0');
    const progress   = monthlyGoal > 0 ? Math.round((totalSales / monthlyGoal) * 1000) / 10 : 0;

    // ── 5. Metas por indústria ────────────────────────────────────────────────
    let industriasMeta: any[] = [];
    try {
      const hasFilter  = allowedIndustries?.length;
      const indWhere   = hasFilter ? `AND f.for_codigo = ANY($3)` : '';
      const qparams    = hasFilter ? [ano, mes, allowedIndustries] : [ano, mes];

      const r = await db.query(`
        WITH vendido AS (
          SELECT p.ped_industria,
                 COALESCE(SUM(i.ite_totliquido), 0) AS vendido
          FROM pedidos p
          LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE EXTRACT(YEAR  FROM p.ped_data) = $1
            AND EXTRACT(MONTH FROM p.ped_data) = $2
            AND p.ped_situacao IN ('P', 'F')
          GROUP BY p.ped_industria
        )
        SELECT
          f.for_codigo,
          TRIM(f.for_nomered) AS for_nomered,
          COALESCE(v.vendido, 0)::NUMERIC AS vendido,
          CASE $2::int
            WHEN 1  THEN COALESCE(m.met_jan, 0)
            WHEN 2  THEN COALESCE(m.met_fev, 0)
            WHEN 3  THEN COALESCE(m.met_mar, 0)
            WHEN 4  THEN COALESCE(m.met_abr, 0)
            WHEN 5  THEN COALESCE(m.met_mai, 0)
            WHEN 6  THEN COALESCE(m.met_jun, 0)
            WHEN 7  THEN COALESCE(m.met_jul, 0)
            WHEN 8  THEN COALESCE(m.met_ago, 0)
            WHEN 9  THEN COALESCE(m.met_set, 0)
            WHEN 10 THEN COALESCE(m.met_out, 0)
            WHEN 11 THEN COALESCE(m.met_nov, 0)
            WHEN 12 THEN COALESCE(m.met_dez, 0)
            ELSE 0
          END::NUMERIC AS meta
        FROM fornecedores f
        LEFT JOIN vendido   v ON v.ped_industria = f.for_codigo
        LEFT JOIN ind_metas m ON m.met_industria  = f.for_codigo AND m.met_ano = $1
        WHERE f.for_tipo2 = 'A'
          AND (v.vendido > 0 OR m.met_industria IS NOT NULL)
          ${indWhere}
        ORDER BY COALESCE(v.vendido, 0) DESC, TRIM(f.for_nomered) ASC
      `, qparams);

      industriasMeta = r.rows.map((row: any) => {
        const vendido = parseFloat(row.vendido);
        const meta    = parseFloat(row.meta);
        const pct     = meta > 0 ? Math.round((vendido / meta) * 1000) / 10 : 0;
        return { for_codigo: Number(row.for_codigo), for_nomered: row.for_nomered, vendido, meta, pct };
      });
    } catch (e: any) {
      console.error('❌ [mobile-summary/industrias-meta]', e.message);
    }

    res.json({
      success: true,
      data: {
        total_sales:     totalSales,
        monthly_goal:    monthlyGoal,
        progress,
        ticket_medio:    parseFloat(statsRow.ticket_medio   ?? '0'),
        total_orders:    statsRow.total_orders    ?? 0,
        active_clients:  statsRow.active_clients  ?? 0,
        churn_count:     churnCount,
        recent_orders:   recentOrders,
        insights:        [],
        industrias_meta: industriasMeta,
      },
    });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/mobile-summary]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/dashboard/mobile-client/:id ────────────────────────────────────
export async function mobileClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const cliId    = parseInt(String(req.params.id));

    if (!cliId) {
      res.status(400).json({ success: false, message: 'ID inválido' });
      return;
    }

    const allowedIndustries = await getAllowedIndustries(db, userId);
    const indFilter = allowedIndustries?.length
      ? `AND p.ped_industria = ANY($2::int[])`
      : '';
    const indParams = allowedIndustries?.length ? [cliId, allowedIndustries] : [cliId];

    // ── Resumo trimestre (90 dias) ─────────────────────────────────────────
    let resumo: any = { total_valor: 0, total_pedidos: 0, total_skus: 0, total_itens: 0 };
    try {
      const r = await db.query(`
        SELECT
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS total_valor,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                  AS total_pedidos,
          COUNT(DISTINCT i.ite_produto)::INTEGER                 AS total_skus,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                AS total_itens
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_cliente = $1
          AND p.ped_situacao IN ('P', 'F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '90 days'
          ${indFilter}
      `, indParams);
      if (r.rows[0]) resumo = r.rows[0];
    } catch (e: any) { console.error('❌ [mobile-client/resumo]', e.message); }

    // ── Últimos pedidos do trimestre ───────────────────────────────────────
    let pedidos: any[] = [];
    try {
      const r = await db.query(`
        SELECT
          p.ped_pedido,
          p.ped_data::TEXT                                        AS ped_data,
          TRIM(f.for_nomered)                                     AS industria,
          p.ped_totliq,
          COUNT(DISTINCT i.ite_produto)::INTEGER                  AS total_skus,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                 AS total_itens
        FROM pedidos p
        INNER JOIN fornecedores f ON f.for_codigo = p.ped_industria
        LEFT JOIN  itens_ped    i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_cliente = $1
          AND p.ped_situacao IN ('P', 'F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '90 days'
          ${indFilter}
        GROUP BY p.ped_pedido, p.ped_data, f.for_nomered, p.ped_totliq
        ORDER BY p.ped_data DESC, p.ped_pedido DESC
        LIMIT 20
      `, indParams);
      pedidos = r.rows;
    } catch (e: any) { console.error('❌ [mobile-client/pedidos]', e.message); }

    // ── Indústrias (12 meses) ──────────────────────────────────────────────
    let industrias: any[] = [];
    try {
      const r = await db.query(`
        SELECT
          TRIM(f.for_nomered)                                         AS industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)      AS total_valor,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                       AS total_pedidos,
          COUNT(DISTINCT i.ite_produto)::INTEGER                      AS total_skus,
          MAX(p.ped_data)::TEXT                                       AS ultimo_pedido
        FROM pedidos p
        INNER JOIN fornecedores f ON f.for_codigo = p.ped_industria
        LEFT JOIN  itens_ped    i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_cliente = $1
          AND p.ped_situacao IN ('P', 'F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '12 months'
          ${indFilter}
        GROUP BY f.for_nomered
        ORDER BY total_valor DESC
      `, indParams);
      industrias = r.rows;
    } catch (e: any) { console.error('❌ [mobile-client/industrias]', e.message); }

    res.json({ success: true, data: { resumo, pedidos, industrias } });
  } catch (error: any) {
    console.error('❌ [DASHBOARD/mobile-client]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── IRIS Portfolio Analysis — helpers ────────────────────────────────────────

interface PortfolioRow {
  nome: string; contribuicao: number; tendencia: number | null;
  clientes: number; total_12m: number; pedidos: number; zona: string;
}

function scoreIndustria(contribuicao: number, tendencia: number | null, clientes: number): number {
  // Contribuição sobre total do tenant: 40 pts
  const sc = contribuicao >= 5 ? 40 : contribuicao >= 2 ? 22 : contribuicao >= 0.5 ? 8 : 0;
  // Tendência 90d vs 90d anteriores: 30 pts
  const st = tendencia == null ? 15
    : tendencia >=  10 ? 30
    : tendencia >=  -5 ? 15
    : tendencia >= -25 ?  5
    : 0;
  // Profundidade de clientes ativos: 30 pts
  const scl = clientes >= 10 ? 30 : clientes >= 5 ? 20 : clientes >= 3 ? 10 : clientes >= 1 ? 4 : 0;
  return sc + st + scl;
}

function gerarNarrativaPortfolio(d: PortfolioRow): string {
  const fmtK = (v: number) =>
    v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} M`
    : v >= 1_000   ? `R$ ${(v / 1_000).toFixed(0)} mil`
    : `R$ ${v.toFixed(0)}`;

  if (d.zona === 'MANTER') {
    const tendStr = d.tendencia == null ? ''
      : d.tendencia >= 10  ? `, crescendo ${d.tendencia}% nos últimos 90 dias`
      : d.tendencia >= -5  ? `, estável`
      : ` (atenção: queda de ${Math.abs(d.tendencia)}%)`;
    return `${d.nome} é uma das âncoras da carteira: ${d.contribuicao.toFixed(1)}% da receita (${fmtK(d.total_12m)} nos últimos 12 meses)${tendStr}, com ${d.clientes} cliente${d.clientes !== 1 ? 's' : ''} ativo${d.clientes !== 1 ? 's' : ''}. Mantenha o foco.`;
  }

  if (d.zona === 'MONITORAR') {
    const tendStr = d.tendencia == null
      ? 'Dados insuficientes para avaliar tendência.'
      : d.tendencia >= 0
        ? `Tendência positiva de ${d.tendencia}% — pode evoluir.`
        : `Queda de ${Math.abs(d.tendencia)}% nos últimos 90 dias — requer atenção.`;
    return `${d.nome} representa ${d.contribuicao.toFixed(1)}% da receita com ${d.clientes} cliente${d.clientes !== 1 ? 's' : ''} ativo${d.clientes !== 1 ? 's' : ''}. ${tendStr} Avalie nos próximos 60 dias antes de tomar uma decisão.`;
  }

  // REVISAR
  const motivos: string[] = [];
  if (d.contribuicao < 2)                           motivos.push(`${d.contribuicao.toFixed(1)}% da receita total`);
  if (d.clientes <= 2)                               motivos.push(`${d.clientes === 0 ? 'nenhum cliente ativo' : d.clientes === 1 ? '1 cliente ativo' : '2 clientes ativos'}`);
  if (d.tendencia != null && d.tendencia < -25)      motivos.push(`queda de ${Math.abs(d.tendencia)}% em 90 dias`);
  if (d.pedidos < 6)                                 motivos.push(`${d.pedidos} pedido${d.pedidos !== 1 ? 's' : ''} no ano`);
  if (d.total_12m === 0)                             motivos.push('sem faturamento nos últimos 12 meses');
  const motivoStr = motivos.length ? motivos.join(', ') : 'desempenho abaixo do esperado';
  return `${d.nome} apresenta baixa viabilidade: ${motivoStr}. Considere renegociar condições ou encerrar esta representação — a energia investida pode render mais em indústrias com maior retorno.`;
}

// ─── GET /api/dashboard/iris-portfolio-analysis ───────────────────────────────
export async function irisPortfolioAnalysisHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = getUserId(req);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const hasFilter = allowedIndustries?.length;
    const indWhere  = hasFilter ? `AND p.ped_industria = ANY($1)` : '';
    const qparams   = hasFilter ? [allowedIndustries] : [];

    const r = await db.query(`
      WITH industria_stats AS (
        SELECT
          p.ped_industria,
          COUNT(DISTINCT p.ped_pedido)::int    AS pedidos_12m,
          COUNT(DISTINCT p.ped_cliente)::int   AS clientes_ativos,
          SUM(i.ite_totliquido)                AS total_12m,
          SUM(CASE WHEN p.ped_data >= CURRENT_DATE - INTERVAL '90 days'
                   THEN i.ite_totliquido ELSE 0 END)  AS ult_90d,
          SUM(CASE WHEN p.ped_data >= CURRENT_DATE - INTERVAL '180 days'
                    AND p.ped_data  <  CURRENT_DATE - INTERVAL '90 days'
                   THEN i.ite_totliquido ELSE 0 END)  AS ant_90d
        FROM pedidos p
        INNER JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P', 'F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '12 months'
          ${indWhere}
        GROUP BY p.ped_industria
      ),
      grand_total AS (SELECT COALESCE(SUM(total_12m), 0) AS total FROM industria_stats)
      SELECT
        f.for_codigo,
        TRIM(f.for_nomered)                                               AS for_nomered,
        ROUND(s.total_12m::NUMERIC, 2)                                    AS total_12m,
        s.pedidos_12m,
        s.clientes_ativos,
        CASE WHEN g.total > 0
             THEN ROUND((s.total_12m / g.total * 100)::NUMERIC, 2)
             ELSE 0 END                                                   AS contribuicao_pct,
        ROUND(s.ult_90d::NUMERIC, 2)                                      AS ult_90d,
        ROUND(s.ant_90d::NUMERIC, 2)                                      AS ant_90d,
        CASE WHEN s.ant_90d > 0
             THEN ROUND(((s.ult_90d - s.ant_90d) / s.ant_90d * 100)::NUMERIC, 1)
             ELSE NULL END                                                AS tendencia_pct
      FROM industria_stats s
      CROSS JOIN grand_total g
      INNER JOIN fornecedores f ON f.for_codigo = s.ped_industria AND f.for_tipo2 = 'A'
      ORDER BY s.total_12m DESC
    `, qparams);

    const resultado = r.rows.map((row: any) => {
      const contribuicao = parseFloat(row.contribuicao_pct);
      const tendencia    = row.tendencia_pct != null ? parseFloat(row.tendencia_pct) : null;
      const clientes     = parseInt(row.clientes_ativos);
      const total_12m    = parseFloat(row.total_12m);
      const pedidos      = parseInt(row.pedidos_12m);
      const score        = scoreIndustria(contribuicao, tendencia, clientes);
      const zona         = score >= 60 ? 'MANTER' : score >= 30 ? 'MONITORAR' : 'REVISAR';
      const narrative    = gerarNarrativaPortfolio({ nome: row.for_nomered, contribuicao, tendencia, clientes, total_12m, pedidos, zona });

      return {
        for_codigo:       Number(row.for_codigo),
        for_nomered:      row.for_nomered,
        total_12m,
        pedidos_12m:      pedidos,
        clientes_ativos:  clientes,
        contribuicao_pct: contribuicao,
        ult_90d:          parseFloat(row.ult_90d),
        ant_90d:          parseFloat(row.ant_90d),
        tendencia_pct:    tendencia,
        score,
        zona,
        narrative,
      };
    });

    res.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('❌ [IRIS/portfolio-analysis]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/dashboard/iris-eventos ─────────────────────────────────────────
// Agrega eventos das últimas 24h para o painel IRIS Terminal.
// Fontes: WhatsApp (mensagens de lead), pedidos IRIS, alertas de churn.
export async function irisEventosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = getUserId(req);
    const sellerId = await getLinkedSellerId(db, userId);

    const eventos: any[] = [];

    // ── 1. WhatsApp — mensagens recentes de leads (últimas 24h) ──────────────
    try {
      const wppRes = await db.query(`
        SELECT
          'wpp_' || m.id            AS id,
          'wpp'                     AS tipo,
          COALESCE(c.nome, c.telefone, 'Desconhecido') AS origem_nome,
          c.telefone                AS origem_fone,
          LEFT(m.conteudo, 120)     AS preview,
          m.created_at              AS ts,
          conv.id                   AS ref_id
        FROM wpp_mensagem m
        JOIN wpp_conversa conv ON conv.id = m.conversa_id
        JOIN wpp_contato   c   ON c.id   = m.contato_id
        WHERE m.remetente = 'lead'
          AND m.created_at > NOW() - INTERVAL '24 hours'
        ORDER BY m.created_at DESC
        LIMIT 20
      `);
      for (const r of wppRes.rows) {
        eventos.push({
          id:       r.id,
          tipo:     'wpp',
          tag:      '[WHATS]',
          mensagem: `Nova mensagem — ${r.origem_nome}: "${r.preview}"`,
          ts:       r.ts,
          payload: {
            titulo:  r.origem_nome,
            detalhe: r.preview,
            fone:    r.origem_fone,
            acao:    'Abrir conversa',
            rota:    'wpp',
            ref_id:  r.ref_id,
          },
        });
      }
    } catch (_) { /* tabela pode não existir em todos os tenants */ }

    // ── 2. IRIS — cotações processadas (últimas 24h) ─────────────────────────
    try {
      const irisRes = await db.query(`
        SELECT
          'iris_' || p.ped_pedido   AS id,
          p.ped_pedido,
          COALESCE(cl.cli_nomred, CAST(p.ped_cliente AS TEXT)) AS cliente_nome,
          p.ped_iris_enviado_em     AS ts,
          p.ped_totliq
        FROM pedidos p
        LEFT JOIN clientes cl ON cl.cli_codigo = p.ped_cliente
        WHERE p.ped_iris_autoriza = true
          AND p.ped_iris_enviado_em > NOW() - INTERVAL '24 hours'
          ${sellerId ? 'AND p.ped_vendedor = $1' : ''}
        ORDER BY p.ped_iris_enviado_em DESC
        LIMIT 10
      `, sellerId ? [sellerId] : []);

      for (const r of irisRes.rows) {
        eventos.push({
          id:       r.id,
          tipo:     'iris',
          tag:      '[IRIS]',
          mensagem: `Cotação ${r.ped_pedido} enviada — ${r.cliente_nome}`,
          ts:       r.ts,
          payload: {
            titulo:  `Pedido ${r.ped_pedido}`,
            detalhe: `${r.cliente_nome} — cotação processada e enviada pela IRIS.`,
            acao:    'Ver pedido',
            rota:    'pedido',
            ref_id:  r.ped_pedido,
          },
        });
      }
    } catch (_) {}

    // ── 3. Portal — rascunhos criados nas últimas 24h (ped_situacao = 'J') ───
    try {
      const portalRes = await db.query(`
        SELECT
          'portal_' || p.ped_pedido AS id,
          p.ped_pedido,
          COALESCE(cl.cli_nomred, CAST(p.ped_cliente AS TEXT)) AS cliente_nome,
          f.for_nomered             AS industria_nome,
          p.ped_data::text          AS ts_raw,
          NOW()                     AS ts
        FROM pedidos p
        LEFT JOIN clientes  cl ON cl.cli_codigo  = p.ped_cliente
        LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE p.ped_situacao = 'J'
          AND p.ped_data >= CURRENT_DATE - 1
          ${sellerId ? 'AND p.ped_vendedor = $1' : ''}
        ORDER BY p.ped_numero DESC
        LIMIT 10
      `, sellerId ? [sellerId] : []);

      for (const r of portalRes.rows) {
        eventos.push({
          id:       r.id,
          tipo:     'portal',
          tag:      '[PORTAL]',
          mensagem: `Nova cotação do lojista — ${r.cliente_nome} (${r.industria_nome ?? 'ind.'})`,
          ts:       r.ts,
          payload: {
            titulo:  r.cliente_nome,
            detalhe: `Cotação ${r.ped_pedido} aguarda sua revisão.`,
            acao:    'Ver rascunho',
            rota:    'pedido',
            ref_id:  r.ped_pedido,
          },
        });
      }
    } catch (_) {}

    // ── 4. Email — leads capturados nas últimas 24h ──────────────────────────
    try {
      const emailRes = await db.query(`
        SELECT
          'email_' || el.id                        AS id,
          COALESCE(NULLIF(el.de_nome,''), el.de)   AS origem_nome,
          el.de                                    AS origem_email,
          el.assunto                               AS preview,
          el.tipo,
          el.resumo_ia,
          el.created_at                            AS ts,
          el.id                                    AS ref_id
        FROM email_lead el
        WHERE el.tipo != 'outro'
          AND el.created_at > NOW() - INTERVAL '24 hours'
          AND el.usuario_id = $1
        ORDER BY el.created_at DESC
        LIMIT 10
      `, [userId]);

      const tipoLabel: Record<string, string> = {
        cotacao:    'Nova cotação por email',
        pedido:     'Pedido por email',
        lead:       'Interesse comercial por email',
        suporte:    'Suporte por email',
        reclamacao: 'Reclamação por email',
      };

      for (const r of emailRes.rows) {
        eventos.push({
          id:       r.id,
          tipo:     'email',
          tag:      '[EMAIL]',
          mensagem: `${tipoLabel[r.tipo] || 'Email'} — ${r.origem_nome}: "${r.preview}"`,
          ts:       r.ts,
          payload: {
            titulo:  r.origem_nome,
            detalhe: r.resumo_ia || r.preview,
            email:   r.origem_email,
            acao:    'Abrir email',
            rota:    'email-central',
            ref_id:  r.ref_id,
          },
        });
      }
    } catch (_) { /* email_lead pode não existir em alguns tenants */ }

    // ── 5. Alertas — clientes sem compra há 45+ dias (top 5) ────────────────
    try {
      const alertaRes = await db.query(`
        SELECT
          'alerta_' || c.cli_codigo AS id,
          c.cli_nomred,
          c.cli_codigo,
          MAX(p.ped_data) AS ultima_compra,
          CURRENT_DATE - MAX(p.ped_data) AS dias
        FROM clientes c
        JOIN pedidos p ON p.ped_cliente = c.cli_codigo
          AND p.ped_situacao IN ('P','F')
        WHERE c.cli_tipopes = 'A'
          AND c.cli_atuacao != 'P'
          ${sellerId ? 'AND c.cli_vendedor = $1' : ''}
        GROUP BY c.cli_codigo, c.cli_nomred
        HAVING CURRENT_DATE - MAX(p.ped_data) BETWEEN 45 AND 120
        ORDER BY dias DESC
        LIMIT 5
      `, sellerId ? [sellerId] : []);

      for (const r of alertaRes.rows) {
        eventos.push({
          id:       r.id,
          tipo:     'alerta',
          tag:      '[ALERTA]',
          mensagem: `${r.cli_nomred} — sem compras há ${r.dias} dias.`,
          ts:       new Date(Date.now() - Math.random() * 3600000).toISOString(),
          payload: {
            titulo:  r.cli_nomred,
            detalhe: `Última compra: ${new Date(r.ultima_compra).toLocaleDateString('pt-BR')}. ${r.dias} dias sem pedido.`,
            acao:    'Ver cliente',
            rota:    'cliente',
            ref_id:  r.cli_codigo,
          },
        });
      }
    } catch (_) {}

    // ── Ordena por ts desc ───────────────────────────────────────────────────
    eventos.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    res.json({ success: true, data: eventos.slice(0, 50) });
  } catch (error: any) {
    console.error('❌ [IRIS/eventos]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
