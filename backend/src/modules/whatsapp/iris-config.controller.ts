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
    if (error.message?.includes('permission denied')) {
      res.json({ success: true, data: { carta: '' } });
      return;
    }
    console.error('❌ [IRIS-CONFIG] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/whatsapp/iris-carta/enhance ────────────────────────────────────
const ENHANCE_SYSTEM = `Você é especialista em redação de instruções estratégicas para sistemas de IA usados por equipes de vendas e representantes comerciais.

Sua tarefa é aprimorar as instruções que o administrador escreveu para o assistente de IA IRIS.

Regras:
- Preserve TODAS as informações e intenções originais — não invente dados, não remova nenhum ponto
- Organize em seções claras com bullets (•) onde aplicável
- Use linguagem direta, objetiva, sem ambiguidades — facilite a interpretação da IA
- Mantenha o tom profissional e confidencial
- Elimine repetições, melhore clareza e estrutura
- Mantenha em português brasileiro
- Retorne APENAS as instruções aprimoradas, sem introduções ou comentários adicionais
- Não invente exemplos ou informações ausentes no original`;

export async function enhanceIrisCartaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId!;
    const { carta } = req.body as { carta: string };

    const isMaster = await requireMaster(db, userId);
    if (!isMaster) {
      res.status(403).json({ success: false, message: 'Acesso restrito ao administrador master.' });
      return;
    }

    if (!carta?.trim()) {
      res.status(400).json({ success: false, message: 'Nenhum texto para aprimorar.' });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY não configurada no servidor.' });
      return;
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: ENHANCE_SYSTEM,
      messages: [{ role: 'user', content: `Aprimore as seguintes instruções:\n\n${carta}` }],
    });

    const enhanced = (message.content[0] as any)?.text?.trim() || carta;
    res.json({ success: true, data: { carta: enhanced } });
  } catch (error: any) {
    console.error('❌ [IRIS-CONFIG] enhance:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao aprimorar instruções.' });
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
