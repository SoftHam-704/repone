import { Request, Response } from 'express';
import { getModoVendedor, vendedorFilterSQL } from '../../shared/permissions';
import { excluiInativoSQL } from '../../shared/utils/cliente-ativo';

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
      LEFT JOIN public.cidades cid ON c.cli_idcidade = cid.cid_codigo
      LEFT JOIN vendedores v ON c.cli_vendedor = v.ven_codigo
      LEFT JOIN vendas_resumo vr ON c.cli_codigo = vr.v_cliente
      LEFT JOIN mix_produtos mp ON c.cli_codigo = mp.m_cliente
      WHERE ${excluiInativoSQL('c')}
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
      // Modo do tenant: 1x1 → cli_vendedor (titular); 1xN → indústrias do vendedor (vendedor_ind)
      const modo = await getModoVendedor(db);
      const vcl = vendedorFilterSQL(modo, Number(vendedor), { cliAlias: 'c', pedAlias: 'p' });
      if (vcl) conditions.push(vcl);
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
    if (vendedor  && vendedor  !== 'ALL') { conditions.push(`p.ped_vendedor = $${pc}`); params.push(Number(vendedor)); pc++; }
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

    // Agrega sem JOIN em cad_prod para evitar dobra quando há duplicatas
    // de pro_codprod com formatações distintas (mas mesmo pro_codigonormalizado).
    const result = await db.query(`
      WITH agg AS (
        SELECT
          c.cli_codigo,
          COALESCE(c.cli_nomred, 'EXCLUÍDO') AS cliente_nome,
          TRIM(i.ite_produto)                AS produto_codigo,
          i.ite_codigonormalizado            AS cod_norm,
          p.ped_industria                    AS industria,
          SUM(i.ite_quant)::NUMERIC          AS quantidade
        FROM pedidos p
        JOIN itens_ped i ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        JOIN clientes c  ON p.ped_cliente = c.cli_codigo
        WHERE p.ped_data BETWEEN $1::date AND $2::date
          AND p.ped_industria = $3
          AND p.ped_situacao IN ('P','F')
          AND ${excluiInativoSQL('c')}
        GROUP BY c.cli_codigo, c.cli_nomred, TRIM(i.ite_produto),
                 i.ite_codigonormalizado, p.ped_industria
        HAVING COUNT(DISTINCT TRIM(p.ped_pedido)) = 1
      )
      SELECT
        a.cliente_nome,
        a.produto_codigo,
        COALESCE((
          SELECT pr.pro_nome
          FROM cad_prod pr
          WHERE pr.pro_industria = a.industria
            AND pr.pro_codigonormalizado = a.cod_norm
          LIMIT 1
        ), a.produto_codigo) AS produto_desc,
        a.quantidade
      FROM agg a
      ORDER BY a.cliente_nome, a.produto_codigo
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
    const vcl        = vendedorFilterSQL(await getModoVendedor(db), venInt, { cliAlias: 'c', clienteScoped: true });
    const venFilter  = vcl ? `AND ${vcl}` : '';

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
      LEFT JOIN public.cidades cid ON c.cli_idcidade = cid.cid_codigo
      LEFT JOIN vendedores v ON c.cli_vendedor = v.ven_codigo
      LEFT JOIN historico h ON c.cli_codigo = h.cli
      WHERE c.cli_tipopes = 'A'
        AND ${excluiInativoSQL('c')}   -- exclui Filial de Rede + clientes marcados p/ ignorar
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
    const modoVend  = await getModoVendedor(db);

    // Para grupo=true, mantém comportamento original (somente clientes com compras)
    if (grupoFlag) {
      const params: any[] = [dataInicial, dataFinal];
      let pc = 3;
      const conditions: string[] = [
        `p.ped_data BETWEEN $1::date AND $2::date`,
        `p.ped_situacao IN ('P','F')`,
      ];
      if (industria && industria !== 'ALL') { conditions.push(`p.ped_industria = $${pc}`); params.push(Number(industria)); pc++; }
      if (vendedor  && vendedor  !== 'ALL') {
        const vcl = vendedorFilterSQL(modoVend, Number(vendedor), { cliAlias: 'c', pedAlias: 'p' });
        if (vcl) conditions.push(vcl);
      }
      if (cliente   && cliente   !== 'ALL') {
        conditions.push(`c.cli_redeloja = (SELECT cli_redeloja FROM clientes WHERE cli_codigo = $${pc})`);
        params.push(Number(cliente)); pc++;
      }
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
      const cliExpr = `COALESCE(NULLIF(c.cli_redeloja,''), c.cli_nomred)`;
      const where = conditions.join(' AND ');
      const query = modoUlt
        ? `SELECT DISTINCT ON (${cliExpr}, f.for_nomered) ${cliExpr} AS cliente, COALESCE(cid.cid_uf, c.cli_uf, '') AS estado, f.for_nomered AS industria, COALESCE(v.ven_nome, '—') AS vendedor_nome, p.ped_totliq::NUMERIC AS valor, (SELECT SUM(ip2.ite_quant) FROM itens_ped ip2 WHERE TRIM(ip2.ite_pedido) = TRIM(p.ped_pedido))::NUMERIC AS qtd, p.ped_data AS data_ultima, (CURRENT_DATE - p.ped_data::date)::INTEGER AS dias FROM pedidos p LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo LEFT JOIN public.cidades cid ON c.cli_idcidade = cid.cid_codigo JOIN fornecedores f ON p.ped_industria = f.for_codigo LEFT JOIN vendedores v ON c.cli_vendedor = v.ven_codigo WHERE ${where} ORDER BY ${cliExpr}, f.for_nomered, p.ped_data DESC`
        : `SELECT ${cliExpr} AS cliente, MAX(COALESCE(cid.cid_uf, c.cli_uf, '')) AS estado, f.for_nomered AS industria, MAX(COALESCE(v.ven_nome, '—')) AS vendedor_nome, SUM(p.ped_totliq)::NUMERIC AS valor, COALESCE(SUM(iq.qtd), 0)::NUMERIC AS qtd, MAX(p.ped_data) AS data_ultima, (CURRENT_DATE - MAX(p.ped_data)::date)::INTEGER AS dias FROM pedidos p LEFT JOIN (SELECT TRIM(ip.ite_pedido) AS ped_id, SUM(ip.ite_quant) AS qtd FROM itens_ped ip GROUP BY TRIM(ip.ite_pedido)) iq ON TRIM(p.ped_pedido) = iq.ped_id LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo LEFT JOIN public.cidades cid ON c.cli_idcidade = cid.cid_codigo JOIN fornecedores f ON p.ped_industria = f.for_codigo LEFT JOIN vendedores v ON c.cli_vendedor = v.ven_codigo WHERE ${where} GROUP BY ${cliExpr}, f.for_nomered`;
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
    if (vendedor  && vendedor  !== 'ALL') {
      const vcl = vendedorFilterSQL(modoVend, Number(vendedor), { cliAlias: 'cli', pedAlias: 'p' });
      if (vcl) pedConds.push(vcl);
    }

    const baseParams: any[] = [...pedParams];
    let basePc = pedPc;
    const baseConds: string[] = [`c.cli_tipopes = 'A'`, excluiInativoSQL('c')];
    if (cliente && cliente !== 'ALL') { baseConds.push(`c.cli_codigo = $${basePc}`); baseParams.push(Number(cliente)); basePc++; }

    // CTE compras: JOIN com clientes cli pra trazer cli_vendedor (titular da carteira)
    // — vendedor exibido = titular do cliente, não digitador do pedido.
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
          LEFT JOIN clientes cli ON cli.cli_codigo = p.ped_cliente
          LEFT JOIN vendedores v ON cli.cli_vendedor = v.ven_codigo
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
            COALESCE(SUM(iq.qtd), 0)::NUMERIC AS qtd,
            MAX(p.ped_data) AS data_ultima
          FROM pedidos p
          LEFT JOIN (
            SELECT TRIM(ip.ite_pedido) AS ped_id, SUM(ip.ite_quant) AS qtd
            FROM itens_ped ip GROUP BY TRIM(ip.ite_pedido)
          ) iq ON TRIM(p.ped_pedido) = iq.ped_id
          JOIN fornecedores f ON p.ped_industria = f.for_codigo
          LEFT JOIN clientes cli ON cli.cli_codigo = p.ped_cliente
          LEFT JOIN vendedores v ON cli.cli_vendedor = v.ven_codigo
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
      LEFT JOIN public.cidades cid ON c.cli_idcidade = cid.cid_codigo
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

    // Agrega sem JOIN em cad_prod (evita dobra por duplicatas de pro_codprod).
    // Nome do produto resolvido depois via subquery escalar por código normalizado.
    const result = await db.query(`
      WITH ref AS (
        SELECT
          TRIM(ip.ite_produto)            AS codigo,
          ip.ite_codigonormalizado        AS cod_norm,
          SUM(ip.ite_quant)::NUMERIC      AS qtd,
          SUM(ip.ite_totliquido)::NUMERIC AS val
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria  = $3
          AND p.ped_cliente    = $4
          AND p.ped_situacao  IN ('P','F')
          AND p.ped_data BETWEEN $1::date AND $2::date
        GROUP BY TRIM(ip.ite_produto), ip.ite_codigonormalizado
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
        COALESCE((
          SELECT pr.pro_nome
          FROM cad_prod pr
          WHERE pr.pro_industria = $3
            AND pr.pro_codigonormalizado = r.cod_norm
          LIMIT 1
        ), r.codigo) AS descricao,
        r.qtd  AS qtd_ref,
        r.val  AS val_ref,
        COALESCE(a.qtd, 0) AS qtd_alvo,
        COALESCE(a.val, 0) AS val_alvo
      FROM ref r
      ${modoFlag === 'FULL' ? 'INNER JOIN alvo a ON a.codigo = r.codigo' : 'LEFT JOIN alvo a ON a.codigo = r.codigo'}
      ${modoFlag === 'GAP'  ? 'WHERE COALESCE(a.qtd, 0) = 0' : ''}
      ORDER BY descricao
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

    // Agrega primeiro SEM tocar em cad_prod; o nome é resolvido via subquery
    // escalar com LIMIT 1 depois — assim duplicatas em cad_prod (pro_codprod
    // com formatações distintas mas mesmo pro_codigonormalizado) não dobram qtd.
    const result = await db.query(`
      WITH itens AS (
        SELECT
          TRIM(ip.ite_produto)            AS codigo,
          ip.ite_codigonormalizado        AS cod_norm,
          p.ped_industria                 AS industria,
          TO_CHAR(p.ped_data, 'MM/YYYY')  AS mes,
          SUM(ip.ite_quant)::NUMERIC      AS qtd
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
        WHERE ${conditions.join(' AND ')}
        GROUP BY TRIM(ip.ite_produto),
                 ip.ite_codigonormalizado,
                 p.ped_industria,
                 TO_CHAR(p.ped_data, 'MM/YYYY')
        HAVING SUM(ip.ite_quant) > 0
      )
      SELECT
        i.codigo,
        COALESCE((
          SELECT pr.pro_nome
          FROM cad_prod pr
          WHERE pr.pro_industria = i.industria
            AND pr.pro_codigonormalizado = i.cod_norm
          LIMIT 1
        ), i.codigo) AS descricao,
        i.mes,
        i.qtd
      FROM itens i
      ORDER BY i.codigo, i.mes
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

// GET /api/estatisticas/mapa-itens-cliente
// Matriz item × cliente de UMA indústria no período (quantidade vendida por peça por cliente).
// Retorna: codigo, descricao, cliente_nome, qtd  → o front pivota (linhas=itens, colunas=clientes).
export async function mapaItensClienteHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, itemCode, grupo } = req.query;

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
    if (itemCode && String(itemCode).trim()) {
      conditions.push(`UPPER(TRIM(ip.ite_produto)) LIKE UPPER($${pc})`);
      params.push(`%${String(itemCode).trim()}%`); pc++;
    }
    if (grupoFlag) {
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
    }

    // Nome do cliente (ou rede, no modo grupo). Cliente sem cadastro → fallback pelo código.
    const clienteCol = grupoFlag
      ? `c.cli_redeloja`
      : `COALESCE(NULLIF(TRIM(c.cli_nomred),''), c.cli_nome, 'CLIENTE ' || p.ped_cliente)`;

    const result = await db.query(`
      WITH itens AS (
        SELECT
          TRIM(ip.ite_produto)        AS codigo,
          ip.ite_codigonormalizado    AS cod_norm,
          p.ped_industria             AS industria,
          ${clienteCol}               AS cliente_nome,
          SUM(ip.ite_quant)::NUMERIC  AS qtd
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
        WHERE ${conditions.join(' AND ')}
        GROUP BY TRIM(ip.ite_produto), ip.ite_codigonormalizado, p.ped_industria, ${clienteCol}
        HAVING SUM(ip.ite_quant) > 0
      )
      SELECT
        i.codigo,
        COALESCE((
          SELECT pr.pro_nome FROM cad_prod pr
          WHERE pr.pro_industria = i.industria AND pr.pro_codigonormalizado = i.cod_norm
          LIMIT 1
        ), i.codigo) AS descricao,
        i.cliente_nome,
        i.qtd
      FROM itens i
      ORDER BY i.codigo, i.cliente_nome
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error('[mapaItensClienteHandler]', err);
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

    // Métrica de classificação da curva (Pareto): faturamento (valor) ou quantidade
    const mCol = String(req.query.metrica || 'valor') === 'quantidade' ? 'qtd' : 'valor';

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

    // JOIN cli_join necessário só p/ filtro de rede
    const needsCliJoin = !!(redeloja && redeloja !== 'ALL');
    if (redeloja && redeloja !== 'ALL') {
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
          ROW_NUMBER() OVER (ORDER BY ${mCol} DESC)     AS ranking,
          SUM(${mCol}) OVER ()                          AS grand_total,
          SUM(valor)   OVER ()                          AS valor_total_all,
          SUM(qtd)     OVER ()                          AS qtd_total_all,
          SUM(${mCol}) OVER (ORDER BY ${mCol} DESC
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS acumulado
        FROM vendas
      )
      SELECT
        ranking::INTEGER,
        codigo,
        nome,
        qtd,
        valor,
        ROUND((${mCol} / NULLIF(grand_total, 0)) * 100, 2)     AS pct_individual,
        ROUND((acumulado / NULLIF(grand_total, 0)) * 100, 2)   AS pct_acumulado,
        CASE
          WHEN acumulado / NULLIF(grand_total, 0) <= 0.80 THEN 'A'
          WHEN acumulado / NULLIF(grand_total, 0) <= 0.95 THEN 'B'
          ELSE 'C'
        END AS curva,
        ROUND(valor_total_all::NUMERIC, 2) AS valor_total,
        ROUND(qtd_total_all::NUMERIC, 2)   AS qtd_total
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
          COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) AS cod,
          COUNT(DISTINCT DATE_TRUNC('month', p.ped_data))::INTEGER                  AS freq_m,
          SUM(ip.ite_quant)::NUMERIC                                                AS qtd_m
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        ${ufParam ? 'JOIN clientes cl_mkt ON cl_mkt.cli_codigo = p.ped_cliente AND UPPER(TRIM(cl_mkt.cli_uf)) = $5' : ''}
        WHERE p.ped_industria = $1
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY 1
      ),
      cli AS (
        SELECT
          COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) AS cod,
          COUNT(DISTINCT DATE_TRUNC('month', p.ped_data))::INTEGER                  AS freq_c,
          SUM(ip.ite_quant)::NUMERIC                                                AS qtd_c
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_cliente   = $4
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY 1
      ),
      pontos AS (
        SELECT
          COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) AS cod,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                                     AS pontos_venda
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        ${ufParam ? 'JOIN clientes cl_pv ON cl_pv.cli_codigo = p.ped_cliente AND UPPER(TRIM(cl_pv.cli_uf)) = $5' : ''}
        WHERE p.ped_industria = $1
          AND p.ped_cliente  != $4
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY 1
      ),
      all_products AS (
        SELECT COALESCE(NULLIF(TRIM(cp.pro_codigonormalizado),''), TRIM(cp.pro_codprod)) AS cod,
               cp.pro_id, cp.pro_nome, cp.pro_aplicacao, cp.pro_grupo
        FROM cad_prod cp
        WHERE cp.pro_industria = $1 AND cp.pro_status IS NOT FALSE
        UNION
        SELECT m.cod, NULL::integer, m.cod, '', NULL::integer
        FROM mercado m
        WHERE NOT EXISTS (
          SELECT 1 FROM cad_prod cp
          WHERE COALESCE(NULLIF(TRIM(cp.pro_codigonormalizado),''), TRIM(cp.pro_codprod)) = m.cod
            AND cp.pro_industria = $1
            AND cp.pro_status IS NOT FALSE
        )
      )
      SELECT
        ap.cod                                                         AS codigo,
        COALESCE(ap.pro_nome, ap.cod)                                 AS descricao,
        COALESCE(g.gru_nome, 'SEM GRUPO')                             AS familia,
        COALESCE(ap.pro_aplicacao, '')                                 AS aplicacao,
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
      FROM all_products ap
      LEFT JOIN grupos g   ON g.gru_codigo  = ap.pro_grupo
      LEFT JOIN mercado m  ON m.cod = ap.cod
      LEFT JOIN cli c      ON c.cod = ap.cod
      LEFT JOIN pontos pv  ON pv.cod = ap.cod
      LEFT JOIN cli_ind ci ON ci.cli_codigo = $4 AND ci.cli_forcodigo = $1
      LEFT JOIN cad_tabelaspre tp ON tp.itab_idprod = ap.pro_id AND tp.itab_tabela = ci.cli_tabela
      WHERE ${somenteGapFlag ? 'COALESCE(m.freq_m, 0) > 0' : 'TRUE'}
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

