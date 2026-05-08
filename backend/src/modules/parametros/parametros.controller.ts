import { Request, Response } from 'express';

// ─── GET /api/parametros — lista todos (com join em user_nomes) ───────────────
export async function listParametrosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(`
      SELECT p.*,
             u.nome        AS usu_nome,
             u.sobrenome   AS usu_sobrenome,
             u.usuario     AS usu_login
      FROM parametros p
      LEFT JOIN user_nomes u ON u.codigo = p.par_usuario
      ORDER BY u.nome, u.sobrenome
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PARAMETROS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/parametros/users — lista usuários do tenant ────────────────────
export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(`
      SELECT codigo AS id, nome, sobrenome, usuario AS login,
             COALESCE(master, false) AS e_admin
      FROM user_nomes
      ORDER BY nome, sobrenome
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [PARAMETROS] users:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/parametros/:userId — parâmetros de um usuário ──────────────────
export async function getParametrosHandler(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM parametros WHERE par_usuario = $1`,
      [parseInt(String(userId))]
    );
    if (result.rows.length === 0) {
      res.json({ success: false, message: 'Parâmetros não encontrados' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [PARAMETROS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/parametros — upsert por usuário ───────────────────────────────
export async function upsertParametrosHandler(req: Request, res: Response): Promise<void> {
  try {
    const d = req.body;
    const db = req.db!;

    if (!d.par_usuario) {
      res.status(400).json({ success: false, message: 'par_usuario é obrigatório' });
      return;
    }

    const existing = await db.query(
      `SELECT par_id FROM parametros WHERE par_usuario = $1`,
      [d.par_usuario]
    );

    const fields = {
      par_ordemped:           d.par_ordemped           ?? 'D',
      par_qtdenter:           d.par_qtdenter            ?? 2,
      par_fmtpesquisa:        d.par_fmtpesquisa         ?? 'D',
      par_tipopesquisa:       d.par_tipopesquisa        ?? 'N',
      par_telemkttipo:        d.par_telemkttipo         ?? 'E',
      par_itemduplicado:      d.par_itemduplicado       ?? 'N',
      par_usadecimais:        d.par_usadecimais         ?? 'S',
      par_qtddecimais:        d.par_qtddecimais         ?? 2,
      par_zerapromo:          d.par_zerapromo           ?? 'N',
      par_mostracodori:       d.par_mostracodori        ?? 'N',
      par_validapromocao:     d.par_validapromocao      ?? 'S',
      par_salvapedidoauto:    d.par_salvapedidoauto     ?? 'S',
      par_descontogrupo:      d.par_descontogrupo       ?? 'N',
      par_mostrapednovos:     d.par_mostrapednovos      ?? 'S',
      par_mostraimpostos:     d.par_mostraimpostos      ?? 'S',
      par_ordemimpressao:     d.par_ordemimpressao      ?? 'N',
      par_tipofretepadrao:    d.par_tipofretepadrao     ?? 'C',
      par_solicitarconfemail: d.par_solicitarconfemail  ?? 'N',
      par_separalinhas:       d.par_separalinhas        ?? 'N',
      par_pedidopadrao:       d.par_pedidopadrao        ?? 1,
      par_iniciapedido:       d.par_iniciapedido        ?? 'P',
      par_obs_padrao:         d.par_obs_padrao          ?? '',
      par_emailserver:        d.par_emailserver         ?? '',
      par_email:              d.par_email               ?? '',
      par_emailuser:          d.par_emailuser           ?? '',
      par_emailporta:         d.par_emailporta          ?? 587,
      par_emailpassword:      d.par_emailpassword       ?? '',
      par_emailtls:                d.par_emailtls                ?? false,
      par_emailssl:                d.par_emailssl                ?? false,
      par_emailalternativo:        d.par_emailalternativo        ?? '',
      par_email_central_ativo:     d.par_email_central_ativo     ?? false,
      par_imap_server:             d.par_imap_server             ?? '',
      par_imap_porta:              d.par_imap_porta              ?? 993,
      par_imap_ssl:                d.par_imap_ssl                ?? true,
      par_baixa_xml_fecha:         d.par_baixa_xml_fecha         ?? 'N',
    };

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(`
        UPDATE parametros SET
          par_ordemped=$1, par_qtdenter=$2, par_fmtpesquisa=$3, par_tipopesquisa=$4,
          par_telemkttipo=$5, par_itemduplicado=$6, par_usadecimais=$7, par_qtddecimais=$8,
          par_zerapromo=$9, par_mostracodori=$10, par_validapromocao=$11, par_salvapedidoauto=$12,
          par_descontogrupo=$13, par_mostrapednovos=$14, par_mostraimpostos=$15,
          par_ordemimpressao=$16, par_tipofretepadrao=$17, par_solicitarconfemail=$18,
          par_separalinhas=$19, par_pedidopadrao=$20, par_iniciapedido=$21, par_obs_padrao=$22,
          par_emailserver=$23, par_email=$24, par_emailuser=$25, par_emailporta=$26,
          par_emailpassword=$27, par_emailtls=$28, par_emailssl=$29, par_emailalternativo=$30,
          par_email_central_ativo=$31, par_imap_server=$32, par_imap_porta=$33, par_imap_ssl=$34,
          par_baixa_xml_fecha=$35,
          updated_at=CURRENT_TIMESTAMP
        WHERE par_usuario=$36
        RETURNING *
      `, [...Object.values(fields), d.par_usuario]);
    } else {
      result = await db.query(`
        INSERT INTO parametros (
          par_usuario,
          par_ordemped, par_qtdenter, par_fmtpesquisa, par_tipopesquisa,
          par_telemkttipo, par_itemduplicado, par_usadecimais, par_qtddecimais,
          par_zerapromo, par_mostracodori, par_validapromocao, par_salvapedidoauto,
          par_descontogrupo, par_mostrapednovos, par_mostraimpostos,
          par_ordemimpressao, par_tipofretepadrao, par_solicitarconfemail,
          par_separalinhas, par_pedidopadrao, par_iniciapedido, par_obs_padrao,
          par_emailserver, par_email, par_emailuser, par_emailporta,
          par_emailpassword, par_emailtls, par_emailssl, par_emailalternativo,
          par_email_central_ativo, par_imap_server, par_imap_porta, par_imap_ssl,
          par_baixa_xml_fecha
        ) VALUES (
          $36,
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
          $31,$32,$33,$34,$35
        ) RETURNING *
      `, [...Object.values(fields), d.par_usuario]);
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: existing.rows.length > 0 ? 'Parâmetros atualizados' : 'Parâmetros criados',
    });
  } catch (error: any) {
    console.error('❌ [PARAMETROS] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/parametros/:userId ──────────────────────────────────────────
export async function deleteParametrosHandler(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const db = req.db!;
    await db.query(`DELETE FROM parametros WHERE par_usuario = $1`, [parseInt(String(userId))]);
    res.json({ success: true, message: 'Parâmetros removidos com sucesso!' });
  } catch (error: any) {
    console.error('❌ [PARAMETROS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
