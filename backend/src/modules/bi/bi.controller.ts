import { Request, Response } from 'express';
import { getAllowedIndustries, getLinkedSellerId } from '../../shared/permissions';

// ─── Regras de negócio compartilhadas ─────────────────────────────────────────

/**
 * Cláusula que EXCLUI pedidos cujo vendedor tem `ven_cumpremetas = 'N'`.
 * Pedidos com `ped_vendedor = 0` (sem vendedor / escritório) PASSAM normalmente
 * porque o subselect não retorna match (0 não está em `vendedores`).
 * Regra validada por Hamilton em 2026-05-23: vendedor sem meta não aparece
 * em rankings, KPIs nem no combobox do BI.
 */
const CUMPRE_METAS_CLAUSE = `AND NOT EXISTS (SELECT 1 FROM vendedores v WHERE v.ven_codigo = p.ped_vendedor AND v.ven_cumpremetas = 'N')`;

/**
 * Variante pra sellout (tabela `crm_sellout s` não tem coluna vendedor —
 * vai pelo `clientes.cli_vendedor` da carteira atual do cliente).
 */
const CUMPRE_METAS_CLAUSE_SELLOUT = `AND NOT EXISTS (SELECT 1 FROM clientes cm JOIN vendedores vm ON vm.ven_codigo = cm.cli_vendedor WHERE cm.cli_codigo = s.cli_codigo AND vm.ven_cumpremetas = 'N')`;

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
  venInt: number | null = null,
  dateField = 'p.ped_data',
  industryField = 'p.ped_industria',
  clientField = 'p.ped_cliente',
  vendorField = 'p.ped_vendedor',
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
  if (venInt) {
    params.push(venInt);
    clauses.push(`${vendorField} = $${params.length}`);
  }

  // Exclui vendedor com cumpremetas='N' (regra de BI — Hamilton 2026-05-23)
  // Remove o "AND " inicial porque o join abaixo já adiciona.
  clauses.push(CUMPRE_METAS_CLAUSE.replace(/^AND\s+/, ''));

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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    // Primário = primeiro ano do array (mais recente)
    const anoA = Math.max(...anos);
    const anoB = anos.length === 2 ? Math.min(...anos) : anoA - 1;

    const { where, params } = buildWhere([anoA], meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: whereB, params: paramsB } = buildWhere([anoB], meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
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
        WHERE p.ped_situacao IN ('P','F')
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

// ─── GET /api/bi/comparativo-anual ───────────────────────────────────────────
// Comparativo ano vs ano, mês a mês. VALOR = SUM(ped_totliq) do cabeçalho (padrão da casa,
// igual Mapa/Pedidos); QTD = SUM(ite_quant). Só vendas P/F. Retorna valor E qtd por mês
// dos anos selecionados → o toggle Valor/Qtd é client-side.
export async function comparativoAnualHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const indFilter     = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const cliFilter     = cliInt ? `AND p.ped_cliente = ${cliInt}` : '';
    const venFilter     = venInt ? `AND p.ped_vendedor = ${venInt}` : '';
    const allowedFilter = allowedIndustries ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])` : '';

    const rows: any[] = [];
    for (const ano of anos) {
      const r = await db.query(`
        WITH ped AS (
          SELECT p.ped_pedido,
                 EXTRACT(MONTH FROM p.ped_data)::INTEGER AS mes,
                 p.ped_totliq
          FROM pedidos p
          WHERE p.ped_situacao IN ('P','F')
            AND EXTRACT(YEAR FROM p.ped_data) = $1
            ${indFilter} ${cliFilter} ${venFilter} ${allowedFilter}
        ),
        qtd AS (
          SELECT ped.mes, SUM(i.ite_quant)::NUMERIC AS quantidade
          FROM ped JOIN itens_ped i ON i.ite_pedido = ped.ped_pedido
          GROUP BY ped.mes
        )
        SELECT ped.mes,
               COALESCE(ROUND(SUM(ped.ped_totliq)::NUMERIC, 2), 0)::NUMERIC AS total,
               COALESCE(q.quantidade, 0)::NUMERIC                           AS quantidade,
               COUNT(DISTINCT ped.ped_pedido)::INTEGER                      AS pedidos
        FROM ped
        LEFT JOIN qtd q ON q.mes = ped.mes
        GROUP BY ped.mes, q.quantidade
        ORDER BY ped.mes
      `, [ano]);
      rows.push({ ano, series: r.rows });
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('❌ [BI/comparativo-anual]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/matriz-clientes-anual ───────────────────────────────────────
// Matriz GRUPO/cliente × mês × ano (modelo da Target / planilha VIEMAR). Por padrão agrupa
// por GRUPO DE LOJAS (cli_redeloja) quando rede=1; senão por cliente. VALOR = SUM(ped_totliq);
// QTD = SUM(ite_quant). Só P/F. Retorna, por ano, linhas {grupo_id, grupo, mês, valor, qtd}; o
// frontend pivota nos blocos de ano lado a lado. Escopo pela indústria/vendedor.
export async function matrizClientesAnualHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const rede = req.query.rede === '1' || req.query.agrupar_rede === 'true';
    const indFilter     = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const venFilter     = venInt ? `AND p.ped_vendedor = ${venInt}` : '';
    const allowedFilter = allowedIndustries ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])` : '';

    // Agrupa por GRUPO DE LOJAS (cli_redeloja — modelo da Target) ou por cliente.
    // Sem rede definida, cai no nome reduzido do próprio cliente.
    const keyExpr = rede
      ? `COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, p.ped_cliente::text)`
      : `p.ped_cliente::text`;
    const labelExpr = rede
      ? `COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, p.ped_cliente::text)`
      : `COALESCE(c.cli_nomred, p.ped_cliente::text)`;

    const rows: any[] = [];
    for (const ano of anos) {
      const r = await db.query(`
        WITH ped AS (
          SELECT p.ped_pedido,
                 ${keyExpr}   AS grupo_id,
                 ${labelExpr} AS grupo,
                 EXTRACT(MONTH FROM p.ped_data)::INTEGER AS mes,
                 p.ped_totliq
          FROM pedidos p
          LEFT JOIN clientes c ON c.cli_codigo = p.ped_cliente
          WHERE p.ped_situacao IN ('P','F')
            AND EXTRACT(YEAR FROM p.ped_data) = $1
            ${indFilter} ${venFilter} ${allowedFilter}
        ),
        qtd AS (
          SELECT ped.grupo_id, ped.mes, SUM(i.ite_quant)::NUMERIC AS quantidade
          FROM ped JOIN itens_ped i ON i.ite_pedido = ped.ped_pedido
          GROUP BY ped.grupo_id, ped.mes
        )
        SELECT ped.grupo_id, ped.grupo, ped.mes,
               COALESCE(ROUND(SUM(ped.ped_totliq)::NUMERIC, 2), 0)::NUMERIC AS total,
               COALESCE(q.quantidade, 0)::NUMERIC                           AS quantidade
        FROM ped
        LEFT JOIN qtd q ON q.grupo_id = ped.grupo_id AND q.mes = ped.mes
        GROUP BY ped.grupo_id, ped.grupo, ped.mes, q.quantidade
        ORDER BY ped.grupo, ped.mes
      `, [ano]);
      rows.push({ ano, linhas: r.rows });
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('❌ [BI/matriz-clientes-anual]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── Helper: monta filtros inline para market-share / ranking ────────────────
function buildInlineFilters(
  meses: number[] | null,
  forInt: number | null,
  cliInt: number | null,
  allowedIndustries: number[] | null,
  venInt: number | null = null,
) {
  const parts: string[] = [];
  if (meses?.length) parts.push(`AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])`);
  if (forInt)        parts.push(`AND p.ped_industria = ${forInt}`);
  if (cliInt)        parts.push(`AND p.ped_cliente = ${cliInt}`);
  if (venInt)        parts.push(`AND p.ped_vendedor = ${venInt}`);
  if (allowedIndustries?.length) parts.push(`AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`);
  parts.push(CUMPRE_METAS_CLAUSE);  // exclui vendedor com cumpremetas='N'
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade' : metrica === 'skus' ? 'skus' : 'total';
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, null, allowedIndustries, venInt);

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
        WHERE p.ped_situacao IN ('P','F')
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' || metrica === 'skus' ? 'quantidade' : 'total';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, null, allowedIndustries, venInt);

    const r = await db.query(`
      WITH agg AS (
        SELECT
          p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER        AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER         AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoAtual = Math.max(...anos);
    const anoAnt   = anoAtual - 1;

    // Data de início do período corrente — usada para definir "inéditos" via comparação por data.
    // Se filtrou meses específicos, usa o primeiro mês do filtro; senão, jan/ano-atual.
    const startMonth = meses?.length ? Math.min(...meses) : 1;
    const periodStart = `${anoAtual}-${String(startMonth).padStart(2, '0')}-01`;

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const venFilter   = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH
      atual AS (
        SELECT p.ped_vendedor,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                 AS clientes
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor
      ),
      ant AS (
        SELECT p.ped_vendedor,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                 AS clientes
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $2
          ${mesesFilter} ${forFilter} ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor
      ),
      novos AS (
        SELECT DISTINCT p.ped_vendedor, p.ped_cliente
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
          AND NOT EXISTS (
            SELECT 1 FROM pedidos p2
            WHERE p2.ped_cliente = p.ped_cliente
              AND p2.ped_situacao IN ('P','F')
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          )
      ),
      novos_agg AS (
        SELECT ped_vendedor, COUNT(*)::INTEGER AS cnt FROM novos GROUP BY ped_vendedor
      ),
      reativos AS (
        SELECT DISTINCT p.ped_vendedor, p.ped_cliente
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
          AND EXISTS (
            SELECT 1 FROM pedidos p2
            WHERE p2.ped_cliente = p.ped_cliente
              AND p2.ped_situacao IN ('P','F')
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          )
          AND (
            SELECT (DATE_TRUNC('year', MAKE_DATE($1::INTEGER, 1, 1))::DATE - MAX(p2.ped_data)::DATE)
            FROM pedidos p2
            WHERE p2.ped_cliente = p.ped_cliente
              AND p2.ped_situacao IN ('P','F')
              AND EXTRACT(YEAR FROM p2.ped_data) < $1
          ) >= 60
          AND p.ped_cliente NOT IN (SELECT ped_cliente FROM novos)
      ),
      reativos_agg AS (
        SELECT ped_vendedor, COUNT(*)::INTEGER AS cnt FROM reativos GROUP BY ped_vendedor
      ),
      -- Total de SKUs distintos vendidos pelo vendedor no período atual (sem filtro de "novo")
      skus_total AS (
        SELECT p.ped_vendedor,
          COUNT(DISTINCT i.ite_produto)::INTEGER                AS cnt,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS valor
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor
      ),
      -- SKUs inéditos: produtos que o vendedor nunca vendeu antes do início do período corrente.
      -- Usa comparação por DATA (não por ano) para que produtos vendidos em meses anteriores
      -- do mesmo ano também contem como "já vendidos" (e portanto não-inéditos).
      skus_novos AS (
        SELECT p.ped_vendedor,
          COUNT(DISTINCT i.ite_produto)::INTEGER                 AS cnt,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS valor
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter} ${forFilter} ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
          AND NOT EXISTS (
            SELECT 1 FROM pedidos p2
            JOIN itens_ped i2 ON i2.ite_pedido = p2.ped_pedido
            WHERE p2.ped_vendedor = p.ped_vendedor
              AND p2.ped_situacao IN ('P','F')
              AND i2.ite_produto = i.ite_produto
              AND p2.ped_data < $3::DATE
          )
        GROUP BY p.ped_vendedor
      )
      SELECT
        v.ven_codigo,
        TRIM(v.ven_nome)                                                    AS ven_nome,
        v.ven_imagem                                                        AS ven_imagem,
        COALESCE(a.total,  0)::NUMERIC                                      AS total_value_current,
        COALESCE(b.total,  0)::NUMERIC                                      AS total_value_previous,
        CASE WHEN COALESCE(b.total, 0) > 0
          THEN ROUND((COALESCE(a.total, 0) - b.total) / b.total * 100, 1)
          ELSE NULL END::NUMERIC                                             AS mom_value_percent,
        COALESCE(b.clientes, 0)::INTEGER                                    AS clients_previous,
        COALESCE(n.cnt,    0)::INTEGER                                      AS new_clients,
        COALESCE(r.cnt,    0)::INTEGER                                      AS reactivated_clients,
        COALESCE(st.cnt,   0)::INTEGER                                      AS total_skus_count,
        COALESCE(st.valor, 0)::NUMERIC                                      AS total_skus_value,
        COALESCE(sk.cnt,   0)::INTEGER                                      AS new_skus_count,
        COALESCE(sk.valor, 0)::NUMERIC                                      AS new_skus_value
      FROM vendedores v
      LEFT JOIN atual        a  ON a.ped_vendedor  = v.ven_codigo
      LEFT JOIN ant          b  ON b.ped_vendedor  = v.ven_codigo
      LEFT JOIN novos_agg    n  ON n.ped_vendedor  = v.ven_codigo
      LEFT JOIN reativos_agg r  ON r.ped_vendedor  = v.ven_codigo
      LEFT JOIN skus_total   st ON st.ped_vendedor = v.ven_codigo
      LEFT JOIN skus_novos   sk ON sk.ped_vendedor = v.ven_codigo
      WHERE v.ven_status = 'A'
        AND COALESCE(UPPER(TRIM(v.ven_cumpremetas)), 'S') <> 'N'
        AND (COALESCE(a.total, 0) > 0 OR COALESCE(b.total, 0) > 0)
      ORDER BY COALESCE(a.total, 0) DESC
    `, [anoAtual, anoAnt, periodStart]);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/sellers-performance]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/equipe-cockpit ───────────────────────────────────────────────
// Cockpit do Gestor: por rep — fat mês atual, meta (mês ant), clientes em risco,
// visitas na semana, último pedido, alertas automáticos
export async function equipeCockpitHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const allowFilter = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`
      : '';
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH
      titular_por_cliente AS (
        -- Mapeia cliente → vendedor titular pelo PEDIDO MAIS RECENTE (180d).
        -- A visita é atribuída ao titular da carteira, não a quem fisicamente
        -- visitou — útil quando gerentes/promotores apoiam o rep em campo.
        SELECT DISTINCT ON (p.ped_cliente)
               p.ped_cliente  AS cli_codigo,
               p.ped_vendedor AS ven_codigo
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '180 days'
          AND p.ped_vendedor > 0
        ORDER BY p.ped_cliente, p.ped_data DESC, p.ped_pedido DESC
      ),
      mes_atual AS (
        SELECT p.ped_vendedor,
               COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS fat_atual
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND DATE_TRUNC('month', p.ped_data) = DATE_TRUNC('month', CURRENT_DATE)
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor
      ),
      mes_ant AS (
        SELECT p.ped_vendedor,
               COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0) AS fat_meta
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND DATE_TRUNC('month', p.ped_data) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor
      ),
      ultimo_pedido AS (
        SELECT p.ped_vendedor, MAX(p.ped_data) AS ultima_data
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor
      ),
      visitas_semana AS (
        -- Visitas REAIS (check-in) atribuídas ao titular da carteira do cliente.
        -- DISTINCT em (data, cliente) evita inflar com múltiplos check-ins no
        -- mesmo cliente/dia (ex: gerente acompanhando o rep).
        SELECT tc.ven_codigo,
               COUNT(DISTINCT (rv.vis_datahora::date, rv.vis_cliente_id)) AS visitas
        FROM registro_visitas rv
        JOIN titular_por_cliente tc ON tc.cli_codigo = rv.vis_cliente_id
        WHERE rv.vis_tipo = 'CHECKIN'
          AND rv.vis_datahora >= DATE_TRUNC('week', CURRENT_DATE)
          AND rv.vis_datahora <  DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
        GROUP BY tc.ven_codigo
      ),
      clientes_risco AS (
        SELECT p.ped_vendedor,
               COUNT(DISTINCT p.ped_cliente) AS cnt
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '90 days'
          AND p.ped_data <  CURRENT_DATE - INTERVAL '30 days'
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
          AND NOT EXISTS (
            SELECT 1 FROM pedidos p2
            WHERE p2.ped_vendedor = p.ped_vendedor
              AND p2.ped_cliente  = p.ped_cliente
              AND p2.ped_situacao IN ('P','F')
              AND p2.ped_data >= CURRENT_DATE - INTERVAL '30 days'
          )
        GROUP BY p.ped_vendedor
      ),
      tempo_medio_visita AS (
        -- Duração média das visitas (check-in+check-out pareados no mesmo dia)
        -- nos últimos 30 dias, atribuída ao titular da carteira. Outliers: 1min–4h.
        SELECT tc.ven_codigo,
               ROUND(AVG(EXTRACT(EPOCH FROM (co.vis_datahora - ci.vis_datahora)) / 60.0)::NUMERIC, 1) AS minutos
        FROM registro_visitas ci
        JOIN registro_visitas co
          ON co.vis_promotor_id = ci.vis_promotor_id
         AND co.vis_cliente_id  = ci.vis_cliente_id
         AND co.vis_tipo        = 'CHECKOUT'
         AND co.vis_datahora::date = ci.vis_datahora::date
         AND co.vis_datahora    > ci.vis_datahora
        JOIN titular_por_cliente tc ON tc.cli_codigo = ci.vis_cliente_id
        WHERE ci.vis_tipo = 'CHECKIN'
          AND ci.vis_datahora >= CURRENT_DATE - INTERVAL '30 days'
          AND EXTRACT(EPOCH FROM (co.vis_datahora - ci.vis_datahora)) BETWEEN 60 AND 14400
        GROUP BY tc.ven_codigo
      ),
      conversao_visita AS (
        -- Taxa de conversão: % visitas (últimos 30 dias) à carteira do titular
        -- que geraram pedido (do titular) em até 7 dias após o check-in.
        WITH visitas_30d AS (
          SELECT DISTINCT
            tc.ven_codigo,
            ci.vis_cliente_id,
            ci.vis_datahora::date AS dia_visita
          FROM registro_visitas ci
          JOIN titular_por_cliente tc ON tc.cli_codigo = ci.vis_cliente_id
          WHERE ci.vis_tipo = 'CHECKIN'
            AND ci.vis_datahora >= CURRENT_DATE - INTERVAL '37 days'
            AND ci.vis_datahora <  CURRENT_DATE
        )
        SELECT vd.ven_codigo,
               COUNT(*) AS total_visitas,
               COUNT(*) FILTER (
                 WHERE EXISTS (
                   SELECT 1 FROM pedidos p
                   WHERE p.ped_vendedor  = vd.ven_codigo
                     AND p.ped_cliente   = vd.vis_cliente_id
                     AND p.ped_situacao IN ('P','F')
                     AND p.ped_data BETWEEN vd.dia_visita AND vd.dia_visita + INTERVAL '7 days'
                 )
               ) AS visitas_converteram
        FROM visitas_30d vd
        GROUP BY vd.ven_codigo
      )
      SELECT
        v.ven_codigo,
        v.ven_nome,
        v.ven_imagem,
        COALESCE(ma.fat_atual, 0)        AS fat_mes_atual,
        COALESCE(mb.fat_meta,  0)        AS fat_meta,
        CASE WHEN COALESCE(mb.fat_meta, 0) > 0
             THEN ROUND(COALESCE(ma.fat_atual, 0) * 100.0 / mb.fat_meta, 1)
             ELSE NULL END               AS pct_meta,
        COALESCE(cr.cnt, 0)              AS clientes_risco,
        COALESCE(vs.visitas, 0)          AS visitas_semana,
        up.ultima_data,
        CASE WHEN up.ultima_data IS NOT NULL
             THEN (CURRENT_DATE - up.ultima_data::date)
             ELSE NULL END               AS dias_sem_pedido,
        tmv.minutos                      AS tempo_medio_min,
        COALESCE(cv.total_visitas, 0)    AS total_visitas_30d,
        COALESCE(cv.visitas_converteram, 0) AS visitas_converteram,
        CASE WHEN COALESCE(cv.total_visitas, 0) > 0
             THEN ROUND(cv.visitas_converteram * 100.0 / cv.total_visitas, 1)
             ELSE NULL END               AS taxa_conversao_pct
      FROM vendedores v
      LEFT JOIN mes_atual         ma  ON ma.ped_vendedor = v.ven_codigo
      LEFT JOIN mes_ant           mb  ON mb.ped_vendedor = v.ven_codigo
      LEFT JOIN ultimo_pedido     up  ON up.ped_vendedor = v.ven_codigo
      LEFT JOIN visitas_semana    vs  ON vs.ven_codigo   = v.ven_codigo
      LEFT JOIN clientes_risco    cr  ON cr.ped_vendedor = v.ven_codigo
      LEFT JOIN tempo_medio_visita tmv ON tmv.ven_codigo = v.ven_codigo
      LEFT JOIN conversao_visita  cv  ON cv.ven_codigo   = v.ven_codigo
      WHERE v.ven_status = 'A'
        AND COALESCE(UPPER(TRIM(v.ven_cumpremetas)), 'S') <> 'N'
      ORDER BY COALESCE(ma.fat_atual, 0) DESC
    `);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/equipe-cockpit]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/equipe-cobertura ─────────────────────────────────────────────
