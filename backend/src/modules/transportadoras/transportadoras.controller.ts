import { Request, Response } from 'express';

// ─── GET /api/transportadoras ─────────────────────────────────────────────────
export async function listTransportadorasHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    const db = req.db!;
    const params: any[] = [];
    let query = `SELECT tra_codigo, tra_nome, tra_cidade, tra_uf, tra_fone, tra_email, tra_contato FROM transportadora WHERE 1=1`;
    if (search) { params.push(`%${search}%`); query += ` AND (tra_nome ILIKE $${params.length} OR tra_cidade ILIKE $${params.length})`; }
    query += ` ORDER BY tra_nome`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [TRANSPORTADORAS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/transportadoras/:id ────────────────────────────────────────────
export async function getTransportadoraHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM transportadora WHERE tra_codigo = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Transportadora não encontrada.' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [TRANSPORTADORAS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/transportadoras ────────────────────────────────────────────────
export async function createTransportadoraHandler(req: Request, res: Response): Promise<void> {
  try {
    const { tra_nome, tra_endereco, tra_bairro, tra_cidade, tra_uf, tra_cep, tra_fone, tra_cgc, tra_inscricao, tra_email, tra_contato, tra_obs } = req.body;
    const db = req.db!;
    if (!tra_nome?.trim()) { res.status(400).json({ success: false, message: 'Nome da transportadora é obrigatório.' }); return; }
    const result = await db.query(
      `INSERT INTO transportadora (tra_nome, tra_endereco, tra_bairro, tra_cidade, tra_uf, tra_cep, tra_fone, tra_cgc, tra_inscricao, tra_email, tra_contato, tra_obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING tra_codigo`,
      [tra_nome.trim(), tra_endereco||'', tra_bairro||'', tra_cidade||'', tra_uf||'', tra_cep||'', tra_fone||'', tra_cgc||'', tra_inscricao||'', tra_email||'', tra_contato||'', tra_obs||'']
    );
    res.json({ success: true, message: 'Transportadora criada com sucesso!', id: result.rows[0].tra_codigo });
  } catch (error: any) {
    console.error('❌ [TRANSPORTADORAS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/transportadoras/:id ────────────────────────────────────────────
export async function updateTransportadoraHandler(req: Request, res: Response): Promise<void> {
  try {
    const { tra_nome, tra_endereco, tra_bairro, tra_cidade, tra_uf, tra_cep, tra_fone, tra_cgc, tra_inscricao, tra_email, tra_contato, tra_obs } = req.body;
    const db = req.db!;
    if (!tra_nome?.trim()) { res.status(400).json({ success: false, message: 'Nome da transportadora é obrigatório.' }); return; }
    await db.query(
      `UPDATE transportadora SET tra_nome=$1, tra_endereco=$2, tra_bairro=$3, tra_cidade=$4, tra_uf=$5, tra_cep=$6, tra_fone=$7, tra_cgc=$8, tra_inscricao=$9, tra_email=$10, tra_contato=$11, tra_obs=$12
       WHERE tra_codigo=$13`,
      [tra_nome.trim(), tra_endereco||'', tra_bairro||'', tra_cidade||'', tra_uf||'', tra_cep||'', tra_fone||'', tra_cgc||'', tra_inscricao||'', tra_email||'', tra_contato||'', tra_obs||'', parseInt(String(req.params.id))]
    );
    res.json({ success: true, message: 'Transportadora atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [TRANSPORTADORAS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/transportadoras/:id ─────────────────────────────────────────
export async function deleteTransportadoraHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `DELETE FROM transportadora WHERE tra_codigo = $1 RETURNING tra_codigo`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Transportadora não encontrada.' }); return; }
    res.json({ success: true, message: 'Transportadora excluída com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') { res.status(400).json({ success: false, message: 'Transportadora em uso — não é possível excluir.' }); return; }
    console.error('❌ [TRANSPORTADORAS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
