import { Request, Response } from 'express';
import { getAllowedIndustries } from '../../shared/permissions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAnos(raw: string | undefined): number[] {
  if (!raw) return [new Date().getFullYear()];
  const parsed = raw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000 && n < 2100);
  return parsed.length ? parsed : [new Date().getFullYear()];
}

function parseMeses(raw: string | undefined): number[] | null {
  if (!raw) return null;
  const parsed = raw.split(',').map(Number).filter(n => n >= 1 && n <= 12);
  return parsed.length ? parsed : null;
}

function getUserId(req: Request): number | undefined {
  return req.user?.userId;
}

/** Cláusula WHERE base para filtros BI */
function buildWhere(
  anos: number[],
  meses: number[] | null,
  forInt: number | null,
  cliInt: number | null,
  allowedIndustries: number[] | null,
  dateField = 'p.ped_data',
  industryField = 'p.ped_industria',
  clientField = 'p.ped_cliente',
) {
  // O correto é apenas P e F. Upper + Trim para maior robustez.
  const clauses: string[] = [`UPPER(TRIM(p.ped_situacao)) IN ('P', 'F')` ];
  const params: any[] = [];

  if (anos?.length) {
    const yearList = anos.map(Number).join(',');
    clauses.push(`EXTRACT(YEAR FROM ${dateField}) IN (${yearList})`);
  }

  if (meses?.length) {
    const monthList = meses.map(Number).join(',');
    clauses.push(`EXTRACT(MONTH FROM ${dateField}) IN (${monthList})`);
  }

  if (forInt) {
    params.push(forInt);
    clauses.push(`${industryField} = $${params.length}`);
  }
  if (allowedIndustries?.length) {
    params.push(allowedIndustries);
    clauses.push(`${industryField} = ANY($${params.length}::int[])`);
  }
  if (cliInt) {
    params.push(cliInt);
    clauses.push(`${clientField} = $${params.length}`);
  }

  return { where: clauses.join(' AND '), params };
}