// Cobertura de campo: % da carteira ativa que cada vendedor visitou nos últimos 30 dias.
// Carteira ativa = clientes com pedido nos últimos 90 dias (situação P/F).
// Visitados = clientes distintos com check-in (registro_visitas) nos últimos 30 dias.
export async function equipeCoberturaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const allowFilter = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`
      : '';
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH
      carteira_clientes AS (
        -- Clientes ativos do rep (compraram nos últimos 90 dias).
        -- Materializa par (ven_codigo, cli_codigo) pra cruzar com visitas
        -- por CLIENTE — não por quem fisicamente fez o check-in.
        SELECT DISTINCT
               p.ped_vendedor AS ven_codigo,
               p.ped_cliente  AS cli_codigo
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '90 days'
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
      ),
      carteira AS (
        SELECT ven_codigo, COUNT(*) AS carteira_total
        FROM carteira_clientes
        GROUP BY ven_codigo
      ),
      visitados AS (
        -- Cliente da carteira que recebeu check-in real nos últimos 30 dias —
        -- não importa se foi o titular, um gerente ou um promotor que visitou.
        SELECT cc.ven_codigo,
               COUNT(DISTINCT rv.vis_cliente_id) AS visitados
        FROM registro_visitas rv
        JOIN carteira_clientes cc ON cc.cli_codigo = rv.vis_cliente_id
        WHERE rv.vis_tipo = 'CHECKIN'
          AND rv.vis_datahora >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY cc.ven_codigo
      )
      SELECT
        v.ven_codigo,
        v.ven_nome,
        v.ven_imagem,
        COALESCE(c.carteira_total, 0)   AS carteira_total,
        COALESCE(vi.visitados, 0)       AS clientes_visitados,
        CASE WHEN COALESCE(c.carteira_total, 0) > 0
             THEN ROUND(COALESCE(vi.visitados, 0) * 100.0 / c.carteira_total, 1)
             ELSE NULL END              AS cobertura_pct
      FROM vendedores v
      LEFT JOIN carteira  c  ON c.ven_codigo  = v.ven_codigo
      LEFT JOIN visitados vi ON vi.ven_codigo = v.ven_codigo
      WHERE v.ven_status = 'A'
        AND COALESCE(UPPER(TRIM(v.ven_cumpremetas)), 'S') <> 'N'
        AND COALESCE(c.carteira_total, 0) > 0
        ${venInt ? `AND v.ven_codigo = ${venInt}` : ''}
      ORDER BY cobertura_pct DESC NULLS LAST, c.carteira_total DESC
    `);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/equipe-cobertura]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/visitas-sem-retorno ──────────────────────────────────────────
