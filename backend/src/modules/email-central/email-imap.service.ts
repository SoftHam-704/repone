import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { classificarEmail } from './email-ai.service';
import { filtrarEmailRelevancia } from './email-filter.service';
import { TenantDB } from '../../config/database';

// ─── Config IMAP do tenant ────────────────────────────────────────────────────
interface ImapConfig {
  host:     string;
  port:     number;
  secure:   boolean;
  user:     string;
  password: string;
}

export async function getImapConfigPublic(db: TenantDB, userId: number): Promise<ImapConfig | null> {
  return getImapConfig(db, userId);
}

async function getImapConfig(db: TenantDB, userId: number): Promise<ImapConfig | null> {
  const r = await db.query(
    `SELECT par_emailserver, par_email, par_emailuser, par_emailpassword,
            par_imap_server, par_imap_porta, par_imap_ssl, par_email_central_ativo
     FROM parametros WHERE par_usuario = $1 LIMIT 1`,
    [userId]
  );
  if (!r.rows.length) return null;
  const p = r.rows[0];
  if (!p.par_email_central_ativo) return null;
  
  // Se não tiver imap server específico, tenta usar o smtp server
  const host = (p.par_imap_server || p.par_emailserver || '').trim();
  if (!host || !p.par_emailpassword) return null;

  return {
    host,
    port:     p.par_imap_porta || 993,
    secure:   p.par_imap_ssl !== false,
    user:     (p.par_emailuser || p.par_email || '').trim(),
    password: (p.par_emailpassword || '').trim(),
  };
}

// ─── Cross-reference: remetente é cliente cadastrado? ────────────────────────
async function resolverCliente(db: TenantDB, emailRemetente: string): Promise<number | null> {
  if (!emailRemetente) return null;
  try {
    const r = await db.query(
      `SELECT cli_codigo FROM clientes
       WHERE LOWER(cli_email) = LOWER($1) LIMIT 1`,
      [emailRemetente.trim()]
    );
    return r.rows.length ? r.rows[0].cli_codigo : null;
  } catch {
    return null;
  }
}

// ─── Sync principal ───────────────────────────────────────────────────────────
export async function syncEmailsDoTenant(db: TenantDB, userId: number): Promise<{
  processados: number;
  novos: number;
  erro?: string;
}> {
  const config = await getImapConfig(db, userId);
  if (!config) return { processados: 0, novos: 0 };

  const client = new ImapFlow({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth:   { user: config.user, pass: config.password },
    logger: false,
    tls:    { rejectUnauthorized: false },
  });

  let processados = 0;
  let novos = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Busca TODOS os emails dos últimos 30 dias (não apenas não-lidos)
      // A deduplicação por message_id garante que não reprocessamos os já capturados
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const uids = await client.search({ since }, { uid: true });
      // Pega os mais recentes primeiro, limita a 25 por ciclo para não sobrecarregar a IA
      const limitados = (uids as number[]).slice(-25);

      for await (const msg of client.fetch(limitados, {
        envelope: true,
        source:   true,
      }, { uid: true })) {

        const messageId = msg.envelope?.messageId;
        if (!messageId) continue;

        // Deduplicação
        const dup = await db.query(
          'SELECT id FROM email_lead WHERE message_id = $1', [messageId]
        );
        if (dup.rows.length > 0) { processados++; continue; }

        // Parse do email
        let parsed: any;
        try {
          parsed = await simpleParser(msg.source as Buffer);
        } catch {
          continue;
        }

        const de     = parsed.from?.value?.[0]?.address || '';
        const deNome = parsed.from?.value?.[0]?.name    || '';
        const para   = parsed.to?.value?.[0]?.address   || '';
        const assunto = (parsed.subject || '').substring(0, 500);
        const corpo  = (parsed.text || '').substring(0, 1000).trim();
        const recebidoEm = parsed.date || new Date();

        // Filtro de regras — sem custo, antes de chamar IA
        const filtro = filtrarEmailRelevancia(de, assunto, corpo);
        if (!filtro.passou) {
          processados++;
          continue;
        }

        // Classificação IRIS (relevância + extração)
        const classificacao = await classificarEmail({ assunto, corpo, de, deNome });

        // Ignora irrelevantes silenciosamente
        if (!classificacao.relevante) {
          processados++;
          continue;
        }

        // Cross-reference com clientes
        const clienteId = await resolverCliente(db, de);

        // Salva no banco
        await db.query(
          `INSERT INTO email_lead
             (message_id, de, de_nome, para, assunto, corpo_preview,
              recebido_em, tipo, resumo_ia, dados_extraidos,
              cliente_id, tokens_consumidos, usuario_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
           ON CONFLICT (message_id) DO NOTHING`,
          [
            messageId, de, deNome, para, assunto, corpo,
            recebidoEm,
            classificacao.tipo,
            classificacao.resumo,
            JSON.stringify(classificacao.dadosExtraidos),
            clienteId,
            classificacao.tokensConsumidos,
            userId,
          ]
        );

        processados++;
        novos++;
        console.log(`[EMAIL-CENTRAL] Novo lead capturado: ${assunto.substring(0, 50)} | tipo: ${classificacao.tipo}`);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err: any) {
    console.error('[EMAIL-CENTRAL] Erro IMAP:', err.message);
    try { await client.logout(); } catch {}
    return { processados, novos, erro: err.message };
  }

  return { processados, novos };
}