// ─── GET /api/bi/overview ─────────────────────────────────────────────────────
export async function overviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    // Primário = primeiro ano do array (mais recente)
    const anoA = Math.max(...anos);
    const anoB = anos.length === 2 ? Math.min(...anos) : anoA - 1;

    const { where, params } = buildWhere([anoA], meses, forInt, cliInt, allowedIndustries);
    const { where: whereB, params: paramsB } = buildWhere([anoB], meses, forInt, cliInt, allowedIndustries);

    const [rA, rB] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC      AS total_vendido,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC            AS quantidade,
          COUNT(DISTINCT p.ped_cliente)::INTEGER             AS clientes_ativos,
          COUNT(DISTINCT p.ped_pedido)::INTEGER              AS pedidos,
          CASE WHEN COUNT(DISTINCT p.ped_pedido) > 0
            THEN ROUND((SUM(i.ite_totliquido) / COUNT(DISTINCT p.ped_pedido))::NUMERIC, 2)
            ELSE 0 END::NUMERIC                             AS ticket_medio
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE ${where}
      `, params),
      db.query(`
        SELECT
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total_vendido,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC       AS quantidade,
          COUNT(DISTINCT p.ped_cliente)::INTEGER        AS clientes_ativos,
          COUNT(DISTINCT p.ped_pedido)::INTEGER         AS pedidos,
          CASE WHEN COUNT(DISTINCT p.ped_pedido) > 0
            THEN ROUND((SUM(i.ite_totliquido) / COUNT(DISTINCT p.ped_pedido))::NUMERIC, 2)
            ELSE 0 END::NUMERIC                        AS ticket_medio
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE ${whereB}
      `, paramsB),
    ]);

    const a = rA.rows[0];
    const b = rB.rows[0];

    const delta = (k: string) => {
      const va = parseFloat(a[k] || 0);
      const vb = parseFloat(b[k] || 0);
      if (!vb) return null;
      const d = (va - vb) / vb * 100;
      // Oculta delta quando a base é irrelevante (< 5% do valor atual)
      // ou quando o delta é implausível (> 999%)
      if (Math.abs(d) > 999) return null;
      return parseFloat(d.toFixed(1));
    };

    // Total de clientes ativos na carteira (cli_tipopes = 'A')
    // Considera filtros de indústria e permissões do vendedor
    const carteiraClauses: string[] = [`UPPER(TRIM(c.cli_tipopes)) = 'A'`];
    const carteiraParams: any[] = [];

    if (forInt) {
      // Se indústria selecionada, conta apenas clientes que já compraram dessa indústria
      carteiraParams.push(forInt);
      carteiraClauses.push(`EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.ped_cliente = c.cli_codigo AND p2.ped_industria = $${carteiraParams.length})`);
    }
    if (allowedIndustries?.length) {
      carteiraParams.push(allowedIndustries);
      carteiraClauses.push(`EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.ped_cliente = c.cli_codigo AND p2.ped_industria = ANY($${carteiraParams.length}::int[]))`);
    }
    if (cliInt) {
      carteiraParams.push(cliInt);
      carteiraClauses.push(`c.cli_codigo = $${carteiraParams.length}`);
    }

    const rCarteira = await db.query(`
      SELECT COUNT(*)::INTEGER AS total_ativos
      FROM clientes c
      WHERE ${carteiraClauses.join(' AND ')}
    `, carteiraParams);
    const totalAtivos = parseInt(rCarteira.rows[0]?.total_ativos || 0);
    const positivacaoPct = totalAtivos > 0
      ? parseFloat(((parseInt(a.clientes_ativos) / totalAtivos) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        total_vendido:   parseFloat(a.total_vendido),
        quantidade:      parseFloat(a.quantidade),
        clientes_ativos: parseInt(a.clientes_ativos),
        total_carteira:  totalAtivos,
        positivacao_pct: positivacaoPct,
        pedidos:         parseInt(a.pedidos),
        ticket_medio:    parseFloat(a.ticket_medio),
        delta_vendido:   delta('total_vendido'),
        delta_quantidade: delta('quantidade'),
        delta_clientes:  delta('clientes_ativos'),
        delta_ticket:    delta('ticket_medio'),
        ano_ref:         anoA,
        ano_comp:        anoB,
      },
    });
  } catch (error: any) {
    console.error('❌ [BI/overview]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/monthly ──────────────────────────────────────────────────────
// Série mensal — suporta 2 anos para modo YoY
export async function monthlyHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const indFilter = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const cliFilter = cliInt ? `AND p.ped_cliente = ${cliInt}` : '';
    const allowedFilter = allowedIndustries ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])` : '';

    const rows: any[] = [];
    for (const ano of anos) {
      const r = await db.query(`
        SELECT
          EXTRACT(MONTH FROM p.ped_data)::INTEGER AS mes,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                          AS quantidade,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER                     AS skus,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                            AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${indFilter}
          ${cliFilter}
          ${allowedFilter}
        GROUP BY mes
        ORDER BY mes
      `, [ano]);
      rows.push({ ano, series: r.rows });
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('❌ [BI/monthly]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── Helper: monta filtros inline para market-share / ranking ────────────────
function buildInlineFilters(
  meses: number[] | null,
  forInt: number | null,
  cliInt: number | null,
  allowedIndustries: number[] | null,
) {
  const parts: string[] = [];
  if (meses?.length) parts.push(`AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])`);
  if (forInt)        parts.push(`AND p.ped_industria = ${forInt}`);
  if (cliInt)        parts.push(`AND p.ped_cliente = ${cliInt}`);
  if (allowedIndustries?.length) parts.push(`AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`);
  return parts.join('\n');
}

// ─── GET /api/bi/market-share ─────────────────────────────────────────────────
export async function marketShareHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade' : metrica === 'skus' ? 'skus' : 'total';
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, null, allowedIndustries);

    const r = await db.query(`
      WITH agg AS (
        SELECT
          p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC        AS total,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC              AS quantidade,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER         AS skus,
          COUNT(DISTINCT p.ped_cliente)::INTEGER               AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${extraFilters}
        GROUP BY p.ped_industria
      ),
      portfolio AS (
        SELECT 
          pro_industria, 
          COUNT(*)::INTEGER AS total_portfolio 
        FROM cad_prod 
        GROUP BY pro_industria
      ),
      grand AS (
        SELECT
          NULLIF(SUM(total), 0)      AS grand_total,
          NULLIF(SUM(quantidade), 0) AS grand_qtd,
          NULLIF(SUM(skus), 0)       AS grand_skus
        FROM agg
      )
      SELECT
        f.for_codigo, f.for_nomered AS nome,
        a.total, a.quantidade, a.skus, a.clientes, a.pedidos,
        COALESCE(port.total_portfolio, 0) AS total_portfolio,
        ROUND(a.skus * 100.0 / NULLIF(port.total_portfolio, 0), 1)::NUMERIC AS pct_cobertura,
        ROUND(a.total      * 100.0 / NULLIF(g.grand_total, 0), 1)::NUMERIC AS pct_total,
        ROUND(a.quantidade * 100.0 / NULLIF(g.grand_qtd,   0), 1)::NUMERIC AS pct_qtd,
        ROUND(a.skus       * 100.0 / NULLIF(g.grand_skus,  0), 1)::NUMERIC AS pct_skus
      FROM agg a
      INNER JOIN fornecedores f ON f.for_codigo = a.ped_industria
      LEFT JOIN portfolio port  ON port.pro_industria = f.for_codigo
      CROSS JOIN grand g
      WHERE f.for_nomered IS NOT NULL
      ORDER BY a.${orderCol} DESC
      LIMIT 15
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/market-share]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/ranking-produtos ───────────────────────────────────────────
export async function rankingProdutosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' || metrica === 'skus' ? 'quantidade' : 'total';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      SELECT
        i.ite_produto                                                      AS produto,
        MAX(cp.pro_nome)                                                   AS nome,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC    AS total,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC                            AS quantidade,
        COUNT(DISTINCT p.ped_pedido)::INTEGER                              AS pedidos
      FROM itens_ped i
      JOIN pedidos p ON p.ped_pedido = i.ite_pedido
      LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                            AND cp.pro_industria = i.ite_industria
      WHERE ${where}
      GROUP BY i.ite_produto
      ORDER BY ${orderCol} DESC
      LIMIT 10
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/ranking-produtos]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/ranking-industrias ──────────────────────────────────────────
export async function rankingIndustriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, null, allowedIndustries);

    const r = await db.query(`
      WITH agg AS (
        SELECT
          p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER        AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER         AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${extraFilters}
        GROUP BY p.ped_industria
      ),
      grand AS (SELECT NULLIF(SUM(total), 0) AS grand_total FROM agg)
      SELECT
        f.for_codigo, f.for_nomered AS nome,
        a.total, a.clientes, a.pedidos,
        ROUND(a.total * 100.0 / g.grand_total, 1)::NUMERIC AS pct_total
      FROM agg a
      INNER JOIN fornecedores f ON f.for_codigo = a.ped_industria
      CROSS JOIN grand g
      WHERE f.for_nomered IS NOT NULL
      ORDER BY a.total DESC
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/ranking-industrias]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/sellers-performance ─────────────────────────────────────────
// Ranking de performance: faturamento, MoM, novos clientes, reativados, SKUs novos
export async function sellersPerformanceHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoAtual = Math.max(...anos);
    const anoAnt   = anoAtual - 1;

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';

    const r = await db.query(`
      WITH
      atual AS (
        SELECT p.ped_vendedor,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                 AS clientes
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter}
        GROUP BY p.ped_vendedor
      ),
      ant AS (
        SELECT p.ped_vendedor,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                 AS clientes
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $2
          ${mesesFilter} ${forFilter} ${allowFilter}
        GROUP BY p.ped_vendedor
      ),
      novos AS (
        SELECT DISTINCT p.ped_vendedor, p.ped_cliente
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter}
          AND NOT EXISTS (
            SELECT 1 FROM pedidos p2
            WHERE p2.ped_cliente = p.ped_cliente
              AND p2.ped_situacao IN ('P','F','A')
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          )
      ),
      novos_agg AS (
        SELECT ped_vendedor, COUNT(*)::INTEGER AS cnt FROM novos GROUP BY ped_vendedor
      ),
      reativos AS (
        SELECT DISTINCT p.ped_vendedor, p.ped_cliente
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter}
          AND EXISTS (
            SELECT 1 FROM pedidos p2
            WHERE p2.ped_cliente = p.ped_cliente
              AND p2.ped_situacao IN ('P','F','A')
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          )
          AND (
            SELECT (DATE_TRUNC('year', MAKE_DATE($1, 1, 1)) - MAX(p2.ped_data)::DATE)
            FROM pedidos p2
            WHERE p2.ped_cliente = p.ped_cliente
              AND p2.ped_situacao IN ('P','F','A')
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          ) >= 60
          AND p.ped_cliente NOT IN (SELECT ped_cliente FROM novos)
      ),
      reativos_agg AS (
        SELECT ped_vendedor, COUNT(*)::INTEGER AS cnt FROM reativos GROUP BY ped_vendedor
      ),
      skus_novos AS (
        SELECT p.ped_vendedor,
          COUNT(DISTINCT i.ite_produto)::INTEGER                 AS cnt,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS valor
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter}
          AND NOT EXISTS (
            SELECT 1 FROM pedidos p2
            JOIN itens_ped i2 ON i2.ite_pedido = p2.ped_pedido
            WHERE p2.ped_vendedor = p.ped_vendedor
              AND p2.ped_situacao IN ('P','F','A')
              AND i2.ite_produto = i.ite_produto
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          )
        GROUP BY p.ped_vendedor
      )
      SELECT
        v.ven_codigo,
        TRIM(v.ven_nome)                                                    AS ven_nome,
        COALESCE(a.total,  0)::NUMERIC                                      AS total_value_current,
        COALESCE(b.total,  0)::NUMERIC                                      AS total_value_previous,
        CASE WHEN COALESCE(b.total, 0) > 0
          THEN ROUND((COALESCE(a.total, 0) - b.total) / b.total * 100, 1)
          ELSE NULL END::NUMERIC                                             AS mom_value_percent,
        COALESCE(b.clientes, 0)::INTEGER                                    AS clients_previous,
        COALESCE(n.cnt,    0)::INTEGER                                      AS new_clients,
        COALESCE(r.cnt,    0)::INTEGER                                      AS reactivated_clients,
        COALESCE(sk.cnt,   0)::INTEGER                                      AS new_skus_count,
        COALESCE(sk.valor, 0)::NUMERIC                                      AS new_skus_value
      FROM vendedores v
      LEFT JOIN atual        a  ON a.ped_vendedor  = v.ven_codigo
      LEFT JOIN ant          b  ON b.ped_vendedor  = v.ven_codigo
      LEFT JOIN novos_agg    n  ON n.ped_vendedor  = v.ven_codigo
      LEFT JOIN reativos_agg r  ON r.ped_vendedor  = v.ven_codigo
      LEFT JOIN skus_novos   sk ON sk.ped_vendedor = v.ven_codigo
      WHERE v.ven_status = 'A'
        AND (COALESCE(a.total, 0) > 0 OR COALESCE(b.total, 0) > 0)
      ORDER BY COALESCE(a.total, 0) DESC
    `, [anoAtual, anoAnt]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/sellers-performance]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/abc-clientes ─────────────────────────────────────────────────
// Curva ABC dos clientes (Pareto) — para o painel de ABC
export async function abcClientesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const agruparRede = req.query.agrupar_rede === 'true';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter = meses ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}])` : '';
    const indFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const cliFilter   = cliInt ? `AND p.ped_cliente = ${cliInt}` : '';
    const allowFilter = allowedIndustries ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])` : '';

    const groupField = agruparRede ? "COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nome)" : "c.cli_nome";
    const groupId    = agruparRede ? "MIN(c.cli_codigo)" : "c.cli_codigo";

    const r = await db.query(`
      WITH ranked AS (
        SELECT
          ${groupId} AS cli_codigo, 
          ${groupField} AS nome,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COUNT(DISTINCT p.ped_pedido)::INTEGER         AS pedidos,
          ROW_NUMBER() OVER (ORDER BY SUM(i.ite_totliquido) DESC) AS rank
        FROM clientes c
        INNER JOIN pedidos p ON p.ped_cliente = c.cli_codigo
          AND p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${indFilter}
          ${cliFilter}
          ${allowFilter}
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        GROUP BY ${agruparRede ? "nome" : "c.cli_codigo, c.cli_nome"}
      ),
      totals AS (SELECT SUM(total) AS grand_total FROM ranked)
      SELECT
        r.*,
        ROUND(r.total * 100.0 / NULLIF(t.grand_total, 0), 2)                           AS pct,
        ROUND(SUM(r.total) OVER (ORDER BY r.rank ROWS UNBOUNDED PRECEDING) * 100.0
          / NULLIF(t.grand_total, 0), 1)                                                 AS pct_acum,
        CASE
          WHEN SUM(r.total) OVER (ORDER BY r.rank ROWS UNBOUNDED PRECEDING) <= t.grand_total * 0.80 THEN 'A'
          WHEN SUM(r.total) OVER (ORDER BY r.rank ROWS UNBOUNDED PRECEDING) <= t.grand_total * 0.95 THEN 'B'
          ELSE 'C'
        END AS classe
      FROM ranked r, totals t
      ORDER BY r.rank
      LIMIT 100
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/abc-clientes]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/metas-industrias ────────────────────────────────────────────
// Desempenho por indústria: ano atual vs ano anterior (baseline como "meta")
// Retorna: for_codigo, nome, total_atual, total_meta, pct_meta, delta
export async function metasIndustriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoAtual = Math.max(...anos);
    const anoMeta  = anoAtual - 1; // baseline = ano anterior

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter  = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';

    const r = await db.query(`
      WITH atual AS (
        SELECT p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER        AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER          AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter}
          ${allowFilter}
        GROUP BY p.ped_industria
      ),
      meta AS (
        SELECT p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $2
          ${mesesFilter}
          ${allowFilter}
        GROUP BY p.ped_industria
      )
      SELECT
        f.for_codigo,
        f.for_nomered                                                              AS nome,
        COALESCE(a.total, 0)                                                       AS total_atual,
        COALESCE(m.total, 0)                                                       AS total_meta,
        COALESCE(a.clientes, 0)                                                    AS clientes,
        COALESCE(a.pedidos, 0)                                                     AS pedidos,
        CASE WHEN COALESCE(m.total, 0) > 0
          THEN ROUND(COALESCE(a.total, 0) / m.total * 100, 1)
          ELSE NULL END                                                            AS pct_meta,
        CASE WHEN COALESCE(m.total, 0) > 0
          THEN ROUND((COALESCE(a.total, 0) - m.total) / m.total * 100, 1)
          ELSE NULL END                                                            AS delta_pct
      FROM (SELECT DISTINCT ped_industria FROM atual UNION SELECT DISTINCT ped_industria FROM meta) src
      INNER JOIN fornecedores f ON f.for_codigo = src.ped_industria
      LEFT JOIN atual a ON a.ped_industria = src.ped_industria
      LEFT JOIN meta  m ON m.ped_industria = src.ped_industria
      WHERE f.for_nomered IS NOT NULL
        AND COALESCE(a.total, 0) > 0
      ORDER BY a.total DESC NULLS LAST
      LIMIT 15
    `, [anoAtual, anoMeta]);

    res.json({
      success: true,
      data: r.rows,
      meta: { ano_atual: anoAtual, ano_meta: anoMeta },
    });
  } catch (error: any) {
    console.error('❌ [BI/metas-industrias]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/positivacao ──────────────────────────────────────────────────
// Índice de Positivação por Indústria:
// (clientes que compraram a indústria X / total de clientes ativos no período) * 100
export async function positivacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter  = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter  = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';

    const r = await db.query(`
      WITH periodo AS (
        SELECT COUNT(DISTINCT p.ped_cliente)::INTEGER AS total_clientes
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${allowFilter}
      ),
      por_ind AS (
        SELECT
          p.ped_industria,
          COUNT(DISTINCT p.ped_cliente)::INTEGER               AS clientes,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC          AS total,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                 AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${allowFilter}
        GROUP BY p.ped_industria
      )
      SELECT
        f.for_codigo,
        f.for_nomered                                                          AS nome,
        pi.clientes,
        pe.total_clientes,
        ROUND(pi.clientes::numeric / NULLIF(pe.total_clientes, 0) * 100, 1)   AS positivacao_pct,
        pi.total,
        pi.pedidos
      FROM por_ind pi
      CROSS JOIN periodo pe
      INNER JOIN fornecedores f ON f.for_codigo = pi.ped_industria
      WHERE f.for_nomered IS NOT NULL
      ORDER BY pi.clientes DESC
      LIMIT 15
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/positivacao]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/ticket-medio-industrias ─────────────────────────────────────
// Ticket médio por indústria + volume de pedidos (para bubble chart)
export async function ticketMedioIndustriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';

    const r = await db.query(`
      SELECT
        f.for_codigo,
        f.for_nomered                                                               AS nome,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC                                AS total,
        COUNT(DISTINCT p.ped_pedido)::INTEGER                                       AS pedidos,
        COUNT(DISTINCT p.ped_cliente)::INTEGER                                      AS clientes,
        CASE WHEN COUNT(DISTINCT p.ped_pedido) > 0
          THEN ROUND((SUM(i.ite_totliquido) / COUNT(DISTINCT p.ped_pedido))::NUMERIC, 2)
          ELSE 0 END::NUMERIC                                                       AS ticket_medio
      FROM pedidos p
      LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
      INNER JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE p.ped_situacao IN ('P','F','A')
        AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
        ${mesesFilter}
        ${allowFilter}
        AND f.for_nomered IS NOT NULL
      GROUP BY f.for_codigo, f.for_nomered
      HAVING ROUND(SUM(COALESCE(i.ite_totliquido, 0))::NUMERIC, 2) > 0
      ORDER BY total DESC
      LIMIT 15
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/ticket-medio-industrias]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/churn-alert ──────────────────────────────────────────────────
// Clientes com risco de churn: compraram nos últimos 60 dias mas há >30 dias sem pedido
// Nota: usa CURRENT_DATE (não filtra por período do painel)
export async function churnAlertHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';

    const r = await db.query(`
      SELECT
        c.cli_codigo,
        TRIM(c.cli_nome)                                        AS nome,
        f.for_codigo                                            AS industria_codigo,
        TRIM(f.for_nomered)                                     AS industria,
        MAX(p.ped_data)::DATE                                   AS ultimo_pedido,
        (CURRENT_DATE - MAX(p.ped_data)::DATE)::INTEGER        AS dias_sem_comprar,
        COUNT(DISTINCT p.ped_pedido)::INTEGER                   AS pedidos_60d,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC            AS total_60d
      FROM pedidos p
      LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
      INNER JOIN clientes c ON c.cli_codigo = p.ped_cliente
      INNER JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE p.ped_situacao IN ('P','F','A')
        AND p.ped_data >= CURRENT_DATE - INTERVAL '60 days'
        AND f.for_nomered IS NOT NULL
        ${allowFilter}
        ${forFilter}
      GROUP BY c.cli_codigo, c.cli_nome, f.for_codigo, f.for_nomered
      HAVING MAX(p.ped_data)::DATE < CURRENT_DATE - INTERVAL '30 days'
      ORDER BY dias_sem_comprar DESC
      LIMIT 25
    `);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/churn-alert]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/metas-mensal ─────────────────────────────────────────────────
// Chama fn_metas_por_mes(ano, industria?) — pivot mensal com 5 métricas por indústria
// Retorna: industria_codigo, industria_nome, mes, mes_nome,
//          ano_anterior, meta_ano_corrente, vendas_ano_corrente,
//          perc_atingimento, perc_relacao_ano_ant
export async function metasMensalHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const anoRef = Math.max(...anos);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    // fn_metas_por_mes(p_ano, p_industria DEFAULT NULL)
    let rows: any[];
    if (allowedIndustries) {
      // Filtra resultado pelas indústrias permitidas ao usuário
      const r = await db.query(
        `SELECT * FROM fn_metas_por_mes($1, $2)
         WHERE industria_codigo = ANY($3::int[])
         ORDER BY industria_nome, mes`,
        [anoRef, forInt ?? null, allowedIndustries],
      );
      rows = r.rows;
    } else {
      const r = await db.query(
        `SELECT * FROM fn_metas_por_mes($1, $2) ORDER BY industria_nome, mes`,
        [anoRef, forInt ?? null],
      );
      rows = r.rows;
    }

    res.json({ success: true, data: rows, meta: { ano: anoRef } });
  } catch (error: any) {
    console.error('❌ [BI/metas-mensal]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/mix-categorias ───────────────────────────────────────────────
// Heatmap: top clientes × top grupos de produto (SKUs distintos + valor)
export async function mixCategoriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';

    const r = await db.query(`
      WITH base AS (
        SELECT
          p.ped_cliente,
          COALESCE(NULLIF(TRIM(g.gru_nome), ''), 'Sem Grupo') AS grupo,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COUNT(DISTINCT i.ite_produto)::INTEGER                          AS skus
        FROM pedidos p
        JOIN itens_ped i  ON i.ite_pedido   = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
        LEFT JOIN grupos   g  ON g.gru_codigo  = cp.pro_grupo
        WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${allowFilter}
          ${forFilter}
        GROUP BY p.ped_cliente, grupo
      ),
      top_cli AS (
        SELECT ped_cliente
        FROM base
        GROUP BY ped_cliente
        ORDER BY SUM(total) DESC
        LIMIT 10
      ),
      top_grupos AS (
        SELECT grupo
        FROM base
        WHERE ped_cliente = ANY(SELECT ped_cliente FROM top_cli)
        GROUP BY grupo
        ORDER BY SUM(total) DESC
        LIMIT 8
      )
      SELECT
        COALESCE(NULLIF(TRIM(c.cli_nomred), ''), TRIM(c.cli_nome)) AS cliente,
        b.grupo,
        b.total,
        b.skus
      FROM base b
      INNER JOIN top_cli tc    ON tc.ped_cliente = b.ped_cliente
      INNER JOIN top_grupos tg ON tg.grupo = b.grupo
      INNER JOIN clientes c    ON c.cli_codigo = b.ped_cliente
      ORDER BY b.total DESC
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/mix-categorias]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/ativacao-clientes ────────────────────────────────────────────
// Heatmap de ativação: top 20 clientes × indústrias ativas no período
// Retorna: clientes[], industrias[], compras[] com { cliente, industria_codigo }
export async function atividadeClientesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const agruparRede = req.query.agrupar_rede === 'true';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const cliFilter   = cliInt ? `AND p.ped_cliente = ${cliInt}` : '';

    const groupField = agruparRede ? "COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nome)" : "c.cli_nome";

    const r = await db.query(`
      WITH base AS (
        SELECT
          p.ped_cliente,
          p.ped_industria,
          ROUND(SUM(i.ite_totliquido)::NUMERIC, 2) AS total
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${allowFilter}
          ${forFilter}
          ${cliFilter}
        GROUP BY p.ped_cliente, p.ped_industria
      ),
      top_cli AS (
        SELECT 
          ${agruparRede ? groupField + " as grupo_nome" : "ped_cliente"}, 
          SUM(total) AS cli_total
        FROM base
        ${agruparRede ? "INNER JOIN clientes c ON c.cli_codigo = base.ped_cliente" : ""}
        GROUP BY ${agruparRede ? "grupo_nome" : "ped_cliente"}
        ORDER BY cli_total DESC
        LIMIT 25
      ),
      ind_ativas AS (
        SELECT DISTINCT b.ped_industria
        FROM base b
        ${agruparRede ? "INNER JOIN clientes c ON c.cli_codigo = b.ped_cliente" : ""}
        INNER JOIN top_cli tc ON ${agruparRede ? "COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nome) = tc.grupo_nome" : "tc.ped_cliente = b.ped_cliente"}
      )
      SELECT
        ${agruparRede ? "tc.grupo_nome" : "TRIM(c.cli_nome)"}        AS cliente,
        ${agruparRede ? "0" : "c.cli_codigo"}                       AS cliente_codigo,
        f.for_codigo            AS industria_codigo,
        TRIM(f.for_nomered)     AS industria,
        SUM(b.total)            AS total_item,
        MAX(tc.cli_total)       AS cli_total
      FROM base b
      ${agruparRede ? "INNER JOIN clientes c ON c.cli_codigo = b.ped_cliente" : "INNER JOIN clientes c ON c.cli_codigo = b.ped_cliente"}
      INNER JOIN top_cli tc ON ${agruparRede ? "COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nome) = tc.grupo_nome" : "tc.ped_cliente = b.ped_cliente"}
      INNER JOIN ind_ativas ia  ON ia.ped_industria = b.ped_industria
      INNER JOIN fornecedores f ON f.for_codigo = b.ped_industria
      WHERE f.for_nomered IS NOT NULL
      GROUP BY cliente, cliente_codigo, industria_codigo, industria
      ORDER BY cli_total DESC, f.for_nomered
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/ativacao-clientes]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/clientes-ranking ────────────────────────────────────────────
// Ranking de clientes com: total, pedidos, ticket_medio, dias_sem_comprar,
// num_industrias, curva_abc (A/B/C), pct_total, pct_acumulado
export async function clientesRankingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade' : metrica === 'skus' ? 'skus' : 'total';
    const agruparRede = req.query.agrupar_rede === 'true';
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries);

    const groupField = agruparRede ? "COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nome)" : "c.cli_nomred";

    const r = await db.query(`
      WITH agg AS (
        SELECT
          ${agruparRede ? "MAX(p.ped_cliente)" : "p.ped_cliente"} AS cli_codigo_ref,
          ${groupField} AS nome_exibicao,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC        AS total,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC              AS quantidade,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER        AS skus,
          COUNT(DISTINCT p.ped_pedido)::INTEGER               AS pedidos,
          COUNT(DISTINCT p.ped_industria)::INTEGER            AS num_industrias,
          MAX(p.ped_data)::DATE                               AS ultimo_pedido
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        INNER JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${extraFilters}
        GROUP BY ${agruparRede ? "nome_exibicao" : "p.ped_cliente, nome_exibicao"}
      ),
      grand AS (
        SELECT NULLIF(SUM(${orderCol}), 0) AS grand_total FROM agg
      ),
      ranked AS (
        SELECT *,
          SUM(${orderCol}) OVER (ORDER BY ${orderCol} DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_total
        FROM agg
      )
      SELECT
        r.cli_codigo_ref AS cli_codigo,
        TRIM(r.nome_exibicao)                                   AS nome,
        r.total,
        r.quantidade,
        r.skus,
        r.pedidos,
        r.num_industrias,
        r.ultimo_pedido,
        (CURRENT_DATE - r.ultimo_pedido)::INTEGER               AS dias_sem_comprar,
        ROUND(r.total / NULLIF(r.pedidos, 0), 2)::NUMERIC       AS ticket_medio,
        ROUND(r.${orderCol} * 100.0 / NULLIF(g.grand_total, 0), 2)::NUMERIC AS pct_total,
        ROUND(r.cum_total * 100.0 / NULLIF(g.grand_total, 0), 1)::NUMERIC AS pct_acumulado,
        CASE
          WHEN r.cum_total * 100.0 / NULLIF(g.grand_total, 0) <= 70 THEN 'A'
          WHEN r.cum_total * 100.0 / NULLIF(g.grand_total, 0) <= 90 THEN 'B'
          ELSE 'C'
        END AS curva_abc
      FROM ranked r
      CROSS JOIN grand g
      ORDER BY r.${orderCol} DESC
      LIMIT 100
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/clientes-ranking]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/clientes-queda-mom ──────────────────────────────────────────
// Clientes com maior queda percentual: volume mês corrente vs média dos 3 meses anteriores
export async function clientesQuedaMomHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries);

    // Mês de referência: mês atual ou último mês do filtro
    const mesRef = meses?.length
      ? Math.max(...meses)
      : new Date().getMonth() + 1; // 1-12
    const anoRef = Math.max(...anos);

    const r = await db.query(`
      WITH monthly AS (
        SELECT
          p.ped_cliente,
          EXTRACT(MONTH FROM p.ped_data)::INTEGER AS mes,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${extraFilters}
        GROUP BY p.ped_cliente, mes
      ),
      atual AS (
        SELECT ped_cliente, total AS total_atual
        FROM monthly WHERE mes = $2
      ),
      media_tri AS (
        SELECT
          ped_cliente,
          AVG(total)::NUMERIC AS media_3m
        FROM monthly
        WHERE mes IN ($2 - 1, $2 - 2, $2 - 3)
        GROUP BY ped_cliente
      )
      SELECT
        c.cli_codigo,
        TRIM(c.cli_nomred)                                    AS nome,
        a.total_atual,
        mt.media_3m,
        ROUND((a.total_atual / NULLIF(mt.media_3m, 0) - 1) * 100, 1)::NUMERIC AS variacao_pct
      FROM atual a
      INNER JOIN media_tri mt ON mt.ped_cliente = a.ped_cliente
      INNER JOIN clientes c   ON c.cli_codigo = a.ped_cliente
      WHERE mt.media_3m > 0
        AND a.total_atual < mt.media_3m
        AND c.cli_nomred IS NOT NULL
        AND c.cli_tipopes = 'A'
      ORDER BY variacao_pct ASC
      LIMIT 20
    `, [anoRef, mesRef]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/clientes-queda-mom]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/grupos-lojas ─────────────────────────────────────────────────
