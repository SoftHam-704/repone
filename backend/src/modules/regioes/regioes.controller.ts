import { Request, Response } from 'express';

// ─── GET /api/regioes ─────────────────────────────────────────────────────────
export async function listRegioesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    const db = req.db!;
    const params: any[] = [];
    let query = `SELECT reg_codigo, reg_descricao FROM regioes WHERE 1=1`;
    if (search) { params.push(`%${search}%`); query += ` AND reg_descricao ILIKE $${params.length}`; }
    query += ` ORDER BY reg_descricao`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [REGIOES] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/regioes/:id ─────────────────────────────────────────────────────
export async function getRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT reg_codigo, reg_descricao FROM regioes WHERE reg_codigo = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Região não encontrada.' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [REGIOES] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/regioes ────────────────────────────────────────────────────────
export async function createRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { reg_descricao } = req.body;
    const db = req.db!;
    if (!reg_descricao?.trim()) { res.status(400).json({ success: false, message: 'Nome da região é obrigatório.' }); return; }
    const result = await db.query(
      `INSERT INTO regioes (reg_descricao) VALUES ($1) RETURNING reg_codigo`,
      [reg_descricao.trim()]
    );
    res.json({ success: true, message: 'Região criada com sucesso!', id: result.rows[0].reg_codigo });
  } catch (error: any) {
    console.error('❌ [REGIOES] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/regioes/:id ─────────────────────────────────────────────────────
export async function updateRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { reg_descricao } = req.body;
    const db = req.db!;
    if (!reg_descricao?.trim()) { res.status(400).json({ success: false, message: 'Nome da região é obrigatório.' }); return; }
    await db.query(
      `UPDATE regioes SET reg_descricao = $1 WHERE reg_codigo = $2`,
      [reg_descricao.trim(), parseInt(String(req.params.id))]
    );
    res.json({ success: true, message: 'Região atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [REGIOES] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/regioes/:id ──────────────────────────────────────────────────
export async function deleteRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `DELETE FROM regioes WHERE reg_codigo = $1 RETURNING reg_codigo`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Região não encontrada.' }); return; }
    res.json({ success: true, message: 'Região excluída com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') { res.status(400).json({ success: false, message: 'Região em uso — não é possível excluir.' }); return; }
    console.error('❌ [REGIOES] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/regioes/:id/cidades ─────────────────────────────────────────────
export async function listCidadesRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT c.cid_codigo, c.cid_nome, c.cid_uf
       FROM cidades c
       INNER JOIN cidades_regioes cr ON cr.cid_id = c.cid_codigo
       WHERE cr.reg_id = $1
       ORDER BY c.cid_nome`,
      [parseInt(String(req.params.id))]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [REGIOES] list-cidades:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/regioes/:id/cidades ────────────────────────────────────────────
export async function addCidadeRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { cid_id } = req.body;
    const db = req.db!;
    if (!cid_id) { res.status(400).json({ success: false, message: 'cid_id é obrigatório.' }); return; }
    await db.query(
      `INSERT INTO cidades_regioes (reg_id, cid_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [parseInt(String(req.params.id)), cid_id]
    );
    res.json({ success: true, message: 'Cidade adicionada à região.' });
  } catch (error: any) {
    console.error('❌ [REGIOES] add-cidade:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/regioes/:id/cidades/:cidId ───────────────────────────────────
export async function removeCidadeRegiaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    await db.query(
      `DELETE FROM cidades_regioes WHERE reg_id = $1 AND cid_id = $2`,
      [parseInt(String(req.params.id)), parseInt(String(req.params.cidId))]
    );
    res.json({ success: true, message: 'Cidade removida da região.' });
  } catch (error: any) {
    console.error('❌ [REGIOES] remove-cidade:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/cidades?search=&limit= ─────────────────────────────────────────
export async function searchCidadesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search = '', limit = '20' } = req.query;
    const db = req.db!;
    const result = await db.query(
      `SELECT cid_codigo, cid_nome, cid_uf FROM cidades
       WHERE cid_nome ILIKE $1 AND cid_ativo = true
       ORDER BY cid_nome LIMIT $2`,
      [`%${search}%`, parseInt(limit as string)]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CIDADES] search:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
