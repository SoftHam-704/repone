import { Request, Response } from 'express';
import { lancarBaixaNoCaixa } from '../livro-caixa/livro-caixa.controller';

// ─── helpers ─────────────────────────────────────────────────────────────────
function err(res: Response, e: any, ctx = '') {
  console.error(`❌ [FINANCEIRO]${ctx ? ' ' + ctx : ''}:`, e?.message ?? e);
  res.status(500).json({ success: false, message: e?.message ?? 'Erro interno' });
}

// ════════════════════════════════════════════════════════════════════
// PLANO DE CONTAS
// ════════════════════════════════════════════════════════════════════

export async function listPlanoContasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(`
      SELECT id, codigo, descricao, tipo, nivel, id_pai, ativo
      FROM fin_plano_contas
      WHERE ativo = true
      ORDER BY codigo
    `);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list plano-contas'); }
}

export async function createPlanoContasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { codigo, descricao, tipo, nivel, id_pai } = req.body;
    const result = await db.query(`
      INSERT INTO fin_plano_contas (codigo, descricao, tipo, nivel, id_pai)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [codigo, descricao, tipo, nivel, id_pai || null]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'create plano-contas'); }
}

export async function updatePlanoContasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { codigo, descricao, tipo, nivel, id_pai, ativo } = req.body;
    const result = await db.query(`
      UPDATE fin_plano_contas
      SET codigo=$1, descricao=$2, tipo=$3, nivel=$4, id_pai=$5, ativo=$6
      WHERE id=$7 RETURNING *
    `, [codigo, descricao, tipo, nivel, id_pai || null, ativo, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'update plano-contas'); }
}

export async function deletePlanoContasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('UPDATE fin_plano_contas SET ativo = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Conta inativada com sucesso' });
  } catch (e) { err(res, e, 'delete plano-contas'); }
}

// ════════════════════════════════════════════════════════════════════
// CENTRO DE CUSTO
// ════════════════════════════════════════════════════════════════════

export async function listCentroCustoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(`
      SELECT id, codigo, descricao, ativo
      FROM fin_centro_custo
      WHERE ativo = true
      ORDER BY descricao
    `);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list centro-custo'); }
}

export async function createCentroCustoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { codigo, descricao } = req.body;
    const query = codigo
      ? 'INSERT INTO fin_centro_custo (codigo, descricao) VALUES ($1, $2) RETURNING *'
      : 'INSERT INTO fin_centro_custo (descricao) VALUES ($1) RETURNING *';
    const params = codigo ? [codigo, descricao] : [descricao];
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'create centro-custo'); }
}

export async function updateCentroCustoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { codigo, descricao, ativo } = req.body;
    const result = await db.query(`
      UPDATE fin_centro_custo SET codigo=$1, descricao=$2, ativo=$3 WHERE id=$4 RETURNING *
    `, [codigo, descricao, ativo, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'update centro-custo'); }
}

export async function deleteCentroCustoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('UPDATE fin_centro_custo SET ativo = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Centro de custo inativado com sucesso' });
  } catch (e) { err(res, e, 'delete centro-custo'); }
}

// ════════════════════════════════════════════════════════════════════
// CLIENTES FINANCEIROS
// ════════════════════════════════════════════════════════════════════

export async function listFinClientsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { search } = req.query as Record<string, string>;
    let query = `
      SELECT id, tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, cidade, uf, telefone, celular, email, ativo
      FROM fin_clientes WHERE ativo = true
    `;
    const params: any[] = [];
    if (search) { query += ` AND (nome_razao ILIKE $1 OR cpf_cnpj ILIKE $1)`; params.push(`%${search}%`); }
    query += ` ORDER BY nome_razao LIMIT 100`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list fin-clientes'); }
}

export async function createFinClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes } = req.body;
    const result = await db.query(`
      INSERT INTO fin_clientes (tipo_pessoa,cpf_cnpj,nome_razao,nome_fantasia,endereco,numero,complemento,bairro,cidade,uf,cep,telefone,celular,email,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'create fin-cliente'); }
}

export async function updateFinClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes, ativo } = req.body;
    const result = await db.query(`
      UPDATE fin_clientes SET tipo_pessoa=$1,cpf_cnpj=$2,nome_razao=$3,nome_fantasia=$4,
        endereco=$5,numero=$6,complemento=$7,bairro=$8,cidade=$9,uf=$10,cep=$11,
        telefone=$12,celular=$13,email=$14,observacoes=$15,ativo=$16
      WHERE id=$17 RETURNING *
    `, [tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes, ativo, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'update fin-cliente'); }
}

export async function getFinClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const result = await db.query('SELECT * FROM fin_clientes WHERE id = $1', [id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Cliente não encontrado' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'get fin-cliente'); }
}

export async function deleteFinClientHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('UPDATE fin_clientes SET ativo = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Cliente inativado com sucesso' });
  } catch (e) { err(res, e, 'delete fin-cliente'); }
}

// ════════════════════════════════════════════════════════════════════
// FORNECEDORES FINANCEIROS
// ════════════════════════════════════════════════════════════════════

export async function listFinSuppliersHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { search } = req.query as Record<string, string>;
    let query = `
      SELECT id, tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, cidade, uf, telefone, celular, email, ativo
      FROM fin_fornecedores WHERE ativo = true
    `;
    const params: any[] = [];
    if (search) { query += ` AND (nome_razao ILIKE $1 OR cpf_cnpj ILIKE $1)`; params.push(`%${search}%`); }
    query += ` ORDER BY nome_razao LIMIT 100`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list fin-fornecedores'); }
}