// Análise por rede/grupo de lojas com detalhamento por indústria
// Retorna grupos ordenados por faturamento, cada um com array de industrias
export async function gruposLojasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      WITH base AS (
        SELECT
          COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), '(Sem Rede)') AS rede,
          p.ped_industria,
          TRIM(f.for_nomered)                                        AS industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC               AS total,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                      AS pedidos,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                     AS clientes
        FROM pedidos p
        LEFT JOIN itens_ped  i ON i.ite_pedido = p.ped_pedido
        LEFT JOIN clientes   c ON c.cli_codigo  = p.ped_cliente
        LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE p.ped_situacao IN ('P','F','A')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          AND c.cli_tipopes = 'A'
          ${extraFilters}
        GROUP BY rede, p.ped_industria, f.for_nomered
      ),
      grp AS (
        SELECT
          rede,
          ROUND(SUM(total), 2)::NUMERIC     AS total,
          SUM(pedidos)::INTEGER   AS pedidos,
          MAX(clientes)::INTEGER  AS clientes
        FROM base
        GROUP BY rede
        ORDER BY total DESC
        LIMIT 30
      )
      SELECT
        g.rede,
        g.total,
        g.pedidos,
        g.clientes,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('industria', b.industria, 'total', b.total, 'pedidos', b.pedidos)
            ORDER BY b.total DESC
          ) FILTER (WHERE b.industria IS NOT NULL),
          '[]'
        ) AS industrias
      FROM grp g
      LEFT JOIN base b ON b.rede = g.rede
      GROUP BY g.rede, g.total, g.pedidos, g.clientes
      ORDER BY g.total DESC
    `, [anos]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/grupos-lojas]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/ciclo-compras ────────────────────────────────────────────────
// Ciclo médio de compras: média de dias entre pedidos consecutivos por mês
// Retorna série mensal + média global para exibição em gráfico de linha
export async function cicloComprasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries);

    const yearList = anos.map(Number).join(',');

    const r = await db.query(`
      WITH ordered AS (
        SELECT
          p.ped_cliente,
          p.ped_data::DATE                                              AS data,
          LAG(p.ped_data::DATE) OVER (
            PARTITION BY p.ped_cliente ORDER BY p.ped_data
          )                                                             AS data_ant
        FROM pedidos p
        WHERE UPPER(TRIM(p.ped_situacao)) IN ('P', 'F')
          AND EXTRACT(YEAR FROM p.ped_data) IN (${yearList})
          ${extraFilters}
      ),
      gaps AS (
        SELECT
          ped_cliente,
          (data - data_ant)::INTEGER               AS dias_gap,
          EXTRACT(YEAR  FROM data)::INTEGER        AS ano,
          EXTRACT(MONTH FROM data)::INTEGER        AS mes
        FROM ordered
        WHERE data_ant IS NOT NULL
          AND (data - data_ant) BETWEEN 1 AND 365
      )
      SELECT
        ano,
        mes,
        ROUND(AVG(dias_gap), 1)::NUMERIC   AS media_ciclo,
        COUNT(*)::INTEGER                  AS n_transicoes
      FROM gaps
      GROUP BY ano, mes
      ORDER BY ano, mes
    `);

    const rows = r.rows;
    const mediaGlobal = rows.length
      ? +(rows.reduce((s: number, x: any) => s + parseFloat(x.media_ciclo), 0) / rows.length).toFixed(1)
      : 0;

    res.json({ success: true, data: { serie: rows, media_global: mediaGlobal } });
  } catch (error: any) {
    console.error('❌ [BI/ciclo-compras]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/media-recompra ───────────────────────────────────────────────
// Média de recompra: quantos pedidos cada cliente faz no período + distribuição
export async function mediaRecompraHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      WITH cli_ped AS (
        SELECT
          p.ped_cliente,
          COUNT(DISTINCT p.ped_pedido)::INTEGER AS num_pedidos
        FROM pedidos p
        WHERE ${where}
        GROUP BY p.ped_cliente
      )
      SELECT
        ROUND(AVG(num_pedidos), 2)::NUMERIC                                    AS media,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY num_pedidos)::NUMERIC      AS mediana,
        COUNT(*)::INTEGER                                                       AS total_clientes,
        COUNT(*) FILTER (WHERE num_pedidos = 1)::INTEGER                        AS bucket_1,
        COUNT(*) FILTER (WHERE num_pedidos BETWEEN 2 AND 3)::INTEGER            AS bucket_2_3,
        COUNT(*) FILTER (WHERE num_pedidos BETWEEN 4 AND 6)::INTEGER            AS bucket_4_6,
        COUNT(*) FILTER (WHERE num_pedidos BETWEEN 7 AND 12)::INTEGER           AS bucket_7_12,
        COUNT(*) FILTER (WHERE num_pedidos > 12)::INTEGER                       AS bucket_12plus
      FROM cli_ped
    `, params);

    res.json({ success: true, data: r.rows[0] ?? null });
  } catch (error: any) {
    console.error('❌ [BI/media-recompra]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/vendas-categorias ────────────────────────────────────────────
// Vendas agrupadas por categoria de produto (flags booleanas em cad_prod)
// Disponível apenas para schemas que possuem essas colunas (ex: ro_consult)
export async function vendasCategoriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    // Verifica se a tabela cad_prod tem as colunas de categoria
    const colCheck = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cad_prod' AND column_name = 'pro_linhaleve'
      LIMIT 1
    `);
    if (!colCheck.rows.length) {
      res.json({ success: true, data: [] });
      return;
    }

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      WITH vendas AS (
        SELECT
          cat.nome                                              AS categoria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                AS quantidade,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                  AS pedidos,
          COUNT(DISTINCT i.ite_produto)::INTEGER                 AS produtos
        FROM itens_ped i
        JOIN pedidos p   ON p.ped_pedido = i.ite_pedido
        JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                         AND cp.pro_industria = i.ite_industria
        CROSS JOIN LATERAL (
          VALUES
            ('Leve',         cp.pro_linhaleve),
            ('Pesada',       cp.pro_linhapesada),
            ('Agrícola',     cp.pro_linhaagricola),
            ('Amarela',      cp.pro_linhaamarela),
            ('Utilitários',  cp.pro_linhautilitarios),
            ('Off-Road',     cp.pro_offroad),
            ('Motopeças',    cp.pro_motocicletas)
        ) AS cat(nome, ativo)
        WHERE cat.ativo = true
          AND ${where}
        GROUP BY cat.nome
      ),
      todas AS (
        SELECT nome FROM (VALUES ('Leve'),('Pesada'),('Agrícola'),('Amarela'),('Utilitários'),('Off-Road'),('Motopeças')) AS t(nome)
      )
      SELECT
        todas.nome                          AS categoria,
        COALESCE(v.total, 0)::NUMERIC       AS total,
        COALESCE(v.quantidade, 0)::NUMERIC  AS quantidade,
        COALESCE(v.pedidos, 0)::INTEGER     AS pedidos,
        COALESCE(v.produtos, 0)::INTEGER    AS produtos
      FROM todas
      LEFT JOIN vendas v ON v.categoria = todas.nome
      ORDER BY total DESC
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/vendas-categorias]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ─── ESTATÍSTICAS TAB ────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

// ─── GET /api/bi/stats-resumo ─────────────────────────────────────────────────
// 4 KPI cards: Valor vendido, Qtd total, Nº pedidos, IDs vendidos (SKUs)
export async function statsResumoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoA = Math.max(...anos);
    const anoB = anos.length === 2 ? Math.min(...anos) : anoA - 1;

    const { where: whereA, params: paramsA } = buildWhere([anoA], meses, forInt, cliInt, allowedIndustries);
    const { where: whereB, params: paramsB } = buildWhere([anoB], meses, forInt, cliInt, allowedIndustries);

    const sql = (w: string) => `
      SELECT
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC   AS valor_vendido,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC                            AS qtd_total,
        COUNT(DISTINCT p.ped_pedido)::INTEGER                              AS num_pedidos,
        COUNT(DISTINCT i.ite_produto)::INTEGER                             AS ids_vendidos
      FROM itens_ped i
      JOIN pedidos p ON p.ped_pedido = i.ite_pedido
      WHERE ${w}
    `;

    const [rA, rB] = await Promise.all([
      db.query(sql(whereA), paramsA),
      db.query(sql(whereB), paramsB),
    ]);

    const a = rA.rows[0] ?? {};
    const b = rB.rows[0] ?? {};

    const delta = (k: string): number | null => {
      const va = parseFloat(a[k] || 0);
      const vb = parseFloat(b[k] || 0);
      if (!vb) return null;
      const d = (va - vb) / vb * 100;
      if (Math.abs(d) > 999) return null;
      return parseFloat(d.toFixed(1));
    };

    res.json({
      success: true,
      data: {
        valor_vendido:       parseFloat(a.valor_vendido || 0),
        qtd_total:           parseFloat(a.qtd_total || 0),
        num_pedidos:         parseInt(a.num_pedidos || 0),
        ids_vendidos:        parseInt(a.ids_vendidos || 0),
        delta_valor:         delta('valor_vendido'),
        delta_qtd:           delta('qtd_total'),
        delta_pedidos:       delta('num_pedidos'),
        delta_ids:           delta('ids_vendidos'),
        ano_ref:             anoA,
        ano_comp:            anoB,
      },
    });
  } catch (error: any) {
    console.error('❌ [BI/stats-resumo]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-curva-abc ──────────────────────────────────────────────
// Classificação ABC dinâmica (Pareto): A=80%, B=80-95%, C=95-100%
export async function statsCurvaAbcHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      WITH vendas_prod AS (
        SELECT
          i.ite_produto AS produto,
          COALESCE(SUM(i.ite_totliquido), 0) AS total
        FROM itens_ped i
        JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${where}
        GROUP BY i.ite_produto
      ),
      ranked AS (
        SELECT
          produto, total,
          SUM(total) OVER (ORDER BY total DESC) AS acumulado,
          SUM(total) OVER ()                    AS grand_total
        FROM vendas_prod
        WHERE total > 0
      ),
      classified AS (
        SELECT
          produto, total,
          CASE
            WHEN acumulado <= grand_total * 0.80 THEN 'A'
            WHEN acumulado <= grand_total * 0.95 THEN 'B'
            ELSE 'C'
          END AS curva
        FROM ranked
      )
      SELECT
        curva,
        COUNT(*)::INTEGER       AS vendidos,
        COALESCE(ROUND(SUM(total)::NUMERIC, 2), 0)::NUMERIC AS total
      FROM classified
      GROUP BY curva
      ORDER BY curva
    `, params);

    // Total de SKUs cadastrados (para mostrar proporção)
    const totalSkus = await db.query(`SELECT COUNT(DISTINCT pro_codprod)::INTEGER AS total FROM cad_prod`);

    res.json({
      success: true,
      data: r.rows,
      total_skus: totalSkus.rows[0]?.total ?? 0,
    });
  } catch (error: any) {
    console.error('❌ [BI/stats-curva-abc]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-ultima-compra ──────────────────────────────────────────
// Clientes ordenados por dias sem comprar (recência)
export async function statsUltimaCompraHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const limit    = parseInt(String(req.query.limit || 20));

    // Filtra apenas pedidos P/F, com indústria permitida
    const clauses: string[] = [`UPPER(TRIM(p.ped_situacao)) IN ('P', 'F')`];
    const params: any[] = [];

    if (forInt) {
      params.push(forInt);
      clauses.push(`p.ped_industria = $${params.length}`);
    }
    if (allowedIndustries?.length) {
      params.push(allowedIndustries);
      clauses.push(`p.ped_industria = ANY($${params.length}::int[])`);
    }
    if (cliInt) {
      params.push(cliInt);
      clauses.push(`p.ped_cliente = $${params.length}`);
    }

    const wh = clauses.join(' AND ');
    params.push(limit);

    const r = await db.query(`
      SELECT
        c.cli_codigo,
        COALESCE(c.cli_nomred, c.cli_nome) AS nome,
        MAX(p.ped_data)::DATE              AS ultima_compra,
        (CURRENT_DATE - MAX(p.ped_data)::DATE)::INTEGER AS dias
      FROM pedidos p
      JOIN clientes c ON c.cli_codigo = p.ped_cliente
      WHERE ${wh} AND c.cli_tipopes = 'A'
      GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome
      ORDER BY dias DESC
      LIMIT $${params.length}
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/stats-ultima-compra]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-fat-industria-mensal ───────────────────────────────────
// Faturamento e clientes atendidos por indústria, mês a mês
export async function statsFatIndustriaMensalHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      SELECT
        f.for_nomered                                                     AS industria,
        p.ped_industria                                                    AS industria_codigo,
        EXTRACT(MONTH FROM p.ped_data)::INTEGER                            AS mes,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC    AS total,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC                            AS quantidade,
        COUNT(DISTINCT p.ped_cliente)::INTEGER                             AS clientes
      FROM itens_ped i
      JOIN pedidos p   ON p.ped_pedido = i.ite_pedido
      JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE ${where}
      GROUP BY f.for_nomered, p.ped_industria, EXTRACT(MONTH FROM p.ped_data)
      ORDER BY f.for_nomered, mes
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/stats-fat-industria-mensal]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-classificacao-produtos ─────────────────────────────────
// Ranking de produtos com curva ABC dinâmica e quantidade vendida
export async function statsClassificacaoProdutosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const curvaFilter = req.query.curva ? String(req.query.curva).toUpperCase() : null;
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
    const effectiveLimit = curvaFilter ? 100 : limit;

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);
    params.push(effectiveLimit);

    const curvaWhere = curvaFilter ? `WHERE curva = '${curvaFilter}'` : '';

    const r = await db.query(`
      WITH vendas_prod AS (
        SELECT
          i.ite_produto AS produto,
          COALESCE(SUM(i.ite_totliquido), 0) AS total,
          COALESCE(SUM(i.ite_quant), 0)      AS quantidade
        FROM itens_ped i
        JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${where}
        GROUP BY i.ite_produto
      ),
      ranked AS (
        SELECT
          produto, total, quantidade,
          SUM(total) OVER (ORDER BY total DESC) AS acumulado,
          SUM(total) OVER ()                    AS grand_total
        FROM vendas_prod
        WHERE total > 0
      ),
      classified AS (
        SELECT
          produto,
          ROUND(total::NUMERIC, 2)::NUMERIC AS total,
          quantidade::NUMERIC,
          CASE
            WHEN acumulado <= grand_total * 0.80 THEN 'A'
            WHEN acumulado <= grand_total * 0.95 THEN 'B'
            ELSE 'C'
          END AS curva
        FROM ranked
      )
      SELECT * FROM classified
      ${curvaWhere}
      ORDER BY total DESC
      LIMIT $${params.length}
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/stats-classificacao-produtos]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-status-clientes ────────────────────────────────────────
// Status dos clientes no trimestre: Novos, Perdidos, Reativados, Retidos
export async function statsStatusClientesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoAtual = Math.max(...anos);
    const mesesFiltro = meses?.length ? meses : [1,2,3,4,5,6,7,8,9,10,11,12];

    // Determinar trimestre atual (baseado nos meses filtrados)
    const maxMes = Math.max(...mesesFiltro);
    const trimAtual = Math.ceil(maxMes / 3);
    const mesesTrimAtual = [(trimAtual-1)*3+1, (trimAtual-1)*3+2, (trimAtual-1)*3+3];

    // Trimestre anterior
    let mesesTrimAnterior: number[];
    let anoAnterior = anoAtual;
    if (trimAtual === 1) {
      mesesTrimAnterior = [10, 11, 12];
      anoAnterior = anoAtual - 1;
    } else {
      const trimAnt = trimAtual - 1;
      mesesTrimAnterior = [(trimAnt-1)*3+1, (trimAnt-1)*3+2, (trimAnt-1)*3+3];
    }

    const indClause = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const allowedClause = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`
      : '';

    // Clientes do período atual
    const qAtual = await db.query(`
      SELECT DISTINCT p.ped_cliente
      FROM pedidos p
      WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) = ${anoAtual}
        AND EXTRACT(MONTH FROM p.ped_data) IN (${mesesTrimAtual.join(',')})
        ${indClause} ${allowedClause}
    `);
    const clientesAtual = new Set(qAtual.rows.map((r: any) => r.ped_cliente));

    // Clientes do período anterior
    const qAnterior = await db.query(`
      SELECT DISTINCT p.ped_cliente
      FROM pedidos p
      WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) = ${anoAnterior}
        AND EXTRACT(MONTH FROM p.ped_data) IN (${mesesTrimAnterior.join(',')})
        ${indClause} ${allowedClause}
    `);
    const clientesAnterior = new Set(qAnterior.rows.map((r: any) => r.ped_cliente));

    // Clientes em todo o histórico (excluindo período atual e anterior)
    const qHistorico = await db.query(`
      SELECT DISTINCT p.ped_cliente
      FROM pedidos p
      WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
        AND NOT (
          (EXTRACT(YEAR FROM p.ped_data) = ${anoAtual} AND EXTRACT(MONTH FROM p.ped_data) IN (${mesesTrimAtual.join(',')}))
          OR
          (EXTRACT(YEAR FROM p.ped_data) = ${anoAnterior} AND EXTRACT(MONTH FROM p.ped_data) IN (${mesesTrimAnterior.join(',')}))
        )
        ${indClause} ${allowedClause}
    `);
    const clientesHistorico = new Set(qHistorico.rows.map((r: any) => r.ped_cliente));

    // Classificação
    let novos = 0, perdidos = 0, reativados = 0, retidos = 0;

    clientesAtual.forEach(cli => {
      if (clientesAnterior.has(cli)) {
        retidos++;       // Está no atual E no anterior
      } else if (clientesHistorico.has(cli)) {
        reativados++;    // Está no atual E no histórico, MAS NÃO no anterior
      } else {
        novos++;         // Está no atual, NÃO no anterior nem histórico
      }
    });

    clientesAnterior.forEach(cli => {
      if (!clientesAtual.has(cli)) {
        perdidos++;      // Estava no anterior, NÃO está no atual
      }
    });

    res.json({
      success: true,
      data: {
        novos, perdidos, reativados, retidos,
        trimestre: `Q${trimAtual}/${anoAtual}`,
        trimestre_anterior: `Q${trimAtual === 1 ? 4 : trimAtual - 1}/${anoAnterior}`,
      },
    });
  } catch (error: any) {
    console.error('❌ [BI/stats-status-clientes]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ─── CURVA ABC TAB ───────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

// ─── GET /api/bi/abc-overview ─────────────────────────────────────────────────
// Resumo por classe (qtd, fat, vendidos) + sparklines mensais + portfolio
export async function abcOverviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    // 1) Classificar todos os produtos e obter totais por classe
    const classesR = await db.query(`
      WITH vendas_prod AS (
        SELECT
          i.ite_produto AS produto,
          COALESCE(SUM(i.ite_totliquido), 0) AS fat,
          COALESCE(SUM(i.ite_quant), 0)      AS qtd
        FROM itens_ped i
        JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${where}
        GROUP BY i.ite_produto
      ),
      ranked AS (
        SELECT
          produto, fat, qtd,
          SUM(fat) OVER (ORDER BY fat DESC) AS acumulado,
          SUM(fat) OVER ()                  AS grand_total
        FROM vendas_prod
        WHERE fat > 0
      ),
      classified AS (
        SELECT produto, fat, qtd,
          CASE
            WHEN acumulado <= grand_total * 0.80 THEN 'A'
            WHEN acumulado <= grand_total * 0.95 THEN 'B'
            ELSE 'C'
          END AS curva
        FROM ranked
      )
      SELECT
        curva,
        COUNT(*)::INTEGER                                   AS vendidos,
        COALESCE(ROUND(SUM(fat)::NUMERIC, 2), 0)::NUMERIC  AS fat_total,
        COALESCE(SUM(qtd), 0)::NUMERIC                     AS qtd_total
      FROM classified
      GROUP BY curva
      ORDER BY curva
    `, params);

    // 2) Sparklines: venda mensal por classe
    const { where: whereSp, params: paramsSp } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);
    const sparklinesR = await db.query(`
      WITH vendas_prod AS (
        SELECT
          i.ite_produto AS produto,
          COALESCE(SUM(i.ite_totliquido), 0) AS fat
        FROM itens_ped i
        JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${whereSp}
        GROUP BY i.ite_produto
      ),
      ranked AS (
        SELECT produto, fat,
          SUM(fat) OVER (ORDER BY fat DESC) AS acumulado,
          SUM(fat) OVER ()                  AS grand_total
        FROM vendas_prod
        WHERE fat > 0
      ),
      classified AS (
        SELECT produto,
          CASE
            WHEN acumulado <= grand_total * 0.80 THEN 'A'
            WHEN acumulado <= grand_total * 0.95 THEN 'B'
            ELSE 'C'
          END AS curva
        FROM ranked
      )
      SELECT
        c.curva,
        EXTRACT(MONTH FROM p.ped_data)::INTEGER AS mes,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC  AS qtd,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS fat
      FROM itens_ped i
      JOIN pedidos p ON p.ped_pedido = i.ite_pedido
      JOIN classified c ON c.produto = i.ite_produto
      WHERE ${whereSp}
      GROUP BY c.curva, EXTRACT(MONTH FROM p.ped_data)
      ORDER BY c.curva, mes
    `, paramsSp);

    // 3) Portfolio
    const portfolioR = await db.query(`SELECT COUNT(DISTINCT pro_codprod)::INTEGER AS total FROM cad_prod`);
    const totalSkusVendidos = classesR.rows.reduce((s: number, r: any) => s + r.vendidos, 0);
    const portfolio = portfolioR.rows[0]?.total ?? 0;

    res.json({
      success: true,
      classes: classesR.rows,
      sparklines: sparklinesR.rows,
      portfolio: {
        total: portfolio,
        vendidos: totalSkusVendidos,
        inativos: Math.max(0, portfolio - totalSkusVendidos),
      },
    });
  } catch (error: any) {
    console.error('❌ [BI/abc-overview]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/abc-ticket-medio ─────────────────────────────────────────────
// Ticket médio dos produtos Curva A: avg R$ e avg Qtd por pedido
export async function abcTicketMedioHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const limit    = parseInt(String(req.query.limit || 30));

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);
    params.push(limit);

    const r = await db.query(`
      WITH vendas_prod AS (
        SELECT
          i.ite_produto AS produto,
          COALESCE(SUM(i.ite_totliquido), 0) AS total,
          COALESCE(SUM(i.ite_quant), 0)      AS qtd_total,
          COUNT(DISTINCT i.ite_pedido)        AS num_pedidos
        FROM itens_ped i
        JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${where}
        GROUP BY i.ite_produto
      ),
      ranked AS (
        SELECT
          produto, total, qtd_total, num_pedidos,
          SUM(total) OVER (ORDER BY total DESC) AS acumulado,
          SUM(total) OVER ()                    AS grand_total
        FROM vendas_prod
        WHERE total > 0
      )
      SELECT
        produto,
        ROUND((total / NULLIF(num_pedidos, 0))::NUMERIC, 2)::NUMERIC     AS ticket_rs,
        ROUND((qtd_total / NULLIF(num_pedidos, 0))::NUMERIC, 0)::NUMERIC AS ticket_qtd,
        total::NUMERIC,
        qtd_total::NUMERIC,
        num_pedidos::INTEGER
      FROM ranked
      WHERE acumulado <= grand_total * 0.80
      ORDER BY total DESC
      LIMIT $${params.length}
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/abc-ticket-medio]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/abc-ranking ──────────────────────────────────────────────────
// Ranking completo de produtos com % acumulado e classe ABC
// Suporta métrica: &metrica=financeiro|volume|skus
export async function abcRankingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const limit    = parseInt(String(req.query.limit || 50));
    const metrica  = String(req.query.metrica || 'financeiro');

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);
    params.push(limit);

    const orderCol = metrica === 'volume' ? 'qtd' : 'fat';

    const r = await db.query(`
      WITH vendas_prod AS (
        SELECT
          i.ite_produto                        AS produto,
          COALESCE(SUM(i.ite_totliquido), 0)   AS fat,
          COALESCE(SUM(i.ite_quant), 0)        AS qtd
        FROM itens_ped i
        JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${where}
        GROUP BY i.ite_produto
      ),
      ranked AS (
        SELECT
          produto, fat, qtd,
          SUM(${orderCol}) OVER (ORDER BY ${orderCol} DESC) AS acumulado,
          SUM(${orderCol}) OVER ()                          AS grand_total
        FROM vendas_prod
        WHERE ${orderCol} > 0
      )
      SELECT
        produto,
        ROUND(fat::NUMERIC, 2)::NUMERIC AS valor,
        qtd::NUMERIC AS quantidade,
        ROUND((acumulado / NULLIF(grand_total, 0) * 100)::NUMERIC, 2)::NUMERIC AS pct_acumulado,
        CASE
          WHEN acumulado <= grand_total * 0.80 THEN 'A'
          WHEN acumulado <= grand_total * 0.95 THEN 'B'
          ELSE 'C'
        END AS curva
      FROM ranked
      ORDER BY ${orderCol} DESC
      LIMIT $${params.length}
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/abc-ranking]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/alertas ──────────────────────────────────────────────────────
// Avalia alertas proativos: clientes inativos, queda mensal, indústrias zeradas
export async function alertasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const allowedClause = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])`
      : '';

    const [rInativos, rMensal, rZeradas] = await Promise.all([
      // Alert 1 — Clientes sem compra há >60 dias (base: últimos 2 anos)
      db.query(`
        SELECT COUNT(DISTINCT sub.cli)::INTEGER AS count
        FROM (
          SELECT DISTINCT ped_cliente AS cli
          FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data >= CURRENT_DATE - INTERVAL '2 years'
            ${allowedClause.replace(/p\./g, '')}
        ) sub
        WHERE sub.cli NOT IN (
          SELECT DISTINCT ped_cliente FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data > CURRENT_DATE - INTERVAL '60 days'
        )
      `),

      // Alert 2 — Queda de faturamento: mês atual vs mês anterior
      db.query(`
        WITH atual AS (
          SELECT COALESCE(SUM(i.ite_totliquido), 0) AS total
          FROM pedidos p
          JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
            AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE)
            ${allowedClause}
        ),
        anterior AS (
          SELECT COALESCE(SUM(i.ite_totliquido), 0) AS total
          FROM pedidos p
          JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
            AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND p.ped_data <  DATE_TRUNC('month', CURRENT_DATE)
            ${allowedClause}
        )
        SELECT
          atual.total    AS total_atual,
          anterior.total AS total_anterior,
          CASE WHEN anterior.total > 0
            THEN ROUND(((atual.total - anterior.total) / anterior.total * 100)::NUMERIC, 1)
            ELSE NULL
          END AS delta_pct
        FROM atual, anterior
      `),

      // Alert 3 — Indústrias com vendas no mês anterior mas zero no atual
      db.query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM (
          SELECT DISTINCT p.ped_industria
          FROM pedidos p
          WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
            AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND p.ped_data <  DATE_TRUNC('month', CURRENT_DATE)
            ${allowedClause}
          EXCEPT
          SELECT DISTINCT p.ped_industria
          FROM pedidos p
          WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
            AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE)
            ${allowedClause}
        ) sub
      `),
    ]);

    const items: { tipo: string; severidade: string; titulo: string; descricao: string }[] = [];

    // Clientes inativos
    const countInativos = parseInt(rInativos.rows[0]?.count || 0);
    if (countInativos > 0) {
      items.push({
        tipo: 'clientes_inativos',
        severidade: countInativos > 10 ? 'error' : 'warning',
        titulo: `${countInativos} cliente${countInativos > 1 ? 's' : ''} inativo${countInativos > 1 ? 's' : ''}`,
        descricao: 'Sem compras nos últimos 60 dias',
      });
    }

    // Queda mensal
    const deltaPct = rMensal.rows[0]?.delta_pct !== null ? parseFloat(rMensal.rows[0]?.delta_pct) : null;
    if (deltaPct !== null && deltaPct < -20) {
      items.push({
        tipo: 'queda_mensal',
        severidade: deltaPct < -30 ? 'error' : 'warning',
        titulo: `Queda de ${Math.abs(deltaPct).toFixed(1)}% no mês`,
        descricao: 'Faturamento atual vs mês anterior',
      });
    }

    // Indústrias zeradas
    const countZeradas = parseInt(rZeradas.rows[0]?.count || 0);
    if (countZeradas > 0) {
      items.push({
        tipo: 'industrias_zeradas',
        severidade: countZeradas > 2 ? 'error' : 'warning',
        titulo: `${countZeradas} indústria${countZeradas > 1 ? 's' : ''} sem pedido`,
        descricao: 'Venderam no mês anterior, zero neste mês',
      });
    }

    res.json({ success: true, data: { total: items.length, items } });
  } catch (error: any) {
    console.error('❌ [BI/alertas]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/alertas/detalhe?tipo= ───────────────────────────────────────
// Retorna a lista completa de itens para um alerta específico.
// tipos: clientes_inativos | industrias_zeradas | queda_mensal
export async function alertasDetalheHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = getUserId(req);
    const tipo   = String(req.query.tipo || '');
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const allowedClause = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])`
      : '';

    if (tipo === 'clientes_inativos') {
      const result = await db.query(`
        SELECT
          c.cli_codigo,
          COALESCE(c.cli_nomred, c.cli_nome) AS cli_nome,
          c.cli_cidade,
          c.cli_uf,
          MAX(p.ped_data)                              AS ultima_compra,
          (CURRENT_DATE - MAX(p.ped_data))::INTEGER    AS dias_inativo,
          COALESCE(SUM(p.ped_totliq) FILTER (
            WHERE p.ped_data >= CURRENT_DATE - INTERVAL '12 months'
          ), 0)::NUMERIC                               AS faturamento_12m
        FROM pedidos p
        JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '2 years'
          ${allowedClause}
        GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome, c.cli_cidade, c.cli_uf
        HAVING MAX(p.ped_data) < CURRENT_DATE - INTERVAL '60 days'
        ORDER BY dias_inativo DESC
        LIMIT 200
      `);
      return void res.json({ success: true, data: result.rows });
    }

    if (tipo === 'industrias_zeradas') {
      const result = await db.query(`
        SELECT
          f.for_codigo,
          COALESCE(f.for_nomered, f.for_nome) AS for_nome,
          COALESCE(SUM(p.ped_totliq) FILTER (
            WHERE p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND p.ped_data <  DATE_TRUNC('month', CURRENT_DATE)
          ), 0)::NUMERIC AS faturamento_mes_ant
        FROM fornecedores f
        JOIN pedidos p ON p.ped_industria = f.for_codigo
          AND UPPER(TRIM(p.ped_situacao)) IN ('P','F')
          AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          ${allowedClause}
        WHERE f.for_codigo IN (
          SELECT DISTINCT ped_industria FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND ped_data <  DATE_TRUNC('month', CURRENT_DATE)
          EXCEPT
          SELECT DISTINCT ped_industria FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data >= DATE_TRUNC('month', CURRENT_DATE)
        )
        GROUP BY f.for_codigo, f.for_nomered, f.for_nome
        ORDER BY faturamento_mes_ant DESC
      `);
      return void res.json({ success: true, data: result.rows });
    }

    if (tipo === 'queda_mensal') {
      const result = await db.query(`
        SELECT
          f.for_codigo,
          COALESCE(f.for_nomered, f.for_nome) AS for_nome,
          COALESCE(SUM(p.ped_totliq) FILTER (
            WHERE p.ped_data >= DATE_TRUNC('month', CURRENT_DATE)
          ), 0)::NUMERIC AS total_atual,
          COALESCE(SUM(p.ped_totliq) FILTER (
            WHERE p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND p.ped_data <  DATE_TRUNC('month', CURRENT_DATE)
          ), 0)::NUMERIC AS total_anterior
        FROM fornecedores f
        JOIN pedidos p ON p.ped_industria = f.for_codigo
          AND UPPER(TRIM(p.ped_situacao)) IN ('P','F')
          AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          ${allowedClause}
        GROUP BY f.for_codigo, f.for_nomered, f.for_nome
        HAVING SUM(p.ped_totliq) FILTER (
          WHERE p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        ) > 0
        ORDER BY total_anterior DESC
      `);
      return void res.json({ success: true, data: result.rows });
    }

    res.status(400).json({ success: false, message: 'tipo inválido' });
  } catch (error: any) {
    console.error('❌ [BI/alertas/detalhe]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/drilldown ────────────────────────────────────────────────────
// Drill-down hierárquico: 0=Indústrias → 1=Meses → 2=Clientes → 3=Famílias → 4=Produtos
export async function drilldownHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const nivel    = parseInt(String(req.query.nivel  || 0));
    const anos     = parseAnos(req.query.anos as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const mesInt   = req.query.mes        ? parseInt(String(req.query.mes))        : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const grupoInt = req.query.grupo      ? parseInt(String(req.query.grupo))      : null;

    const clauses: string[] = [`UPPER(TRIM(p.ped_situacao)) IN ('P','F')`];
    const params: any[] = [];

    clauses.push(`EXTRACT(YEAR FROM p.ped_data) IN (${anos.join(',')})`);

    if (forInt) {
      params.push(forInt);
      clauses.push(`p.ped_industria = $${params.length}`);
    }
    if (allowedIndustries?.length) {
      params.push(allowedIndustries);
      clauses.push(`p.ped_industria = ANY($${params.length}::int[])`);
    }
    if (mesInt) {
      clauses.push(`EXTRACT(MONTH FROM p.ped_data) = ${mesInt}`);
    }
    if (cliInt) {
      params.push(cliInt);
      clauses.push(`p.ped_cliente = $${params.length}`);
    }

    const where = clauses.join(' AND ');

    let rows: any[];

    if (nivel === 0) {
      const r = await db.query(`
        SELECT
          f.for_codigo                                                      AS codigo,
          COALESCE(f.for_nomered, f.for_nome)                              AS nome,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)           AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                           AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                            AS pedidos
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE ${where}
        GROUP BY f.for_codigo, f.for_nomered, f.for_nome
        ORDER BY total DESC
        LIMIT 20
      `, params);
      rows = r.rows;
    } else if (nivel === 1) {
      const r = await db.query(`
        SELECT
          EXTRACT(MONTH FROM p.ped_data)::INTEGER                          AS codigo,
          EXTRACT(MONTH FROM p.ped_data)::INTEGER                          AS mes,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)           AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                           AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                            AS pedidos
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE ${where}
        GROUP BY mes
        ORDER BY mes
      `, params);
      rows = r.rows;
    } else if (nivel === 2) {
      const r = await db.query(`
        SELECT
          c.cli_codigo                                                      AS codigo,
          COALESCE(c.cli_nomred, c.cli_nome)                              AS nome,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)           AS total,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                            AS pedidos
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE ${where}
        GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome
        ORDER BY total DESC
        LIMIT 30
      `, params);
      rows = r.rows;
    } else if (nivel === 3) {
      // nivel 3 — Famílias/Grupos de produto
      const r = await db.query(`
        SELECT
          COALESCE(g.gru_codigo, -1)::INTEGER                               AS codigo,
          COALESCE(NULLIF(TRIM(g.gru_nome), ''), '(Sem Família)')           AS nome,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)            AS total,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER                      AS quantidade,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                             AS pedidos
        FROM pedidos p
        JOIN itens_ped i  ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
        LEFT JOIN grupos g ON g.gru_codigo = cp.pro_grupo
        WHERE ${where}
        GROUP BY g.gru_codigo, g.gru_nome
        ORDER BY total DESC
        LIMIT 20
      `, params);
      rows = r.rows;
    } else {
      // nivel 4 — Produtos (SKUs) dentro de uma família
      let grupoClause = '';
      if (grupoInt !== null && !isNaN(grupoInt) && grupoInt >= 0) {
        params.push(grupoInt);
        grupoClause = `AND cp.pro_grupo = $${params.length}`;
      }
      const r = await db.query(`
        SELECT
          i.ite_produto                                                     AS codigo,
          CAST(i.ite_produto AS VARCHAR)                                    AS nome,
          MAX(cp.pro_nome)                                                  AS produto_nome,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)           AS total,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                          AS quantidade
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
        WHERE ${where}
        ${grupoClause}
        GROUP BY i.ite_produto
        ORDER BY total DESC
        LIMIT 30
      `, params);
      rows = r.rows;
    }

    res.json({ success: true, nivel, data: rows });
  } catch (error: any) {
    console.error('❌ [BI/drilldown]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/skus-por-grupo ───────────────────────────────────────────────
export async function skusPorGrupoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId  = getUserId(req);
    const anos    = parseAnos(req.query.anos as string);
    const meses   = parseMeses(req.query.meses as string);
    const forInt  = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt  = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      SELECT
        COALESCE(g.gru_codigo, 0)                                           AS gru_codigo,
        COALESCE(NULLIF(TRIM(g.gru_nome), ''), 'Sem Grupo')                AS gru_nome,
        COUNT(DISTINCT i.ite_produto)::INTEGER                              AS skus_distintos,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC                             AS quantidade_total,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC     AS total_valor,
        COUNT(DISTINCT p.ped_cliente)::INTEGER                              AS clientes_distintos
      FROM pedidos p
      JOIN itens_ped i    ON i.ite_pedido  = p.ped_pedido
      LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
      LEFT JOIN grupos   g  ON g.gru_codigo  = cp.pro_grupo
      WHERE ${where}
      GROUP BY g.gru_codigo, g.gru_nome
      ORDER BY total_valor DESC
      LIMIT 20
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/skus-por-grupo]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ─── PRODUTOS TAB ────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

// ─── GET /api/bi/produtos-overview ───────────────────────────────────────────
export async function produtosOverviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const db   = req.db!;
    const userId = getUserId(req);
    const anos   = parseAnos(req.query.anos as string);
    const meses  = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    let catalogoFilter = '';
    if (forInt) {
      catalogoFilter = `WHERE itab_industria = ${forInt}`;
    } else if (allowedIndustries?.length) {
      catalogoFilter = `WHERE itab_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`;
    }

    const r = await db.query(`
      WITH vendas AS (
        SELECT
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)  AS total_faturado,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER             AS skus_distintos,
          COUNT(DISTINCT cp.pro_grupo)::INTEGER                    AS grupos_ativos
        FROM pedidos p
        JOIN itens_ped i      ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                              AND cp.pro_industria = i.ite_industria
        WHERE ${where}
      ),
      catalogo AS (
        SELECT COUNT(DISTINCT itab_idprod)::INTEGER AS total_catalogo
        FROM cad_tabelaspre
        ${catalogoFilter}
      )
      SELECT
        v.total_faturado,
        v.skus_distintos,
        v.grupos_ativos,
        CASE WHEN c.total_catalogo > 0
             THEN ROUND((v.skus_distintos::NUMERIC / c.total_catalogo) * 100, 1)
             ELSE 0 END AS cobertura_pct
      FROM vendas v, catalogo c
    `, params);

    res.json({ success: true, data: r.rows[0] ?? null });
  } catch (error: any) {
    console.error('❌ [BI/produtos-overview]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/produtos-por-grupo ──────────────────────────────────────────
export async function produtosPorGrupoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db   = req.db!;
    const userId = getUserId(req);
    const anos   = parseAnos(req.query.anos as string);
    const meses  = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const metrica = String(req.query.metrica ?? 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade_current' : metrica === 'skus' ? 'skus_count' : 'total_current';

    const anoA = Math.max(...anos);
    const anoB = anos.length === 2 ? Math.min(...anos) : anoA - 1;

    const { where, params }                  = buildWhere([anoA], meses, forInt, cliInt, allowedIndustries);
    const { where: whereB, params: paramsB } = buildWhere([anoB], meses, forInt, cliInt, allowedIndustries);

    const [rA, rB] = await Promise.all([
      db.query(`
        SELECT
          cp.pro_grupo                                                AS gru_codigo,
          COALESCE(g.gru_nome, 'Sem Grupo')                          AS gru_nome,
          ROUND(SUM(i.ite_totliquido)::NUMERIC, 2)                   AS total_current,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                     AS quantidade_current,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER               AS skus_count,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                     AS clientes_count
        FROM pedidos p
        JOIN itens_ped i      ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                              AND cp.pro_industria = i.ite_industria
        LEFT JOIN grupos g    ON g.gru_codigo = cp.pro_grupo
        WHERE ${where}
        GROUP BY cp.pro_grupo, g.gru_nome
        ORDER BY ${orderCol} DESC
        LIMIT 12
      `, params),
      db.query(`
        SELECT
          cp.pro_grupo                             AS gru_codigo,
          ROUND(SUM(i.ite_totliquido)::NUMERIC, 2) AS total_previous
        FROM pedidos p
        JOIN itens_ped i      ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                              AND cp.pro_industria = i.ite_industria
        WHERE ${whereB}
        GROUP BY cp.pro_grupo
      `, paramsB),
    ]);

    const prevMap = new Map<number | null, number>();
    for (const row of rB.rows) {
      prevMap.set(row.gru_codigo, parseFloat(row.total_previous));
    }

    const data = rA.rows.map((row: any) => {
      const curr = parseFloat(row.total_current);
      const prev = prevMap.get(row.gru_codigo) ?? 0;
      const yoy  = prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : null;
      return {
        gru_codigo:        row.gru_codigo,
        gru_nome:          row.gru_nome,
        total_current:     curr,
        total_previous:    prev,
        yoy_pct:           yoy,
        quantidade_current: parseFloat(row.quantidade_current ?? '0'),
        skus_count:        row.skus_count,
        clientes_count:    row.clientes_count,
      };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ [BI/produtos-por-grupo]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/top-skus ────────────────────────────────────────────────────
export async function topSkusHandler(req: Request, res: Response): Promise<void> {
  try {
    const db   = req.db!;
    const userId = getUserId(req);
    const anos   = parseAnos(req.query.anos as string);
    const meses  = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade' : 'total';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries);

    const r = await db.query(`
      WITH total_geral AS (
        SELECT GREATEST(COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0), 1) AS total
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE ${where}
      ),
      por_sku AS (
        SELECT
          TRIM(i.ite_produto)                                 AS ite_produto,
          MAX(COALESCE(cp.pro_nome, i.ite_nomeprod, ''))      AS pro_nome,
          MAX(COALESCE(g.gru_nome, 'Sem Grupo'))              AS gru_nome,
          ROUND(SUM(i.ite_totliquido)::NUMERIC, 2)            AS total,
          ROUND(SUM(i.ite_quant)::NUMERIC, 0)                 AS quantidade,
          COUNT(DISTINCT p.ped_pedido)::INTEGER               AS pedidos
        FROM pedidos p
        JOIN itens_ped i      ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                              AND cp.pro_industria = i.ite_industria
        LEFT JOIN grupos g    ON g.gru_codigo = cp.pro_grupo
        WHERE ${where}
        GROUP BY TRIM(i.ite_produto)
      )
      SELECT
        s.ite_produto,
        s.pro_nome,
        s.gru_nome,
        s.total,
        s.quantidade,
        s.pedidos,
        ROUND((s.total / t.total * 100)::NUMERIC, 2) AS pct_total
      FROM por_sku s, total_geral t
      ORDER BY s.${orderCol} DESC
      LIMIT 30
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/top-skus]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
