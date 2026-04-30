import { Request, Response } from 'express';

// ─── GET /api/area-atuacao ────────────────────────────────────────────────────
export async function listAreaAtuacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    const db = req.db!;
    const params: any[] = [];
    let query = `SELECT atu_id, atu_descricao, atu_sel FROM area_atu WHERE 1=1`;
    if (search) { params.push(`%${search}%`); query += ` AND atu_descricao ILIKE $${params.length}`; }
    query += ` ORDER BY atu_descricao`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [AREA-ATUACAO] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/area-atuacao/:id ────────────────────────────────────────────────
export async function getAreaAtuacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT atu_id, atu_descricao, atu_sel FROM area_atu WHERE atu_id = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Área de atuação não encontrada.' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [AREA-ATUACAO] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/area-atuacao ───────────────────────────────────────────────────
export async function createAreaAtuacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { atu_descricao, atu_sel } = req.body;
    const db = req.db!;
    if (!atu_descricao?.trim()) { res.status(400).json({ success: false, message: 'Descrição é obrigatória.' }); return; }
    const result = await db.query(
      `INSERT INTO area_atu (atu_descricao, atu_sel) VALUES ($1, $2) RETURNING atu_id`,
      [atu_descricao.trim(), atu_sel || 'S']
    );
    res.json({ success: true, message: 'Área de atuação criada com sucesso!', id: result.rows[0].atu_id });
  } catch (error: any) {
    console.error('❌ [AREA-ATUACAO] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/area-atuacao/:id ────────────────────────────────────────────────
export async function updateAreaAtuacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { atu_descricao, atu_sel } = req.body;
    const db = req.db!;
    if (!atu_descricao?.trim()) { res.status(400).json({ success: false, message: 'Descrição é obrigatória.' }); return; }
    await db.query(
      `UPDATE area_atu SET atu_descricao = $1, atu_sel = $2 WHERE atu_id = $3`,
      [atu_descricao.trim(), atu_sel || 'S', parseInt(String(req.params.id))]
    );
    res.json({ success: true, message: 'Área de atuação atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [AREA-ATUACAO] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/area-atuacao/:id ─────────────────────────────────────────────
export async function deleteAreaAtuacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `DELETE FROM area_atu WHERE atu_id = $1 RETURNING atu_id`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Área de atuação não encontrada.' }); return; }
    res.json({ success: true, message: 'Área de atuação excluída com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') { res.status(400).json({ success: false, message: 'Área em uso — não é possível excluir.' }); return; }
    console.error('❌ [AREA-ATUACAO] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
