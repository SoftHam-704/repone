import { Request, Response } from 'express';

// ─── helpers ─────────────────────────────────────────────────────────────────
function err(res: Response, e: any, ctx = '') {
  console.error(`❌ [NFSE]${ctx ? ' ' + ctx : ''}:`, e?.message ?? e);
  res.status(500).json({ success: false, message: e?.message ?? 'Erro interno' });
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Apura os impostos da NFS-e a partir do VR BRUTO e da matriz de alíquotas.
//   liquido_nf = vr_bruto − irrf
//   liq_rec    = liquido_nf − (pis + cofins + csll + irpj + iss + fgts_gps)
function calcImpostos(vrBruto: number, aliq: any) {
  const bruto = r2(vrBruto);
  const pct = (p: any) => r2(bruto * (Number(p) || 0) / 100);
  const irrf     = pct(aliq.irrf_pct);
  const pis      = pct(aliq.pis_pct);
  const cofins   = pct(aliq.cofins_pct);
  const csll     = pct(aliq.csll_pct);
  const irpj     = pct(aliq.irpj_pct);
  const iss      = pct(aliq.iss_pct);
  const fgts_gps = pct(aliq.fgts_gps_pct);
  const liquido_nf = r2(bruto - irrf);
  const liq_rec    = r2(liquido_nf - (pis + cofins + csll + irpj + iss + fgts_gps));
  return { irrf, pis, cofins, csll, irpj, iss, fgts_gps, liquido_nf, liq_rec };
}

const numFields = (row: any) => {
  ['vr_bruto','irrf','pis','cofins','csll','irpj','iss','fgts_gps','liquido_nf','liq_rec']
    .forEach(k => { row[k] = Number(row[k]); });
  return row;
};

// ════════════════════════════════════════════════════════════════════
// MATRIZ DE ALÍQUOTAS (config singleton, id = 1)
// ════════════════════════════════════════════════════════════════════

// GET /aliquotas
export async function getAliquotasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`SELECT * FROM fin_nfse_aliquotas WHERE id = 1`);
    const row = r.rows[0] || {};
    ['irrf_pct','pis_pct','cofins_pct','csll_pct','irpj_pct','iss_pct','fgts_gps_pct']
      .forEach(k => { if (row[k] != null) row[k] = Number(row[k]); });
    res.json({ success: true, data: row });
  } catch (e) { err(res, e, 'getAliquotas'); }
}

// PUT /aliquotas  (master)
export async function updateAliquotasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const b = req.body || {};
    const r = await db.query(`
      UPDATE fin_nfse_aliquotas SET
        regime       = COALESCE($1, regime),
        irrf_pct     = $2, pis_pct  = $3, cofins_pct = $4, csll_pct = $5,
        irpj_pct     = $6, iss_pct  = $7, fgts_gps_pct = $8,
        atualizado_em = now()
      WHERE id = 1
      RETURNING *
    `, [
      b.regime ?? null,
      Number(b.irrf_pct) || 0, Number(b.pis_pct) || 0, Number(b.cofins_pct) || 0, Number(b.csll_pct) || 0,
      Number(b.irpj_pct) || 0, Number(b.iss_pct) || 0, Number(b.fgts_gps_pct) || 0,
    ]);
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'updateAliquotas'); }
}

// ════════════════════════════════════════════════════════════════════
// REPRESENTADAS (para o combobox) — fornecedores ativos
// ════════════════════════════════════════════════════════════════════

// GET /representadas
export async function listRepresentadasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`
      SELECT for_codigo, for_nome, for_nomered
      FROM fornecedores
      WHERE for_tipo2 = 'A'
      ORDER BY COALESCE(NULLIF(TRIM(for_nomered), ''), for_nome)
    `);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'listRepresentadas'); }
}

// ════════════════════════════════════════════════════════════════════
// NFS-e / COMISSÕES (lançamentos mensais)
// ════════════════════════════════════════════════════════════════════