// Leads quentes: clientes com check-in nos últimos 14 dias QUE NÃO geraram
// pedido após a visita. Oportunidades pendentes de conversão.
export async function visitasSemRetornoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;

    const r = await db.query(`
      WITH
      titular_por_cliente AS (
        SELECT DISTINCT ON (p.ped_cliente)
               p.ped_cliente  AS cli_codigo,
               p.ped_vendedor AS ven_codigo
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '180 days'
          AND p.ped_vendedor > 0
        ORDER BY p.ped_cliente, p.ped_data DESC, p.ped_pedido DESC
      ),
      visitas_recentes AS (
        -- Última visita por cliente nos últimos 14 dias, atribuída ao
        -- vendedor TITULAR da carteira (não a quem fisicamente visitou).
        SELECT DISTINCT ON (tc.ven_codigo, rv.vis_cliente_id)
          tc.ven_codigo,
          v.ven_nome,
          rv.vis_cliente_id        AS cli_codigo,
          rv.vis_datahora::date    AS data_visita
        FROM registro_visitas rv
        JOIN titular_por_cliente tc ON tc.cli_codigo = rv.vis_cliente_id
        JOIN vendedores v ON v.ven_codigo = tc.ven_codigo
        WHERE rv.vis_tipo = 'CHECKIN'
          AND rv.vis_datahora >= CURRENT_DATE - INTERVAL '14 days'
          AND COALESCE(UPPER(TRIM(v.ven_cumpremetas)), 'S') <> 'N'
          AND v.ven_status = 'A'
          ${venInt ? `AND tc.ven_codigo = ${venInt}` : ''}
        ORDER BY tc.ven_codigo, rv.vis_cliente_id, rv.vis_datahora DESC
      )
      SELECT
        vr.ven_codigo,
        vr.ven_nome,
        vr.cli_codigo,
        COALESCE(NULLIF(TRIM(c.cli_nomred), ''), NULLIF(TRIM(c.cli_fantasia), ''), c.cli_nome, 'Cliente ' || vr.cli_codigo) AS cli_nome,
        vr.data_visita,
        (CURRENT_DATE - vr.data_visita) AS dias_desde_visita
      FROM visitas_recentes vr
      JOIN clientes c ON c.cli_codigo = vr.cli_codigo
      WHERE NOT EXISTS (
        SELECT 1 FROM pedidos p
        WHERE p.ped_cliente   = vr.cli_codigo
          AND p.ped_vendedor  = vr.ven_codigo
          AND p.ped_situacao IN ('P','F')
          AND p.ped_data >= vr.data_visita
      )
      ORDER BY vr.data_visita ASC, vr.ven_nome
      LIMIT 100
    `);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/visitas-sem-retorno]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/abandono-campo ───────────────────────────────────────────────
// Clientes da carteira ativa (compraram nos últimos 180 dias) que estão SEM
// visita há mais de 60 dias. Diferente de "em risco" no cockpit, o critério
// aqui é AUSÊNCIA DE VISITA, não de pedido — sinaliza buracos no roteiro.
export async function abandonoCampoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const allowFilter = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`
      : '';
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH carteira AS (
        SELECT DISTINCT
          p.ped_vendedor AS ven_codigo,
          p.ped_cliente  AS cli_codigo
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '180 days'
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
      ),
      ultima_visita AS (
        -- Última visita por CLIENTE (independente de quem visitou).
        -- Cruzamos com a carteira do titular pela chave cli_codigo.
        SELECT
          rv.vis_cliente_id AS cli_codigo,
          MAX(rv.vis_datahora::date) AS ultima_data
        FROM registro_visitas rv
        WHERE rv.vis_tipo = 'CHECKIN'
        GROUP BY rv.vis_cliente_id
      ),
      ultimo_pedido_cli AS (
        SELECT
          p.ped_vendedor AS ven_codigo,
          p.ped_cliente  AS cli_codigo,
          MAX(p.ped_data) AS ultimo_pedido
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
        GROUP BY p.ped_vendedor, p.ped_cliente
      )
      SELECT
        c.ven_codigo,
        v.ven_nome,
        c.cli_codigo,
        COALESCE(NULLIF(TRIM(cli.cli_nomred), ''), NULLIF(TRIM(cli.cli_fantasia), ''), cli.cli_nome) AS cli_nome,
        uv.ultima_data                            AS ultima_visita,
        CASE WHEN uv.ultima_data IS NULL
             THEN NULL
             ELSE (CURRENT_DATE - uv.ultima_data)
             END                                  AS dias_sem_visita,
        up.ultimo_pedido,
        CASE WHEN up.ultimo_pedido IS NOT NULL
             THEN (CURRENT_DATE - up.ultimo_pedido::date)
             ELSE NULL END                        AS dias_sem_pedido
      FROM carteira c
      JOIN vendedores   v   ON v.ven_codigo  = c.ven_codigo
      JOIN clientes cli ON cli.cli_codigo = c.cli_codigo
      LEFT JOIN ultima_visita      uv ON uv.cli_codigo = c.cli_codigo
      LEFT JOIN ultimo_pedido_cli  up ON up.ven_codigo = c.ven_codigo AND up.cli_codigo = c.cli_codigo
      WHERE COALESCE(UPPER(TRIM(v.ven_cumpremetas)), 'S') <> 'N'
        AND (uv.ultima_data IS NULL OR uv.ultima_data < CURRENT_DATE - INTERVAL '60 days')
      ORDER BY
        CASE WHEN uv.ultima_data IS NULL THEN 0 ELSE 1 END,
        uv.ultima_data ASC NULLS FIRST,
        up.ultimo_pedido DESC
      LIMIT 150
    `);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/abandono-campo]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/heatmap-visitas-pedidos ──────────────────────────────────────
