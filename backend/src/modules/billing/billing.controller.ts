import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

// ==================== HELPER: Sync situação do pedido ====================
async function syncOrderStatus(db: any, pedido: string) {
    const sumRes = await db.query(
        `SELECT COALESCE(SUM(fat_valorfat), 0) AS total_fat FROM fatura_ped WHERE TRIM(fat_pedido) = TRIM($1)`,
        [pedido]
    );
    const totalFat = parseFloat(sumRes.rows[0].total_fat) || 0;

    const pedRes = await db.query(
        `SELECT ped_totliq, ped_situacao FROM pedidos WHERE TRIM(ped_pedido) = TRIM($1)`,
        [pedido]
    );
    if (pedRes.rows.length === 0) return;

    const { ped_totliq, ped_situacao } = pedRes.rows[0];
    const totalPedido = parseFloat(ped_totliq) || 0;

    if (totalFat >= totalPedido && totalPedido > 0 && ped_situacao !== 'F') {
        await db.query(
            `UPDATE pedidos SET ped_situacao = 'F' WHERE TRIM(ped_pedido) = TRIM($1)`,
            [pedido]
        );
        console.log(`✅ [BILLING] Pedido ${pedido} marcado como FATURADO`);
    }
}

// ==================== HELPER: Sync itens_ped ====================
async function updateItemFaturado(db: any, pedido: string, produto: string, delta: number) {
    await db.query(`
        UPDATE itens_ped
        SET
            ite_qtdfat   = GREATEST(0, COALESCE(ite_qtdfat, 0) + $3),
            ite_faturado = CASE
                WHEN GREATEST(0, COALESCE(ite_qtdfat, 0) + $3) >= ite_quant THEN 'S'
                ELSE 'N'
            END
        WHERE TRIM(ite_pedido) = TRIM($1)
          AND TRIM(ite_produto) = TRIM($2)
    `, [pedido, produto, delta]);
}

