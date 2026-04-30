import { Request, Response } from 'express';
import { getLinkedSellerId, buildIndustryFilterClause } from '../../shared/permissions';

function getUserId(req: Request) { return req.user?.userId; }

// ─── POST /api/suppliers ──────────────────────────────────────────────────────
export async function createSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    const db = req.db!;

    if (data.for_cgc) {
      const dup = await db.query(
        `SELECT for_codigo FROM fornecedores WHERE for_cgc = $1 AND for_tipo2 = 'A'`,
        [data.for_cgc]
      );
      if (dup.rows.length > 0) {
        res.status(400).json({ success: false, message: 'Já existe uma indústria ativa com este CNPJ.' });
        return;
      }
    }

    const result = await db.query(`
      INSERT INTO fornecedores (
        for_nome, for_nomered, for_cgc, for_inscricao,
        for_fone, for_fone2, for_email, for_endereco, for_bairro,
        for_cidade, for_uf, for_cep,
        for_percom, for_tipofrete, for_codrep, for_homepage,
        for_des1, for_des2, for_des3, for_des4, for_des5,
        for_des6, for_des7, for_des8, for_des9, for_des10,
        for_obs2, for_logotipo, for_tipo2, for_min_order
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29, $30
      ) RETURNING for_codigo
    `, [
      data.for_nome, data.for_nomered, data.for_cgc || null, data.for_inscricao || null,
      data.for_fone || null, data.for_fone2 || null, data.for_email || null, data.for_endereco || null, data.for_bairro || null,
      data.for_cidade || null, data.for_uf || null, data.for_cep || null,
      data.for_percom || 0, data.for_tipofrete || 'C', data.for_codrep || null, data.for_homepage || null,
      data.for_des1 || 0, data.for_des2 || 0, data.for_des3 || 0, data.for_des4 || 0, data.for_des5 || 0,
      data.for_des6 || 0, data.for_des7 || 0, data.for_des8 || 0, data.for_des9 || 0, data.for_des10 || 0,
      data.for_obs2 || null, data.for_logotipo || null, data.for_tipo2 || 'A', data.for_min_order || 0,
    ]);

    res.json({ success: true, message: 'Indústria cadastrada com sucesso!', id: result.rows[0].for_codigo });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/suppliers/:id ───────────────────────────────────────────────────