// Matriz semanal (últimos 14 dias) por vendedor × dia, com contagem
// de visitas (check-ins distintos por cliente/dia) e pedidos.
export async function heatmapVisitasPedidosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const allowFilter = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])`
      : '';
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH dias AS (
        SELECT (CURRENT_DATE - i)::date AS dia
        FROM generate_series(0, 13) AS g(i)
      ),
      vendedores_ativos AS (
        SELECT ven_codigo, ven_nome
        FROM vendedores
        WHERE ven_status = 'A'
          AND COALESCE(UPPER(TRIM(ven_cumpremetas)), 'S') <> 'N'
          ${venInt ? `AND ven_codigo = ${venInt}` : ''}
      ),
      titular_por_cliente AS (
        SELECT DISTINCT ON (p.ped_cliente)
               p.ped_cliente  AS cli_codigo,
               p.ped_vendedor AS ven_codigo
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '180 days'
          AND p.ped_vendedor > 0
        ORDER BY p.ped_cliente, p.ped_data DESC, p.ped_pedido DESC
      ),
      visitas_dia AS (
        -- Visitas atribuídas ao titular da carteira do cliente.
        SELECT tc.ven_codigo,
               rv.vis_datahora::date AS dia,
               COUNT(DISTINCT (rv.vis_cliente_id, rv.vis_datahora::date)) AS qtd_visitas
        FROM registro_visitas rv
        JOIN titular_por_cliente tc ON tc.cli_codigo = rv.vis_cliente_id
        JOIN vendedores_ativos v2   ON v2.ven_codigo = tc.ven_codigo
        WHERE rv.vis_tipo = 'CHECKIN'
          AND rv.vis_datahora >= CURRENT_DATE - INTERVAL '13 days'
          AND rv.vis_datahora <  CURRENT_DATE + INTERVAL '1 day'
        GROUP BY tc.ven_codigo, rv.vis_datahora::date
      ),
      pedidos_dia AS (
        SELECT p.ped_vendedor AS ven_codigo,
               p.ped_data::date AS dia,
               COUNT(DISTINCT p.ped_pedido) AS qtd_pedidos
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND p.ped_data >= CURRENT_DATE - INTERVAL '13 days'
          AND p.ped_data <  CURRENT_DATE + INTERVAL '1 day'
          ${allowFilter} ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_vendedor, p.ped_data::date
      )
      SELECT
        v.ven_codigo,
        v.ven_nome,
        d.dia,
        EXTRACT(ISODOW FROM d.dia)::INT AS dow,
        COALESCE(vd.qtd_visitas, 0) AS qtd_visitas,
        COALESCE(pd.qtd_pedidos, 0) AS qtd_pedidos
      FROM vendedores_ativos v
      CROSS JOIN dias d
      LEFT JOIN visitas_dia vd ON vd.ven_codigo = v.ven_codigo AND vd.dia = d.dia
      LEFT JOIN pedidos_dia pd ON pd.ven_codigo = v.ven_codigo AND pd.dia = d.dia
      WHERE EXISTS (
        SELECT 1 FROM visitas_dia vx WHERE vx.ven_codigo = v.ven_codigo
        UNION ALL
        SELECT 1 FROM pedidos_dia px WHERE px.ven_codigo = v.ven_codigo
      )
      ORDER BY v.ven_nome, d.dia
    `);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/heatmap-visitas-pedidos]', error.message);
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
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
          AND p.ped_situacao IN ('P','F')
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoAtual = Math.max(...anos);
    const anoMeta  = anoAtual - 1; // baseline = ano anterior

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter  = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const venFilter   = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH atual AS (
        SELECT p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER        AS clientes,
          COUNT(DISTINCT p.ped_pedido)::INTEGER          AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $1
          ${mesesFilter}
          ${allowFilter}
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
        GROUP BY p.ped_industria
      ),
      meta AS (
        SELECT p.ped_industria,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = $2
          ${mesesFilter}
          ${allowFilter}
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter  = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter  = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const venFilter    = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    const r = await db.query(`
      WITH periodo AS (
        SELECT COUNT(DISTINCT p.ped_cliente)::INTEGER AS total_clientes
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${allowFilter}
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
      ),
      por_ind AS (
        SELECT
          p.ped_industria,
          COUNT(DISTINCT p.ped_cliente)::INTEGER               AS clientes,
          COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC          AS total,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                 AS pedidos
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE p.ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
          ${mesesFilter}
          ${allowFilter}
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const venFilter   = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

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
      WHERE p.ped_situacao IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
        ${mesesFilter}
        ${allowFilter}
        ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const venFilter   = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

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
      WHERE p.ped_situacao IN ('P','F')
        AND p.ped_data >= CURRENT_DATE - INTERVAL '60 days'
        AND f.for_nomered IS NOT NULL
        ${allowFilter}
        ${forFilter}
        ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const mesesFilter = meses?.length ? `AND EXTRACT(MONTH FROM p.ped_data) = ANY(ARRAY[${meses.join(',')}]::int[])` : '';
    const allowFilter = allowedIndustries?.length ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}]::int[])` : '';
    const forFilter   = forInt ? `AND p.ped_industria = ${forInt}` : '';
    const venFilter   = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

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
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
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
        WHERE p.ped_situacao IN ('P','F')
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade' : metrica === 'skus' ? 'skus' : 'total';
    const agruparRede = req.query.agrupar_rede === 'true';
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries, venInt);

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
        WHERE p.ped_situacao IN ('P','F')
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    // Filtros SEM meses — CTE precisa do ano inteiro pra calcular a média trimestral.
    // O recorte por mês é aplicado no SELECT da CTE `atual` via $2.
    const extraFilters = buildInlineFilters(null, forInt, cliInt, allowedIndustries, venInt);

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
        WHERE p.ped_situacao IN ('P','F')
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries, venInt);

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
        WHERE p.ped_situacao IN ('P','F')
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    // Filtros SEM meses na CTE base — LAG() precisa enxergar TODOS os pedidos
    // do(s) ano(s) pra calcular data_ant corretamente. Se aplicarmos o filtro de
    // meses aqui, um pedido em Mar não consegue ver seu antecessor em Fev e o
    // gap fica errado. O recorte por mês fica DEPOIS, no filtro do gaps.
    const extraFilters = buildInlineFilters(null, forInt, cliInt, allowedIndustries, venInt);
    const mesesFilterGap = meses?.length
      ? `AND mes = ANY(ARRAY[${meses.join(',')}]::int[])`
      : '';

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
          ${mesesFilterGap}
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
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

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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

