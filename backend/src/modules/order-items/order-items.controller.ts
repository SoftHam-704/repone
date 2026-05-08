import { Request, Response } from 'express';

// ─── POST /api/order-items/batch-last-prices ──────────────────────────────────
export async function batchLastPricesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { pedido, clienteId, industriaId, productCodes } = req.body;
    const db = req.db!;

    if (!clienteId || !industriaId || !Array.isArray(productCodes) || productCodes.length === 0) {
      res.json({ success: true, data: {} }); return;
    }

    const result = await db.query(`
      SELECT DISTINCT ON (i.ite_produto)
        i.ite_produto,
        i.ite_puni
      FROM itens_ped i
      INNER JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      WHERE p.ped_cliente   = $1
        AND p.ped_industria = $2
        AND i.ite_produto   = ANY($3)
        AND p.ped_situacao  IN ('P', 'F')
        AND TRIM(p.ped_pedido) <> TRIM($4)
      ORDER BY i.ite_produto, p.ped_data DESC, p.ped_pedido DESC
    `, [clienteId, industriaId, productCodes, pedido || '']);

    const map: Record<string, number> = {};
    result.rows.forEach((r: any) => { map[r.ite_produto] = parseFloat(r.ite_puni); });

    res.json({ success: true, data: map });
  } catch (error: any) {
    console.error('❌ [ORDER-ITEMS] batch-last-prices:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/order-items/product-history/:produto/:cliente/:industria ────────
export async function productHistoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const produto   = String(req.params.produto);
    const cliente   = String(req.params.cliente);
    const industria = String(req.params.industria);
    const db = req.db!;

    const result = await db.query(`
      SELECT
        p.ped_pedido,
        p.ped_data,
        p.ped_situacao,
        i.ite_quant,
        i.ite_puni,
        i.ite_puniliq,
        i.ite_totliquido,
        i.ite_des1, i.ite_des2, i.ite_des3, i.ite_des4, i.ite_des5,
        i.ite_des6, i.ite_des7, i.ite_des8, i.ite_des9,
        i.ite_ipi,
        i.ite_st,
        i.ite_valcomst
      FROM itens_ped i
      INNER JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
      WHERE TRIM(i.ite_produto) = TRIM($1)
        AND p.ped_cliente   = $2
        AND p.ped_industria = $3
        AND p.ped_situacao IN ('P', 'F')
      ORDER BY p.ped_data DESC, p.ped_pedido DESC
      LIMIT 10
    `, [produto, parseInt(cliente), parseInt(industria)]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [ORDER-ITEMS] product-history:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/order-items/:pedido ─────────────────────────────────────────────
export async function listOrderItemsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { pedido } = req.params;
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq ASC, ite_lancto ASC`,
      [pedido]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [ORDER-ITEMS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/order-items/:pedido/sync ───────────────────────────────────────
export async function syncOrderItemsHandler(req: Request, res: Response): Promise<void> {
  const { pedido } = req.params;
  const items: any[] = req.body.items || [];
  const db = req.db!;

  try {
    await db.transaction(async (client) => {
      await client.query(`DELETE FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1)`, [pedido]);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const produto = (it.ite_produto || '').toUpperCase();
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
            $4,$5,$6,
            $7,$8,$9,
            $10,$11,
            $12,$13,
            $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
            $25,$26,
            'N',$27
          )
        `, [
          pedido,
          i + 1,
          it.ite_industria  || 0,
          produto,
          it.ite_embuch     || '',
          it.ite_nomeprod   || '',
          it.ite_quant      || 0,
          it.ite_puni       || 0,
          it.ite_totbruto   || 0,
          it.ite_puniliq    || 0,
          it.ite_totliquido || 0,
          it.ite_ipi        || 0,
          it.ite_st         || 0,
          it.ite_des1  || 0, it.ite_des2  || 0, it.ite_des3  || 0,
          it.ite_des4  || 0, it.ite_des5  || 0, it.ite_des6  || 0,
          it.ite_des7  || 0, it.ite_des8  || 0, it.ite_des9  || 0,
          it.ite_des10 || 0, it.ite_des11 || 0,
          it.ite_valcomipi || 0,
          it.ite_valcomst  || 0,
          it.ite_promocao  || 'N',
        ]);
      }

      await client.query(`
        UPDATE pedidos SET
          ped_totbruto = (SELECT COALESCE(SUM(ite_totbruto),   0) FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1)),
          ped_totliq   = (SELECT COALESCE(SUM(ite_totliquido), 0) FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1)),
          ped_totalipi = (SELECT COALESCE(SUM(ite_valcomipi),  0) FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1))
        WHERE TRIM(ped_pedido) = TRIM($1)
      `, [pedido]);
    });

    res.json({ success: true, message: `${items.length} iten(s) sincronizado(s).`, count: items.length });
  } catch (error: any) {
    console.error('❌ [ORDER-ITEMS] sync:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
