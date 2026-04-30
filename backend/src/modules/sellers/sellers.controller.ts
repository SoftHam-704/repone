import { Request, Response } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const;

function sellerParams(data: any) {
  return [
    data.ven_nome        || null,
    data.ven_endereco    || null,
    data.ven_bairro      || null,
    data.ven_cidade      || null,
    data.ven_cep         || null,
    data.ven_uf          || null,
    data.ven_fone1       || null,
    data.ven_fone2       || null,
    data.ven_aniversario || null,
    data.ven_cpf         || null,
    data.ven_rg          || null,
    data.ven_ctps        || null,
    data.ven_email       || null,
    data.ven_nomeusu     || null,
    data.ven_dtadmissao  || null,
    data.ven_dtdemissao  || null,
    data.ven_status      || 'A',
    data.ven_cumpremetas || 'S',
    data.ven_filiacao    || null,
    data.ven_obs         || null,
    data.ven_codusu      || null,
  ];
}

// ─── GET /api/sellers ─────────────────────────────────────────────────────────
export async function listSellersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    const db = req.db!;

    let query = `
      SELECT ven_codigo, ven_nome, ven_fone1, ven_fone2, ven_email,
             ven_nomeusu, ven_status, ven_cidade, ven_uf
      FROM vendedores
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (ven_nome ILIKE $1 OR ven_email ILIKE $1 OR ven_nomeusu ILIKE $1 OR ven_cpf ILIKE $1)`;
    }

    query += ` ORDER BY ven_nome`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLERS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellers/:id ─────────────────────────────────────────────────────
