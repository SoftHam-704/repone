import { Request, Response } from 'express';

// ─── GET /api/empresa ─────────────────────────────────────────────────────────
export async function getEmpresaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT emp_id, emp_situacao, emp_nome, emp_endereco, emp_bairro,
              emp_cidade, emp_uf, emp_cep, emp_cnpj, emp_inscricao,
              emp_fones, emp_logotipo,
              COALESCE(emp_mapas_modo_vendedor, '1x1') AS emp_mapas_modo_vendedor,
              COALESCE(emp_carteira_por_vendedor, true) AS emp_carteira_por_vendedor,
              emp_im, emp_regime, emp_ibge, emp_nfse_ambiente,
              emp_nfse_proximo_numero, emp_nfse_serie,
              emp_ctribnac, emp_cnbs, emp_item_lc116, emp_ctribmun, emp_cnae, emp_iss_pct
       FROM empresa_status WHERE emp_id = 1 LIMIT 1`
    );
    if (!result.rows.length) {
      res.json({ success: true, data: null });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/empresa ─────────────────────────────────────────────────────────
export async function updateEmpresaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const {
      emp_situacao, emp_nome, emp_endereco, emp_bairro,
      emp_cidade, emp_uf, emp_cep, emp_cnpj, emp_inscricao,
      emp_fones, emp_logotipo, emp_mapas_modo_vendedor, emp_carteira_por_vendedor,
      // NFS-e (config fiscal)
      emp_im, emp_regime, emp_ibge, emp_nfse_ambiente,
      emp_nfse_proximo_numero, emp_nfse_serie,
      emp_ctribnac, emp_cnbs, emp_item_lc116, emp_ctribmun, emp_cnae, emp_iss_pct,
    } = req.body;

    // NFS-e: arrays p/ UPDATE (COALESCE preserva quando não enviado) e INSERT
    const nfseVals = [
      emp_im ?? null, emp_regime ?? null, emp_ibge ?? null, emp_nfse_ambiente ?? null,
      emp_nfse_proximo_numero ?? null, emp_nfse_serie ?? null,
      emp_ctribnac ?? null, emp_cnbs ?? null, emp_item_lc116 ?? null,
      emp_ctribmun ?? null, emp_cnae ?? null,
      emp_iss_pct === '' || emp_iss_pct == null ? null : Number(emp_iss_pct),
    ];

    // Normaliza o modo de vendedor dos mapas (só aceita 1x1 ou 1xN)
    const modoVend = emp_mapas_modo_vendedor === '1xN' ? '1xN' : '1x1';
    // Carteira por vendedor (BOOLEAN): true = operador vê só a sua carteira; false = todos atendem
    // todos. null quando não enviado → COALESCE preserva o valor atual (não reseta o damarep).
    const carteiraPorVend =
      emp_carteira_por_vendedor === false || emp_carteira_por_vendedor === 'false' ? false
      : emp_carteira_por_vendedor === true || emp_carteira_por_vendedor === 'true' ? true
      : null;

    // Garantir que coluna logotipo suporta Base64 (TEXT)
    await db.query(`ALTER TABLE empresa_status ALTER COLUMN emp_logotipo TYPE TEXT`).catch(() => {});

    const check = await db.query(`SELECT emp_id FROM empresa_status WHERE emp_id = 1`);

    if (check.rows.length > 0) {
      await db.query(`
        UPDATE empresa_status SET
          emp_situacao=$1, emp_nome=$2, emp_endereco=$3, emp_bairro=$4,
          emp_cidade=$5, emp_uf=$6, emp_cep=$7, emp_cnpj=$8,
          emp_inscricao=$9, emp_fones=$10, emp_logotipo=$11,
          emp_mapas_modo_vendedor=$12::varchar,
          emp_carteira_por_vendedor=COALESCE($13::boolean, emp_carteira_por_vendedor),
          emp_im=COALESCE($14, emp_im), emp_regime=COALESCE($15, emp_regime),
          emp_ibge=COALESCE($16, emp_ibge), emp_nfse_ambiente=COALESCE($17, emp_nfse_ambiente),
          emp_nfse_proximo_numero=COALESCE($18::integer, emp_nfse_proximo_numero),
          emp_nfse_serie=COALESCE($19, emp_nfse_serie),
          emp_ctribnac=COALESCE($20, emp_ctribnac), emp_cnbs=COALESCE($21, emp_cnbs),
          emp_item_lc116=COALESCE($22, emp_item_lc116), emp_ctribmun=COALESCE($23, emp_ctribmun),
          emp_cnae=COALESCE($24, emp_cnae), emp_iss_pct=COALESCE($25::numeric, emp_iss_pct)
        WHERE emp_id = 1
      `, [emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj,
          emp_inscricao, emp_fones, emp_logotipo, modoVend, carteiraPorVend, ...nfseVals]);
    } else {
      await db.query(`
        INSERT INTO empresa_status (
          emp_id, emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj, emp_inscricao,
          emp_fones, emp_logotipo, emp_mapas_modo_vendedor, emp_carteira_por_vendedor,
          emp_im, emp_regime, emp_ibge, emp_nfse_ambiente,
          emp_nfse_proximo_numero, emp_nfse_serie,
          emp_ctribnac, emp_cnbs, emp_item_lc116, emp_ctribmun, emp_cnae, emp_iss_pct
        ) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::varchar,COALESCE($13::boolean, true),
          $14,$15,$16,$17,$18::integer,$19,$20,$21,$22,$23,$24,$25::numeric)
      `, [emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj,
          emp_inscricao, emp_fones, emp_logotipo, modoVend, carteiraPorVend, ...nfseVals]);
    }

    res.json({ success: true, message: 'Configurações salvas com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
