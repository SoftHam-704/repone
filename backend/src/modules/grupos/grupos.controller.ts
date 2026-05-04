import { Request, Response } from 'express';

// ─── GET /api/grupos ──────────────────────────────────────────────────────────
export async function listGruposHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    const db = req.db!;

    let query = `SELECT gru_codigo, gru_nome, gru_percomiss, gru_usa_percomiss FROM grupos WHERE 1=1`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND gru_nome ILIKE $${params.length}`;
    }

    query += ` ORDER BY gru_nome`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [GRUPOS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/grupos/:id ──────────────────────────────────────────────────────
export async function getGrupoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));

    const result = await db.query(
      `SELECT gru_codigo, gru_nome, gru_percomiss, gru_usa_percomiss FROM grupos WHERE gru_codigo = $1`,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Grupo não encontrado.' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [GRUPOS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/grupos ─────────────────────────────────────────────────────────
export async function createGrupoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { gru_nome, gru_percomiss, gru_usa_percomiss } = req.body;
    const db = req.db!;

    if (!gru_nome?.trim()) {
      res.status(400).json({ success: false, message: 'Nome do grupo é obrigatório.' });
      return;
    }

    const result = await db.query(
      `INSERT INTO grupos (gru_nome, gru_percomiss, gru_usa_percomiss) VALUES ($1, $2, $3) RETURNING gru_codigo`,
      [gru_nome.trim(), gru_percomiss || 0, gru_usa_percomiss === true]
    );

    res.json({ success: true, message: 'Grupo criado com sucesso!', id: result.rows[0].gru_codigo });
  } catch (error: any) {
    console.error('❌ [GRUPOS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/grupos/:id ──────────────────────────────────────────────────────
export async function updateGrupoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const { gru_nome, gru_percomiss, gru_usa_percomiss } = req.body;

    if (!gru_nome?.trim()) {
      res.status(400).json({ success: false, message: 'Nome do grupo é obrigatório.' });
      return;
    }

    await db.query(
      `UPDATE grupos SET gru_nome = $1, gru_percomiss = $2, gru_usa_percomiss = $3 WHERE gru_codigo = $4`,
      [gru_nome.trim(), gru_percomiss || 0, gru_usa_percomiss === true, id]
    );

    res.json({ success: true, message: 'Grupo atualizado com sucesso!' });
  } catch (error: any) {
    console.error('❌ [GRUPOS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/grupos/:id ───────────────────────────────────────────────────
export async function deleteGrupoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));

    const result = await db.query(
      `DELETE FROM grupos WHERE gru_codigo = $1 RETURNING gru_codigo`,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Grupo não encontrado.' });
      return;
    }

    res.json({ success: true, message: 'Grupo excluído com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ success: false, message: 'Grupo em uso — não é possível excluir.' });
      return;
    }
    console.error('❌ [GRUPOS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
