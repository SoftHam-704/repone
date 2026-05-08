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

    res.json({
      success: true,
      data: {
        total_sales:    totalSales,
        monthly_goal:   monthlyGoal,
        progress,
        ticket_medio:   parseFloat(statsRow.ticket_medio   ?? '0'),
        total_orders:   statsRow.total_orders    ?? 0,
        active_clients: statsRow.active_clients  ?? 0,
        churn_count:    churnCount,
        recent_orders:  recentOrders,
        insights:       [],
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
