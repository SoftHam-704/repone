import { Request, Response } from 'express';

// ─── helpers ─────────────────────────────────────────────────────────────────
function err(res: Response, e: any, ctx = '') {
  console.error(`❌ [LIVRO-CAIXA]${ctx ? ' ' + ctx : ''}:`, e?.message ?? e);
  res.status(500).json({ success: false, message: e?.message ?? 'Erro interno' });
}

// ════════════════════════════════════════════════════════════════════
// CONTAS (caixa / banco / pix)
// ════════════════════════════════════════════════════════════════════

// GET /contas — lista contas ativas com saldo atual (saldo_inicial + Σ lançamentos)
export async function listContasCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`
      SELECT c.id, c.conta_nome, c.conta_tipo, c.saldo_inicial, c.data_saldo_inicial, c.ativo,
        (c.saldo_inicial + COALESCE((
          SELECT SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
          FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id
        ), 0)) AS saldo_atual
      FROM livro_caixa_contas c
      WHERE c.ativo = true
      ORDER BY c.conta_nome
    `);
    const data = r.rows.map((x: any) => ({
      ...x,
      saldo_inicial: Number(x.saldo_inicial),
      saldo_atual: Number(x.saldo_atual),
    }));
    res.json({ success: true, data });
  } catch (e) { err(res, e, 'list contas'); }
}

