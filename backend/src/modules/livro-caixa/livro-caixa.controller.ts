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