export async function createFinSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes } = req.body;
    const result = await db.query(`
      INSERT INTO fin_fornecedores (tipo_pessoa,cpf_cnpj,nome_razao,nome_fantasia,endereco,numero,complemento,bairro,cidade,uf,cep,telefone,celular,email,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'create fin-fornecedor'); }
}

export async function updateFinSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes, ativo } = req.body;
    const result = await db.query(`
      UPDATE fin_fornecedores SET tipo_pessoa=$1,cpf_cnpj=$2,nome_razao=$3,nome_fantasia=$4,
        endereco=$5,numero=$6,complemento=$7,bairro=$8,cidade=$9,uf=$10,cep=$11,
        telefone=$12,celular=$13,email=$14,observacoes=$15,ativo=$16
      WHERE id=$17 RETURNING *
    `, [tipo_pessoa, cpf_cnpj, nome_razao, nome_fantasia, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, celular, email, observacoes, ativo, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'update fin-fornecedor'); }
}

export async function getFinSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const result = await db.query('SELECT * FROM fin_fornecedores WHERE id = $1', [id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Fornecedor não encontrado' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'get fin-fornecedor'); }
}

export async function deleteFinSupplierHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('UPDATE fin_fornecedores SET ativo = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Fornecedor inativado com sucesso' });
  } catch (e) { err(res, e, 'delete fin-fornecedor'); }
}

// ════════════════════════════════════════════════════════════════════
// CONTAS A PAGAR
// ════════════════════════════════════════════════════════════════════

export async function listContasPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { dataInicio, dataFim, status, idFornecedor, idPlanoContas, idCentroCusto, filtrarPor } = req.query as Record<string, string>;
    const params: any[] = [];
    let i = 1;
    let query: string;

    if (filtrarPor === 'pagamento') {
      // Modo PAGAMENTO: o que foi efetivamente PAGO (baixa integral OU parcial) no período.
      // pago_periodo = soma das BAIXAS do ledger com data no intervalo (pega parciais, que ficam
      // ABERTO com data_pagamento NULL na parcela). Filtro pela DATA DO PAGAMENTO.
      const subConds: string[] = [`b.valor_pago > 0`];
      if (dataInicio) { subConds.push(`b.data >= $${i++}`); params.push(dataInicio); }
      if (dataFim)    { subConds.push(`b.data <= $${i++}`); params.push(dataFim); }

      const outConds: string[] = [];
      if (status)        { outConds.push(`cp.status = $${i++}`);          params.push(status); }
      if (idFornecedor)  { outConds.push(`cp.id_fornecedor = $${i++}`);   params.push(idFornecedor); }
      if (idPlanoContas) { outConds.push(`cp.id_plano_contas = $${i++}`); params.push(idPlanoContas); }
      if (idCentroCusto) { outConds.push(`cp.id_centro_custo = $${i++}`); params.push(idCentroCusto); }

      query = `
        SELECT cp.id, cp.descricao, cp.numero_documento, cp.valor_total, cp.valor_pago,
               cp.data_emissao, cp.data_vencimento, cp.data_pagamento, cp.status, cp.observacoes,
               f.nome_razao AS fornecedor_nome,
               pc.descricao AS plano_contas_descricao,
               cc.descricao AS centro_custo_descricao,
               (cp.valor_total - cp.valor_pago) AS saldo,
               per.pago_periodo
        FROM fin_contas_pagar cp
        JOIN (
          SELECT pp.id_conta_pagar,
                 SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_pago ELSE -b.valor_pago END) AS pago_periodo
          FROM fin_baixas_pagar b
          JOIN fin_parcelas_pagar pp ON pp.id = b.id_parcela
          WHERE ${subConds.join(' AND ')}
          GROUP BY pp.id_conta_pagar
          HAVING SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_pago ELSE -b.valor_pago END) <> 0
        ) per ON per.id_conta_pagar = cp.id
        LEFT JOIN fin_fornecedores f  ON cp.id_fornecedor  = f.id
        LEFT JOIN fin_plano_contas pc ON cp.id_plano_contas = pc.id
        LEFT JOIN fin_centro_custo cc ON cp.id_centro_custo = cc.id
        ${outConds.length ? 'WHERE ' + outConds.join(' AND ') : ''}
        ORDER BY cp.data_vencimento DESC, cp.id DESC
      `;
    } else {
      // Modo VENCIMENTO (padrão): contas que têm PARCELAS vencendo no período.
      // venc_periodo = saldo das parcelas (em aberto) que vencem no intervalo — o valor REAL do
      // período. NÃO usa o valor_total da conta (que pode ter parcelas em vários meses).
      const subConds: string[] = [`pp.status = 'ABERTO'`];
      if (dataInicio) { subConds.push(`pp.data_vencimento >= $${i++}`); params.push(dataInicio); }
      if (dataFim)    { subConds.push(`pp.data_vencimento <= $${i++}`); params.push(dataFim); }

      const outConds: string[] = [];
      if (status)        { outConds.push(`cp.status = $${i++}`);          params.push(status); }
      if (idFornecedor)  { outConds.push(`cp.id_fornecedor = $${i++}`);   params.push(idFornecedor); }
      if (idPlanoContas) { outConds.push(`cp.id_plano_contas = $${i++}`); params.push(idPlanoContas); }
      if (idCentroCusto) { outConds.push(`cp.id_centro_custo = $${i++}`); params.push(idCentroCusto); }

      query = `
        SELECT cp.id, cp.descricao, cp.numero_documento, cp.valor_total, cp.valor_pago,
               cp.data_emissao, cp.data_vencimento, cp.data_pagamento, cp.status, cp.observacoes,
               f.nome_razao AS fornecedor_nome,
               pc.descricao AS plano_contas_descricao,
               cc.descricao AS centro_custo_descricao,
               (cp.valor_total - COALESCE(cp.valor_pago,0)) AS saldo,
               per.venc_periodo
        FROM fin_contas_pagar cp
        JOIN (
          SELECT pp.id_conta_pagar,
                 SUM(pp.valor - COALESCE(pp.valor_pago,0)) AS venc_periodo
          FROM fin_parcelas_pagar pp
          WHERE ${subConds.join(' AND ')}
          GROUP BY pp.id_conta_pagar
          HAVING SUM(pp.valor - COALESCE(pp.valor_pago,0)) > 0
        ) per ON per.id_conta_pagar = cp.id
        LEFT JOIN fin_fornecedores f  ON cp.id_fornecedor  = f.id
        LEFT JOIN fin_plano_contas pc ON cp.id_plano_contas = pc.id
        LEFT JOIN fin_centro_custo cc ON cp.id_centro_custo = cc.id
        ${outConds.length ? 'WHERE ' + outConds.join(' AND ') : ''}
        ORDER BY cp.data_vencimento DESC, cp.id DESC
      `;
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list contas-pagar'); }
}

// GET /contas-pagar/relatorio — relatório por Centro de Custo (parcelas), respeitando os filtros.
// Cada parcela é uma linha; o front agrupa por centro e pinta as PAGAS de amarelo (a "planilha da Lorena").
export async function relatorioContasPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { dataInicio, dataFim, status, idFornecedor, idCentroCusto } = req.query as Record<string, string>;
    const params: any[] = [];
    let i = 1;
    const conds: string[] = [];
    if (dataInicio) { conds.push(`p.data_vencimento >= $${i++}`); params.push(dataInicio); }
    if (dataFim)    { conds.push(`p.data_vencimento <= $${i++}`); params.push(dataFim); }
    if (status && (status === 'ABERTO' || status === 'PAGO')) { conds.push(`p.status = $${i++}`); params.push(status); }
    if (idFornecedor)  { conds.push(`cp.id_fornecedor = $${i++}`);  params.push(idFornecedor); }
    if (idCentroCusto) { conds.push(`cp.id_centro_custo = $${i++}`); params.push(idCentroCusto); }
    const where = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const r = await db.query(`
      SELECT COALESCE(NULLIF(TRIM(cc.descricao), ''), '(Sem centro de custo)') AS centro_custo,
             cc.codigo                                   AS centro_codigo,
             COALESCE(NULLIF(TRIM(f.nome_razao), ''), '(Sem fornecedor)') AS fornecedor,
             cp.descricao                                AS conta_descricao,
             cp.numero_documento                         AS numero_documento,
             p.id                                        AS parcela_id,
             p.numero_parcela                            AS numero_parcela,
             p.data_vencimento                           AS data_vencimento,
             p.data_pagamento                            AS data_pagamento,
             p.valor::numeric                            AS valor,
             COALESCE(p.valor_pago,0)::numeric           AS pago,
             (p.valor - COALESCE(p.valor_pago,0))::numeric AS saldo,
             p.status                                    AS status
      FROM fin_parcelas_pagar p
      JOIN fin_contas_pagar cp ON cp.id = p.id_conta_pagar
      LEFT JOIN fin_fornecedores f  ON cp.id_fornecedor  = f.id
      LEFT JOIN fin_centro_custo cc ON cp.id_centro_custo = cc.id
      WHERE 1=1 ${where}
      ORDER BY centro_custo, fornecedor, p.data_vencimento, p.numero_parcela
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'relatorio contas-pagar'); }
}

export async function getContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const conta = await db.query(`
      SELECT cp.*, f.nome_razao AS fornecedor_nome,
             pc.descricao AS plano_contas_descricao,
             cc.descricao AS centro_custo_descricao
      FROM fin_contas_pagar cp
      LEFT JOIN fin_fornecedores f  ON cp.id_fornecedor  = f.id
      LEFT JOIN fin_plano_contas pc ON cp.id_plano_contas = pc.id
      LEFT JOIN fin_centro_custo cc ON cp.id_centro_custo = cc.id
      WHERE cp.id = $1
    `, [id]);
    if (!conta.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    const parcelas = await db.query(`SELECT * FROM fin_parcelas_pagar WHERE id_conta_pagar = $1 ORDER BY numero_parcela`, [id]);
    res.json({ success: true, data: { ...conta.rows[0], parcelas: parcelas.rows } });
  } catch (e) { err(res, e, 'get conta-pagar'); }
}