// ─── GET /api/bi/vendas-estados ────────────────────────────────────────────────
// Faturamento, quantidade e SKUs distintos agrupados por UF do cliente.
// Usado pelo gráfico de pizza "Vendas por Estado" na aba Visão Geral.
// Métricas alternáveis no front via `visao` (financeiro/volume/skus) — o backend
// devolve as 3, o front escolhe qual dimensiona o pie.
export async function vendasEstadosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

    const r = await db.query(`
      SELECT
        UPPER(TRIM(c.cli_uf))                                          AS uf,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC AS total,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC                         AS quantidade,
        COUNT(DISTINCT i.ite_produto)::INTEGER                         AS skus,
        COUNT(DISTINCT p.ped_pedido)::INTEGER                          AS pedidos,
        COUNT(DISTINCT p.ped_cliente)::INTEGER                         AS clientes
      FROM itens_ped i
      JOIN pedidos  p ON p.ped_pedido = i.ite_pedido
      JOIN clientes c ON c.cli_codigo = p.ped_cliente
      WHERE c.cli_uf IS NOT NULL AND TRIM(c.cli_uf) <> ''
        AND ${where}
      GROUP BY UPPER(TRIM(c.cli_uf))
      ORDER BY total DESC
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/vendas-estados]', error.message);
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoA = Math.max(...anos);
    const anoB = anos.length === 2 ? Math.min(...anos) : anoA - 1;

    const { where: whereA, params: paramsA } = buildWhere([anoA], meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: whereB, params: paramsB } = buildWhere([anoB], meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
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
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    // Matrix mensal SEMPRE mostra os 12 meses do ano (independente do filtro de
    // meses). O clique em mês no frontend serve só pra destacar/filtrar OUTROS
    // cards — a matriz em si é o "panorama anual" e precisa do ano inteiro.
    const { where, params } = buildWhere(anos, null, forInt, cliInt, allowedIndustries, venInt);

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

// ─── GET /api/bi/stats-3anos-industria ────────────────────────────────────────
// Comparativo 3 anos (base, base-1, base-2) por indústria.
// Base = MAX(anos do filtro). Respeita meses (mesmo recorte nos 3 anos), forInt,
// cliInt, venInt, allowedIndustries e cumpremetas. Usado pelo card "3 Anos" do BI.
export async function stats3AnosIndustriaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoBase = Math.max(...anos);
    const janela = [anoBase - 2, anoBase - 1, anoBase];

    // Monta filtros adicionais inline (sem anos — já estamos fixando a janela de 3)
    const extraFilters = buildInlineFilters(meses, forInt, cliInt, allowedIndustries, venInt);

    const r = await db.query(`
      SELECT
        TRIM(f.for_nomered)                                                AS industria,
        p.ped_industria                                                    AS industria_codigo,
        EXTRACT(YEAR FROM p.ped_data)::INTEGER                             AS ano,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)::NUMERIC    AS total,
        COALESCE(SUM(i.ite_quant), 0)::NUMERIC                            AS quantidade,
        COUNT(DISTINCT p.ped_cliente)::INTEGER                             AS clientes,
        COUNT(DISTINCT p.ped_pedido)::INTEGER                              AS pedidos
      FROM itens_ped i
      JOIN pedidos     p ON p.ped_pedido = i.ite_pedido
      JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE p.ped_situacao IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) = ANY($1::int[])
        ${extraFilters}
      GROUP BY f.for_nomered, p.ped_industria, EXTRACT(YEAR FROM p.ped_data)
      ORDER BY p.ped_industria, ano
    `, [janela]);

    res.json({ success: true, data: r.rows, anos: janela });
  } catch (error: any) {
    console.error('❌ [BI/stats-3anos-industria]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-clientes-yoy ───────────────────────────────────────────
// Comparativo anual de clientes: classifica cada cliente em
//   novo       — comprou no ano corrente, não no anterior
//   perdido    — comprou no anterior, não no corrente
//   crescendo  — comprou nos 2, valor corrente > 105% do anterior
//   em_queda   — comprou nos 2, valor corrente < 95% do anterior
//   estavel    — comprou nos 2, dentro da faixa 95-105%
// Respeita filtros padrão; o filtro `meses` é aplicado nos DOIS anos (recorte
// equivalente — ex: "Abr/2025 vs Abr/2026"). `anos` define o corrente (MAX).
export async function statsClientesYoyHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const anoCurr = Math.max(...anos);
    const anoPrev = anoCurr - 1;

    const { where: whereCurr, params: paramsCurr } = buildWhere([anoCurr], meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: wherePrev, params: paramsPrev } = buildWhere([anoPrev], meses, forInt, cliInt, allowedIndustries, venInt);

    // Re-numera os placeholders do segundo conjunto pra empilhar tudo numa query só
    const offset = paramsCurr.length;
    const wherePrevShifted = wherePrev.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
    const params = [...paramsCurr, ...paramsPrev];

    const r = await db.query(`
      WITH curr AS (
        SELECT p.ped_cliente,
               COALESCE(SUM(i.ite_totliquido), 0)::NUMERIC AS valor,
               COALESCE(SUM(i.ite_quant), 0)::NUMERIC      AS qtd,
               COUNT(DISTINCT p.ped_pedido)::INTEGER       AS pedidos
        FROM itens_ped i JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${whereCurr}
        GROUP BY p.ped_cliente
      ),
      prev AS (
        SELECT p.ped_cliente,
               COALESCE(SUM(i.ite_totliquido), 0)::NUMERIC AS valor,
               COALESCE(SUM(i.ite_quant), 0)::NUMERIC      AS qtd,
               COUNT(DISTINCT p.ped_pedido)::INTEGER       AS pedidos
        FROM itens_ped i JOIN pedidos p ON p.ped_pedido = i.ite_pedido
        WHERE ${wherePrevShifted}
        GROUP BY p.ped_cliente
      ),
      yoy AS (
        SELECT
          COALESCE(c.ped_cliente, pr.ped_cliente)              AS cli_codigo,
          COALESCE(pr.valor, 0)::NUMERIC                       AS valor_prev,
          COALESCE(c.valor,  0)::NUMERIC                       AS valor_curr,
          COALESCE(pr.qtd,   0)::NUMERIC                       AS qtd_prev,
          COALESCE(c.qtd,    0)::NUMERIC                       AS qtd_curr,
          COALESCE(pr.pedidos, 0)::INTEGER                     AS pedidos_prev,
          COALESCE(c.pedidos,  0)::INTEGER                     AS pedidos_curr
        FROM curr c
        FULL OUTER JOIN prev pr ON pr.ped_cliente = c.ped_cliente
      )
      SELECT
        y.cli_codigo,
        TRIM(cli.cli_nomred) AS nome,
        y.valor_prev, y.valor_curr, y.qtd_prev, y.qtd_curr, y.pedidos_prev, y.pedidos_curr,
        CASE
          WHEN y.valor_prev = 0 AND y.valor_curr > 0 THEN 'novo'
          WHEN y.valor_prev > 0 AND y.valor_curr = 0 THEN 'perdido'
          WHEN y.valor_curr > y.valor_prev * 1.05 THEN 'crescendo'
          WHEN y.valor_curr < y.valor_prev * 0.95 THEN 'em_queda'
          ELSE 'estavel'
        END AS status,
        CASE
          WHEN y.valor_prev = 0 THEN NULL
          ELSE ROUND(((y.valor_curr - y.valor_prev) / y.valor_prev * 100)::NUMERIC, 1)
        END AS variacao_pct,
        (y.valor_curr - y.valor_prev)::NUMERIC AS delta_abs
      FROM yoy y
      JOIN clientes cli ON cli.cli_codigo = y.cli_codigo
      WHERE cli.cli_tipopes = 'A'
        AND cli.cli_nomred IS NOT NULL
      ORDER BY ABS(y.valor_curr - y.valor_prev) DESC
      LIMIT 100
    `, params);

    // Resumo agregado por status
    const resumo = { novo: 0, perdido: 0, crescendo: 0, em_queda: 0, estavel: 0 };
    r.rows.forEach((row: any) => { if (resumo[row.status as keyof typeof resumo] !== undefined) resumo[row.status as keyof typeof resumo]++; });

    res.json({ success: true, data: r.rows, anoCurr, anoPrev, resumo });
  } catch (error: any) {
    console.error('❌ [BI/stats-clientes-yoy]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/bi/stats-cross-sell ─────────────────────────────────────────────
// Matriz Cliente × Indústria do recorte — visualiza lacunas/oportunidades de
// cross-sell. Cliente que compra de várias indústrias mas falta UMA = oportunidade
// óbvia ("o cara já compra de 7 das 10 maiores, falta convencer ele em 3").
//
// Retorna até 25 top clientes (linhas) × 12 top indústrias (colunas) do recorte,
// + valor de cada célula + total cliente + total indústria + coverage por cliente.
export async function statsCrossSellHandler(req: Request, res: Response): Promise<void> {
  try {
    const db       = req.db!;
    const userId   = getUserId(req);
    const anos     = parseAnos(req.query.anos as string);
    const meses    = parseMeses(req.query.meses as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const topClientes   = Math.min(50, Math.max(5, parseInt(String(req.query.top_clientes   || '25')) || 25));
    const topIndustrias = Math.min(20, Math.max(3, parseInt(String(req.query.top_industrias || '12')) || 12));

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
    params.push(topClientes, topIndustrias);
    const pTC = params.length - 1;
    const pTI = params.length;

    const r = await db.query(`
      WITH base AS (
        SELECT
          p.ped_cliente,
          p.ped_industria,
          COALESCE(SUM(i.ite_totliquido), 0)::NUMERIC AS total
        FROM itens_ped i
        JOIN pedidos   p ON p.ped_pedido = i.ite_pedido
        WHERE ${where}
        GROUP BY p.ped_cliente, p.ped_industria
      ),
      top_cli AS (
        SELECT b.ped_cliente, TRIM(c.cli_nomred) AS nome, SUM(b.total)::NUMERIC AS total
        FROM base b
        JOIN clientes c ON c.cli_codigo = b.ped_cliente
        WHERE c.cli_tipopes = 'A'
        GROUP BY b.ped_cliente, c.cli_nomred
        ORDER BY total DESC
        LIMIT $${pTC}
      ),
      top_ind AS (
        SELECT b.ped_industria, TRIM(f.for_nomered) AS nome, SUM(b.total)::NUMERIC AS total
        FROM base b
        JOIN fornecedores f ON f.for_codigo = b.ped_industria
        GROUP BY b.ped_industria, f.for_nomered
        ORDER BY total DESC
        LIMIT $${pTI}
      )
      SELECT
        tc.ped_cliente   AS cli_codigo,
        tc.nome          AS cli_nome,
        tc.total         AS cli_total,
        ti.ped_industria AS for_codigo,
        ti.nome          AS for_nome,
        ti.total         AS for_total,
        COALESCE(b.total, 0)::NUMERIC AS celula_total
      FROM top_cli tc
      CROSS JOIN top_ind ti
      LEFT JOIN base b
        ON b.ped_cliente = tc.ped_cliente
       AND b.ped_industria = ti.ped_industria
      ORDER BY tc.total DESC, ti.total DESC
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (error: any) {
    console.error('❌ [BI/stats-cross-sell]', error.message);
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const curvaFilter = req.query.curva ? String(req.query.curva).toUpperCase() : null;
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
    const effectiveLimit = curvaFilter ? 100 : limit;

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
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
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

    // Clientes do período atual
    const qAtual = await db.query(`
      SELECT DISTINCT p.ped_cliente
      FROM pedidos p
      WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) = ${anoAtual}
        AND EXTRACT(MONTH FROM p.ped_data) IN (${mesesTrimAtual.join(',')})
        ${indClause} ${allowedClause} ${venFilter} ${CUMPRE_METAS_CLAUSE}
    `);
    const clientesAtual = new Set(qAtual.rows.map((r: any) => r.ped_cliente));

    // Clientes do período anterior
    const qAnterior = await db.query(`
      SELECT DISTINCT p.ped_cliente
      FROM pedidos p
      WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) = ${anoAnterior}
        AND EXTRACT(MONTH FROM p.ped_data) IN (${mesesTrimAnterior.join(',')})
        ${indClause} ${allowedClause} ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
        ${indClause} ${allowedClause} ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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
    const { where: whereSp, params: paramsSp } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const limit    = parseInt(String(req.query.limit || 30));

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
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
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const limit    = parseInt(String(req.query.limit || 50));
    const metrica  = String(req.query.metrica || 'financeiro');

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const allowedClause = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])`
      : '';
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

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
            ${venFilter.replace(/p\./g, '')}
            AND NOT EXISTS (SELECT 1 FROM vendedores v WHERE v.ven_codigo = pedidos.ped_vendedor AND v.ven_cumpremetas = 'N')
        ) sub
        WHERE sub.cli NOT IN (
          SELECT DISTINCT ped_cliente FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data > CURRENT_DATE - INTERVAL '60 days'
            ${venFilter.replace(/p\./g, '')}
            AND NOT EXISTS (SELECT 1 FROM vendedores v WHERE v.ven_codigo = pedidos.ped_vendedor AND v.ven_cumpremetas = 'N')
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
            ${venFilter} ${CUMPRE_METAS_CLAUSE}
        ),
        anterior AS (
          SELECT COALESCE(SUM(i.ite_totliquido), 0) AS total
          FROM pedidos p
          JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
            AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND p.ped_data <  DATE_TRUNC('month', CURRENT_DATE)
            ${allowedClause}
            ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
            ${venFilter} ${CUMPRE_METAS_CLAUSE}
          EXCEPT
          SELECT DISTINCT p.ped_industria
          FROM pedidos p
          WHERE UPPER(TRIM(p.ped_situacao)) IN ('P','F')
            AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE)
            ${allowedClause}
            ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const allowedClause = allowedIndustries?.length
      ? `AND p.ped_industria = ANY(ARRAY[${allowedIndustries.join(',')}])`
      : '';
    const venFilter = venInt ? `AND p.ped_vendedor = ${venInt}` : '';

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
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
        WHERE f.for_codigo IN (
          SELECT DISTINCT ped_industria FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND ped_data <  DATE_TRUNC('month', CURRENT_DATE)
            ${venFilter.replace(/p\./g, '')}
            AND NOT EXISTS (SELECT 1 FROM vendedores v WHERE v.ven_codigo = pedidos.ped_vendedor AND v.ven_cumpremetas = 'N')
          EXCEPT
          SELECT DISTINCT ped_industria FROM pedidos
          WHERE UPPER(TRIM(ped_situacao)) IN ('P','F')
            AND ped_data >= DATE_TRUNC('month', CURRENT_DATE)
            ${venFilter.replace(/p\./g, '')}
            AND NOT EXISTS (SELECT 1 FROM vendedores v WHERE v.ven_codigo = pedidos.ped_vendedor AND v.ven_cumpremetas = 'N')
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
          ${venFilter} ${CUMPRE_METAS_CLAUSE}
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
// Aceita ?visao= 'financeiro' (default, R$) | 'volume' (qtd unidades) | 'skus' (distintos)
export async function drilldownHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const nivel    = parseInt(String(req.query.nivel  || 0));
    const anos     = parseAnos(req.query.anos as string);
    const forInt   = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const visao    = (String(req.query.visao || 'financeiro').toLowerCase());

    // Expressão de "total" conforme a métrica escolhida.
    // No nível 4 (já é um SKU específico) 'skus' não faz sentido — fallback volume.
    function metricExpr(currentLevel: number): string {
      if (visao === 'volume') return 'COALESCE(SUM(i.ite_quant), 0)::NUMERIC';
      if (visao === 'skus')   {
        return currentLevel === 4
          ? 'COALESCE(SUM(i.ite_quant), 0)::NUMERIC'   // no SKU individual cai pra volume
          : 'COUNT(DISTINCT TRIM(i.ite_produto))::NUMERIC';
      }
      return 'COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)';
    }
    // meses: global filter from PeriodSelector (comma-separated, e.g. "4" or "1,2,3")
    const mesesRaw    = req.query.meses as string | undefined;
    const mesesGlobal = mesesRaw
      ? mesesRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12)
      : [];
    // mes: single month from the drill-down stack (clicking a bar at nivel 1)
    const mesInt   = req.query.mes        ? parseInt(String(req.query.mes))        : null;
    const cliInt   = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt   = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const grupoInt = req.query.grupo      ? parseInt(String(req.query.grupo))      : null;
    const redeStr  = req.query.cli_redeloja ? String(req.query.cli_redeloja).trim() : null;
    const agruparRede = String(req.query.agrupar_rede || '') === 'true';

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
    if (mesesGlobal.length) {
      clauses.push(`EXTRACT(MONTH FROM p.ped_data) IN (${mesesGlobal.join(',')})`);
    }
    if (mesInt) {
      clauses.push(`EXTRACT(MONTH FROM p.ped_data) = ${mesInt}`);
    }
    if (cliInt) {
      params.push(cliInt);
      clauses.push(`p.ped_cliente = $${params.length}`);
    }
    // Filtro alternativo por rede (quando o drill veio de uma rede agrupada
    // no nivel 2). Usa JOIN com clientes pra resolver cli_redeloja.
    if (redeStr) {
      params.push(redeStr);
      clauses.push(`EXISTS (SELECT 1 FROM clientes c2 WHERE c2.cli_codigo = p.ped_cliente AND TRIM(UPPER(COALESCE(c2.cli_redeloja, ''))) = TRIM(UPPER($${params.length}::varchar)))`);
    }

    const where = clauses.join(' AND ');

    let rows: any[];

    if (nivel === 0) {
      const r = await db.query(`
        SELECT
          f.for_codigo                                                      AS codigo,
          COALESCE(f.for_nomered, f.for_nome)                              AS nome,
          ${metricExpr(0)}                                                  AS total,
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
          ${metricExpr(1)}                                                  AS total,
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
      if (agruparRede) {
        // Modo "agrupar por rede": clientes com cli_redeloja preenchido viram
        // 1 linha (rede), os sem rede continuam individuais. Útil pra ver
        // "Mix Auto" como soma de todas as lojas Mix Auto.
        const r = await db.query(`
          SELECT
            -- codigo = rede string OU cli_codigo (sem rede)
            CASE
              WHEN TRIM(COALESCE(c.cli_redeloja,'')) <> ''
                THEN TRIM(UPPER(c.cli_redeloja))
              ELSE 'CLI:' || c.cli_codigo::text
            END                                                             AS codigo,
            -- nome = rede com badge ou nome cliente individual
            CASE
              WHEN TRIM(COALESCE(c.cli_redeloja,'')) <> ''
                THEN '🏢 ' || TRIM(c.cli_redeloja)
              ELSE COALESCE(c.cli_nomred, c.cli_nome)
            END                                                             AS nome,
            -- rede separada (frontend usa pra filtrar nos próximos níveis)
            CASE
              WHEN TRIM(COALESCE(c.cli_redeloja,'')) <> ''
                THEN TRIM(c.cli_redeloja)
              ELSE NULL
            END                                                             AS cli_redeloja,
            ${metricExpr(2)}                                                 AS total,
            COUNT(DISTINCT p.ped_pedido)::INTEGER                            AS pedidos,
            COUNT(DISTINCT c.cli_codigo)::INTEGER                            AS clientes
          FROM pedidos p
          JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          JOIN clientes c ON c.cli_codigo = p.ped_cliente
          WHERE ${where}
          GROUP BY
            CASE
              WHEN TRIM(COALESCE(c.cli_redeloja,'')) <> '' THEN TRIM(UPPER(c.cli_redeloja))
              ELSE 'CLI:' || c.cli_codigo::text
            END,
            CASE
              WHEN TRIM(COALESCE(c.cli_redeloja,'')) <> '' THEN '🏢 ' || TRIM(c.cli_redeloja)
              ELSE COALESCE(c.cli_nomred, c.cli_nome)
            END,
            CASE
              WHEN TRIM(COALESCE(c.cli_redeloja,'')) <> '' THEN TRIM(c.cli_redeloja)
              ELSE NULL
            END
          ORDER BY total DESC
          LIMIT 30
        `, params);
        rows = r.rows;
      } else {
        const r = await db.query(`
          SELECT
            c.cli_codigo                                                      AS codigo,
            COALESCE(c.cli_nomred, c.cli_nome)                              AS nome,
            ${metricExpr(2)}                                                  AS total,
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
      }
    } else if (nivel === 3) {
      // nivel 3 — Famílias/Grupos de produto
      const r = await db.query(`
        SELECT
          COALESCE(g.gru_codigo, -1)::INTEGER                               AS codigo,
          COALESCE(NULLIF(TRIM(g.gru_nome), ''), '(Sem Família)')           AS nome,
          ${metricExpr(3)}                                                  AS total,
          COUNT(DISTINCT TRIM(i.ite_produto))::INTEGER                      AS quantidade,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                             AS pedidos
        FROM pedidos p
        JOIN itens_ped i  ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                              AND cp.pro_industria = p.ped_industria
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
          ${metricExpr(4)}                                                  AS total,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC                          AS quantidade
        FROM pedidos p
        JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        LEFT JOIN cad_prod cp ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto)
                              AND cp.pro_industria = p.ped_industria
        WHERE ${where}
        ${grupoClause}
        GROUP BY i.ite_produto
        ORDER BY total DESC
        LIMIT 30
      `, params);
      rows = r.rows;
    }

    res.json({ success: true, nivel, visao, data: rows });
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
    const venInt  = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);
    const metrica = String(req.query.metrica ?? 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade_current' : metrica === 'skus' ? 'skus_count' : 'total_current';

    const anoA = Math.max(...anos);
    const anoB = anos.length === 2 ? Math.min(...anos) : anoA - 1;

    const { where, params }                  = buildWhere([anoA], meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: whereB, params: paramsB } = buildWhere([anoB], meses, forInt, cliInt, allowedIndustries, venInt);

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
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const metrica  = String(req.query.metrica || 'financeiro');
    const orderCol = metrica === 'volume' ? 'quantidade' : 'total';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where, params } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);

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

