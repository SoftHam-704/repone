import { Request, Response } from 'express';
import * as acbr from '../../shared/utils/acbr-nfse.service';
import { buildNfsePayload } from './nfse-payload';
import { empresaToAliquotas, empresaToConfigNfse, cnpjDigits } from './nfse-empresa-config';

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

// ════════════════════════════════════════════════════════════════════
// EMISSÃO ACBr (homologação nesta fase)
// ════════════════════════════════════════════════════════════════════

// Extrai o motivo de uma resposta 200 da ACBr cujo status é rejeitado/erro — o
// detalhe vem aninhado (mensagem/motivo/descricao/erros[]), NÃO em `error` (esse
// só aparece quando a chamada HTTP falha e o serviço lança AcbrError).
function extrairMotivoAcbr(info: any): string | null {
  if (!info || typeof info !== 'object') return null;
  const partes: string[] = [];
  for (const k of ['message', 'mensagem', 'motivo', 'descricao', 'error']) {
    const v = info[k];
    if (typeof v === 'string' && v.trim()) partes.push(v.trim());
    else if (v && typeof v === 'object' && typeof v.message === 'string') partes.push(v.message);
  }
  for (const arr of [info.erros, info.errors, info.error?.errors].filter(Array.isArray)) {
    for (const s of arr) {
      if (typeof s === 'string') partes.push(s);
      else if (s && typeof s === 'object') {
        const m = s.message ?? s.mensagem ?? s.motivo;
        if (typeof m === 'string') { const ref = s.campo ?? s.field ?? s.codigo; partes.push(ref ? `${ref}: ${m}` : m); }
      }
    }
  }
  const seen = new Set<string>();
  const uniq = partes.filter(p => (seen.has(p) ? false : (seen.add(p), true)));
  return uniq.length ? uniq.join(' · ').slice(0, 1000) : null;
}

// Motivo vindo de info.mensagens[] (Sistema Nacional NFS-e: [{codigo, descricao}]).
function motivoMensagens(info: any): string | null {
  const arr = Array.isArray(info?.mensagens) ? info.mensagens : null;
  if (!arr || !arr.length) return null;
  return arr.map((m: any) => (m?.codigo ? `${m.codigo}: ` : '') + (m?.descricao ?? m?.mensagem ?? '')).filter(Boolean).join(' · ').slice(0, 1000) || null;
}

// Carrega o que a emissão/prévia precisam: lançamento (com CNPJ do tomador) + empresa_status.
async function carregarParaEmissao(db: any, id: number) {
  const lanc = (await db.query(`
    SELECT n.*, f.for_cgc AS for_cnpj, f.for_email AS tomador_email,
           COALESCE(NULLIF(TRIM(f.for_nomered),''), f.for_nome, n.representada_nome) AS tomador_nome,
           s.descricao AS serv_descricao, s.item_lc116 AS serv_item, s.ctribnac AS serv_ctribnac,
           s.cnbs AS serv_cnbs, s.ctribmun AS serv_ctribmun, s.iss_pct AS serv_iss
    FROM fin_nfse n
    LEFT JOIN fornecedores f ON f.for_codigo = n.for_codigo
    LEFT JOIN fin_nfse_servicos s ON s.id = n.servico_id
    WHERE n.id = $1
  `, [id])).rows[0];
  const emp = (await db.query(`SELECT * FROM empresa_status WHERE emp_id = 1`)).rows[0] || {};
  return { lanc, emp };
}

function validarEmissao(lanc: any, emp: any): string[] {
  const faltando: string[] = [];
  if (!lanc) { faltando.push('Lançamento não encontrado'); return faltando; }
  if (!emp.emp_cnpj) faltando.push('CNPJ da empresa (Configurações)');
  if (!emp.emp_im) faltando.push('Inscrição Municipal (Configurações → Dados Fiscais)');
  if (!emp.emp_ctribnac) faltando.push('Código de tributação nacional (Configurações)');
  if (!emp.emp_cnbs) faltando.push('Código NBS (Configurações)');
  if (!emp.emp_ibge) faltando.push('Código IBGE do município (Configurações)');
  if (!lanc.for_cnpj) faltando.push('CNPJ da representada (tomador)');
  if (!(Number(lanc.vr_bruto) > 0)) faltando.push('Valor (VR Bruto) maior que zero');
  return faltando;
}