export async function createContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { descricao, id_fornecedor, numero_documento, data_emissao, data_vencimento,
            observacoes, id_plano_contas, id_centro_custo,
            numero_parcelas = 1, intervalo_dias = 30,
            parcelas: parcelasExplicitas } = req.body;
    let { valor_total } = req.body;
    const criado_por = req.user?.userId ?? null;

    // Se vieram parcelas explícitas do editor, o valor_total é a soma delas
    const temParcelasExplicitas = Array.isArray(parcelasExplicitas) && parcelasExplicitas.length > 0;
    if (temParcelasExplicitas) {
      valor_total = parcelasExplicitas.reduce((s: number, p: any) => s + Number(p.valor), 0);
    }
    const valorTotalNum = Number(valor_total) || 0;
    const nParcelas = temParcelasExplicitas ? parcelasExplicitas.length : (Number(numero_parcelas) || 1);

    const conta = await db.transaction(async client => {
      const r = await client.query(`
        INSERT INTO fin_contas_pagar (descricao,id_fornecedor,numero_documento,valor_total,data_emissao,data_vencimento,observacoes,id_plano_contas,id_centro_custo,criado_por)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [descricao, id_fornecedor || null, numero_documento, valorTotalNum, data_emissao, data_vencimento,
          observacoes, id_plano_contas || null, id_centro_custo || null, criado_por]);
      const contaId = r.rows[0].id;

      if (temParcelasExplicitas) {
        for (const p of parcelasExplicitas) {
          await client.query(
            `INSERT INTO fin_parcelas_pagar (id_conta_pagar,numero_parcela,valor,data_vencimento) VALUES ($1,$2,$3,$4)`,
            [contaId, p.numero_parcela, Number(p.valor), p.data_vencimento]
          );
        }
      } else if (nParcelas > 1) {
        const valorParcela = parseFloat((valorTotalNum / nParcelas).toFixed(2));
        let soma = 0;
        for (let i = 1; i <= nParcelas; i++) {
          const isUltima = i === nParcelas;
          const valor = isUltima ? valorTotalNum - soma : valorParcela;
          const dt = new Date(data_vencimento);
          dt.setDate(dt.getDate() + (i - 1) * Number(intervalo_dias));
          await client.query(
            `INSERT INTO fin_parcelas_pagar (id_conta_pagar,numero_parcela,valor,data_vencimento) VALUES ($1,$2,$3,$4)`,
            [contaId, i, valor, dt.toISOString().split('T')[0]]
          );
          soma += valor;
        }
      } else {
        await client.query(
          `INSERT INTO fin_parcelas_pagar (id_conta_pagar,numero_parcela,valor,data_vencimento) VALUES ($1,1,$2,$3)`,
          [contaId, valorTotalNum, data_vencimento]
        );
      }
      return r.rows[0];
    });

    res.json({ success: true, message: `Conta criada com ${nParcelas} parcela(s)`, data: conta });
  } catch (e) { err(res, e, 'create conta-pagar'); }
}

// PUT /contas-pagar/:id — edição completa (Hamilton 2026-05-25). Regenera as parcelas
// a partir do parcelas[] explícitas (editor) ou numero_parcelas+intervalo (fallback).
// Se a conta tinha pagamentos, estes são RESETADOS. Frontend mostra aviso antes.
// EDIT = só metadados do cabeçalho. As parcelas NÃO são tocadas (preserva o ledger de
// baixas/estornos e os lançamentos de caixa). O gerador de parcelas só existe no INSERT;
// para mudar valor/parcelas, exclua e recrie a conta.
export async function updateContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { descricao, id_fornecedor, numero_documento, data_emissao,
            observacoes, id_plano_contas, id_centro_custo } = req.body;

    const r = await db.query(`
      UPDATE fin_contas_pagar SET
        descricao = $1, id_fornecedor = $2, numero_documento = $3, data_emissao = $4,
        observacoes = $5, id_plano_contas = $6, id_centro_custo = $7
      WHERE id = $8 RETURNING *
    `, [descricao, id_fornecedor || null, numero_documento, data_emissao || null,
        observacoes, id_plano_contas || null, id_centro_custo || null, id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    res.json({ success: true, message: 'Conta atualizada', data: r.rows[0] });
  } catch (e) { err(res, e, 'update conta-pagar'); }
}

// ─── Conta Corrente da Parcela: recálculo derivado do ledger (fin_baixas_pagar) ───
// pago = Σ BAIXA.valor_pago − Σ ESTORNO.valor_pago (casa com a invariante da migration 069).
// quitada quando (pago + desconto líquido) cobre o valor da parcela.
async function recomputeParcelaFromLedger(client: any, idParcela: number): Promise<number> {
  const r = await client.query(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='BAIXA' THEN valor_pago ELSE -valor_pago END), 0) AS pago,
      COALESCE(SUM(CASE WHEN tipo='BAIXA' THEN desconto  ELSE -desconto  END), 0) AS descontos,
      MAX(CASE WHEN tipo='BAIXA' THEN data END)                                    AS ult_pgto
    FROM fin_baixas_pagar WHERE id_parcela = $1
  `, [idParcela]);
  const pago = Number(r.rows[0].pago) || 0;
  const desc = Number(r.rows[0].descontos) || 0;
  const ult  = r.rows[0].ult_pgto;
  const pr = await client.query('SELECT valor, id_conta_pagar FROM fin_parcelas_pagar WHERE id = $1', [idParcela]);
  const valor   = Number(pr.rows[0].valor) || 0;
  const idConta = pr.rows[0].id_conta_pagar;
  const quitada = (pago + desc) >= valor - 0.01 && (pago + desc) > 0;
  await client.query(
    `UPDATE fin_parcelas_pagar SET valor_pago = $1, status = $2, data_pagamento = $3 WHERE id = $4`,
    [pago, quitada ? 'PAGO' : 'ABERTO', quitada ? ult : null, idParcela]
  );
  return idConta;
}

async function recomputeContaFromParcelas(client: any, idConta: number): Promise<void> {
  const t = await client.query(`
    SELECT COUNT(*) AS total, COUNT(CASE WHEN status='PAGO' THEN 1 END) AS pagas,
           COALESCE(SUM(valor_pago),0) AS total_pago
    FROM fin_parcelas_pagar WHERE id_conta_pagar = $1
  `, [idConta]);
  const { total, pagas, total_pago } = t.rows[0];
  const status = parseInt(total) > 0 && parseInt(total) === parseInt(pagas) ? 'PAGO' : 'ABERTO';
  await client.query(`
    UPDATE fin_contas_pagar SET valor_pago = $1, status = $2,
      data_pagamento = CASE WHEN $2 = 'PAGO'
        THEN (SELECT MAX(data_pagamento) FROM fin_parcelas_pagar WHERE id_conta_pagar = $3)
        ELSE NULL END
    WHERE id = $3
  `, [total_pago, status, idConta]);
}

// POST /contas-pagar/:id/baixa — registra UMA baixa (integral ou parcial) no ledger.
// A parcela NÃO é mais sobrescrita: vira um movimento BAIXA que alimenta o caixa.
export async function baixaContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { id_parcela, data_pagamento, valor_pago, juros = 0, desconto = 0, observacoes, id_conta_caixa } = req.body;
    if (!id_conta_caixa) { res.status(400).json({ success: false, message: 'Informe a conta de caixa do pagamento.' }); return; }
    if (!data_pagamento) { res.status(400).json({ success: false, message: 'Informe a data do pagamento.' }); return; }
    if (!id_parcela)     { res.status(400).json({ success: false, message: 'Parcela inválida.' }); return; }
    if (!(Number(valor_pago) > 0)) { res.status(400).json({ success: false, message: 'O valor pago deve ser maior que zero.' }); return; }
    const valor_com_imposto = Number(req.body.valor_com_imposto) || 0;
    const valor_sem_imposto = Number(req.body.valor_sem_imposto) || 0;
    const userId = (req as any).user?.userId ?? (req as any).user?.id ?? null;

    await db.transaction(async client => {
      // 1) movimento BAIXA no ledger
      const ins = await client.query(`
        INSERT INTO fin_baixas_pagar
          (id_parcela, tipo, data, valor_pago, juros, desconto, valor_com_imposto, valor_sem_imposto,
           id_conta_caixa, observacoes, created_by)
        VALUES ($1,'BAIXA',$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [id_parcela, data_pagamento, Number(valor_pago), Number(juros), Number(desconto),
          valor_com_imposto, valor_sem_imposto, Number(id_conta_caixa), observacoes ?? null, userId]);
      const idBaixa = ins.rows[0].id;

      // 2) espelha no caixa (saída = valor_pago + juros) e linka pro extrato
      const valorCaixa = Number(valor_pago) + Number(juros);
      if (valorCaixa > 0) {
        const cab = await client.query(
          'SELECT descricao, numero_documento, id_plano_contas, id_centro_custo FROM fin_contas_pagar WHERE id=$1', [id]);
        const c = cab.rows[0] || {};
        const histDoc = c.numero_documento ? ` • Doc ${c.numero_documento}` : '';
        const idLanc = await lancarBaixaNoCaixa(client, {
          conta_id: Number(id_conta_caixa), data: data_pagamento, valor: valorCaixa,
          tipo: 'D', origem: 'CP', id_parcela_origem: Number(id_parcela),
          historico: `Pagto: ${c.descricao ?? 'conta a pagar'}${histDoc}`,
          id_plano_contas: c.id_plano_contas, id_centro_custo: c.id_centro_custo,
          documento: c.numero_documento ?? null,
        });
        await client.query('UPDATE fin_baixas_pagar SET id_lancamento_caixa = $1 WHERE id = $2', [idLanc, idBaixa]);
      }

      // 3) recalcula parcela + conta a partir do ledger (sem resíduo)
      const idConta = await recomputeParcelaFromLedger(client, Number(id_parcela));
      await recomputeContaFromParcelas(client, idConta);
    });

    // Aviso de teto "com imposto" do mês (só avisa, nunca trava). 0 = desligado.
    let aviso_teto_imposto: { teto: number; acumulado: number } | null = null;
    try {
      const cfg = await db.query('SELECT COALESCE(emp_teto_com_imposto_mensal,0) AS teto FROM empresa_status WHERE emp_id=1 LIMIT 1');
      const teto = Number(cfg.rows[0]?.teto || 0);
      if (teto > 0 && valor_com_imposto > 0) {
        const acc = await db.query(`
          SELECT COALESCE(SUM(CASE WHEN tipo='BAIXA' THEN valor_com_imposto ELSE -valor_com_imposto END),0) AS acc
          FROM fin_baixas_pagar
          WHERE data >= date_trunc('month', $1::date)
            AND data <  date_trunc('month', $1::date) + INTERVAL '1 month'
        `, [data_pagamento]);
        const acumulado = Number(acc.rows[0].acc);
        if (acumulado > teto) aviso_teto_imposto = { teto, acumulado };
      }
    } catch { /* config ausente → sem aviso */ }

    res.json({ success: true, message: 'Pagamento registrado com sucesso', aviso_teto_imposto });
  } catch (e) { err(res, e, 'baixa conta-pagar'); }
}

// POST /contas-pagar/baixa/:idBaixa/estornar — estorna uma baixa, revertendo no caixa.
export async function estornoBaixaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { idBaixa } = req.params;
    const { data, observacoes } = req.body || {};
    const userId = (req as any).user?.userId ?? (req as any).user?.id ?? null;

    await db.transaction(async client => {
      const b = await client.query('SELECT * FROM fin_baixas_pagar WHERE id = $1', [idBaixa]);
      if (!b.rows.length) throw new Error('Baixa não encontrada.');
      const mov = b.rows[0];
      if (mov.tipo !== 'BAIXA') throw new Error('Só é possível estornar um pagamento (baixa).');
      const jaEst = await client.query('SELECT 1 FROM fin_baixas_pagar WHERE estorno_de = $1 LIMIT 1', [idBaixa]);
      if (jaEst.rows.length) throw new Error('Esta baixa já foi estornada.');

      const dataEstorno = data || new Date().toISOString().split('T')[0];

      // 1) movimento ESTORNO (espelha a baixa estornada)
      const ins = await client.query(`
        INSERT INTO fin_baixas_pagar
          (id_parcela, tipo, data, valor_pago, juros, desconto, valor_com_imposto, valor_sem_imposto,
           id_conta_caixa, estorno_de, observacoes, created_by)
        VALUES ($1,'ESTORNO',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `, [mov.id_parcela, dataEstorno, mov.valor_pago, mov.juros, mov.desconto,
          mov.valor_com_imposto, mov.valor_sem_imposto, mov.id_conta_caixa, idBaixa,
          observacoes ?? `Estorno do pagamento #${idBaixa}`, userId]);
      const idEst = ins.rows[0].id;

      // 2) reverte no caixa (entrada = valor_pago + juros)
      const valorCaixa = Number(mov.valor_pago) + Number(mov.juros);
      if (valorCaixa > 0 && mov.id_conta_caixa) {
        const idLanc = await lancarBaixaNoCaixa(client, {
          conta_id: Number(mov.id_conta_caixa), data: dataEstorno, valor: valorCaixa,
          tipo: 'C', origem: 'CP', id_parcela_origem: Number(mov.id_parcela),
          historico: `Estorno de pagamento (baixa #${idBaixa})`,
        });
        await client.query('UPDATE fin_baixas_pagar SET id_lancamento_caixa = $1 WHERE id = $2', [idLanc, idEst]);
      }

      // 3) recalcula parcela + conta
      const idConta = await recomputeParcelaFromLedger(client, Number(mov.id_parcela));
      await recomputeContaFromParcelas(client, idConta);
    });

    res.json({ success: true, message: 'Baixa estornada com sucesso' });
  } catch (e) { err(res, e, 'estorno baixa-pagar'); }
}

// GET /contas-pagar/:id/extrato — conta corrente: todos os movimentos (baixas/estornos) da conta.
export async function extratoContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const r = await db.query(`
      SELECT b.id, b.id_parcela, p.numero_parcela, b.tipo, b.data,
             b.valor_pago, b.juros, b.desconto,
             b.id_conta_caixa, cx.conta_nome AS caixa_nome, b.id_lancamento_caixa,
             b.estorno_de, b.observacoes, b.created_at,
             EXISTS (SELECT 1 FROM fin_baixas_pagar e WHERE e.estorno_de = b.id) AS estornada
      FROM fin_baixas_pagar b
      JOIN fin_parcelas_pagar p ON p.id = b.id_parcela
      LEFT JOIN livro_caixa_contas cx ON cx.id = b.id_conta_caixa
      WHERE p.id_conta_pagar = $1
      ORDER BY b.data DESC, b.id DESC
    `, [id]);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'extrato conta-pagar'); }
}

