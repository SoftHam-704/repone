import { Request, Response } from 'express';
import { syncEmailsDoTenant, getImapConfigPublic } from './email-imap.service';
import { TenantDB } from '../../config/database';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// ─── POST /api/email-central/sync ────────────────────────────────────────────
// Fire & forget pelo frontend — responde 200 imediatamente e processa em background
export async function syncHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json({ received: true });

  const db     = req.db!;
  const userId = req.user?.userId ?? 1;

  setImmediate(async () => {
    try {
      const result = await syncEmailsDoTenant(db, userId);
      if (result.novos > 0) {
        console.log(`[EMAIL-CENTRAL] Sync concluído: ${result.novos} novo(s) | user ${userId}`);
      }
    } catch (err: any) {
      console.error('[EMAIL-CENTRAL] Erro no sync:', err.message);
    }
  });
}

// ─── GET /api/email-central/resumo ───────────────────────────────────────────
// Leitura rápida do banco — alimenta o card do dashboard
export async function resumoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = req.user?.userId ?? 1;

    const [naoLidos, recentes, porTipo] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM email_lead WHERE estado = 'novo' AND tipo != 'outro' AND usuario_id = $1`, [userId]),
      db.query(
        `SELECT id, de, de_nome, assunto, tipo, recebido_em, estado, resumo_ia
         FROM email_lead
         WHERE tipo != 'outro' AND usuario_id = $1
         ORDER BY recebido_em DESC
         LIMIT 5`,
        [userId]
      ),
      db.query(
        `SELECT tipo, COUNT(*) as total
         FROM email_lead
         WHERE estado != 'arquivado' AND tipo != 'outro' AND usuario_id = $1
         GROUP BY tipo`,
        [userId]
      ),
    ]);

    const contsPorTipo: Record<string, number> = {};
    for (const row of porTipo.rows) contsPorTipo[row.tipo] = parseInt(row.total);

    res.json({
      success:    true,
      nao_lidos:  parseInt(naoLidos.rows[0].count),
      recentes:   recentes.rows,
      por_tipo:   contsPorTipo,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── GET /api/email-central/leads ────────────────────────────────────────────
export async function listLeadsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId = req.user?.userId ?? 1;
    const { estado, tipo, q } = req.query as Record<string, string>;
    const limit  = parseInt((req.query.limit  as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');

    const params: any[] = [userId];
    let where = 'WHERE el.usuario_id = $1';

    if (estado) { params.push(estado); where += ` AND el.estado = $${params.length}`; }
    if (tipo)   { params.push(tipo);   where += ` AND el.tipo   = $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (el.assunto ILIKE $${params.length} OR el.de ILIKE $${params.length} OR el.de_nome ILIKE $${params.length} OR el.resumo_ia ILIKE $${params.length})`;
    }

    params.push(limit); params.push(offset);

    const r = await db.query(
      `SELECT el.id, el.de, el.de_nome, el.assunto, el.tipo, el.estado,
              el.recebido_em, el.resumo_ia, el.dados_extraidos, el.cliente_id,
              c.cli_nome AS cliente_nome, c.cli_fantasia AS cliente_fantasia
       FROM email_lead el
       LEFT JOIN clientes c ON c.cli_codigo = el.cliente_id
       ${where}
       ORDER BY el.recebido_em DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await db.query(
      `SELECT COUNT(*) FROM email_lead el ${where}`,
      params.slice(0, -2)
    );

    res.json({ success: true, data: r.rows, total: parseInt(total.rows[0].count) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── GET /api/email-central/leads/:id ────────────────────────────────────────
export async function getLeadHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;

    const lead = await db.query(
      `SELECT el.*, c.cli_nome AS cliente_nome, c.cli_fantasia AS cliente_fantasia,
              c.cli_email AS cliente_email
       FROM email_lead el
       LEFT JOIN clientes c ON c.cli_codigo = el.cliente_id
       WHERE el.id = $1`, [id]
    );
    if (!lead.rows.length) {
      res.status(404).json({ success: false, message: 'Lead não encontrado' });
      return;
    }

    // Marcar como lido automaticamente ao abrir
    if (lead.rows[0].estado === 'novo') {
      await db.query(
        `UPDATE email_lead SET estado='lido', updated_at=NOW() WHERE id=$1`, [id]
      );
      lead.rows[0].estado = 'lido';
    }

    const respostas = await db.query(
      `SELECT * FROM email_resposta WHERE lead_id = $1 ORDER BY enviado_em ASC`, [id]
    );

    res.json({ success: true, data: { ...lead.rows[0], respostas: respostas.rows } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── PATCH /api/email-central/leads/:id/estado ───────────────────────────────
export async function atualizarEstadoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['novo', 'lido', 'respondido', 'arquivado', 'convertido'];
    if (!estadosValidos.includes(estado)) {
      res.status(400).json({ success: false, message: 'Estado inválido' });
      return;
    }

    await db.query(
      `UPDATE email_lead SET estado=$1, updated_at=NOW() WHERE id=$2`,
      [estado, id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── POST /api/email-central/leads/:id/responder ─────────────────────────────
import nodemailer from 'nodemailer';

export async function responderHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId ?? 1;
    const { id } = req.params;
    const { assunto, corpo } = req.body;

    // Buscar lead
    const lead = await db.query('SELECT * FROM email_lead WHERE id = $1', [id]);
    if (!lead.rows.length) {
      res.status(404).json({ success: false, message: 'Lead não encontrado' });
      return;
    }

    // Buscar config SMTP
    const params = await db.query(
      'SELECT * FROM parametros WHERE par_usuario = $1 LIMIT 1', [userId]
    );
    if (!params.rows.length) {
      res.status(404).json({ success: false, message: 'Config SMTP não encontrada' });
      return;
    }
    const cfg = params.rows[0];
    const port    = parseInt(String(cfg.par_emailporta)) || 587;
    const isSecure = port === 465 || cfg.par_emailssl === true;

    const transporter = nodemailer.createTransport({
      host:   (cfg.par_emailserver || '').trim(),
      port,
      secure: isSecure,
      auth:   { user: (cfg.par_emailuser || cfg.par_email || '').trim(), pass: (cfg.par_emailpassword || '').trim() },
      tls:    { rejectUnauthorized: false },
    } as any);

    await transporter.sendMail({
      from:    `<${cfg.par_email}>`,
      to:      lead.rows[0].de,
      subject: assunto || `Re: ${lead.rows[0].assunto}`,
      text:    corpo,
      html:    corpo.replace(/\n/g, '<br>'),
    });

    // Salvar resposta
    await db.query(
      `INSERT INTO email_resposta (lead_id, de, para, assunto, corpo, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, cfg.par_email, lead.rows[0].de, assunto, corpo, userId]
    );

    // Atualizar estado
    await db.query(
      `UPDATE email_lead SET estado='respondido', respondido_em=NOW(), updated_at=NOW() WHERE id=$1`, [id]
    );

    res.json({ success: true, message: 'Resposta enviada com sucesso.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── GET /api/email-central/config ───────────────────────────────────────────
export async function getConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId ?? 1;
    const r = await db.query(
      `SELECT par_email_central_ativo, par_imap_porta, par_imap_ssl,
              par_emailserver, par_email
       FROM parametros WHERE par_usuario = $1 LIMIT 1`,
      [userId]
    );
    res.json({ success: true, data: r.rows[0] || null });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── PATCH /api/email-central/config ─────────────────────────────────────────
export async function updateConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId ?? 1;
    const { par_email_central_ativo, par_imap_porta, par_imap_ssl } = req.body;

    await db.query(
      `UPDATE parametros
       SET par_email_central_ativo=$1, par_imap_porta=$2, par_imap_ssl=$3, updated_at=NOW()
       WHERE par_usuario=$4`,
      [par_email_central_ativo, par_imap_porta || 993, par_imap_ssl ?? true, userId]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}
// ─── GET /api/email-central/inbox-raw ────────────────────────────────────────
// Lê todos os emails diretamente do IMAP, sem filtro de relevância, sem salvar no banco
export async function inboxRawHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId ?? 1;
    const limit  = Math.min(parseInt((req.query.limit as string) || '50'), 100);

    const config = await getImapConfigPublic(db, userId);
    if (!config) {
      res.status(404).json({ success: false, message: 'Configuração IMAP não encontrada ou Central desativada' });
      return;
    }

    const client = new ImapFlow({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      auth:   { user: config.user, pass: config.password },
      logger: false,
      tls:    { rejectUnauthorized: false },
      connectionTimeout: 15000,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const emails: any[] = [];

    try {
      const status = await client.status('INBOX', { messages: true, unseen: true });
      const total  = status.messages ?? 0;

      // Pega os N mais recentes pelo número de sequência
      if (total > 0) {
        const from = Math.max(1, total - limit + 1);
        const range = `${from}:${total}`;

        for await (const msg of client.fetch(range, { envelope: true, flags: true, source: true })) {
          let parsed: any = {};
          try { parsed = await simpleParser(msg.source as Buffer); } catch { /* ignora */ }

          // Texto plano para preview: preferir text, senão strip do HTML
          const textoPlano = parsed.text?.trim() ||
            (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

          // Metadata dos anexos (sem o conteúdo — pesado demais para listar)
          const anexos = (parsed.attachments || []).map((a: any, idx: number) => ({
            index:       idx,
            filename:    a.filename || `anexo_${idx + 1}`,
            contentType: a.contentType || 'application/octet-stream',
            size:        a.size || (a.content?.length ?? 0),
          }));

          emails.push({
            uid:         msg.uid,
            seq:         msg.seq,
            de:          parsed.from?.value?.[0]?.address || msg.envelope?.from?.[0]?.address || '',
            de_nome:     parsed.from?.value?.[0]?.name    || msg.envelope?.from?.[0]?.name    || '',
            assunto:     parsed.subject || msg.envelope?.subject || '(sem assunto)',
            recebido_em: parsed.date   || msg.envelope?.date    || null,
            lido:        msg.flags?.has('\\Seen') ?? false,
            preview:     textoPlano.substring(0, 200),
            html:        parsed.html   || null,
            texto:       parsed.text   || null,
            anexos,
          });
        }
        emails.reverse(); // mais recentes primeiro
      }
    } finally {
      lock.release();
    }

    await client.logout();
    res.json({ success: true, data: emails, total: emails.length });
  } catch (e: any) {
    console.error('[INBOX-RAW] Erro:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── Helper: abre conexão IMAP e executa operação, depois fecha ──────────────
async function withImap(db: any, userId: number, fn: (client: ImapFlow) => Promise<void>): Promise<void> {
  const config = await getImapConfigPublic(db, userId);
  if (!config) throw new Error('Configuração IMAP não encontrada');

  const client = new ImapFlow({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth:   { user: config.user, pass: config.password },
    logger: false,
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    await fn(client);
  } finally {
    lock.release();
    await client.logout();
  }
}

// ─── GET /api/email-central/inbox-raw/:uid/attachment/:index ─────────────────
// Baixa um anexo específico diretamente do servidor IMAP
export async function downloadAttachmentHandler(req: Request, res: Response): Promise<void> {
  try {
    const db      = req.db!;
    const userId  = req.user?.userId ?? 1;
    const uid     = parseInt(req.params['uid'] as string);
    const idx     = parseInt(req.params['index'] as string);

    const config = await getImapConfigPublic(db, userId);
    if (!config) { res.status(404).json({ success: false, message: 'Config IMAP não encontrada' }); return; }

    const client = new ImapFlow({
      host: config.host, port: config.port, secure: config.secure,
      auth: { user: config.user, pass: config.password },
      logger: false, tls: { rejectUnauthorized: false }, connectionTimeout: 15000,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      let found = false;
      for await (const msg of client.fetch({ uid: uid as any }, { source: true }, { uid: true } as any)) {
        const parsed: any = await simpleParser(msg.source as Buffer);
        const attachment = parsed.attachments?.[idx];

        if (!attachment) { res.status(404).json({ success: false, message: 'Anexo não encontrado' }); return; }

        const filename = attachment.filename || `anexo_${idx + 1}`;
        const encoded  = encodeURIComponent(filename);
        const mimeType = (attachment.contentType || 'application/octet-stream').split(';')[0].trim();

        // Garante que temos um Buffer válido — alguns clientes IMAP retornam string base64
        let content: Buffer;
        if (Buffer.isBuffer(attachment.content)) {
          content = attachment.content;
        } else if (typeof attachment.content === 'string') {
          content = Buffer.from(attachment.content, 'base64');
        } else {
          res.status(404).json({ success: false, message: 'Conteúdo do anexo vazio' });
          return;
        }

        console.log(`[ATTACHMENT] ${filename} | tipo: ${mimeType} | tamanho: ${content.length} bytes | primeiros bytes: ${content.slice(0, 4).toString('hex')}`);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
        res.setHeader('Content-Length', content.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(content);
        found = true;
        break;
      }
      if (!found) res.status(404).json({ success: false, message: 'Email não encontrado' });
    } finally {
      lock.release();
      try { await client.logout(); } catch {}
    }
  } catch (e: any) {
    console.error('[ATTACHMENT] Erro:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── PATCH /api/email-central/inbox-raw/:uid/flags ───────────────────────────
// body: { seen: boolean }
export async function toggleFlagHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId ?? 1;
    const uid    = parseInt(req.params['uid'] as string);
    const { seen } = req.body;

    await withImap(db, userId, async (client) => {
      if (seen) {
        await client.messageFlagsAdd({ uid: uid as any }, ['\\Seen'], { uid: true } as any);
      } else {
        await client.messageFlagsRemove({ uid: uid as any }, ['\\Seen'], { uid: true } as any);
      }
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── DELETE /api/email-central/inbox-raw/:uid ────────────────────────────────
export async function deleteRawEmailHandler(req: Request, res: Response): Promise<void> {
  try {
    const db     = req.db!;
    const userId = req.user?.userId ?? 1;
    const uid    = parseInt(req.params['uid'] as string);

    await withImap(db, userId, async (client) => {
      await client.messageDelete({ uid: uid as any }, { uid: true } as any);
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// ─── POST /api/email-central/test-connection ─────────────────────────────────

export async function testImapConnectionHandler(req: Request, res: Response): Promise<void> {
  const { host, port, secure, user, password } = req.body;

  if (!host || !user || !password) {
    res.status(400).json({ success: false, message: 'Campos host, user e password são obrigatórios' });
    return;
  }

  const client = new ImapFlow({
    host,
    port:   port || 993,
    secure: secure ?? true,
    auth:   { user, pass: password },
    logger: false,
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });

  try {
    await client.connect();
    await client.logout();
    res.json({ success: true, message: 'Conexão IMAP estabelecida com sucesso!' });
  } catch (err: any) {
    console.error('[IMAP-TEST] Falha:', err.message);
    res.status(500).json({ success: false, message: `Falha na conexão IMAP: ${err.message}` });
  }
}
