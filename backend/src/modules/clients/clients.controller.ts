import { Request, Response } from 'express';
import { getScopeSellerId } from '../../shared/permissions';

// ─── GET /api/clients ─────────────────────────────────────────────────────────
export async function listClientsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { page = 1, limit = 10, search, active = 'true' } = req.query;
    const db = req.db!;

    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT
        c.cli_codigo,
        c.cli_cnpj,
        c.cli_nomred,
        c.cli_nome,
        c.cli_fantasia,
        COALESCE(cid.cid_nome, c.cli_cidade) AS cli_cidade,
        COALESCE(cid.cid_uf, c.cli_uf)       AS cli_uf,
        c.cli_fone1                            AS cli_fone,
        c.cli_email,
        c.cli_redeloja,
        c.cli_vendedor,
        COALESCE(v.ven_nome, '')                               AS cli_vendedor_nome,
        c.cli_tipopes,
        c.cli_atuacao,
        CASE WHEN c.cli_tipopes = 'A' THEN true ELSE false END AS cli_status
      FROM clientes c
      LEFT JOIN public.cidades    cid ON c.cli_idcidade = cid.cid_codigo
      LEFT JOIN vendedores v   ON v.ven_codigo   = c.cli_vendedor
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    // Escopo de carteira: respeita o toggle do tenant (damarep = todos atendem todos → sem filtro).
    const sellerId = await getScopeSellerId(db, req.user?.userId);
    if (sellerId) {
      query += ` AND c.cli_vendedor = $${idx++}`;
      params.push(sellerId);
    }

    if (search) {
      query += ` AND (
        c.cli_nome    ILIKE $${idx} OR
        c.cli_fantasia ILIKE $${idx} OR
        c.cli_nomred  ILIKE $${idx} OR
        c.cli_cnpj    ILIKE $${idx} OR
        c.cli_redeloja ILIKE $${idx} OR
        cid.cid_nome  ILIKE $${idx} OR
        CAST(c.cli_codigo AS TEXT) ILIKE $${idx}
      )`;
      params.push(`%${search}%`);
      idx++;
    }

    if (active === 'true') query += ` AND c.cli_tipopes = 'A'`;
    else if (active === 'false') query += ` AND c.cli_tipopes = 'I'`;

    const countRes = await db.query(`SELECT count(*) FROM (${query}) AS t`, params);
    const total = parseInt(countRes.rows[0].count);

    query += ` ORDER BY c.cli_nomred ASC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('❌ [CLIENTS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/clients/:id ─────────────────────────────────────────────────────
export async function getClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;

    const result = await db.query(`
      SELECT
        c.cli_codigo, c.cli_nome, c.cli_fantasia, c.cli_nomred,
        c.cli_cnpj, c.cli_inscricao,
        c.cli_endereco, c.cli_endnum, c.cli_complemento, c.cli_bairro, c.cli_cep,
        c.cli_idcidade, c.cli_cidade, c.cli_uf,
        c.cli_fone1, c.cli_fone2, c.cli_fone3, c.cli_email,
        c.cli_emailnfe, c.cli_emailfinanc,
        c.cli_vendedor AS cli_vendedor_id,
        c.cli_regiao2   AS cli_regiao_id,
        c.cli_atividade,
        c.cli_setor_id,
        s.set_nome AS setor_nome,
        c.cli_obspedido, c.cli_suframa,
        c.cli_latitude, c.cli_longitude,
        c.cli_tipopes, c.cli_redeloja, c.cli_atuacao, c.cli_ignora_estat,
        c.cli_dtabertura, c.cli_datacad,
        c.cli_cepcob, c.cli_endcob, c.cli_baicob, c.cli_cidcob, c.cli_ufcob
      FROM clientes c
      LEFT JOIN setores s ON s.set_codigo = c.cli_setor_id
      WHERE c.cli_codigo = $1
    `, [id]);

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [CLIENTS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/clients ────────────────────────────────────────────────────────
export async function createClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    const db = req.db!;

    if (data.cli_cnpj) {
      const dup = await db.query(
        `SELECT cli_codigo FROM clientes WHERE cli_cnpj = $1 AND cli_tipopes = 'A'`,
        [data.cli_cnpj]
      );
      if (dup.rows.length > 0) {
        res.status(400).json({ success: false, message: 'Já existe um cliente ativo com este CNPJ/CPF.' });
        return;
      }
    }

    const result = await db.query(`
      INSERT INTO clientes (
        cli_nome, cli_fantasia, cli_nomred, cli_cnpj, cli_inscricao,
        cli_endereco, cli_endnum, cli_complemento, cli_bairro, cli_cep,
        cli_idcidade, cli_cidade, cli_uf,
        cli_fone1, cli_fone2, cli_email, cli_emailnfe, cli_emailfinanc,
        cli_vendedor, cli_regiao2, cli_atividade, cli_setor_id,
        cli_obspedido, cli_suframa,
        cli_latitude, cli_longitude,
        cli_tipopes, cli_redeloja, cli_dtabertura, cli_datacad,
        cli_cepcob, cli_endcob, cli_baicob, cli_cidcob, cli_ufcob, cli_fone3,
        cli_atuacao, cli_ignora_estat
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38
      ) RETURNING cli_codigo
    `, [
      data.cli_nome, data.cli_fantasia, data.cli_nomred, data.cli_cnpj || null, data.cli_inscricao,
      data.cli_endereco, data.cli_endnum || null, data.cli_complemento || null, data.cli_bairro, data.cli_cep,
      data.cli_idcidade || null, data.cli_cidade, data.cli_uf,
      data.cli_fone1, data.cli_fone2, data.cli_email, data.cli_emailnfe, data.cli_emailfinanc,
      data.cli_vendedor_id || data.cli_vendedor || null,
      data.cli_regiao_id || data.cli_regiao2 || null,
      data.cli_atividade || null,
      data.cli_setor_id || null,
      data.cli_obspedido, data.cli_suframa,
      data.cli_latitude && !isNaN(data.cli_latitude) ? parseFloat(data.cli_latitude) : null,
      data.cli_longitude && !isNaN(data.cli_longitude) ? parseFloat(data.cli_longitude) : null,
      data.cli_tipopes || 'A', data.cli_redeloja,
      data.cli_dtabertura || null, data.cli_datacad || new Date(),
      data.cli_cepcob, data.cli_endcob, data.cli_baicob, data.cli_cidcob, data.cli_ufcob, data.cli_fone3,
      data.cli_atuacao || null,
      data.cli_ignora_estat === true,   // default FALSE: lojista nasce como comprador; REP marca só quem NÃO compra
    ]);

    res.json({ success: true, message: 'Cliente cadastrado com sucesso!', id: result.rows[0].cli_codigo });
  } catch (error: any) {
    console.error('❌ [CLIENTS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/clients/:id ─────────────────────────────────────────────────────
export async function updateClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;
    const db = req.db!;

    if (data.cli_cnpj) {
      const dup = await db.query(
        `SELECT cli_codigo FROM clientes WHERE cli_cnpj = $1 AND cli_codigo != $2 AND cli_tipopes = 'A'`,
        [data.cli_cnpj, parseInt(String(id))]
      );
      if (dup.rows.length > 0) {
        res.status(400).json({ success: false, message: 'Já existe outro cliente ativo com este CNPJ/CPF.' });
        return;
      }
    }

    await db.query(`
      UPDATE clientes SET
        cli_nome=$1, cli_fantasia=$2, cli_nomred=$3, cli_cnpj=$4, cli_inscricao=$5,
        cli_endereco=$6, cli_endnum=$7, cli_complemento=$8, cli_bairro=$9, cli_cep=$10,
        cli_idcidade=$11, cli_cidade=$12, cli_uf=$13,
        cli_fone1=$14, cli_fone2=$15, cli_email=$16, cli_emailnfe=$17, cli_emailfinanc=$18,
        cli_vendedor=$19, cli_regiao2=$20, cli_atividade=$21, cli_setor_id=$22,
        cli_obspedido=$23, cli_suframa=$24,
        cli_latitude=$25, cli_longitude=$26,
        cli_tipopes=$27, cli_redeloja=$28, cli_dtabertura=$29,
        cli_cepcob=$30, cli_endcob=$31, cli_baicob=$32, cli_cidcob=$33, cli_ufcob=$34, cli_fone3=$35,
        cli_atuacao=$36, cli_ignora_estat=$37
      WHERE cli_codigo=$38
    `, [
      data.cli_nome, data.cli_fantasia, data.cli_nomred, data.cli_cnpj, data.cli_inscricao,
      data.cli_endereco, data.cli_endnum || null, data.cli_complemento || null, data.cli_bairro, data.cli_cep,
      data.cli_idcidade || null, data.cli_cidade, data.cli_uf,
      data.cli_fone1, data.cli_fone2, data.cli_email, data.cli_emailnfe, data.cli_emailfinanc,
      data.cli_vendedor_id || data.cli_vendedor || null,
      data.cli_regiao_id || data.cli_regiao2 || null,
      data.cli_atividade || null,
      data.cli_setor_id || null,
      data.cli_obspedido, data.cli_suframa,
      data.cli_latitude && !isNaN(data.cli_latitude) ? parseFloat(data.cli_latitude) : null,
      data.cli_longitude && !isNaN(data.cli_longitude) ? parseFloat(data.cli_longitude) : null,
      data.cli_tipopes, data.cli_redeloja, data.cli_dtabertura || null,
      data.cli_cepcob, data.cli_endcob, data.cli_baicob, data.cli_cidcob, data.cli_ufcob, data.cli_fone3,
      data.cli_atuacao || null,
      data.cli_ignora_estat === true,
      id,
    ]);

    res.json({ success: true, message: 'Cliente atualizado com sucesso!' });
  } catch (error: any) {
    console.error('❌ [CLIENTS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/clients/:id ──────────────────────────────────────────────────
export async function deleteClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    // Inativação lógica
    await db.query(`UPDATE clientes SET cli_tipopes = 'I' WHERE cli_codigo = $1`, [id]);
    res.json({ success: true, message: 'Cliente inativado com sucesso.' });
  } catch (error: any) {
    console.error('❌ [CLIENTS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/clients/:id/contacts ────────────────────────────────────────────
export async function listContactsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM cli_aniv WHERE ani_cliente = $1 ORDER BY ani_nome`,
      [parseInt(String(id))]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CLIENTS/CONTACTS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/clients/:id/contacts ───────────────────────────────────────────