export async function deleteContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const deleted = await db.transaction(async client => {
      // As parcelas (inclusive pagas) serão apagadas → remove os lançamentos de caixa delas.
      await client.query(`
        DELETE FROM livro_caixa_lancamentos
        WHERE origem='CP' AND id_parcela_origem IN (SELECT id FROM fin_parcelas_pagar WHERE id_conta_pagar=$1)
      `, [id]);
      await client.query('DELETE FROM fin_parcelas_pagar WHERE id_conta_pagar = $1', [id]);
      const r = await client.query('DELETE FROM fin_contas_pagar WHERE id = $1 RETURNING id', [id]);
      return r.rows.length > 0;
    });
    if (!deleted) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    res.json({ success: true, message: 'Conta excluída com sucesso' });
  } catch (e) { err(res, e, 'delete conta-pagar'); }
}

// ════════════════════════════════════════════════════════════════════
// CONTAS A RECEBER
// ════════════════════════════════════════════════════════════════════

export async function listContasReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { dataInicio, dataFim, status, idCliente, idPlanoContas, idCentroCusto, filtrarPor } = req.query as Record<string, string>;
    const params: any[] = [];
    let i = 1;
    let query: string;

    if (filtrarPor === 'recebimento') {
      // Modo RECEBIMENTO: o que foi efetivamente RECEBIDO no período (do ledger — pega parciais).
      const subConds: string[] = [`b.valor_recebido > 0`];
      if (dataInicio) { subConds.push(`b.data >= $${i++}`); params.push(dataInicio); }
      if (dataFim)    { subConds.push(`b.data <= $${i++}`); params.push(dataFim); }
      const outConds: string[] = [];
      if (status)        { outConds.push(`cr.status = $${i++}`);          params.push(status); }
      if (idCliente)     { outConds.push(`cr.id_cliente = $${i++}`);      params.push(idCliente); }
      if (idPlanoContas) { outConds.push(`cr.id_plano_contas = $${i++}`); params.push(idPlanoContas); }
      if (idCentroCusto) { outConds.push(`cr.id_centro_custo = $${i++}`); params.push(idCentroCusto); }
      query = `
        SELECT cr.id, cr.descricao, cr.numero_documento, cr.valor_total, cr.valor_recebido,
               cr.data_emissao, cr.data_vencimento, cr.data_recebimento, cr.status, cr.observacoes,
               c.nome_razao AS cliente_nome, pc.descricao AS plano_contas_descricao,
               cc.descricao AS centro_custo_descricao,
               (cr.valor_total - cr.valor_recebido) AS saldo, per.recebido_periodo
        FROM fin_contas_receber cr
        JOIN (
          SELECT pr.id_conta_receber,
                 SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_recebido ELSE -b.valor_recebido END) AS recebido_periodo
          FROM fin_baixas_receber b
          JOIN fin_parcelas_receber pr ON pr.id = b.id_parcela
          WHERE ${subConds.join(' AND ')}
          GROUP BY pr.id_conta_receber
          HAVING SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_recebido ELSE -b.valor_recebido END) <> 0
        ) per ON per.id_conta_receber = cr.id
        LEFT JOIN fin_clientes c       ON cr.id_cliente     = c.id
        LEFT JOIN fin_plano_contas pc  ON cr.id_plano_contas = pc.id
        LEFT JOIN fin_centro_custo cc  ON cr.id_centro_custo = cc.id
        ${outConds.length ? 'WHERE ' + outConds.join(' AND ') : ''}
        ORDER BY cr.data_vencimento DESC, cr.id DESC
      `;
    } else {
      // Modo VENCIMENTO (padrão): contas que têm PARCELAS vencendo no período.
      // venc_periodo = saldo das parcelas (em aberto) que vencem no intervalo — o valor REAL do período.
      const subConds: string[] = [`pr.status = 'ABERTO'`];
      if (dataInicio) { subConds.push(`pr.data_vencimento >= $${i++}`); params.push(dataInicio); }
      if (dataFim)    { subConds.push(`pr.data_vencimento <= $${i++}`); params.push(dataFim); }
      const outConds: string[] = [];
      if (status)        { outConds.push(`cr.status = $${i++}`);          params.push(status); }
      if (idCliente)     { outConds.push(`cr.id_cliente = $${i++}`);      params.push(idCliente); }
      if (idPlanoContas) { outConds.push(`cr.id_plano_contas = $${i++}`); params.push(idPlanoContas); }
      if (idCentroCusto) { outConds.push(`cr.id_centro_custo = $${i++}`); params.push(idCentroCusto); }
      query = `
        SELECT cr.id, cr.descricao, cr.numero_documento, cr.valor_total, cr.valor_recebido,
               cr.data_emissao, cr.data_vencimento, cr.data_recebimento, cr.status, cr.observacoes,
               c.nome_razao AS cliente_nome,
               pc.descricao AS plano_contas_descricao,
               cc.descricao AS centro_custo_descricao,
               (cr.valor_total - COALESCE(cr.valor_recebido,0)) AS saldo,
               per.venc_periodo
        FROM fin_contas_receber cr
        JOIN (
          SELECT pr.id_conta_receber,
                 SUM(pr.valor - COALESCE(pr.valor_recebido,0)) AS venc_periodo
          FROM fin_parcelas_receber pr
          WHERE ${subConds.join(' AND ')}
          GROUP BY pr.id_conta_receber
          HAVING SUM(pr.valor - COALESCE(pr.valor_recebido,0)) > 0
        ) per ON per.id_conta_receber = cr.id
        LEFT JOIN fin_clientes c       ON cr.id_cliente     = c.id
        LEFT JOIN fin_plano_contas pc  ON cr.id_plano_contas = pc.id
        LEFT JOIN fin_centro_custo cc  ON cr.id_centro_custo = cc.id
        ${outConds.length ? 'WHERE ' + outConds.join(' AND ') : ''}
        ORDER BY cr.data_vencimento DESC, cr.id DESC
      `;
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list contas-receber'); }
}