// ==================== GET: Lançamentos de um pedido ====================
export async function getBillingHandler(req: Request, res: Response): Promise<void> {
    try {
        const pedido = String(req.params.pedido);
        const db = req.db!;

        const fatRes = await db.query(`
            SELECT
                f.fat_lancto,
                f.fat_pedido,
                f.fat_datafat,
                f.fat_valorfat,
                f.fat_nf,
                f.fat_obs,
                f.fat_percent,
                f.fat_comissao,
                f.fat_industria,
                f.fat_percomissind,
                f.gid,
                f.fat_items_json AS "_items"
            FROM fatura_ped f
            WHERE TRIM(f.fat_pedido) = TRIM($1)
            ORDER BY f.fat_lancto
        `, [pedido]);

        const pedRes = await db.query(
            `SELECT ped_totliq, ped_situacao FROM pedidos WHERE TRIM(ped_pedido) = TRIM($1)`,
            [pedido]
        );

        const ped_totliq = pedRes.rows[0]?.ped_totliq || 0;
        const totalFaturado = fatRes.rows.reduce((acc: number, r: any) => acc + (parseFloat(r.fat_valorfat) || 0), 0);
        const saldo = Math.max(0, ped_totliq - totalFaturado);
        const situacao = totalFaturado >= ped_totliq && ped_totliq > 0 ? 'F' : 'P';

        res.json({
            success: true,
            lancamentos: fatRes.rows,
            summary: {
                ped_totliq: parseFloat(ped_totliq),
                total_faturado: totalFaturado,
                saldo,
                situacao,
                situacao_label: situacao === 'F' ? 'Faturamento Concluído' : 'Faturamento Pendente'
            }
        });
    } catch (err: any) {
        console.error('❌ [BILLING] GET lançamentos:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// ==================== GET: Itens do pedido com qtd faturada ====================
export async function getBillingItemsHandler(req: Request, res: Response): Promise<void> {
    try {
        const pedido = String(req.params.pedido);
        const db = req.db!;

        const result = await db.query(`
            SELECT
                i.ite_produto,
                i.ite_nomeprod    AS ite_descricao,
                i.ite_quant       AS ite_qtde,
                COALESCE(i.ite_qtdfat, 0)    AS ite_qtdfat,
                COALESCE(i.ite_faturado, 'N') AS ite_faturado,
                GREATEST(0, i.ite_quant - COALESCE(i.ite_qtdfat, 0)) AS saldo_qtd,
                i.ite_puni        AS ite_valunit,
                i.ite_puniliq     AS ite_valliq,
                i.ite_totliquido  AS ite_totliq,
                i.ite_seq
            FROM itens_ped i
            WHERE TRIM(i.ite_pedido) = TRIM($1)
            ORDER BY i.ite_seq, i.ite_produto
        `, [pedido]);

        res.json({ success: true, items: result.rows });
    } catch (err: any) {
        console.error('❌ [BILLING] GET items:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// ==================== GET: Percentuais de comissão ====================
export async function getCommissionRatesHandler(req: Request, res: Response): Promise<void> {
    try {
        const pedido = String(req.params.pedido);
        const db = req.db!;

        const pedRes = await db.query(
            `SELECT ped_industria, ped_vendedor FROM pedidos WHERE TRIM(ped_pedido) = TRIM($1)`,
            [pedido]
        );
        if (pedRes.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Pedido não encontrado' });
            return;
        }

        const { ped_industria, ped_vendedor } = pedRes.rows[0];

        const forRes = await db.query(
            `SELECT for_percom FROM fornecedores WHERE for_codigo = $1`,
            [ped_industria]
        );

        const venRes = await db.query(
            `SELECT vin_percom FROM vendedor_ind WHERE vin_codigo = $1 AND vin_industria = $2`,
            [ped_vendedor, ped_industria]
        );

        res.json({
            success: true,
            rates: {
                escritorio: parseFloat(forRes.rows[0]?.for_percom) || 0,
                vendedor: parseFloat(venRes.rows[0]?.vin_percom) || 0,
                ped_industria,
                ped_vendedor
            }
        });
    } catch (err: any) {
        console.error('❌ [BILLING] GET commission-rates:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// ==================== POST: Criar lançamento ====================
export async function createBillingHandler(req: Request, res: Response): Promise<void> {
    try {
        const {
            fat_pedido,
            fat_industria,
            fat_datafat,
            fat_valorfat,
            fat_nf,
            fat_obs,
            fat_percent,
            fat_percomissind,
            items
        } = req.body;
        const db = req.db!;

        if (!fat_pedido || !fat_industria) {
            res.status(400).json({ success: false, message: 'Pedido e Indústria são obrigatórios' });
            return;
        }

        const valor = parseFloat(fat_valorfat) || 0;
        const percent = parseFloat(fat_percent) || 0;
        const fat_comissao = parseFloat((valor * percent / 100).toFixed(2));
        const gid = randomUUID();

        const result = await db.query(`
            INSERT INTO fatura_ped (
                fat_pedido, fat_industria, fat_datafat, fat_valorfat,
                fat_nf, fat_obs, fat_percent, fat_comissao,
                fat_percomissind, gid, fat_items_json
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            fat_pedido.trim(),
            fat_industria,
            fat_datafat || new Date(),
            valor,
            fat_nf || '',
            fat_obs || '',
            percent,
            fat_comissao,
            fat_percomissind || 'E',
            gid,
            JSON.stringify(items || [])
        ]);

        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.ite_produto && item.qtd_delta) {
                    await updateItemFaturado(db, fat_pedido, item.ite_produto, parseFloat(item.qtd_delta));
                }
            }
        }

        await syncOrderStatus(db, fat_pedido);

        console.log(`✅ [BILLING] Lançamento criado: Pedido ${fat_pedido} | NF ${fat_nf} | R$ ${valor}`);
        res.status(201).json({ success: true, data: result.rows[0], message: 'Faturamento lançado com sucesso!' });

    } catch (err: any) {
        console.error('❌ [BILLING] POST lançamento:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// ==================== PUT: Atualizar lançamento ====================
export async function updateBillingHandler(req: Request, res: Response): Promise<void> {
    try {
        const pedido = String(req.params.pedido);
        const lancto = String(req.params.lancto);
        const {
            fat_datafat,
            fat_valorfat,
            fat_nf,
            fat_obs,
            fat_percent,
            fat_percomissind,
            items_old,
            items_new
        } = req.body;
        const db = req.db!;

        const valor = parseFloat(fat_valorfat) || 0;
        const percent = parseFloat(fat_percent) || 0;
        const fat_comissao = parseFloat((valor * percent / 100).toFixed(2));

        const result = await db.query(`
            UPDATE fatura_ped SET
                fat_datafat      = $1,
                fat_valorfat     = $2,
                fat_nf           = $3,
                fat_obs          = $4,
                fat_percent      = $5,
                fat_comissao     = $6,
                fat_percomissind = $7,
                fat_items_json   = $8
            WHERE TRIM(fat_pedido) = TRIM($9)
              AND fat_lancto = $10
            RETURNING *
        `, [
            fat_datafat || new Date(),
            valor,
            fat_nf || '',
            fat_obs || '',
            percent,
            fat_comissao,
            fat_percomissind || 'E',
            JSON.stringify(items_new || []),
            pedido.trim(),
            parseInt(lancto)
        ]);

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Lançamento não encontrado' });
            return;
        }

        if (items_old && Array.isArray(items_old)) {
            for (const item of items_old) {
                if (item.ite_produto && item.qtd_delta) {
                    await updateItemFaturado(db, pedido, item.ite_produto, -parseFloat(item.qtd_delta));
                }
            }
        }
        if (items_new && Array.isArray(items_new)) {
            for (const item of items_new) {
                if (item.ite_produto && item.qtd_delta) {
                    await updateItemFaturado(db, pedido, item.ite_produto, parseFloat(item.qtd_delta));
                }
            }
        }

        await syncOrderStatus(db, pedido);

        res.json({ success: true, data: result.rows[0], message: 'Lançamento atualizado com sucesso!' });

    } catch (err: any) {
        console.error('❌ [BILLING] PUT lançamento:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// ==================== DELETE: Excluir lançamento ====================
export async function deleteBillingHandler(req: Request, res: Response): Promise<void> {
    try {
        const pedido = String(req.params.pedido);
        const lancto = String(req.params.lancto);
        const db = req.db!;

        let itemsToRevert = req.body?.items;
        if (!itemsToRevert || !Array.isArray(itemsToRevert) || itemsToRevert.length === 0) {
            const snapshotRes = await db.query(
                `SELECT fat_items_json FROM fatura_ped WHERE TRIM(fat_pedido) = TRIM($1) AND fat_lancto = $2`,
                [pedido.trim(), parseInt(lancto)]
            );
            itemsToRevert = snapshotRes.rows[0]?.fat_items_json || [];
        }

        if (itemsToRevert && Array.isArray(itemsToRevert)) {
            for (const item of itemsToRevert) {
                if (item.ite_produto && item.qtd_delta) {
                    await updateItemFaturado(db, pedido, item.ite_produto, -parseFloat(item.qtd_delta));
                }
            }
        }

        const result = await db.query(`
            DELETE FROM fatura_ped
            WHERE TRIM(fat_pedido) = TRIM($1)
              AND fat_lancto = $2
            RETURNING *
        `, [pedido.trim(), parseInt(lancto)]);

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Lançamento não encontrado' });
            return;
        }

        await syncOrderStatus(db, pedido);

        console.log(`🗑️ [BILLING] Lançamento ${lancto} do pedido ${pedido} excluído`);
        res.json({ success: true, message: 'Faturamento excluído com sucesso!' });

    } catch (err: any) {
        console.error('❌ [BILLING] DELETE lançamento:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

// ==================== PATCH: Atualizar Situação do pedido ====================
export async function patchBillingStatusHandler(req: Request, res: Response): Promise<void> {
    try {
        const pedido = String(req.params.pedido);
        const { situacao } = req.body;
        const db = req.db!;

        if (!['F', 'P'].includes(situacao)) {
            res.status(400).json({ success: false, message: 'Situação inválida' });
            return;
        }
        await db.query(
            `UPDATE pedidos SET ped_situacao = $1 WHERE TRIM(ped_pedido) = TRIM($2)`,
            [situacao, pedido]
        );
        console.log(`🔄 [BILLING] Situação de ${pedido} alterada manualmente para: ${situacao}`);
        res.json({ success: true, message: 'Situação atualizada!' });
    } catch (err: any) {
        console.error('❌ [BILLING] PATCH status:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}