// ─── GET /api/estatisticas/mapa-industria ─────────────────────────────────────
export async function mapaIndustriaHandler(req: Request | any, res: Response) {
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

    if (industria && industria !== 'ALL') {
      conditions.push(`p.ped_industria = $${paramCount}`);
      params.push(Number(industria));
      paramCount++;
    }

    if (vendedor && vendedor !== 'ALL') {
      conditions.push(`p.ped_vendedor = $${paramCount}`);
      params.push(Number(vendedor));
      paramCount++;
    }

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

    if (grupoFlag) {
      conditions.push(`c.cli_redeloja IS NOT NULL AND TRIM(c.cli_redeloja) <> ''`);
    }

    const query = `
      SELECT
        f.for_nomered               AS industria_nome,
        TO_CHAR(p.ped_data, 'MM/YYYY') AS mes,
        SUM(ip.ite_totliquido)::numeric AS valor,
        SUM(ip.ite_quant)::numeric      AS qtd
      FROM pedidos p
      JOIN itens_ped ip ON TRIM(p.ped_pedido) = TRIM(ip.ite_pedido)
      JOIN fornecedores f ON p.ped_industria = f.for_codigo AND f.for_tipo2 = 'A'
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      WHERE ${conditions.join(' AND ')}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;

    const result = await db.query(query, params);

    const data = result.rows.map((r: any) => ({
      industria_nome: r.industria_nome,
      mes:            r.mes,
      valor:          parseFloat(r.valor) || 0,
      qtd:            parseFloat(r.qtd)   || 0,
    }));

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[mapaIndustriaHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// MISSÃO 1 — MAPA PORTFÓLIO POR INDÚSTRIA (Hamilton 2026-05-26)
// ════════════════════════════════════════════════════════════════════
// Fluxo:
//   1. Usuário escolhe a indústria
//   2. Grid esquerda mostra portfólio de itens já vendidos dessa indústria
//   3. Ao clicar em um item, grid direita mostra os clientes que compraram

// GET /estatisticas/portfolio-industria/itens?dataInicial&dataFinal&industria
// Retorna a lista de produtos vendidos da indústria no período, com totais.
export async function portfolioIndustriaItensHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }
    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }

    const indId = Number(industria);

    const result = await db.query(`
      WITH vendidos AS (
        SELECT
          COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) AS cod,
          SUM(ip.ite_quant)::NUMERIC                                                 AS qtd_total,
          SUM(ip.ite_totliquido)::NUMERIC                                            AS valor_total,
          COUNT(DISTINCT p.ped_cliente)::INTEGER                                     AS qtd_clientes,
          COUNT(DISTINCT TRIM(p.ped_pedido))::INTEGER                                AS qtd_pedidos,
          MAX(p.ped_data)                                                            AS ultima_venda
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY 1
      )
      SELECT
        v.cod                                                       AS codigo,
        COALESCE(cp.pro_nome, v.cod)                                AS descricao,
        COALESCE(g.gru_nome, 'SEM GRUPO')                           AS familia,
        v.qtd_total,
        v.valor_total,
        v.qtd_clientes,
        v.qtd_pedidos,
        v.ultima_venda
      FROM vendidos v
      LEFT JOIN cad_prod cp ON COALESCE(NULLIF(TRIM(cp.pro_codigonormalizado),''), TRIM(cp.pro_codprod)) = v.cod
                            AND cp.pro_industria = $1
      LEFT JOIN grupos g    ON g.gru_codigo = cp.pro_grupo
      ORDER BY v.qtd_total DESC, v.valor_total DESC
    `, [indId, dataInicial, dataFinal]);

    const data = result.rows.map((r: any) => ({
      codigo:       r.codigo,
      descricao:    r.descricao,
      familia:      r.familia,
      qtd_total:    parseFloat(r.qtd_total)    || 0,
      valor_total:  parseFloat(r.valor_total)  || 0,
      qtd_clientes: Number(r.qtd_clientes)     || 0,
      qtd_pedidos:  Number(r.qtd_pedidos)      || 0,
      ultima_venda: r.ultima_venda,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[portfolioIndustriaItensHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /estatisticas/portfolio-industria/clientes?dataInicial&dataFinal&industria&codigo
// Retorna os clientes que compraram o item selecionado no período.
export async function portfolioIndustriaClientesHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, codigo } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }
    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }
    if (!codigo) {
      return res.status(400).json({ success: false, error: 'Código do item obrigatório' });
    }

    const indId = Number(industria);
    const codNorm = String(codigo).trim();

    const result = await db.query(`
      SELECT
        c.cli_codigo                              AS cli_codigo,
        c.cli_nomred                              AS cli_nomred,
        COALESCE(c.cli_nome, c.cli_nomred)        AS cli_nome,
        COALESCE(c.cli_uf, '')                    AS uf,
        COALESCE(ci.cid_nome, '')                 AS cidade,
        SUM(ip.ite_quant)::NUMERIC                AS qtd_total,
        SUM(ip.ite_totliquido)::NUMERIC           AS valor_total,
        COUNT(DISTINCT TRIM(p.ped_pedido))::INTEGER AS qtd_pedidos,
        MIN(p.ped_data)                           AS primeira_compra,
        MAX(p.ped_data)                           AS ultima_compra
      FROM itens_ped ip
      JOIN pedidos p   ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
      JOIN clientes c  ON c.cli_codigo = p.ped_cliente
      LEFT JOIN public.cidades ci ON ci.cid_codigo = c.cli_idcidade
      WHERE p.ped_industria = $1
        AND p.ped_data BETWEEN $2::date AND $3::date
        AND p.ped_situacao IN ('P', 'F')
        AND COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) = $4
      GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome, c.cli_uf, ci.cid_nome
      ORDER BY valor_total DESC
    `, [indId, dataInicial, dataFinal, codNorm]);

    const data = result.rows.map((r: any) => ({
      cli_codigo:      Number(r.cli_codigo),
      cli_nomred:      r.cli_nomred,
      cli_nome:        r.cli_nome,
      uf:              r.uf,
      cidade:          r.cidade,
      qtd_total:       parseFloat(r.qtd_total)    || 0,
      valor_total:     parseFloat(r.valor_total)  || 0,
      qtd_pedidos:     Number(r.qtd_pedidos)      || 0,
      primeira_compra: r.primeira_compra,
      ultima_compra:   r.ultima_compra,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[portfolioIndustriaClientesHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// MISSÃO 2 — VENDAS NO PERÍODO + CHURN TRIMESTRAL (Hamilton 2026-05-26)
// ════════════════════════════════════════════════════════════════════
// Fluxo:
//   Lado esquerdo: pedidos do período atual (pedido a pedido)
//   Lado direito: clientes que compraram nos 3 meses imediatamente
//   anteriores ao período atual MAS não compraram dentro do período atual

// GET /estatisticas/vendas-periodo?dataInicial&dataFinal&industria&vendedor
// Pedidos do período atual.
export async function vendasPeriodoHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, vendedor } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const params: any[] = [dataInicial, dataFinal];
    let paramCount = 3;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1::date AND $2::date`,
      `p.ped_situacao IN ('P', 'F')`,
    ];

    if (industria && industria !== 'ALL') {
      conditions.push(`p.ped_industria = $${paramCount++}`);
      params.push(Number(industria));
    }
    if (vendedor && vendedor !== 'ALL') {
      conditions.push(`p.ped_vendedor = $${paramCount++}`);
      params.push(Number(vendedor));
    }

    const result = await db.query(`
      SELECT
        TRIM(p.ped_pedido)                         AS pedido,
        p.ped_data                                 AS data,
        p.ped_situacao                             AS situacao,
        COALESCE(p.ped_totliq, 0)::NUMERIC         AS valor,
        c.cli_codigo                               AS cli_codigo,
        c.cli_nomred                               AS cli_nomred,
        COALESCE(c.cli_uf, '')                     AS uf,
        f.for_codigo                               AS for_codigo,
        f.for_nomered                              AS industria_nome,
        COALESCE(v.ven_nome, '')                   AS vendedor_nome,
        (SELECT COUNT(*) FROM itens_ped ip WHERE TRIM(ip.ite_pedido) = TRIM(p.ped_pedido))::INTEGER AS qtd_itens
      FROM pedidos p
      LEFT JOIN clientes c     ON c.cli_codigo = p.ped_cliente
      LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
      LEFT JOIN vendedores v   ON v.ven_codigo = p.ped_vendedor
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.ped_data DESC, p.ped_pedido DESC
    `, params);

    const data = result.rows.map((r: any) => ({
      pedido:         r.pedido,
      data:           r.data,
      situacao:       r.situacao,
      valor:          parseFloat(r.valor) || 0,
      cli_codigo:     Number(r.cli_codigo) || 0,
      cli_nomred:     r.cli_nomred || '',
      uf:             r.uf,
      for_codigo:     Number(r.for_codigo) || 0,
      industria_nome: r.industria_nome || '',
      vendedor_nome:  r.vendedor_nome,
      qtd_itens:      Number(r.qtd_itens) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[vendasPeriodoHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /estatisticas/clientes-churn-trimestral?dataInicial&dataFinal&industria&vendedor
// Clientes que compraram no TRIMESTRE ANTERIOR ao período atual (3 meses imediatamente
// anteriores a dataInicial) mas NÃO compraram dentro do período atual.
export async function clientesChurnTrimestralHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { dataInicial, dataFinal, industria, vendedor } = req.query;

    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const params: any[] = [dataInicial, dataFinal];
    let paramCount = 3;
    const extraConditions: string[] = [`p2.ped_situacao IN ('P', 'F')`];
    const extraConditionsAtual: string[] = [`p3.ped_situacao IN ('P', 'F')`];

    if (industria && industria !== 'ALL') {
      extraConditions.push(`p2.ped_industria = $${paramCount}`);
      extraConditionsAtual.push(`p3.ped_industria = $${paramCount}`);
      params.push(Number(industria));
      paramCount++;
    }
    // Filtro de vendedor: 1x1 → cli_vendedor (exige JOIN clientes); 1xN → indústrias
    // do vendedor (vendedor_ind), direto em p2/p3.ped_industria (sem JOIN).
    const hasVendedor = !!(vendedor && vendedor !== 'ALL');
    let join2 = '', join3 = '';
    if (hasVendedor) {
      const modoVend = await getModoVendedor(db);
      const vcl2 = vendedorFilterSQL(modoVend, Number(vendedor), { cliAlias: 'cli2', pedAlias: 'p2' });
      const vcl3 = vendedorFilterSQL(modoVend, Number(vendedor), { cliAlias: 'cli3', pedAlias: 'p3' });
      if (vcl2) extraConditions.push(vcl2);
      if (vcl3) extraConditionsAtual.push(vcl3);
      if (modoVend === '1x1') {
        join2 = `JOIN clientes cli2 ON cli2.cli_codigo = p2.ped_cliente`;
        join3 = `JOIN clientes cli3 ON cli3.cli_codigo = p3.ped_cliente`;
      }
    }

    const result = await db.query(`
      WITH trimestre_anterior AS (
        -- Clientes que compraram nos 3 meses imediatamente anteriores ao período atual
        SELECT DISTINCT p2.ped_cliente
        FROM pedidos p2
        ${join2}
        WHERE p2.ped_data >= ($1::date - INTERVAL '3 months')
          AND p2.ped_data <  $1::date
          AND ${extraConditions.join(' AND ')}
      ),
      periodo_atual AS (
        -- Clientes que compraram dentro do período atual
        SELECT DISTINCT p3.ped_cliente
        FROM pedidos p3
        ${join3}
        WHERE p3.ped_data BETWEEN $1::date AND $2::date
          AND ${extraConditionsAtual.join(' AND ')}
      ),
      churn AS (
        SELECT ta.ped_cliente
        FROM trimestre_anterior ta
        WHERE NOT EXISTS (SELECT 1 FROM periodo_atual pa WHERE pa.ped_cliente = ta.ped_cliente)
      ),
      ultima_compra AS (
        SELECT p.ped_cliente,
               MAX(p.ped_data)                      AS dt_ultima,
               COUNT(DISTINCT TRIM(p.ped_pedido))   AS pedidos_trimestre,
               SUM(COALESCE(p.ped_totliq,0))::NUMERIC AS valor_trimestre
        FROM pedidos p
        WHERE p.ped_cliente IN (SELECT ped_cliente FROM churn)
          AND p.ped_data >= ($1::date - INTERVAL '3 months')
          AND p.ped_data <  $1::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY p.ped_cliente
      )
      SELECT
        c.cli_codigo                            AS cli_codigo,
        c.cli_nomred                            AS cli_nomred,
        COALESCE(c.cli_nome, c.cli_nomred)      AS cli_nome,
        COALESCE(c.cli_uf, '')                  AS uf,
        COALESCE(ci.cid_nome, '')               AS cidade,
        COALESCE(v.ven_nome, '')                AS vendedor_nome,
        u.dt_ultima                             AS data_ultima_compra,
        u.pedidos_trimestre,
        u.valor_trimestre,
        (CURRENT_DATE - u.dt_ultima::date)::INTEGER AS dias_sem_comprar
      FROM ultima_compra u
      JOIN clientes c       ON c.cli_codigo = u.ped_cliente
      LEFT JOIN public.cidades ci  ON ci.cid_codigo = c.cli_idcidade
      LEFT JOIN vendedores v ON v.ven_codigo = c.cli_vendedor
      WHERE ${excluiInativoSQL('c')}
      ORDER BY u.valor_trimestre DESC
    `, params);

    const data = result.rows.map((r: any) => ({
      cli_codigo:         Number(r.cli_codigo) || 0,
      cli_nomred:         r.cli_nomred || '',
      cli_nome:           r.cli_nome,
      uf:                 r.uf,
      cidade:             r.cidade,
      vendedor_nome:      r.vendedor_nome,
      data_ultima_compra: r.data_ultima_compra,
      pedidos_trimestre:  Number(r.pedidos_trimestre) || 0,
      valor_trimestre:    parseFloat(r.valor_trimestre) || 0,
      dias_sem_comprar:   Number(r.dias_sem_comprar) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[clientesChurnTrimestralHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// MISSÃO 3 — GAP DE CATÁLOGO (cross-sell ABC) (Hamilton 2026-05-26)
// ════════════════════════════════════════════════════════════════════
// Fluxo:
//   Usuário escolhe indústria + cliente. Sistema lista itens da indústria
//   já vendidos no mercado (no período), classifica curva ABC pelo
//   faturamento de mercado, e FILTRA mostrando APENAS os itens que esse
//   cliente NUNCA comprou (histórico completo).

// GET /estatisticas/gap-catalogo/clientes?industria=X
// Retorna apenas clientes com pelo menos 1 pedido P/F da indústria
export async function gapCatalogoClientesHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const indId = Number(req.query.industria);
    if (!indId) return res.status(400).json({ success: false, error: 'Indústria obrigatória' });

    const result = await db.query(`
      SELECT DISTINCT c.cli_codigo, c.cli_nomred
      FROM pedidos p
      JOIN clientes c ON c.cli_codigo = p.ped_cliente
      WHERE p.ped_industria = $1
        AND p.ped_situacao IN ('P', 'F')
      ORDER BY c.cli_nomred
    `, [indId]);

    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error('[gapCatalogoClientesHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /estatisticas/gap-catalogo?industria&cliente&dataInicial&dataFinal
export async function gapCatalogoHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    const { industria, cliente, dataInicial, dataFinal } = req.query;

    if (!industria || industria === 'ALL') {
      return res.status(400).json({ success: false, error: 'Indústria obrigatória' });
    }
    if (!cliente || cliente === 'ALL') {
      return res.status(400).json({ success: false, error: 'Cliente obrigatório' });
    }
    if (!dataInicial || !dataFinal) {
      return res.status(400).json({ success: false, error: 'Período obrigatório' });
    }

    const indId = Number(industria);
    const cliId = Number(cliente);

    const result = await db.query(`
      WITH mercado AS (
        -- Itens da indústria vendidos no período (qualquer cliente)
        SELECT
          COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) AS cod,
          SUM(ip.ite_totliquido)::NUMERIC AS valor_mercado,
          SUM(ip.ite_quant)::NUMERIC      AS qtd_mercado,
          COUNT(DISTINCT p.ped_cliente)::INTEGER AS pontos_venda
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_data BETWEEN $2::date AND $3::date
          AND p.ped_situacao IN ('P', 'F')
        GROUP BY 1
      ),
      cliente_historico AS (
        -- Tudo que o cliente JÁ COMPROU da indústria, em qualquer época
        SELECT DISTINCT COALESCE(NULLIF(TRIM(ip.ite_codigonormalizado),''), TRIM(ip.ite_produto)) AS cod
        FROM itens_ped ip
        JOIN pedidos p ON TRIM(ip.ite_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_cliente   = $4
          AND p.ped_situacao IN ('P', 'F')
      ),
      gap AS (
        -- Itens que o mercado compra mas o cliente NUNCA comprou
        SELECT m.cod, m.valor_mercado, m.qtd_mercado, m.pontos_venda
        FROM mercado m
        WHERE NOT EXISTS (SELECT 1 FROM cliente_historico ch WHERE ch.cod = m.cod)
      ),
      total AS (
        SELECT SUM(valor_mercado) AS valor_total FROM gap
      ),
      ranked AS (
        SELECT
          g.cod,
          g.valor_mercado,
          g.qtd_mercado,
          g.pontos_venda,
          SUM(g.valor_mercado) OVER (ORDER BY g.valor_mercado DESC, g.cod
                                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::NUMERIC AS valor_acum,
          (SELECT valor_total FROM total) AS total_geral
        FROM gap g
      )
      SELECT
        r.cod                                                       AS codigo,
        COALESCE(cp.pro_nome, r.cod)                                AS descricao,
        COALESCE(g.gru_nome, 'SEM GRUPO')                           AS familia,
        r.valor_mercado,
        r.qtd_mercado,
        r.pontos_venda,
        CASE
          WHEN r.total_geral > 0 THEN ROUND((r.valor_acum / r.total_geral) * 100, 2)
          ELSE 0
        END                                                         AS pct_acumulado,
        CASE
          WHEN r.total_geral = 0 THEN 'C'
          WHEN (r.valor_acum / r.total_geral) <= 0.80 THEN 'A'
          WHEN (r.valor_acum / r.total_geral) <= 0.95 THEN 'B'
          ELSE 'C'
        END                                                         AS curva_abc
      FROM ranked r
      LEFT JOIN cad_prod cp ON COALESCE(NULLIF(TRIM(cp.pro_codigonormalizado),''), TRIM(cp.pro_codprod)) = r.cod
                            AND cp.pro_industria = $1
      LEFT JOIN grupos g    ON g.gru_codigo = cp.pro_grupo
      ORDER BY r.valor_mercado DESC
    `, [indId, dataInicial, dataFinal, cliId]);

    const data = result.rows.map((r: any) => ({
      codigo:        r.codigo,
      descricao:     r.descricao,
      familia:       r.familia,
      valor_mercado: parseFloat(r.valor_mercado) || 0,
      qtd_mercado:   parseFloat(r.qtd_mercado)   || 0,
      pontos_venda:  Number(r.pontos_venda)      || 0,
      pct_acumulado: parseFloat(r.pct_acumulado) || 0,
      curva_abc:     r.curva_abc,
    }));

    const kpis = {
      total:        data.length,
      curvaA:       data.filter((d: any) => d.curva_abc === 'A').length,
      curvaB:       data.filter((d: any) => d.curva_abc === 'B').length,
      curvaC:       data.filter((d: any) => d.curva_abc === 'C').length,
      valorMercado: data.reduce((s: number, d: any) => s + d.valor_mercado, 0),
    };

    res.json({ success: true, data, total: data.length, kpis });
  } catch (err: any) {
    console.error('[gapCatalogoHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// 4ª MISSÃO — INDÚSTRIAS ADORMECIDAS (Fábio/borcatorep, 2026-05-26)
// ════════════════════════════════════════════════════════════════════
// Conceito: cliente PODE estar ativo na carteira (ainda compra alguma
// coisa) mas parou de comprar de indústrias que historicamente comprava.
// É insight diferente de "Clientes Inativos" (cliente parou tudo) e de
// "Churn Trimestral" (comparação curta).
//
// Fluxo:
//   1. Lista clientes que TÊM pelo menos 1 indústria adormecida no histórico
//   2. Ao clicar num cliente, mostra TODAS as indústrias compradas + status
//      ATIVA (compra recente) ou ADORMECIDA (parou há mais de X dias).

// GET /estatisticas/industrias-adormecidas/clientes?dataInicial&dataFinal&diasSilencio&industria&vendedor
// Lista clientes com indústrias dormindo. dataInicial/dataFinal recortam o
// histórico considerado — clientes que só compravam fora desse período não
// entram (ex: parou tudo em 2018, não interessa olhar agora).
export async function industriasAdormecidasClientesHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    let { dataInicial, dataFinal, diasSilencio, industria, vendedor } = req.query;

    // Default: último 1 ano quando o front não envia (compat com frontend antigo
    // que ainda não foi deployado com os params novos).
    if (!dataInicial || !dataFinal) {
      const hoje = new Date();
      const umAnoAtras = new Date(hoje); umAnoAtras.setFullYear(hoje.getFullYear() - 1);
      dataFinal = dataFinal || hoje.toISOString().slice(0, 10);
      dataInicial = dataInicial || umAnoAtras.toISOString().slice(0, 10);
    }

    const dias = Math.max(1, parseInt(String(diasSilencio || '90'), 10));

    // $1=dias_silencio, $2=dataInicial, $3=dataFinal, depois opcionais
    const params: any[] = [dias, dataInicial, dataFinal];
    let pc = 4;
    const industriaFilter = (industria && industria !== 'ALL')
      ? (params.push(Number(industria)), `AND p.ped_industria = $${pc++}`)
      : '';
    // 1x1: cli_vendedor (titular); 1xN: indústrias do vendedor (vendedor_ind)
    const vclAd = (vendedor && vendedor !== 'ALL')
      ? vendedorFilterSQL(await getModoVendedor(db), Number(vendedor), { cliAlias: 'c', pedAlias: 'p' })
      : '';
    const vendedorFilter = vclAd ? `AND ${vclAd}` : '';

    const result = await db.query(`
      WITH compras_cli_ind AS (
        -- Para cada (cliente, indústria) comprado DENTRO do período recortado,
        -- calcula a última data e o valor acumulado.
        SELECT
          p.ped_cliente,
          p.ped_industria,
          f.for_nomered                              AS industria_nome,
          MAX(p.ped_data)                            AS ultima_compra,
          SUM(COALESCE(p.ped_totliq, 0))::NUMERIC    AS valor_historico,
          COUNT(DISTINCT TRIM(p.ped_pedido))::INTEGER AS qtd_pedidos_historico,
          (CURRENT_DATE - MAX(p.ped_data)::date)::INTEGER AS dias_sem_comprar
        FROM pedidos p
        JOIN fornecedores f ON f.for_codigo = p.ped_industria
        LEFT JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE p.ped_situacao IN ('P', 'F')
          AND p.ped_data BETWEEN $2::date AND $3::date
          ${industriaFilter}
          ${vendedorFilter}
        GROUP BY p.ped_cliente, p.ped_industria, f.for_nomered
      ),
      adormecidas_por_cliente AS (
        -- Apenas pares com silêncio > N dias (a "adormecida")
        SELECT ped_cliente,
               COUNT(*)::INTEGER                  AS qtd_adormecidas,
               SUM(valor_historico)::NUMERIC      AS valor_adormecido,
               MAX(dias_sem_comprar)::INTEGER     AS max_dias_silencio
        FROM compras_cli_ind
        WHERE dias_sem_comprar > $1
        GROUP BY ped_cliente
      ),
      ultima_geral AS (
        -- Última compra de qualquer indústria DENTRO do período
        SELECT p.ped_cliente,
               MAX(p.ped_data)::date AS ultima_geral
        FROM pedidos p
        LEFT JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE p.ped_situacao IN ('P', 'F')
          AND p.ped_data BETWEEN $2::date AND $3::date
          ${vendedorFilter}
        GROUP BY p.ped_cliente
      )
      SELECT
        c.cli_codigo                                       AS cli_codigo,
        c.cli_nomred                                       AS cli_nomred,
        COALESCE(c.cli_uf, '')                             AS uf,
        COALESCE(ci.cid_nome, '')                          AS cidade,
        COALESCE(v.ven_nome, '')                           AS vendedor_nome,
        a.qtd_adormecidas,
        a.valor_adormecido,
        a.max_dias_silencio,
        u.ultima_geral                                     AS ultima_compra_geral,
        (CURRENT_DATE - u.ultima_geral)::INTEGER           AS dias_desde_ultima_geral
      FROM adormecidas_por_cliente a
      JOIN clientes c        ON c.cli_codigo = a.ped_cliente
      LEFT JOIN public.cidades ci   ON ci.cid_codigo = c.cli_idcidade
      LEFT JOIN vendedores v ON v.ven_codigo = c.cli_vendedor
      LEFT JOIN ultima_geral u ON u.ped_cliente = a.ped_cliente
      WHERE c.cli_tipopes = 'A'
        AND ${excluiInativoSQL('c')}
      ORDER BY a.valor_adormecido DESC
    `, params);

    const data = result.rows.map((r: any) => ({
      cli_codigo:              Number(r.cli_codigo) || 0,
      cli_nomred:              r.cli_nomred || '',
      uf:                      r.uf,
      cidade:                  r.cidade,
      vendedor_nome:           r.vendedor_nome,
      qtd_adormecidas:         Number(r.qtd_adormecidas) || 0,
      valor_adormecido:        parseFloat(r.valor_adormecido) || 0,
      max_dias_silencio:       Number(r.max_dias_silencio) || 0,
      ultima_compra_geral:     r.ultima_compra_geral,
      dias_desde_ultima_geral: Number(r.dias_desde_ultima_geral) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[industriasAdormecidasClientesHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /estatisticas/industrias-adormecidas/export?dataInicial&dataFinal&diasSilencio&industria&vendedor
// Retorna LISTA PLANA de pares (cliente × indústria adormecida) pra exportação
// Excel. Cada linha é um par único — o usuário pode pivotar/filtrar no Excel.
export async function industriasAdormecidasExportHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    let { dataInicial, dataFinal, diasSilencio, industria, vendedor } = req.query;

    if (!dataInicial || !dataFinal) {
      const hoje = new Date();
      const umAnoAtras = new Date(hoje); umAnoAtras.setFullYear(hoje.getFullYear() - 1);
      dataFinal = dataFinal || hoje.toISOString().slice(0, 10);
      dataInicial = dataInicial || umAnoAtras.toISOString().slice(0, 10);
    }

    const dias = Math.max(1, parseInt(String(diasSilencio || '90'), 10));
    const params: any[] = [dias, dataInicial, dataFinal];
    let pc = 4;
    const industriaFilter = (industria && industria !== 'ALL')
      ? (params.push(Number(industria)), `AND p.ped_industria = $${pc++}`)
      : '';
    // 1x1: cli_vendedor (titular); 1xN: indústrias do vendedor (vendedor_ind)
    const vclAd = (vendedor && vendedor !== 'ALL')
      ? vendedorFilterSQL(await getModoVendedor(db), Number(vendedor), { cliAlias: 'c', pedAlias: 'p' })
      : '';
    const vendedorFilter = vclAd ? `AND ${vclAd}` : '';

    const result = await db.query(`
      WITH pares AS (
        SELECT
          p.ped_cliente,
          p.ped_industria,
          f.for_nomered                              AS industria_nome,
          MAX(p.ped_data)                            AS ultima_compra,
          (CURRENT_DATE - MAX(p.ped_data)::date)::INTEGER AS dias_sem_comprar,
          SUM(COALESCE(p.ped_totliq, 0))::NUMERIC    AS valor_historico,
          COUNT(DISTINCT TRIM(p.ped_pedido))::INTEGER AS qtd_pedidos
        FROM pedidos p
        JOIN fornecedores f ON f.for_codigo = p.ped_industria
        LEFT JOIN clientes c ON c.cli_codigo = p.ped_cliente
        WHERE p.ped_situacao IN ('P', 'F')
          AND p.ped_data BETWEEN $2::date AND $3::date
          ${industriaFilter}
          ${vendedorFilter}
        GROUP BY p.ped_cliente, p.ped_industria, f.for_nomered
        HAVING (CURRENT_DATE - MAX(p.ped_data)::date) > $1
      )
      SELECT
        c.cli_codigo                            AS cli_codigo,
        c.cli_nomred                            AS cli_nomred,
        COALESCE(c.cli_uf, '')                  AS uf,
        COALESCE(ci.cid_nome, '')               AS cidade,
        COALESCE(v.ven_nome, '')                AS vendedor_nome,
        pares.industria_nome,
        pares.ultima_compra,
        pares.dias_sem_comprar,
        pares.valor_historico,
        pares.qtd_pedidos
      FROM pares
      JOIN clientes c       ON c.cli_codigo = pares.ped_cliente
      LEFT JOIN public.cidades ci  ON ci.cid_codigo = c.cli_idcidade
      LEFT JOIN vendedores v ON v.ven_codigo = c.cli_vendedor
      WHERE c.cli_tipopes = 'A'
        AND ${excluiInativoSQL('c')}
      ORDER BY c.cli_nomred, pares.dias_sem_comprar DESC
    `, params);

    const data = result.rows.map((r: any) => ({
      cli_codigo:       Number(r.cli_codigo) || 0,
      cli_nomred:       r.cli_nomred || '',
      uf:               r.uf,
      cidade:           r.cidade,
      vendedor_nome:    r.vendedor_nome,
      industria_nome:   r.industria_nome,
      ultima_compra:    r.ultima_compra,
      dias_sem_comprar: Number(r.dias_sem_comprar) || 0,
      valor_historico:  parseFloat(r.valor_historico) || 0,
      qtd_pedidos:      Number(r.qtd_pedidos) || 0,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err: any) {
    console.error('[industriasAdormecidasExportHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /estatisticas/industrias-adormecidas/detalhe?cliId&dataInicial&dataFinal&diasSilencio
// Pra um cliente específico, lista todas as indústrias compradas DENTRO do
// período recortado + status (ATIVA / ADORMECIDA) + última compra + valor.
export async function industriasAdormecidasDetalheHandler(req: Request | any, res: Response) {
  try {
    const db = req.db!;
    let { cliId, dataInicial, dataFinal, diasSilencio } = req.query;
    if (!cliId) {
      return res.status(400).json({ success: false, error: 'cliId obrigatório' });
    }
    if (!dataInicial || !dataFinal) {
      const hoje = new Date();
      const umAnoAtras = new Date(hoje); umAnoAtras.setFullYear(hoje.getFullYear() - 1);
      dataFinal = dataFinal || hoje.toISOString().slice(0, 10);
      dataInicial = dataInicial || umAnoAtras.toISOString().slice(0, 10);
    }
    const dias = Math.max(1, parseInt(String(diasSilencio || '90'), 10));

    const result = await db.query(`
      SELECT
        p.ped_industria                                   AS for_codigo,
        f.for_nomered                                     AS industria_nome,
        MIN(p.ped_data)                                   AS primeira_compra,
        MAX(p.ped_data)                                   AS ultima_compra,
        (CURRENT_DATE - MAX(p.ped_data)::date)::INTEGER   AS dias_sem_comprar,
        SUM(COALESCE(p.ped_totliq, 0))::NUMERIC           AS valor_historico,
        COUNT(DISTINCT TRIM(p.ped_pedido))::INTEGER       AS qtd_pedidos,
        CASE
          WHEN (CURRENT_DATE - MAX(p.ped_data)::date) > $2 THEN 'ADORMECIDA'
          ELSE 'ATIVA'
        END                                               AS status
      FROM pedidos p
      JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE p.ped_cliente = $1
        AND p.ped_situacao IN ('P', 'F')
        AND p.ped_data BETWEEN $3::date AND $4::date
      GROUP BY p.ped_industria, f.for_nomered
      ORDER BY
        CASE WHEN (CURRENT_DATE - MAX(p.ped_data)::date) > $2 THEN 0 ELSE 1 END,
        SUM(COALESCE(p.ped_totliq, 0)) DESC
    `, [Number(cliId), dias, dataInicial, dataFinal]);

    const data = result.rows.map((r: any) => ({
      for_codigo:       Number(r.for_codigo) || 0,
      industria_nome:   r.industria_nome || '',
      primeira_compra:  r.primeira_compra,
      ultima_compra:    r.ultima_compra,
      dias_sem_comprar: Number(r.dias_sem_comprar) || 0,
      valor_historico:  parseFloat(r.valor_historico) || 0,
      qtd_pedidos:      Number(r.qtd_pedidos) || 0,
      status:           r.status,
    }));

    const kpis = {
      total:        data.length,
      adormecidas:  data.filter((d: any) => d.status === 'ADORMECIDA').length,
      ativas:       data.filter((d: any) => d.status === 'ATIVA').length,
      valor_adormecido: data.filter((d: any) => d.status === 'ADORMECIDA').reduce((s: number, d: any) => s + d.valor_historico, 0),
    };

    res.json({ success: true, data, total: data.length, kpis });
  } catch (err: any) {
    console.error('[industriasAdormecidasDetalheHandler]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