export async function getContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const conta = await db.query(`
      SELECT cr.*, c.nome_razao AS cliente_nome,
             pc.descricao AS plano_contas_descricao,
             cc.descricao AS centro_custo_descricao
      FROM fin_contas_receber cr
      LEFT JOIN fin_clientes c       ON cr.id_cliente     = c.id
      LEFT JOIN fin_plano_contas pc  ON cr.id_plano_contas = pc.id
      LEFT JOIN fin_centro_custo cc  ON cr.id_centro_custo = cc.id
      WHERE cr.id = $1
    `, [id]);
    if (!conta.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    const parcelas = await db.query(`SELECT * FROM fin_parcelas_receber WHERE id_conta_receber = $1 ORDER BY numero_parcela`, [id]);
    res.json({ success: true, data: { ...conta.rows[0], parcelas: parcelas.rows } });
  } catch (e) { err(res, e, 'get conta-receber'); }
}

export async function createContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { descricao, id_cliente, numero_documento, data_emissao, data_vencimento,
            observacoes, id_plano_contas, id_centro_custo,
            numero_parcelas = 1, intervalo_dias = 30,
            parcelas: parcelasExplicitas } = req.body;
    let { valor_total } = req.body;
    const criado_por = req.user?.userId ?? null;

    // Se vieram parcelas explícitas do editor, o valor_total é a soma delas
    const temParcelasExplicitas = Array.isArray(parcelasExplicitas) && parcelasExplicitas.length > 0;
    if (temParcelasExplicitas) {
      valor_total = parcelasExplicitas.reduce((s: number, p: any) => s + Number(p.valor), 0);
    }
    const valorTotalNum = Number(valor_total) || 0;
    const nParcelas = temParcelasExplicitas ? parcelasExplicitas.length : (Number(numero_parcelas) || 1);

    const conta = await db.transaction(async client => {
      const r = await client.query(`
        INSERT INTO fin_contas_receber (descricao,id_cliente,numero_documento,valor_total,data_emissao,data_vencimento,observacoes,id_plano_contas,id_centro_custo,criado_por)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [descricao, id_cliente || null, numero_documento, valorTotalNum, data_emissao, data_vencimento,
          observacoes, id_plano_contas || null, id_centro_custo || null, criado_por]);
      const contaId = r.rows[0].id;

      if (temParcelasExplicitas) {
        for (const p of parcelasExplicitas) {
          await client.query(
            `INSERT INTO fin_parcelas_receber (id_conta_receber,numero_parcela,valor,data_vencimento) VALUES ($1,$2,$3,$4)`,
            [contaId, p.numero_parcela, Number(p.valor), p.data_vencimento]
          );
        }
      } else if (nParcelas > 1) {
        const valorParcela = parseFloat((valorTotalNum / nParcelas).toFixed(2));
        let soma = 0;
        for (let i = 1; i <= nParcelas; i++) {
          const isUltima = i === nParcelas;
          const valor = isUltima ? valorTotalNum - soma : valorParcela;
          const dt = new Date(data_vencimento);
          dt.setDate(dt.getDate() + (i - 1) * Number(intervalo_dias));
          await client.query(
            `INSERT INTO fin_parcelas_receber (id_conta_receber,numero_parcela,valor,data_vencimento) VALUES ($1,$2,$3,$4)`,
            [contaId, i, valor, dt.toISOString().split('T')[0]]
          );
          soma += valor;
        }
      } else {
        await client.query(
          `INSERT INTO fin_parcelas_receber (id_conta_receber,numero_parcela,valor,data_vencimento) VALUES ($1,1,$2,$3)`,
          [contaId, valorTotalNum, data_vencimento]
        );
      }
      return r.rows[0];
    });

    res.json({ success: true, message: `Conta criada com ${nParcelas} parcela(s)`, data: conta });
  } catch (e) { err(res, e, 'create conta-receber'); }
}

// PUT /contas-receber/:id — edição completa. Regenera as parcelas
// a partir de parcelas[] explícitas (editor) ou numero_parcelas+intervalo (fallback).
// Se a conta tinha recebimentos, estes são RESETADOS. Frontend mostra aviso antes.
// EDIT = só metadados do cabeçalho (espelho do Contas a Pagar). As parcelas NÃO são tocadas
// (preserva o ledger de baixas/estornos). Gerador de parcelas só no INSERT.
export async function updateContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { descricao, id_cliente, numero_documento, data_emissao,
            observacoes, id_plano_contas, id_centro_custo } = req.body;

    const r = await db.query(`
      UPDATE fin_contas_receber SET
        descricao = $1, id_cliente = $2, numero_documento = $3, data_emissao = $4,
        observacoes = $5, id_plano_contas = $6, id_centro_custo = $7
      WHERE id = $8 RETURNING *
    `, [descricao, id_cliente || null, numero_documento, data_emissao || null,
        observacoes, id_plano_contas || null, id_centro_custo || null, id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    res.json({ success: true, message: 'Conta atualizada', data: r.rows[0] });
  } catch (e) { err(res, e, 'update conta-receber'); }
}

// ─── Conta Corrente da Parcela (RECEBER): recálculo derivado do ledger fin_baixas_receber ───
async function recomputeParcelaReceberFromLedger(client: any, idParcela: number): Promise<number> {
  const r = await client.query(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='BAIXA' THEN valor_recebido ELSE -valor_recebido END), 0) AS recebido,
      COALESCE(SUM(CASE WHEN tipo='BAIXA' THEN desconto      ELSE -desconto      END), 0) AS descontos,
      MAX(CASE WHEN tipo='BAIXA' THEN data END)                                          AS ult_receb
    FROM fin_baixas_receber WHERE id_parcela = $1
  `, [idParcela]);
  const receb = Number(r.rows[0].recebido) || 0;
  const desc  = Number(r.rows[0].descontos) || 0;
  const ult   = r.rows[0].ult_receb;
  const pr = await client.query('SELECT valor, id_conta_receber FROM fin_parcelas_receber WHERE id = $1', [idParcela]);
  const valor   = Number(pr.rows[0].valor) || 0;
  const idConta = pr.rows[0].id_conta_receber;
  const quitada = (receb + desc) >= valor - 0.01 && (receb + desc) > 0;
  await client.query(
    `UPDATE fin_parcelas_receber SET valor_recebido = $1, status = $2, data_recebimento = $3 WHERE id = $4`,
    [receb, quitada ? 'RECEBIDO' : 'ABERTO', quitada ? ult : null, idParcela]
  );
  return idConta;
}

async function recomputeContaReceberFromParcelas(client: any, idConta: number): Promise<void> {
  const t = await client.query(`
    SELECT COUNT(*) AS total, COUNT(CASE WHEN status='RECEBIDO' THEN 1 END) AS recebidas,
           COALESCE(SUM(valor_recebido),0) AS total_recebido
    FROM fin_parcelas_receber WHERE id_conta_receber = $1
  `, [idConta]);
  const { total, recebidas, total_recebido } = t.rows[0];
  const status = parseInt(total) > 0 && parseInt(total) === parseInt(recebidas) ? 'RECEBIDO' : 'ABERTO';
  await client.query(`
    UPDATE fin_contas_receber SET valor_recebido = $1, status = $2,
      data_recebimento = CASE WHEN $2 = 'RECEBIDO'
        THEN (SELECT MAX(data_recebimento) FROM fin_parcelas_receber WHERE id_conta_receber = $3)
        ELSE NULL END
    WHERE id = $3
  `, [total_recebido, status, idConta]);
}

// POST /contas-receber/:id/baixa — registra UM recebimento (integral ou parcial) no ledger.
export async function baixaContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { id_parcela, data_recebimento, valor_recebido, juros = 0, desconto = 0, observacoes, id_conta_caixa } = req.body;
    if (!id_conta_caixa) { res.status(400).json({ success: false, message: 'Informe a conta de caixa do recebimento.' }); return; }
    if (!data_recebimento) { res.status(400).json({ success: false, message: 'Informe a data do recebimento.' }); return; }
    if (!id_parcela)      { res.status(400).json({ success: false, message: 'Parcela inválida.' }); return; }
    if (!(Number(valor_recebido) > 0)) { res.status(400).json({ success: false, message: 'O valor recebido deve ser maior que zero.' }); return; }
    const userId = (req as any).user?.userId ?? (req as any).user?.id ?? null;

    await db.transaction(async client => {
      const ins = await client.query(`
        INSERT INTO fin_baixas_receber
          (id_parcela, tipo, data, valor_recebido, juros, desconto, id_conta_caixa, observacoes, created_by)
        VALUES ($1,'BAIXA',$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
      `, [id_parcela, data_recebimento, Number(valor_recebido), Number(juros), Number(desconto),
          Number(id_conta_caixa), observacoes ?? null, userId]);
      const idBaixa = ins.rows[0].id;

      const valorCaixa = Number(valor_recebido) + Number(juros);
      if (valorCaixa > 0) {
        const cab = await client.query(
          'SELECT descricao, numero_documento, id_plano_contas, id_centro_custo FROM fin_contas_receber WHERE id=$1', [id]);
        const c = cab.rows[0] || {};
        const histDoc = c.numero_documento ? ` • Doc ${c.numero_documento}` : '';
        const idLanc = await lancarBaixaNoCaixa(client, {
          conta_id: Number(id_conta_caixa), data: data_recebimento, valor: valorCaixa,
          tipo: 'C', origem: 'CR', id_parcela_origem: Number(id_parcela),
          historico: `Receb: ${c.descricao ?? 'conta a receber'}${histDoc}`,
          id_plano_contas: c.id_plano_contas, id_centro_custo: c.id_centro_custo,
          documento: c.numero_documento ?? null,
        });
        await client.query('UPDATE fin_baixas_receber SET id_lancamento_caixa = $1 WHERE id = $2', [idLanc, idBaixa]);
      }

      const idConta = await recomputeParcelaReceberFromLedger(client, Number(id_parcela));
      await recomputeContaReceberFromParcelas(client, idConta);
    });

    res.json({ success: true, message: 'Recebimento registrado com sucesso' });
  } catch (e) { err(res, e, 'baixa conta-receber'); }
}

