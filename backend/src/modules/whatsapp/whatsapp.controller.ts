import { Request, Response } from 'express';
import { masterPool } from '../../config/database';
import { Pool } from 'pg';
import { processMessage } from './whatsapp-orchestrator';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function extractContent(data: any): string {
  const msg = data?.message;
  if (!msg) return '[Mensagem vazia]';
  if (msg.conversation)                           return msg.conversation;
  if (msg.extendedTextMessage?.text)              return msg.extendedTextMessage.text;
  if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText;
  if (msg.listResponseMessage?.title)             return msg.listResponseMessage.title;
  if (msg.imageMessage?.caption)                  return `[Imagem] ${msg.imageMessage.caption}`;
  if (msg.imageMessage)                           return '[Imagem recebida]';
  if (msg.audioMessage)                           return '[Áudio recebido]';
  if (msg.videoMessage)                           return '[Vídeo recebido]';
  if (msg.documentMessage)                        return `[Documento: ${msg.documentMessage.fileName || 'arquivo'}]`;
  if (msg.locationMessage)                        return `[Localização: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}]`;
  if (msg.stickerMessage)                         return '[Sticker]';
  return '[Mensagem não suportada]';
}

// Resolve o pool do tenant pelo nome da instância (= CNPJ ou schema)
async function resolvePoolFromInstance(instanceName: string): Promise<Pool | null> {
  try {
    // Instância é o CNPJ sem formatação do tenant
    const cnpjDigits = instanceName.replace(/\D/g, '');

    const result = await masterPool.query(
      `SELECT id, db_host, db_nome, db_usuario, db_senha, db_porta
       FROM empresas
       WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1 AND status = 'ATIVO'
       LIMIT 1`,
      [cnpjDigits]
    );
    if (!result.rows.length) {
      console.warn(`[WPP-WEBHOOK] Tenant não encontrado para instância: ${instanceName}`);
      return null;
    }
    const e = result.rows[0];

    // Em dev, redireciona para host configurado
    const isDev = process.env.NODE_ENV !== 'production';
    let host = e.db_host;
    let port = e.db_porta || 5432;
    if (isDev) {
      host = process.env.MASTER_DB_HOST!;
      port = parseInt(process.env.MASTER_DB_PORT || '5432');
    }

    const { Pool: PgPool } = await import('pg');
    return new PgPool({ host, port, database: e.db_nome, user: e.db_usuario, password: e.db_senha || '' });
  } catch (err: any) {
    console.error('[WPP-WEBHOOK] Erro ao resolver tenant:', err.message);
    return null;
  }
}

// ─── WEBHOOK — POST /webhook/evolution ───────────────────────────────────────
// CRÍTICO: sem authMiddleware. A Evolution API chama diretamente este endpoint.
export async function webhookEvolutionHandler(req: Request, res: Response): Promise<void> {
  // Responder 200 imediatamente (Evolution API tem timeout curto)
  res.status(200).json({ received: true });

  try {
    const { event, instance, data } = req.body;

    // Filtrar apenas mensagens recebidas
    if (event !== 'messages.upsert') return;
    if (!data?.key) return;
    if (data.key.fromMe) return; // ignorar mensagens enviadas por nós

    const remoteJid = data.key.remoteJid || '';
    if (remoteJid.includes('@g.us'))        return; // ignorar grupos
    if (remoteJid === 'status@broadcast')   return;

    const phone       = normalizePhone(remoteJid.replace('@s.whatsapp.net', ''));
    const pushName    = data.pushName || null;
    const messageId   = data.key.id;
    const content     = extractContent(data);
    const messageType = data.messageType || 'conversation';

    console.log(`[WPP-WEBHOOK] Msg recebida | instância: ${instance} | ${phone.slice(-4)} | ${content.substring(0, 40)}`);

    // Resolver tenant pelo nome da instância
    const db = await resolvePoolFromInstance(instance);
    if (!db) return;

    // Processar assincronamente (não bloqueia a resposta 200)
    setImmediate(() => {
      processMessage(db, { phone, pushName, messageId, content, messageType, instance })
        .catch(err => console.error('[WPP-WEBHOOK] Erro no processMessage:', err.message));
    });

  } catch (err: any) {
    console.error('[WPP-WEBHOOK] Erro ao processar evento:', err.message);
  }
}

// ─── CONVERSAS — listagem, takeover, encerrar ─────────────────────────────────

