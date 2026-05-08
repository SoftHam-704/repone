import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, FileCode, Loader2, CheckCircle2, AlertTriangle,
  Download, Building2, User2, Package, ExternalLink, ChevronDown,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';
import { matchProduct, type CatalogItem } from '../pages/ImportModals';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedItem {
  rawCode: string;
  code5: string;
  ean: string;
  qty: number;
  price: number;
  ipi: number;
  st: number;
  matched: CatalogItem | null;
}

interface FaniaData {
  industry: { for_codigo: number; for_nomered: string; for_cgc: string };
  client: { cli_codigo: number; cli_nomred: string; cli_cnpj: string; cli_vendedor: number } | null;
  tables: string[];
  selectedTable: string;
  nf_numero: string;
  items: ParsedItem[];
  tableItems: CatalogItem[];
}

type Step = 'upload' | 'processing' | 'preview' | 'success';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normCnpj = (s: string) => s.replace(/\D/g, '').padStart(14, '0');
const fmtCnpj  = (s: string) => {
  const d = normCnpj(s);
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
};

function getText(el: Element, tag: string): string {
  return el.querySelector(tag)?.textContent?.trim() || '';
}

function downloadErrors(codes: string[]) {
  const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `fania_nao_encontrados_${Date.now()}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FaniaPortalModal({ onClose, onOrderCreated }: {
  onClose: () => void;
  onOrderCreated?: (pedido: string) => void;
}) {
  const [step,      setStep]      = useState<Step>('upload');
  const [dragging,  setDragging]  = useState(false);
  const [faniaData, setFaniaData] = useState<FaniaData | null>(null);
  const [notFound,  setNotFound]  = useState<string[]>([]);
  const [creating,  setCreating]  = useState(false);
  const [createdId, setCreatedId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parse & load ──────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xml')) { toast.error('Selecione um arquivo .xml'); return; }
    setStep('processing');

    try {
      const text   = await file.text();
      const parser = new DOMParser();
      const doc    = parser.parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

      const emitCnpj = normCnpj(getText(doc.documentElement, 'emit > CNPJ'));
      const destCnpj = normCnpj(getText(doc.documentElement, 'dest > CNPJ'));
      const nfNumero = getText(doc.documentElement, 'nNF');

      if (!emitCnpj) throw new Error('CNPJ do emitente não encontrado no XML.');

      // Parallel: industry + client
      const [indRes, cliRes] = await Promise.all([
        api.get(`/suppliers?search=${emitCnpj}&limit=5`),
        destCnpj ? api.get(`/clients?search=${destCnpj}&limit=5`) : Promise.resolve(null),
      ]);

      const indList = indRes.data.data || [];
      const industry = indList.find((f: any) =>
        normCnpj(f.for_cgc || '') === emitCnpj
      ) || indList[0];

      if (!industry) throw new Error(`Indústria com CNPJ ${fmtCnpj(emitCnpj)} não cadastrada no sistema.`);

      const cliList = cliRes?.data?.data || [];
      const client  = cliList.find((c: any) => normCnpj(c.cli_cnpj || '') === destCnpj) || null;

      // Price tables
      const tabRes = await api.get(`/price-tables/${industry.for_codigo}`);
      const tables: string[] = (tabRes.data.data || []).map((t: any) => t.nome_tabela as string);
      if (tables.length === 0) throw new Error(`Nenhuma tabela de preços cadastrada para ${industry.for_nomered}.`);

      const selectedTable = tables[0];
      const itemsRes = await api.get(`/price-tables/${industry.for_codigo}/items?tabela=${encodeURIComponent(selectedTable)}`);
      const tableItems: CatalogItem[] = itemsRes.data.data || [];

      // Parse NF-e items
      const dets = Array.from(doc.querySelectorAll('det'));
      const parsed: ParsedItem[] = [];
      const unmatched: string[] = [];

      for (const det of dets) {
        const prod    = det.querySelector('prod');
        if (!prod) continue;
        const rawCode = getText(prod, 'cProd');
        const ean     = getText(prod, 'cEAN');
        const qty     = parseFloat(getText(prod, 'qCom'))   || 1;
        const price   = parseFloat(getText(prod, 'vUnCom')) || 0;
        const unit    = getText(prod, 'uCom').toUpperCase();
        const imposto = det.querySelector('imposto');
        const ipiTxt  = imposto?.querySelector('pIPI')?.textContent?.trim() || '';
        const stTxt   = imposto?.querySelector('pICMSST, pMVAST')?.textContent?.trim() || '';
        const ipi     = ipiTxt ? (parseFloat(ipiTxt)  || 0) : 0;
        const st      = stTxt  ? (parseFloat(stTxt)   || 0) : 0;

        // NDS rule: truncate cProd to first 5 chars
        const code5   = rawCode.slice(0, 5);

        // Matching: EAN → code5 → rawCode
        const validEan  = ean && !/^SEM\s*GTIN$/i.test(ean) && !/^0+$/.test(ean);
        let matched     = (validEan ? matchProduct(ean, tableItems) : null)
                       || matchProduct(code5, tableItems)
                       || matchProduct(rawCode, tableItems);

        // Unit CX → multiply by embalagem
        let finalQty = qty;
        if (unit.startsWith('CX') && matched && (matched.pro_embalagem || 0) > 1) {
          finalQty = qty * (matched.pro_embalagem || 1);
        }

        if (!matched) unmatched.push(rawCode);

        parsed.push({ rawCode, code5, ean, qty: finalQty, price, ipi, st, matched });
      }

      setNotFound(unmatched);
      setFaniaData({
        industry,
        client: client ? {
          cli_codigo:   client.cli_codigo,
          cli_nomred:   client.cli_nomred,
          cli_cnpj:     client.cli_cnpj,
          cli_vendedor: client.cli_vendedor,
        } : null,
        tables,
        selectedTable,
        nf_numero: nfNumero,
        items: parsed,
        tableItems,
      });
      setStep('preview');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar o XML.');
      setStep('upload');
    }
  }

  // ── Table change ──────────────────────────────────────────────────────────

  async function handleTableChange(tabela: string) {
    if (!faniaData) return;
    setStep('processing');
    try {
      const itemsRes = await api.get(`/price-tables/${faniaData.industry.for_codigo}/items?tabela=${encodeURIComponent(tabela)}`);
      const tableItems: CatalogItem[] = itemsRes.data.data || [];

      const unmatched: string[] = [];
      const items = faniaData.items.map(it => {
        const validEan = it.ean && !/^SEM\s*GTIN$/i.test(it.ean) && !/^0+$/.test(it.ean);
        const matched  = (validEan ? matchProduct(it.ean, tableItems) : null)
                      || matchProduct(it.code5, tableItems)
                      || matchProduct(it.rawCode, tableItems);
        if (!matched) unmatched.push(it.rawCode);
        return { ...it, matched };
      });

      setNotFound(unmatched);
      setFaniaData(prev => prev ? { ...prev, selectedTable: tabela, tableItems, items } : prev);
      setStep('preview');
    } catch {
      toast.error('Erro ao carregar nova tabela.'); setStep('preview');
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!faniaData || !faniaData.client) {
      toast.error('Cliente não identificado. Verifique o CNPJ do destinatário.'); return;
    }
    const matchedItems = faniaData.items.filter(it => it.matched);
    if (matchedItems.length === 0) { toast.error('Nenhum item correspondente encontrado.'); return; }

    setCreating(true);
    try {
      // Calcular totais
      let totbruto = 0, totliq = 0, totalipi = 0;
      const syncItems = matchedItems.map((it, idx) => {
        const p    = it.matched!;
        const puni = it.price > 0 ? it.price : (p.preco_promo || p.preco_especial || p.preco_bruto || 0);
        const liq  = puni; // promoção — sem descontos adicionais
        const tbruto   = puni * it.qty;
        const tliq     = liq  * it.qty;
        const vcomipi  = tliq * (1 + it.ipi / 100);
        const vcomst   = vcomipi * (1 + it.st  / 100);
        totbruto  += tbruto;
        totliq    += tliq;
        totalipi  += tliq * (it.ipi / 100);
        return {
          ite_seq:       idx + 1,
          ite_industria: faniaData.industry.for_codigo,
          ite_produto:   p.pro_codigo,
          ite_embuch:    '',
          ite_nomeprod:  p.pro_nome || '',
          ite_grupo:     p.pro_grupo || 0,
          ite_quant:     it.qty,
          ite_puni:      puni,
          ite_puniliq:   liq,
          ite_des1: 0, ite_des2: 0, ite_des3: 0, ite_des4: 0, ite_des5: 0,
          ite_des6: 0, ite_des7: 0, ite_des8: 0, ite_des9: 0,
          ite_des10: 0, ite_des11: 0,
          ite_ipi:       it.ipi,
          ite_st:        it.st,
          ite_totbruto:  tbruto,
          ite_totliquido: tliq,
          ite_valcomipi:  vcomipi,
          ite_valcomst:   vcomst,
          ite_promocao:   'S', // preço vem da NF — sem descontos adicionais
        };
      });

      // Criar pedido
      const orderRes = await api.post('/orders', {
        ped_cliente:    faniaData.client.cli_codigo,
        ped_vendedor:   faniaData.client.cli_vendedor,
        ped_industria:  faniaData.industry.for_codigo,
        ped_tabela:     faniaData.selectedTable,
        ped_cliind:     faniaData.nf_numero,
        ped_obs:        `Importado via Portal FANIA — NF ${faniaData.nf_numero}`,
        ped_totbruto:   totbruto,
        ped_totliq:     totliq,
        ped_totalipi:   totalipi,
        ped_situacao:   'P',
        ped_tipofrete:  'C',
      });

      if (!orderRes.data.success) throw new Error(orderRes.data.message);
      const pedido = orderRes.data.data.ped_pedido;

      // Sincronizar itens
      await api.post(`/order-items/${pedido}/sync`, { items: syncItems });

      setCreatedId(pedido);
      setStep('success');
      toast.success(`Pedido ${pedido} criado com ${matchedItems.length} item(s)!`);
      onOrderCreated?.(pedido);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message || 'Erro ao criar pedido.');
    } finally {
      setCreating(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const PURPLE = '#8B5CF6';
  const matchedCount  = faniaData?.items.filter(it => it.matched).length ?? 0;
  const totalCount    = faniaData?.items.length ?? 0;

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(22,36,54,0.55)', backdropFilter: 'blur(4px)' }}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '80vw', maxWidth: 940, maxHeight: '90vh',
          background: G.bg, borderRadius: 20, border: `1px solid ${G.border}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: G.card }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${PURPLE}18`, border: `1px solid ${PURPLE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCode size={18} style={{ color: PURPLE }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: G.text, margin: 0 }}>Portal FANIA — Importação de NF-e</p>
            <p style={{ fontSize: 11, color: G.textMuted, margin: '2px 0 0' }}>
              {step === 'upload'     && 'Arraste o arquivo XML da Nota Fiscal para criar um novo pedido automaticamente'}
              {step === 'processing' && 'Processando XML e identificando produtos...'}
              {step === 'preview'    && `${matchedCount} de ${totalCount} produto(s) identificados`}
              {step === 'success'    && `Pedido ${createdId} criado com sucesso`}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ── Upload ── */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? PURPLE : G.border}`, borderRadius: 18, padding: '64px 24px', textAlign: 'center', background: dragging ? '#F5F3FF' : G.card, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
            >
              <input ref={fileRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              <div style={{ width: 64, height: 64, borderRadius: 18, background: `${PURPLE}18`, border: `1px solid ${PURPLE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileCode size={30} style={{ color: dragging ? PURPLE : G.textMuted }} />
              </div>
              <div>
                <p style={{ fontWeight: 900, fontSize: 15, color: G.text, margin: '0 0 6px' }}>Arraste o XML da NF-e FANIA aqui</p>
                <p style={{ fontSize: 12, color: G.textMuted, margin: 0 }}>ou clique para selecionar · aceita arquivos .xml de Nota Fiscal Eletrônica</p>
              </div>
            </div>
          )}

          {/* ── Processing ── */}
          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 0', color: G.textMuted }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: PURPLE }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Processando NF-e e identificando produtos...</span>
            </div>
          )}

          {/* ── Preview ── */}
          {step === 'preview' && faniaData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Industry + Client cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Industry */}
                <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', borderLeft: `3px solid ${PURPLE}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `${PURPLE}18`, border: `1px solid ${PURPLE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={16} style={{ color: PURPLE }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Indústria Emitente</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginTop: 2 }}>{faniaData.industry.for_nomered}</div>
                    <div style={{ fontSize: 10, color: G.textMuted, fontFamily: 'monospace', marginTop: 1 }}>{fmtCnpj(faniaData.industry.for_cgc)}</div>
                  </div>
                  <CheckCircle2 size={16} style={{ color: '#16A34A', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
                {/* Client */}
                <div style={{ background: G.card, border: `1px solid ${faniaData.client ? G.border : '#FECACA'}`, borderRadius: 14, padding: '14px 18px', borderLeft: `3px solid ${faniaData.client ? '#16A34A' : '#DC2626'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `${faniaData.client ? '#16A34A' : '#DC2626'}18`, border: `1px solid ${faniaData.client ? '#16A34A' : '#DC2626'}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User2 size={16} style={{ color: faniaData.client ? '#16A34A' : '#DC2626' }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Cliente Destinatário</div>
                    {faniaData.client
                      ? <><div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginTop: 2 }}>{faniaData.client.cli_nomred}</div>
                          <div style={{ fontSize: 10, color: G.textMuted, fontFamily: 'monospace', marginTop: 1 }}>{fmtCnpj(faniaData.client.cli_cnpj)}</div></>
                      : <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginTop: 4 }}>Cliente não identificado no sistema</div>
                    }
                  </div>
                  {faniaData.client
                    ? <CheckCircle2 size={16} style={{ color: '#16A34A', marginLeft: 'auto', flexShrink: 0 }} />
                    : <AlertTriangle size={16} style={{ color: '#DC2626', marginLeft: 'auto', flexShrink: 0 }} />
                  }
                </div>
              </div>

              {/* Tabela + NF info */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Tabela de Preços</label>
                  {faniaData.tables.length > 1
                    ? (
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <select
                          value={faniaData.selectedTable}
                          onChange={e => handleTableChange(e.target.value)}
                          style={{ padding: '6px 28px 6px 10px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, fontSize: 12, fontWeight: 700, color: G.text, appearance: 'none', cursor: 'pointer', outline: 'none' }}
                        >
                          {faniaData.tables.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={12} style={{ position: 'absolute', right: 8, color: G.textMuted, pointerEvents: 'none' }} />
                      </div>
                    )
                    : <div style={{ padding: '6px 12px', borderRadius: 8, background: G.card, border: `1px solid ${G.border}`, fontSize: 12, fontWeight: 700, color: G.text }}>{faniaData.selectedTable}</div>
                  }
                </div>
                {faniaData.nf_numero && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Nº da NF</label>
                    <div style={{ padding: '6px 12px', borderRadius: 8, background: G.card, border: `1px solid ${G.border}`, fontSize: 12, fontWeight: 900, color: G.text, fontFamily: 'monospace' }}>{faniaData.nf_numero}</div>
                  </div>
                )}
                {/* KPI strip */}
                <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                  {[
                    { label: 'Encontrados', val: matchedCount, color: '#16A34A' },
                    { label: 'Não encontrados', val: totalCount - matchedCount, color: totalCount - matchedCount > 0 ? '#DC2626' : G.textMuted },
                    { label: 'Total itens', val: totalCount, color: PURPLE },
                  ].map(k => (
                    <div key={k.label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '8px 14px', borderTop: `2px solid ${k.color}`, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: 'monospace' }}>{k.val}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', marginTop: 2 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Not found errors */}
              {notFound.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FECACA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={13} style={{ color: '#DC2626' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626' }}>{notFound.length} código(s) não encontrados na tabela</span>
                    </div>
                    <button onClick={() => downloadErrors(notFound)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEE2E2', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#991B1B' }}>
                      <Download size={10} /> Baixar lista
                    </button>
                  </div>
                  <div style={{ maxHeight: 60, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {notFound.map(c => <span key={c} style={{ padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', fontSize: 10, fontFamily: 'monospace', color: '#991B1B' }}>{c}</span>)}
                  </div>
                </div>
              )}

              {/* Items preview table */}
              <div style={{ borderRadius: 12, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: G.cardHi, borderBottom: `1px solid ${G.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <Package size={11} style={{ marginRight: 6, verticalAlign: 'middle', color: PURPLE }} />
                    Itens da NF-e
                  </span>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead><tr style={{ background: G.cardHi }}>
                      {['cProd (NF)', 'Cód. (5)', 'Cód. RepOne', 'Descrição', 'Qtd', 'Preço', 'IPI', 'ST', 'Status'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 800, color: G.textMuted, fontSize: 9, textTransform: 'uppercase', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {faniaData.items.map((it, i) => (
                        <tr key={i} style={{ background: it.matched ? (i % 2 === 0 ? G.card : G.cardHi) : '#FFF5F5' }}>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, color: G.textMuted }}>{it.rawCode}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 900, fontSize: 11, color: PURPLE }}>{it.code5}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 900, fontSize: 11, color: G.text }}>{it.matched?.pro_codigo || '—'}</td>
                          <td style={{ padding: '5px 10px', color: G.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.matched?.pro_nome || it.rawCode}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right' }}>{it.qty}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right' }}>{it.price > 0 ? it.price.toFixed(2) : '—'}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right', color: it.ipi > 0 ? '#DC2626' : G.textMuted }}>{it.ipi > 0 ? `${it.ipi.toFixed(1)}%` : '—'}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right', color: it.st  > 0 ? '#D97600' : G.textMuted }}>{it.st  > 0 ? `${it.st.toFixed(1)}%`  : '—'}</td>
                          <td style={{ padding: '5px 10px' }}>
                            {it.matched
                              ? <span style={{ padding: '2px 7px', borderRadius: 5, background: '#DCFCE7', fontSize: 9, fontWeight: 800, color: '#16A34A' }}>OK</span>
                              : <span style={{ padding: '2px 7px', borderRadius: 5, background: '#FEE2E2', fontSize: 9, fontWeight: 800, color: '#DC2626' }}>NÃO ENCONTRADO</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '60px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: '#DCFCE7', border: '2px solid #16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={36} style={{ color: '#16A34A' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: G.text }}>Pedido criado com sucesso!</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: PURPLE, fontFamily: 'monospace', marginTop: 8 }}>{createdId}</div>
                <div style={{ fontSize: 12, color: G.textMuted, marginTop: 6 }}>
                  {matchedCount} item(s) importados via Portal FANIA
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setStep('upload'); setFaniaData(null); setNotFound([]); setCreatedId(''); }} style={{ padding: '9px 22px', borderRadius: 9, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.textMuted }}>
                  Novo XML
                </button>
                <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 9, border: 'none', background: PURPLE, fontSize: 12, fontWeight: 900, cursor: 'pointer', color: '#fff' }}>
                  <ExternalLink size={13} /> Ver Pedidos
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0, background: G.card }}>
            <button onClick={onClose} style={{ padding: '9px 22px', borderRadius: 9, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.textMuted }}>Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={creating || !faniaData?.client || matchedCount === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 28px', borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 900, cursor: (creating || !faniaData?.client || matchedCount === 0) ? 'not-allowed' : 'pointer', background: (faniaData?.client && matchedCount > 0) ? PURPLE : G.border, color: (faniaData?.client && matchedCount > 0) ? '#fff' : G.textMuted, opacity: creating ? 0.7 : 1, transition: 'all 0.15s' }}
            >
              {creating ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Criando pedido...</>
                        : <><CheckCircle2 size={13} /> Criar Pedido ({matchedCount} item{matchedCount !== 1 ? 's' : ''})</>}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );

  return createPortal(content, document.body);
}