// POST /contas-receber/baixa/:idBaixa/estornar — estorna um recebimento, revertendo no caixa.
export async function estornoBaixaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { idBaixa } = req.params;
    const { data, observacoes } = req.body || {};
    const userId = (req as any).user?.userId ?? (req as any).user?.id ?? null;

    await db.transaction(async client => {
      const b = await client.query('SELECT * FROM fin_baixas_receber WHERE id = $1', [idBaixa]);
      if (!b.rows.length) throw new Error('Baixa não encontrada.');
      const mov = b.rows[0];
      if (mov.tipo !== 'BAIXA') throw new Error('Só é possível estornar um recebimento (baixa).');
      const jaEst = await client.query('SELECT 1 FROM fin_baixas_receber WHERE estorno_de = $1 LIMIT 1', [idBaixa]);
      if (jaEst.rows.length) throw new Error('Esta baixa já foi estornada.');

      const dataEstorno = data || new Date().toISOString().split('T')[0];
      const ins = await client.query(`
        INSERT INTO fin_baixas_receber
          (id_parcela, tipo, data, valor_recebido, juros, desconto, id_conta_caixa, estorno_de, observacoes, created_by)
        VALUES ($1,'ESTORNO',$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
      `, [mov.id_parcela, dataEstorno, mov.valor_recebido, mov.juros, mov.desconto,
          mov.id_conta_caixa, idBaixa, observacoes ?? `Estorno do recebimento #${idBaixa}`, userId]);
      const idEst = ins.rows[0].id;

      const valorCaixa = Number(mov.valor_recebido) + Number(mov.juros);
      if (valorCaixa > 0 && mov.id_conta_caixa) {
        const idLanc = await lancarBaixaNoCaixa(client, {
          conta_id: Number(mov.id_conta_caixa), data: dataEstorno, valor: valorCaixa,
          tipo: 'D', origem: 'CR', id_parcela_origem: Number(mov.id_parcela),
          historico: `Estorno de recebimento (baixa #${idBaixa})`,
        });
        await client.query('UPDATE fin_baixas_receber SET id_lancamento_caixa = $1 WHERE id = $2', [idLanc, idEst]);
      }

      const idConta = await recomputeParcelaReceberFromLedger(client, Number(mov.id_parcela));
      await recomputeContaReceberFromParcelas(client, idConta);
    });

    res.json({ success: true, message: 'Recebimento estornado com sucesso' });
  } catch (e) { err(res, e, 'estorno baixa-receber'); }
}

