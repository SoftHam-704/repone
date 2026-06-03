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
    const { dataInicio, dataFim, status, idFornecedor, idPlanoContas, idCentroCusto } = req.query as Record<string, string>;

    let query = `
      SELECT cp.id, cp.descricao, cp.numero_documento, cp.valor_total, cp.valor_pago,
             cp.data_emissao, cp.data_vencimento, cp.data_pagamento, cp.status, cp.observacoes,
             f.nome_razao AS fornecedor_nome,
             pc.descricao AS plano_contas_descricao,
             cc.descricao AS centro_custo_descricao,
             (cp.valor_total - cp.valor_pago) AS saldo
      FROM fin_contas_pagar cp
      LEFT JOIN fin_fornecedores f  ON cp.id_fornecedor  = f.id
      LEFT JOIN fin_plano_contas pc ON cp.id_plano_contas = pc.id
      LEFT JOIN fin_centro_custo cc ON cp.id_centro_custo = cc.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let i = 1;

    if (dataInicio)    { query += ` AND cp.data_vencimento >= $${i++}`; params.push(dataInicio); }
    if (dataFim)       { query += ` AND cp.data_vencimento <= $${i++}`; params.push(dataFim); }
    if (status)        { query += ` AND cp.status = $${i++}`;           params.push(status); }
    if (idFornecedor)  { query += ` AND cp.id_fornecedor = $${i++}`;    params.push(idFornecedor); }
    if (idPlanoContas) { query += ` AND cp.id_plano_contas = $${i++}`;  params.push(idPlanoContas); }
    if (idCentroCusto) { query += ` AND cp.id_centro_custo = $${i++}`;  params.push(idCentroCusto); }

    query += ` ORDER BY cp.data_vencimento DESC, cp.id DESC`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list contas-pagar'); }
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
export async function updateContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { descricao, id_fornecedor, numero_documento, data_emissao, data_vencimento,
            observacoes, id_plano_contas, id_centro_custo,
            numero_parcelas = 1, intervalo_dias = 30,
            parcelas: parcelasExplicitas } = req.body;
    let { valor_total } = req.body;

    // Se vieram parcelas explícitas do editor, o valor_total é a soma delas
    const temParcelasExplicitas = Array.isArray(parcelasExplicitas) && parcelasExplicitas.length > 0;
    if (temParcelasExplicitas) {
      valor_total = parcelasExplicitas.reduce((s: number, p: any) => s + Number(p.valor), 0);
    }
    const valorTotalNum = Number(valor_total) || 0;
    const nParcelas = temParcelasExplicitas ? parcelasExplicitas.length : (Number(numero_parcelas) || 1);

    const updated = await db.transaction(async client => {
      const r = await client.query(`
        UPDATE fin_contas_pagar SET
          descricao=$1, id_fornecedor=$2, numero_documento=$3, valor_total=$4,
          data_emissao=$5, data_vencimento=$6, observacoes=$7,
          id_plano_contas=$8, id_centro_custo=$9,
          valor_pago=0, status='ABERTO', data_pagamento=NULL
        WHERE id=$10 RETURNING *
      `, [descricao, id_fornecedor || null, numero_documento, valorTotalNum, data_emissao, data_vencimento,
          observacoes, id_plano_contas || null, id_centro_custo || null, id]);
      if (!r.rows.length) return null;

      // Regenera parcelas: apaga todas (inclusive pagas) e cria novas
      await client.query('DELETE FROM fin_parcelas_pagar WHERE id_conta_pagar = $1', [id]);

      if (temParcelasExplicitas) {
        for (const p of parcelasExplicitas) {
          await client.query(
            `INSERT INTO fin_parcelas_pagar (id_conta_pagar,numero_parcela,valor,data_vencimento) VALUES ($1,$2,$3,$4)`,
            [id, p.numero_parcela, Number(p.valor), p.data_vencimento]
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
            [id, i, valor, dt.toISOString().split('T')[0]]
          );
          soma += valor;
        }
      } else {
        await client.query(
          `INSERT INTO fin_parcelas_pagar (id_conta_pagar,numero_parcela,valor,data_vencimento) VALUES ($1,1,$2,$3)`,
          [id, valorTotalNum, data_vencimento]
        );
      }
      return r.rows[0];
    });

    if (!updated) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    res.json({ success: true, message: `Conta atualizada com ${nParcelas} parcela(s)`, data: updated });
  } catch (e) { err(res, e, 'update conta-pagar'); }
}

export async function baixaContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { id_parcela, data_pagamento, valor_pago, juros = 0, desconto = 0, observacoes, gerar_residuo = true, id_conta_caixa } = req.body;
    if (!id_conta_caixa) { res.status(400).json({ success: false, message: 'Informe a conta de caixa do pagamento.' }); return; }

    await db.transaction(async client => {
      await client.query(`
        UPDATE fin_parcelas_pagar
        SET data_pagamento=$1, valor_pago=$2, juros=$3, desconto=$4, status='PAGO', observacoes=$5
        WHERE id=$6
      `, [data_pagamento, valor_pago, juros, desconto, observacoes, id_parcela]);

      const orig = await client.query('SELECT valor FROM fin_parcelas_pagar WHERE id = $1', [id_parcela]);
      const residual = parseFloat(orig.rows[0].valor) - Number(valor_pago) - Number(desconto);

      if (gerar_residuo && residual > 0.01) {
        const maxNum = await client.query('SELECT MAX(numero_parcela) AS mx FROM fin_parcelas_pagar WHERE id_conta_pagar = $1', [id]);
        const nextNum = (maxNum.rows[0].mx || 0) + 1;
        await client.query(`
          INSERT INTO fin_parcelas_pagar (id_conta_pagar,numero_parcela,valor,data_vencimento,status)
          VALUES ($1,$2,$3,(SELECT data_vencimento FROM fin_parcelas_pagar WHERE id=$4),'ABERTO')
        `, [id, nextNum, residual, id_parcela]);
      }

      const totals = await client.query(`
        SELECT COUNT(*) AS total, COUNT(CASE WHEN status='PAGO' THEN 1 END) AS pagas, COALESCE(SUM(valor_pago),0) AS total_pago
        FROM fin_parcelas_pagar WHERE id_conta_pagar = $1
      `, [id]);
      const { total, pagas, total_pago } = totals.rows[0];
      const novStatus = parseInt(total) === parseInt(pagas) ? 'PAGO' : 'ABERTO';

      await client.query(`
        UPDATE fin_contas_pagar SET valor_pago=$1, status=$2::varchar,
          data_pagamento = CASE WHEN $2::varchar='PAGO' THEN $3::date ELSE NULL END
        WHERE id=$4
      `, [total_pago, novStatus, data_pagamento, id]);

      // Espelha o pagamento no Livro Caixa (débito). Dinheiro que saiu = valor_pago + juros.
      const cab = await client.query(
        'SELECT descricao, numero_documento, id_plano_contas, id_centro_custo FROM fin_contas_pagar WHERE id=$1', [id]);
      const c = cab.rows[0] || {};
      const histDoc = c.numero_documento ? ` • Doc ${c.numero_documento}` : '';
      await lancarBaixaNoCaixa(client, {
        conta_id: Number(id_conta_caixa),
        data: data_pagamento,
        valor: Number(valor_pago) + Number(juros),
        tipo: 'D', origem: 'CP', id_parcela_origem: Number(id_parcela),
        historico: `Pagto: ${c.descricao ?? 'conta a pagar'}${histDoc}`,
        id_plano_contas: c.id_plano_contas, id_centro_custo: c.id_centro_custo,
        documento: c.numero_documento ?? null,
      });
    });

    res.json({ success: true, message: 'Pagamento registrado com sucesso' });
  } catch (e) { err(res, e, 'baixa conta-pagar'); }
}

export async function deleteContaPagarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const deleted = await db.transaction(async client => {
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
    const { dataInicio, dataFim, status, idCliente, idPlanoContas, idCentroCusto } = req.query as Record<string, string>;

    let query = `
      SELECT cr.id, cr.descricao, cr.numero_documento, cr.valor_total, cr.valor_recebido,
             cr.data_emissao, cr.data_vencimento, cr.data_recebimento, cr.status, cr.observacoes,
             c.nome_razao AS cliente_nome,
             pc.descricao AS plano_contas_descricao,
             cc.descricao AS centro_custo_descricao,
             (cr.valor_total - cr.valor_recebido) AS saldo
      FROM fin_contas_receber cr
      LEFT JOIN fin_clientes c       ON cr.id_cliente     = c.id
      LEFT JOIN fin_plano_contas pc  ON cr.id_plano_contas = pc.id
      LEFT JOIN fin_centro_custo cc  ON cr.id_centro_custo = cc.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let i = 1;

    if (dataInicio)    { query += ` AND cr.data_vencimento >= $${i++}`; params.push(dataInicio); }
    if (dataFim)       { query += ` AND cr.data_vencimento <= $${i++}`; params.push(dataFim); }
    if (status)        { query += ` AND cr.status = $${i++}`;           params.push(status); }
    if (idCliente)     { query += ` AND cr.id_cliente = $${i++}`;       params.push(idCliente); }
    if (idPlanoContas) { query += ` AND cr.id_plano_contas = $${i++}`;  params.push(idPlanoContas); }
    if (idCentroCusto) { query += ` AND cr.id_centro_custo = $${i++}`;  params.push(idCentroCusto); }

    query += ` ORDER BY cr.data_vencimento DESC, cr.id DESC`;

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
export async function updateContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { descricao, id_cliente, numero_documento, data_emissao, data_vencimento,
            observacoes, id_plano_contas, id_centro_custo,
            numero_parcelas = 1, intervalo_dias = 30,
            parcelas: parcelasExplicitas } = req.body;
    let { valor_total } = req.body;

    // Se vieram parcelas explícitas do editor, o valor_total é a soma delas
    const temParcelasExplicitas = Array.isArray(parcelasExplicitas) && parcelasExplicitas.length > 0;
    if (temParcelasExplicitas) {
      valor_total = parcelasExplicitas.reduce((s: number, p: any) => s + Number(p.valor), 0);
    }
    const valorTotalNum = Number(valor_total) || 0;
    const nParcelas = temParcelasExplicitas ? parcelasExplicitas.length : (Number(numero_parcelas) || 1);

    const updated = await db.transaction(async client => {
      const r = await client.query(`
        UPDATE fin_contas_receber SET
          descricao=$1, id_cliente=$2, numero_documento=$3, valor_total=$4,
          data_emissao=$5, data_vencimento=$6, observacoes=$7,
          id_plano_contas=$8, id_centro_custo=$9,
          valor_recebido=0, status='ABERTO', data_recebimento=NULL
        WHERE id=$10 RETURNING *
      `, [descricao, id_cliente || null, numero_documento, valorTotalNum, data_emissao, data_vencimento,
          observacoes, id_plano_contas || null, id_centro_custo || null, id]);
      if (!r.rows.length) return null;

      // Regenera parcelas: apaga todas (inclusive recebidas) e cria novas
      await client.query('DELETE FROM fin_parcelas_receber WHERE id_conta_receber = $1', [id]);

      if (temParcelasExplicitas) {
        for (const p of parcelasExplicitas) {
          await client.query(
            `INSERT INTO fin_parcelas_receber (id_conta_receber,numero_parcela,valor,data_vencimento) VALUES ($1,$2,$3,$4)`,
            [id, p.numero_parcela, Number(p.valor), p.data_vencimento]
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
            [id, i, valor, dt.toISOString().split('T')[0]]
          );
          soma += valor;
        }
      } else {
        await client.query(
          `INSERT INTO fin_parcelas_receber (id_conta_receber,numero_parcela,valor,data_vencimento) VALUES ($1,1,$2,$3)`,
          [id, valorTotalNum, data_vencimento]
        );
      }
      return r.rows[0];
    });

    if (!updated) { res.status(404).json({ success: false, message: 'Conta não encontrada' }); return; }
    res.json({ success: true, message: `Conta atualizada com ${nParcelas} parcela(s)`, data: updated });
  } catch (e) { err(res, e, 'update conta-receber'); }
}