function montarPayload(lanc: any, emp: any) {
  const usaServ = !!lanc.serv_ctribnac;
  const aliquotas = usaServ
    ? { regime: emp.emp_regime || 'PRESUMIDO', iss_pct: Number(lanc.serv_iss) || 0,
        inscricao_municipal: emp.emp_im || '', codigo_servico_padrao: lanc.serv_ctribnac,
        ctrib_mun: lanc.serv_ctribmun || undefined, cnbs: lanc.serv_cnbs || undefined }
    : empresaToAliquotas(emp);
  const desc = lanc.serv_descricao
    ? `${lanc.serv_descricao} — competência ${lanc.competencia}`
    : `Comissão sobre representação comercial — competência ${lanc.competencia}`;
  return buildNfsePayload({
    lancamento: { id: lanc.id, competencia: lanc.competencia, vr_bruto: Number(lanc.vr_bruto), iss: Number(lanc.iss),
      representada_nome: lanc.tomador_nome || lanc.representada_nome || '', for_cnpj: String(lanc.for_cnpj), descricao: desc },
    aliquotas,
    prestador: { cnpj: String(emp.emp_cnpj), razao: emp.emp_nome || '', ibge: String(emp.emp_ibge || '') },
    provedor: 'nacional', ambiente: emp.emp_nfse_ambiente === 'PRODUCAO' ? 'producao' : 'homologacao',
  });
}

// GET /:id/previa — monta o payload e devolve um resumo legível, SEM emitir.
export async function previaNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { lanc, emp } = await carregarParaEmissao(db, Number(req.params.id));
    const faltando = validarEmissao(lanc, emp);
    if (faltando.length) { res.status(400).json({ success: false, message: 'Faltam dados para emitir: ' + faltando.join('; '), faltando }); return; }
    const { payload } = montarPayload(lanc, emp);
    const isSimples = (emp.emp_regime || '').toUpperCase().includes('SIMPLES');
    res.json({ success: true, data: {
      prestador: { nome: emp.emp_nome, cnpj: emp.emp_cnpj, im: emp.emp_im },
      tomador: { nome: lanc.tomador_nome || lanc.representada_nome, cnpj: lanc.for_cnpj, email: lanc.tomador_email },
      servico: { item_lc116: lanc.serv_item || emp.emp_item_lc116, ctribnac: lanc.serv_ctribnac || emp.emp_ctribnac,
                 cnbs: lanc.serv_cnbs || emp.emp_cnbs, descricao: lanc.serv_descricao
                   ? `${lanc.serv_descricao} — competência ${lanc.competencia}`
                   : `Comissão sobre representação comercial — competência ${lanc.competencia}` },
      valor: Number(lanc.vr_bruto), iss_pct: isSimples ? null : Number(emp.emp_iss_pct) || 0, iss_simples: isSimples,
      competencia: lanc.competencia,
      ambiente: emp.emp_nfse_ambiente === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO',
    }, payload });
  } catch (e: any) {
    console.error('❌ [NFSE previa]:', e?.message);
    res.status(500).json({ success: false, message: e?.message ?? 'Erro ao montar prévia' });
  }
}

// POST /:id/emitir  — emite a NFS-e do lançamento via empresa_status
export async function emitirNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = Number(req.params.id);
    const { lanc, emp } = await carregarParaEmissao(db, id);
    const faltando = validarEmissao(lanc, emp);
    if (faltando.length) { res.status(400).json({ success: false, message: 'Faltam dados para emitir: ' + faltando.join('; '), faltando }); return; }

    const cnpj = cnpjDigits(emp.emp_cnpj);
    const { payload } = montarPayload(lanc, emp);

    // Emite; se faltar config no ACBr, configura (lazy, semeando a numeração) e repete UMA vez.
    let emit: any;
    try {
      emit = await acbr.emitirDps(payload);
    } catch (err: any) {
      const isConfig = err?.status === 400 && /ConfigNfseNotFound|configura/i.test(String(err?.message) + String(err?.body ?? ''));
      if (!isConfig) throw err;
      await acbr.configurarNfseEmpresa(cnpj, empresaToConfigNfse(emp));
      emit = await acbr.emitirDps(payload);
    }

    const acbrId = emit?.id ?? emit?.data?.id;
    let status = String(emit?.status ?? '').toLowerCase();
    let info: any = emit;
    for (let i = 0; acbrId && !['autorizada','autorizado','concluido','negada','rejeitado','erro','cancelada','cancelado'].includes(status) && i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      info = await acbr.consultar(acbrId);
      status = String(info?.status ?? '').toLowerCase();
    }

    const ok = ['autorizada','autorizado','concluido'].includes(status);
    const terminal = ['negada','rejeitado','erro','cancelada','cancelado'].includes(status);
    const novoStatus = ok ? 'EMITIDA' : terminal ? 'ERRO' : 'PENDENTE';
    const motivo = ok ? null : (extrairMotivoAcbr(info) ?? motivoMensagens(info) ?? `status ACBr: ${status || 'desconhecido'}`);
    const numero = info?.numero ?? null;

    await db.query(`
      UPDATE fin_nfse SET
        status=$1, numero=COALESCE($2, numero), protocolo=$3, codigo_verificacao=$4,
        xml=$5, erro_msg=$6, emitida_em = CASE WHEN $7 THEN now() ELSE emitida_em END, updated_at=now()
      WHERE id=$8
    `, [novoStatus, numero, acbrId ?? null,
        info?.codigo_verificacao ?? null, info?.xml ?? null, motivo, ok, id]);

    if (ok && numero) {
      await db.query(`UPDATE empresa_status SET emp_nfse_proximo_numero = $1 WHERE emp_id = 1`, [Number(numero) + 1]);
    }

    res.json({ success: ok, status: novoStatus, numero, acbr_id: acbrId,
      codigo_verificacao: info?.codigo_verificacao ?? null, link_url: info?.link_url ?? null,
      motivo, data: info });
  } catch (e: any) {
    const msg = e?.message ?? 'Erro ao emitir NFS-e';
    console.error('❌ [NFSE emitir]:', msg, e?.body ? '| body: ' + String(e.body).slice(0, 800) : '');
    res.status(500).json({ success: false, message: msg, acbr_body: e?.rawJson ?? e?.body ?? null });
  }
}