// GET /contas-receber/:id/extrato — conta corrente (movimentos) da conta.
export async function extratoContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const r = await db.query(`
      SELECT b.id, b.id_parcela, p.numero_parcela, b.tipo, b.data,
             b.valor_recebido, b.juros, b.desconto,
             b.id_conta_caixa, cx.conta_nome AS caixa_nome, b.id_lancamento_caixa,
             b.estorno_de, b.observacoes, b.created_at,
             EXISTS (SELECT 1 FROM fin_baixas_receber e WHERE e.estorno_de = b.id) AS estornada
      FROM fin_baixas_receber b
      JOIN fin_parcelas_receber p ON p.id = b.id_parcela
      LEFT JOIN livro_caixa_contas cx ON cx.id = b.id_conta_caixa
      WHERE p.id_conta_receber = $1
      ORDER BY b.data DESC, b.id DESC
    `, [id]);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'extrato conta-receber'); }
}

// GET /contas-receber/relatorio — relatório por Centro de Custo (parcelas), respeitando os filtros.
export async function relatorioContasReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { dataInicio, dataFim, status, idCliente, idCentroCusto } = req.query as Record<string, string>;
    const params: any[] = [];
    let i = 1;
    const conds: string[] = [];
    if (dataInicio) { conds.push(`p.data_vencimento >= $${i++}`); params.push(dataInicio); }
    if (dataFim)    { conds.push(`p.data_vencimento <= $${i++}`); params.push(dataFim); }
    if (status && (status === 'ABERTO' || status === 'RECEBIDO')) { conds.push(`p.status = $${i++}`); params.push(status); }
    if (idCliente)     { conds.push(`cr.id_cliente = $${i++}`);     params.push(idCliente); }
    if (idCentroCusto) { conds.push(`cr.id_centro_custo = $${i++}`); params.push(idCentroCusto); }
    const where = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const r = await db.query(`
      SELECT COALESCE(NULLIF(TRIM(cc.descricao), ''), '(Sem centro de custo)') AS centro_custo,
             cc.codigo                                   AS centro_codigo,
             COALESCE(NULLIF(TRIM(c.nome_razao), ''), '(Sem cliente)') AS cliente,
             cr.descricao                                AS conta_descricao,
             cr.numero_documento                         AS numero_documento,
             p.id                                        AS parcela_id,
             p.numero_parcela                            AS numero_parcela,
             p.data_vencimento                           AS data_vencimento,
             p.data_recebimento                          AS data_recebimento,
             p.valor::numeric                            AS valor,
             COALESCE(p.valor_recebido,0)::numeric       AS recebido,
             (p.valor - COALESCE(p.valor_recebido,0))::numeric AS saldo,
             p.status                                    AS status
      FROM fin_parcelas_receber p
      JOIN fin_contas_receber cr ON cr.id = p.id_conta_receber
      LEFT JOIN fin_clientes c      ON cr.id_cliente      = c.id
      LEFT JOIN fin_centro_custo cc ON cr.id_centro_custo = cc.id
      WHERE 1=1 ${where}
      ORDER BY centro_custo, cliente, p.data_vencimento, p.numero_parcela
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'relatorio contas-receber'); }
}

export async function deleteContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const deleted = await db.transaction(async client => {
      // As parcelas (inclusive recebidas) serão apagadas → remove os lançamentos de caixa delas.
      await client.query(`
        DELETE FROM livro_caixa_lancamentos
        WHERE origem='CR' AND id_parcela_origem IN (SELECT id FROM fin_parcelas_receber WHERE id_conta_receber=$1)
      `, [id]);
      await client.query('DELETE FROM fin_parcelas_receber WHERE id_conta_receber = $1', [id]);
      const r = await client.query('DELETE FROM fin_contas_receber WHERE id = $1 RETURNING id', [id]);
      return r.rows.length > 0;
    });
    if (!deleted) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    res.json({ success: true, message: 'Conta excluída com sucesso' });
  } catch (e) { err(res, e, 'delete conta-receber'); }
}

// ════════════════════════════════════════════════════════════════════
// RELATÓRIOS
// ════════════════════════════════════════════════════════════════════

export async function fluxoCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { dataInicio, dataFim, agrupamento = 'DIARIO' } = req.query as Record<string, string>;
    if (!dataInicio || !dataFim) { res.status(400).json({ success: false, message: 'dataInicio e dataFim são obrigatórios' }); return; }

    const ag = agrupamento.toUpperCase();
    const trunc = ag === 'MENSAL' ? 'month' : ag === 'SEMANAL' ? 'week' : 'day';
    const fmt   = ag === 'MENSAL' ? 'Mon/YY' : ag === 'SEMANAL' ? 'IYYY-IW' : 'DD/MM/YY';

    const result = await db.query(`
      WITH periodos AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS dia
      ),
      -- Fonte da verdade = ledger (fin_baixas_*): pega baixas integrais E parciais e desconta estornos.
      entradas AS (
        SELECT date_trunc('${trunc}', b.data::date) AS periodo,
               COALESCE(SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_recebido ELSE -b.valor_recebido END), 0) AS valor
        FROM fin_baixas_receber b
        WHERE b.data BETWEEN $1 AND $2
        GROUP BY 1
      ),
      saidas AS (
        SELECT date_trunc('${trunc}', b.data::date) AS periodo,
               COALESCE(SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_pago ELSE -b.valor_pago END), 0) AS valor
        FROM fin_baixas_pagar b
        WHERE b.data BETWEEN $1 AND $2
        GROUP BY 1
      ),
      agrupado AS (
        SELECT date_trunc('${trunc}', dia) AS periodo
        FROM periodos
        GROUP BY 1
      )
      SELECT
        to_char(a.periodo, '${fmt}') AS periodo,
        a.periodo AS data_ref,
        COALESCE(e.valor, 0) AS entradas,
        COALESCE(s.valor, 0) AS saidas,
        COALESCE(e.valor, 0) - COALESCE(s.valor, 0) AS saldo
      FROM agrupado a
      LEFT JOIN entradas e ON e.periodo = a.periodo
      LEFT JOIN saidas   s ON s.periodo = a.periodo
      ORDER BY a.periodo
    `, [dataInicio, dataFim]);

    // Saldo acumulado
    let acumulado = 0;
    const rows = result.rows.map((r: any) => {
      acumulado += parseFloat(r.saldo);
      return { ...r, saldo_acumulado: acumulado };
    });

    res.json({ success: true, data: rows });
  } catch (e) { err(res, e, 'fluxo-caixa'); }
}

export async function dreHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { mes, ano } = req.query as Record<string, string>;
    if (!mes || !ano) { res.status(400).json({ success: false, message: 'mes e ano são obrigatórios' }); return; }

    // DRE regime de CAIXA: o que foi efetivamente recebido/pago no mês (pela data da baixa no ledger),
    // por plano de contas. Captura baixas parciais e desconta estornos. NÃO usa o vencimento do
    // cabeçalho da conta (parcela vence em meses diferentes do header).
    const result = await db.query(`
      SELECT
        pc.tipo,
        pc.codigo,
        pc.descricao,
        COALESCE(SUM(mov.valor), 0) AS valor
      FROM fin_plano_contas pc
      LEFT JOIN (
        SELECT cr.id_plano_contas AS id_plano,
               (CASE WHEN b.tipo='BAIXA' THEN b.valor_recebido ELSE -b.valor_recebido END) AS valor
        FROM fin_baixas_receber b
        JOIN fin_parcelas_receber pr ON pr.id = b.id_parcela
        JOIN fin_contas_receber cr   ON cr.id = pr.id_conta_receber
        WHERE EXTRACT(MONTH FROM b.data) = $1 AND EXTRACT(YEAR FROM b.data) = $2
        UNION ALL
        SELECT cp.id_plano_contas,
               (CASE WHEN b.tipo='BAIXA' THEN b.valor_pago ELSE -b.valor_pago END) AS valor
        FROM fin_baixas_pagar b
        JOIN fin_parcelas_pagar pp ON pp.id = b.id_parcela
        JOIN fin_contas_pagar cp   ON cp.id = pp.id_conta_pagar
        WHERE EXTRACT(MONTH FROM b.data) = $1 AND EXTRACT(YEAR FROM b.data) = $2
      ) mov ON mov.id_plano = pc.id
      WHERE pc.ativo = true
      GROUP BY pc.tipo, pc.codigo, pc.descricao, pc.nivel
      HAVING COALESCE(SUM(mov.valor), 0) != 0 OR pc.nivel = 1
      ORDER BY pc.codigo
    `, [parseInt(mes), parseInt(ano)]);

    const receitas = result.rows.filter((r: any) => r.tipo === 'R');
    const despesas = result.rows.filter((r: any) => r.tipo === 'D');
    const totalReceitas = receitas.reduce((s: number, r: any) => s + parseFloat(r.valor || 0), 0);
    const totalDespesas = despesas.reduce((s: number, r: any) => s + parseFloat(r.valor || 0), 0);

    res.json({
      success: true,
      data: {
        receitas,
        despesas,
        totais: { receitas: totalReceitas, despesas: totalDespesas, resultado: totalReceitas - totalDespesas }
      }
    });
  } catch (e) { err(res, e, 'dre'); }
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ════════════════════════════════════════════════════════════════════

export async function financeiroDashboardHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const ano = parseInt(String(req.query.ano)) || new Date().getFullYear();
    const meses = String(req.query.meses || '').split(',').map(s => parseInt(s)).filter(n => n >= 1 && n <= 12);
    const mesesArr = meses.length ? meses : null;  // null = ano todo
    // IMPORTANTE: apura por PARCELA (data + saldo de cada parcela), não pelo cabeçalho da conta.
    // Conta parcelada tem 1 vencimento no header mas N parcelas em meses diferentes — usar o header
    // jogava o valor inteiro da conta no mês do cabeçalho (ex.: salário 7x caía 100% em junho).
    const perPag = `EXTRACT(YEAR FROM pp.data_vencimento) = $1 AND ($2::int[] IS NULL OR EXTRACT(MONTH FROM pp.data_vencimento) = ANY($2::int[]))`;
    const perRec = `EXTRACT(YEAR FROM pr.data_vencimento) = $1 AND ($2::int[] IS NULL OR EXTRACT(MONTH FROM pr.data_vencimento) = ANY($2::int[]))`;

    const [receber, pagar, porCentro] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN pr.status='ABERTO' AND pr.data_vencimento < CURRENT_DATE  THEN pr.valor - COALESCE(pr.valor_recebido,0) ELSE 0 END), 0) AS vencido,
          COALESCE(SUM(CASE WHEN pr.status='ABERTO' AND pr.data_vencimento = CURRENT_DATE  THEN pr.valor - COALESCE(pr.valor_recebido,0) ELSE 0 END), 0) AS hoje,
          COALESCE(SUM(CASE WHEN pr.status='ABERTO' AND pr.data_vencimento > CURRENT_DATE AND pr.data_vencimento <= CURRENT_DATE + 7 THEN pr.valor - COALESCE(pr.valor_recebido,0) ELSE 0 END), 0) AS prox_7_dias,
          COALESCE(SUM(CASE WHEN pr.status='ABERTO' THEN pr.valor - COALESCE(pr.valor_recebido,0) ELSE 0 END), 0) AS total_aberto
        FROM fin_parcelas_receber pr
        JOIN fin_contas_receber cr ON cr.id = pr.id_conta_receber
        WHERE cr.status <> 'CANCELADO' AND ${perRec}
      `, [ano, mesesArr]),
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN pp.status='ABERTO' AND pp.data_vencimento < CURRENT_DATE  THEN pp.valor - COALESCE(pp.valor_pago,0) ELSE 0 END), 0) AS vencido,
          COALESCE(SUM(CASE WHEN pp.status='ABERTO' AND pp.data_vencimento = CURRENT_DATE  THEN pp.valor - COALESCE(pp.valor_pago,0) ELSE 0 END), 0) AS hoje,
          COALESCE(SUM(CASE WHEN pp.status='ABERTO' AND pp.data_vencimento > CURRENT_DATE AND pp.data_vencimento <= CURRENT_DATE + 7 THEN pp.valor - COALESCE(pp.valor_pago,0) ELSE 0 END), 0) AS prox_7_dias,
          COALESCE(SUM(CASE WHEN pp.status='ABERTO' THEN pp.valor - COALESCE(pp.valor_pago,0) ELSE 0 END), 0) AS total_aberto
        FROM fin_parcelas_pagar pp
        JOIN fin_contas_pagar cp ON cp.id = pp.id_conta_pagar
        WHERE cp.status <> 'CANCELADO' AND ${perPag}
      `, [ano, mesesArr]),
      // Em aberto por Centro de Custo — também por PARCELA. Soma confere com os cards A Pagar / A Receber.
      db.query(`
        SELECT centro,
               COALESCE(SUM(receitas), 0)::numeric AS receitas,
               COALESCE(SUM(despesas), 0)::numeric AS despesas
        FROM (
          SELECT COALESCE(NULLIF(TRIM(cc.descricao), ''), '(Sem centro de custo)') AS centro,
                 (pr.valor - COALESCE(pr.valor_recebido,0)) AS receitas, 0 AS despesas
          FROM fin_parcelas_receber pr
          JOIN fin_contas_receber cr ON cr.id = pr.id_conta_receber
          LEFT JOIN fin_centro_custo cc ON cr.id_centro_custo = cc.id
          WHERE pr.status = 'ABERTO' AND cr.status <> 'CANCELADO' AND ${perRec}
          UNION ALL
          SELECT COALESCE(NULLIF(TRIM(cc.descricao), ''), '(Sem centro de custo)'),
                 0, (pp.valor - COALESCE(pp.valor_pago,0))
          FROM fin_parcelas_pagar pp
          JOIN fin_contas_pagar cp ON cp.id = pp.id_conta_pagar
          LEFT JOIN fin_centro_custo cc ON cp.id_centro_custo = cc.id
          WHERE pp.status = 'ABERTO' AND cp.status <> 'CANCELADO' AND ${perPag}
        ) t GROUP BY centro
        HAVING COALESCE(SUM(receitas), 0) > 0 OR COALESCE(SUM(despesas), 0) > 0
        ORDER BY (COALESCE(SUM(receitas), 0) + COALESCE(SUM(despesas), 0)) DESC
      `, [ano, mesesArr]),
    ]);

    const r = receber.rows[0];
    const p = pagar.rows[0];
    res.json({
      success: true,
      data: {
        receber: r,
        pagar: p,
        por_centro: porCentro.rows,
        saldo_previsto: parseFloat(r.total_aberto) - parseFloat(p.total_aberto),
      }
    });
  } catch (e) { err(res, e, 'dashboard'); }
}