// ─── Sell In/Out — helpers internos ──────────────────────────────────────────

function calcPeriodDays(anos: number[], meses: number[] | null): number {
  if (meses?.length) {
    return anos.reduce((total, ano) =>
      total + meses.reduce((t, mes) => t + new Date(ano, mes, 0).getDate(), 0), 0);
  }
  return anos.reduce((total, ano) => {
    const leap = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return total + (leap ? 366 : 365);
  }, 0);
}

function buildSellOutConditions(
  anos: number[], meses: number[] | null,
  forInt: number | null, cliInt: number | null,
  allowedIndustries: number[] | null,
  venInt: number | null = null,
): { where: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  let idx = 1;

  clauses.push(`EXTRACT(YEAR FROM s.periodo::date) IN (${anos.join(',')})`);
  if (meses?.length) clauses.push(`EXTRACT(MONTH FROM s.periodo::date) IN (${meses.join(',')})`);
  if (forInt)               { params.push(forInt);              clauses.push(`s.for_codigo = $${idx++}`); }
  if (allowedIndustries?.length) { params.push(allowedIndustries); clauses.push(`s.for_codigo = ANY($${idx++}::int[])`); }
  if (cliInt)               { params.push(cliInt);              clauses.push(`s.cli_codigo = $${idx++}`); }
  // crm_sellout não tem coluna vendedor — filtra pela carteira do rep via EXISTS em clientes
  if (venInt) {
    params.push(venInt);
    clauses.push(`EXISTS (SELECT 1 FROM clientes c WHERE c.cli_codigo = s.cli_codigo AND c.cli_vendedor = $${idx++})`);
  }

  // Exclui sellout cujo cliente está na carteira de vendedor com cumpremetas='N'
  clauses.push(CUMPRE_METAS_CLAUSE_SELLOUT.replace(/^AND\s+/, ''));

  return { where: clauses.length ? clauses.join(' AND ') : '1=1', params };
}