export async function listConversasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { estado } = req.query as Record<string, string>;
    const limit  = parseInt((req.query.limit  as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (estado) {
      params.push(estado);
      where += ` AND c.estado = $${params.length}`;
    }

    params.push(limit); params.push(offset);

    const r = await db.query(`
      SELECT
        c.id, c.estado, c.origem, c.resumo_ia,
        c.dados_qualificacao, c.total_msgs_lead, c.total_msgs_ia,
        c.tokens_consumidos, c.primeira_msg_at, c.ultima_msg_at,
        c.qualificada_at, c.assumida_em,
        ct.telefone, ct.nome_push, ct.nome_informado, ct.empresa,
        ct.is_cliente, ct.cidade, ct.uf
      FROM wpp_conversa c
      JOIN wpp_contato ct ON ct.id = c.contato_id
      ${where}
      ORDER BY c.ultima_msg_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await db.query(`
      SELECT COUNT(*) FROM wpp_conversa c ${where}
    `, params.slice(0, -2));

    res.json({ success: true, data: r.rows, total: parseInt(total.rows[0].count) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getConversaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;

    const conv = await db.query(
      `SELECT c.*, ct.telefone, ct.nome_push, ct.nome_informado, ct.empresa, ct.is_cliente
       FROM wpp_conversa c JOIN wpp_contato ct ON ct.id = c.contato_id
       WHERE c.id = $1`, [id]
    );
    if (!conv.rows.length) { res.status(404).json({ success: false, message: 'Conversa não encontrada' }); return; }

    const msgs = await db.query(
      `SELECT id, remetente, conteudo, tipo, status, tokens_prompt, tokens_resposta,
              tempo_resposta_ms, created_at
       FROM wpp_mensagem WHERE conversa_id = $1 ORDER BY created_at ASC`, [id]
    );

    res.json({ success: true, data: { ...conv.rows[0], mensagens: msgs.rows } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function takeoverHandler(req: Request, res: Response): Promise<void> {
  try {
    const db      = req.db!;
    const { id }  = req.params;
    const userId  = req.user?.userId;

    await db.query(
      `UPDATE wpp_conversa SET estado='humano_ativo', usuario_id=$1, assumida_em=NOW(), updated_at=NOW() WHERE id=$2`,
      [userId, id]
    );
    res.json({ success: true, message: 'Conversa assumida com sucesso.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function devolverIAHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    await db.query(
      `UPDATE wpp_conversa SET estado='ia_ativa', usuario_id=NULL, assumida_em=NULL, updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Conversa devolvida para a IA.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function encerrarConversaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    await db.query(
      `UPDATE wpp_conversa SET estado='encerrada', encerrada_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── Dashboard de métricas ────────────────────────────────────────────────────
export async function wppDashboardHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const [totais, qualificados, humanos, tokens] = await Promise.all([
      db.query(`SELECT estado, COUNT(*) as total FROM wpp_conversa GROUP BY estado`),
      db.query(`SELECT COUNT(*) FROM wpp_conversa WHERE estado = 'ia_qualificou'`),
      db.query(`SELECT COUNT(*) FROM wpp_conversa WHERE estado = 'humano_ativo'`),
      db.query(`SELECT COALESCE(SUM(tokens_consumidos),0) as total FROM wpp_conversa`),
    ]);

    const porEstado: Record<string, number> = {};
    for (const row of totais.rows) porEstado[row.estado] = parseInt(row.total);

    res.json({
      success: true,
      data: {
        por_estado: porEstado,
        leads_qualificados: parseInt(qualificados.rows[0].count),
        aguardando_humano:  parseInt(humanos.rows[0].count),
        tokens_consumidos:  parseInt(tokens.rows[0].total),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── Resumo para Portal Home ─────────────────────────────────────────────────
export async function wppResumoPortalHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;

    const [aguardando, conversas] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total FROM wpp_conversa WHERE estado = 'aguardando_humano'`
      ),
      db.query(
        `SELECT
           c.id, c.estado, c.resumo_ia,
           COALESCE(c.ultima_msg_at, c.updated_at, c.created_at) AS ultima_msg_at,
           COALESCE(ct.nome_informado, ct.nome_push, ct.telefone) AS nome,
           ct.telefone
         FROM wpp_conversa c
         JOIN wpp_contato ct ON ct.id = c.contato_id
         WHERE c.estado IN ('aguardando_humano', 'humano_ativo', 'ia_ativa', 'nova')
         ORDER BY COALESCE(c.ultima_msg_at, c.updated_at, c.created_at) DESC NULLS LAST
         LIMIT 10`
      ),
    ]);

    res.json({
      success:    true,
      aguardando: aguardando.rows[0].total,
      conversas:  conversas.rows,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── Contatos ────────────────────────────────────────────────────────────────
export async function listContatosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { q } = req.query as Record<string, string>;
    const limit = parseInt((req.query.limit as string) || '50');
    const params: any[] = [];
    let where = 'WHERE aceita_msgs = TRUE';
    if (q) { params.push(`%${q}%`); where += ` AND (nome_push ILIKE $1 OR nome_informado ILIKE $1 OR empresa ILIKE $1 OR telefone ILIKE $1)`; }
    params.push(limit);
    const r = await db.query(
      `SELECT id, telefone, nome_push, nome_informado, empresa, cidade, uf, is_cliente, created_at
       FROM wpp_contato ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: r.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}
