import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { getLinkedSellerId } from '../../shared/permissions';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// ─── GET /api/reports/clientes/simplificada ───────────────────────────────────
router.get('/clientes/simplificada', async (req: any, res: Response) => {
  try {
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    let query = `
      SELECT
        c.cli_codigo,
        c.cli_nomred,
        c.cli_nome,
        COALESCE(cid.cid_nome, c.cli_cidade) AS cli_cidade,
        COALESCE(cid.cid_uf, c.cli_uf)       AS cli_uf,
        c.cli_fone1,
        c.cli_email
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      WHERE c.cli_tipopes = 'A'
    `;
    const params: any[] = [];
    let idx = 1;

    if (sellerId !== null) {
      query += ` AND c.cli_vendedor = $${idx++}`;
      params.push(sellerId);
    }

    query += ` ORDER BY c.cli_nomred, c.cli_nome`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/clientes/selecionavel ───────────────────────────────────
router.get('/clientes/selecionavel', async (req: any, res: Response) => {
  try {
    const db = req.db!;
    const { mode, status, region, city, seller, area, industry, state, start, end } = req.query as Record<string, string>;

    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [];
    let idx = 1;
    const conditions: string[] = ['1=1'];

    // Permissão: restringir ao vendedor vinculado ao usuário
    if (sellerId !== null) {
      conditions.push(`c.cli_vendedor = $${idx++}`);
      params.push(sellerId);
    }

    // Status
    if (status === 'active')   conditions.push(`c.cli_tipopes = 'A'`);
    else if (status === 'inactive') conditions.push(`c.cli_tipopes = 'I'`);

    // Modo
    switch (mode) {
      case 'region':
        if (region && region !== 'all') {
          conditions.push(`c.cli_regiao2 = $${idx++}`);
          params.push(parseInt(region));
        }
        break;
      case 'city':
        if (city && city !== 'all') {
          conditions.push(`(cid.cid_nome ILIKE $${idx} OR c.cli_cidade ILIKE $${idx})`);
          params.push(`%${city}%`);
          idx++;
        }
        break;
      case 'seller':
        if (seller && seller !== 'all' && sellerId === null) {
          conditions.push(`c.cli_vendedor = $${idx++}`);
          params.push(parseInt(seller));
        }
        break;
      case 'state':
        if (state && state !== 'all') {
          conditions.push(`COALESCE(cid.cid_uf, c.cli_uf) = $${idx++}`);
          params.push(state.toUpperCase());
        }
        break;
      case 'area':
        if (area && area !== 'all') {
          conditions.push(`(
            c.cli_atuacaoprincipal = $${idx}
            OR EXISTS (
              SELECT 1 FROM atua_cli ac
              WHERE ac.atu_idcli = c.cli_codigo AND ac.atu_atuaid = $${idx}
            )
          )`);
          params.push(parseInt(area));
          idx++;
        }
        break;
      case 'industry':
        if (industry && industry !== 'all') {
          conditions.push(`EXISTS (
            SELECT 1 FROM pedidos p2
            WHERE p2.ped_cliente = c.cli_codigo
              AND p2.ped_industria = $${idx++}
              AND p2.ped_situacao IN ('P','F')
          )`);
          params.push(parseInt(industry));
        }
        break;
      case 'period':
        if (start && end) {
          conditions.push(`EXISTS (
            SELECT 1 FROM pedidos p3
            WHERE p3.ped_cliente = c.cli_codigo
              AND p3.ped_data BETWEEN $${idx} AND $${idx + 1}
              AND p3.ped_situacao IN ('P','F')
          )`);
          params.push(start, end);
          idx += 2;
        }
        break;
    }

    const query = `
      SELECT
        c.cli_codigo,
        c.cli_nome,
        c.cli_nomred,
        c.cli_cnpj,
        COALESCE(cid.cid_nome, c.cli_cidade) AS cli_cidade,
        COALESCE(cid.cid_uf, c.cli_uf)       AS cli_uf,
        c.cli_tipopes,
        c.cli_vendedor,
        c.cli_fone1,
        c.cli_email
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.cli_nomred, c.cli_nome
      LIMIT 1000
    `;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/tabela-precos-desconto ─────────────────────────────────
router.get('/tabela-precos-desconto', async (req: any, res: Response) => {
  try {
    const { industria, tabela } = req.query as Record<string, string>;
    if (!industria || !tabela) {
      res.status(400).json({ success: false, message: 'Parâmetros industria e tabela são obrigatórios.' });
      return;
    }

    const db = req.db!;
    const result = await db.query(`
      SELECT
        p.pro_codprod        AS codigo,
        p.pro_conversao      AS conversao,
        p.pro_codigooriginal AS original,
        p.pro_nome           AS nome,
        t.itab_precobruto    AS preco_bruto,
        t.itab_ipi           AS ipi
      FROM cad_tabelaspre t
      INNER JOIN cad_prod p ON p.pro_id = t.itab_idprod
      WHERE t.itab_idindustria = $1
        AND t.itab_tabela = $2
        AND t.itab_precobruto > 0
      ORDER BY p.pro_codprod
    `, [parseInt(industria), tabela]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/tabela-precos-completa ─────────────────────────────────
router.get('/tabela-precos-completa', async (req: any, res: Response) => {
  try {
    const { industria, tabela } = req.query as Record<string, string>;
    if (!industria || !tabela) {
      res.status(400).json({ success: false, message: 'Parâmetros industria e tabela são obrigatórios.' });
      return;
    }
    const db = req.db!;
    const result = await db.query(`
      SELECT
        p.pro_codprod        AS codigo,
        p.pro_nome           AS descricao,
        t.itab_precobruto    AS preco_bruto,
        t.itab_precopromo    AS preco_liquido,
        t.itab_precoespecial AS especial,
        p.pro_codigooriginal AS cod_original,
        p.pro_conversao      AS conversao
      FROM cad_tabelaspre t
      INNER JOIN cad_prod p ON p.pro_id = t.itab_idprod
      WHERE t.itab_idindustria = $1
        AND t.itab_tabela = $2
        AND t.itab_precobruto > 0
      ORDER BY p.pro_codprod
    `, [parseInt(industria), tabela]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/tabela-precos-promocao ─────────────────────────────────
router.get('/tabela-precos-promocao', async (req: any, res: Response) => {
  try {
    const { industria, tabela, somente_promo } = req.query as Record<string, string>;
    if (!industria || !tabela) {
      res.status(400).json({ success: false, message: 'Parâmetros industria e tabela são obrigatórios.' });
      return;
    }
    const db = req.db!;
    let where = `t.itab_idindustria = $1 AND t.itab_tabela = $2 AND t.itab_precobruto > 0`;
    if (somente_promo === 'true') where += ` AND t.itab_precopromo > 0`;

    const result = await db.query(`
      SELECT
        p.pro_codprod        AS codigo,
        p.pro_conversao      AS conversao,
        p.pro_nome           AS nome,
        t.itab_precobruto    AS preco_normal,
        COALESCE(t.itab_precopromo, 0) AS preco_promocao
      FROM cad_tabelaspre t
      INNER JOIN cad_prod p ON p.pro_id = t.itab_idprod
      WHERE ${where}
      ORDER BY p.pro_codprod
    `, [parseInt(industria), tabela]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/industrias ─────────────────────────────────────────────
router.get('/industrias', async (req: any, res: Response) => {
  try {
    const db = req.db!;
    const result = await db.query(`
      SELECT
        for_codigo,
        for_nome,
        for_nomered,
        for_endereco,
        for_bairro,
        for_cidade,
        for_uf,
        for_cep,
        for_fone,
        for_fone2,
        for_cgc,
        for_inscricao,
        for_email,
        for_homepage
      FROM fornecedores
      WHERE for_tipo2 = 'A'
      ORDER BY for_nome
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/transportadoras ────────────────────────────────────────
router.get('/transportadoras', async (req: any, res: Response) => {
  try {
    const db = req.db!;
    const result = await db.query(`
      SELECT
        tra_codigo,
        tra_nome,
        tra_endereco,
        tra_bairro,
        tra_cidade,
        tra_uf,
        tra_cep,
        tra_fone,
        tra_contato,
        tra_cgc,
        tra_inscricao,
        tra_email
      FROM transportadora
      ORDER BY tra_nome
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/clientes-por-industria ─────────────────────────────────
router.get('/clientes-por-industria', async (req: any, res: Response) => {
  try {
    const { industria } = req.query as Record<string, string>;
    if (!industria) {
      res.status(400).json({ success: false, message: 'Parâmetro industria é obrigatório.' });
      return;
    }
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    let vendedorClause = '';
    const params: any[] = [parseInt(industria)];
    if (sellerId !== null) {
      vendedorClause = ` AND c.cli_vendedor = $2`;
      params.push(sellerId);
    }

    const result = await db.query(`
      SELECT DISTINCT
        c.cli_codigo,
        c.cli_nomred,
        c.cli_nome,
        COALESCE(cid.cid_nome, c.cli_cidade) AS cli_cidade,
        COALESCE(cid.cid_uf, c.cli_uf)       AS cli_uf,
        c.cli_fone1,
        c.cli_email,
        MAX(p.ped_data) AS ultima_compra,
        COUNT(DISTINCT p.ped_pedido)::int AS total_pedidos,
        COALESCE(ROUND(SUM(p.ped_totliq)::NUMERIC, 2), 0) AS total_valor
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      INNER JOIN pedidos p ON p.ped_cliente = c.cli_codigo
                          AND p.ped_industria = $1
                          AND p.ped_situacao IN ('P','F')
      WHERE c.cli_tipopes = 'A'${vendedorClause}
      GROUP BY c.cli_codigo, c.cli_nomred, c.cli_nome, cli_cidade, cli_uf, c.cli_fone1, c.cli_email
      ORDER BY c.cli_nomred, c.cli_nome
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/clientes-area-atuacao ───────────────────────────────────
router.get('/clientes-area-atuacao', async (req: any, res: Response) => {
  try {
    const { area, regiao } = req.query as Record<string, string>;
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [];
    let idx = 1;
    const conditions: string[] = [`c.cli_tipopes = 'A'`];

    if (sellerId !== null) {
      conditions.push(`c.cli_vendedor = $${idx++}`);
      params.push(sellerId);
    }
    if (area && area !== 'all') {
      conditions.push(`(
        c.cli_atuacaoprincipal = $${idx}
        OR EXISTS (SELECT 1 FROM atua_cli ac WHERE ac.atu_idcli = c.cli_codigo AND ac.atu_atuaid = $${idx})
      )`);
      params.push(parseInt(area));
      idx++;
    }
    if (regiao && regiao !== 'all') {
      conditions.push(`c.cli_regiao2 = $${idx++}`);
      params.push(parseInt(regiao));
    }

    const result = await db.query(`
      SELECT
        c.cli_codigo,
        c.cli_nomred,
        c.cli_nome,
        COALESCE(cid.cid_nome, c.cli_cidade) AS cli_cidade,
        COALESCE(cid.cid_uf, c.cli_uf)       AS cli_uf,
        c.cli_fone1,
        c.cli_email
      FROM clientes c
      LEFT JOIN cidades cid ON c.cli_idcidade = cid.cid_codigo
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.cli_nomred, c.cli_nome
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-familia ─────────────────────────────────────────
router.get('/vendas-familia', async (req: any, res: Response) => {
  try {
    const { grupoId, dataInicio, dataFim } = req.query as Record<string, string>;
    if (!grupoId || !dataInicio || !dataFim) {
      res.status(400).json({ success: false, message: 'Parâmetros grupoId, dataInicio e dataFim são obrigatórios.' });
      return;
    }
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [dataInicio, dataFim, parseInt(grupoId)];
    let vendedorClause = '';
    if (sellerId !== null) {
      vendedorClause = ` AND c.cli_vendedor = $4`;
      params.push(sellerId);
    }

    const result = await db.query(`
      SELECT
        c.cli_codigo,
        c.cli_nomred,
        c.cli_fone1,
        MAX(p.ped_data)                       AS ultima_compra,
        (CURRENT_DATE - MAX(p.ped_data))::int AS dias_sem_compra
      FROM pedidos p
      JOIN itens_ped i  ON p.ped_pedido = i.ite_pedido
      JOIN cad_prod  pr ON TRIM(pr.pro_codprod) = TRIM(i.ite_produto)
      JOIN clientes  c  ON p.ped_cliente = c.cli_codigo
      WHERE p.ped_data BETWEEN $1 AND $2
        AND p.ped_situacao IN ('P','F')
        AND pr.pro_grupo = $3
        AND c.cli_tipopes = 'A'
        ${vendedorClause}
      GROUP BY c.cli_codigo, c.cli_nomred, c.cli_fone1
      ORDER BY ultima_compra DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-produto/search ───────────────────────────────────
router.get('/vendas-produto/search', async (req: any, res: Response) => {
  try {
    const { q, industria } = req.query as Record<string, string>;
    if (!q || !industria) {
      res.json({ success: true, data: [] });
      return;
    }
    const db = req.db!;
    const result = await db.query(`
      SELECT DISTINCT
        TRIM(pro_codprod) AS id,
        pro_nome          AS nome,
        TRIM(pro_codprod) AS referencia
      FROM cad_prod
      WHERE (TRIM(pro_nome) ILIKE $1 OR TRIM(pro_codprod) ILIKE $1)
        AND pro_industria = $2
      ORDER BY pro_nome
      LIMIT 50
    `, [`%${q}%`, parseInt(industria)]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-produto ─────────────────────────────────────────
router.get('/vendas-produto', async (req: any, res: Response) => {
  try {
    const { productCode, industria } = req.query as Record<string, string>;
    if (!productCode || !industria) {
      res.status(400).json({ success: false, message: 'Parâmetros productCode e industria são obrigatórios.' });
      return;
    }
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [productCode, parseInt(industria)];
    let vendedorClause = '';
    if (sellerId !== null) {
      vendedorClause = ` AND c.cli_vendedor = $3`;
      params.push(sellerId);
    }

    const result = await db.query(`
      SELECT
        c.cli_nomred,
        p.ped_data                             AS data_compra,
        (CURRENT_DATE - p.ped_data)::int       AS dias_sem_compra,
        p.ped_pedido                           AS ped_numero,
        i.ite_quant                            AS ite_quantidade,
        i.ite_puni                             AS ite_valorunit
      FROM pedidos   p
      JOIN itens_ped i ON p.ped_pedido = i.ite_pedido
      JOIN clientes  c ON p.ped_cliente = c.cli_codigo
      WHERE TRIM(i.ite_produto) = TRIM($1)
        AND p.ped_industria = $2
        AND p.ped_situacao IN ('P','F')
        ${vendedorClause}
      ORDER BY p.ped_data DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-periodo ─────────────────────────────────────────
router.get('/vendas-periodo', async (req: any, res: Response) => {
  try {
    const { dataInicio, dataFim, vendedor, industria } = req.query as Record<string, string>;
    if (!dataInicio || !dataFim) {
      res.status(400).json({ success: false, message: 'dataInicio e dataFim são obrigatórios.' });
      return;
    }

    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [dataInicio, dataFim];
    let idx = 3;
    const conditions: string[] = [`p.ped_data BETWEEN $1 AND $2`, `p.ped_situacao IN ('P','F','E')`];

    if (sellerId !== null) {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(sellerId);
    } else if (vendedor && vendedor !== '') {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(parseInt(vendedor));
    }

    if (industria && industria !== '') {
      conditions.push(`p.ped_industria = $${idx++}`);
      params.push(parseInt(industria));
    }

    const result = await db.query(`
      SELECT
        f.for_nomered                                   AS industria_nome,
        f.for_codigo                                    AS industria_codigo,
        p.ped_data,
        c.cli_nomred,
        p.ped_pedido,
        p.ped_pedcli,
        p.ped_pedindustria,
        ROUND(p.ped_totliq::NUMERIC, 2)                AS valor_pedido,
        CASE WHEN p.ped_situacao = 'F'
             THEN ROUND(p.ped_totliq::NUMERIC, 2)
             ELSE 0 END                                AS valor_faturado
      FROM pedidos p
      JOIN clientes    c ON c.cli_codigo  = p.ped_cliente
      JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE ${conditions.join(' AND ')}
      ORDER BY f.for_nomered, p.ped_data, c.cli_nomred
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-periodo-sintetico ───────────────────────────────
router.get('/vendas-periodo-sintetico', async (req: any, res: Response) => {
  try {
    const { dataInicio, dataFim, vendedor } = req.query as Record<string, string>;
    if (!dataInicio || !dataFim) {
      res.status(400).json({ success: false, message: 'dataInicio e dataFim são obrigatórios.' });
      return;
    }

    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [dataInicio, dataFim];
    let idx = 3;
    const conditions: string[] = [`p.ped_data BETWEEN $1 AND $2`, `p.ped_situacao IN ('P','F','E')`];

    if (sellerId !== null) {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(sellerId);
    } else if (vendedor && vendedor !== '') {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(parseInt(vendedor));
    }

    const [dataResult, empresaResult] = await Promise.all([
      db.query(`
        SELECT
          f.for_nomered                                            AS industria_nome,
          ROUND(SUM(p.ped_totliq)::NUMERIC, 2)                   AS valor_bruto,
          ROUND(SUM(CASE WHEN p.ped_situacao = 'F' THEN p.ped_totliq ELSE 0 END)::NUMERIC, 2) AS valor_liquido
        FROM pedidos p
        JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE ${conditions.join(' AND ')}
        GROUP BY f.for_nomered
        ORDER BY valor_bruto DESC
      `, params),
      db.query(`SELECT emp_nome, emp_cnpj, emp_endereco, emp_cidade, emp_uf, emp_fones FROM empresa_status WHERE emp_id = 1`),
    ]);

    res.json({ success: true, data: dataResult.rows, empresa: empresaResult.rows[0] ?? null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-cidade-estado ───────────────────────────────────
router.get('/vendas-cidade-estado', async (req: any, res: Response) => {
  try {
    const { dataInicio, dataFim, estado, industria } = req.query as Record<string, string>;
    if (!dataInicio || !dataFim || !estado) {
      res.status(400).json({ success: false, message: 'dataInicio, dataFim e estado são obrigatórios.' });
      return;
    }

    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [dataInicio, dataFim, estado.toUpperCase()];
    let idx = 4;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1 AND $2`,
      `p.ped_situacao IN ('P','F','E')`,
      `UPPER(COALESCE(cid.cid_uf, c.cli_uf)) = $3`,
    ];

    if (sellerId !== null) {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(sellerId);
    }

    if (industria && industria !== '') {
      conditions.push(`p.ped_industria = $${idx++}`);
      params.push(parseInt(industria));
    }

    const [dataResult, empresaResult] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(cid.cid_nome, c.cli_cidade)            AS cidade,
          p.ped_data,
          p.ped_pedido,
          c.cli_nomred,
          f.for_nomered                                    AS industria_nome,
          ROUND(p.ped_totliq::NUMERIC, 2)                 AS valor_bruto,
          CASE WHEN p.ped_situacao = 'F'
               THEN ROUND(p.ped_totliq::NUMERIC, 2)
               ELSE 0 END                                 AS valor_liquido
        FROM pedidos p
        JOIN clientes     c   ON c.cli_codigo  = p.ped_cliente
        JOIN fornecedores f   ON f.for_codigo  = p.ped_industria
        LEFT JOIN cidades cid ON cid.cid_codigo = c.cli_idcidade
        WHERE ${conditions.join(' AND ')}
        ORDER BY COALESCE(cid.cid_nome, c.cli_cidade), p.ped_data, c.cli_nomred
      `, params),
      db.query(`SELECT emp_nome, emp_cnpj, emp_endereco, emp_cidade, emp_uf, emp_fones FROM empresa_status WHERE emp_id = 1`),
    ]);

    res.json({ success: true, data: dataResult.rows, empresa: empresaResult.rows[0] ?? null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/vendas-cliente-industria ───────────────────────────────
router.get('/vendas-cliente-industria', async (req: any, res: Response) => {
  try {
    const { dataInicio, dataFim, cliente, industria } = req.query as Record<string, string>;
    if (!dataInicio || !dataFim || !cliente) {
      res.status(400).json({ success: false, message: 'dataInicio, dataFim e cliente são obrigatórios.' });
      return;
    }

    const db = req.db!;
    const params: any[] = [dataInicio, dataFim, parseInt(cliente)];
    let idx = 4;
    const conditions: string[] = [
      `p.ped_data BETWEEN $1 AND $2`,
      `p.ped_situacao IN ('P','F','E')`,
      `p.ped_cliente = $3`,
    ];

    if (industria && industria !== '') {
      conditions.push(`p.ped_industria = $${idx++}`);
      params.push(parseInt(industria));
    }

    const result = await db.query(`
      SELECT
        f.for_nomered                                   AS industria_nome,
        f.for_codigo                                    AS industria_codigo,
        p.ped_data,
        c.cli_nomred,
        p.ped_pedido,
        p.ped_pedcli,
        p.ped_pedindustria,
        ROUND(p.ped_totliq::NUMERIC, 2)                AS valor_pedido,
        CASE WHEN p.ped_situacao = 'F'
             THEN ROUND(p.ped_totliq::NUMERIC, 2)
             ELSE 0 END                                AS valor_faturado
      FROM pedidos p
      JOIN clientes    c ON c.cli_codigo  = p.ped_cliente
      JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE ${conditions.join(' AND ')}
      ORDER BY f.for_nomered, p.ped_data
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/reports/cotacoes-pendentes ─────────────────────────────────────
router.get('/cotacoes-pendentes', async (req: any, res: Response) => {
  try {
    const { vendedor, industria } = req.query as Record<string, string>;
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);

    const params: any[] = [];
    let idx = 1;
    const conditions: string[] = [`p.ped_situacao IN ('A', 'C')`];

    if (sellerId !== null) {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(sellerId);
    } else if (vendedor && vendedor !== '') {
      conditions.push(`p.ped_vendedor = $${idx++}`);
      params.push(parseInt(vendedor));
    }

    if (industria && industria !== '') {
      conditions.push(`p.ped_industria = $${idx++}`);
      params.push(parseInt(industria));
    }

    const result = await db.query(`
      SELECT
        TRIM(p.ped_pedido)                              AS ped_pedido,
        p.ped_data,
        c.cli_nomred                                    AS cliente_nome,
        c.cli_fone1                                     AS cliente_fone,
        f.for_nomered                                   AS industria_nome,
        f.for_codigo                                    AS industria_codigo,
        v.ven_nome                                      AS vendedor_nome,
        ROUND(p.ped_totliq::NUMERIC, 2)                AS valor_total,
        ROUND(p.ped_totbruto::NUMERIC, 2)              AS valor_bruto,
        p.ped_obs,
        (CURRENT_DATE - p.ped_data::DATE)::INTEGER      AS dias_em_aberto,
        COUNT(i.ite_produto)                             AS qtd_itens
      FROM pedidos p
      JOIN clientes     c ON c.cli_codigo  = p.ped_cliente
      JOIN fornecedores f ON f.for_codigo  = p.ped_industria
      LEFT JOIN vendedores  v ON v.ven_codigo = p.ped_vendedor
      LEFT JOIN itens_ped   i ON TRIM(i.ite_pedido) = TRIM(p.ped_pedido)
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.ped_pedido, p.ped_data, c.cli_nomred, c.cli_fone1,
               f.for_nomered, f.for_codigo, v.ven_nome, p.ped_totliq, p.ped_totbruto, p.ped_obs
      ORDER BY p.ped_data ASC, f.for_nomered, c.cli_nomred
    `, params);

    const data = result.rows.map((r: any) => ({
      ped_pedido:       r.ped_pedido,
      ped_data:         r.ped_data,
      cliente_nome:     r.cliente_nome,
      cliente_fone:     r.cliente_fone || '',
      industria_nome:   r.industria_nome,
      industria_codigo: Number(r.industria_codigo),
      vendedor_nome:    r.vendedor_nome || '',
      valor_total:      parseFloat(r.valor_total)  || 0,
      valor_bruto:      parseFloat(r.valor_bruto)  || 0,
      ped_obs:          r.ped_obs || '',
      dias_em_aberto:   Number(r.dias_em_aberto)   || 0,
      qtd_itens:        Number(r.qtd_itens)         || 0,
    }));
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