function getPrevPeriod(anos: number[], meses: number[] | null): { anos: number[]; meses: number[] | null } {
  if (meses?.length === 1) {
    const m = meses[0];
    if (m > 1) return { anos, meses: [m - 1] };
    return { anos: anos.map(a => a - 1), meses: [12] };
  }
  return { anos: anos.map(a => a - 1), meses };
}

// ─── GET /api/bi/sell-in-out/kpis ─────────────────────────────────────────────
export async function sellInOutKpisHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where: siWhere, params: siParams } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: soWhere, params: soParams } = buildSellOutConditions(anos, meses, forInt, cliInt, allowedIndustries, venInt);
    const prev = getPrevPeriod(anos, meses);
    const { where: soPrevWhere, params: soPrevParams } = buildSellOutConditions(prev.anos, prev.meses, forInt, cliInt, allowedIndustries, venInt);

    const perioDias = calcPeriodDays(anos, meses);

    const [siR, soR, prevR] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(i.ite_totliquido), 0)::NUMERIC AS valor,
          COALESCE(SUM(CASE WHEN p.ped_situacao = 'F' THEN i.ite_totliquido ELSE 0 END), 0)::NUMERIC AS valor_fat,
          COALESCE(SUM(i.ite_quant), 0)::NUMERIC      AS qtd,
          COUNT(DISTINCT p.ped_cliente)::INTEGER       AS clientes
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        WHERE ${siWhere}
      `, siParams),
      db.query(`
        SELECT
          COALESCE(SUM(s.valor), 0)::NUMERIC           AS valor,
          COALESCE(SUM(s.quantidade), 0)::NUMERIC      AS qtd,
          COUNT(DISTINCT s.cli_codigo)::INTEGER        AS clientes
        FROM crm_sellout s
        WHERE ${soWhere}
      `, soParams),
      db.query(`
        SELECT COALESCE(SUM(s.valor), 0)::NUMERIC AS valor
        FROM crm_sellout s WHERE ${soPrevWhere}
      `, soPrevParams),
    ]);

    const siValor   = parseFloat(siR.rows[0].valor)     || 0;
    const siFatValor= parseFloat(siR.rows[0].valor_fat) || 0;
    const soValor   = parseFloat(soR.rows[0].valor)     || 0;
    const prevValor = parseFloat(prevR.rows[0].valor)   || 0;

    res.json({ success: true, data: {
      si_valor:          siValor,
      si_qtd:            parseFloat(siR.rows[0].qtd) || 0,
      si_clientes:       siR.rows[0].clientes,
      so_valor:          soValor,
      so_qtd:            parseFloat(soR.rows[0].qtd) || 0,
      so_clientes:       soR.rows[0].clientes,
      sell_through_pct:  siValor   > 0 ? parseFloat(((soValor   / siValor)   * 100).toFixed(1)) : null,
      so_var_pct:        prevValor > 0 ? parseFloat((((soValor - prevValor) / prevValor) * 100).toFixed(1)) : null,
      // novos campos
      si_faturado:       siFatValor,
      fulfillment_pct:   siValor   > 0 ? parseFloat(((siFatValor / siValor)   * 100).toFixed(1)) : null,
      fulfillment_gap:   siValor - siFatValor,
      estoque_gap:       siFatValor - soValor,
      periodo_dias:      perioDias,
      si_media_diaria:   perioDias > 0 ? Math.round(siValor / perioDias)  : null,
      so_media_diaria:   perioDias > 0 ? Math.round(soValor / perioDias)  : null,
    }});
  } catch (err: any) {
    console.error('❌ [BI/sell-in-out/kpis]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/bi/sell-in-out/ranking ──────────────────────────────────────────
export async function sellInOutRankingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const agruparRede = req.query.agrupar_rede === 'true';
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where: siWhere, params: siParams } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: soWhere, params: soParams } = buildSellOutConditions(anos, meses, forInt, cliInt, allowedIndustries, venInt);

    const nomeExpr = agruparRede
      ? `COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, c.cli_nome, 'EXCLUÍDO')`
      : `COALESCE(c.cli_nomred, c.cli_nome, 'EXCLUÍDO')`;
    const groupExpr = agruparRede
      ? `COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, c.cli_nome, 'EXCLUÍDO')`
      : `c.cli_codigo`;

    const [siR, soR] = await Promise.all([
      db.query(`
        SELECT ${nomeExpr} AS nome,
          SUM(i.ite_totliquido)::NUMERIC AS valor,
          SUM(i.ite_quant)::NUMERIC      AS qtd
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE ${siWhere}
        GROUP BY ${groupExpr}
        ORDER BY valor DESC LIMIT 12
      `, siParams),
      db.query(`
        SELECT ${nomeExpr} AS nome,
          SUM(s.valor)::NUMERIC      AS valor,
          SUM(s.quantidade)::NUMERIC AS qtd
        FROM crm_sellout s
        JOIN clientes c ON c.cli_codigo = s.cli_codigo
        WHERE ${soWhere}
        GROUP BY ${groupExpr}
        ORDER BY valor DESC LIMIT 12
      `, soParams),
    ]);

    const toRow = (r: any) => ({ nome: r.nome, valor: parseFloat(r.valor) || 0, qtd: parseFloat(r.qtd) || 0 });
    res.json({ success: true, data: { sell_in: siR.rows.map(toRow), sell_out: soR.rows.map(toRow) }});
  } catch (err: any) {
    console.error('❌ [BI/sell-in-out/ranking]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/bi/sell-in-out/cruzamento ───────────────────────────────────────
export async function sellInOutCruzamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const anos = parseAnos(req.query.anos as string);
    const meses = parseMeses(req.query.meses as string);
    const forInt = req.query.for_codigo ? parseInt(String(req.query.for_codigo)) : null;
    const cliInt = req.query.cli_codigo ? parseInt(String(req.query.cli_codigo)) : null;
    const venInt = req.query.ven_codigo ? parseInt(String(req.query.ven_codigo)) : null;
    const allowedIndustries = await getAllowedIndustries(db, userId);

    const { where: siWhere, params: siParams } = buildWhere(anos, meses, forInt, cliInt, allowedIndustries, venInt);
    const { where: soWhere, params: soParams } = buildSellOutConditions(anos, meses, forInt, cliInt, allowedIndustries, venInt);
    const prev = getPrevPeriod(anos, meses);
    const { where: soPrevWhere, params: soPrevParams } = buildSellOutConditions(prev.anos, prev.meses, forInt, cliInt, allowedIndustries, venInt);

    const [siR, soR, soPrevR] = await Promise.all([
      db.query(`
        SELECT
          p.ped_cliente AS cli_codigo,
          COALESCE(c.cli_nomred, c.cli_nome, 'EXCLUÍDO') AS cli_nome,
          c.cli_uf,
          COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, c.cli_nome, 'EXCLUÍDO') AS grupo,
          SUM(i.ite_totliquido)::NUMERIC AS si_valor,
          SUM(i.ite_quant)::NUMERIC      AS si_qtd
        FROM pedidos p
        LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
        JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE ${siWhere}
        GROUP BY p.ped_cliente, c.cli_nomred, c.cli_nome, c.cli_uf, c.cli_redeloja
      `, siParams),
      db.query(`
        SELECT cli_codigo,
          SUM(s.valor)::NUMERIC      AS so_valor,
          SUM(s.quantidade)::NUMERIC AS so_qtd
        FROM crm_sellout s WHERE ${soWhere}
        GROUP BY cli_codigo
      `, soParams),
      db.query(`
        SELECT cli_codigo,
          SUM(s.valor)::NUMERIC      AS so_prev_valor,
          SUM(s.quantidade)::NUMERIC AS so_prev_qtd
        FROM crm_sellout s WHERE ${soPrevWhere}
        GROUP BY cli_codigo
      `, soPrevParams),
    ]);

    const soMap   = new Map(soR.rows.map((r: any) => [Number(r.cli_codigo), r]));
    const prevMap = new Map(soPrevR.rows.map((r: any) => [Number(r.cli_codigo), r]));

    const addPcts = (row: any) => {
      const stPct  = row.si_valor > 0   ? parseFloat(((row.so_valor / row.si_valor) * 100).toFixed(1)) : null;
      const varV   = row.so_prev_valor > 0 ? parseFloat((((row.so_valor - row.so_prev_valor) / row.so_prev_valor) * 100).toFixed(1)) : null;
      const varQ   = row.so_prev_qtd   > 0 ? parseFloat((((row.so_qtd   - row.so_prev_qtd)   / row.so_prev_qtd)   * 100).toFixed(1)) : null;
      return { ...row, sell_through_pct: stPct, so_var_pct: varV, so_var_qtd_pct: varQ };
    };

    const filiais: any[] = siR.rows.map((r: any) => {
      const cur  = soMap.get(Number(r.cli_codigo));
      const prev = prevMap.get(Number(r.cli_codigo));
      return {
        tipo: 'filial', cli_codigo: r.cli_codigo,
        nome: r.cli_nome, uf: r.cli_uf, grupo: r.grupo,
        si_valor: parseFloat(r.si_valor) || 0,
        si_qtd:   parseFloat(r.si_qtd)   || 0,
        so_valor:      parseFloat((cur as any)?.so_valor)       || 0,
        so_qtd:        parseFloat((cur as any)?.so_qtd)         || 0,
        so_prev_valor: parseFloat((prev as any)?.so_prev_valor) || 0,
        so_prev_qtd:   parseFloat((prev as any)?.so_prev_qtd)   || 0,
      };
    });

    const grupoMap = new Map<string, any>();
    const filasByGrupo = new Map<string, any[]>();
    filiais.forEach(f => {
      if (!grupoMap.has(f.grupo)) grupoMap.set(f.grupo, {
        tipo: 'grupo', nome: f.grupo, uf: null, grupo: f.grupo,
        si_valor: 0, si_qtd: 0, so_valor: 0, so_qtd: 0, so_prev_valor: 0, so_prev_qtd: 0,
      });
      const g = grupoMap.get(f.grupo)!;
      g.si_valor += f.si_valor; g.si_qtd += f.si_qtd;
      g.so_valor += f.so_valor; g.so_qtd += f.so_qtd;
      g.so_prev_valor += f.so_prev_valor; g.so_prev_qtd += f.so_prev_qtd;

      if (!filasByGrupo.has(f.grupo)) filasByGrupo.set(f.grupo, []);
      filasByGrupo.get(f.grupo)!.push(f);
    });

    const result: any[] = [];
    [...grupoMap.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(g => {
      result.push(addPcts(grupoMap.get(g)!));
      (filasByGrupo.get(g) || [])
        .sort((a: any, b: any) => (a.uf || '').localeCompare(b.uf || '', 'pt-BR'))
        .forEach((f: any) => result.push(addPcts(f)));
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('❌ [BI/sell-in-out/cruzamento]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/bi/narrative ──────────────────────────────────────────────────
const NARRATIVE_SYSTEM = `Você é um analista de negócios especializado em representação comercial de autopeças no Brasil.
Analise os dados fornecidos e gere uma narrativa concisa em português brasileiro.