export async function baixaContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { id_parcela, data_recebimento, valor_recebido, juros = 0, desconto = 0, observacoes, gerar_residuo = true, id_conta_caixa } = req.body;
    if (!id_conta_caixa) { res.status(400).json({ success: false, message: 'Informe a conta de caixa do recebimento.' }); return; }

    await db.transaction(async client => {
      await client.query(`
        UPDATE fin_parcelas_receber
        SET data_recebimento=$1, valor_recebido=$2, juros=$3, desconto=$4, status='RECEBIDO', observacoes=$5
        WHERE id=$6
      `, [data_recebimento, valor_recebido, juros, desconto, observacoes, id_parcela]);

      const orig = await client.query('SELECT valor FROM fin_parcelas_receber WHERE id = $1', [id_parcela]);
      const residual = parseFloat(orig.rows[0].valor) - Number(valor_recebido) - Number(desconto);

      if (gerar_residuo && residual > 0.01) {
        const maxNum = await client.query('SELECT MAX(numero_parcela) AS mx FROM fin_parcelas_receber WHERE id_conta_receber = $1', [id]);
        const nextNum = (maxNum.rows[0].mx || 0) + 1;
        await client.query(`
          INSERT INTO fin_parcelas_receber (id_conta_receber,numero_parcela,valor,data_vencimento,status)
          VALUES ($1,$2,$3,(SELECT data_vencimento FROM fin_parcelas_receber WHERE id=$4),'ABERTO')
        `, [id, nextNum, residual, id_parcela]);
      }

      const totals = await client.query(`
        SELECT COUNT(*) AS total, COUNT(CASE WHEN status='RECEBIDO' THEN 1 END) AS recebidas, COALESCE(SUM(valor_recebido),0) AS total_recebido
        FROM fin_parcelas_receber WHERE id_conta_receber = $1
      `, [id]);
      const { total, recebidas, total_recebido } = totals.rows[0];
      const novStatus = parseInt(total) === parseInt(recebidas) ? 'RECEBIDO' : 'ABERTO';

      await client.query(`
        UPDATE fin_contas_receber SET valor_recebido=$1, status=$2::varchar,
          data_recebimento = CASE WHEN $2::varchar='RECEBIDO' THEN $3::date ELSE NULL END
        WHERE id=$4
      `, [total_recebido, novStatus, data_recebimento, id]);

      const cab = await client.query(
        'SELECT descricao, numero_documento, id_plano_contas, id_centro_custo FROM fin_contas_receber WHERE id=$1', [id]);
      const c = cab.rows[0] || {};
      const histDoc = c.numero_documento ? ` • Doc ${c.numero_documento}` : '';
      await lancarBaixaNoCaixa(client, {
        conta_id: Number(id_conta_caixa),
        data: data_recebimento,
        valor: Number(valor_recebido) + Number(juros),
        tipo: 'C', origem: 'CR', id_parcela_origem: Number(id_parcela),
        historico: `Receb: ${c.descricao ?? 'conta a receber'}${histDoc}`,
        id_plano_contas: c.id_plano_contas, id_centro_custo: c.id_centro_custo,
        documento: c.numero_documento ?? null,
      });
    });

    res.json({ success: true, message: 'Recebimento registrado com sucesso' });
  } catch (e) { err(res, e, 'baixa conta-receber'); }
}

