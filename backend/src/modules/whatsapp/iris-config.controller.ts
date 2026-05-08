import { Request, Response } from 'express';

// Auto-cria a tabela se não existir — sem migration manual
async function ensureTable(db: any): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS iris_config (
      id           SERIAL PRIMARY KEY,
      iris_carta   TEXT    NOT NULL DEFAULT '',
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by   INTEGER
    )
  `);
}

async function requireMaster(db: any, userId: number): Promise<boolean> {
  // superadmin (Hamilton) não tem registro em user_nomes no tenant — permite sempre
  if (userId === 0 || userId === -1) return true;
  const r = await db.query(
    `SELECT master FROM user_nomes WHERE codigo = $1`, [userId]
  );
  if (!r.rows.length) return true; // superadmin externo ao tenant
  const v = r.rows[0].master;
  return v === true || v === 'S' || v === 't' || v === 'T' || v === '1';
}

// ─── GET /api/whatsapp/iris-carta ─────────────────────────────────────────────
export async function getIrisCartaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId!;

    const isMaster = await requireMaster(db, userId);
    if (!isMaster) {
      res.status(403).json({ success: false, message: 'Acesso restrito ao administrador master.' });
      return;
    }

    await ensureTable(db);

    const r = await db.query(`SELECT iris_carta, updated_at FROM iris_config LIMIT 1`);
    const carta = r.rows[0]?.iris_carta ?? '';
    res.json({ success: true, data: { carta } });
  } catch (error: any) {
    console.error('❌ [IRIS-CONFIG] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/whatsapp/iris-carta ─────────────────────────────────────────────
export async function saveIrisCartaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId!;
    const { carta } = req.body as { carta: string };

    const isMaster = await requireMaster(db, userId);
    if (!isMaster) {
      res.status(403).json({ success: false, message: 'Acesso restrito ao administrador master.' });
      return;
    }

    await ensureTable(db);

    const existing = await db.query(`SELECT id FROM iris_config LIMIT 1`);
    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE iris_config SET iris_carta = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE id = $3`,
        [carta ?? '', userId, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO iris_config (iris_carta, updated_by) VALUES ($1, $2)`,
        [carta ?? '', userId]
      );
    }

    res.json({ success: true, message: 'Carta da IRIS salva com sucesso.' });
  } catch (error: any) {
    console.error('❌ [IRIS-CONFIG] save:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
