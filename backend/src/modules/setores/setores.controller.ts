import { Request, Response } from 'express';

// ─── GET /api/setores ─────────────────────────────────────────────────────────
export async function listSetoresHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search, cidade } = req.query;
    const db = req.db!;
    const params: any[] = [];
    let query = `
      SELECT s.set_codigo, s.set_nome, s.set_obs, s.set_ordem, s.set_cor, s.set_ativo,
             s.set_cidade_id, c.cid_nome, c.cid_uf
      FROM setores s
      LEFT JOIN cidades c ON c.cid_codigo = s.set_cidade_id
      WHERE 1=1`;
    if (search) { params.push(`%${search}%`); query += ` AND s.set_nome ILIKE $${params.length}`; }
    if (cidade) { params.push(cidade); query += ` AND s.set_cidade_id = $${params.length}`; }
    query += ` ORDER BY c.cid_nome NULLS LAST, s.set_ordem, s.set_nome`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SETORES] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/setores/:id ─────────────────────────────────────────────────────
export async function getSetorHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT s.set_codigo, s.set_nome, s.set_obs, s.set_ordem, s.set_cor, s.set_ativo,
              s.set_cidade_id, c.cid_nome, c.cid_uf
       FROM setores s
       LEFT JOIN cidades c ON c.cid_codigo = s.set_cidade_id
       WHERE s.set_codigo = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Setor não encontrado.' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [SETORES] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/setores ────────────────────────────────────────────────────────
export async function createSetorHandler(req: Request, res: Response): Promise<void> {
  try {
    const { set_nome, set_obs, set_cidade_id, set_ordem, set_cor, set_ativo } = req.body;
    const db = req.db!;
    if (!set_nome?.trim()) { res.status(400).json({ success: false, message: 'Nome do setor é obrigatório.' }); return; }
    const result = await db.query(
      `INSERT INTO setores (set_nome, set_obs, set_cidade_id, set_ordem, set_cor, set_ativo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING set_codigo`,
      [set_nome.trim(), set_obs?.trim() || null, set_cidade_id || null,
       set_ordem ?? 0, set_cor || '#FFD200', set_ativo ?? true]
    );
    res.json({ success: true, message: 'Setor criado com sucesso!', id: result.rows[0].set_codigo });
  } catch (error: any) {
    console.error('❌ [SETORES] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/setores/:id ─────────────────────────────────────────────────────
export async function updateSetorHandler(req: Request, res: Response): Promise<void> {
  try {
    const { set_nome, set_obs, set_cidade_id, set_ordem, set_cor, set_ativo } = req.body;
    const db = req.db!;
    if (!set_nome?.trim()) { res.status(400).json({ success: false, message: 'Nome do setor é obrigatório.' }); return; }
    await db.query(
      `UPDATE setores SET set_nome=$1, set_obs=$2, set_cidade_id=$3, set_ordem=$4, set_cor=$5, set_ativo=$6
       WHERE set_codigo=$7`,
      [set_nome.trim(), set_obs?.trim() || null, set_cidade_id || null,
       set_ordem ?? 0, set_cor || '#FFD200', set_ativo ?? true, parseInt(String(req.params.id))]
    );
    res.json({ success: true, message: 'Setor atualizado com sucesso!' });
  } catch (error: any) {
    console.error('❌ [SETORES] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/setores/:id ──────────────────────────────────────────────────
export async function deleteSetorHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `DELETE FROM setores WHERE set_codigo = $1 RETURNING set_codigo`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Setor não encontrado.' }); return; }
    res.json({ success: true, message: 'Setor excluído com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') { res.status(400).json({ success: false, message: 'Setor em uso — não é possível excluir.' }); return; }
    console.error('❌ [SETORES] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
