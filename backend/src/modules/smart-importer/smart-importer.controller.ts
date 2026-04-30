import { Request, Response } from 'express';
import { pool } from '../../config/database';

// ─── POST /api/smart-importer/analyze ────────────────────────────────────────
export async function analyzeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { cli_codigo, items } = req.body;
    const db = req.db!;

    if (!cli_codigo || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'cli_codigo e items[] são obrigatórios.' });
      return;
    }

    // 1. Buscar tabelas/descontos do cliente por indústria
    const cliIndRes = await db.query(`
      SELECT
        cli_forcodigo AS for_codigo,
        cli_tabela,
        COALESCE(cli_desc1,  0) AS desc1,  COALESCE(cli_desc2,  0) AS desc2,
        COALESCE(cli_desc3,  0) AS desc3,  COALESCE(cli_desc4,  0) AS desc4,
        COALESCE(cli_desc5,  0) AS desc5,  COALESCE(cli_desc6,  0) AS desc6,
        COALESCE(cli_desc7,  0) AS desc7,  COALESCE(cli_desc8,  0) AS desc8,
        COALESCE(cli_desc9,  0) AS desc9,  COALESCE(cli_desc10, 0) AS desc10
      FROM cli_ind
      WHERE cli_codigo = $1
    `, [cli_codigo]);

    const clientConditions: Record<number, any> = {};
    cliIndRes.rows.forEach((r: any) => {
      clientConditions[r.for_codigo] = r;
    });

    const results: any[] = [];
    const notFound: any[] = [];

    // 2. Processar cada item
    for (const item of items) {
      const searchCode = String(item.codigo || '').trim().toUpperCase();
      const qty = parseFloat(item.quantidade) || 1;
      if (searchCode.length < 2) continue;

      // Busca produto nas múltiplas colunas de código
      const productRes = await db.query(`
        SELECT
          p.pro_id,
          p.pro_industria,
          p.pro_codprod,
          p.pro_nome,
          f.for_nomered AS industria_nome
        FROM cad_prod p
        JOIN fornecedores f ON p.pro_industria = f.for_codigo
        WHERE UPPER(TRIM(p.pro_codprod))     = $1
           OR UPPER(TRIM(p.pro_conversao))   = $1
           OR UPPER(TRIM(p.pro_codigooriginal)) = $1
        LIMIT 5
      `, [searchCode]);

      if (productRes.rows.length === 0) {
        notFound.push({ codigo: searchCode, quantidade: qty, motivo: 'Não encontrado no catálogo' });
        continue;
      }

      let matched = false;
      for (const product of productRes.rows) {
        const conditions = clientConditions[product.pro_industria] || { cli_tabela: '0' };

        // Buscar preço — prioriza tabela do cliente, usa qualquer outra se não encontrar
        const priceRes = await db.query(`
          SELECT
            itab_precobruto,
            itab_precopromo,
            itab_precoespecial,
            itab_grupodesconto,
            itab_tabela
          FROM cad_tabelaspre
          WHERE itab_idprod = $1
          ORDER BY (itab_tabela = $2) DESC, itab_precobruto DESC
          LIMIT 1
        `, [product.pro_id, conditions.cli_tabela]);

        if (priceRes.rows.length === 0) continue;

        const price = priceRes.rows[0];
        const precoBruto = parseFloat(price.itab_precobruto || 0);
        const promoPrice = parseFloat(price.itab_precopromo || 0);
        let precoUnitario = precoBruto;
        let isPromo = false;

        if (promoPrice > 0) {
          precoUnitario = promoPrice;
          isPromo = true;
        } else {
          // Aplicar descontos cascata da cli_ind
          for (let i = 1; i <= 10; i++) {
            const d = parseFloat(conditions[`desc${i}`] || 0);
            if (d > 0) precoUnitario = precoUnitario * (1 - d / 100);
          }
        }

        results.push({
          pro_id:          product.pro_id,
          codigo:          product.pro_codprod,
          descricao:       product.pro_nome,
          quantidade:      qty,
          preco_bruto:     precoBruto,
          preco_unitario:  precoUnitario,
          total:           qty * precoUnitario,
          industria_id:    product.pro_industria,
          industria_nome:  product.industria_nome,
          is_promo:        isPromo,
          tabela:          conditions.cli_tabela === '0' ? 'Padrão' : conditions.cli_tabela,
          descontos:       conditions.cli_tabela === '0' ? {} : conditions,
        });
        matched = true;
        break;
      }

      if (!matched) {
        notFound.push({ codigo: searchCode, quantidade: qty, motivo: 'Produto encontrado, mas sem preço cadastrado.' });
      }
    }

    // 3. Agrupar por indústria
    const grouped: Record<number, any> = {};
    results.forEach(r => {
      if (!grouped[r.industria_id]) {
        grouped[r.industria_id] = {
          industria_id:   r.industria_id,
          industria_nome: r.industria_nome,
          items:          [],
          total:          0,
        };
      }
      grouped[r.industria_id].items.push(r);
      grouped[r.industria_id].total += r.total;
    });

    res.json({ success: true, grouped: Object.values(grouped), notFound });
  } catch (error: any) {
    console.error('❌ [SMART-IMPORTER] analyze:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/smart-importer/drafts ──────────────────────────────────────────
export async function getDraftsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user!.userId;

    const result = await db.query(`
      SELECT
        d.id, d.cli_codigo, d.industria_id, d.industria_nome, d.total, d.items,
        c.cli_nome, c.cli_nomred, c.cli_cnpj
      FROM smart_importer_drafts d
      JOIN clientes c ON d.cli_codigo = c.cli_codigo
      WHERE d.vendedor_id = $1
      ORDER BY d.updated_at DESC
    `, [userId]);

    const buckets = result.rows.map((row: any) => {
      let items = row.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      return {
        id:             row.id,
        industria_id:   row.industria_id,
        industria_nome: row.industria_nome,
        total:          parseFloat(row.total),
        items:          Array.isArray(items) ? items : [],
        client: {
          cli_codigo: row.cli_codigo,
          cli_nome:   row.cli_nome,
          cli_nomred: row.cli_nomred,
          cli_cnpj:   row.cli_cnpj,
        },
      };
    });

    res.json({ success: true, data: buckets });
  } catch (error: any) {
    console.error('❌ [SMART-IMPORTER] getDrafts:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/smart-importer/drafts ─────────────────────────────────────────
export async function saveDraftHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user!.userId;
    const { cli_codigo, industria_id, industria_nome, items, total } = req.body;

    const checkRes = await db.query(`
      SELECT id FROM smart_importer_drafts
      WHERE vendedor_id = $1 AND cli_codigo = $2 AND industria_id = $3
    `, [userId, cli_codigo, industria_id]);

    if (checkRes.rows.length > 0) {
      await db.query(`
        UPDATE smart_importer_drafts
        SET items = $1, total = $2, updated_at = NOW()
        WHERE id = $3
      `, [JSON.stringify(items), total, checkRes.rows[0].id]);
      res.json({ success: true, id: checkRes.rows[0].id });
    } else {
      const ins = await db.query(`
        INSERT INTO smart_importer_drafts (vendedor_id, cli_codigo, industria_id, industria_nome, items, total)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [userId, cli_codigo, industria_id, industria_nome, JSON.stringify(items), total]);
      res.json({ success: true, id: ins.rows[0].id });
    }
  } catch (error: any) {
    console.error('❌ [SMART-IMPORTER] saveDraft:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/smart-importer/drafts/:id ───────────────────────────────────
export async function deleteDraftHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user!.userId;
    await db.query(`DELETE FROM smart_importer_drafts WHERE id = $1 AND vendedor_id = $2`, [req.params.id, userId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/smart-importer/drafts ───────────────────────────────────────
export async function deleteAllDraftsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user!.userId;
    await db.query(`DELETE FROM smart_importer_drafts WHERE vendedor_id = $1`, [userId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/smart-importer/checkout ───────────────────────────────────────
export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const { buckets, user_initials } = req.body;
  const schema = req.schema!;
  const userId = req.user!.userId;

  if (!Array.isArray(buckets) || buckets.length === 0) {
    res.status(400).json({ success: false, message: 'Nenhum carrinho para faturar.' });
    return;
  }

  const client = await pool.connect();
  const createdOrders: string[] = [];

  try {
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query('BEGIN');

    for (const bucket of buckets) {
      const items: any[] = Array.isArray(bucket.items) ? bucket.items : [];
      if (items.length === 0) continue;

      // Gerar número de pedido
      let seqResult: any;
      try   { seqResult = await client.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
      catch { seqResult = await client.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }

      const pedNumero = seqResult.rows[0].next_num;
      const initials  = (user_initials || 'SI').toUpperCase().replace(/\s+/g, '');
      const pedPedido = initials + pedNumero.toString().padStart(6, '0');

      const cli_codigo = bucket.client?.cli_codigo || 0;
      const tabela     = items[0]?.tabela || '';

      // Buscar dados do vínculo cli_ind
      let transportadora = 0, condPag = '', tipoFrete = 'C', pedCliInd = '', pedComprador = '';
      try {
        const vinculo = await client.query(`
          SELECT cli_transportadora, cli_prazopg, cli_frete, cli_codcliind, cli_comprador
          FROM cli_ind
          WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1
        `, [cli_codigo, bucket.industria_id]);
        if (vinculo.rows.length > 0) {
          const v = vinculo.rows[0];
          transportadora = v.cli_transportadora || 0;
          condPag        = v.cli_prazopg || '';
          tipoFrete      = v.cli_frete === 'FOB' ? 'F' : 'C';
          pedCliInd      = v.cli_codcliind || '';
          pedComprador   = v.cli_comprador || '';
        }
      } catch { /* vínculo não obrigatório */ }

      const totBruto = items.reduce((s: number, i: any) =>
        s + parseFloat(i.preco_bruto || 0) * parseFloat(i.quantidade || 0), 0);
      const totLiq = bucket.total || 0;

      // Inserir pedido
      await client.query(`
        INSERT INTO pedidos (
          ped_data, ped_situacao, ped_numero, ped_pedido,
          ped_cliente, ped_industria, ped_vendedor, ped_transp,
          ped_tabela, ped_totbruto, ped_totliq,
          ped_condpag, ped_tipofrete, ped_cliind, ped_comprador, ped_obs
        ) VALUES (
          CURRENT_DATE, 'P', $1, $2,
          $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13, $14
        )
      `, [
        pedNumero, pedPedido,
        cli_codigo, bucket.industria_id, userId, transportadora,
        tabela, totBruto, totLiq,
        condPag, tipoFrete, pedCliInd, pedComprador,
        'Pedido gerado via Importador Simplificado',
      ]);

      // Inserir itens
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(`
          INSERT INTO itens_ped (
            ite_pedido, ite_seq, ite_industria, ite_idproduto, ite_produto, ite_nomeprod,
            ite_quant, ite_puni, ite_totbruto, ite_puniliq, ite_totliquido,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5,
            ite_des6, ite_des7, ite_des8, ite_des9, ite_des10, ite_promocao
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        `, [
          pedPedido, i + 1, bucket.industria_id,
          item.pro_id, item.codigo, item.descricao,
          item.quantidade,
          item.preco_bruto || item.preco_unitario,
          parseFloat(item.preco_bruto || 0) * parseFloat(item.quantidade || 0),
          item.preco_unitario,
          parseFloat(item.preco_unitario || 0) * parseFloat(item.quantidade || 0),
          item.descontos?.desc1 || 0, item.descontos?.desc2 || 0,
          item.descontos?.desc3 || 0, item.descontos?.desc4 || 0,
          item.descontos?.desc5 || 0, item.descontos?.desc6 || 0,
          item.descontos?.desc7 || 0, item.descontos?.desc8 || 0,
          item.descontos?.desc9 || 0, item.descontos?.desc10 || 0,
          item.is_promo ? 'S' : 'N',
        ]);
      }

      createdOrders.push(pedPedido);
    }

    await client.query('COMMIT');

    // Limpar rascunhos após checkout
    try {
      await client.query(`DELETE FROM smart_importer_drafts WHERE vendedor_id = $1`, [userId]);
    } catch { /* não crítico */ }

    res.json({
      success: true,
      message: `${createdOrders.length} ${createdOrders.length === 1 ? 'pedido gerado' : 'pedidos gerados'} com sucesso!`,
      orders: createdOrders,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [SMART-IMPORTER] checkout:', error.message);
    res.status(500).json({ success: false, message: `Erro ao faturar: ${error.message}` });
  } finally {
    await client.query('RESET search_path').catch(() => {});
    client.release();
  }
}

// ─── POST /api/smart-importer/parse-batch ────────────────────────────────────
// Recebe linhas do Excel já parseadas no frontend e retorna grupos por CNPJ.
// Usa 4 queries batched (independente do volume) + matching em memória.
export async function parseBatchHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { for_codigo, rows } = req.body as {
      for_codigo: number | null;
      rows: { cnpj: string; pedido: string; data: number; item: string; qtd: number }[];
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, message: 'rows[] é obrigatório.' });
      return;
    }

    const normCnpj = (c: string) => c.replace(/[.\-/]/g, '');

    // ── 1. Agrupar por CNPJ + pedido ─────────────────────────────────────────
    const groupMap = new Map<string, {
      cnpj: string; pedido_ind: string; data_excel: number;
      linhas: { item: string; qtd: number }[];
    }>();
    for (const row of rows) {
      const key = `${row.cnpj}||${row.pedido}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { cnpj: row.cnpj, pedido_ind: String(row.pedido), data_excel: row.data, linhas: [] });
      }
      groupMap.get(key)!.linhas.push({ item: String(row.item || '').trim(), qtd: Number(row.qtd) || 1 });
    }

    // ── Query 1: todos os clientes pelos CNPJs únicos ─────────────────────────
    const uniqueCnpjs = [...new Set([...groupMap.values()].map(g => normCnpj(g.cnpj)))];
    const cliRes = await db.query(`
      SELECT cli_codigo, cli_nome, cli_nomred,
             REPLACE(REPLACE(REPLACE(cli_cnpj,'.',''),'/',''),'-','') AS cnpj_norm
      FROM clientes
      WHERE REPLACE(REPLACE(REPLACE(cli_cnpj,'.',''),'/',''),'-','') = ANY($1::text[])
    `, [uniqueCnpjs]);
    const cliMap = new Map<string, any>(); // normCnpj → cliente
    cliRes.rows.forEach((r: any) => cliMap.set(r.cnpj_norm, r));

    // ── Query 2: condições cli_ind para todos os clientes encontrados ─────────
    const foundCliCodigos = [...new Set(cliRes.rows.map((r: any) => r.cli_codigo as number))];
    const condMap = new Map<number, Record<number, any>>(); // cli_codigo → { for_codigo → cond }
    if (foundCliCodigos.length > 0) {
      const condRes = await db.query(`
        SELECT cli_codigo, cli_forcodigo AS for_codigo, cli_tabela,
          COALESCE(cli_desc1,0)  AS desc1,  COALESCE(cli_desc2,0)  AS desc2,
          COALESCE(cli_desc3,0)  AS desc3,  COALESCE(cli_desc4,0)  AS desc4,
          COALESCE(cli_desc5,0)  AS desc5,  COALESCE(cli_desc6,0)  AS desc6,
          COALESCE(cli_desc7,0)  AS desc7,  COALESCE(cli_desc8,0)  AS desc8,
          COALESCE(cli_desc9,0)  AS desc9,  COALESCE(cli_desc10,0) AS desc10
        FROM cli_ind WHERE cli_codigo = ANY($1::int[])
      `, [foundCliCodigos]);
      condRes.rows.forEach((r: any) => {
        if (!condMap.has(r.cli_codigo)) condMap.set(r.cli_codigo, {});
        condMap.get(r.cli_codigo)![r.for_codigo] = r;
      });
    }

    // ── Query 3: todos os produtos pelos códigos únicos ───────────────────────
    const allCodes = [...new Set(
      [...groupMap.values()].flatMap(g => g.linhas.map(l => l.item.toUpperCase()))
    )];
    const prodMap = new Map<string, any>(); // código de busca → produto
    if (allCodes.length > 0) {
      const prodRes = await db.query(`
        SELECT p.pro_id, p.pro_industria, p.pro_codprod, p.pro_nome,
               UPPER(TRIM(p.pro_codprod))          AS code_main,
               UPPER(TRIM(p.pro_conversao))         AS code_conv,
               UPPER(TRIM(p.pro_codigooriginal))    AS code_orig,
               f.for_nomered AS industria_nome
        FROM cad_prod p
        JOIN fornecedores f ON f.for_codigo = p.pro_industria
        WHERE ($1::int IS NULL OR p.pro_industria = $1)
          AND (
            UPPER(TRIM(p.pro_codprod))          = ANY($2::text[])
            OR UPPER(TRIM(p.pro_conversao))      = ANY($2::text[])
            OR UPPER(TRIM(p.pro_codigooriginal)) = ANY($2::text[])
          )
      `, [for_codigo || null, allCodes]);

      const codeSet = new Set(allCodes);
      for (const p of prodRes.rows) {
        // Mapeia cada alias encontrado para este produto (primeiro match ganha)
        for (const code of [p.code_main, p.code_conv, p.code_orig] as string[]) {
          if (code && codeSet.has(code) && !prodMap.has(code)) {
            prodMap.set(code, p);
          }
        }
      }
    }

    // ── Query 4: todos os preços para os produtos encontrados ─────────────────
    const foundProIds = [...new Set([...prodMap.values()].map(p => p.pro_id as number))];
    const priceMap = new Map<number, any[]>(); // pro_id → preços[]
    if (foundProIds.length > 0) {
      const priceRes = await db.query(`
        SELECT itab_idprod, itab_precobruto, itab_precopromo, itab_tabela
        FROM cad_tabelaspre
        WHERE itab_idprod = ANY($1::int[])
        ORDER BY itab_idprod, itab_precobruto DESC
      `, [foundProIds]);
      priceRes.rows.forEach((r: any) => {
        if (!priceMap.has(r.itab_idprod)) priceMap.set(r.itab_idprod, []);
        priceMap.get(r.itab_idprod)!.push(r);
      });
    }

    // Helper: melhor preço para um produto dado a tabela do cliente
    const getBestPrice = (pro_id: number, tabela: string) => {
      const prices = priceMap.get(pro_id) || [];
      return prices.find(p => p.itab_tabela === tabela) || prices[0] || null;
    };

    // ── Montar grupos com matching 100% em memória ────────────────────────────
    const groups: any[] = [];

    for (const [, g] of groupMap) {
      const cli = cliMap.get(normCnpj(g.cnpj));

      if (!cli) {
        groups.push({
          cnpj: g.cnpj, pedido_ind: g.pedido_ind, data_excel: g.data_excel,
          status: 'not_found', cli_codigo: null, cli_nome: null, cli_nomred: null,
          itens: [], nao_encontrados: g.linhas.map(l => ({ codigo: l.item, qtd: l.qtd })),
          total_itens: g.linhas.length, itens_encontrados: 0,
          itens_nao_encontrados: g.linhas.length, total_valor: 0,
        });
        continue;
      }

      const conditions = condMap.get(cli.cli_codigo) || {};
      const itens: any[]          = [];
      const naoEncontrados: any[] = [];

      for (const linha of g.linhas) {
        const prod = prodMap.get(linha.item.toUpperCase());
        if (!prod) { naoEncontrados.push({ codigo: linha.item, qtd: linha.qtd }); continue; }

        const cond       = conditions[prod.pro_industria] || { cli_tabela: '0' };
        const price      = getBestPrice(prod.pro_id, cond.cli_tabela);
        const precoBruto = price ? parseFloat(price.itab_precobruto || 0) : 0;
        const promoPrice = price ? parseFloat(price.itab_precopromo || 0) : 0;
        let precoUnit    = precoBruto;
        let isPromo      = false;

        if (promoPrice > 0) {
          precoUnit = promoPrice;
          isPromo   = true;
        } else {
          for (let i = 1; i <= 10; i++) {
            const d = parseFloat(cond[`desc${i}`] || 0);
            if (d > 0) precoUnit = precoUnit * (1 - d / 100);
          }
        }

        itens.push({
          pro_id:         prod.pro_id,
          codigo:         prod.pro_codprod,
          descricao:      prod.pro_nome,
          industria_id:   prod.pro_industria,
          industria_nome: prod.industria_nome,
          quantidade:     linha.qtd,
          preco_bruto:    precoBruto,
          preco_unitario: precoUnit,
          total:          linha.qtd * precoUnit,
          is_promo:       isPromo,
          tabela:         cond.cli_tabela,
          descontos:      cond,
          found:          true,
        });
      }

      groups.push({
        cnpj:                  g.cnpj,
        pedido_ind:            g.pedido_ind,
        data_excel:            g.data_excel,
        status:                'found',
        cli_codigo:            cli.cli_codigo,
        cli_nome:              cli.cli_nome,
        cli_nomred:            cli.cli_nomred,
        itens,
        nao_encontrados:       naoEncontrados,
        total_itens:           g.linhas.length,
        itens_encontrados:     itens.length,
        itens_nao_encontrados: naoEncontrados.length,
        total_valor:           itens.reduce((s: number, i: any) => s + i.total, 0),
      });
    }

    res.json({ success: true, groups });
  } catch (error: any) {
    console.error('❌ [SMART-IMPORTER] parse-batch:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/smart-importer/confirm-batch ──────────────────────────────────
// Confirma e cria todos os pedidos da importação em lote em transação única.
export async function confirmBatchHandler(req: Request, res: Response): Promise<void> {
  const { groups, user_initials } = req.body as {
    groups: {
      cli_codigo: number;
      pedido_ind: string;
      data_excel: number; // serial Excel
      industria_id: number;
      itens: any[];
    }[];
    user_initials: string;
  };

  const schema = req.schema!;
  const userId = req.user!.userId;

  if (!Array.isArray(groups) || groups.length === 0) {
    res.status(400).json({ success: false, message: 'Nenhum grupo para importar.' });
    return;
  }

  const dbClient = await pool.connect();
  const createdOrders: string[] = [];

  try {
    await dbClient.query(`SET search_path TO "${schema}", public`);
    await dbClient.query('BEGIN');

    for (const group of groups) {
      if (!group.cli_codigo || !Array.isArray(group.itens) || group.itens.length === 0) continue;

      // Verificar OC duplicada
      const dupCheck = await dbClient.query(`
        SELECT ped_pedido FROM pedidos
        WHERE ped_cliente = $1 AND (ped_pedcli = $2 OR ped_oc = $2)
        LIMIT 1
      `, [group.cli_codigo, group.pedido_ind]);
      if (dupCheck.rows.length > 0) continue; // já existe — pula sem erro

      // Gerar número de pedido
      let seqResult: any;
      try   { seqResult = await dbClient.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
      catch { seqResult = await dbClient.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }

      const pedNumero = seqResult.rows[0].next_num;
      const initials  = (user_initials || 'IMP').toUpperCase().replace(/\s+/g, '');
      const pedPedido = initials + pedNumero.toString().padStart(6, '0');

      // Buscar dados do vínculo cli_ind
      let transportadora = 0, condPag = '', tipoFrete = 'C', pedCliInd = '', pedComprador = '';
      try {
        const vinculo = await dbClient.query(`
          SELECT cli_transportadora, cli_prazopg, cli_frete, cli_codcliind, cli_comprador
          FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1
        `, [group.cli_codigo, group.industria_id]);
        if (vinculo.rows.length > 0) {
          const v = vinculo.rows[0];
          transportadora = v.cli_transportadora || 0;
          condPag        = v.cli_prazopg || '';
          tipoFrete      = v.cli_frete === 'FOB' ? 'F' : 'C';
          pedCliInd      = v.cli_codcliind || '';
          pedComprador   = v.cli_comprador || '';
        }
      } catch { /* vínculo não obrigatório */ }

      const totBruto = group.itens.reduce((s: number, i: any) =>
        s + parseFloat(i.preco_bruto || 0) * parseFloat(i.quantidade || 0), 0);
      const totLiq   = group.itens.reduce((s: number, i: any) =>
        s + parseFloat(i.preco_unitario || 0) * parseFloat(i.quantidade || 0), 0);
      const tabela   = group.itens[0]?.tabela || '';

      // Inserir pedido — data sempre = dia da importação (CURRENT_DATE)
      await dbClient.query(`
        INSERT INTO pedidos (
          ped_data, ped_situacao, ped_numero, ped_pedido,
          ped_cliente, ped_industria, ped_vendedor, ped_transp,
          ped_tabela, ped_totbruto, ped_totliq,
          ped_condpag, ped_tipofrete, ped_cliind, ped_comprador,
          ped_pedcli, ped_oc, ped_obs
        ) VALUES (
          CURRENT_DATE, 'P', $1, $2,
          $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13,
          $14, $14, $15
        )
      `, [
        pedNumero, pedPedido,
        group.cli_codigo, group.industria_id, userId, transportadora,
        tabela, totBruto, totLiq,
        condPag, tipoFrete, pedCliInd, pedComprador,
        group.pedido_ind,
        'Importado via Importador em Lote (arquivo indústria)',
      ]);

      // Inserir itens
      for (let i = 0; i < group.itens.length; i++) {
        const item = group.itens[i];
        await dbClient.query(`
          INSERT INTO itens_ped (
            ite_pedido, ite_seq, ite_industria, ite_idproduto, ite_produto, ite_nomeprod,
            ite_quant, ite_puni, ite_totbruto, ite_puniliq, ite_totliquido,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5,
            ite_des6, ite_des7, ite_des8, ite_des9, ite_des10, ite_promocao
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        `, [
          pedPedido, i + 1, group.industria_id,
          item.pro_id, item.codigo, item.descricao,
          item.quantidade,
          item.preco_bruto || item.preco_unitario,
          parseFloat(item.preco_bruto || 0) * parseFloat(item.quantidade || 0),
          item.preco_unitario,
          parseFloat(item.preco_unitario || 0) * parseFloat(item.quantidade || 0),
          item.descontos?.desc1 || 0, item.descontos?.desc2 || 0,
          item.descontos?.desc3 || 0, item.descontos?.desc4 || 0,
          item.descontos?.desc5 || 0, item.descontos?.desc6 || 0,
          item.descontos?.desc7 || 0, item.descontos?.desc8 || 0,
          item.descontos?.desc9 || 0, item.descontos?.desc10 || 0,
          item.is_promo ? 'S' : 'N',
        ]);
      }

      createdOrders.push(pedPedido);
    }

    await dbClient.query('COMMIT');
    res.json({
      success: true,
      message: `${createdOrders.length} ${createdOrders.length === 1 ? 'pedido importado' : 'pedidos importados'} com sucesso!`,
      orders: createdOrders,
      total: createdOrders.length,
    });
  } catch (error: any) {
    await dbClient.query('ROLLBACK').catch(() => {});
    console.error('❌ [SMART-IMPORTER] confirm-batch:', error.message);
    res.status(500).json({ success: false, message: `Erro ao importar: ${error.message}` });
  } finally {
    await dbClient.query('RESET search_path').catch(() => {});
    dbClient.release();
  }
}