Os dados podem incluir os campos:
- "periodo_analisado": o período (mês/ano) que está sendo analisado — use SEMPRE no início da linha 1
- "comparado_com": o período de baseline (ex: mesmo mês do ano anterior) — use SEMPRE na linha 2 quando presente
- "delta_*": variações percentuais já calculadas em relação ao baseline
- demais campos: KPIs absolutos do período analisado

Responda APENAS com JSON válido neste exato formato:
{"lines": ["linha1", "linha2", "linha3_opcional"], "type": "success"}

Regras OBRIGATÓRIAS das linhas (2 a 3 linhas, sem numeração):
- Linha 1: deve COMEÇAR com o período analisado entre vírgulas (ex: "Em Abril/2026, vendas..."). Trazer o insight principal e o KPI absoluto que sustenta o insight.
- Linha 2: deve mencionar EXPLICITAMENTE o período de comparação (use o campo "comparado_com"). Ex: "Comparado com Abril/2025, o crescimento foi de 24,8%, impulsionado por...". Sem comparado_com, mencione "vs período anterior" ou similar.
- Linha 3 (opcional): recomendação prática ou alerta específico ancorado nos números.

Regras de estilo:
- Linguagem direta, profissional, sem jargões técnicos
- Valores monetários: "R$ 1.234.567" (nunca use K ou M)
- Percentuais com vírgula decimal: "12,3%"
- SEM markdown, bullets, asteriscos ou formatação especial
- Cada linha tem que SUSTENTAR-SE sozinha (ler isolada, faz sentido)

Regras do tipo:
- "success": crescimento positivo, meta atingida, resultados acima do esperado
- "alert": queda acima de 10%, clientes perdidos, meta muito abaixo do esperado
- "info": variação pequena, dados mistos, período com poucos dados`;

export async function narrativeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { tab, data, periodo } = req.body as {
      tab: string;
      data: Record<string, any>;
      periodo?: string;
    };

    if (!data || !tab) {
      res.json({ success: true, lines: [], type: 'info' });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.json({ success: true, lines: [], type: 'info' });
      return;
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const userMessage = `Tab: ${tab}\nPeríodo: ${periodo || 'não informado'}\nDados:\n${JSON.stringify(data, null, 2)}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: NARRATIVE_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = (message.content[0] as any)?.text?.trim() || '{}';
    let result: { lines: string[]; type: string } = { lines: [], type: 'info' };
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(m?.[0] || '{"lines":[],"type":"info"}');
    } catch { /* silently fail */ }

    res.json({
      success: true,
      lines: Array.isArray(result.lines) ? result.lines.filter(Boolean) : [],
      type: ['success', 'alert', 'info'].includes(result.type) ? result.type : 'info',
    });
  } catch (error: any) {
    console.error('❌ [BI/narrative]', error.message);
    res.json({ success: true, lines: [], type: 'info' });
  }
}

// ─── GET /api/bi/sellers-available ────────────────────────────────────────────
// Lista de vendedores filtrada por permissão para popular o combobox do BI:
//  - Master / gerência → todos os vendedores ativos (ven_status = 'A')
//  - Rep com vendedor vinculado → APENAS o próprio (lista com 1 item, frontend
//    auto-seleciona e desabilita o combobox)
//  - Sem vendedor vinculado e sem master/gerência → lista vazia (segurança)
export async function sellersAvailableHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);

    // Detecta permissão lendo direto da tabela user_nomes
    const userCheck = await db.query(
      'SELECT master, gerencia FROM user_nomes WHERE codigo = $1',
      [userId]
    );
    const isMasterOrGerencia =
      userCheck.rows.length > 0 &&
      (userCheck.rows[0].master === true || userCheck.rows[0].gerencia === true);

    if (isMasterOrGerencia) {
      const r = await db.query(`
        SELECT ven_codigo, ven_nome
        FROM vendedores
        WHERE COALESCE(UPPER(TRIM(ven_status)), 'A') = 'A'
          AND COALESCE(UPPER(TRIM(ven_cumpremetas)), 'S') <> 'N'
        ORDER BY ven_nome
      `);
      res.json({ success: true, data: r.rows, locked: false });
      return;
    }

    // Não-master: tenta vincular vendedor pelo userId
    const linkedId = await getLinkedSellerId(db, userId);
    if (linkedId == null) {
      // Sem vínculo e sem master: lista vazia (não deve ver dado de ninguém)
      res.json({ success: true, data: [], locked: true });
      return;
    }

    // Mesmo o rep "locked" não aparece se ele próprio for cumpremetas='N'
    const r = await db.query(
      `SELECT ven_codigo, ven_nome FROM vendedores
       WHERE ven_codigo = $1
         AND COALESCE(UPPER(TRIM(ven_cumpremetas)), 'S') <> 'N'`,
      [linkedId]
    );
    res.json({ success: true, data: r.rows, locked: true });
  } catch (error: any) {
    console.error('❌ [BI/sellers-available]', error.message);
    res.status(500).json({ success: false, message: error.message, data: [], locked: true });
  }
}
