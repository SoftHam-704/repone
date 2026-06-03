import { Request, Response } from 'express';
import { getLinkedSellerId } from '../../shared/permissions';

// Converte valor monetário pt-BR para number. Aceita "1.234,56", "1234,56",
// "1234.56" e "1234". Se houver vírgula, ela é o separador decimal e os pontos
// são milhares.
function parseValorBR(raw: any): number {
  let s = String(raw ?? '').trim().replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

// NOTA: comprovante (foto) ficou para uma 2ª etapa — a estratégia de armazenamento
// (disco vs banco) será decidida com o dono. A coluna desp_comprovante existe na
// tabela (nullable, sem uso por ora) para a foto voltar sem mudança de schema.

// ─── GET /api/despesas ───────────────────────────────────────────────────────
export async function listDespesasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { vendedor, categoria, de, ate } = req.query;
    const params: any[] = [];
    let q = `
      SELECT d.desp_id, d.desp_vendedor, d.desp_data, d.desp_categoria, d.desp_valor,
             d.desp_descricao, d.desp_km, d.desp_criado_em,
             v.ven_nome AS vendedor_nome
      FROM despesas d
      LEFT JOIN vendedores v ON v.ven_codigo = d.desp_vendedor
      WHERE 1=1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); q += ` AND d.desp_vendedor = $${params.length}`; }
    else if (vendedor)    { params.push(vendedor); q += ` AND d.desp_vendedor = $${params.length}`; }
    if (categoria) { params.push(categoria); q += ` AND d.desp_categoria = $${params.length}`; }
    if (de)        { params.push(de);        q += ` AND d.desp_data >= $${params.length}`; }
    if (ate)       { params.push(ate);       q += ` AND d.desp_data <= $${params.length}`; }
    q += ` ORDER BY d.desp_data DESC, d.desp_id DESC`;
    const result = await db.query(q, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [DESPESAS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/despesas (JSON) ───────────────────────────────────────────────
export async function createDespesaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { desp_data, desp_categoria, desp_valor, desp_descricao, desp_km, desp_vendedor } = req.body;
    if (!desp_data || !desp_categoria || !desp_valor) {
      res.status(400).json({ success: false, message: 'Data, categoria e valor são obrigatórios.' });
      return;
    }
    const valorNum = parseValorBR(desp_valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      res.status(400).json({ success: false, message: 'Valor inválido.' });
      return;
    }
    // Despesa é de QUEM GASTOU: resolve o vendedor DIRETO pelo vínculo usuário→vendedor
    // (ven_codusu), SEM excluir gerência/master — diferente do getLinkedSellerId, que é
    // helper de escopo e zera p/ gestor. Fallbacks: getLinkedSellerId e desp_vendedor do body.
    let venId: number | null = null;
    try {
      const vr = await db.query(
        'SELECT ven_codigo FROM vendedores WHERE ven_codusu = $1 LIMIT 1',
        [req.user?.userId]
      );
      venId = vr.rows[0]?.ven_codigo ?? null;
    } catch { venId = null; }
    if (venId === null) {
      const sellerId = await getLinkedSellerId(db, req.user?.userId);
      venId = sellerId ?? (desp_vendedor ? parseInt(String(desp_vendedor)) : null);
    }
    if (venId === null) {
      res.status(400).json({ success: false, message: 'Vendedor não identificado para a despesa.' });
      return;
    }
    const result = await db.query(
      `INSERT INTO despesas
         (desp_vendedor, desp_data, desp_categoria, desp_valor, desp_descricao, desp_km)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING desp_id`,
      [venId, desp_data, desp_categoria, valorNum,
       desp_descricao || null, desp_km ? parseInt(String(desp_km)) : null]
    );
    res.json({ success: true, message: 'Despesa lançada.', id: result.rows[0].desp_id });
  } catch (error: any) {
    console.error('❌ [DESPESAS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/despesas/:id ────────────────────────────────────────────────
export async function deleteDespesaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    const params: any[] = [id];
    let q = `DELETE FROM despesas WHERE desp_id = $1`;
    if (sellerId !== null) { params.push(sellerId); q += ` AND desp_vendedor = $${params.length}`; }
    q += ` RETURNING desp_id`;
    const result = await db.query(q, params);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Despesa não encontrada.' }); return; }
    res.json({ success: true, message: 'Despesa removida.' });
  } catch (error: any) {
    console.error('❌ [DESPESAS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/despesas/relatorio ─────────────────────────────────────────────
export async function relatorioDespesasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { vendedor, de, ate } = req.query;
    const params: any[] = [];
    let where = ` WHERE 1=1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); where += ` AND desp_vendedor = $${params.length}`; }
    else if (vendedor)    { params.push(vendedor); where += ` AND desp_vendedor = $${params.length}`; }
    if (de)  { params.push(de);  where += ` AND desp_data >= $${params.length}`; }
    if (ate) { params.push(ate); where += ` AND desp_data <= $${params.length}`; }
    const porCat = await db.query(
      `SELECT desp_categoria, COUNT(*) AS qtd, COALESCE(SUM(desp_valor),0) AS total
       FROM despesas ${where} GROUP BY desp_categoria ORDER BY total DESC`, params);
    const totalRow = await db.query(
      `SELECT COALESCE(SUM(desp_valor),0) AS total, COUNT(*) AS qtd FROM despesas ${where}`, params);
    res.json({ success: true, data: { por_categoria: porCat.rows, total: totalRow.rows[0] } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
