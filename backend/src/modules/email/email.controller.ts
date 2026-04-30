import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

// ─── Cria transporter igual ao V1 ────────────────────────────────────────────
function createTransporter(config: {
  par_emailserver: string;
  par_emailporta: number;
  par_email: string;
  par_emailuser?: string;
  par_emailpassword: string;
  par_emailtls?: boolean;
  par_emailssl?: boolean;
}) {
  const port    = parseInt(String(config.par_emailporta)) || 587;
  const isSecure = port === 465 || config.par_emailssl === true;
  const smtpUser = (config.par_emailuser || config.par_email || '').trim();
  const smtpPass = (config.par_emailpassword || '').trim();
  const smtpHost = (config.par_emailserver || '').trim();

  return nodemailer.createTransport({
    host: smtpHost,
    port,
    secure: isSecure,
    auth: { user: smtpUser, pass: smtpPass },
    requireTLS: config.par_emailtls === true,
    tls: { rejectUnauthorized: false, minVersion: 'TLSv1' as any },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout:   30000,
  } as any);
}

// ─── POST /api/email/send-order ──────────────────────────────────────────────
export async function sendOrderEmailHandler(req: Request, res: Response): Promise<void> {
  console.log('📧 [EMAIL] Request to send order email received');
  try {
    const { recipients, cc, subject, text, attachments, userId } = req.body;
    const db = req.db!;

    if (!recipients || (recipients.length === 0 && (!cc || cc.length === 0))) {
      res.status(400).json({ success: false, message: 'Nenhum destinatário informado' });
      return;
    }

    // 1. Busca config SMTP do usuário
    const paramsResult = await db.query('SELECT * FROM parametros WHERE par_usuario = $1', [userId || 1]);
    if (!paramsResult.rows.length) {
      res.status(404).json({ success: false, message: 'Configurações de e-mail não encontradas para este usuário' });
      return;
    }
    const config = paramsResult.rows[0];

    // 2. Busca nome da empresa para branding
    let companyName = 'SalesMasters';
    try {
      const companyResult = await db.query("SELECT emp_nome FROM empresa_status WHERE emp_id = 1");
      if (companyResult.rows.length && companyResult.rows[0].emp_nome) companyName = companyResult.rows[0].emp_nome.trim();
    } catch { /* empresa opcional */ }

    const senderName = config.par_sisuser || companyName;

    // 3. Cria transporter e verifica SMTP
    const transporter = createTransporter(config);
    try {
      await transporter.verify();
      console.log('✅ [EMAIL] SMTP connection verified');
    } catch (verifyError: any) {
      res.status(500).json({ success: false, message: `Falha na conexão SMTP: ${verifyError.message}` });
      return;
    }

    // 4. Monta e envia e-mail
    const ccValue = Array.isArray(cc) ? cc.filter(Boolean).join(', ') : (cc || '');
    const mailOptions: any = {
      from: `"${senderName}" <${config.par_email}>`,
      to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
      ...(ccValue ? { cc: ccValue } : {}),
      subject,
      text,
      attachments: (attachments || []).map((att: any) => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType || 'application/octet-stream',
      })),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [EMAIL] Email sent:', info.messageId);
    res.json({ success: true, message: 'E-mail enviado com sucesso', messageId: info.messageId });

  } catch (error: any) {
    console.error('❌ [EMAIL] send-order error:', error.message);
    res.status(500).json({ success: false, message: `Erro ao enviar e-mail: ${error.message}` });
  }
}

// ─── GET /api/email/filter-options/atuacao ───────────────────────────────────
export async function filterOptionsAtuacaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT atu_id AS atu_codigo, atu_descricao AS atu_nome FROM area_atu ORDER BY atu_descricao`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [EMAIL] filter-options/atuacao:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/email/filter-options/industrias ─────────────────────────────────
export async function filterOptionsIndustriasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT for_codigo AS ind_codigo, COALESCE(NULLIF(for_nomered,''), for_nome) AS ind_nome
       FROM fornecedores ORDER BY ind_nome`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [EMAIL] filter-options/industrias:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/email/filter-clients ───────────────────────────────────────────
