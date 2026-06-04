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
              COALESCE(emp_carteira_por_vendedor, true) AS emp_carteira_por_vendedor
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
    } = req.body;

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
          emp_carteira_por_vendedor=COALESCE($13::boolean, emp_carteira_por_vendedor)
        WHERE emp_id = 1
      `, [emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj,
          emp_inscricao, emp_fones, emp_logotipo, modoVend, carteiraPorVend]);
    } else {
      await db.query(`
        INSERT INTO empresa_status (
          emp_id, emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj, emp_inscricao,
          emp_fones, emp_logotipo, emp_mapas_modo_vendedor, emp_carteira_por_vendedor
        ) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::varchar,COALESCE($13::boolean, true))
      `, [emp_situacao, emp_nome, emp_endereco, emp_bairro,
          emp_cidade, emp_uf, emp_cep, emp_cnpj,
          emp_inscricao, emp_fones, emp_logotipo, modoVend, carteiraPorVend]);
    }

    res.json({ success: true, message: 'Configurações salvas com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
