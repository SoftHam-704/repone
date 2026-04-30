import React, { useState, useRef } from 'react';
import { Upload, FileCode, FileText, Table2, Wand2, X, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { toast } from 'sonner';
import type { ItemRow } from './ConferenciaSection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogItem {
  pro_codigo: string;
  pro_embalagem?: number;
  pro_codigooriginal?: string;
  pro_nome?: string;
  pro_grupo?: number;
  preco_bruto?: number;
  preco_promo?: number;
  preco_especial?: number;
  ipi?: number;
  st?: number;
  grupo_desconto?: number;
  pro_codbarras?: string;
}

interface OrderFull {
  ped_pedido: string;
  ped_industria: number;
  ped_cliente: number;
  ped_pri?: number; ped_seg?: number; ped_ter?: number;
  ped_qua?: number; ped_qui?: number; ped_sex?: number;
  ped_set?: number; ped_oit?: number; ped_nov?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LINE_H = 19.2; // matches monospace 12px × 1.6 line-height

// ─── Shared Matching Pipeline ─────────────────────────────────────────────────

const normalize = (s: string) =>
  String(s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

function matchProduct(rawCode: string, items: CatalogItem[]): CatalogItem | null {
  const code = String(rawCode || '').trim().replace(/^["']|["']$/g, '');
  if (!code) return null;

  // Pass 1: Exact
  const exact = items.find(p => p.pro_codigo === code);
  if (exact) return exact;

  // Pass 2: EAN/barcode
  const ean = items.find(p => p.pro_codbarras === code);
  if (ean) return ean;

  // Pass 3: Code original
  const orig = items.find(p => p.pro_codigooriginal === code);
  if (orig) return orig;

  // Pass 4: Normalized (remove all non-alphanumeric)
  const normCode = normalize(code);
  if (normCode) {
    const norm = items.find(p => 
      normalize(p.pro_codigo) === normCode ||
      normalize(p.pro_codigooriginal || '') === normCode ||
      normalize(p.pro_codbarras || '') === normCode
    );
    if (norm) return norm;
  }

  // Pass 5: Numeric strict (≥ 3 digits)
  if (/^\d{3,}$/.test(code)) {
    const n = parseInt(code);
    const num = items.find(p => {
       if (!/^\d+$/.test(p.pro_codigo)) return false;
       return parseInt(p.pro_codigo) === n;
    });
    if (num) return num;
  }

  // Pass 6: Fragment (split / | ; , space -)
  const frags = code.split(/[\/|;,\s\-]+/).filter(f => f.length >= 3);
  for (const frag of frags) {
    const fm = items.find(p => p.pro_codigo === frag || normalize(p.pro_codigo) === normalize(frag));
    if (fm) return fm;
  }

  return null;
}

function parseBrFloat(str: string | undefined | null): number | null {
  if (!str) return null;
  let clean = str.replace(/[^\d.,-]/g, '').trim();
  if (!clean) return null;
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function buildItem(
  product: CatalogItem,
  qty: number,
  price: number | null,
  embuch: string,
  ipiOverride: number | null,
  stOverride: number | null,
  order: OrderFull,
  seq: number,
): ItemRow {
  const hasCustomPrice = price !== null && price > 0;
  const puni = hasCustomPrice ? price! : (product.preco_promo || product.preco_especial || product.preco_bruto || 0);
  // Preço promoção: quando a tabela tem preco_promo OU quando veio preço importado (preço negociado = sem descontos adicionais)
  const isTablePromo = (parseFloat(String(product.preco_promo)) || 0) > 0;
  const isPromo = hasCustomPrice || isTablePromo;

  const des = isPromo
    ? { d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6: 0, d7: 0, d8: 0, d9: 0 }
    : {
        d1: order.ped_pri || 0, d2: order.ped_seg || 0, d3: order.ped_ter || 0,
        d4: order.ped_qua || 0, d5: order.ped_qui || 0, d6: order.ped_sex || 0,
        d7: order.ped_set || 0, d8: order.ped_oit || 0, d9: order.ped_nov || 0,
      };

  const ipi = ipiOverride ?? (product.ipi || 0);
  const st  = stOverride  ?? (product.st  || 0);

  let liq = puni;
  [des.d1, des.d2, des.d3, des.d4, des.d5, des.d6, des.d7, des.d8, des.d9]
    .forEach(d => { liq = liq * (1 - d / 100); });

  const totbruto   = puni * qty;
  const totliquido = liq  * qty;
  const valcomipi  = totliquido * (1 + ipi / 100);
  const valcomst   = valcomipi  * (1 + st  / 100);

  return {
    tempId:        `import-${Date.now()}-${seq}-${Math.random().toString(36).slice(2)}`,
    ite_seq:       seq,
    ite_industria: order.ped_industria,
    ite_produto:   product.pro_codigo,
    ite_embuch:    embuch || '',
    ite_nomeprod:  product.pro_nome || '',
    ite_grupo:     product.pro_grupo || 0,
    ite_quant:     qty,
    ite_puni:      puni,
    ite_puniliq:   liq,
    ite_des1:  des.d1, ite_des2: des.d2, ite_des3: des.d3,
    ite_des4:  des.d4, ite_des5: des.d5, ite_des6: des.d6,
    ite_des7:  des.d7, ite_des8: des.d8, ite_des9: des.d9,
    ite_des10: 0, ite_des11: 0,
    ite_ipi:  ipi, ite_st: st,
    ite_totbruto: totbruto, ite_totliquido: totliquido,
    ite_valcomipi: valcomipi, ite_valcomst: valcomst,
    ite_promocao:  isTablePromo ? 'S' : (hasCustomPrice ? 'S' : 'N'),
  };
}

// ─── Shared Modal Shell ────────────────────────────────────────────────────────

function ModalShell({
  title, subtitle, icon: Icon, color, children, onClose,
}: {
  title: string; subtitle: string;
  icon: React.ElementType; color: string;
  children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '80vw', maxWidth: 900, maxHeight: '90vh', background: G.card, borderRadius: 18,
          border: `1px solid ${G.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}18`, border: `1px solid ${color}30`,
          }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: G.text, margin: 0 }}>{title}</p>
            <p style={{ fontSize: 11, color: G.textMuted, margin: '2px 0 0' }}>{subtitle}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted }}>
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Error panel ──────────────────────────────────────────────────────────────

function ErrorPanel({ codes, onDownload }: { codes: string[]; onDownload: () => void }) {
  if (codes.length === 0) return null;
  return (
    <div style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FECACA' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} style={{ color: '#DC2626' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626' }}>{codes.length} código(s) não encontrado(s)</span>
        </div>
        <button onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEE2E2', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#991B1B' }}>
          <Download size={10} /> Baixar TXT
        </button>
      </div>
      <div style={{ maxHeight: 80, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {codes.map(c => (
          <span key={c} style={{ padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', fontSize: 10, fontFamily: 'monospace', color: '#991B1B' }}>{c}</span>
        ))}
      </div>
    </div>
  );
}

function downloadErrors(codes: string[]) {
  const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `nao_encontrados_${Date.now()}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ─── XLS Modal ────────────────────────────────────────────────────────────────

const XLS_COLS = [
  { key: 'codes',  label: '1. Códigos',       color: '#0D9488', ph: 'Cole aqui os códigos dos produtos (um por linha)...',           note: null },
  { key: 'compls', label: '2. Complementos',  color: '#2563EB', ph: 'Cole aqui os complementos (ite_embuch)...',                    note: null },
  { key: 'qtds',   label: '3. Quantidades',   color: '#16A34A', ph: 'Cole aqui as quantidades (uma por linha)...',                  note: null },
  { key: 'prices', label: '4. Preços (Opcional)', color: '#D97706', ph: 'Cole aqui os preços unitários negociados (opcional - substitui o preço da tabela)...', note: 'Preço especial — ignora tabela' },
] as const;

export function XmsModal({ order, priceTableItems, orderItems, setOrderItems, onClose, onDone }: {
  order: OrderFull; priceTableItems: CatalogItem[];
  orderItems: ItemRow[]; setOrderItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;
  onClose: () => void; onDone: () => void;
}) {
  const [vals, setVals] = useState({ codes: '', compls: '', qtds: '', prices: '' });
  const [errors,  setErrors]  = useState<string[]>([]);
  const [preview, setPreview] = useState<ItemRow[]>([]);

  const set = (key: keyof typeof vals) => (v: string) => setVals(prev => ({ ...prev, [key]: v }));

  const countLines = (v: string) => v.split('\n').filter(l => l.trim()).length;
  const itemsLoaded = priceTableItems.length > 0;

  function deleteLine(_key: keyof typeof vals, idx: number) {
    // Delete same line index in ALL columns to keep alignment
    setVals(prev => {
      const next = { ...prev };
      (Object.keys(next) as (keyof typeof vals)[]).forEach(k => {
        const ls = next[k].split('\n');
        ls.splice(idx, 1);
        next[k] = ls.join('\n');
      });
      return next;
    });
  }

  function handleImport() {
    const codeLines  = vals.codes.split('\n').map(l => l.trim());
    const complLines = vals.compls.split('\n').map(l => l.trim());
    const qtdLines   = vals.qtds.split('\n').map(l => l.trim());
    const priceLines = vals.prices.split('\n').map(l => l.trim());

    if (codeLines.filter(Boolean).length === 0 || qtdLines.filter(Boolean).length === 0) {
      toast.error('Preencha pelo menos Códigos e Quantidades.'); return;
    }

    if (priceTableItems.length === 0) {
      toast.error('Tabela de preços vazia! Feche o modal e verifique a Indústria/Tabela selecionada.');
      return;
    }

    const matched: ItemRow[] = [];
    const unmatched: string[] = [];
    const startSeq = orderItems.length + 1;
    const maxLines = Math.max(codeLines.length, qtdLines.length, priceLines.length);

    for (let i = 0; i < maxLines; i++) {
      const code = codeLines[i] || '';
      if (!code) continue; // Pula linhas em branco mantendo o alinhamento

      const product = matchProduct(code, priceTableItems);
      if (!product) { unmatched.push(code); continue; }
      
      const qty   = parseBrFloat(qtdLines[i]) || 1;
      const price = parseBrFloat(priceLines[i]);
      matched.push(buildItem(product, qty, price, complLines[i] || '', null, null, order, startSeq + matched.length));
    }

    setErrors(unmatched);
    setPreview(matched);
  }

  function handleConfirm() {
    if (preview.length === 0) { toast.error('Nenhum item para importar.'); return; }
    setOrderItems(prev => {
      const merged = [...prev];
      preview.forEach(newItem => {
        const existingIdx = merged.findIndex(it => it.ite_produto === newItem.ite_produto);
        if (existingIdx >= 0) {
          const existing = merged[existingIdx];
          const totalQuant = existing.ite_quant + newItem.ite_quant;

          const totbruto   = (existing.ite_puni || 0) * totalQuant;
          const totliquido = (existing.ite_puniliq || 0) * totalQuant;
          const valcomipi  = totliquido * (1 + (existing.ite_ipi || 0) / 100);
          const valcomst   = valcomipi  * (1 + (existing.ite_st  || 0) / 100);

          merged[existingIdx] = {
            ...existing,
            ite_quant: totalQuant,
            ite_totbruto: totbruto,
            ite_totliquido: totliquido,
            ite_valcomipi: valcomipi,
            ite_valcomst: valcomst
          };
        } else {
          merged.push({ ...newItem, ite_seq: merged.length + 1 });
        }
      });
      return merged.map((it, i) => ({ ...it, ite_seq: i + 1 }));
    });
    toast.success(`${preview.length} item(s) importados com sucesso.`);
    onDone(); onClose();
  }

  function handleClear() {
    setVals({ codes: '', compls: '', qtds: '', prices: '' });
    setErrors([]); setPreview([]);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw', maxWidth: 1100, maxHeight: '90vh',
          background: G.cardHi, borderRadius: 18,
          border: `1px solid ${G.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* ── Banner ── */}
        <div style={{
          background: '#FEF3C7', borderBottom: '2px solid #F59E0B',
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Table2 size={18} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 13, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.8 }}>Importação via Excel</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#B45309' }}>Cole os dados das colunas do Excel. Cada linha é um item.</p>
              <span style={{
                fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 20,
                background: itemsLoaded ? '#10B98122' : '#EF444422',
                color: itemsLoaded ? '#059669' : '#DC2626',
                border: `1px solid ${itemsLoaded ? '#10B98140' : '#EF444440'}`,
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                {itemsLoaded ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                {itemsLoaded ? `${priceTableItems.length} itens na tabela` : 'TABELA NÃO CARREGADA'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #F59E0B', background: '#FDE68A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#92400E' }}>
            <X size={14} />
          </button>
        </div>

        {/* ── Columns ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, overflow: 'hidden', minHeight: 480 }}>
          {XLS_COLS.map(col => {
            const key = col.key as keyof typeof vals;
            return (
              <XlsColField
                key={col.key}
                col={col}
                value={vals[key]}
                onChange={set(key)}
                onDeleteLine={(idx) => deleteLine(key, idx)}
              />
            );
          })}
        </div>


        {/* ── Error panel ── */}
        {errors.length > 0 && (
          <div style={{ padding: '8px 16px', background: '#FFF5F5', borderTop: '1px solid #FECACA', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={13} style={{ color: '#DC2626', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', flex: 1 }}>{errors.length} código(s) não encontrado(s): {errors.slice(0, 8).join(', ')}{errors.length > 8 ? '...' : ''}</span>
            <button onClick={() => downloadErrors(errors)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEE2E2', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#991B1B' }}>
              <Download size={10} /> Baixar TXT
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${G.border}`, background: G.card, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: G.textMuted, flex: 1 }}>
            <strong style={{ color: G.text }}>Dica:</strong> Copie as colunas diretamente do Excel (Ctrl+C) e cole nos campos correspondentes (Ctrl+V)
          </span>
          <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 9, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.text }}>
            <X size={12} /> Limpar Tudo
          </button>
          {preview.length > 0
            ? <button onClick={handleConfirm} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 20px', borderRadius: 9, border: 'none', background: G.mustard, fontSize: 12, fontWeight: 900, cursor: 'pointer', color: G.text }}>
                <CheckCircle2 size={13} /> Confirmar {preview.length} item(s)
              </button>
            : <button onClick={handleImport} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 20px', borderRadius: 9, border: 'none', background: '#10B981', fontSize: 12, fontWeight: 900, cursor: 'pointer', color: '#fff' }}>
                <Table2 size={13} /> Importar Itens
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── TXT Modal ────────────────────────────────────────────────────────────────

export function TxtModal({ order, priceTableItems, orderItems, setOrderItems, onClose, onDone }: {
  order: OrderFull; priceTableItems: CatalogItem[];
  orderItems: ItemRow[]; setOrderItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;
  onClose: () => void; onDone: () => void;
}) {
  const [content, setContent] = useState('');
  const [errors,  setErrors]  = useState<string[]>([]);
  const [preview, setPreview] = useState<ItemRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseContent(text: string): Array<{ code: string; qty: number; price: number | null }> {
    const lines = text.split('\n');

    // Try PP2 format (fixed-width)
    const pp2Lines = lines.filter(l => l.startsWith('PP2'));
    if (pp2Lines.length > 0) {
      return pp2Lines.map(l => ({
        code:  l.substring(3, 31).trim(),
        qty:   parseFloat(l.substring(32, 42).trim()) || 1,
        price: parseFloat(l.substring(67, 79).trim()) / 100000 || null,
      })).filter(r => r.code);
    }

    // Try Catálogo format (Stahl, Arca, KV — CÓDIGO/QUANTIDADE/PREÇO blocks)
    // Handles ISO-8859-1 artifacts: C?DIGO, PRE?O, etc.
    const catalogMatches = [...text.matchAll(/C[OÓo\?]DIGO[:\s]+(\S+)/gi)];
    if (catalogMatches.length > 0) {
      return catalogMatches.map(m => {
        const pos = m.index!;
        // Extract block from this match to next separator or EOF
        const block = text.substring(pos, pos + 400);
        const qtyMatch   = block.match(/QUANTIDADE[:\s]+([\d,.]+)/i);
        // Price: R$ followed by optional special chars then digits
        const priceMatch = block.match(/R\$\s*[^\d]*([\d.]+,\d{2}|[\d]+[.,]\d{2})/i);
        const qty   = qtyMatch  ? parseFloat(qtyMatch[1].replace(',', '.'))  || 1    : 1;
        const price = priceMatch ? parseFloat(priceMatch[1].replace('.', '').replace(',', '.')) || null : null;
        return { code: m[1].trim(), qty, price: price && price > 0 ? price : null };
      }).filter(r => r.code);
    }

    // Fallback: one code per line (tab/semicolon/space separated)
    return lines
      .map(l => l.trim()).filter(Boolean)
      .map(l => {
        const parts = l.split(/[\t;,\s]+/);
        return {
          code:  parts[0] || '',
          qty:   parseFloat((parts[1] || '1').replace(',', '.')) || 1,
          price: parts[2] ? (parseFloat(parts[2].replace(',', '.')) || null) : null,
        };
      }).filter(r => r.code);
  }

  function handleProcess() {
    const parsed = parseContent(content);
    if (parsed.length === 0) { toast.error('Nenhum item reconhecido. Verifique o formato.'); return; }

    const matched: ItemRow[] = [];
    const unmatched: string[] = [];
    const startSeq = orderItems.length + 1;

    parsed.forEach(({ code, qty, price }) => {
      const product = matchProduct(code, priceTableItems);
      if (!product) { unmatched.push(code); return; }
      matched.push(buildItem(product, qty, price, '', null, null, order, startSeq + matched.length));
    });

    setErrors(unmatched);
    setPreview(matched);
  }

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Try UTF-8 first; if replacement chars (�) dominate, re-read as latin-1
    let text = await file.text();
    const replacements = (text.match(/\uFFFD/g) || []).length;
    if (replacements > 3) {
      const buf = await file.arrayBuffer();
      text = new TextDecoder('windows-1252').decode(buf);
    }
    setContent(text);
    e.target.value = '';
  }

  function handleConfirm() {
    if (preview.length === 0) { toast.error('Nenhum item para importar.'); return; }
    setOrderItems(prev => {
      const merged = [...prev];
      preview.forEach(newItem => {
        const existingIdx = merged.findIndex(it => it.ite_produto === newItem.ite_produto);
        if (existingIdx >= 0) {
          const existing = merged[existingIdx];
          const totalQuant = existing.ite_quant + newItem.ite_quant;

          const totbruto   = (existing.ite_puni || 0) * totalQuant;
          const totliquido = (existing.ite_puniliq || 0) * totalQuant;
          const valcomipi  = totliquido * (1 + (existing.ite_ipi || 0) / 100);
          const valcomst   = valcomipi  * (1 + (existing.ite_st  || 0) / 100);

          merged[existingIdx] = {
            ...existing,
            ite_quant: totalQuant,
            ite_totbruto: totbruto,
            ite_totliquido: totliquido,
            ite_valcomipi: valcomipi,
            ite_valcomst: valcomst
          };
        } else {
          merged.push({ ...newItem, ite_seq: merged.length + 1 });
        }
      });
      return merged.map((it, i) => ({ ...it, ite_seq: i + 1 }));
    });
    toast.success(`${preview.length} item(s) importados com sucesso.`);
    onDone(); onClose();
  }

  return (
    <ModalShell title="TXT — Importar via Texto" subtitle="Suporta: PP2, Catálogo (Stahl/Arca/KV) ou código · qtd · preço separados por tab/vírgula" icon={FileText} color="#F59E0B" onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={handleFileLoad} />
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: G.text }}>
            <Upload size={12} /> Carregar arquivo .txt / .csv
          </button>
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={'PP2CODE000001    000010000000 ...\n\nou:\n\nCÓDIGO: ABC-001\nQUANTIDADE: 10\nPREÇO UNITÁRIO: R$ 45,90\n\nou simplesmente:\n\nABC-001\t10\t45,90'}
          style={{
            width: '100%', height: 340, padding: '12px 14px', borderRadius: 10,
            border: `1px solid ${G.border}`, background: G.cardHi,
            fontSize: 12, fontFamily: 'monospace', resize: 'none',
            outline: 'none', boxSizing: 'border-box', color: G.text, lineHeight: 1.6,
          }}
        />

        <ErrorPanel codes={errors} onDownload={() => downloadErrors(errors)} />

        {preview.length > 0 && (
          <div style={{ marginTop: 16, borderRadius: 10, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: G.cardHi, borderBottom: `1px solid ${G.border}` }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <CheckCircle2 size={11} style={{ color: '#10B981', marginRight: 5, verticalAlign: 'middle' }} />
                {preview.length} item(s) prontos
              </span>
            </div>
            <div style={{ maxHeight: 140, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: G.cardHi }}>
                  {['Código', 'Descrição', 'Qtd', 'Bruto'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 800, color: G.textMuted, fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {preview.map((it, i) => (
                    <tr key={it.tempId} style={{ background: i % 2 === 0 ? G.card : G.cardHi }}>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 700, color: G.textSec }}>{it.ite_produto}</td>
                      <td style={{ padding: '5px 10px', color: G.text }}>{it.ite_nomeprod}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{it.ite_quant}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{(it.ite_puni || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 9, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.textMuted }}>Cancelar</button>
        {preview.length === 0
          ? <button onClick={handleProcess} style={{ padding: '8px 24px', borderRadius: 9, border: 'none', background: '#F59E0B', fontSize: 12, fontWeight: 900, cursor: 'pointer', color: '#fff' }}>Processar</button>
          : <button onClick={handleConfirm} style={{ padding: '8px 24px', borderRadius: 9, border: 'none', background: G.mustard, fontSize: 12, fontWeight: 900, cursor: 'pointer', color: G.text }}>Confirmar {preview.length} item(s)</button>
        }
      </div>
    </ModalShell>
  );
}

// ─── XML Modal ────────────────────────────────────────────────────────────────

export function XmlModal({ order, priceTableItems, orderItems, setOrderItems, onClose, onDone }: {
  order: OrderFull; priceTableItems: CatalogItem[];
  orderItems: ItemRow[]; setOrderItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;
  onClose: () => void; onDone: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [errors,   setErrors]   = useState<string[]>([]);
  const [preview,  setPreview]  = useState<ItemRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function getText(el: Element, tag: string) {
    return el.querySelector(tag)?.textContent?.trim() || '';
  }

  function parseXml(file: File) {
    file.text().then(text => {
      const parser = new DOMParser();
      const doc    = parser.parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) { toast.error('XML inválido ou corrompido.'); return; }

      const dets = Array.from(doc.querySelectorAll('det'));
      if (dets.length === 0) { toast.error('Nenhum item (<det>) encontrado no XML.'); return; }

      const matched: ItemRow[] = [];
      const unmatched: string[] = [];
      const startSeq = orderItems.length + 1;

      dets.forEach(det => {
        const prod  = det.querySelector('prod');
        if (!prod) return;

        const rawCode = getText(prod, 'cProd');
        const ean     = getText(prod, 'cEAN');
        const rawQty  = getText(prod, 'qCom');
        const rawPrice = getText(prod, 'vUnCom');
        const unit    = getText(prod, 'uCom').toUpperCase();
        const imposto = det.querySelector('imposto');
        const ipiTxt  = imposto?.querySelector('pIPI')?.textContent?.trim() || '';
        const stTxt   = imposto?.querySelector('pICMSST, pMVAST')?.textContent?.trim() || '';
        const ipiXml  = ipiTxt  ? (parseFloat(ipiTxt)  || null) : null;
        const stXml   = stTxt   ? (parseFloat(stTxt)   || null) : null;

        // Try EAN first, then code
        const product = (ean ? matchProduct(ean, priceTableItems) : null) || matchProduct(rawCode, priceTableItems);
        if (!product) { unmatched.push(rawCode || ean); return; }

        let qty   = parseFloat(rawQty)   || 1;
        const price = parseFloat(rawPrice) || null;

        // Unit conversion: CX → UN
        if (unit.startsWith('CX')) {
          const pack = product.pro_embalagem || 1;
          qty = qty * pack;
        }

        matched.push(buildItem(product, qty, price, '', ipiXml, stXml, order, startSeq + matched.length));
      });

      setErrors(unmatched);
      setPreview(matched);
      setFileName(file.name);
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.xml')) parseXml(file);
    else toast.error('Selecione um arquivo .xml');
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseXml(file);
    e.target.value = '';
  }

  function handleConfirm() {
    if (preview.length === 0) { toast.error('Nenhum item para importar.'); return; }

    setOrderItems(prev => {
      const merged = [...prev];
      preview.forEach(newItem => {
        const existingIdx = merged.findIndex(it => it.ite_produto === newItem.ite_produto);
        if (existingIdx >= 0) {
          const existing = merged[existingIdx];
          const totalQuant = existing.ite_quant + newItem.ite_quant;

          const totbruto   = (existing.ite_puni || 0) * totalQuant;
          const totliquido = (existing.ite_puniliq || 0) * totalQuant;
          const valcomipi  = totliquido * (1 + (existing.ite_ipi || 0) / 100);
          const valcomst   = valcomipi  * (1 + (existing.ite_st  || 0) / 100);

          merged[existingIdx] = {
            ...existing,
            ite_quant: totalQuant,
            ite_totbruto: totbruto,
            ite_totliquido: totliquido,
            ite_valcomipi: valcomipi,
            ite_valcomst: valcomst
          };
        } else {
          merged.push({ ...newItem, ite_seq: merged.length + 1 });
        }
      });
      return merged.map((it, i) => ({ ...it, ite_seq: i + 1 }));
    });

    toast.success(`${preview.length} item(s) importados da NF-e.`);
    onDone(); onClose();
  }

  return (
    <ModalShell title="XML — Importar Nota Fiscal" subtitle="Arraste um arquivo .xml de NF-e ou clique para selecionar" icon={FileCode} color="#8B5CF6" onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#8B5CF6' : G.border}`,
            borderRadius: 14, padding: '32px 24px', textAlign: 'center',
            background: dragging ? '#F5F3FF' : G.cardHi,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <input ref={fileRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={onFileChange} />
          <FileCode size={32} style={{ color: dragging ? '#8B5CF6' : G.textMuted, marginBottom: 10 }} />
          {fileName
            ? <p style={{ fontWeight: 800, fontSize: 13, color: '#8B5CF6', margin: 0 }}>{fileName}</p>
            : <><p style={{ fontWeight: 700, fontSize: 13, color: G.text, margin: '0 0 4px' }}>Arraste o XML aqui</p>
               <p style={{ fontSize: 11, color: G.textMuted, margin: 0 }}>ou clique para selecionar</p></>
          }
        </div>

        <ErrorPanel codes={errors} onDownload={() => downloadErrors(errors)} />

        {preview.length > 0 && (
          <div style={{ marginTop: 16, borderRadius: 10, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: G.cardHi, borderBottom: `1px solid ${G.border}` }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <CheckCircle2 size={11} style={{ color: '#10B981', marginRight: 5, verticalAlign: 'middle' }} />
                {preview.length} item(s) extraídos da NF-e
              </span>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: G.cardHi }}>
                  {['Código', 'Descrição', 'Qtd', 'Bruto', 'IPI', 'ST'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 800, color: G.textMuted, fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {preview.map((it, i) => (
                    <tr key={it.tempId} style={{ background: i % 2 === 0 ? G.card : G.cardHi }}>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 700, color: G.textSec }}>{it.ite_produto}</td>
                      <td style={{ padding: '5px 10px', color: G.text }}>{it.ite_nomeprod}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{it.ite_quant}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{(it.ite_puni || 0).toFixed(2)}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: it.ite_ipi > 0 ? '#DC2626' : G.textMuted }}>{(it.ite_ipi || 0).toFixed(1)}%</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: it.ite_st > 0 ? '#D97600' : G.textMuted }}>{(it.ite_st || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 9, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.textMuted }}>Cancelar</button>
        {preview.length > 0 && (
          <button onClick={handleConfirm} style={{ padding: '8px 24px', borderRadius: 9, border: 'none', background: G.mustard, fontSize: 12, fontWeight: 900, cursor: 'pointer', color: G.text }}>Confirmar {preview.length} item(s)</button>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Magic Load Modal ─────────────────────────────────────────────────────────

type AiItem = { codigo: string; quantidade: number; preco?: number; descricao?: string };

export function MagicModal({ order, priceTableItems, orderItems, setOrderItems, onClose, onDone }: {
  order: OrderFull; priceTableItems: CatalogItem[];
  orderItems: ItemRow[]; setOrderItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;
  onClose: () => void; onDone: () => void;
}) {
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  // V1 flow: aiItems = ALL items returned by AI (shown for review before confirm)
  const [aiItems,   setAiItems]   = useState<AiItem[]>([]);
  const [fileName,  setFileName]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = '.pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp';

  async function processFile(file: File) {
    setFileName(file.name);
    setLoading(true);
    setAiItems([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('industria', String(order.ped_industria));

      const res = await fetch('/api/smart-order/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`Erro ${res.status} no servidor`);
      const data = await res.json();
      if (data.warning) toast.error(data.warning);
      const items: AiItem[] = data.items || [];

      if (items.length === 0) {
        toast.error('A IA não encontrou itens no arquivo. Verifique se o arquivo contém códigos de produto.');
      }
      setAiItems(items);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao processar arquivo com IA. Verifique o servidor.');
    } finally {
      setLoading(false);
    }
  }

  function removeItem(idx: number) {
    setAiItems(prev => prev.filter((_, i) => i !== idx));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleConfirm() {
    if (aiItems.length === 0) { toast.error('Nenhum item para importar.'); return; }

    const matched: ItemRow[] = [];
    const unmatched: string[] = [];
    const startSeq = orderItems.length + 1;

    aiItems.forEach(({ codigo, quantidade, preco }) => {
      const product = matchProduct(codigo, priceTableItems);
      if (!product) { unmatched.push(codigo); return; }
      const price = preco && preco > 0 ? preco : null;
      matched.push(buildItem(product, quantidade || 1, price, '', null, null, order, startSeq + matched.length));
    });

    if (matched.length === 0) {
      toast.error(`Nenhum código encontrado na tabela de preços. (${unmatched.length} não localizados)`);
      return;
    }

    setOrderItems(prev => {
      const merged = [...prev];
      matched.forEach(newItem => {
        const existingIdx = merged.findIndex(it => it.ite_produto === newItem.ite_produto);
        if (existingIdx >= 0) {
          const existing = merged[existingIdx];
          const totalQuant = existing.ite_quant + newItem.ite_quant;
          const totbruto   = (existing.ite_puni || 0) * totalQuant;
          const totliquido = (existing.ite_puniliq || 0) * totalQuant;
          const valcomipi  = totliquido * (1 + (existing.ite_ipi || 0) / 100);
          const valcomst   = valcomipi  * (1 + (existing.ite_st  || 0) / 100);
          merged[existingIdx] = { ...existing, ite_quant: totalQuant, ite_totbruto: totbruto, ite_totliquido: totliquido, ite_valcomipi: valcomipi, ite_valcomst: valcomst };
        } else {
          merged.push({ ...newItem, ite_seq: merged.length + 1 });
        }
      });
      return merged.map((it, i) => ({ ...it, ite_seq: i + 1 }));
    });

    if (unmatched.length > 0) {
      toast.success(`${matched.length} item(s) importados. ${unmatched.length} código(s) não encontrado(s) na tabela.`);
    } else {
      toast.success(`${matched.length} item(s) importados via Magic Load.`);
    }
    onDone(); onClose();
  }

  const dropRef  = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState({ x: 0, y: 0, on: false });

  function handleDropMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dropRef.current) return;
    const r = dropRef.current.getBoundingClientRect();
    setFlash({ x: e.clientX - r.left, y: e.clientY - r.top, on: true });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <style>{`
        @keyframes ml-pulse    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
        @keyframes ml-spin     { to{transform:rotate(360deg)} }
        @keyframes ml-orb      { 0%{transform:translate(0,0);opacity:.4} 50%{transform:translate(14px,-12px);opacity:.9} 100%{transform:translate(0,0);opacity:.4} }
        @keyframes ml-dot      { 0%,80%,100%{transform:scale(0.5);opacity:.25} 40%{transform:scale(1.1);opacity:1} }
        @keyframes ml-slide    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ml-scan     { 0%{top:0%} 100%{top:100%} }
        @keyframes ml-particle { 0%{transform:translateY(0) scale(1);opacity:.8} 100%{transform:translateY(-80px) scale(0);opacity:0} }
        @keyframes ml-ring     { 0%{transform:scale(0.6);opacity:.9} 100%{transform:scale(2.4);opacity:0} }
        @keyframes ml-aurora   { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ml-node     { 0%,100%{opacity:.3;r:2} 50%{opacity:1;r:3} }
        @keyframes ml-shimmer  { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>

      {/* ── Modal ── */}
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '80vw', maxWidth: 860, maxHeight: '90vh',
        background: '#030D1A',
        borderRadius: 22,
        border: '1px solid #0F2845',
        boxShadow: '0 0 0 1px #0EA5E910, 0 30px 80px rgba(0,0,0,0.75), 0 0 50px #0EA5E910',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── Neural network background ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 860 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="mlNodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="1" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Edges */}
          {([
            [80,120,210,60],[210,60,380,140],[380,140,520,80],[520,80,680,160],[680,160,800,100],
            [80,120,160,260],[210,60,300,200],[380,140,420,280],[520,80,560,240],[680,160,740,300],
            [160,260,300,200],[300,200,420,280],[420,280,560,240],[560,240,700,320],[700,320,800,260],
            [160,260,200,400],[300,200,340,360],[420,280,460,420],[560,240,580,400],[700,320,720,460],
            [200,400,340,360],[340,360,460,420],[460,420,580,400],[580,400,720,460],
            [200,400,220,520],[340,360,360,500],[460,420,480,540],[580,400,600,530],[720,460,760,540],
          ] as [number,number,number,number][]).map(([x1,y1,x2,y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0EA5E9" strokeWidth="0.6" strokeOpacity="0.25" />
          ))}
          {/* Nodes */}
          {([
            [80,120],[210,60],[380,140],[520,80],[680,160],[800,100],
            [160,260],[300,200],[420,280],[560,240],[700,320],[800,260],
            [200,400],[340,360],[460,420],[580,400],[720,460],
            [220,520],[360,500],[480,540],[600,530],[760,540],
          ] as [number,number][]).map(([cx,cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 3 : 2}
              fill={i % 4 === 0 ? '#38BDF8' : i % 3 === 0 ? '#0EA5E9' : '#06B6D4'}
              opacity="0.5"
              style={{ animation: `ml-node ${2 + (i % 3)}s ease-in-out ${(i * 0.3) % 2}s infinite` }}
            />
          ))}
        </svg>

        {/* ── Aurora glow layer ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'linear-gradient(135deg, #0EA5E918 0%, #06B6D412 30%, #06B6D410 60%, #0EA5E914 100%)',
          backgroundSize: '400% 400%',
          animation: 'ml-aurora 12s ease infinite',
        }} />

        {/* ── Header ── */}
        <div style={{ position: 'relative', zIndex: 1, padding: '22px 28px 18px', borderBottom: '1px solid #0A1E35', overflow: 'hidden', flexShrink: 0 }}>
          {/* Background orbs */}
          <div style={{ position: 'absolute', top: -30, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, #0EA5E944 0%, transparent 70%)', animation: 'ml-orb 6s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: -10, right: 20, width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle, #06B6D433 0%, transparent 70%)', animation: 'ml-orb 4s ease-in-out infinite reverse' }} />
          <div style={{ position: 'absolute', top: 10, left: '40%', width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle, #06B6D422 0%, transparent 70%)', animation: 'ml-orb 7s ease-in-out 1s infinite' }} />
          {/* Floating particles */}
          {[
            { left: '15%', delay: '0s',   size: 3, color: '#38BDF8' },
            { left: '30%', delay: '1.2s', size: 2, color: '#06B6D4' },
            { left: '55%', delay: '0.6s', size: 3, color: '#06B6D4' },
            { left: '72%', delay: '1.8s', size: 2, color: '#38BDF8' },
            { left: '85%', delay: '0.3s', size: 3, color: '#06B6D4' },
          ].map((p, i) => (
            <div key={i} style={{
              position: 'absolute', bottom: -4, left: p.left,
              width: p.size, height: p.size, borderRadius: '50%',
              background: p.color, boxShadow: `0 0 6px ${p.color}`,
              animation: `ml-particle 3s ease-out ${p.delay} infinite`,
            }} />
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            {/* Icon glow */}
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, #0EA5E9, #06B6D4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px #0EA5E966, 0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <Wand2 size={22} style={{ color: '#fff' }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.5, color: '#BAE6FD' }}>Magic Load</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                  background: 'linear-gradient(90deg, #0EA5E9, #06B6D4)',
                  color: '#fff', letterSpacing: 1, textTransform: 'uppercase',
                  boxShadow: '0 0 10px #0EA5E955',
                }}>IA</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#4BAAC0' }}>
                Envie um PDF, Excel ou imagem — a IA extrai os itens automaticamente
              </p>
            </div>

            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 9, border: '1px solid #0F2845',
              background: '#061525', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2E7A97', flexShrink: 0,
            }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !loading && fileRef.current?.click()}
            onMouseMove={handleDropMouseMove}
            onMouseLeave={() => setFlash(f => ({ ...f, on: false }))}
            style={{
              position: 'relative', borderRadius: 16, overflow: 'hidden',
              border: `2px dashed ${dragging ? '#38BDF8' : '#0F2845'}`,
              background: dragging ? '#06152588' : '#071020',
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: dragging ? '0 0 30px #0EA5E944 inset' : 'none',
              minHeight: 180,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <input ref={fileRef} type="file" accept={ACCEPTED} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />

            {/* Flashlight spotlight */}
            {flash.on && !loading && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: `radial-gradient(320px circle at ${flash.x}px ${flash.y}px, rgba(167,139,250,0.13), transparent 65%)`,
              }} />
            )}

            {/* Scan line when loading */}
            {loading && (
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #38BDF8, #06B6D4, transparent)',
                animation: 'ml-scan 1.6s ease-in-out infinite',
                boxShadow: '0 0 12px #38BDF8',
              }} />
            )}

            <div style={{ textAlign: 'center', padding: '28px 24px', position: 'relative', zIndex: 1 }}>
              {loading ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: i === 0 ? '#0EA5E9' : i === 1 ? '#06B6D4' : '#06B6D4',
                        animation: `ml-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 14, margin: '0 0 4px', color: '#BAE6FD' }}>
                    Analisando com IA...
                  </p>
                  <p style={{ fontSize: 11, color: '#2E7A97', margin: 0 }}>{fileName}</p>
                </>
              ) : fileName && aiItems.length > 0 ? (
                <>
                  <CheckCircle2 size={32} style={{ color: '#10B981', marginBottom: 10, filter: 'drop-shadow(0 0 8px #10B98155)' }} />
                  <p style={{ fontWeight: 800, fontSize: 13, color: '#6EE7B7', margin: '0 0 2px' }}>{fileName}</p>
                  <p style={{ fontSize: 11, color: '#2E7A97', margin: 0 }}>{aiItems.length} itens extraídos · clique para trocar o arquivo</p>
                </>
              ) : (
                <>
                  {/* Concentric sonar rings */}
                  <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{
                        position: 'absolute',
                        width: i * 38, height: i * 38,
                        borderRadius: '50%',
                        border: `1px solid ${i === 1 ? '#38BDF8' : i === 2 ? '#0EA5E9' : '#0C4A6E'}`,
                        animation: `ml-ring ${i * 0.7 + 1.4}s ease-out ${(i - 1) * 0.5}s infinite`,
                      }} />
                    ))}
                    {/* Icon */}
                    <div style={{
                      position: 'relative', zIndex: 2,
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0C4A6E, #0EA5E9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 30px #0EA5E966, 0 0 60px #0EA5E922',
                    }}>
                      {/* Shimmer overlay */}
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'ml-shimmer 2.5s ease-in-out infinite',
                      }} />
                      <Wand2 size={22} style={{ color: '#E9D5FF', position: 'relative' }} />
                    </div>
                  </div>

                  <p style={{ fontWeight: 900, fontSize: 15, color: '#BAE6FD', margin: '0 0 5px', letterSpacing: 0.3 }}>
                    {dragging ? '✦ Solte para processar' : 'Arraste o arquivo aqui'}
                  </p>
                  <p style={{ fontSize: 11, color: '#2E7A97', margin: '0 0 18px' }}>PDF · Excel · JPG · PNG · WEBP</p>

                  {/* Format badges */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                    {[
                      { label: 'PDF', color: '#EF4444' },
                      { label: 'EXCEL', color: '#22C55E' },
                      { label: 'IMAGEM', color: '#3B82F6' },
                    ].map(b => (
                      <span key={b.label} style={{
                        padding: '3px 10px', borderRadius: 20,
                        background: `${b.color}15`, border: `1px solid ${b.color}40`,
                        fontSize: 10, fontWeight: 800, color: b.color, letterSpacing: 0.8,
                      }}>{b.label}</span>
                    ))}
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20, border: '1px solid #103060', background: '#06152566', fontSize: 11, color: '#4BAAC0' }}>
                    <Upload size={11} /> ou clique para selecionar
                  </div>
                </>
              )}
            </div>
          </div>

          {/* V1-style: Preview table of ALL AI-extracted items */}
          {aiItems.length > 0 && !loading && (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #0A1E35', animation: 'ml-slide 0.3s ease-out' }}>
              <div style={{ padding: '8px 14px', background: '#071525', borderBottom: '1px solid #0A1E35', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 6px #10B981' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#6EE7B7', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Conferência de Itens ({aiItems.length})
                  </span>
                </div>
                <span style={{ fontSize: 9, color: '#2E7A97', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Revise antes de confirmar
                </span>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#071020' }}>
                      {['Código', 'Descrição', 'Qtd', 'Preço', ''].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Qtd' || h === 'Preço' ? 'center' : 'left', fontWeight: 800, color: '#0A3558', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiItems.map((it, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#030D1A' : '#071525', borderBottom: '1px solid #061525' }}>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#38BDF8' }}>{it.codigo}</td>
                        <td style={{ padding: '6px 12px', color: '#BAE6FD' }}>{it.descricao || 'Item importado via IA'}</td>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#4BAAC0', textAlign: 'center' }}>{it.quantidade}</td>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#4BAAC0', textAlign: 'center' }}>
                          {it.preco && it.preco > 0
                            ? it.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : <span style={{ color: '#2E7A97', fontStyle: 'italic' }}>sob consulta</span>
                          }
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                            title="Remover">
                            <X size={12} style={{ color: '#F87171' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #0A1E35', background: '#030D18', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <button onClick={onClose} style={{
            padding: '9px 22px', borderRadius: 10, border: '1px solid #0F2845',
            background: '#061525', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#2E7A97',
          }}>Cancelar</button>
          {aiItems.length > 0 && !loading && (
            <button onClick={handleConfirm} style={{
              padding: '9px 26px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0EA5E9, #06B6D4)',
              fontSize: 12, fontWeight: 900, cursor: 'pointer', color: '#fff',
              boxShadow: '0 0 20px #0EA5E955, 0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Wand2 size={13} /> Confirmar Tudo ({aiItems.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function XlsColField({ col, value, onChange, onDeleteLine }: {
  col: any;
  value: string;
  onChange: (v: string) => void;
  onDeleteLine: (idx: number) => void;
}) {
  const numRef = useRef<HTMLDivElement>(null);
  const count = value.split('\n').filter(l => l.trim()).length;
  const G = {
     border: '#E2E8F0',
     text: '#1E293B',
     cardHi: '#F8FAFC'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${G.border}`, overflow: 'hidden' }}>
      {/* Column header */}
      <div style={{ background: col.color, padding: '8px 14px', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>{col.label}</span>
      </div>

      {/* Textarea + gutter */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#fff' }}>
        {/* Gutter */}
        <div
          ref={numRef}
          style={{ width: 28, flexShrink: 0, overflowY: 'hidden', background: `${col.color}08`, borderRight: `1px solid ${col.color}20`, paddingTop: 10 }}
        >
          {value.split('\n').map((_: string, i: number) => (
            <div
              key={i}
              onClick={() => onDeleteLine(i)}
              style={{ height: 19.2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: `${col.color}80` }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={e => { if (numRef.current) numRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; }}
          placeholder={col.ph}
          spellCheck={false}
          style={{
            flex: 1, padding: '10px 10px', border: 'none', background: 'transparent',
            fontSize: 12, fontFamily: 'monospace', resize: 'none',
            outline: 'none', color: '#1E293B', lineHeight: '19.2px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Counter */}
      <div style={{ padding: '5px 10px', borderTop: `1px solid ${G.border}`, background: G.cardHi, flexShrink: 0 }}>
        {col.note
          ? <span style={{ fontSize: 10, fontWeight: 700, color: col.color }}>{col.note}</span>
          : <span style={{ fontSize: 10, fontWeight: 700, color: count > 0 ? col.color : '#94A3B8' }}>
              {count} {count === 1 ? 'linha' : 'linhas'}
            </span>
        }
      </div>
    </div>
  );
}
