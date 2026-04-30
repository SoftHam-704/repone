import { PoolClient } from 'pg';

/**
 * Rotina Compartilhada de Consolidação de Pedidos (V2)
 * Localizada no shared para ser reutilizada por todos os tenants.
 */
export async function consolidateOrders(
  db: PoolClient,
  masterOrderId: string,
  sourceOrderIds: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Validar pedido mestre
    const masterRes = await db.query(
      'SELECT * FROM pedidos WHERE ped_pedido = $1',
      [masterOrderId]
    );
    if (masterRes.rows.length === 0) {
      return { success: false, message: 'Pedido mestre não encontrado.' };
    }
    const master = masterRes.rows[0];

    // 2. Garantir que todos os pedidos de origem pertencem ao mesmo cliente
    // Regra de negócio: consolidação é sempre dentro do mesmo cliente — clientes
    // diferentes = processos independentes.
    for (const sourceId of sourceOrderIds) {
      if (sourceId === masterOrderId) continue;
      const sourceClientRes = await db.query(
        'SELECT ped_cliente, ped_industria FROM pedidos WHERE ped_pedido = $1',
        [sourceId]
      );
      if (!sourceClientRes.rows.length) {
        return { success: false, message: `Pedido ${sourceId} não encontrado.` };
      }
      const src = sourceClientRes.rows[0];
      if (src.ped_cliente !== master.ped_cliente) {
        return {
          success: false,
          message: `Pedido ${sourceId} pertence a um cliente diferente do pedido mestre. Clientes distintos não podem ser consolidados no mesmo processo.`,
        };
      }
      if (src.ped_industria !== master.ped_industria) {
        return {
          success: false,
          message: `Pedido ${sourceId} pertence a uma indústria diferente do pedido mestre.`,
        };
      }
    }

    // 3. Trazer itens dos pedidos de origem
    for (const sourceId of sourceOrderIds) {
      if (sourceId === masterOrderId) continue;

      // Buscar itens do pedido de origem
      const itemsRes = await db.query(
        'SELECT * FROM itens_ped WHERE ite_pedido = $1',
        [sourceId]
      );

      // Mover itens para o pedido mestre ou incrementar se já existir?
      // Padrão SalesMasters: Mantém itens separados mas vinculados ao pedido mestre
      for (const item of itemsRes.rows) {
        // Obter próximo sequencial do mestre
        const nextSeqRes = await db.query(
          'SELECT COALESCE(MAX(ite_seq), 0) + 1 as next_seq FROM itens_ped WHERE ite_pedido = $1',
          [masterOrderId]
        );
        const nextSeq = nextSeqRes.rows[0].next_seq;

        await db.query(`
          INSERT INTO itens_ped (
            ite_pedido, ite_seq, ite_industria, ite_idproduto, ite_produto, ite_embuch, ite_nomeprod,
            ite_quant, ite_puni, ite_totbruto, ite_puniliq, ite_totliquido, ite_ipi, ite_st,
            ite_des1, ite_des2, ite_des3, ite_des4, ite_des5
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `, [
          masterOrderId, nextSeq, item.ite_industria, item.ite_idproduto, item.ite_produto, item.ite_embuch, item.ite_nomeprod,
          item.ite_quant, item.ite_puni, item.ite_totbruto, item.ite_puniliq, item.ite_totliquido, item.ite_ipi, item.ite_st,
          item.ite_des1, item.ite_des2, item.ite_des3, item.ite_des4, item.ite_des5,
        ]);
      }

      // 3. Marcar pedido de origem como consolidado e registrar OC no mestre
      // Buscar OC do pedido de origem para preservá-la (Regra de Ouro #1)
      const sourceOcRes = await db.query(
        'SELECT ped_oc FROM pedidos WHERE ped_pedido = $1',
        [sourceId]
      );
      const sourceOc = sourceOcRes.rows[0]?.ped_oc;
      const ocLabel = sourceOc ? ` (OC: ${sourceOc})` : '';

      await db.query(`
        UPDATE pedidos
        SET ped_situacao = 'C',
            ped_consolidado_id = $1,
            ped_obs = COALESCE(ped_obs, '') || '\nConsolidado no pedido ' || $2 || $3
        WHERE ped_pedido = $4
      `, [master.ped_numero, masterOrderId, ocLabel, sourceId]);

      // Registrar no mestre quais OCs foram incorporadas
      if (sourceOc) {
        await db.query(`
          UPDATE pedidos
          SET ped_obs = COALESCE(ped_obs, '') || '\nIncorporou OC ' || $1 || ' do pedido ' || $2
          WHERE ped_pedido = $3
        `, [sourceOc, sourceId, masterOrderId]);
      }
    }

    // 4. Recalcular totais do mestre
    await db.query(`
      UPDATE pedidos p
      SET 
        ped_totbruto = (SELECT ROUND(SUM(ite_totbruto), 2) FROM itens_ped WHERE ite_pedido = p.ped_pedido),
        ped_totliq = (SELECT ROUND(SUM(ite_totliquido), 2) FROM itens_ped WHERE ite_pedido = p.ped_pedido),
        ped_totalipi = (SELECT ROUND(SUM(ite_totliquido * (COALESCE(ite_ipi, 0)/100)), 2) FROM itens_ped WHERE ite_pedido = p.ped_pedido)
      WHERE ped_pedido = $1
    `, [masterOrderId]);

    return { success: true, message: 'Pedidos consolidados com sucesso!' };
  } catch (err: any) {
    console.error('❌ [ROUTINE] Consolidation Error:', err.message);
    return { success: false, message: err.message };
  }
}