// GET /?competencia=YYYY-MM  — lista do mês + totais
export async function listNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const competencia = String(req.query.competencia || '').trim();
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      res.status(400).json({ success: false, message: 'Competência inválida (use YYYY-MM).' }); return;
    }
    const r = await db.query(`
      SELECT n.*, COALESCE(NULLIF(TRIM(f.for_nomered), ''), f.for_nome, n.representada_nome) AS representada_label
      FROM fin_nfse n
      LEFT JOIN fornecedores f ON f.for_codigo = n.for_codigo
      WHERE n.competencia = $1
      ORDER BY n.emissao, n.numero NULLS LAST, n.id
    `, [competencia]);
    const data = r.rows.map(numFields);

    const sum = (k: string) => r2(data.reduce((a, x) => a + (Number(x[k]) || 0), 0));
    const totais = {
      qtd:        data.length,
      vr_bruto:   sum('vr_bruto'),
      irrf:       sum('irrf'),
      pis:        sum('pis'),
      cofins:     sum('cofins'),
      csll:       sum('csll'),
      irpj:       sum('irpj'),
      iss:        sum('iss'),
      fgts_gps:   sum('fgts_gps'),
      liquido_nf: sum('liquido_nf'),
      // impostos do escritório (tudo menos IRRF, que já está retido) + total geral
      impostos:   r2(sum('pis') + sum('cofins') + sum('csll') + sum('irpj') + sum('iss') + sum('fgts_gps')),
      liq_rec:    sum('liq_rec'),
    };
    res.json({ success: true, data, totais });
  } catch (e) { err(res, e, 'listNfse'); }
}

async function loadAliquotas(db: any) {
  const r = await db.query(`SELECT * FROM fin_nfse_aliquotas WHERE id = 1`);
  return r.rows[0] || {};
}

// POST /  — cria lançamento (impostos apurados no servidor)
export async function createNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const b = req.body || {};
    if (!b.competencia || !/^\d{4}-\d{2}$/.test(String(b.competencia))) {
      res.status(400).json({ success: false, message: 'Competência inválida (YYYY-MM).' }); return;
    }
    if (!b.emissao) { res.status(400).json({ success: false, message: 'Data de emissão é obrigatória.' }); return; }
    if (!b.for_codigo) { res.status(400).json({ success: false, message: 'Representada é obrigatória.' }); return; }

    const aliq = await loadAliquotas(db);
    const imp = calcImpostos(Number(b.vr_bruto) || 0, aliq);

    const r = await db.query(`
      INSERT INTO fin_nfse
        (numero, emissao, competencia, for_codigo, representada_nome, vr_bruto,
         irrf, pis, cofins, csll, irpj, iss, fgts_gps, liquido_nf, liq_rec,
         data_pgto, transf, obs, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `, [
      b.numero || null, b.emissao, b.competencia, Number(b.for_codigo),
      b.representada_nome || null, r2(Number(b.vr_bruto) || 0),
      imp.irrf, imp.pis, imp.cofins, imp.csll, imp.irpj, imp.iss, imp.fgts_gps,
      imp.liquido_nf, imp.liq_rec,
      b.data_pgto || null, b.transf === true || b.transf === 'true', b.obs || null,
      (req as any).user?.id ?? null,
    ]);
    res.json({ success: true, data: numFields(r.rows[0]) });
  } catch (e) { err(res, e, 'createNfse'); }
}

// PUT /:id  — atualiza (reapura impostos)
export async function updateNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const b = req.body || {};

    const aliq = await loadAliquotas(db);
    const imp = calcImpostos(Number(b.vr_bruto) || 0, aliq);

    const r = await db.query(`
      UPDATE fin_nfse SET
        numero = $1, emissao = $2, competencia = $3, for_codigo = $4, representada_nome = $5,
        vr_bruto = $6, irrf = $7, pis = $8, cofins = $9, csll = $10, irpj = $11, iss = $12,
        fgts_gps = $13, liquido_nf = $14, liq_rec = $15, data_pgto = $16, transf = $17, obs = $18,
        updated_at = now()
      WHERE id = $19
      RETURNING *
    `, [
      b.numero || null, b.emissao, b.competencia, Number(b.for_codigo), b.representada_nome || null,
      r2(Number(b.vr_bruto) || 0),
      imp.irrf, imp.pis, imp.cofins, imp.csll, imp.irpj, imp.iss, imp.fgts_gps,
      imp.liquido_nf, imp.liq_rec,
      b.data_pgto || null, b.transf === true || b.transf === 'true', b.obs || null,
      Number(id),
    ]);
    if (r.rowCount === 0) { res.status(404).json({ success: false, message: 'Lançamento não encontrado.' }); return; }
    res.json({ success: true, data: numFields(r.rows[0]) });
  } catch (e) { err(res, e, 'updateNfse'); }
}

// DELETE /:id
export async function deleteNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query(`DELETE FROM fin_nfse WHERE id = $1`, [Number(id)]);
    res.json({ success: true });
  } catch (e) { err(res, e, 'deleteNfse'); }
}