// GET /:id/pdf — DANFSE
export async function pdfNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = (await db.query(`SELECT protocolo FROM fin_nfse WHERE id=$1`, [Number(req.params.id)])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e ainda não emitida.' }); return; }
    const pdf = await acbr.baixarPdf(String(r.protocolo));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="nfse-${req.params.id}.pdf"`);
    res.send(pdf.data);
  } catch (e: any) { res.status(500).json({ success: false, message: e?.message ?? 'Erro ao baixar PDF' }); }
}

// GET /:id/xml
export async function xmlNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = (await db.query(`SELECT protocolo FROM fin_nfse WHERE id=$1`, [Number(req.params.id)])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e ainda não emitida.' }); return; }
    const xml = await acbr.baixarXml(String(r.protocolo));
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${req.params.id}.xml"`);
    res.send(xml.data);
  } catch (e: any) { res.status(500).json({ success: false, message: e?.message ?? 'Erro ao baixar XML' }); }
}

// ════════════════════════════════════════════════════════════════════
// SERVIÇOS NFS-e (tabela fin_nfse_servicos)
// ════════════════════════════════════════════════════════════════════

export async function listServicosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`SELECT * FROM fin_nfse_servicos ORDER BY ativo DESC, descricao`);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'listServicos'); }
}

export async function createServicoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!; const b = req.body || {};
    if (!String(b.descricao || '').trim()) { res.status(400).json({ success: false, message: 'Descrição é obrigatória.' }); return; }
    const r = await db.query(`
      INSERT INTO fin_nfse_servicos (descricao, item_lc116, ctribnac, cnbs, ctribmun, iss_pct, ativo)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,true)) RETURNING *
    `, [b.descricao.trim(), b.item_lc116 || null, b.ctribnac || null, b.cnbs || null, b.ctribmun || null,
        b.iss_pct === '' || b.iss_pct == null ? 0 : Number(b.iss_pct), b.ativo]);
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'createServico'); }
}

export async function updateServicoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!; const b = req.body || {};
    const r = await db.query(`
      UPDATE fin_nfse_servicos SET descricao=$1, item_lc116=$2, ctribnac=$3, cnbs=$4, ctribmun=$5, iss_pct=$6, ativo=COALESCE($7,ativo)
      WHERE id=$8 RETURNING *
    `, [b.descricao, b.item_lc116 || null, b.ctribnac || null, b.cnbs || null, b.ctribmun || null,
        b.iss_pct === '' || b.iss_pct == null ? 0 : Number(b.iss_pct), b.ativo, Number(req.params.id)]);
    if (!r.rowCount) { res.status(404).json({ success: false, message: 'Serviço não encontrado.' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'updateServico'); }
}

export async function deleteServicoHandler(req: Request, res: Response): Promise<void> {
  try { await req.db!.query(`DELETE FROM fin_nfse_servicos WHERE id=$1`, [Number(req.params.id)]); res.json({ success: true }); }
  catch (e) { err(res, e, 'deleteServico'); }
}

// POST /:id/cancelar  { motivo }
export async function cancelarNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = Number(req.params.id);
    const motivo = String(req.body?.motivo || '').trim();
    if (motivo.length < 15) { res.status(400).json({ success: false, message: 'Informe um motivo de cancelamento (mín. 15 caracteres).' }); return; }
    const r = (await db.query(`SELECT protocolo, status FROM fin_nfse WHERE id=$1`, [id])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e não emitida.' }); return; }
    if (r.status === 'CANCELADA') { res.status(400).json({ success: false, message: 'NFS-e já cancelada.' }); return; }
    const out: any = await acbr.cancelar(String(r.protocolo), motivo);
    await db.query(`UPDATE fin_nfse SET status='CANCELADA', cancelada_em=now(), obs=COALESCE(obs,'')||' [CANCELADA: '||$2||']', updated_at=now() WHERE id=$1`, [id, motivo]);
    res.json({ success: true, data: out });
  } catch (e: any) {
    console.error('❌ [NFSE cancelar]:', e?.message);
    res.status(500).json({ success: false, message: e?.message ?? 'Erro ao cancelar', acbr_body: e?.rawJson ?? e?.body ?? null });
  }
}
