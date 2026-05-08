import { Request, Response } from 'express';

// GET /api/estatisticas/client-insight
export async function clientInsightHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;

    const result = await db.query(`
      WITH mix_produtos AS (
        SELECT
          p.ped_cliente AS m_cliente,
          COUNT(DISTINCT TRIM(i.ite_produto))::BIGINT AS m_skus
        FROM pedidos p
        JOIN itens_ped i ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_situacao <> 'C'
        GROUP BY 1
      ),
      vendas_resumo AS (
        SELECT
          p.ped_cliente AS v_cliente,
          SUM(p.ped_totliq)::NUMERIC(15,2) AS v_faturamento,
          MAX(p.ped_data)::DATE AS v_ultima
        FROM pedidos p
        WHERE p.ped_situacao <> 'C'
        GROUP BY 1
      )
      SELECT
        c.cli_codigo::INTEGER AS cliente_id,
        c.cli_nome::TEXT AS razao_social,
        c.cli_nomred::TEXT AS nome_fantasia,
        COALESCE(cid.cid_nome, c.cli_cidade)::TEXT AS cidade,
        COALESCE(cid.cid_uf, c.cli_uf)::TEXT AS uf,
        COALESCE(v.ven_nome, 'Não Atribuído')::TEXT AS vendedor_nome,
        COALESCE(c.cli_tipopes, 'A')::TEXT AS status_cliente,
        COALESCE(vr.v_faturamento, 0)::NUMERIC AS total_faturado,
        vr.v_ultima AS data_ultima_compra,
        COALESCE(mp.m_skus, 0)::BIGINT AS total_skus,
        CASE WHEN vr.v_ultima IS NULL THEN NULL
             ELSE (CURRENT_DATE - vr.v_ultima)::INTEGER
        END AS dias_inatividade
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      LEFT JOIN vendedores v ON c.cli_vendedor = v.ven_codigo
      LEFT JOIN vendas_resumo vr ON c.cli_codigo = vr.v_cliente
      LEFT JOIN mix_produtos mp ON c.cli_codigo = mp.m_cliente
      ORDER BY total_faturado DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error('[clientInsightHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/clientes-yoy
export async function clientesYoYHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { mes, ano, industria, anoTodo, redeLoja } = req.query;

    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria é obrigatória' });
    }

    const anoNum     = Number(ano)  || new Date().getFullYear();
    const mesNum     = Number(mes)  || new Date().getMonth() + 1;
    const anoTodoFlag = String(anoTodo)  === 'true';
    const redeFlag    = String(redeLoja) === 'true';

    const today      = new Date();
    const mesAtual   = today.getMonth() + 1;

    // Períodos
    let iniCurr: string, fimCurr: string, iniPrev: string, fimPrev: string;

    if (anoTodoFlag) {
      // Jan → hoje (mesmo dia/mês, ano anterior)
      iniCurr = `${anoNum}-01-01`;
      fimCurr = `${anoNum}-${String(mesAtual).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      iniPrev = `${anoNum - 1}-01-01`;
      fimPrev = `${anoNum - 1}-${String(mesAtual).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    } else {
      const lastDay = new Date(anoNum, mesNum, 0).getDate();
      iniCurr = `${anoNum}-${String(mesNum).padStart(2,'0')}-01`;
      fimCurr = `${anoNum}-${String(mesNum).padStart(2,'0')}-${lastDay}`;
      iniPrev = `${anoNum - 1}-${String(mesNum).padStart(2,'0')}-01`;
      fimPrev = `${anoNum - 1}-${String(mesNum).padStart(2,'0')}-${lastDay}`;
    }

    const cliKey = redeFlag
      ? `COALESCE(NULLIF(c.cli_redeloja, ''), c.cli_nomred)`
      : `c.cli_nomred`;

    const result = await db.query(`
      WITH vendas AS (
        SELECT
          ${cliKey}::text AS cli_key,
          p.ped_data,
          p.ped_totliq::numeric AS totliq,
          i.ite_quant::numeric  AS quant
        FROM pedidos p
        JOIN itens_ped i ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
        WHERE p.ped_industria = $1
          AND p.ped_situacao IN ('P', 'F')
          AND (
            p.ped_data BETWEEN $2::date AND $3::date OR
            p.ped_data BETWEEN $4::date AND $5::date
          )
      ),
      agrupado AS (
        SELECT
          cli_key,
          SUM(CASE WHEN ped_data BETWEEN $4::date AND $5::date THEN totliq ELSE 0 END) AS v_prev,
          SUM(CASE WHEN ped_data BETWEEN $4::date AND $5::date THEN quant  ELSE 0 END) AS q_prev,
          SUM(CASE WHEN ped_data BETWEEN $2::date AND $3::date THEN totliq ELSE 0 END) AS v_curr,
          SUM(CASE WHEN ped_data BETWEEN $2::date AND $3::date THEN quant  ELSE 0 END) AS q_curr
        FROM vendas
        GROUP BY cli_key
      )
      SELECT
        cli_key AS cliente_nome,
        v_prev, q_prev, v_curr, q_curr,
        CASE WHEN v_prev = 0 AND v_curr > 0 THEN 100.0
             WHEN v_prev = 0 THEN 0.0
             ELSE ROUND(((v_curr - v_prev) / v_prev) * 100.0, 2)
        END AS perc_valor,
        CASE WHEN q_prev = 0 AND q_curr > 0 THEN 100.0
             WHEN q_prev = 0 THEN 0.0
             ELSE ROUND(((q_curr - q_prev) / q_prev) * 100.0, 2)
        END AS perc_qtd
      FROM agrupado
      WHERE v_prev <> 0 OR v_curr <> 0
      ORDER BY q_curr DESC, cli_key
    `, [Number(industria), iniCurr, fimCurr, iniPrev, fimPrev]);

    const data = result.rows.map((r: any) => ({
      cliente_nome: r.cliente_nome,
      valor_prev:   parseFloat(r.v_prev) || 0,
      qtd_prev:     parseFloat(r.q_prev) || 0,
      valor_curr:   parseFloat(r.v_curr) || 0,
      qtd_curr:     parseFloat(r.q_curr) || 0,
      perc_valor:   parseFloat(r.perc_valor) || 0,
      perc_qtd:     parseFloat(r.perc_qtd)   || 0,
    }));

    res.json({ success: true, data, anoPrev: anoNum - 1, anoCurr: anoNum });
  } catch (err: any) {
    console.error('[clientesYoYHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/mapa-cli-industria
export async function mapaCliIndustriaHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, vendedor, grupo, detalhada } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const grupoFlag    = String(grupo)    === 'true';
    const detalhadaFlag = String(detalhada) === 'true';

    const params: any[] = [dataInicial, dataFinal];
    let pc = 3;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P', 'F')`,
    ];

    if (industria && industria !== 'ALL') {
      conditions.push(`p.ped_industria = $${pc}`); params.push(Number(industria)); pc++;
    }
    if (vendedor && vendedor !== 'ALL') {
      conditions.push(`p.ped_vendedor = $${pc}`); params.push(Number(vendedor)); pc++;
    }
    if (cliente && cliente !== 'ALL') {
      if (grupoFlag) {
        conditions.push(`c.cli_redeloja = (SELECT cli_redeloja FROM clientes WHERE cli_codigo = $${pc})`);
      } else {
        conditions.push(`p.ped_cliente = $${pc}`);
      }
      params.push(Number(cliente)); pc++;
    }
    if (grupoFlag) {
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
    }

    const clientCol = grupoFlag ? `c.cli_redeloja` : `COALESCE(c.cli_nomred, 'EXCLUÍDO')`;
    const where     = conditions.join(' AND ');

    let query: string;

    if (detalhadaFlag) {
      query = `
        SELECT
          f.for_nomered                             AS industria,
          TRIM(p.ped_pedido)                        AS pedido,
          ${clientCol}                              AS cliente,
          p.ped_data                                AS data,
          p.ped_totliq::NUMERIC                     AS valor,
          (SELECT SUM(ip2.ite_quant) FROM itens_ped ip2 WHERE TRIM(ip2.ite_pedido) = TRIM(p.ped_pedido))::NUMERIC AS qtd,
          TO_CHAR(p.ped_data, 'MM/YYYY')            AS mes_ref
        FROM pedidos p
        LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
        JOIN fornecedores f ON p.ped_industria = f.for_codigo
        WHERE ${where}
        ORDER BY f.for_nomered, p.ped_data DESC
      `;
    } else {
      query = `
        SELECT
          MAX(f.for_nomered)                             AS industria,
          ${clientCol}                                   AS cliente,
          MAX(p.ped_data)                                AS data,
          SUM(ip.ite_totliquido)::NUMERIC                AS valor,
          SUM(ip.ite_quant)::NUMERIC                     AS qtd,
          TO_CHAR(MAX(p.ped_data), 'MM/YYYY')            AS mes_ref
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
        JOIN fornecedores f ON p.ped_industria = f.for_codigo
        WHERE ${where}
        GROUP BY f.for_nomered, ${clientCol}
        ORDER BY f.for_nomered, ${clientCol}
      `;
    }

    const result = await db.query(query, params);
    const data = result.rows.map((r: any) => ({
      ...r,
      valor: parseFloat(r.valor) || 0,
      qtd:   parseFloat(r.qtd)   || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[mapaCliIndustriaHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/sellout-periodo
export async function selloutPeriodoHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const params: any[] = [dataInicial, dataFinal];
    let pc = 3;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P', 'F')`,
    ];

    if (industria && industria !== 'ALL') {
      conditions.push(`p.ped_industria = $${pc}`); params.push(Number(industria)); pc++;
    }
    if (cliente && cliente !== 'ALL') {
      conditions.push(`p.ped_cliente = $${pc}`); params.push(Number(cliente)); pc++;
    }

    const result = await db.query(`
      SELECT
        p.ped_cliente                          AS cliente_id,
        COALESCE(c.cli_nomred, 'EXCLUÍDO')     AS cliente_nome,
        EXTRACT(YEAR  FROM p.ped_data)::INTEGER AS ano,
        EXTRACT(MONTH FROM p.ped_data)::INTEGER AS mes,
        SUM(ip.ite_totliquido)::NUMERIC         AS valor,
        SUM(ip.ite_quant)::NUMERIC              AS quantidade
      FROM pedidos p
      JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.ped_cliente, c.cli_nomred,
               EXTRACT(YEAR FROM p.ped_data),
               EXTRACT(MONTH FROM p.ped_data)
      ORDER BY c.cli_nomred, ano, mes
    `, params);

    const data = result.rows.map((r: any) => ({
      ...r,
      valor:      parseFloat(r.valor)     || 0,
      quantidade: parseFloat(r.quantidade) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[selloutPeriodoHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/venda-mensal-industria
export async function vendaMensalIndustriaHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, vendedor, grupo } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const grupoFlag = String(grupo) === 'true';
    const params: any[] = [dataInicial, dataFinal];
    let pc = 3;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P','F')`,
    ];

    if (industria && industria !== 'ALL') { conditions.push(`p.ped_industria = $${pc}`); params.push(Number(industria)); pc++; }
    if (vendedor  && vendedor  !== 'ALL') { conditions.push(`p.ped_vendedor  = $${pc}`); params.push(Number(vendedor));  pc++; }
    if (cliente   && cliente   !== 'ALL') {
      if (grupoFlag) conditions.push(`c.cli_redeloja = (SELECT cli_redeloja FROM clientes WHERE cli_codigo = $${pc})`);
      else           conditions.push(`p.ped_cliente = $${pc}`);
      params.push(Number(cliente)); pc++;
    }
    if (grupoFlag) conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);

    const result = await db.query(`
      SELECT
        f.for_nomered                       AS industria_nome,
        COALESCE(v.ven_nome, '—')           AS vendedor_nome,
        TO_CHAR(p.ped_data, 'MM/YYYY')     AS mes,
        SUM(ip.ite_totliquido)::NUMERIC     AS valor,
        SUM(ip.ite_quant)::NUMERIC          AS qtd
      FROM pedidos p
      JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      JOIN fornecedores f ON p.ped_industria = f.for_codigo
      LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
      WHERE ${conditions.join(' AND ')}
      GROUP BY f.for_nomered, v.ven_nome, TO_CHAR(p.ped_data, 'MM/YYYY')
      ORDER BY f.for_nomered, v.ven_nome, TO_CHAR(p.ped_data, 'MM/YYYY')
    `, params);

    const data = result.rows.map((r: any) => ({
      industria_nome: r.industria_nome,
      vendedor_nome:  r.vendedor_nome,
      mes:            r.mes,
      valor:          parseFloat(r.valor) || 0,
      qtd:            parseFloat(r.qtd)   || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[vendaMensalIndustriaHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/mapa-pedidos
export async function mapaPedidosHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, vendedor } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const params: any[] = [dataInicial, dataFinal];
    let pc = 3;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P','F')`,
    ];

    if (industria && industria !== 'ALL') { conditions.push(`p.ped_industria = $${pc}`); params.push(Number(industria)); pc++; }
    if (cliente   && cliente   !== 'ALL') { conditions.push(`p.ped_cliente   = $${pc}`); params.push(Number(cliente));   pc++; }
    if (vendedor  && vendedor  !== 'ALL') { conditions.push(`p.ped_vendedor  = $${pc}`); params.push(Number(vendedor));  pc++; }

    const result = await db.query(`
      SELECT
        TRIM(p.ped_pedido)                                     AS pedido,
        p.ped_data                                             AS data,
        p.ped_situacao                                         AS situacao,
        COALESCE(c.cli_nomred, 'EXCLUÍDO')                    AS cliente_nome,
        f.for_nomered                                          AS industria_nome,
        COALESCE(v.ven_nome, '—')                             AS vendedor_nome,
        p.ped_totbruto::NUMERIC                                AS total_bruto,
        p.ped_totliq::NUMERIC                                  AS total_liq,
        COALESCE(p.ped_totalipi, 0)::NUMERIC                  AS total_ipi,
        COUNT(ip.ite_produto)::INTEGER                        AS num_itens,
        COALESCE(SUM(ip.ite_quant), 0)::NUMERIC              AS total_quant
      FROM pedidos p
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      JOIN fornecedores f ON p.ped_industria = f.for_codigo
      LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
      LEFT JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.ped_pedido, p.ped_data, p.ped_situacao, c.cli_nomred,
               f.for_nomered, v.ven_nome, p.ped_totbruto, p.ped_totliq, p.ped_totalipi
      ORDER BY f.for_nomered, p.ped_data DESC, TRIM(p.ped_pedido)
    `, params);

    const data = result.rows.map((r: any) => ({
      pedido:         r.pedido,
      data:           r.data,
      situacao:       r.situacao,
      cliente_nome:   r.cliente_nome,
      industria_nome: r.industria_nome,
      vendedor_nome:  r.vendedor_nome,
      total_bruto:    parseFloat(r.total_bruto) || 0,
      total_liq:      parseFloat(r.total_liq)   || 0,
      total_ipi:      parseFloat(r.total_ipi)   || 0,
      num_itens:      Number(r.num_itens)        || 0,
      total_quant:    parseFloat(r.total_quant) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[mapaPedidosHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/prod-unica-compra
export async function prodUnicaCompraHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }
    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }

    const result = await db.query(`
      SELECT
        COALESCE(c.cli_nomred, 'EXCLUÍDO')                        AS cliente_nome,
        TRIM(i.ite_produto)                                        AS produto_codigo,
        COALESCE(pr.pro_nome, i.ite_produto)                      AS produto_desc,
        SUM(i.ite_quant)::NUMERIC                                  AS quantidade
      FROM pedidos p
      JOIN itens_ped i ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      JOIN clientes c ON p.ped_cliente = c.cli_codigo
      LEFT JOIN cad_prod pr ON TRIM(pr.pro_codprod) = TRIM(i.ite_produto)
                            AND pr.pro_industria = p.ped_industria
      WHERE p.ped_data BETWEEN $1::date AND $2::date
        AND p.ped_industria = $3
        AND p.ped_situacao IN ('P','F')
      GROUP BY c.cli_codigo, c.cli_nomred, TRIM(i.ite_produto), COALESCE(pr.pro_nome, i.ite_produto)
      HAVING COUNT(DISTINCT TRIM(p.ped_pedido)) = 1
      ORDER BY c.cli_nomred, TRIM(i.ite_produto)
    `, [dataInicial, dataFinal, Number(industria)]);

    const data = result.rows.map((r: any) => ({
      cliente_nome:   r.cliente_nome,
      produto_codigo: r.produto_codigo,
      produto_desc:   r.produto_desc,
      quantidade:     parseFloat(r.quantidade) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[prodUnicaCompraHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/clientes-inativos
export async function clientesInativosHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { periodo, for_codigo, ven_codigo } = req.query; // -1=todos, 0=nunca, 3=90d, 6=180d, 12=365d

    const periodoNum = Number(periodo ?? 3);
    const forInt     = for_codigo ? parseInt(String(for_codigo)) : null;
    const venInt     = ven_codigo  ? parseInt(String(ven_codigo))  : null;

    const params: any[] = [];

    let periodoParam = '';
    if (periodoNum > 0) {
      params.push(periodoNum);
      periodoParam = `$${params.length}`;
    }

    const indFilter  = forInt ? `AND p.ped_industria  = ${forInt}` : '';
    const indFilter2 = forInt ? `AND p2.ped_industria = ${forInt}` : '';
    const venFilter  = venInt  ? `AND c.cli_vendedor   = ${venInt}` : '';

    let whereExtra = '';
    if (periodoNum === 0) {
      whereExtra = `
        AND NOT EXISTS (
          SELECT 1 FROM pedidos p2
          WHERE p2.ped_cliente = c.cli_codigo
            AND p2.ped_situacao IN ('P','F')
            ${indFilter2}
        )
      `;
    } else if (periodoNum > 0) {
      whereExtra = `
        AND NOT EXISTS (
          SELECT 1 FROM pedidos p2
          WHERE p2.ped_cliente = c.cli_codigo
            AND p2.ped_situacao IN ('P','F')
            AND p2.ped_data::date >= CURRENT_DATE - (${periodoParam}::int * INTERVAL '1 month')
            ${indFilter2}
        )
      `;
    }

    const result = await db.query(`
      WITH historico AS (
        SELECT
          p.ped_cliente                                        AS cli,
          COUNT(DISTINCT p.ped_pedido)::INTEGER                AS total_pedidos,
          MAX(p.ped_data)                                      AS ultima_compra,
          AVG(p.ped_totliq)::NUMERIC                          AS ticket_medio,
          CASE
            WHEN COUNT(DISTINCT p.ped_pedido) > 1
            THEN ROUND(
              (MAX(p.ped_data) - MIN(p.ped_data))::NUMERIC
              / NULLIF(COUNT(DISTINCT p.ped_pedido) - 1, 0), 0
            )
            ELSE NULL
          END                                                  AS freq_dias
        FROM pedidos p
        WHERE p.ped_situacao IN ('P','F')
          ${indFilter}
        GROUP BY p.ped_cliente
      )
      SELECT
        c.cli_codigo::INTEGER                                      AS codigo,
        c.cli_cnpj                                                 AS cnpj,
        COALESCE(c.cli_nomred, c.cli_nome)                        AS nome,
        COALESCE(cid.cid_nome, c.cli_cidade, '')                  AS cidade,
        COALESCE(cid.cid_uf, c.cli_uf, '')                        AS uf,
        COALESCE(v.ven_nome, 'Não atribuído')                     AS vendedor,
        h.ultima_compra,
        CASE WHEN h.ultima_compra IS NULL THEN NULL
             ELSE (CURRENT_DATE - h.ultima_compra::date)::INTEGER
        END                                                        AS dias_inativo,
        COALESCE(h.ticket_medio, 0)::NUMERIC                      AS ticket_medio,
        COALESCE(h.freq_dias, 0)::NUMERIC                         AS freq_dias,
        COALESCE(h.total_pedidos, 0)                               AS total_pedidos,
        CASE
          WHEN h.freq_dias IS NULL OR h.freq_dias = 0 THEN 0
          WHEN h.ultima_compra IS NULL THEN 0
          ELSE GREATEST(0, FLOOR(
            (CURRENT_DATE - h.ultima_compra::date)::NUMERIC / h.freq_dias
          ) * h.ticket_medio)
        END::NUMERIC                                               AS receita_potencial
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      LEFT JOIN vendedores v ON c.cli_vendedor = v.ven_codigo
      LEFT JOIN historico h ON c.cli_codigo = h.cli
      WHERE c.cli_tipopes = 'A'
        ${venFilter}
        ${whereExtra}
      ORDER BY receita_potencial DESC NULLS LAST, dias_inativo DESC NULLS LAST
    `, params);

    const data = result.rows.map((r: any) => ({
      codigo:            r.codigo,
      cnpj:              r.cnpj || '',
      nome:              r.nome,
      cidade:            r.cidade,
      uf:                r.uf,
      vendedor:          r.vendedor,
      ultima_compra:     r.ultima_compra,
      dias_inativo:      r.dias_inativo !== null ? Number(r.dias_inativo) : null,
      ticket_medio:      parseFloat(r.ticket_medio) || 0,
      freq_dias:         parseFloat(r.freq_dias)    || 0,
      total_pedidos:     Number(r.total_pedidos)    || 0,
      receita_potencial: parseFloat(r.receita_potencial) || 0,
    }));

    const totalReceita = data.reduce((s: number, r: any) => s + r.receita_potencial, 0);
    const totalInativos = data.filter((r: any) => r.dias_inativo !== null && r.dias_inativo > 0).length;
    const ticketMedio = data.length ? data.reduce((s: number, r: any) => s + r.ticket_medio, 0) / data.length : 0;
    const maiorPotencial = data.reduce((mx: number, r: any) => Math.max(mx, r.receita_potencial), 0);

    res.json({
      success: true, data, total: data.length,
      kpis: { totalReceita, totalInativos, ticketMedio, maiorPotencial },
    });
  } catch (err: any) {
    console.error('[clientesInativosHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/ultimas-compras
export async function ultimasComprasHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, vendedor, grupo, modo } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const grupoFlag = String(grupo) === 'true';
    const modoUlt   = String(modo)  === 'ultima';

    // Para grupo=true, mantém comportamento original (somente clientes com compras)
    if (grupoFlag) {
      const params: any[] = [dataInicial, dataFinal];
      let pc = 3;
      const conditions: string[] = [
        `p.ped_data BETWEEN $1::date AND $2::date`,
        `p.ped_situacao IN ('P','F')`,
      ];
      if (industria && industria !== 'ALL') { conditions.push(`p.ped_industria = $${pc}`); params.push(Number(industria)); pc++; }
      if (vendedor  && vendedor  !== 'ALL') { conditions.push(`p.ped_vendedor = $${pc}`);  params.push(Number(vendedor));  pc++; }
      if (cliente   && cliente   !== 'ALL') {
        conditions.push(`c.cli_redeloja = (SELECT cli_redeloja FROM clientes WHERE cli_codigo = $${pc})`);
        params.push(Number(cliente)); pc++;
      }
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
      const cliExpr = `COALESCE(NULLIF(c.cli_redeloja,''), c.cli_nomred)`;
      const where = conditions.join(' AND ');
      const query = modoUlt
        ? `SELECT DISTINCT ON (${cliExpr}, f.for_nomered) ${cliExpr} AS cliente, COALESCE(cid.cid_uf, c.cli_uf, '') AS estado, f.for_nomered AS industria, COALESCE(v.ven_nome, '—') AS vendedor_nome, p.ped_totliq::NUMERIC AS valor, (SELECT SUM(ip2.ite_quant) FROM itens_ped ip2 WHERE TRIM(ip2.ite_pedido) = TRIM(p.ped_pedido))::NUMERIC AS qtd, p.ped_data AS data_ultima, (CURRENT_DATE - p.ped_data::date)::INTEGER AS dias FROM pedidos p LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo JOIN fornecedores f ON p.ped_industria = f.for_codigo LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo WHERE ${where} ORDER BY ${cliExpr}, f.for_nomered, p.ped_data DESC`
        : `SELECT ${cliExpr} AS cliente, MAX(COALESCE(cid.cid_uf, c.cli_uf, '')) AS estado, f.for_nomered AS industria, MAX(COALESCE(v.ven_nome, '—')) AS vendedor_nome, SUM(p.ped_totliq)::NUMERIC AS valor, SUM(ip.ite_quant)::NUMERIC AS qtd, MAX(p.ped_data) AS data_ultima, (CURRENT_DATE - MAX(p.ped_data)::date)::INTEGER AS dias FROM pedidos p JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido) LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo JOIN fornecedores f ON p.ped_industria = f.for_codigo LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo WHERE ${where} GROUP BY ${cliExpr}, f.for_nomered`;
      const result = await db.query(`SELECT * FROM (${query}) sub ORDER BY dias ASC, cliente`, params);
      const data = result.rows.map((r: any) => ({ cliente: r.cliente, estado: r.estado || '', industria: r.industria, vendedor_nome: r.vendedor_nome || '—', valor: parseFloat(r.valor) || 0, qtd: parseFloat(r.qtd) || 0, data_ultima: r.data_ultima, dias: Number(r.dias) || 0 }));
      return res.json({ success: true, data, total: data.length });
    }

    // Modo padrão (grupo=false): retorna TODOS os clientes ativos, mesmo sem compras no período
    const pedParams: any[] = [dataInicial, dataFinal];
    let pedPc = 3;
    const pedConds: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P','F')`,
    ];
    if (industria && industria !== 'ALL') { pedConds.push(`p.ped_industria = $${pedPc}`); pedParams.push(Number(industria)); pedPc++; }
    if (vendedor  && vendedor  !== 'ALL') { pedConds.push(`p.ped_vendedor = $${pedPc}`);  pedParams.push(Number(vendedor));  pedPc++; }

    const baseParams: any[] = [...pedParams];
    let basePc = pedPc;
    const baseConds: string[] = [`c.cli_tipopes = 'A'`];
    if (cliente && cliente !== 'ALL') { baseConds.push(`c.cli_codigo = $${basePc}`); baseParams.push(Number(cliente)); basePc++; }

    const comprasCTE = modoUlt
      ? `
        WITH compras AS (
          SELECT DISTINCT ON (p.ped_cliente, p.ped_industria)
            p.ped_cliente,
            f.for_nomered AS industria,
            COALESCE(v.ven_nome, '—') AS vendedor_nome,
            p.ped_totliq::NUMERIC AS valor,
            (SELECT SUM(ip2.ite_quant) FROM itens_ped ip2
             WHERE TRIM(ip2.ite_pedido) = TRIM(p.ped_pedido))::NUMERIC AS qtd,
            p.ped_data AS data_ultima
          FROM pedidos p
          JOIN fornecedores f ON p.ped_industria = f.for_codigo
          LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
          WHERE ${pedConds.join(' AND ')}
          ORDER BY p.ped_cliente, p.ped_industria, p.ped_data DESC
        )
      `
      : `
        WITH compras AS (
          SELECT
            p.ped_cliente,
            f.for_nomered AS industria,
            MAX(COALESCE(v.ven_nome, '—')) AS vendedor_nome,
            SUM(p.ped_totliq)::NUMERIC AS valor,
            SUM(ip.ite_quant)::NUMERIC AS qtd,
            MAX(p.ped_data) AS data_ultima
          FROM pedidos p
          JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
          JOIN fornecedores f ON p.ped_industria = f.for_codigo
          LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
          WHERE ${pedConds.join(' AND ')}
          GROUP BY p.ped_cliente, f.for_nomered
        )
      `;

    const query = `
      ${comprasCTE}
      SELECT
        COALESCE(c.cli_nomred, 'EXCLUÍDO') AS cliente,
        COALESCE(cid.cid_uf, c.cli_uf, '') AS estado,
        COALESCE(cp.industria, '—') AS industria,
        COALESCE(cp.vendedor_nome, '—') AS vendedor_nome,
        COALESCE(cp.valor, 0)::NUMERIC AS valor,
        COALESCE(cp.qtd, 0)::NUMERIC AS qtd,
        cp.data_ultima,
        CASE WHEN cp.data_ultima IS NOT NULL
          THEN (CURRENT_DATE - cp.data_ultima::date)::INTEGER
          ELSE 9999
        END AS dias
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      LEFT JOIN compras cp ON c.cli_codigo = cp.ped_cliente
      WHERE ${baseConds.join(' AND ')}
      ORDER BY dias ASC, cliente
    `;

    const result = await db.query(query, baseParams);

    const data = result.rows.map((r: any) => ({
      cliente:       r.cliente,
      estado:        r.estado || '',
      industria:     r.industria,
      vendedor_nome: r.vendedor_nome || '—',
      valor:         parseFloat(r.valor)  || 0,
      qtd:           parseFloat(r.qtd)    || 0,
      data_ultima:   r.data_ultima,
      dias:          Number(r.dias) === 9999 ? 9999 : Number(r.dias) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[ultimasComprasHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/mapa-3-anos
export async function mapa3AnosHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { anoBase, industria, cliente, modo, categoria } = req.query;

    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }

    const ano     = Number(anoBase) || new Date().getFullYear();
    const anos    = [ano, ano - 1, ano - 2];
    const isMes   = String(categoria) !== 'codigo';
    const isValor = String(modo)      !== 'quantidade';

    const chaveExpr = isMes
      ? `TO_CHAR(p.ped_data, 'MM')`
      : `TRIM(ip.ite_produto)`;

    const valorExpr = isValor
      ? `SUM(ip.ite_totliquido)`
      : `SUM(ip.ite_quant)`;

    const params: any[] = [anos[0], anos[1], anos[2], Number(industria)];
    let pc = 5;
    const extra: string[] = [];

    if (cliente && cliente !== 'ALL') {
      extra.push(`p.ped_cliente = $${pc}`);
      params.push(Number(cliente)); pc++;
    }

    const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT
        ${chaveExpr}                           AS chave,
        EXTRACT(YEAR FROM p.ped_data)::INTEGER AS ano,
        ${valorExpr}::NUMERIC                  AS valor
      FROM pedidos p
      JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
      WHERE p.ped_situacao IN ('P','F')
        AND EXTRACT(YEAR FROM p.ped_data) IN ($1, $2, $3)
        AND p.ped_industria = $4
        ${extraWhere}
      GROUP BY ${chaveExpr}, EXTRACT(YEAR FROM p.ped_data)
      ORDER BY ${chaveExpr}, EXTRACT(YEAR FROM p.ped_data) DESC
    `, params);

    const data = result.rows.map((r: any) => ({
      chave: r.chave,
      ano:   Number(r.ano),
      valor: parseFloat(r.valor) || 0,
    }));

    res.json({ success: true, data, anos });
  } catch (err: any) {
    console.error('[mapa3AnosHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/itens-nunca-comprados
export async function itensNuncaCompradosHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { industria, cliente } = req.query;

    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }
    if (!cliente || cliente === 'ALL') {
      return res.status(400).json({ success: false, error: 'Cliente obrigatório' });
    }

    const result = await db.query(`
      SELECT
        TRIM(p.pro_codprod)              AS codigo,
        p.pro_nome                       AS descricao,
        COALESCE(p.pro_aplicacao, '')    AS aplicacao
      FROM cad_prod p
      WHERE p.pro_industria = $1
        AND p.pro_status = true
        AND NOT EXISTS (
          SELECT 1
          FROM itens_ped ip
          JOIN pedidos ped ON TRIM(ip.ite_pedido) = TRIM(ped.ped_pedido)
          WHERE TRIM(ip.ite_produto) = TRIM(p.pro_codprod)
            AND ped.ped_cliente   = $2
            AND ped.ped_industria = $1
            AND ped.ped_situacao <> 'C'
        )
      ORDER BY TRIM(p.pro_codprod)
    `, [Number(industria), Number(cliente)]);

    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (err: any) {
    console.error('[itensNuncaCompradosHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/grupo-lojas
export async function grupoLojasHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }
    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }

    const result = await db.query(`
      SELECT
        c.cli_redeloja                               AS grupo,
        c.cli_nomred                                 AS cliente,
        TRIM(p.ped_pedido)                           AS pedido,
        p.ped_data                                   AS data,
        p.ped_totliq::NUMERIC                        AS total,
        SUM(i.ite_quant)::NUMERIC                    AS quant
      FROM pedidos p
      JOIN itens_ped i ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      JOIN clientes c ON p.ped_cliente = c.cli_codigo
      WHERE p.ped_data BETWEEN $1::date AND $2::date
        AND p.ped_industria = $3
        AND p.ped_situacao IN ('P', 'F')
        AND c.cli_redeloja IS NOT NULL
        AND TRIM(c.cli_redeloja) <> ''
      GROUP BY c.cli_redeloja, c.cli_nomred, p.ped_pedido, p.ped_data, p.ped_totliq
      ORDER BY c.cli_redeloja, c.cli_nomred, p.ped_data DESC
    `, [dataInicial, dataFinal, Number(industria)]);

    const data = result.rows.map((r: any) => ({
      grupo:   r.grupo,
      cliente: r.cliente,
      pedido:  r.pedido,
      data:    r.data,
      total:   parseFloat(r.total) || 0,
      quant:   parseFloat(r.quant) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[grupoLojasHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/comparativo-clientes
export async function comparativoClientesHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, clienteRef, clienteAlvo, modo } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }
    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }
    if (!clienteRef || !clienteAlvo) {
      return res.status(400).json({ success: false, error: 'Selecione os dois clientes' });
    }
    if (String(clienteRef) === String(clienteAlvo)) {
      return res.status(400).json({ success: false, error: 'Clientes devem ser diferentes' });
    }

    const modoFlag = String(modo).toUpperCase() === 'FULL' ? 'FULL' : 'GAP';

    const result = await db.query(`
      WITH ref AS (
        SELECT
          TRIM(ip.ite_produto)           AS codigo,
          MAX(COALESCE(pr.pro_nome, ip.ite_produto)) AS descricao,
          SUM(ip.ite_quant)::NUMERIC     AS qtd,
          SUM(ip.ite_totliquido)::NUMERIC AS val
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        LEFT JOIN cad_prod pr ON TRIM(pr.pro_codprod) = TRIM(ip.ite_produto)
                              AND pr.pro_industria = p.ped_industria
        WHERE p.ped_industria  = $3
          AND p.ped_cliente    = $4
          AND p.ped_situacao  IN ('P','F')
          AND p.ped_data BETWEEN $1::date AND $2::date
        GROUP BY TRIM(ip.ite_produto)
      ),
      alvo AS (
        SELECT
          TRIM(ip.ite_produto)            AS codigo,
          SUM(ip.ite_quant)::NUMERIC      AS qtd,
          SUM(ip.ite_totliquido)::NUMERIC  AS val
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria  = $3
          AND p.ped_cliente    = $5
          AND p.ped_situacao  IN ('P','F')
          AND p.ped_data BETWEEN $1::date AND $2::date
        GROUP BY TRIM(ip.ite_produto)
      )
      SELECT
        r.codigo,
        r.descricao,
        r.qtd  AS qtd_ref,
        r.val  AS val_ref,
        COALESCE(a.qtd, 0) AS qtd_alvo,
        COALESCE(a.val, 0) AS val_alvo
      FROM ref r
      ${modoFlag === 'FULL' ? 'INNER JOIN alvo a ON a.codigo = r.codigo' : 'LEFT JOIN alvo a ON a.codigo = r.codigo'}
      ${modoFlag === 'GAP'  ? 'WHERE COALESCE(a.qtd, 0) = 0' : ''}
      ORDER BY r.descricao
    `, [dataInicial, dataFinal, Number(industria), Number(clienteRef), Number(clienteAlvo)]);

    const data = result.rows.map((r: any) => ({
      codigo:   r.codigo,
      descricao: r.descricao,
      qtd_ref:  parseFloat(r.qtd_ref)  || 0,
      val_ref:  parseFloat(r.val_ref)  || 0,
      qtd_alvo: parseFloat(r.qtd_alvo) || 0,
      val_alvo: parseFloat(r.val_alvo) || 0,
    }));

    res.json({ success: true, data, total: data.length, modo: modoFlag });
  } catch (err: any) {
    console.error('[comparativoClientesHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/mapa-mensal-itens
export async function mapaMensalItensHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, itemCode, grupo } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }
    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria é obrigatória' });
    }

    const grupoFlag = String(grupo) === 'true';
    const params: any[] = [dataInicial, dataFinal, Number(industria)];
    let pc = 4;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P', 'F')`,
      `p.ped_industria = $3`,
    ];

    if (cliente && cliente !== 'ALL') {
      if (grupoFlag) {
        conditions.push(`c.cli_redeloja = (SELECT cli_redeloja FROM clientes WHERE cli_codigo = $${pc})`);
      } else {
        conditions.push(`p.ped_cliente = $${pc}`);
      }
      params.push(Number(cliente)); pc++;
    }
    if (grupoFlag) {
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
    }
    if (itemCode && String(itemCode).trim()) {
      conditions.push(`UPPER(TRIM(ip.ite_produto)) LIKE UPPER($${pc})`);
      params.push(`%${String(itemCode).trim()}%`); pc++;
    }

    const result = await db.query(`
      SELECT
        TRIM(ip.ite_produto)                              AS codigo,
        MAX(COALESCE(pr.pro_nome, ip.ite_produto))        AS descricao,
        TO_CHAR(p.ped_data, 'MM/YYYY')                    AS mes,
        SUM(ip.ite_quant)::NUMERIC                        AS qtd
      FROM itens_ped ip
      JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      LEFT JOIN cad_prod pr ON TRIM(pr.pro_codprod) = TRIM(ip.ite_produto)
                            AND pr.pro_industria = p.ped_industria
      WHERE ${conditions.join(' AND ')}
      GROUP BY TRIM(ip.ite_produto), TO_CHAR(p.ped_data, 'MM/YYYY')
      HAVING SUM(ip.ite_quant) > 0
      ORDER BY TRIM(ip.ite_produto), TO_CHAR(p.ped_data, 'MM/YYYY')
    `, params);

    const data = result.rows.map((r: any) => ({
      ...r,
      qtd: parseFloat(r.qtd) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[mapaMensalItensHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/mapa-vendas
// Retorna: cliente_nome, industria_nome, mes, valor, qtd
export async function mapaVendasHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, vendedor, grupo } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const grupoFlag = String(grupo) === 'true';
    const params: any[] = [dataInicial, dataFinal];
    let paramCount = 3;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P', 'F')`,
    ];

    // Indústria
    if (industria && industria !== 'ALL') {
      conditions.push(`p.ped_industria = $${paramCount}`);
      params.push(Number(industria));
      paramCount++;
    }

    // Vendedor
    if (vendedor && vendedor !== 'ALL') {
      conditions.push(`p.ped_vendedor = $${paramCount}`);
      params.push(Number(vendedor));
      paramCount++;
    }

    // Cliente / Rede
    if (cliente && cliente !== 'ALL') {
      if (grupoFlag) {
        conditions.push(
          `c.cli_redeloja = (SELECT cli_redeloja FROM clientes WHERE cli_codigo = $${paramCount})`
        );
      } else {
        conditions.push(`p.ped_cliente = $${paramCount}`);
      }
      params.push(Number(cliente));
      paramCount++;
    }

    const clientCol = grupoFlag
      ? `c.cli_redeloja`
      : `COALESCE(c.cli_nomred, 'CLIENTE EXCLUÍDO')`;

    if (grupoFlag) {
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
    }

    const query = `
      SELECT
        ${clientCol} AS cliente_nome,
        f.for_nomered AS industria_nome,
        TO_CHAR(p.ped_data, 'MM/YYYY') AS mes,
        SUM(ip.ite_totliquido)::numeric AS valor,
        SUM(ip.ite_quant)::numeric AS qtd,
        MAX(v.ven_nome) AS vendedor_nome
      FROM pedidos p
      JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      JOIN fornecedores f ON p.ped_industria = f.for_codigo
      LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
      WHERE ${conditions.join(' AND ')}
      GROUP BY 1, 2, 3
      ORDER BY 2, 1
    `;

    const result = await db.query(query, params);

    const data = result.rows.map((r: any) => ({
      ...r,
      valor: parseFloat(r.valor) || 0,
      qtd:   parseFloat(r.qtd)   || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[mapaVendasHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/sellout-real — dados reais de Sellout (crm_sellout)
export async function selloutRealHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, cliente, viewBy } = req.query;
    const isGrupo = viewBy === 'grupo';

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const params: any[] = [dataInicial, dataFinal];
    let pc = 3;
    const conditions: string[] = [
      `s.periodo::date BETWEEN $1::date AND $2::date`,
    ];

    if (industria && industria !== 'ALL') {
      conditions.push(`s.for_codigo = $${pc}`); params.push(Number(industria)); pc++;
    }
    if (cliente && cliente !== 'ALL') {
      conditions.push(`s.cli_codigo = $${pc}`); params.push(Number(cliente)); pc++;
    }

    const clienteNomeExpr = isGrupo
      ? `COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, 'EXCLUÍDO')`
      : `COALESCE(c.cli_nomred, 'EXCLUÍDO')`;

    const groupByClause = isGrupo
      ? `COALESCE(NULLIF(TRIM(c.cli_redeloja), ''), c.cli_nomred, 'EXCLUÍDO'), f.for_nomered, EXTRACT(YEAR FROM s.periodo::date), EXTRACT(MONTH FROM s.periodo::date)`
      : `s.cli_codigo, c.cli_nomred, f.for_nomered, EXTRACT(YEAR FROM s.periodo::date), EXTRACT(MONTH FROM s.periodo::date)`;

    const result = await db.query(`
      SELECT
        ${isGrupo ? '0' : 's.cli_codigo'}        AS cliente_id,
        ${clienteNomeExpr}                        AS cliente_nome,
        f.for_nomered                             AS industria_nome,
        EXTRACT(YEAR  FROM s.periodo::date)::INTEGER AS ano,
        EXTRACT(MONTH FROM s.periodo::date)::INTEGER AS mes,
        SUM(s.valor)::NUMERIC                     AS valor,
        SUM(s.quantidade)::NUMERIC                AS quantidade
      FROM crm_sellout s
      LEFT JOIN clientes   c ON s.cli_codigo = c.cli_codigo
      LEFT JOIN fornecedores f ON s.for_codigo = f.for_codigo
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${groupByClause}
      ORDER BY cliente_nome, ano, mes
    `, params);

    const data = result.rows.map((r: any) => ({
      ...r,
      valor:      parseFloat(r.valor)      || 0,
      quantidade: parseFloat(r.quantidade) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[selloutRealHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/curva-abc-produtos
// Params: dataInicial, dataFinal, industria (ALL|id), vendedor (ALL|id), cliente (ALL|id), redeloja (ALL|text)
export async function curvaAbcProdutosHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, vendedor, cliente, redeloja } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const params: any[] = [dataInicial, dataFinal];
    let pc = 3;
    const filters: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P','F')`,
    ];

    if (industria && industria !== 'ALL') {
      filters.push(`p.ped_industria = $${pc++}`);
      params.push(Number(industria));
    }
    if (vendedor && vendedor !== 'ALL') {
      filters.push(`p.ped_vendedor = $${pc++}`);
      params.push(Number(vendedor));
    }
    if (cliente && cliente !== 'ALL') {
      filters.push(`p.ped_cliente = $${pc++}`);
      params.push(Number(cliente));
    }

    const needsCliJoin = redeloja && redeloja !== 'ALL';
    if (needsCliJoin) {
      filters.push(`cli_join.cli_redeloja = $${pc++}`);
      params.push(String(redeloja));
    }

    const where = filters.join(' AND ');
    const cliJoin = needsCliJoin
      ? `JOIN clientes cli_join ON cli_join.cli_codigo = p.ped_cliente`
      : '';

    const result = await db.query(`
      WITH vendas AS (
        SELECT
          TRIM(i.ite_produto)                                          AS codigo,
          COALESCE(pr.pro_nome, TRIM(i.ite_produto))                  AS nome,
          SUM(i.ite_quant)::NUMERIC                                    AS qtd,
          COALESCE(SUM(i.ite_totliquido), 0)::NUMERIC                 AS valor
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        ${cliJoin}
        LEFT JOIN cad_prod pr
          ON TRIM(pr.pro_codprod) = TRIM(i.ite_produto)
          AND pr.pro_industria = p.ped_industria
        WHERE ${where}
        GROUP BY TRIM(i.ite_produto), COALESCE(pr.pro_nome, TRIM(i.ite_produto))
        HAVING SUM(i.ite_totliquido) > 0
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY valor DESC)       AS ranking,
          SUM(valor)   OVER ()                          AS grand_total,
          SUM(valor)   OVER (ORDER BY valor DESC
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS acumulado
        FROM vendas
      )
      SELECT
        ranking::INTEGER,
        codigo,
        nome,
        qtd,
        valor,
        ROUND((valor / NULLIF(grand_total, 0)) * 100, 2)       AS pct_individual,
        ROUND((acumulado / NULLIF(grand_total, 0)) * 100, 2)   AS pct_acumulado,
        CASE
          WHEN acumulado / NULLIF(grand_total, 0) <= 0.80 THEN 'A'
          WHEN acumulado / NULLIF(grand_total, 0) <= 0.95 THEN 'B'
          ELSE 'C'
        END AS curva,
        ROUND(grand_total::NUMERIC, 2) AS valor_total
      FROM ranked
      ORDER BY ranking
    `, params);

    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (err: any) {
    console.error('[curvaAbcProdutosHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/estatisticas/mapa-oportunidades
// Params: industria (required), cliente (required), dataInicial (required), dataFinal (required), somenteGap (optional, default 'true')
export async function mapaOportunidadesHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { industria, cliente, dataInicial, dataFinal, somenteGap, uf } = req.query;

    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }
    if (!cliente || cliente === 'ALL') {
      return res.status(400).json({ success: false, error: 'Cliente obrigatório' });
    }
    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const somenteGapFlag = String(somenteGap) !== 'false';
    const ufParam = uf && String(uf).trim() ? String(uf).toUpperCase().trim() : null;
    const indId  = Number(industria);
    const cliId  = Number(cliente);

    const params: any[] = [indId, dataInicial, dataFinal, cliId];
    if (ufParam) params.push(ufParam);

    const result = await db.query(`
      WITH mercado AS (
        SELECT
          TRIM(ip.ite_produto)                                         AS cod,
          COUNT(DISTINCT DATE_TRUNC('month', p.ped_data))::INTEGER     AS freq_m,
          SUM(ip.ite_quant)::NUMERIC                                   AS qtd_m
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        ${ufParam ? 'JOIN clientes cl_mkt ON cl_mkt.cli_codigo = p.ped_cliente AND UPPER(TRIM(cl_mkt.cli_uf)) = $5' : ''}
        WHERE p.ped_industria = $1
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY TRIM(ip.ite_produto)
      ),
      cli AS (
        SELECT
          TRIM(ip.ite_produto)                                         AS cod,
          COUNT(DISTINCT DATE_TRUNC('month', p.ped_data))::INTEGER     AS freq_c,
          SUM(ip.ite_quant)::NUMERIC                                   AS qtd_c
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_cliente   = $4
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY TRIM(ip.ite_produto)
      ),
      pontos AS (
        SELECT
          TRIM(ip.ite_produto)                                         AS cod,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                       AS pontos_venda
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        ${ufParam ? 'JOIN clientes cl_pv ON cl_pv.cli_codigo = p.ped_cliente AND UPPER(TRIM(cl_pv.cli_uf)) = $5' : ''}
        WHERE p.ped_industria = $1
          AND p.ped_cliente  != $4
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY TRIM(ip.ite_produto)
      )
      SELECT
        TRIM(cp.pro_codprod)                                           AS codigo,
        COALESCE(cp.pro_nome, TRIM(cp.pro_codprod))                   AS descricao,
        COALESCE(g.gru_nome, 'SEM GRUPO')                             AS familia,
        COALESCE(cp.pro_aplicacao, '')                                 AS aplicacao,
        COALESCE(m.freq_m, 0)                                         AS freq_mercado,
        COALESCE(c.freq_c, 0)                                         AS freq_cliente,
        (COALESCE(m.freq_m, 0) - COALESCE(c.freq_c, 0))              AS gap_freq,
        COALESCE(m.qtd_m, 0)::NUMERIC                                 AS qtd_mercado,
        COALESCE(c.qtd_c, 0)::NUMERIC                                 AS qtd_cliente,
        COALESCE(pv.pontos_venda, 0)                                   AS pontos_venda,
        CASE
          WHEN ci.cli_tabela IS NULL OR tp.itab_precobruto IS NULL THEN NULL
          WHEN COALESCE(tp.itab_precopromo, 0) > 0 THEN ROUND(
            tp.itab_precopromo::NUMERIC
            * (1 + COALESCE(tp.itab_ipi, 0)::NUMERIC / 100.0)
            * (1 + COALESCE(tp.itab_st,  0)::NUMERIC / 100.0)
          , 2)
          ELSE ROUND(
            tp.itab_precobruto::NUMERIC
            * CASE WHEN COALESCE(ci.cli_desc1,  0) > 0 THEN (1 - ci.cli_desc1/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc2,  0) > 0 THEN (1 - ci.cli_desc2/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc3,  0) > 0 THEN (1 - ci.cli_desc3/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc4,  0) > 0 THEN (1 - ci.cli_desc4/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc5,  0) > 0 THEN (1 - ci.cli_desc5/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc6,  0) > 0 THEN (1 - ci.cli_desc6/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc7,  0) > 0 THEN (1 - ci.cli_desc7/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc8,  0) > 0 THEN (1 - ci.cli_desc8/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc9,  0) > 0 THEN (1 - ci.cli_desc9/100.0)  ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc10, 0) > 0 THEN (1 - ci.cli_desc10/100.0) ELSE 1 END
            * CASE WHEN COALESCE(ci.cli_desc11, 0) > 0 THEN (1 - ci.cli_desc11/100.0) ELSE 1 END
            * (1 + COALESCE(tp.itab_ipi, 0)::NUMERIC / 100.0)
            * (1 + COALESCE(tp.itab_st,  0)::NUMERIC / 100.0)
          , 2)
        END                                                            AS valor_cliente,
        CASE
          WHEN COALESCE(m.qtd_m, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(c.qtd_c, 0) / m.qtd_m) * 100, 1)
        END                                                            AS pct_captacao
      FROM cad_prod cp
      LEFT JOIN grupos g   ON g.gru_codigo  = cp.pro_grupo
      LEFT JOIN mercado m  ON m.cod = TRIM(cp.pro_codprod)
      LEFT JOIN cli c      ON c.cod = TRIM(cp.pro_codprod)
      LEFT JOIN pontos pv  ON pv.cod = TRIM(cp.pro_codprod)
      LEFT JOIN cli_ind ci ON ci.cli_codigo = $4 AND ci.cli_forcodigo = $1
      LEFT JOIN cad_tabelaspre tp ON tp.itab_idprod = cp.pro_id AND tp.itab_tabela = ci.cli_tabela
      WHERE cp.pro_industria = $1
        AND cp.pro_status = true
        ${somenteGapFlag ? 'AND COALESCE(m.freq_m, 0) > 0' : ''}
      ORDER BY COALESCE(m.freq_m, 0) DESC,
               (COALESCE(m.freq_m, 0) - COALESCE(c.freq_c, 0)) DESC
    `, params);

    const data = result.rows.map((r: any) => ({
      codigo:       r.codigo,
      descricao:    r.descricao,
      familia:      r.familia,
      aplicacao:    r.aplicacao,
      freq_mercado: Number(r.freq_mercado),
      freq_cliente: Number(r.freq_cliente),
      gap_freq:     Number(r.gap_freq),
      qtd_mercado:   parseFloat(r.qtd_mercado) || 0,
      qtd_cliente:   parseFloat(r.qtd_cliente) || 0,
      pontos_venda:  Number(r.pontos_venda) || 0,
      valor_cliente: r.valor_cliente !== null && r.valor_cliente !== undefined ? parseFloat(r.valor_cliente) : null,
      pct_captacao:  parseFloat(r.pct_captacao) || 0,
    }));

    const total        = data.length;
    const criticos     = data.filter((r: any) => r.freq_mercado >= 6 && r.freq_cliente === 0).length;
    const comCompra    = data.filter((r: any) => r.qtd_cliente > 0).length;
    const taxaCaptacao = total > 0 ? Math.round((comCompra / total) * 100) : 0;
    const qtdGapTotal  = data.reduce((s: number, r: any) => s + (r.qtd_mercado - r.qtd_cliente), 0);

    res.json({
      success: true,
      data,
      total,
      kpis: { total, criticos, taxaCaptacao, qtdGapTotal },
    });
  } catch (err: any) {
    console.error('[mapaOportunidadesHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
