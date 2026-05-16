import { Request, Response } from 'express';
import { pool } from '../../config/database';
import { getLinkedSellerId, buildIndustryFilterClause } from '../../shared/permissions';
import sharp from 'sharp';
import { callAI } from '../../shared/utils/ai_providers';

function getUserId(req: Request) { return req.user?.userId; }
function pInt(v: any): number | null { const n = parseInt(v); return isNaN(n) ? null : n; }

// ─── GET /api/orders/count-whatsapp ──────────────────────────────────────────
export async function countWhatsappHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(
      `SELECT COUNT(*)::int AS count FROM pedidos WHERE ped_situacao = 'J'`
    );
    res.json({ success: true, count: r.rows[0].count });
  } catch (error: any) {
    res.json({ success: true, count: 0 });
  }
}

// ─── GET /api/orders/next-number ──────────────────────────────────────────────
export async function nextNumberHandler(req: Request, res: Response): Promise<void> {
  try {
    const { initials } = req.query;
    const db = req.db!;

    // Usar iniciais do usuário logado ou fallback
    const userInitials = String(initials || req.user?.username?.substring(0, 2) || 'HS').toUpperCase().replace(/\s+/g, '');

    let seqResult;
    try {
      seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num");
    } catch {
      seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num");
    }

    const pedNumero = seqResult.rows[0].next_num;
    const pedPedido = userInitials + pedNumero.toString().padStart(6, '0');

    res.json({ success: true, data: { formatted_number: pedPedido, sequence: pedNumero } });
  } catch (error: any) {
    console.error('❌ [ORDERS] next-number:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders ──────────────────────────────────────────────────────────
export async function listOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { industria, cliente, ignorarIndustria, pesquisa, situacao, dataInicio, dataFim, limit } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    const sellerId = await getLinkedSellerId(db, userId);
    const params: any[] = [];
    const { filterClause } = buildIndustryFilterClause(sellerId, 'p.ped_industria', params);

    let query = `
      SELECT
        p.*,
        c.cli_nomred, c.cli_nome,
        f.for_nomered, f.for_email,
        v.ven_nome,
        (SELECT COALESCE(SUM(i.ite_quant), 0) FROM itens_ped i WHERE i.ite_pedido = p.ped_pedido) AS ped_total_quant,
        (SELECT COUNT(*) FROM itens_ped i WHERE i.ite_pedido = p.ped_pedido) AS ped_total_items
      FROM pedidos p
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      LEFT JOIN fornecedores f ON p.ped_industria = f.for_codigo
      LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
      WHERE 1=1 AND p.ped_situacao <> 'E' ${filterClause}
    `;

    let idx = params.length + 1;

    if (industria && industria !== 'all' && ignorarIndustria !== 'true') {
      query += ` AND p.ped_industria = $${idx++}`;
      params.push(parseInt(String(industria)));
    }
    if (cliente) { query += ` AND p.ped_cliente = $${idx++}`; params.push(parseInt(String(cliente))); }
    if (pesquisa) {
      query += ` AND (p.ped_pedido ILIKE $${idx} OR c.cli_nomred ILIKE $${idx} OR p.ped_cliind ILIKE $${idx})`;
      params.push(`%${pesquisa}%`);
      idx++;
    }
    if (situacao && situacao !== 'Z') { query += ` AND p.ped_situacao = $${idx++}`; params.push(situacao); }
    if (dataInicio) { query += ` AND p.ped_data >= $${idx++}`; params.push(dataInicio); }
    if (dataFim) { query += ` AND p.ped_data <= $${idx++}`; params.push(dataFim); }

    query += ` ORDER BY p.ped_data DESC LIMIT $${idx}`;
    params.push(parseInt(String(limit || 700)));

    const result = await db.query(query, params);
    res.json({ success: true, pedidos: result.rows, total: result.rows.length });
  } catch (error: any) {
    console.error('❌ [ORDERS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const db = req.db!;
    const userId = getUserId(req);

    // Suporte a industria via query param (preferido) ou via legado :industria no id
    let finalPedido = id;
    let finalIndustria: number | null = null;
    if (req.query.industria) {
      finalIndustria = parseInt(String(req.query.industria));
    } else if (id.includes(':')) {
      const parts = id.split(':');
      finalPedido = parts[0];
      finalIndustria = parseInt(parts[1]);
    }

    const sellerId = await getLinkedSellerId(db, userId);
    const params: any[] = [finalPedido];
    const { filterClause } = buildIndustryFilterClause(sellerId, 'p.ped_industria', params);

    let orderQuery = `
      SELECT p.*, c.cli_nome AS ped_clientenome, c.cli_nomred,
             f.for_nomered AS ped_industrianome, f.for_email,
             f.for_usa_menor_preco,
             v.ven_nome AS ped_vendedornome
      FROM pedidos p
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      LEFT JOIN fornecedores f ON p.ped_industria = f.for_codigo
      LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
      WHERE TRIM(p.ped_pedido) = TRIM($1) ${filterClause}
    `;

    if (finalIndustria) {
      params.push(finalIndustria);
      orderQuery += ` AND p.ped_industria = $${params.length}`;
    }

    const orderResult = await db.query(orderQuery, params);

    if (!orderResult.rows.length) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }

    const itemsParams: any[] = [finalPedido];
    if (finalIndustria) itemsParams.push(finalIndustria);
    const itemsResult = await db.query(`
      SELECT ip.*,
             ip.ite_nomeprod AS ite_descricao,
             ip.ite_quant    AS ite_quantidade,
             ip.ite_puni     AS ite_preco,
             ip.ite_totbruto AS ite_total,
             ip.ite_embuch   AS ite_unidade
      FROM itens_ped ip
      WHERE TRIM(ip.ite_pedido) = TRIM($1)
        ${finalIndustria ? 'AND ip.ite_industria = $2' : ''}
      ORDER BY ip.ite_seq
    `, itemsParams);

    res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (error: any) {
    console.error('❌ [ORDERS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
export async function createOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    const db = req.db!;

    if (!data.ped_cliente) { res.status(400).json({ success: false, message: 'Cliente é obrigatório' }); return; }
    if (!data.ped_vendedor) { res.status(400).json({ success: false, message: 'Vendedor é obrigatório' }); return; }
    if (!data.ped_industria) { res.status(400).json({ success: false, message: 'Indústria é obrigatória' }); return; }
    if (!data.ped_tabela) { res.status(400).json({ success: false, message: 'Tabela de preço é obrigatória' }); return; }

    // Usar initials do username logado
    const userInitials = (req.user?.username?.substring(0, 2) || 'HS').toUpperCase();

    let seqResult;
    try { seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
    catch { seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }

    const pedNumero = seqResult.rows[0].next_num;
    const pedPedido = data.ped_pedido || (userInitials + pedNumero.toString().padStart(6, '0'));

    const result = await db.query(`
      INSERT INTO pedidos (
        ped_numero, ped_pedido, ped_data, ped_situacao,
        ped_cliente, ped_transp, ped_vendedor, ped_condpag, ped_comprador,
        ped_tipofrete, ped_tabela, ped_industria, ped_cliind,
        ped_pri, ped_seg, ped_ter, ped_qua, ped_qui, ped_sex, ped_set, ped_oit, ped_nov,
        ped_totbruto, ped_totliq, ped_totalipi, ped_obs,
        ped_oc, ped_consolidado_id, ped_situacao_original
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
        $27, $28, $29
      ) RETURNING *
    `, [
      pedNumero, pedPedido,
      data.ped_data || new Date().toISOString().split('T')[0],
      data.ped_situacao || 'P',
      data.ped_cliente, data.ped_transp || 0, data.ped_vendedor,
      data.ped_condpag || '', data.ped_comprador || '',
      String(data.ped_tipofrete || 'C').trim().substring(0, 1) || 'C', String(data.ped_tabela || '').substring(0, 60), data.ped_industria, data.ped_cliind || '',
      data.ped_pri || 0, data.ped_seg || 0, data.ped_ter || 0, data.ped_qua || 0,
      data.ped_qui || 0, data.ped_sex || 0, data.ped_set || 0, data.ped_oit || 0, data.ped_nov || 0,
      data.ped_totbruto || 0, data.ped_totliq || 0, data.ped_totalipi || 0, data.ped_obs || '',
      data.ped_oc || null, data.ped_consolidado_id || null, data.ped_situacao_original || null
    ]);

    res.json({ success: true, message: `Pedido ${pedPedido} criado com sucesso!`, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [ORDERS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/orders/mobile — simplified mobile order creation ──────────────
export async function createMobileOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ped_cliente, ped_industria, ped_transp, tabela: tabelaBody, itens = [] } = req.body;
    const db = req.db!;

    if (!ped_industria) {
      res.status(400).json({ success: false, message: 'Indústria é obrigatória' });
      return;
    }

    const venCodigo = await getLinkedSellerId(db, req.user?.userId) ?? 0;

    // Usa tabela enviada pelo app; fallback para primeira disponível da indústria
    let tabela = String(tabelaBody || '').trim();
    if (!tabela) {
      const tabelaRes = await db.query(
        `SELECT itab_tabela FROM cad_tabelaspre WHERE itab_idindustria = $1 LIMIT 1`,
        [ped_industria]
      );
      tabela = tabelaRes.rows[0]?.itab_tabela || '';
    }

    // Buscar descontos do cli_ind para gravar nos itens
    let descontos: number[] = new Array(11).fill(0);
    if (ped_cliente) {
      try {
        const cliRes = await db.query(
          `SELECT cli_desc1,cli_desc2,cli_desc3,cli_desc4,cli_desc5,
                  cli_desc6,cli_desc7,cli_desc8,cli_desc9,cli_desc10,cli_desc11
           FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1`,
          [ped_cliente, ped_industria]
        );
        if (cliRes.rows.length > 0) {
          const r = cliRes.rows[0];
          descontos = Array.from({ length: 11 }, (_, i) => parseFloat(r[`cli_desc${i + 1}`] || '0') || 0);
        }
      } catch { /* descontos opcionais */ }
    }

    const userInitials = (req.user?.username?.substring(0, 2) || 'MB').toUpperCase();
    let seqResult;
    try { seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
    catch { seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }
    const pedNumero = seqResult.rows[0].next_num;
    const pedPedido = userInitials + pedNumero.toString().padStart(6, '0');

    const totBruto = (itens as any[]).reduce((s: number, i: any) =>
      s + (Number(i.preco) || 0) * (Number(i.qtd) || 0), 0);

    await db.transaction(async (client) => {
      await client.query(`
        INSERT INTO pedidos (
          ped_numero, ped_pedido, ped_data, ped_situacao,
          ped_cliente, ped_transp, ped_vendedor, ped_condpag, ped_comprador,
          ped_tipofrete, ped_tabela, ped_industria, ped_cliind,
          ped_pri, ped_seg, ped_ter, ped_qua, ped_qui, ped_sex, ped_set, ped_oit, ped_nov,
          ped_totbruto, ped_totliq, ped_totalipi, ped_obs
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
          0,0,0,0,0,0,0,0,0,
          $14,$14,0,''
        )
      `, [
        pedNumero, pedPedido,
        new Date().toISOString().split('T')[0],
        'C',
        ped_cliente || null,
        Number(ped_transp) || 0, venCodigo, '', '',
        'C', tabela, ped_industria, '',
        totBruto,
      ]);

      for (let i = 0; i < (itens as any[]).length; i++) {
        const it = (itens as any[])[i];
        const produto = String(it.pro_codprod || '').toUpperCase();
        const qtd   = Number(it.qtd)   || 0;
        const preco = Number(it.preco) || 0;
        const total = preco * qtd;

        await client.query(`
          INSERT INTO itens_ped (
            ite_pedido, ite_seq, ite_industria,
            ite_idproduto,
            ite_produto, ite_embuch, ite_nomeprod,
            ite_quant, ite_puni, ite_totbruto,
            ite_puniliq, ite_totliquido,
            ite_ipi, ite_st,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5,
            ite_des6, ite_des7, ite_des8, ite_des9, ite_des10, ite_des11,
            ite_valcomipi, ite_valcomst,
            ite_faturado, ite_promocao
          ) VALUES (
            $1,$2,$3,
            COALESCE(
              (SELECT pro_id FROM cad_prod WHERE pro_codprod = $4 AND pro_industria = $3 LIMIT 1),
              (SELECT pro_id FROM cad_prod WHERE pro_codprod = $4 LIMIT 1),
              0
            ),
            $4,'',
            COALESCE(
              (SELECT pro_nome FROM cad_prod WHERE pro_codprod = $4 AND pro_industria = $3 LIMIT 1),
              (SELECT pro_nome FROM cad_prod WHERE pro_codprod = $4 LIMIT 1),
              ''
            ),
            $5,$6,$7,
            $6,$7,
            0,0,
            $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
            0,0,
            'N','N'
          )
        `, [
          pedPedido, i + 1, ped_industria, produto, qtd, preco, total,
          descontos[0], descontos[1], descontos[2], descontos[3], descontos[4],
          descontos[5], descontos[6], descontos[7], descontos[8], descontos[9], descontos[10],
        ]);
      }
    });

    res.json({
      success: true,
      message: `Pedido ${pedPedido} criado com sucesso!`,
      data: { ped_numero: pedNumero, ped_pedido: pedPedido },
    });
  } catch (error: any) {
    console.error('❌ [ORDERS] create-mobile:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/orders/:id ──────────────────────────────────────────────────────
export async function updateOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;
    const db = req.db!;

    // Sanitiza campos varchar(1) — 'CC' é display do frontend para o valor real 'A'
    const sit1 = (v: any, fallback = '') => {
      const s = String(v ?? fallback);
      if (s === 'CC') return 'A';
      return s.substring(0, 1) || fallback;
    };

    await db.query(`
      UPDATE pedidos SET
        ped_data=$1, ped_situacao=$2, ped_cliente=$3, ped_transp=$4,
        ped_vendedor=$5, ped_condpag=$6, ped_comprador=$7,
        ped_tipofrete=$8, ped_tabela=$9, ped_cliind=$10,
        ped_pri=$11, ped_seg=$12, ped_ter=$13, ped_qua=$14, ped_qui=$15,
        ped_sex=$16, ped_set=$17, ped_oit=$18, ped_nov=$19,
        ped_totbruto=$20, ped_totliq=$21, ped_totalipi=$22, ped_obs=$23,
        ped_oc=$24, ped_consolidado_id=$25, ped_situacao_original=$26,
        ped_pedcli=$27, ped_pedindustria=$28
      WHERE TRIM(ped_pedido)=TRIM($29)
    `, [
      data.ped_data, sit1(data.ped_situacao, 'P'), data.ped_cliente, data.ped_transp || 0,
      data.ped_vendedor, data.ped_condpag || '', data.ped_comprador || '',
      sit1(data.ped_tipofrete, 'C'), data.ped_tabela, data.ped_cliind || '',
      data.ped_pri || 0, data.ped_seg || 0, data.ped_ter || 0, data.ped_qua || 0, data.ped_qui || 0,
      data.ped_sex || 0, data.ped_set || 0, data.ped_oit || 0, data.ped_nov || 0,
      data.ped_totbruto || 0, data.ped_totliq || 0, data.ped_totalipi || 0, data.ped_obs || '',
      data.ped_oc || null, data.ped_consolidado_id || null, data.ped_situacao_original || null,
      data.ped_pedcli || '', data.ped_pedindustria || '',
      id,
    ]);

    res.json({ success: true, message: 'Pedido atualizado com sucesso!' });
  } catch (error: any) {
    console.error('❌ [ORDERS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PATCH /api/orders/:id/situacao — Soft delete (ped_situacao = 'E') ────────
export async function softDeleteOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const db = req.db!;

    const result = await db.query(
      `UPDATE pedidos SET ped_situacao = 'E' WHERE TRIM(ped_pedido) = TRIM($1) RETURNING ped_pedido`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }
    console.log(`🗑️ [ORDERS] Soft delete: ${id}`);
    res.json({ success: true, message: 'Pedido marcado como excluído.' });
  } catch (error: any) {
    console.error('❌ [ORDERS] soft-delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/orders/:id — Exclusão definitiva (somente via menu de contexto) ──
export async function deleteOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const db = req.db!;

    await db.query(`DELETE FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1)`, [id]);
    await db.query(`DELETE FROM pedidos WHERE TRIM(ped_pedido) = TRIM($1)`, [id]);

    console.log(`💥 [ORDERS] Exclusão definitiva: ${id}`);
    res.json({ success: true, message: 'Pedido excluído definitivamente.' });
  } catch (error: any) {
    console.error('❌ [ORDERS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders/stats ────────────────────────────────────────────────────
export async function orderStatsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { dataInicio, dataFim, industria, cliente, situacao, ignorarIndustria } = req.query;
    const db = req.db!;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (industria && industria !== 'all' && ignorarIndustria !== 'true') {
      conditions.push(`p.ped_industria = $${idx++}`);
      params.push(parseInt(String(industria)));
    }
    if (cliente) { conditions.push(`p.ped_cliente = $${idx++}`); params.push(parseInt(String(cliente))); }
    // Quando há filtro de situação específico, aplica ele; caso contrário exclui apenas excluídos
    const baseSitFilter = (situacao && situacao !== 'Z')
      ? `p.ped_situacao = $${idx++}` : `p.ped_situacao NOT IN ('E')`;
    if (situacao && situacao !== 'Z') params.push(situacao);

    if (dataInicio) { conditions.push(`p.ped_data >= $${idx++}`); params.push(dataInicio); }
    if (dataFim) { conditions.push(`p.ped_data <= $${idx++}`); params.push(dataFim); }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT
        COUNT(DISTINCT p.ped_pedido)            AS total_pedidos,
        COUNT(DISTINCT p.ped_cliente)           AS total_clientes,
        COALESCE(ROUND(SUM(i.ite_totliquido)::NUMERIC, 2), 0)      AS total_faturamento,
        COALESCE(SUM(i.ite_quant), 0)           AS total_quantidade,
        COALESCE(ROUND(AVG(p.ped_totliq)::NUMERIC, 2), 0)          AS ticket_medio,
        COUNT(DISTINCT p.ped_industria)         AS total_industrias
      FROM pedidos p
      LEFT JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
      WHERE ${baseSitFilter} ${where}
    `, params);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [ORDERS] stats:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders/consolidation-stats ──────────────────────────────────
export async function consolidationStatsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = getUserId(req);
    const sellerId = await getLinkedSellerId(db, userId);
    const params: any[] = [];
    const { filterClause } = buildIndustryFilterClause(sellerId, 'f.for_codigo', params);

    // Agrupa por indústria + cliente — cada combinação é um processo independente.
    // Clientes diferentes na mesma indústria NÃO somam progresso entre si.
    const result = await db.query(`
      SELECT
        f.for_codigo, f.for_nomered, f.for_min_order,
        p.ped_cliente,
        c.cli_nomred, c.cli_nome,
        COALESCE(ROUND(SUM(p.ped_totliq)::NUMERIC, 2), 0) AS current_total,
        COUNT(p.ped_pedido)            AS order_count
      FROM fornecedores f
      JOIN pedidos p  ON p.ped_industria = f.for_codigo AND p.ped_situacao = 'Q'
      JOIN clientes c ON c.cli_codigo = p.ped_cliente
      WHERE f.for_min_order > 0
        ${filterClause}
      GROUP BY f.for_codigo, f.for_nomered, f.for_min_order, p.ped_cliente, c.cli_nomred, c.cli_nome
      ORDER BY f.for_nomered, c.cli_nomred
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [ORDERS] consolidation-stats:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders/:id/print-data ──────────────────────────────────────────
export async function printDataHandler(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const { id: pedPedido } = req.params;
    const { sortBy, industria } = req.query;
    const db = req.db!;

    if (!industria) {
      res.status(400).json({ success: false, message: 'ID da Indústria (industria) é obrigatório' });
      return;
    }

    const masterResult = await db.query(`
      SELECT
        p.*,
        p.ped_condpag AS order_payment_type,
        c.cli_nome, c.cli_nomred, c.cli_endereco, c.cli_endnum AS cli_numero,
        c.cli_complemento, c.cli_bairro,
        c.cli_cidade, c.cli_uf, c.cli_cep, c.cli_cnpj AS client_cnpj, c.cli_inscricao,
        c.cli_fone1 AS cli_fone, c.cli_fone2 AS cli_fax,
        c.cli_email, c.cli_emailnfe, c.cli_emailfinanc AS cli_emailfinanceiro,
        c.cli_cxpostal, c.cli_suframa,
        f.for_nome, f.for_nomered, f.for_fone, f.for_cidade, f.for_uf, f.for_email,
        f.for_logotipo, f.for_locimagem,
        i.cli_comprador       AS ind_comprador,
        i.cli_emailcomprador  AS ind_emailcomprador,
        v.ven_nome, v.ven_fone1 AS ven_fone,
        t.tra_nome, t.tra_endereco, t.tra_bairro, t.tra_cidade, t.tra_uf, t.tra_cep,
        t.tra_cgc, t.tra_inscricao, t.tra_email, t.tra_fone,
        i.cli_obsparticular,
        -- Prioriza comprador específico da indústria (cli_ind); fallback para cli_aniv
        COALESCE(i.cli_comprador, p.ped_comprador) AS ped_comprador_display,
        COALESCE(
          i.cli_emailcomprador,
          (SELECT ani_email FROM cli_aniv ca WHERE ca.ani_cliente = p.ped_cliente AND ca.ani_nome = p.ped_comprador LIMIT 1)
        ) AS ped_emailcomp
      FROM pedidos p
      LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
      LEFT JOIN fornecedores f ON p.ped_industria = f.for_codigo
      LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
      LEFT JOIN transportadora t ON p.ped_transp = t.tra_codigo
      LEFT JOIN cli_ind i ON (p.ped_cliente = i.cli_codigo AND p.ped_industria = i.cli_forcodigo)
      WHERE TRIM(p.ped_pedido) = TRIM($1) AND p.ped_industria = $2
    `, [pedPedido, parseInt(String(industria))]);

    if (!masterResult.rows.length) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      return;
    }

    const orderData: any = masterResult.rows[0];

    // Tratamento de logotipo via sharp (igual ao V1)
    let industry_logotipo: string | null = null;
    const logoFonte = orderData.for_logotipo;
    if (logoFonte) {
      try {
        let imageBuffer: Buffer | null = null;
        if (typeof logoFonte === 'string') {
          const trimmed = logoFonte.trim();
          const isPath = /^[A-Za-z]:[\\\/]/.test(trimmed) || trimmed.startsWith('\\\\') || /\.(png|jpg|jpeg|gif|bmp|svg|webp)$/i.test(trimmed);
          if (!isPath) {
            const cleanBase64 = trimmed.replace(/[\n\r\s]/g, '').replace(/^data:image\/[a-z+]+;base64,/, '');
            if (/^[A-Za-z0-9+/=]+$/.test(cleanBase64) && cleanBase64.length >= 20) {
              imageBuffer = Buffer.from(cleanBase64, 'base64');
            }
          }
        } else if (Buffer.isBuffer(logoFonte)) {
          imageBuffer = logoFonte;
        }

        if (imageBuffer) {
          try {
            const resizedBuffer = await sharp(imageBuffer)
              .resize({ width: 300, height: 150, fit: 'inside', withoutEnlargement: true })
              .toFormat('jpeg', { quality: 80 })
              .toBuffer();
            const resizedBase64 = resizedBuffer.toString('base64');
            industry_logotipo = `data:image/jpeg;base64,${resizedBase64}`;
          } catch {
            const fallbackBase64 = imageBuffer.toString('base64');
            if (fallbackBase64.length <= 150000) industry_logotipo = `data:image/png;base64,${fallbackBase64}`;
          }
        }
        orderData.for_logotipo = industry_logotipo;
        orderData.industry_logotipo = industry_logotipo;
      } catch (e: any) {
        console.error('⚠️ [PRINT-DATA] Erro logo:', e.message);
      }
    }

    const orderBy = sortBy === 'codigo' ? 'ite_produto' : sortBy === 'alfabetica' ? 'ite_nomeprod' : 'ite_seq';

    const itemsResult = await db.query(`
      SELECT
        ip.*,
        p.pro_aplicacao, p.pro_aplicacao2, p.pro_codigooriginal, p.gru_nome
      FROM itens_ped ip
      LEFT JOIN LATERAL (
        SELECT cp.pro_aplicacao, cp.pro_aplicacao2, cp.pro_codigooriginal, cp.pro_conversao, cp.pro_embalagem, g.gru_nome
        FROM cad_prod cp
        LEFT JOIN grupos g ON cp.pro_grupo = g.gru_codigo
        WHERE cp.pro_codprod = ip.ite_produto AND cp.pro_industria = ip.ite_industria
        LIMIT 1
      ) p ON true
      WHERE ip.ite_pedido = $1 AND ip.ite_industria = $2
      ORDER BY ${orderBy}
    `, [pedPedido, parseInt(String(industria))]);

    res.json({ success: true, data: { order: { ...orderData, industry_logotipo }, items: itemsResult.rows } });
    console.log(`✅ [PRINT_DATA] ${pedPedido} | ${itemsResult.rows.length} itens | ${Date.now() - startTime}ms`);
  } catch (error: any) {
    console.error('❌ [PRINT_DATA]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/orders/consolidate ─────────────────────────────────────────
import { consolidateOrders } from '../../shared/routines/orderConsolidation';

export async function consolidateOrdersHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);

    let { masterOrderId, sourceOrderIds, indu_id } = req.body;

    // Suporte ao fluxo do ConsolidationDashboard que envia indu_id + cli_id
    // Regra de negócio: consolidação é por cliente — clientes diferentes = processos separados.
    if (indu_id && (!masterOrderId || !sourceOrderIds)) {
      const { cli_id } = req.body;
      if (!cli_id) {
        res.status(400).json({ success: false, message: 'Informe o cliente (cli_id) para consolidar.' });
        return;
      }

      const queueRes = await client.query(
        `SELECT ped_pedido, ped_totliq FROM pedidos
         WHERE ped_industria = $1 AND ped_cliente = $2 AND ped_situacao = 'Q'
         ORDER BY ped_data ASC`,
        [indu_id, cli_id]
      );
      if (queueRes.rows.length < 1) {
        res.status(400).json({ success: false, message: 'Nenhum pedido na fila para este cliente e indústria.' });
        return;
      }

      // Validação Regra de Ouro #2: total deste cliente deve atingir o mínimo da indústria
      const minRes = await client.query(
        'SELECT for_min_order FROM fornecedores WHERE for_codigo = $1',
        [indu_id]
      );
      const forMinOrder = parseFloat(minRes.rows[0]?.for_min_order || '0');
      const currentTotal = queueRes.rows.reduce((sum: number, r: any) => sum + parseFloat(r.ped_totliq || '0'), 0);

      if (forMinOrder > 0 && currentTotal < forMinOrder) {
        res.status(400).json({
          success: false,
          message: `Total em fila (${currentTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) ainda não atingiu o mínimo de ${forMinOrder.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        });
        return;
      }

      masterOrderId = queueRes.rows[0].ped_pedido;
      sourceOrderIds = queueRes.rows.slice(1).map((r: any) => r.ped_pedido);
    }

    if (!masterOrderId) {
      res.status(400).json({ success: false, message: 'Dados insuficientes para consolidação.' });
      return;
    }

    await client.query('BEGIN');
    const result = await consolidateOrders(client, masterOrderId, sourceOrderIds || []);

    if (result.success) {
      await client.query('COMMIT');
      res.json(result);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json(result);
    }
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [ORDERS] consolidate handler:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
}

// ─── POST /api/orders/:id/clone ───────────────────────────────────────────────
export async function cloneOrderHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);
    const pedPedido = String(req.params.id);
    const userInitials = (req.user?.username?.substring(0, 2) || 'HS').toUpperCase().replace(/\s+/g, '');

    await client.query('BEGIN');

    // 1. Buscar pedido original
    const origResult = await client.query(
      `SELECT * FROM pedidos WHERE TRIM(ped_pedido) = TRIM($1)`, [pedPedido]
    );
    if (!origResult.rows.length) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Pedido original não encontrado' });
      return;
    }
    const orig = origResult.rows[0];

    // 2. Gerar novo número sequencial
    let seqResult;
    try {
      seqResult = await client.query("SELECT nextval('gen_pedidos_id') AS next_num");
    } catch {
      seqResult = await client.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num");
    }
    const newPedNumero = seqResult.rows[0].next_num;
    const newPedPedido = (userInitials + String(newPedNumero).padStart(6, '0')).replace(/\s+/g, '');

    // helper: trunca string para max 1 char — campos varchar(1) do schema V1
    const c1 = (v: any, fallback = '') => (String(v ?? fallback)).substring(0, 1);

    // 3. Clonar cabeçalho (data = hoje, situação = P, sem vínculos de faturamento)
    let clonedOrder: any;
    try {
      clonedOrder = await client.query(`
        INSERT INTO pedidos (
          ped_numero, ped_pedido, ped_data, ped_situacao,
          ped_cliente, ped_industria, ped_vendedor, ped_transp,
          ped_tabela, ped_totbruto, ped_totliq, ped_totalipi, ped_obs,
          ped_pri, ped_seg, ped_ter, ped_qua, ped_qui, ped_sex, ped_set, ped_oit, ped_nov,
          ped_pedindustria, ped_cliind, ped_condpag, ped_tipofrete, ped_comprador,
          ped_ramoatv, ped_obra_nome, ped_obra_endereco, ped_obra_contato,
          ped_fase_projeto, ped_area_m2, ped_pe_direito, ped_tipo_piso, ped_obs_tecnicas
        ) VALUES (
          $1, $2, CURRENT_DATE, 'P',
          $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33, $34
        ) RETURNING *
      `, [
        newPedNumero, newPedPedido,
        orig.ped_cliente, orig.ped_industria, orig.ped_vendedor, orig.ped_transp,
        orig.ped_tabela, orig.ped_totbruto, orig.ped_totliq, orig.ped_totalipi, orig.ped_obs || '',
        orig.ped_pri || 0, orig.ped_seg || 0, orig.ped_ter || 0, orig.ped_qua || 0, orig.ped_qui || 0,
        orig.ped_sex || 0, orig.ped_set || 0, orig.ped_oit || 0, orig.ped_nov || 0,
        orig.ped_pedindustria || '', orig.ped_cliind || '', orig.ped_condpag || '',
        c1(orig.ped_tipofrete, 'C'), orig.ped_comprador || '',
        c1(orig.ped_ramoatv), orig.ped_obra_nome || '', orig.ped_obra_endereco || '', orig.ped_obra_contato || '',
        c1(orig.ped_fase_projeto), orig.ped_area_m2 || 0, orig.ped_pe_direito || 0,
        c1(orig.ped_tipo_piso), orig.ped_obs_tecnicas || '',
      ]);
    } catch (hErr: any) {
      throw new Error(`[HEADER] ${hErr.message} | detail: ${hErr.detail || 'n/a'}`);
    }

    // 4. Copiar todos os itens
    const itemsResult = await client.query(
      `SELECT * FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq`, [pedPedido]
    );

    let itemsCloned = 0;
    for (const item of itemsResult.rows) {
      try {
        await client.query(`
          INSERT INTO itens_ped (
            ite_pedido, ite_seq, ite_industria, ite_idproduto, ite_produto, ite_embuch, ite_nomeprod,
            ite_quant, ite_puni, ite_totbruto, ite_puniliq, ite_totliquido, ite_ipi,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5,
            ite_des6, ite_des7, ite_des8, ite_des9, ite_des10, ite_des11, ite_valcomipi,
            ite_st, ite_valcomst, ite_promocao, ite_descontos,
            ite_dimensoes, ite_acabamento, ite_carga_kg, ite_ambiente, ite_faturado, ite_qtdfat
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24, $25,
            $26, $27, $28, $29,
            $30, $31, $32, $33, 'N', 0
          )
        `, [
          newPedPedido, item.ite_seq, item.ite_industria, item.ite_idproduto, item.ite_produto,
          item.ite_embuch, item.ite_nomeprod,
          item.ite_quant, item.ite_puni, item.ite_totbruto, item.ite_puniliq, item.ite_totliquido, item.ite_ipi,
          item.ite_des1 || 0, item.ite_des2 || 0, item.ite_des3 || 0, item.ite_des4 || 0, item.ite_des5 || 0,
          item.ite_des6 || 0, item.ite_des7 || 0, item.ite_des8 || 0, item.ite_des9 || 0,
          item.ite_des10 || 0, item.ite_des11 || 0, item.ite_valcomipi || 0,
          item.ite_st || 0, item.ite_valcomst || 0, item.ite_promocao ?? 'N', item.ite_descontos || '',
          item.ite_dimensoes || '', item.ite_acabamento || '', item.ite_carga_kg || 0, item.ite_ambiente || '',
        ]);
      } catch (iErr: any) {
        throw new Error(`[ITEM seq=${item.ite_seq} prod=${item.ite_produto}] ${iErr.message} | detail: ${iErr.detail || 'n/a'}`);
      }
      itemsCloned++;
    }

    await client.query('COMMIT');
    console.log(`✅ [ORDERS] ${pedPedido} → clone ${newPedPedido} (${itemsCloned} itens)`);

    res.json({
      success: true,
      data: clonedOrder.rows[0],
      newPedPedido,
      itemsCloned,
      message: `Pedido clonado com sucesso! Novo número: ${newPedPedido}`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [ORDERS] clone:', error.message, error.detail || '');
    res.status(500).json({ success: false, message: error.message, detail: error.detail || null });
  } finally {
    client.release();
  }
}

// ─── PATCH /api/orders/:id/status-envio ──────────────────────────────────────
// Aceita { enviado: 'S' | 'N' | true | false }
// true/'S'  → ped_iris_autoriza = true,  ped_iris_enviado_em = NULL  (IRIS detecta e envia e-mail)
// false/'N' → ped_iris_autoriza = false, ped_iris_enviado_em = NULL  (reset)
// Não toca em ped_enviado (flag legada "enviado à indústria")
export async function statusEnvioHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: pedPedido } = req.params;
    const { enviado } = req.body;
    const db = req.db!;

    const autoriza = enviado === true || enviado === 'S';

    const result = await db.query(
      `UPDATE pedidos
          SET ped_iris_autoriza = $1, ped_iris_enviado_em = NULL
        WHERE TRIM(ped_pedido) = TRIM($2)
        RETURNING ped_pedido, ped_iris_autoriza`,
      [autoriza, pedPedido]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: autoriza ? 'Cotação autorizada para envio via IRIS.' : 'Autorização cancelada.',
    });
  } catch (error: any) {
    console.error('❌ [ORDERS] status-envio:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}


// ─── PATCH /api/orders/:id/enviado ───────────────────────────────────────────
// Flag "enviado à indústria" (ped_enviado boolean). Usado pelo web context menu.
export async function enviadoIndustriaHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: pedPedido } = req.params;
    const { enviado } = req.body;
    const db = req.db!;

    const valor = enviado === true || enviado === 'S';

    const result = await db.query(
      `UPDATE pedidos
          SET ped_enviado = $1
        WHERE TRIM(ped_pedido) = TRIM($2)
        RETURNING ped_pedido, ped_enviado`,
      [valor, pedPedido]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: valor ? 'Pedido marcado como enviado à indústria.' : 'Pedido desmarcado como enviado.',
    });
  } catch (error: any) {
    console.error('❌ [ORDERS] enviado:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PATCH /api/orders/:id/converter-pedido ──────────────────────────────────
export async function converterPedidoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: pedPedido } = req.params;
    const db = req.db!;

    const check = await db.query(
      `SELECT ped_situacao FROM pedidos WHERE TRIM(ped_pedido) = TRIM($1)`,
      [pedPedido]
    );
    if (!check.rows.length) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }
    const situacao = check.rows[0].ped_situacao;
    if (!['C', 'A', 'CC'].includes(situacao)) {
      res.status(400).json({ success: false, message: 'Somente cotações podem ser convertidas em pedido.' });
      return;
    }

    const result = await db.query(
      `UPDATE pedidos SET ped_situacao = 'P', ped_data = CURRENT_DATE
       WHERE TRIM(ped_pedido) = TRIM($1)
       RETURNING ped_pedido, ped_situacao, ped_data`,
      [pedPedido]
    );

    res.json({ success: true, data: result.rows[0], message: 'Cotação convertida em pedido!' });
  } catch (error: any) {
    console.error('❌ [ORDERS] converter-pedido:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders/smart-suggestions ───────────────────────────────────────
// Produtos que o cliente comprou nessa indústria mas parou de comprar
export async function smartSuggestionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { clienteId, industriaId, tabelaId } = req.query as Record<string, string>;

    if (!clienteId || !industriaId) {
      res.status(400).json({ success: false, message: 'clienteId e industriaId são obrigatórios' });
      return;
    }

    const params: any[] = [parseInt(clienteId), parseInt(industriaId)];
    const tabelaFilter = tabelaId ? `AND TRIM(tp.itab_tabela) = TRIM($3)` : '';
    if (tabelaId) params.push(tabelaId);

    // Contagem de pedidos analisados (apenas P e F desta indústria)
    const metaResult = await db.query(`
      SELECT COUNT(DISTINCT ped_pedido) AS total_pedidos
      FROM pedidos
      WHERE ped_cliente   = $1
        AND ped_industria = $2
        AND ped_situacao  IN ('P','F')
    `, [parseInt(clienteId), parseInt(industriaId)]);

    const result = await db.query(`
      WITH compras AS (
        SELECT
          TRIM(i.ite_produto)                                               AS ite_produto,
          COUNT(DISTINCT TRIM(p.ped_pedido))                                AS frequencia,
          MAX(p.ped_data)                                                   AS ultima_compra,
          (CURRENT_DATE - MAX(p.ped_data))                                  AS dias_sem_compra,
          (ARRAY_AGG(i.ite_quant ORDER BY p.ped_data DESC, p.ped_pedido DESC))[1] AS ultima_quantidade,
          ROUND(AVG(i.ite_quant)::numeric, 2)                               AS media_quantidade
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_cliente   = $1
          AND p.ped_industria = $2
          AND p.ped_situacao  IN ('P','F')
        GROUP BY TRIM(i.ite_produto)
      ),
      historico AS (
        SELECT
          TRIM(i.ite_produto)                                               AS ite_produto,
          TO_CHAR(DATE_TRUNC('month', p.ped_data), 'YYYY-MM')              AS mes,
          SUM(i.ite_quant)::numeric                                         AS qty
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_cliente   = $1
          AND p.ped_industria = $2
          AND p.ped_situacao  IN ('P','F')
          AND p.ped_data >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY TRIM(i.ite_produto), DATE_TRUNC('month', p.ped_data)
      ),
      historico_json AS (
        SELECT
          ite_produto,
          JSON_AGG(JSON_BUILD_OBJECT('mes', mes, 'qty', qty) ORDER BY mes) AS historico_mensal
        FROM historico
        GROUP BY ite_produto
      )
      SELECT
        c.ite_produto,
        COALESCE(NULLIF(NULLIF(cp.pro_nome, 'None'), ''), cp.pro_codprod)    AS nome_produto,
        c.frequencia,
        c.ultima_compra,
        c.dias_sem_compra,
        c.ultima_quantidade,
        c.media_quantidade,
        cp.pro_id,
        cp.pro_embalagem,
        COALESCE(tp.itab_precobruto, 0)                                     AS preco_tabela,
        CASE
          WHEN c.dias_sem_compra >= 120 THEN 'critica'
          WHEN c.dias_sem_compra >= 60  THEN 'alta'
          ELSE 'atencao'
        END AS urgencia,
        COALESCE(hj.historico_mensal, '[]'::json)                           AS historico_mensal
      FROM compras c
      JOIN cad_prod cp
        ON TRIM(cp.pro_codprod) = c.ite_produto
       AND cp.pro_industria = $2
      LEFT JOIN cad_tabelaspre tp
        ON tp.itab_idprod      = cp.pro_id
       AND tp.itab_idindustria = $2
       ${tabelaFilter}
      LEFT JOIN historico_json hj ON hj.ite_produto = c.ite_produto
      WHERE c.dias_sem_compra >= 30
      ORDER BY
        CASE WHEN c.dias_sem_compra >= 120 THEN 0
             WHEN c.dias_sem_compra >= 60  THEN 1
             ELSE 2 END,
        c.ultima_compra ASC
      LIMIT 150
    `, params);

    const totalPedidos = parseInt(metaResult.rows[0]?.total_pedidos ?? '0');
    res.json({ success: true, data: result.rows, meta: { total_pedidos: totalPedidos } });
  } catch (error: any) {
    console.error('❌ [ORDERS] smart-suggestions:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/orders/expand-mix ───────────────────────────────────────────────
// Produtos da indústria que este cliente NUNCA comprou, ordenados por popularidade
export async function expandMixHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { clienteId, industriaId, tabelaId } = req.query as Record<string, string>;

    if (!clienteId || !industriaId) {
      res.status(400).json({ success: false, message: 'clienteId e industriaId são obrigatórios' });
      return;
    }

    const params: any[] = [parseInt(clienteId), parseInt(industriaId)];
    const tabelaFilter = tabelaId ? `AND TRIM(tp.itab_tabela) = TRIM($3)` : '';
    if (tabelaId) params.push(tabelaId);

    const result = await db.query(`
      WITH
      ja_comprou AS (
        SELECT DISTINCT TRIM(i.ite_produto) AS ite_produto
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_cliente   = $1
          AND p.ped_industria = $2
          AND p.ped_situacao  IN ('P','F')
      ),
      popularidade AS (
        SELECT
          TRIM(i.ite_produto)           AS ite_produto,
          COUNT(DISTINCT p.ped_cliente) AS total_clientes,
          COUNT(DISTINCT TRIM(p.ped_pedido)) AS total_pedidos
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_industria = $2
          AND p.ped_situacao  IN ('P','F')
        GROUP BY TRIM(i.ite_produto)
      )
      SELECT
        TRIM(cp.pro_codprod)                                          AS ite_produto,
        COALESCE(NULLIF(NULLIF(cp.pro_nome, 'None'), ''), TRIM(cp.pro_codprod)) AS nome_produto,
        cp.pro_embalagem,
        COALESCE(tp.itab_precobruto, 0) AS preco_tabela,
        COALESCE(pop.total_clientes, 0) AS total_clientes,
        COALESCE(pop.total_pedidos, 0)  AS total_pedidos
      FROM cad_tabelaspre tp
      JOIN cad_prod cp
        ON cp.pro_id = tp.itab_idprod
      LEFT JOIN popularidade pop
        ON pop.ite_produto = TRIM(cp.pro_codprod)
      WHERE tp.itab_idindustria = $2
        ${tabelaFilter}
        AND TRIM(cp.pro_codprod) NOT IN (SELECT ite_produto FROM ja_comprou)
      ORDER BY COALESCE(pop.total_clientes, 0) DESC, cp.pro_nome
      LIMIT 200
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [ORDERS] expand-mix:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/orders/iris-analisa ────────────────────────────────────────────
// Análise estratégica IA do cliente nesta indústria
export async function irisAnalisaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { clienteId, industriaId, clienteNome, industriaNome, tabelaId } = req.body;

    if (!clienteId || !industriaId) {
      res.status(400).json({ success: false, message: 'clienteId e industriaId são obrigatórios' });
      return;
    }

    const cId = parseInt(clienteId);
    const iId = parseInt(industriaId);

    // 1. Últimos 8 pedidos (P/F) desta indústria
    const pedidosR = await db.query(`
      SELECT
        ped_pedido, ped_data, ped_situacao,
        ped_totliq, ped_totbruto,
        (SELECT COUNT(*) FROM itens_ped WHERE TRIM(ite_pedido) = TRIM(ped_pedido)) AS qtd_itens
      FROM pedidos
      WHERE ped_cliente   = $1
        AND ped_industria = $2
        AND ped_situacao  IN ('P','F')
      ORDER BY ped_data DESC
      LIMIT 8
    `, [cId, iId]);

    // 2. Métricas financeiras: total 12m vs 12m anterior
    const financR = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN ped_data >= CURRENT_DATE - INTERVAL '12 months' THEN ped_totliq END), 0) AS total_12m,
        COALESCE(SUM(CASE WHEN ped_data >= CURRENT_DATE - INTERVAL '24 months'
                          AND  ped_data <  CURRENT_DATE - INTERVAL '12 months' THEN ped_totliq END), 0) AS total_12m_ant,
        COUNT(CASE WHEN ped_data >= CURRENT_DATE - INTERVAL '12 months' THEN 1 END) AS pedidos_12m,
        MAX(ped_data) AS ultimo_pedido,
        MIN(ped_data) AS primeiro_pedido
      FROM pedidos
      WHERE ped_cliente   = $1
        AND ped_industria = $2
        AND ped_situacao  IN ('P','F')
    `, [cId, iId]);

    // 3. Produtos parados (gap ≥ 30 dias)
    const gapR = await db.query(`
      WITH ultimas AS (
        SELECT
          TRIM(i.ite_produto) AS ite_produto,
          MAX(p.ped_data)     AS ultima_compra
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_cliente   = $1
          AND p.ped_industria = $2
          AND p.ped_situacao  IN ('P','F')
        GROUP BY TRIM(i.ite_produto)
        HAVING (CURRENT_DATE - MAX(p.ped_data)) >= 30
      )
      SELECT
        COUNT(*)                                                      AS total_gap,
        COUNT(CASE WHEN (CURRENT_DATE - ultima_compra) >= 120 THEN 1 END) AS criticos
      FROM ultimas
    `, [cId, iId]);

    // 4. Produtos nunca comprados (mix gap)
    const mixGapR = await db.query(`
      SELECT COUNT(*) AS total_nunca
      FROM cad_tabelaspre tp
      JOIN cad_prod cp ON cp.pro_id = tp.itab_idprod
      WHERE tp.itab_idindustria = $1
        AND TRIM(cp.pro_codprod) NOT IN (
          SELECT DISTINCT TRIM(i.ite_produto)
          FROM itens_ped i
          JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
          WHERE p.ped_cliente   = $2
            AND p.ped_industria = $1
            AND p.ped_situacao  IN ('P','F')
        )
    `, [iId, cId]);

    // 5. Categorias mais compradas (top 3 por valor)
    const catR = await db.query(`
      SELECT
        COALESCE(g.gru_nome, 'Sem categoria') AS categoria,
        SUM(i.ite_totliquido)                  AS total_valor,
        COUNT(DISTINCT TRIM(i.ite_produto))     AS qtd_produtos
      FROM itens_ped i
      JOIN pedidos p  ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      LEFT JOIN cad_prod cp
        ON TRIM(cp.pro_codprod) = TRIM(i.ite_produto) AND cp.pro_industria = $2
      LEFT JOIN grupos g ON g.gru_codigo = cp.pro_grupo
      WHERE p.ped_cliente   = $1
        AND p.ped_industria = $2
        AND p.ped_situacao  IN ('P','F')
        AND p.ped_data >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY COALESCE(g.gru_nome, 'Sem categoria')
      ORDER BY total_valor DESC
      LIMIT 3
    `, [cId, iId]);

    const fin = financR.rows[0];
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const totalGap   = parseInt(gapR.rows[0]?.total_gap ?? '0');
    const criticos   = parseInt(gapR.rows[0]?.criticos ?? '0');
    const totalNunca = parseInt(mixGapR.rows[0]?.total_nunca ?? '0');
    const total12m   = parseFloat(fin.total_12m ?? '0');
    const total12mAnt = parseFloat(fin.total_12m_ant ?? '0');
    const varPct     = total12mAnt > 0 ? ((total12m - total12mAnt) / total12mAnt * 100).toFixed(1) : null;
    const ultimoPed  = fin.ultimo_pedido ? new Date(fin.ultimo_pedido).toLocaleDateString('pt-BR') : 'sem registro';
    const diasUltimo = fin.ultimo_pedido
      ? Math.round((Date.now() - new Date(fin.ultimo_pedido).getTime()) / 86400000)
      : null;

    const ultimosPedidos = pedidosR.rows.map((p: any) =>
      `  - Pedido ${p.ped_pedido} em ${new Date(p.ped_data).toLocaleDateString('pt-BR')}: ${fmt(parseFloat(p.ped_totliq))} (${p.qtd_itens} itens)`
    ).join('\n');

    const categorias = catR.rows.map((c: any) =>
      `  - ${c.categoria}: ${fmt(parseFloat(c.total_valor))} (${c.qtd_produtos} produtos)`
    ).join('\n');

    const contexto = `
CLIENTE: ${clienteNome}
INDÚSTRIA: ${industriaNome}

HISTÓRICO (últimos 12 meses):
- Faturamento 12m: ${fmt(total12m)}${varPct ? ` (${Number(varPct) >= 0 ? '+' : ''}${varPct}% vs ano anterior)` : ''}
- Pedidos nos últimos 12m: ${fin.pedidos_12m}
- Último pedido: ${ultimoPed}${diasUltimo !== null ? ` (há ${diasUltimo} dias)` : ''}

ÚLTIMOS PEDIDOS:
${ultimosPedidos || '  Sem pedidos recentes'}

CATEGORIAS MAIS COMPRADAS (12m):
${categorias || '  Sem dados'}

ANÁLISE DE MIX:
- Produtos parados (sem recompra há 30+ dias): ${totalGap}${criticos > 0 ? ` (${criticos} CRÍTICOS, sem compra há 120+ dias)` : ''}
- Produtos nunca comprados desta indústria: ${totalNunca}
`;

    const nomeReduzido = clienteNome?.split(' ').slice(0, 2).join(' ') || clienteNome;

    const prompt = `Você é a IRIS, assistente de inteligência comercial do SalesMasters.
Analise os dados abaixo e gere um briefing estratégico para o representante comercial.

${contexto}

Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois. Estrutura exata:
{"raio_x":"2 frases sobre o perfil e momento deste cliente com esta indústria usando os dados reais","oportunidade_principal":"1 frase sobre a maior oportunidade agora","alertas":["alerta curto 1","alerta curto 2"],"argumentos":["argumento 1","argumento 2","argumento 3"],"frase_abertura":"frase natural para o representante ligar/visitar o cliente — use o nome EXATO '${nomeReduzido}' (NUNCA use placeholder como [Nome])"}

Use os números reais do contexto. Português do Brasil. Seja direto e específico.`;

    const raw = await callAI(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1400, temperature: 0.65, responseFormat: 'json_object' }
    );

    console.log('[IRIS-ANALISA] raw response:', raw?.slice(0, 300));

    let analise: any = null;

    // 1. Parse direto
    if (!analise) { try { analise = JSON.parse(raw); } catch {} }

    // 2. Remove markdown e tenta de novo
    if (!analise) {
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      try { analise = JSON.parse(cleaned); } catch {}

      // 3. Extrai JSON via regex (greedy do primeiro { ao último })
      if (!analise) {
        const start = cleaned.indexOf('{');
        const end   = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
          try { analise = JSON.parse(cleaned.slice(start, end + 1)); } catch {}
        }
      }
    }

    // 4. Constrói objeto mínimo se ainda falhou mas há texto útil
    if (!analise && raw?.length > 20) {
      analise = {
        raio_x: raw.slice(0, 400),
        oportunidade_principal: '',
        alertas: [],
        argumentos: [],
        frase_abertura: '',
      };
    }

    // 5. Re-parse defensivo: alguns modelos retornam o JSON completo dentro do campo raio_x
    if (analise?.raio_x && typeof analise.raio_x === 'string' && analise.raio_x.trim().startsWith('{')) {
      try {
        const inner = JSON.parse(analise.raio_x);
        if (inner?.raio_x && typeof inner.raio_x === 'string' && !inner.raio_x.trim().startsWith('{')) {
          analise = inner;
        }
      } catch {}
    }

    if (!analise) {
      res.status(500).json({ success: false, message: 'IA não retornou conteúdo. Verifique as chaves de API (OPENAI_KEY / GEMINI_API_KEY).' });
      return;
    }

    res.json({ success: true, analise, contexto_usado: { total12m, diasUltimo, totalGap, criticos, totalNunca } });
  } catch (error: any) {
    console.error('❌ [ORDERS] iris-analisa:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/orders/from-portal ────────────────────────────────────────────
// Cria pedido diretamente a partir de importação de portal (PATRAL, ARCA, etc.)
// sem passar pelo parse-batch. Faz lookup de pro_id internamente.
// IMPORTANTE: Usa transaction() para garantir atomicidade — se um item falhar,
// o cabeçalho é revertido e nenhum dado parcial fica no banco.
export async function createOrderFromPortalHandler(req: Request, res: Response): Promise<void> {
  const { cli_codigo, industria_id, tabela, items, user_initials } = req.body as {
    cli_codigo: number;
    industria_id: number;
    tabela: string;
    items: { codigo: string; descricao: string; quantidade: number; preco_unitario: number }[];
    user_initials: string;
  };
  const db = req.db!;
  const userId = req.user!.userId;

  if (!cli_codigo || !industria_id || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, message: 'Dados incompletos para criação do pedido.' });
    return;
  }

  try {
    // Lookup pro_id em lote (fora da transação — é somente leitura)
    const codes = [...new Set(items.map(i => i.codigo.trim().toUpperCase()))];
    const prodRes = await db.query(
      `SELECT pro_id, pro_codprod FROM cad_prod WHERE pro_industria = $1 AND UPPER(TRIM(pro_codprod)) = ANY($2)`,
      [industria_id, codes]
    );
    const prodMap = new Map<string, number>(
      prodRes.rows.map((p: any) => [p.pro_codprod.trim().toUpperCase(), p.pro_id])
    );

    // Gerar número de pedido (fora da transação — sequência não revertível)
    let seqResult: any;
    try   { seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
    catch { seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }
    const pedNumero = seqResult.rows[0].next_num;
    const initials  = (user_initials || 'IMP').toUpperCase().replace(/\s+/g, '');
    const pedPedido = initials + pedNumero.toString().padStart(6, '0');

    // Buscar vínculo cli_ind (fora da transação — somente leitura)
    let transportadora = 0, condPag = '', tipoFrete = 'C', pedCliInd = '', pedComprador = '';
    try {
      const vinculo = await db.query(
        `SELECT cli_transportadora, cli_prazopg, cli_frete, cli_codcliind, cli_comprador
         FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1`,
        [cli_codigo, industria_id]
      );
      if (vinculo.rows.length > 0) {
        const v = vinculo.rows[0];
        transportadora = v.cli_transportadora || 0;
        condPag        = v.cli_prazopg || '';
        tipoFrete      = v.cli_frete === 'FOB' ? 'F' : 'C';
        pedCliInd      = v.cli_codcliind || '';
        pedComprador   = v.cli_comprador || '';
      }
    } catch { /* vínculo não obrigatório */ }

    const totLiq = items.reduce((s, i) => s + (i.preco_unitario * i.quantidade), 0);

    // ─── TRANSAÇÃO ATÔMICA: Cabeçalho + Itens juntos ────────────────────────
    const pedidoCriado = await db.transaction(async (client) => {

      // 1. Inserir cabeçalho
      await client.query(`
        INSERT INTO pedidos (
          ped_data, ped_situacao, ped_numero, ped_pedido,
          ped_cliente, ped_industria, ped_vendedor, ped_transp,
          ped_tabela, ped_totbruto, ped_totliq,
          ped_condpag, ped_tipofrete, ped_cliind, ped_comprador, ped_obs
        ) VALUES (
          CURRENT_DATE, 'P', $1, $2,
          $3, $4, $5, $6,
          $7, $8, $8,
          $9, $10, $11, $12, $13
        )
      `, [
        pedNumero, pedPedido,
        cli_codigo, industria_id, userId, transportadora,
        tabela || '', totLiq,
        condPag, tipoFrete, pedCliInd, pedComprador,
        `Importado via Portal Industrial`,
      ]);

      // 2. Inserir itens (na mesma conexão/transação)
      let itensInseridos = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const proId = prodMap.get(item.codigo.trim().toUpperCase()) ?? 0;
        const totBrutoItem = item.preco_unitario * item.quantidade;

        await client.query(`
          INSERT INTO itens_ped (
            ite_pedido, ite_seq, ite_industria, ite_idproduto, ite_produto, ite_embuch, ite_nomeprod,
            ite_quant, ite_puni, ite_totbruto, ite_puniliq, ite_totliquido,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5,
            ite_des6, ite_des7, ite_des8, ite_des9, ite_des10, ite_promocao
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,
            0,0,0,0,0, 0,0,0,0,0,'N'
          )
        `, [
          pedPedido, i + 1, industria_id,
          proId, item.codigo, '', item.descricao || item.codigo,
          item.quantidade, item.preco_unitario,
          totBrutoItem, item.preco_unitario, totBrutoItem,
        ]);
        itensInseridos++;
      }

      console.log(`✅ [PORTAL] ${pedPedido} criado com ${itensInseridos} itens (cli=${cli_codigo}, ind=${industria_id})`);
      return pedPedido;
    });

    res.json({ success: true, ped_pedido: pedidoCriado });
  } catch (error: any) {
    console.error('❌ [ORDERS] from-portal:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/orders/iris-panel-narrative ────────────────────────────────────
export async function irisPanelNarrativeHandler(req: Request, res: Response): Promise<void> {
  try {
    const {
      tipo, clienteNome, industriaNome,
      // recomprar
      criticos, emRisco, topProdutoCodigo, topProdutoNome, diasSemCompra, frequenciaTotal,
      // mix
      totalDisponiveis, topProdutosNomes, penetracaoPct,
    } = req.body;

    const systemPrompt = `Você é IRIS, assistente comercial de um representante de vendas brasileiro.
Escreva briefings curtos, diretos e acionáveis em português.
Máximo 3 frases. Foco em: o que fazer, por quê agora, qual produto priorizar.
Nunca use bullet points. Nunca repita o nome do cliente no meio da frase.`;

    let userPrompt = '';

    if (tipo === 'recomprar') {
      const risco = Number(emRisco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
      userPrompt = `Cliente: ${clienteNome} | Indústria: ${industriaNome}
${criticos} produto(s) crítico(s) sem compra há 45+ dias. Valor potencial em risco: ${risco}.
Produto prioritário: ${topProdutoCodigo} — ${topProdutoNome}, parado há ${diasSemCompra} dias.
Total histórico: ${frequenciaTotal} pedidos feitos com esta indústria.
Escreva o briefing de visita em 2-3 frases curtas.`;
    } else {
      const nomes = Array.isArray(topProdutosNomes) ? topProdutosNomes.slice(0, 3).join(', ') : '';
      userPrompt = `Cliente: ${clienteNome} | Indústria: ${industriaNome}
${totalDisponiveis} produto(s) nunca comprado(s) disponíveis nesta tabela.
Produtos mais populares ausentes: ${nomes}.
${penetracaoPct}% dos clientes similares da carteira compram esses produtos.
Escreva a oportunidade de mix em 2-3 frases curtas.`;
    }

    const narrativa = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { maxTokens: 120, temperature: 0.7 }
    );

    res.json({ success: true, narrativa: narrativa.trim() });
  } catch (error: any) {
    console.error('❌ [ORDERS] iris-panel-narrative:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