export async function updateSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;
    const db = req.db!;

    if (data.for_cgc) {
      const dup = await db.query(
        `SELECT for_codigo FROM fornecedores WHERE for_cgc = $1 AND for_codigo != $2 AND for_tipo2 = 'A'`,
        [data.for_cgc, parseInt(id as string)]
      );
      if (dup.rows.length > 0) {
        res.status(400).json({ success: false, message: 'Já existe outra indústria com este CNPJ.' });
        return;
      }
    }

    await db.query(`
      UPDATE fornecedores SET
        for_nome=$1, for_nomered=$2, for_cgc=$3, for_inscricao=$4,
        for_fone=$5, for_fone2=$6, for_email=$7, for_endereco=$8, for_bairro=$9,
        for_cidade=$10, for_uf=$11, for_cep=$12,
        for_percom=$13, for_tipofrete=$14, for_codrep=$15, for_homepage=$16,
        for_des1=$17, for_des2=$18, for_des3=$19, for_des4=$20, for_des5=$21,
        for_des6=$22, for_des7=$23, for_des8=$24, for_des9=$25, for_des10=$26,
        for_obs2=$27, for_logotipo=$28, for_tipo2=$29, for_min_order=$30
      WHERE for_codigo=$31
    `, [
      data.for_nome, data.for_nomered, data.for_cgc || null, data.for_inscricao || null,
      data.for_fone || null, data.for_fone2 || null, data.for_email || null, data.for_endereco || null, data.for_bairro || null,
      data.for_cidade || null, data.for_uf || null, data.for_cep || null,
      data.for_percom || 0, data.for_tipofrete || 'C', data.for_codrep || null, data.for_homepage || null,
      data.for_des1 || 0, data.for_des2 || 0, data.for_des3 || 0, data.for_des4 || 0, data.for_des5 || 0,
      data.for_des6 || 0, data.for_des7 || 0, data.for_des8 || 0, data.for_des9 || 0, data.for_des10 || 0,
      data.for_obs2 || null, data.for_logotipo || null, data.for_tipo2 || 'A', data.for_min_order || 0,
      parseInt(id as string),
    ]);

    res.json({ success: true, message: 'Indústria atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/suppliers/:id ────────────────────────────────────────────────
export async function deleteSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    await db.query(`UPDATE fornecedores SET for_tipo2 = 'I' WHERE for_codigo = $1`, [parseInt(id as string)]);
    res.json({ success: true, message: 'Indústria inativada com sucesso.' });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/suppliers ───────────────────────────────────────────────────────
export async function listSuppliersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search, active = 'true' } = req.query;
    const db = req.db!;
    const userId = getUserId(req);

    const sellerId = await getLinkedSellerId(db, userId);
    const params: any[] = [];
    const { filterClause } = buildIndustryFilterClause(sellerId, 'f.for_codigo', params);

    let query = `
      SELECT
        f.for_codigo, f.for_nomered, f.for_nome,
        f.for_cgc,
        f.for_email, f.for_fone, f.for_cidade, f.for_uf,
        f.for_percom, f.for_tipo2, f.for_min_order
      FROM fornecedores f
      WHERE 1=1 ${filterClause}
    `;

    if (active === 'true')       query += ` AND (f.for_tipo2 = 'A' OR f.for_tipo2 IS NULL)`;
    else if (active === 'false') query += ` AND f.for_tipo2 = 'I'`;

    let idx = params.length + 1;
    if (search) {
      query += ` AND (f.for_nome ILIKE $${idx} OR f.for_nomered ILIKE $${idx} OR f.for_cgc ILIKE $${idx})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY f.for_nomered`;

    const result = await db.query(query, params);
    console.log(`🔍 [SUPPLIERS] list: userId=${userId}, sellerId=${sellerId}, count=${result.rows.length}`);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/suppliers/:id ───────────────────────────────────────────────────
export async function getSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;

    const result = await db.query(
      `SELECT * FROM fornecedores WHERE for_codigo = $1`,
      [parseInt(id as string)]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/suppliers/:id/contacts ─────────────────────────────────────────
export async function listContactsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM contato_for WHERE con_fornec = $1 ORDER BY con_nome`,
      [parseInt(id as string)]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/CONTACTS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/suppliers/:id/contacts ────────────────────────────────────────
export async function createContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;
    const db = req.db!;
    const result = await db.query(`
      INSERT INTO contato_for (con_fornec, con_nome, con_cargo, con_telefone, con_celular, con_email, con_dtnasc, con_obs, con_timequetorce, con_esportepreferido, con_hobby)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING con_codigo
    `, [parseInt(id as string),
        data.con_nome || null, data.con_cargo || null,
        data.con_telefone || null, data.con_celular || null, data.con_email || null,
        data.con_dtnasc || null, data.con_obs || null,
        data.con_timequetorce || null, data.con_esportepreferido || null, data.con_hobby || null]);
    res.json({ success: true, id: result.rows[0].con_codigo });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/CONTACTS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/suppliers/:id/contacts/:contactId ───────────────────────────────
export async function updateContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { contactId } = req.params;
    const data = req.body;
    const db = req.db!;
    await db.query(`
      UPDATE contato_for SET
        con_nome=$1, con_cargo=$2, con_telefone=$3, con_celular=$4, con_email=$5,
        con_dtnasc=$6, con_obs=$7, con_timequetorce=$8, con_esportepreferido=$9, con_hobby=$10
      WHERE con_codigo=$11
    `, [data.con_nome || null, data.con_cargo || null,
        data.con_telefone || null, data.con_celular || null, data.con_email || null,
        data.con_dtnasc || null, data.con_obs || null,
        data.con_timequetorce || null, data.con_esportepreferido || null, data.con_hobby || null,
        parseInt(contactId as string)]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/CONTACTS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/suppliers/:id/contacts/:contactId ────────────────────────────
export async function deleteContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { contactId } = req.params;
    const db = req.db!;
    await db.query(`DELETE FROM contato_for WHERE con_codigo = $1`, [parseInt(contactId as string)]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/CONTACTS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/suppliers/:id/customers ────────────────────────────────────────
export async function listSupplierCustomersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    const result = await db.query(`
      SELECT
        c.cli_codigo, c.cli_nomred, c.cli_cnpj,
        MAX(p.ped_data)              AS ultima_compra,
        COUNT(DISTINCT p.ped_pedido) AS qtd_pedidos,
        SUM(p.ped_totliq)            AS total_compras
      FROM pedidos p
      JOIN clientes c ON p.ped_cliente = c.cli_codigo
      WHERE p.ped_industria = $1
        AND p.ped_situacao IN ('P', 'F')
      GROUP BY c.cli_codigo, c.cli_nomred, c.cli_cnpj
      ORDER BY total_compras DESC
    `, [parseInt(id as string)]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/CUSTOMERS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/suppliers/:id/ia-knowledge ─────────────────────────────────────
export async function getIaKnowledgeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM ia_conhecimento WHERE for_codigo = $1`,
      [parseInt(id as string)]
    );
    res.json({ success: true, data: result.rows[0] || {} });
  } catch (error: any) {
    if (error.code === '42P01') { res.json({ success: true, data: {} }); return; }
    console.error('❌ [SUPPLIERS/IA] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/suppliers/:id/ia-knowledge ────────────────────────────────────
export async function upsertIaKnowledgeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { nome_marca, resumo_negocio, persona_ia, palavras_chave } = req.body;
    const db = req.db!;
    const fid = parseInt(id as string);

    await db.query(`
      INSERT INTO ia_conhecimento (for_codigo, nome_marca, resumo_negocio, persona_ia, palavras_chave)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (for_codigo) DO UPDATE SET
        nome_marca=$2, resumo_negocio=$3, persona_ia=$4, palavras_chave=$5, updated_at=NOW()
    `, [fid, nome_marca || null, resumo_negocio || null, persona_ia || null, palavras_chave || null]);

    res.json({ success: true, message: 'Conhecimento salvo com sucesso!' });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/IA] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/suppliers/:id/goals/:year ──────────────────────────────────────
export async function getSupplierGoalsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id, year } = req.params;
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM ind_metas WHERE met_industria = $1 AND met_ano = $2`,
      [parseInt(id as string), parseInt(year as string)]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/GOALS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/suppliers/:id/goals/:year ──────────────────────────────────────
export async function upsertSupplierGoalsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id, year } = req.params;
    const data = req.body;
    const db = req.db!;
    await db.query(`
      INSERT INTO ind_metas (met_industria, met_ano,
        met_jan, met_fev, met_mar, met_abr, met_mai, met_jun,
        met_jul, met_ago, met_set, met_out, met_nov, met_dez)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (met_industria, met_ano) DO UPDATE SET
        met_jan=$3, met_fev=$4, met_mar=$5, met_abr=$6, met_mai=$7, met_jun=$8,
        met_jul=$9, met_ago=$10, met_set=$11, met_out=$12, met_nov=$13, met_dez=$14
    `, [parseInt(id as string), parseInt(year as string),
        data.met_jan||0, data.met_fev||0, data.met_mar||0, data.met_abr||0,
        data.met_mai||0, data.met_jun||0, data.met_jul||0, data.met_ago||0,
        data.met_set||0, data.met_out||0, data.met_nov||0, data.met_dez||0]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [SUPPLIERS/GOALS] upsert:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