export async function createContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const d = req.body;
    const db = req.db!;

    const result = await db.query(`
      INSERT INTO cli_aniv (
        ani_cliente, ani_nome, ani_funcao, ani_fone, ani_email,
        ani_diaaniv, ani_mes, ani_niver,
        ani_timequetorce, ani_esportepreferido, ani_hobby, ani_obs
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      parseInt(String(id)),
      (d.ani_nome || '').trim().toUpperCase(),
      (d.ani_funcao || '').trim().toUpperCase() || null,
      d.ani_fone || null,
      d.ani_email || null,
      d.ani_diaaniv ? parseInt(d.ani_diaaniv) : null,
      d.ani_mes ? parseInt(d.ani_mes) : null,
      d.ani_diaaniv && d.ani_mes
        ? `2001-${String(d.ani_mes).padStart(2,'0')}-${String(d.ani_diaaniv).padStart(2,'0')}`
        : null,
      d.ani_timequetorce || null,
      d.ani_esportepreferido || null,
      d.ani_hobby || null,
      d.ani_obs || null,
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [CLIENTS/CONTACTS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/clients/:id/contacts/:lancto ────────────────────────────────────
export async function updateContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { lancto } = req.params;
    const d = req.body;
    const db = req.db!;

    await db.query(`
      UPDATE cli_aniv SET
        ani_nome=$1, ani_funcao=$2, ani_fone=$3, ani_email=$4,
        ani_diaaniv=$5, ani_mes=$6, ani_niver=$7,
        ani_timequetorce=$8, ani_esportepreferido=$9, ani_hobby=$10, ani_obs=$11
      WHERE ani_lancto=$12
    `, [
      (d.ani_nome || '').trim().toUpperCase(),
      (d.ani_funcao || '').trim().toUpperCase() || null,
      d.ani_fone || null,
      d.ani_email || null,
      d.ani_diaaniv ? parseInt(d.ani_diaaniv) : null,
      d.ani_mes ? parseInt(d.ani_mes) : null,
      d.ani_diaaniv && d.ani_mes
        ? `2001-${String(d.ani_mes).padStart(2,'0')}-${String(d.ani_diaaniv).padStart(2,'0')}`
        : null,
      d.ani_timequetorce || null,
      d.ani_esportepreferido || null,
      d.ani_hobby || null,
      d.ani_obs || null,
      parseInt(String(lancto)),
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [CLIENTS/CONTACTS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/clients/:id/contacts/:lancto ─────────────────────────────────
export async function deleteContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { lancto } = req.params;
    const db = req.db!;
    await db.query(`DELETE FROM cli_aniv WHERE ani_lancto = $1`, [parseInt(String(lancto))]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [CLIENTS/CONTACTS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/clients/:id/industries ──────────────────────────────────────────
export async function listIndustriesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    // cli_transportadora referencia fornecedores.for_codigo (igual ao V1)
    const result = await db.query(`
      SELECT
        ci.cli_lancamento, ci.cli_codigo, ci.cli_forcodigo,
        ci.cli_desc1, ci.cli_desc2, ci.cli_desc3, ci.cli_desc4, ci.cli_desc5,
        ci.cli_desc6, ci.cli_desc7, ci.cli_desc8, ci.cli_desc9,
        ci.cli_desc10, ci.cli_desc11,
        ci.cli_prazopg, ci.cli_transportadora, ci.cli_tabela,
        ci.cli_comprador, ci.cli_emailcomprador, ci.cli_frete,
        ci.cli_codcliind, ci.cli_obsparticular, ci.cli_ipi,
        ci.cli_canal,
        f.for_nomered  AS industria_nome,
        t.for_nomered  AS transportadora_nome
      FROM cli_ind ci
      LEFT JOIN fornecedores f ON f.for_codigo = ci.cli_forcodigo
      LEFT JOIN fornecedores t ON t.for_codigo = ci.cli_transportadora
      WHERE ci.cli_codigo = $1
      ORDER BY f.for_nomered
    `, [parseInt(String(id))]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CLIENTS/INDUSTRIES] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/clients/:id/industries ────────────────────────────────────────
// Mesma lógica do V1: verifica se existe, faz INSERT ou UPDATE por cli_lancamento
export async function upsertIndustryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const d = req.body;
    const db = req.db!;

    if (!d.cli_forcodigo) {
      res.status(400).json({ success: false, message: 'Indústria é obrigatória.' });
      return;
    }

    const values = [
      d.cli_desc1  || 0, d.cli_desc2  || 0, d.cli_desc3  || 0,
      d.cli_desc4  || 0, d.cli_desc5  || 0, d.cli_desc6  || 0,
      d.cli_desc7  || 0, d.cli_desc8  || 0, d.cli_desc9  || 0,
      d.cli_desc10 || 0,
      d.cli_transportadora || null,
      d.cli_prazopg        || '',
      d.cli_ipi            || '',
      d.cli_tabela         || '',
      d.cli_codcliind      || '',
      d.cli_obsparticular  || '',
      d.cli_comprador      || '',
      d.cli_frete          || '',
      d.cli_emailcomprador || '',
      d.cli_desc11 || 0,
      d.cli_canal  || 'varejo',
    ];

    const existing = await db.query(
      `SELECT cli_lancamento FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2`,
      [parseInt(String(id)), parseInt(d.cli_forcodigo)]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(`
        UPDATE cli_ind SET
          cli_desc1=$1, cli_desc2=$2, cli_desc3=$3, cli_desc4=$4, cli_desc5=$5,
          cli_desc6=$6, cli_desc7=$7, cli_desc8=$8, cli_desc9=$9,
          cli_desc10=$10, cli_transportadora=$11,
          cli_prazopg=$12, cli_ipi=$13, cli_tabela=$14,
          cli_codcliind=$15, cli_obsparticular=$16,
          cli_comprador=$17, cli_frete=$18,
          cli_emailcomprador=$19, cli_desc11=$20,
          cli_canal=$21
        WHERE cli_lancamento=$22
        RETURNING cli_lancamento
      `, [...values, existing.rows[0].cli_lancamento]);
    } else {
      result = await db.query(`
        INSERT INTO cli_ind (
          cli_codigo, cli_forcodigo,
          cli_desc1, cli_desc2, cli_desc3, cli_desc4, cli_desc5,
          cli_desc6, cli_desc7, cli_desc8, cli_desc9, cli_desc10,
          cli_transportadora, cli_prazopg, cli_ipi, cli_tabela,
          cli_codcliind, cli_obsparticular, cli_comprador,
          cli_frete, cli_emailcomprador, cli_desc11,
          cli_canal
        ) VALUES (
          $22, $23,
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21
        ) RETURNING cli_lancamento
      `, [...values, parseInt(String(id)), parseInt(d.cli_forcodigo)]);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [CLIENTS/INDUSTRIES] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/clients/:id/industries/:lancamento ───────────────────────────
export async function deleteIndustryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { lancamento } = req.params;
    const db = req.db!;
    await db.query(`DELETE FROM cli_ind WHERE cli_lancamento = $1`, [parseInt(String(lancamento))]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [CLIENTS/INDUSTRIES] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/clients/:id/discounts ───────────────────────────────────────────
export async function listDiscountsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    const result = await db.query(`
      SELECT
        d.*,
        f.for_nomered AS industria_nome,
        g.gru_nome    AS grupo_nome
      FROM cli_descpro d
      LEFT JOIN fornecedores f ON f.for_codigo = d.cli_forcodigo
      LEFT JOIN grupos g ON g.gru_codigo = d.cli_grupo
      WHERE d.cli_codigo = $1
      ORDER BY f.for_nomered, g.gru_nome
    `, [parseInt(String(id))]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CLIENTS/DISCOUNTS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/clients/:id/discounts ─────────────────────────────────────────
export async function upsertDiscountHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const d = req.body;
    const db = req.db!;

    if (!d.cli_forcodigo || !d.cli_grupo) {
      res.status(400).json({ success: false, message: 'Indústria e Grupo são obrigatórios.' });
      return;
    }

    const result = await db.query(`
      INSERT INTO cli_descpro (
        cli_codigo, cli_forcodigo, cli_grupo,
        cli_desc1, cli_desc2, cli_desc3, cli_desc4, cli_desc5,
        cli_desc6, cli_desc7, cli_desc8, cli_desc9
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (cli_codigo, cli_forcodigo, cli_grupo) DO UPDATE SET
        cli_desc1=EXCLUDED.cli_desc1, cli_desc2=EXCLUDED.cli_desc2,
        cli_desc3=EXCLUDED.cli_desc3, cli_desc4=EXCLUDED.cli_desc4,
        cli_desc5=EXCLUDED.cli_desc5, cli_desc6=EXCLUDED.cli_desc6,
        cli_desc7=EXCLUDED.cli_desc7, cli_desc8=EXCLUDED.cli_desc8,
        cli_desc9=EXCLUDED.cli_desc9
      RETURNING *
    `, [
      parseInt(String(id)), parseInt(d.cli_forcodigo), parseInt(d.cli_grupo),
      d.cli_desc1||0, d.cli_desc2||0, d.cli_desc3||0, d.cli_desc4||0, d.cli_desc5||0,
      d.cli_desc6||0, d.cli_desc7||0, d.cli_desc8||0, d.cli_desc9||0,
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [CLIENTS/DISCOUNTS] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/clients/:id/discounts/:industryId/:groupId ──────────────────
export async function deleteDiscountHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id, industryId, groupId } = req.params;
    const db = req.db!;
    await db.query(
      `DELETE FROM cli_descpro WHERE cli_codigo=$1 AND cli_forcodigo=$2 AND cli_grupo=$3`,
      [parseInt(String(id)), parseInt(String(industryId)), parseInt(String(groupId))]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [CLIENTS/DISCOUNTS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/clients/:id/prospeccao ─────────────────────────────────────────
// Retorna todas as indústrias com flag selected (opt-in via indclientes)
export async function listProspeccaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const cliId = parseInt(String(req.params.id));
    const db = req.db!;
    const result = await db.query(`
      SELECT
        f.for_codigo  AS id,
        COALESCE(f.for_nomered, f.for_nome) AS nome,
        f.for_nome    AS nome_completo,
        EXISTS (
          SELECT 1 FROM indclientes ic
          WHERE ic.cli_id = $1 AND ic.cli_indid = f.for_codigo
        ) AS selected
      FROM fornecedores f
      WHERE (f.for_tipo2 = 'A' OR f.for_tipo2 IS NULL)
      ORDER BY COALESCE(f.for_nomered, f.for_nome)
    `, [cliId]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CLIENTS/PROSPECCAO] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/clients/:id/prospeccao ─────────────────────────────────────────
// Substitui seleção: apaga tudo e insere os marcados
export async function upsertProspeccaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const cliId = parseInt(String(req.params.id));
    const { industryIds }: { industryIds: number[] } = req.body;
    const db = req.db!;
    await db.query(`DELETE FROM indclientes WHERE cli_id = $1`, [cliId]);
    if (industryIds && industryIds.length > 0) {
      for (const indId of industryIds) {
        await db.query(
          `INSERT INTO indclientes (cli_id, cli_indid, gid) VALUES ($1, $2, '')
           ON CONFLICT DO NOTHING`,
          [cliId, indId]
        );
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [CLIENTS/PROSPECCAO] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/clients/:id/areas ──────────────────────────────────────────────
// Áreas de atuação são CATÁLOGO FECHADO mantido pela SoftHam, vivendo em
// `public.area_atu`. Cada tenant ainda tem cópia local de area_atu (legacy V1)
// mas o sistema deixa de ler dela — sempre `public.area_atu` agora.
// A relação cliente↔área permanece em `[tenant].atua_cli`.
export async function listAreasHandler(req: Request, res: Response): Promise<void> {
  try {
    const cliId = parseInt(String(req.params.id));
    const db = req.db!;
    const result = await db.query(`
      SELECT
        a.atu_id   AS id,
        a.atu_descricao AS nome,
        EXISTS (
          SELECT 1 FROM atua_cli ac
          WHERE ac.atu_idcli = $1 AND ac.atu_atuaid = a.atu_id
        ) AS selected
      FROM public.area_atu a
      WHERE COALESCE(a.atu_sel, 'S') = 'S'
      ORDER BY a.atu_descricao
    `, [cliId]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CLIENTS/AREAS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/clients/:id/areas ──────────────────────────────────────────────
// Substitui seleção: apaga tudo e insere os marcados
export async function upsertAreasHandler(req: Request, res: Response): Promise<void> {
  try {
    const cliId = parseInt(String(req.params.id));
    const { areaIds }: { areaIds: number[] } = req.body;
    const db = req.db!;
    await db.query(`DELETE FROM atua_cli WHERE atu_idcli = $1`, [cliId]);
    if (areaIds && areaIds.length > 0) {
      for (const areaId of areaIds) {
        await db.query(
          `INSERT INTO atua_cli (atu_idcli, atu_atuaid) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [cliId, areaId]
        );
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [CLIENTS/AREAS] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/clients/vincular-regioes ───────────────────────────────────────
export async function vincularRegioesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(`
      UPDATE clientes c
      SET cli_regiao2 = cr.reg_id
      FROM cidades_regioes cr
      WHERE c.cli_idcidade = cr.cid_id
        AND c.cli_regiao2 IS NULL
        AND c.cli_idcidade IS NOT NULL
    `);
    res.json({ success: true, atualizados: result.rowCount ?? 0 });
  } catch (error: any) {
    console.error('❌ [CLIENTS] vincular-regioes:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/clients/:id/portal-token ───────────────────────────────────────
export async function generatePortalTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db    = req.db!;
    const schema = req.schema!;

    const r = await db.query(`
      INSERT INTO portal_clientes (cli_codigo)
      VALUES ($1)
      ON CONFLICT (cli_codigo) DO UPDATE SET ativo = true
      RETURNING token, ativo, criado_em
    `, [parseInt(String(id))]);

    const { token } = r.rows[0];
    res.json({ success: true, token, schema });
  } catch (error: any) {
    console.error('❌ [CLIENTS] portal-token:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}


// ─── GET /api/clients/:id/historico ──────────────────────────────────────────
export async function clienteHistoricoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;

    const [industrias, pedidos] = await Promise.all([
      db.query(`
        SELECT f.for_codigo, COALESCE(f.for_nomered, f.for_nome) AS for_nomered,
               MAX(p.ped_data) AS ultima_compra
        FROM pedidos p
        JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE p.ped_cliente = $1
          AND p.ped_situacao IN ('P','F')
        GROUP BY f.for_codigo, f.for_nomered, f.for_nome
        ORDER BY ultima_compra DESC
      `, [parseInt(String(id))]),
      db.query(`
        SELECT p.ped_pedido, p.ped_data, p.ped_totliq,
               COALESCE(f.for_nomered, f.for_nome, '') AS for_nomered
        FROM pedidos p
        LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE p.ped_cliente = $1
          AND p.ped_situacao IN ('P','F')
        ORDER BY p.ped_data DESC, p.ped_numero DESC
        LIMIT 200
      `, [parseInt(String(id))]),
    ]);

    res.json({ success: true, industrias: industrias.rows, pedidos: pedidos.rows });
  } catch (error: any) {
    console.error('❌ [CLIENTS] historico:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
