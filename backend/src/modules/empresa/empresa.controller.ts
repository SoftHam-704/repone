import { Request, Response } from 'express';

// ─── GET /api/empresa ─────────────────────────────────────────────────────────
export async function getEmpresaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT emp_id, emp_situacao, emp_nome, emp_endereco, emp_bairro,
              emp_cidade, emp_uf, emp_cep, emp_cnpj, emp_inscricao,
              emp_fones, emp_logotipo
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
      emp_fones, emp_logotipo,
    } = req.body;

    // Garantir que coluna logotipo suporta Base64 (TEXT)
    await db.query(`ALTER TABLE empresa_status ALTER COLUMN emp_logotipo TYPE TEXT`).catch(() => {});

    const check = await db.query(`SELECT emp_id FROM empresa_status WHERE emp_id = 1`);

    if (check.rows.length > 0) {
      await db.query(`
        UPDATE empresa_status SET
          emp_situacao=$1, emp_nome=$2, emp_endereco=$3, emp_bairro=$4,
          emp_cidade=$5, emp_uf=$6, emp_cep=$7, emp_cnpj=$8,
          emp_inscricao=$9, emp_fones=$10, emp_logotipo=$11
        WHERE emp_id = 1
      `, [emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj,
          emp_inscricao, emp_fones, emp_logotipo]);
    } else {
      await db.query(`
        INSERT INTO empresa_status (
          emp_id, emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj, emp_inscricao,
          emp_fones, emp_logotipo
        ) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj,
          emp_inscricao, emp_fones, emp_logotipo]);
    }

    res.json({ success: true, message: 'Configurações salvas com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