export async function deleteContaReceberHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const deleted = await db.transaction(async client => {
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
      entradas AS (
        SELECT date_trunc('${trunc}', data_recebimento::date) AS periodo,
               COALESCE(SUM(valor_recebido), 0) AS valor
        FROM fin_parcelas_receber
        WHERE status = 'RECEBIDO'
          AND data_recebimento BETWEEN $1 AND $2
        GROUP BY 1
      ),
      saidas AS (
        SELECT date_trunc('${trunc}', data_pagamento::date) AS periodo,
               COALESCE(SUM(valor_pago), 0) AS valor
        FROM fin_parcelas_pagar
        WHERE status = 'PAGO'
          AND data_pagamento BETWEEN $1 AND $2
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

    const result = await db.query(`
      SELECT
        pc.tipo,
        pc.codigo,
        pc.descricao,
        COALESCE(
          SUM(CASE WHEN pc.tipo='R' THEN pr.valor_recebido ELSE pp.valor_pago END), 0
        ) AS valor
      FROM fin_plano_contas pc
      LEFT JOIN fin_contas_receber cr ON cr.id_plano_contas = pc.id
        AND EXTRACT(MONTH FROM cr.data_vencimento) = $1
        AND EXTRACT(YEAR  FROM cr.data_vencimento) = $2
      LEFT JOIN fin_parcelas_receber pr ON pr.id_conta_receber = cr.id AND pr.status='RECEBIDO'
      LEFT JOIN fin_contas_pagar cp ON cp.id_plano_contas = pc.id
        AND EXTRACT(MONTH FROM cp.data_vencimento) = $1
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = $2
      LEFT JOIN fin_parcelas_pagar pp ON pp.id_conta_pagar = cp.id AND pp.status='PAGO'
      WHERE pc.ativo = true
      GROUP BY pc.tipo, pc.codigo, pc.descricao, pc.nivel
      HAVING COALESCE(SUM(CASE WHEN pc.tipo='R' THEN pr.valor_recebido ELSE pp.valor_pago END),0) != 0
         OR pc.nivel = 1
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

    const [receber, pagar, grafico] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status='ABERTO' AND data_vencimento < CURRENT_DATE  THEN valor_total - valor_recebido ELSE 0 END), 0) AS vencido,
          COALESCE(SUM(CASE WHEN status='ABERTO' AND data_vencimento = CURRENT_DATE  THEN valor_total - valor_recebido ELSE 0 END), 0) AS hoje,
          COALESCE(SUM(CASE WHEN status='ABERTO' AND data_vencimento > CURRENT_DATE AND data_vencimento <= CURRENT_DATE + 7 THEN valor_total - valor_recebido ELSE 0 END), 0) AS prox_7_dias,
          COALESCE(SUM(CASE WHEN status='ABERTO' THEN valor_total - valor_recebido ELSE 0 END), 0) AS total_aberto
        FROM fin_contas_receber
      `),
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status='ABERTO' AND data_vencimento < CURRENT_DATE  THEN valor_total - valor_pago ELSE 0 END), 0) AS vencido,
          COALESCE(SUM(CASE WHEN status='ABERTO' AND data_vencimento = CURRENT_DATE  THEN valor_total - valor_pago ELSE 0 END), 0) AS hoje,
          COALESCE(SUM(CASE WHEN status='ABERTO' AND data_vencimento > CURRENT_DATE AND data_vencimento <= CURRENT_DATE + 7 THEN valor_total - valor_pago ELSE 0 END), 0) AS prox_7_dias,
          COALESCE(SUM(CASE WHEN status='ABERTO' THEN valor_total - valor_pago ELSE 0 END), 0) AS total_aberto
        FROM fin_contas_pagar
      `),
      db.query(`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            '1 month'::interval
          )::date AS mes
        )
        SELECT
          to_char(m.mes, 'Mon/YY') AS label,
          COALESCE((SELECT SUM(valor_total) FROM fin_contas_receber WHERE date_trunc('month', data_vencimento) = m.mes), 0) AS receitas,
          COALESCE((SELECT SUM(valor_total) FROM fin_contas_pagar  WHERE date_trunc('month', data_vencimento) = m.mes), 0) AS despesas
        FROM meses m ORDER BY m.mes
      `)
    ]);

    const r = receber.rows[0];
    const p = pagar.rows[0];
    res.json({
      success: true,
      data: {
        receber: r,
        pagar: p,
        grafico: grafico.rows,
        saldo_previsto: parseFloat(r.total_aberto) - parseFloat(p.total_aberto)
      }
    });
  } catch (e) { err(res, e, 'dashboard'); }
}