export async function filterClientsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { filterType, search, atuacao_ids, dt_start, dt_end, industria_id } = req.query as Record<string, string>;

    let rows: any[] = [];

    if (filterType === 'contatos') {
      const params: any[] = [];
      let q = `SELECT cli_codigo, cli_nome, cli_fantasia, cli_email, cli_cidade, cli_uf
               FROM clientes WHERE cli_tipopes = 'A' AND cli_email IS NOT NULL AND cli_email <> ''`;
      if (search) { params.push(`%${search}%`); q += ` AND (cli_nome ILIKE $1 OR cli_fantasia ILIKE $1 OR cli_email ILIKE $1 OR cli_cidade ILIKE $1)`; }
      q += ' ORDER BY cli_nome LIMIT 500';
      rows = (await db.query(q, params)).rows;

    } else if (filterType === 'atuacao') {
      const ids = atuacao_ids ? atuacao_ids.split(',').map(Number) : [];
      if (ids.length === 0) { res.json({ success: true, data: [] }); return; }
      rows = (await db.query(
        `SELECT DISTINCT c.cli_codigo, c.cli_nome, c.cli_fantasia, c.cli_email, c.cli_cidade, c.cli_uf
         FROM clientes c JOIN atua_cli ac ON c.cli_codigo = ac.atu_idcli
         WHERE c.cli_tipopes = 'A' AND c.cli_email IS NOT NULL AND c.cli_email <> ''
           AND ac.atu_atuaid = ANY($1) ORDER BY c.cli_nome`, [ids]
      )).rows;

    } else if (filterType === 'aniversariantes') {
      if (!dt_start || !dt_end) { res.json({ success: true, data: [] }); return; }
      const startM = parseInt(dt_start.substring(5, 7));
      const startD = parseInt(dt_start.substring(8, 10));
      const endM   = parseInt(dt_end.substring(5, 7));
      const endD   = parseInt(dt_end.substring(8, 10));

      let q = `SELECT DISTINCT a.ani_nome AS cli_nome, a.ani_email AS cli_email,
                a.ani_cliente AS cli_codigo, c.cli_fantasia, c.cli_cidade, c.cli_uf
               FROM cli_aniv a JOIN clientes c ON a.ani_cliente = c.cli_codigo
               WHERE a.ani_email IS NOT NULL AND a.ani_email <> ''`;

      if (startM === endM) {
        rows = (await db.query(q + ` AND a.ani_mes = $1 AND a.ani_diaaniv BETWEEN $2 AND $3`, [startM, startD, endD])).rows;
      } else {
        rows = (await db.query(q + ` AND (
          (a.ani_mes = $1 AND a.ani_diaaniv >= $2) OR
          (a.ani_mes = $3 AND a.ani_diaaniv <= $4) OR
          (a.ani_mes > $1 AND a.ani_mes < $3))`, [startM, startD, endM, endD])).rows;
      }

    } else if (filterType === 'industria') {
      if (!industria_id) { res.json({ success: true, data: [] }); return; }
      const params: any[] = [industria_id];
      let q = `SELECT DISTINCT c.cli_codigo, c.cli_nome, c.cli_fantasia, c.cli_email, c.cli_cidade, c.cli_uf
               FROM clientes c JOIN pedidos p ON c.cli_codigo = p.ped_cliente
               WHERE p.ped_industria = $1 AND p.ped_situacao IN ('P','F')
                 AND c.cli_email IS NOT NULL AND c.cli_email <> ''`;
      if (search) { params.push(`%${search}%`); q += ` AND (c.cli_nome ILIKE $2 OR c.cli_email ILIKE $2 OR c.cli_cidade ILIKE $2)`; }
      q += ' ORDER BY c.cli_nome';
      rows = (await db.query(q, params)).rows;

    } else if (filterType === 'prospeccao') {
      if (!industria_id) { res.json({ success: true, data: [] }); return; }
      const params: any[] = [industria_id];
      let q = `SELECT DISTINCT c.cli_codigo, c.cli_nome, c.cli_fantasia, c.cli_email, c.cli_cidade, c.cli_uf
               FROM clientes c JOIN indclientes ic ON c.cli_codigo = ic.cli_id
               WHERE ic.cli_indid = $1 AND c.cli_email IS NOT NULL AND c.cli_email <> ''`;
      if (search) { params.push(`%${search}%`); q += ` AND (c.cli_nome ILIKE $2 OR c.cli_email ILIKE $2 OR c.cli_cidade ILIKE $2)`; }
      q += ' ORDER BY c.cli_nome';
      rows = (await db.query(q, params)).rows;

    } else {
      res.status(400).json({ success: false, message: 'filterType inválido.' });
      return;
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('❌ [EMAIL] filter-clients:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/email/send-bulk ────────────────────────────────────────────────
export async function sendBulkHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { recipients, bccRecipients, subject, message, attachments, isMass } = req.body;
    const userId = req.user?.userId;

    const paramsResult = await db.query('SELECT * FROM parametros WHERE par_usuario = $1', [userId || 1]);
    if (!paramsResult.rows.length) {
      res.status(404).json({ success: false, message: 'Config SMTP não encontrada para este usuário.' });
      return;
    }
    const config = paramsResult.rows[0];

    let companyName = 'SalesMasters';
    try {
      const r = await db.query("SELECT emp_nome FROM empresa_status WHERE emp_id = 1");
      if (r.rows.length && r.rows[0].emp_nome) companyName = r.rows[0].emp_nome.trim();
    } catch { /* opcional */ }

    const senderName = config.par_sisuser || companyName;
    const transporter = createTransporter(config);

    const mailOptions: any = {
      from: `"${senderName}" <${config.par_email}>`,
      to: (recipients || []).join(', '),
      bcc: (bccRecipients || []).join(', '),
      subject,
      text: message,
      html: (message as string).replace(/\n/g, '<br>'),
      attachments: (attachments || []).map((att: any) => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType || 'application/octet-stream',
      })),
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `${(recipients || []).length + (bccRecipients || []).length} e-mail(s) processados.` });
  } catch (error: any) {
    console.error('❌ [EMAIL] send-bulk:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/email/test-connection ─────────────────────────────────────────
export async function testConnectionHandler(req: Request, res: Response): Promise<void> {
  try {
    const config = req.body;

    if (!config?.par_emailserver || !config?.par_email) {
      res.status(400).json({ success: false, message: 'Servidor e e-mail são obrigatórios para o teste.' });
      return;
    }

    console.log(`📡 [EMAIL] Testando conexão → ${config.par_emailserver}:${config.par_emailporta || 587}`);

    const transporter = createTransporter(config);

    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout na conexão SMTP (15s)')), 15000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);

    console.log('✅ [EMAIL] Teste SMTP bem-sucedido');
    res.json({ success: true, message: 'Conexão SMTP estabelecida com sucesso! Credenciais aceitas.' });

  } catch (error: any) {
    console.error('❌ [EMAIL] Teste SMTP falhou:', error.message);

    let message = `Falha na conexão: ${error.message}`;
    if (error.code === 'EAUTH') {
      message = 'Erro de Autenticação: usuário ou senha incorretos.';
    } else if (['ESOCKET','ETIMEDOUT'].includes(error.code) || error.message.includes('Timeout')) {
      message = 'Erro de Conexão: servidor inacessível ou tempo esgotado. Verifique endereço, porta e SSL/TLS.';
    } else if (error.message.includes('ECONNREFUSED')) {
      message = 'Conexão recusada: verifique se a porta está correta.';
    }

    res.status(500).json({ success: false, message, code: error.code || 'UNKNOWN' });
  }
}
