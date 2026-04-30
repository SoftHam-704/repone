import { Request, Response } from 'express';

// ─── GET /api/grupo-desc ──────────────────────────────────────────────────────
export async function listGrupoDescHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    const db = req.db!;

    let query = `
      SELECT gde_id, gid, gde_nome,
             gde_desc1, gde_desc2, gde_desc3, gde_desc4, gde_desc5,
             gde_desc6, gde_desc7, gde_desc8, gde_desc9
      FROM grupo_desc
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (gid ILIKE $${params.length} OR gde_nome ILIKE $${params.length})`;
    }

    query += ` ORDER BY gde_id`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [GRUPO-DESC] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/grupo-desc/:id ──────────────────────────────────────────────────
export async function getGrupoDescHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));

    const result = await db.query(
      `SELECT gde_id, gid, gde_nome,
              gde_desc1, gde_desc2, gde_desc3, gde_desc4, gde_desc5,
              gde_desc6, gde_desc7, gde_desc8, gde_desc9
       FROM grupo_desc WHERE gde_id = $1`,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Grupo de desconto não encontrado.' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [GRUPO-DESC] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/grupo-desc ─────────────────────────────────────────────────────
export async function createGrupoDescHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const {
      gid,
      gde_nome,
      gde_desc1 = 0, gde_desc2 = 0, gde_desc3 = 0,
      gde_desc4 = 0, gde_desc5 = 0, gde_desc6 = 0,
      gde_desc7 = 0, gde_desc8 = 0, gde_desc9 = 0,
    } = req.body;

    if (!gid?.trim()) {
      res.status(400).json({ success: false, message: 'Identificador é obrigatório.' });
      return;
    }

    // Verificar duplicidade
    const dup = await db.query(`SELECT gde_id FROM grupo_desc WHERE gid = $1`, [gid.trim()]);
    if (dup.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Já existe um grupo com este identificador.' });
      return;
    }

    const result = await db.query(
      `INSERT INTO grupo_desc (gid, gde_nome, gde_desc1, gde_desc2, gde_desc3, gde_desc4, gde_desc5, gde_desc6, gde_desc7, gde_desc8, gde_desc9)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING gde_id`,
      [
        gid.trim(),
        gde_nome?.trim() || '',
        gde_desc1, gde_desc2, gde_desc3,
        gde_desc4, gde_desc5, gde_desc6,
        gde_desc7, gde_desc8, gde_desc9,
      ]
    );

    res.json({ success: true, message: 'Grupo de desconto criado com sucesso!', id: result.rows[0].gde_id });
  } catch (error: any) {
    console.error('❌ [GRUPO-DESC] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/grupo-desc/:id ──────────────────────────────────────────────────
export async function updateGrupoDescHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const {
      gid,
      gde_nome,
      gde_desc1 = 0, gde_desc2 = 0, gde_desc3 = 0,
      gde_desc4 = 0, gde_desc5 = 0, gde_desc6 = 0,
      gde_desc7 = 0, gde_desc8 = 0, gde_desc9 = 0,
    } = req.body;

    if (!gid?.trim()) {
      res.status(400).json({ success: false, message: 'Identificador é obrigatório.' });
      return;
    }

    // Verificar duplicidade do gid em outros registros
    const dup = await db.query(
      `SELECT gde_id FROM grupo_desc WHERE gid = $1 AND gde_id != $2`,
      [gid.trim(), id]
    );
    if (dup.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Já existe outro grupo com este identificador.' });
      return;
    }

    await db.query(
      `UPDATE grupo_desc SET
         gid=$1, gde_nome=$2,
         gde_desc1=$3, gde_desc2=$4, gde_desc3=$5,
         gde_desc4=$6, gde_desc5=$7, gde_desc6=$8,
         gde_desc7=$9, gde_desc8=$10, gde_desc9=$11
       WHERE gde_id=$12`,
      [
        gid.trim(),
        gde_nome?.trim() || '',
        gde_desc1, gde_desc2, gde_desc3,
        gde_desc4, gde_desc5, gde_desc6,
        gde_desc7, gde_desc8, gde_desc9,
        id,
      ]
    );

    res.json({ success: true, message: 'Grupo de desconto atualizado com sucesso!' });
  } catch (error: any) {
    console.error('❌ [GRUPO-DESC] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/grupo-desc/:id ───────────────────────────────────────────────
export async function deleteGrupoDescHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));

    const result = await db.query(
      `DELETE FROM grupo_desc WHERE gde_id = $1 RETURNING gde_id`,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Grupo de desconto não encontrado.' });
      return;
    }

    res.json({ success: true, message: 'Grupo de desconto excluído com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ success: false, message: 'Grupo em uso — não é possível excluir.' });
      return;
    }
    console.error('❌ [GRUPO-DESC] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