export async function getSellerHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM vendedores WHERE ven_codigo = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Vendedor não encontrado.' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [SELLERS] get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/sellers ────────────────────────────────────────────────────────
export async function createSellerHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    const db = req.db!;

    if (!data.ven_nome?.trim()) {
      res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
      return;
    }

    if (data.ven_nomeusu) {
      const dup = await db.query(
        `SELECT ven_codigo FROM vendedores WHERE ven_nomeusu = $1`, [data.ven_nomeusu]
      );
      if (dup.rows.length > 0) {
        res.status(400).json({ success: false, message: 'Já existe um vendedor com este usuário.' });
        return;
      }
    }

    const result = await db.query(`
      INSERT INTO vendedores (
        ven_nome, ven_endereco, ven_bairro, ven_cidade, ven_cep, ven_uf,
        ven_fone1, ven_fone2, ven_aniversario, ven_cpf, ven_rg, ven_ctps,
        ven_email, ven_nomeusu, ven_dtadmissao, ven_dtdemissao, ven_status,
        ven_cumpremetas, ven_filiacao, ven_obs, ven_codusu
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING ven_codigo
    `, sellerParams(data));

    res.json({ success: true, message: 'Vendedor cadastrado com sucesso!', id: result.rows[0].ven_codigo });
  } catch (error: any) {
    console.error('❌ [SELLERS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/sellers/:id ─────────────────────────────────────────────────────
export async function updateSellerHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    const data = req.body;
    const db = req.db!;

    if (!data.ven_nome?.trim()) {
      res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
      return;
    }

    if (data.ven_nomeusu) {
      const dup = await db.query(
        `SELECT ven_codigo FROM vendedores WHERE ven_nomeusu = $1 AND ven_codigo != $2`,
        [data.ven_nomeusu, id]
      );
      if (dup.rows.length > 0) {
        res.status(400).json({ success: false, message: 'Já existe outro vendedor com este usuário.' });
        return;
      }
    }

    await db.query(`
      UPDATE vendedores SET
        ven_nome=$1, ven_endereco=$2, ven_bairro=$3, ven_cidade=$4, ven_cep=$5, ven_uf=$6,
        ven_fone1=$7, ven_fone2=$8, ven_aniversario=$9, ven_cpf=$10, ven_rg=$11, ven_ctps=$12,
        ven_email=$13, ven_nomeusu=$14, ven_dtadmissao=$15, ven_dtdemissao=$16, ven_status=$17,
        ven_cumpremetas=$18, ven_filiacao=$19, ven_obs=$20, ven_codusu=$21
      WHERE ven_codigo=$22
    `, [...sellerParams(data), id]);

    res.json({ success: true, message: 'Vendedor atualizado com sucesso!' });
  } catch (error: any) {
    console.error('❌ [SELLERS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/sellers/:id ──────────────────────────────────────────────────
export async function deleteSellerHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    await db.query(`DELETE FROM vendedores WHERE ven_codigo = $1`, [parseInt(String(req.params.id))]);
    res.json({ success: true, message: 'Vendedor removido com sucesso.' });
  } catch (error: any) {
    console.error('❌ [SELLERS] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellers/:id/industries ─────────────────────────────────────────
export async function listSellerIndustriesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const result = await db.query(`
      SELECT vi.vin_industria, vi.vin_codigo, vi.vin_percom,
             f.for_nomered, f.for_nome
      FROM vendedor_ind vi
      INNER JOIN fornecedores f ON vi.vin_industria = f.for_codigo
      WHERE vi.vin_codigo = $1
      ORDER BY f.for_nomered
    `, [id]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLERS] industries list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/sellers/:id/industries ────────────────────────────────────────
export async function addSellerIndustryHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const { vin_industria, vin_percom = 0 } = req.body;

    if (!vin_industria) {
      res.status(400).json({ success: false, message: 'Indústria é obrigatória.' });
      return;
    }

    await db.query(
      `INSERT INTO vendedor_ind (vin_codigo, vin_industria, vin_percom) VALUES ($1, $2, $3)`,
      [id, vin_industria, vin_percom]
    );
    res.json({ success: true, message: 'Indústria vinculada com sucesso!' });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ success: false, message: 'Esta indústria já está vinculada ao vendedor.' });
      return;
    }
    console.error('❌ [SELLERS] industries add:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/sellers/:id/industries/:industryId ─────────────────────────────
export async function updateSellerIndustryHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const industryId = parseInt(String(req.params.industryId));
    const { vin_percom = 0 } = req.body;

    await db.query(
      `UPDATE vendedor_ind SET vin_percom = $1 WHERE vin_codigo = $2 AND vin_industria = $3`,
      [vin_percom, id, industryId]
    );
    res.json({ success: true, message: 'Comissão atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [SELLERS] industries update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/sellers/:id/industries/:industryId ──────────────────────────
export async function deleteSellerIndustryHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const industryId = parseInt(String(req.params.industryId));

    await db.query(
      `DELETE FROM vendedor_ind WHERE vin_codigo = $1 AND vin_industria = $2`,
      [id, industryId]
    );
    res.json({ success: true, message: 'Indústria removida.' });
  } catch (error: any) {
    console.error('❌ [SELLERS] industries delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellers/:id/regions ────────────────────────────────────────────
export async function listSellerRegionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const result = await db.query(`
      SELECT vr.vin_codigo, vr.vin_regiao, r.reg_descricao AS reg_nome, r.reg_codigo
      FROM vendedor_reg vr
      INNER JOIN regioes r ON r.reg_codigo = vr.vin_regiao
      WHERE vr.vin_codigo = $1
      ORDER BY r.reg_descricao
    `, [id]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLERS] regions list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/sellers/:id/regions ───────────────────────────────────────────
export async function addSellerRegionHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const { vin_regiao } = req.body;

    if (!vin_regiao) {
      res.status(400).json({ success: false, message: 'Região é obrigatória.' });
      return;
    }

    await db.query(
      `INSERT INTO vendedor_reg (vin_codigo, vin_regiao) VALUES ($1, $2)`,
      [id, vin_regiao]
    );
    res.json({ success: true, message: 'Região vinculada com sucesso!' });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ success: false, message: 'Esta região já está vinculada ao vendedor.' });
      return;
    }
    console.error('❌ [SELLERS] regions add:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/sellers/:id/regions/:regionId ───────────────────────────────
export async function deleteSellerRegionHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const regionId = parseInt(String(req.params.regionId));

    await db.query(
      `DELETE FROM vendedor_reg WHERE vin_codigo = $1 AND vin_regiao = $2`,
      [id, regionId]
    );
    res.json({ success: true, message: 'Região removida.' });
  } catch (error: any) {
    console.error('❌ [SELLERS] regions delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellers/:id/metas ──────────────────────────────────────────────
export async function listSellerMetasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const { ano } = req.query;

    let query = `
      SELECT vm.met_id, vm.met_ano, vm.met_industria, vm.met_vendedor,
             vm.met_jan, vm.met_fev, vm.met_mar, vm.met_abr, vm.met_mai, vm.met_jun,
             vm.met_jul, vm.met_ago, vm.met_set, vm.met_out, vm.met_nov, vm.met_dez,
             f.for_nomered AS industria_nome
      FROM vend_metas vm
      LEFT JOIN fornecedores f ON f.for_codigo = vm.met_industria
      WHERE vm.met_vendedor = $1
    `;
    const params: any[] = [id];

    if (ano) {
      params.push(parseInt(String(ano)));
      query += ` AND vm.met_ano = $2`;
    }

    query += ` ORDER BY vm.met_ano DESC, f.for_nomered`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLERS] metas list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/sellers/:id/metas ─────────────────────────────────────────────
export async function createSellerMetaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const { met_ano, met_industria, ...months } = req.body;

    if (!met_ano || !met_industria) {
      res.status(400).json({ success: false, message: 'Ano e indústria são obrigatórios.' });
      return;
    }

    // Verificar duplicidade
    const dup = await db.query(
      `SELECT met_id FROM vend_metas WHERE met_vendedor=$1 AND met_ano=$2 AND met_industria=$3`,
      [id, met_ano, met_industria]
    );
    if (dup.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Já existe uma meta para este ano e indústria.' });
      return;
    }

    const result = await db.query(`
      INSERT INTO vend_metas (
        met_vendedor, met_ano, met_industria,
        met_jan, met_fev, met_mar, met_abr, met_mai, met_jun,
        met_jul, met_ago, met_set, met_out, met_nov, met_dez
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING met_id
    `, [
      id, met_ano, met_industria,
      ...MONTHS.map(m => months[`met_${m}`] || 0),
    ]);

    res.json({ success: true, message: 'Meta criada com sucesso!', id: result.rows[0].met_id });
  } catch (error: any) {
    console.error('❌ [SELLERS] metas create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/sellers/:id/metas/:metaId ──────────────────────────────────────
export async function updateSellerMetaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const metaId = parseInt(String(req.params.metaId));
    const months = req.body;

    await db.query(`
      UPDATE vend_metas SET
        met_jan=$1, met_fev=$2, met_mar=$3, met_abr=$4, met_mai=$5, met_jun=$6,
        met_jul=$7, met_ago=$8, met_set=$9, met_out=$10, met_nov=$11, met_dez=$12
      WHERE met_id=$13
    `, [...MONTHS.map(m => months[`met_${m}`] || 0), metaId]);

    res.json({ success: true, message: 'Meta atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [SELLERS] metas update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/sellers/:id/metas/:metaId ───────────────────────────────────
export async function deleteSellerMetaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const metaId = parseInt(String(req.params.metaId));
    await db.query(`DELETE FROM vend_metas WHERE met_id = $1`, [metaId]);
    res.json({ success: true, message: 'Meta removida.' });
  } catch (error: any) {
    console.error('❌ [SELLERS] metas delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