// POST /contas
export async function createContaCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { conta_nome, conta_tipo, saldo_inicial, data_saldo_inicial } = req.body;
    if (!conta_nome || !String(conta_nome).trim()) {
      res.status(400).json({ success: false, message: 'Nome da conta é obrigatório.' }); return;
    }
    const r = await db.query(`
      INSERT INTO livro_caixa_contas (conta_nome, conta_tipo, saldo_inicial, data_saldo_inicial)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [String(conta_nome).trim(), conta_tipo || 'caixa', Number(saldo_inicial) || 0,
        data_saldo_inicial || new Date().toISOString().split('T')[0]]);
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'create conta'); }
}

// PUT /contas/:id
export async function updateContaCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { conta_nome, conta_tipo, saldo_inicial, data_saldo_inicial, ativo } = req.body;
    const r = await db.query(`
      UPDATE livro_caixa_contas
      SET conta_nome=$1, conta_tipo=$2, saldo_inicial=$3, data_saldo_inicial=$4, ativo=$5
      WHERE id=$6 RETURNING *
    `, [String(conta_nome).trim(), conta_tipo || 'caixa', Number(saldo_inicial) || 0,
        data_saldo_inicial, ativo !== false, id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada.' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'update conta'); }
}

// DELETE /contas/:id — inativa se tiver lançamento, senão exclui de fato
export async function deleteContaCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const usos = await db.query('SELECT COUNT(*)::int AS n FROM livro_caixa_lancamentos WHERE conta_id=$1', [id]);
    if (usos.rows[0].n > 0) {
      await db.query('UPDATE livro_caixa_contas SET ativo=false WHERE id=$1', [id]);
      res.json({ success: true, message: 'Conta inativada (possui lançamentos).' }); return;
    }
    await db.query('DELETE FROM livro_caixa_contas WHERE id=$1', [id]);
    res.json({ success: true, message: 'Conta excluída.' });
  } catch (e) { err(res, e, 'delete conta'); }
}

// ════════════════════════════════════════════════════════════════════
// RESUMO + CONFIG
// ════════════════════════════════════════════════════════════════════

// GET /resumo — saldo de cada conta ativa + total geral
export async function resumoCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`
      SELECT c.id, c.conta_nome, c.conta_tipo,
        (c.saldo_inicial + COALESCE((
          SELECT SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
          FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id
        ), 0)) AS saldo_atual
      FROM livro_caixa_contas c WHERE c.ativo = true ORDER BY c.conta_nome
    `);
    const contas = r.rows.map((x: any) => ({ ...x, saldo_atual: Number(x.saldo_atual) }));
    const total = contas.reduce((s: number, x: any) => s + x.saldo_atual, 0);
    res.json({ success: true, data: { contas, total } });
  } catch (e) { err(res, e, 'resumo'); }
}

// GET /config — teto mensal de imposto + acumulado do mês atual (p/ a baixa do Contas a Pagar)
export async function configCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const cfg = await db.query('SELECT COALESCE(emp_teto_com_imposto_mensal,0) AS teto FROM empresa_status WHERE emp_id=1 LIMIT 1');
    const teto = Number(cfg.rows[0]?.teto || 0);
    const acc = await db.query(`
      SELECT COALESCE(SUM(valor_com_imposto),0) AS acc
      FROM fin_parcelas_pagar
      WHERE status='PAGO'
        AND data_pagamento >= date_trunc('month', CURRENT_DATE)
        AND data_pagamento <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    `);
    res.json({ success: true, data: { teto_com_imposto_mensal: teto, acumulado_mes: Number(acc.rows[0].acc) } });
  } catch (e) { err(res, e, 'config'); }
}

// ════════════════════════════════════════════════════════════════════
// LANÇAMENTOS (conta corrente) — ordenados pela SEQUÊNCIA (id)
// ════════════════════════════════════════════════════════════════════

// Bloqueia lançamento retroativo: a data não pode ser anterior à última já lançada na conta
// (nem ao saldo inicial). Garante que ORDER BY id == ordem cronológica. Aceita db OU client.
// Retorna o "piso" (DD/MM/YYYY) quando é retroativo, senão null.
async function checkRetroativo(db: any, contaId: number, data: string): Promise<string | null> {
  const r = await db.query(`
    SELECT ($2::date < GREATEST(c.data_saldo_inicial,
              COALESCE((SELECT MAX(l.data) FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id), c.data_saldo_inicial))) AS retro,
           to_char(GREATEST(c.data_saldo_inicial,
              COALESCE((SELECT MAX(l.data) FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id), c.data_saldo_inicial)), 'DD/MM/YYYY') AS piso
    FROM livro_caixa_contas c WHERE c.id = $1
  `, [contaId, data]);
  return r.rows[0]?.retro ? (r.rows[0].piso as string) : null;
}

// GET /lancamentos?conta_id=&de=&ate=  → saldo anterior + KPIs + lançamentos (ordem = id/sequence)
export async function listLancamentosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const contaId = parseInt(String(req.query.conta_id));
    const de = String(req.query.de || '');   // YYYY-MM-DD
    const ate = String(req.query.ate || ''); // YYYY-MM-DD
    if (!Number.isFinite(contaId) || !de || !ate) {
      res.status(400).json({ success: false, message: 'conta_id, de e ate são obrigatórios.' }); return;
    }
    // saldo anterior = saldo_inicial + Σ lançamentos com data < de
    const ant = await db.query(`
      SELECT (c.saldo_inicial + COALESCE((
        SELECT SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
        FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id AND l.data < $2
      ), 0)) AS saldo_anterior
      FROM livro_caixa_contas c WHERE c.id = $1
    `, [contaId, de]);
    if (!ant.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada.' }); return; }
    const saldoAnterior = Number(ant.rows[0].saldo_anterior);

    // lançamentos do período ordenados pela SEQUÊNCIA (id). Sem retroativo → id == cronologia.
    const r = await db.query(`
      SELECT l.id, l.data, l.historico, l.tipo, l.valor, l.documento, l.origem,
             l.id_parcela_origem, l.id_transferencia,
             l.id_plano_contas, pc.descricao AS plano_descricao,
             l.id_centro_custo, cc.descricao AS centro_descricao,
             SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
               OVER (ORDER BY l.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS delta_acum
      FROM livro_caixa_lancamentos l
      LEFT JOIN fin_plano_contas pc ON pc.id = l.id_plano_contas
      LEFT JOIN fin_centro_custo  cc ON cc.id = l.id_centro_custo
      WHERE l.conta_id = $1 AND l.data >= $2 AND l.data <= $3
      ORDER BY l.id
    `, [contaId, de, ate]);

    let entradas = 0, saidas = 0;
    const lancamentos = r.rows.map((x: any) => {
      const v = Number(x.valor);
      if (x.tipo === 'C') entradas += v; else saidas += v;
      return { ...x, valor: v, saldo: saldoAnterior + Number(x.delta_acum) };
    });
    const saldoFinal = lancamentos.length ? lancamentos[lancamentos.length - 1].saldo : saldoAnterior;
    res.json({ success: true, data: {
      saldo_anterior: saldoAnterior, saldo_final: saldoFinal,
      total_entradas: entradas, total_saidas: saidas, resultado: entradas - saidas,
      lancamentos,
    } });
  } catch (e) { err(res, e, 'list lancamentos'); }
}

// POST /lancamentos — lançamento MANUAL (sem retroativo)
export async function createLancamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento } = req.body;
    const valorNum = Number(valor);
    if (!conta_id || !data || !historico || !String(historico).trim()) {
      res.status(400).json({ success: false, message: 'Conta, data e histórico são obrigatórios.' }); return;
    }
    if (tipo !== 'C' && tipo !== 'D') { res.status(400).json({ success: false, message: 'Tipo deve ser C ou D.' }); return; }
    if (!Number.isFinite(valorNum) || valorNum <= 0) { res.status(400).json({ success: false, message: 'Valor inválido.' }); return; }
    const piso = await checkRetroativo(db, Number(conta_id), data);
    if (piso) { res.status(400).json({ success: false, message: `Lançamento retroativo não permitido (anterior a ${piso}).` }); return; }
    const r = await db.query(`
      INSERT INTO livro_caixa_lancamentos
        (conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento, origem)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'MA') RETURNING id
    `, [conta_id, data, String(historico).trim(), tipo, valorNum,
        id_plano_contas || null, id_centro_custo || null, documento || null]);
    res.json({ success: true, message: 'Lançamento registrado.', id: r.rows[0].id });
  } catch (e) { err(res, e, 'create lancamento'); }
}

// PUT /lancamentos/:id — só lançamento MANUAL pode ser editado
export async function updateLancamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento } = req.body;
    const valorNum = Number(valor);
    if (tipo !== 'C' && tipo !== 'D') { res.status(400).json({ success: false, message: 'Tipo deve ser C ou D.' }); return; }
    if (!Number.isFinite(valorNum) || valorNum <= 0) { res.status(400).json({ success: false, message: 'Valor inválido.' }); return; }

    const cur = await db.query('SELECT origem FROM livro_caixa_lancamentos WHERE id=$1', [id]);
    if (!cur.rows.length) { res.status(404).json({ success: false, message: 'Lançamento não encontrado.' }); return; }
    if (cur.rows[0].origem !== 'MA') {
      res.status(400).json({ success: false, message: 'Lançamento de baixa/transferência não pode ser editado aqui. Use a conta a pagar/receber.' }); return;
    }
    await db.query(`
      UPDATE livro_caixa_lancamentos
      SET conta_id=$1, data=$2, historico=$3, tipo=$4, valor=$5, id_plano_contas=$6, id_centro_custo=$7, documento=$8
      WHERE id=$9
    `, [conta_id, data, String(historico).trim(), tipo, valorNum, id_plano_contas || null, id_centro_custo || null, documento || null, id]);
    res.json({ success: true, message: 'Lançamento atualizado.' });
  } catch (e) { err(res, e, 'update lancamento'); }
}

// DELETE /lancamentos/:id — manual: exclui; transferência: exclui o par; CP/CR: bloqueia
export async function deleteLancamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const cur = await db.query('SELECT origem, id_transferencia FROM livro_caixa_lancamentos WHERE id=$1', [id]);
    if (!cur.rows.length) { res.status(404).json({ success: false, message: 'Lançamento não encontrado.' }); return; }
    const { origem, id_transferencia } = cur.rows[0];
    if (origem === 'CP' || origem === 'CR') {
      res.status(400).json({ success: false, message: 'Lançamento de baixa: estorne pela conta a pagar/receber.' }); return;
    }
    if (origem === 'TR' && id_transferencia) {
      await db.query('DELETE FROM livro_caixa_lancamentos WHERE id_transferencia=$1', [id_transferencia]);
    } else {
      await db.query('DELETE FROM livro_caixa_lancamentos WHERE id=$1', [id]);
    }
    res.json({ success: true, message: 'Lançamento excluído.' });
  } catch (e) { err(res, e, 'delete lancamento'); }
}

// POST /transferencia — par vinculado (D na origem + C no destino)
export async function transferenciaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { conta_origem, conta_destino, valor, data, historico } = req.body;
    const valorNum = Number(valor);
    if (!conta_origem || !conta_destino) { res.status(400).json({ success: false, message: 'Contas de origem e destino são obrigatórias.' }); return; }
    if (conta_origem === conta_destino) { res.status(400).json({ success: false, message: 'Origem e destino devem ser diferentes.' }); return; }
    if (!data) { res.status(400).json({ success: false, message: 'Data é obrigatória.' }); return; }
    if (!Number.isFinite(valorNum) || valorNum <= 0) { res.status(400).json({ success: false, message: 'Valor inválido.' }); return; }
    const hist = (historico && String(historico).trim()) || 'Transferência entre contas';

    // Sem retroativo nas duas contas (checa antes da transação para devolver 400 limpo).
    for (const cid of [Number(conta_origem), Number(conta_destino)]) {
      const piso = await checkRetroativo(db, cid, data);
      if (piso) { res.status(400).json({ success: false, message: `Transferência retroativa não permitida (anterior a ${piso}).` }); return; }
    }

    await db.transaction(async (client: any) => {
      const deb = await client.query(`
        INSERT INTO livro_caixa_lancamentos (conta_id, data, historico, tipo, valor, origem)
        VALUES ($1,$2,$3,'D',$4,'TR') RETURNING id
      `, [conta_origem, data, hist, valorNum]);
      const tid = deb.rows[0].id;
      const cred = await client.query(`
        INSERT INTO livro_caixa_lancamentos (conta_id, data, historico, tipo, valor, origem, id_transferencia)
        VALUES ($1,$2,$3,'C',$4,'TR',$5) RETURNING id
      `, [conta_destino, data, hist, valorNum, tid]);
      await client.query('UPDATE livro_caixa_lancamentos SET id_transferencia=$1 WHERE id IN ($2,$3)', [tid, tid, cred.rows[0].id]);
    });
    res.json({ success: true, message: 'Transferência registrada.' });
  } catch (e) { err(res, e, 'transferencia'); }
}

// ════════════════════════════════════════════════════════════════════
// HELPER usado pelo módulo financeiro (baixa → caixa). Recebe o `client`
// da transação aberta no handler de baixa, para tudo ser atômico.
// ════════════════════════════════════════════════════════════════════
export async function lancarBaixaNoCaixa(client: any, p: {
  conta_id: number; data: string; valor: number; tipo: 'C' | 'D';
  origem: 'CP' | 'CR'; id_parcela_origem: number; historico: string;
  id_plano_contas?: number | null; id_centro_custo?: number | null; documento?: string | null;
}): Promise<void> {
  await client.query(`
    INSERT INTO livro_caixa_lancamentos
      (conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento, origem, id_parcela_origem)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [p.conta_id, p.data, p.historico, p.tipo, p.valor,
      p.id_plano_contas ?? null, p.id_centro_custo ?? null, p.documento ?? null, p.origem, p.id_parcela_origem]);
}
