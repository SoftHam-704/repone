import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useGridSort, useSortedRows, sortArrow } from '../utils/useGridSort';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, CheckCircle, Trash2 } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemRow {
  tempId: string;
  ite_seq: number;
  ite_industria: number;
  ite_produto: string;
  ite_embuch: string;
  ite_nomeprod: string;
  ite_grupo: number;
  ite_quant: number;
  ite_puni: number;
  ite_puniliq: number;
  ite_des1: number; ite_des2: number; ite_des3: number;
  ite_des4: number; ite_des5: number; ite_des6: number;
  ite_des7: number; ite_des8: number; ite_des9: number;
  ite_des10: number; ite_des11: number;
  ite_ipi: number;
  ite_st: number;
  ite_totbruto: number;
  ite_totliquido: number;
  ite_valcomipi: number;
  ite_valcomst: number;
  ite_promocao?: string;
  discountSource?: string;
}

interface CatalogItem {
  pro_codigo: string;
  pro_embalagem: number;
  pro_codigooriginal?: string;
  preco_bruto?: number;
  preco_promo?: number;
  preco_especial?: number;
  /** itab_prepeso — preço por kg (Modo A: base = preco_peso × pro_peso). */
  preco_peso?: number;
  /** cad_prod.pro_peso — peso do produto em kg. */
  pro_peso?: number;
  /** itab_descontoadd — desconto adicional da tabela (Modo B: entra no ite_des10). */
  desconto_add?: number;
  ipi?: number;
  st?: number;
  grupo_desconto?: number;
  pro_nome?: string;
}

interface OrderFull {
  ped_pedido: string;
  ped_industria: number;
  ped_cliente: number;
  ped_pri?: number; ped_seg?: number; ped_ter?: number;
  ped_qua?: number; ped_qui?: number; ped_sex?: number;
  ped_set?: number; ped_oit?: number; ped_nov?: number;
}

interface Props {
  order: OrderFull;
  orderItems: ItemRow[];
  setOrderItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;
  priceTableItems: CatalogItem[];
  isView: boolean;
  userParams: { usaDecimais: boolean; qtdDecimais: number; mostraCodigoOri?: boolean } | null;
  hasSuframa?: boolean;
  autoApplyGroupDisc?: boolean;
  onGroupDiscApplied?: () => void;
  onTotaisUpdated?: (totbruto: number, totliq: number, totalipi: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: any) =>
  (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v: any) =>
  (parseFloat(v) || 0).toFixed(2).replace('.', ',');

const n = (v: any) => parseFloat(v) || 0;

function calcLinha(it: ItemRow, casas = 2): ItemRow {
  let liq = n(it.ite_puni);
  [it.ite_des1, it.ite_des2, it.ite_des3, it.ite_des4, it.ite_des5,
   it.ite_des6, it.ite_des7, it.ite_des8, it.ite_des9].forEach(d => {
    liq = liq * (1 - n(d) / 100);
  });
  liq = liq * (1 - n(it.ite_des10) / 100);
  liq = liq * (1 - n(it.ite_des11) / 100);

  // Arredonda o LÍQUIDO UNITÁRIO na casa decimal configurada (par_qtddecimais),
  // pra ficar na mesma precisão do bruto. O total é unitário(arredondado) × qtd —
  // assim "unitário exibido × qtd = total", sem o vazamento de casas (1,674 vs 1,67).
  const pot = Math.pow(10, Math.max(0, Math.min(4, casas)));
  const puniliq    = Math.round(liq * pot) / pot;
  const totbruto   = Math.round((n(it.ite_puni) * n(it.ite_quant)) * 100) / 100;
  const totliquido = Math.round((puniliq * n(it.ite_quant)) * 100) / 100;
  const valcomipi  = Math.round((totliquido * (1 + n(it.ite_ipi) / 100)) * 100) / 100;
  const valcomst   = Math.round((valcomipi  * (1 + n(it.ite_st)  / 100)) * 100) / 100;

  return { ...it, ite_puniliq: puniliq, ite_totbruto: totbruto, ite_totliquido: totliquido, ite_valcomipi: valcomipi, ite_valcomst: valcomst };
}

// ─── Action button (top-level to avoid remount on parent re-render) ──────────

function ActionBtn({
  shortcut, label, onClick, danger = false,
}: { shortcut: string; label: string; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 12px 6px 8px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${danger ? '#FECACA' : hovered ? G.textSec + '40' : G.border}`,
        background: danger
          ? hovered ? '#FEE2E2' : '#FFF5F5'
          : hovered ? G.textSec + '10' : G.card,
        transition: 'all 0.12s ease',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.12)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 20, height: 20, borderRadius: 5,
        background: danger ? '#FCA5A5' : hovered ? G.textSec : G.cardHi,
        border: `1px solid ${danger ? '#F87171' : hovered ? G.textSec : G.border}`,
        fontSize: 10, fontWeight: 900, fontFamily: 'monospace',
        color: danger ? '#7F1D1D' : hovered ? '#fff' : G.textSec,
        transition: 'all 0.12s ease',
        flexShrink: 0, padding: '0 4px',
      }}>
        {shortcut}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: danger ? '#991B1B' : G.text,
        whiteSpace: 'nowrap', letterSpacing: 0.1,
      }}>
        {label}
      </span>
    </button>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditCell({
  value, onChange, align = 'right', mono = true, pct = false, disabled = false,
  onKeyDown,
}: {
  value: string; onChange: (v: string) => void;
  align?: 'left' | 'right'; mono?: boolean; pct?: boolean; disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const localRef = useRef(value);

  // Sync from parent ONLY when not focused (prevents overwriting user input)
  useEffect(() => {
    if (!focused) {
      setLocalValue(value);
      localRef.current = value;
    }
  }, [value, focused]);

  const commitValue = useCallback(() => {
    if (localRef.current !== value) {
      onChange(localRef.current);
    }
  }, [onChange, value]);

  if (disabled) {
    return (
      <span style={{
        display: 'block', width: '100%', textAlign: align,
        fontFamily: mono ? 'monospace' : 'inherit', fontSize: 12,
        color: G.textMuted, padding: '3px 4px',
      }}>
        {value}{pct ? '%' : ''}
      </span>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={localValue}
        onChange={e => {
          setLocalValue(e.target.value);
          localRef.current = e.target.value;
        }}
        onFocus={e => {
          setFocused(true);
          setLocalValue(value);
          localRef.current = value;
          e.target.select();
        }}
        onBlur={() => {
          commitValue();
          setFocused(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            commitValue();
          }
          onKeyDown?.(e);
        }}
        data-grid-cell
        style={{
          width: '100%', background: focused ? '#fff' : 'transparent',
          border: focused ? `1px solid ${G.textSec}` : '1px solid transparent',
          borderRadius: 5, padding: '3px 4px',
          textAlign: align, fontFamily: mono ? 'monospace' : 'inherit',
          fontSize: 12, fontWeight: 700, color: G.text,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ─── IPI/ST Dialog ────────────────────────────────────────────────────────────

function IpiStDialog({ onConfirm, onClose }: { onConfirm: (ipi: number | null, st: number | null) => void; onClose: () => void }) {
  const [ipi, setIpi] = useState('');
  const [st, setSt]   = useState('');

  const mask = (v: string) => v.replace(/[^0-9,]/g, '');

  const parse = (v: string): number | null => {
    if (v.trim() === '') return null;
    return parseFloat(v.replace(',', '.')) || 0;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: G.card, borderRadius: 14, padding: 28, width: 320,
        border: `1px solid ${G.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <p style={{ fontWeight: 900, fontSize: 14, color: G.text, marginBottom: 4 }}>5 · Atualizar IPI / ST</p>
        <p style={{ fontSize: 11, color: G.textMuted, marginBottom: 20 }}>Deixe em branco para manter o valor atual de cada item.</p>
        {[
          { label: 'IPI (%)', val: ipi, set: setIpi },
          { label: 'ST (%)',  val: st,  set: setSt },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input
              value={f.val}
              onChange={e => f.set(mask(e.target.value))}
              placeholder="em branco = manter"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${G.border}`, background: G.cardHi,
                fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.textMuted }}>Cancelar</button>
          <button onClick={() => {
            onConfirm(parse(ipi), parse(st));
            onClose();
          }} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: G.mustard, fontSize: 12, fontWeight: 900, cursor: 'pointer', color: G.text }}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD% Dialog ──────────────────────────────────────────────────────────────

function AddDialog({ onConfirm, onClose }: { onConfirm: (add: number, esp: number) => void; onClose: () => void }) {
  const [add, setAdd] = useState('0,00');
  const [esp, setEsp] = useState('0,00');

  const mask = (v: string) => v.replace(/[^0-9,]/g, '');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: G.card, borderRadius: 14, padding: 28, width: 320,
        border: `1px solid ${G.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <p style={{ fontWeight: 900, fontSize: 14, color: G.text, marginBottom: 20 }}>9 · % Adicional</p>
        {[
          { label: 'ADD% (des10)', val: add, set: setAdd },
          { label: 'ESP% (des11)', val: esp, set: setEsp },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input
              value={f.val}
              onChange={e => f.set(mask(e.target.value))}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${G.border}`, background: G.cardHi,
                fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: G.textMuted }}>Cancelar</button>
          <button onClick={() => {
            onConfirm(
              parseFloat(add.replace(',', '.')) || 0,
              parseFloat(esp.replace(',', '.')) || 0,
            );
            onClose();
          }} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: G.mustard, fontSize: 12, fontWeight: 900, cursor: 'pointer', color: G.text }}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConferenciaSection({ order, orderItems, setOrderItems, priceTableItems, isView, userParams, hasSuframa = false, autoApplyGroupDisc, onGroupDiscApplied, onTotaisUpdated }: Props) {
  // Casas decimais do preço (par_qtddecimais) — todo recálculo arredonda o líquido nelas.
  const casasPreco = userParams?.qtdDecimais ?? 2;
  const calcItem = useCallback((it: ItemRow) => calcLinha(it, casasPreco), [casasPreco]);
  const [syncing,        setSyncing]        = useState(false);
  const [clientDiscs,    setClientDiscs]    = useState<any[]>([]);
  const [groupDescs,     setGroupDescs]     = useState<any[]>([]);
  const [discsLoaded,    setDiscsLoaded]    = useState(false);
  const [contextMenu,    setContextMenu]    = useState<{ x: number; y: number; item: ItemRow } | null>(null);
  const [showIpiSt,      setShowIpiSt]      = useState(false);
  const [showAdd,        setShowAdd]        = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // ─── Ordenação por clique no cabeçalho (larguras originais das colunas) ───
  type CCol = { key: string; label: string; align: 'left' | 'right' | 'center'; width?: number; sortable?: boolean; acc?: (it: ItemRow) => any };
  const cOrigIdx = useMemo(() => new Map(orderItems.map((it, idx) => [it.tempId, idx])), [orderItems]);
  const descPctOf = (it: ItemRow) => (Number(it.ite_puni) > 0 ? (1 - Number(it.ite_puniliq) / Number(it.ite_puni)) * 100 : 0);
  const CONF_COLS = useMemo<CCol[]>(() => [
    { key: 'seq',     label: '#',           align: 'center', width: 40,  acc: (it) => cOrigIdx.get(it.tempId) ?? 0 },
    { key: 'codigo',  label: 'Código',      align: 'left',   width: 100, acc: (it) => it.ite_produto },
    { key: 'compl',   label: 'Complemento', align: 'left',   width: 120, acc: (it) => it.ite_embuch || '' },
    { key: 'descr',   label: 'Descrição',   align: 'left',   width: 420, acc: (it) => it.ite_nomeprod || '' },
    { key: 'qtd',     label: 'Qtd',         align: 'right',  width: 72,  acc: (it) => Number(it.ite_quant) },
    { key: 'bruto',   label: 'Bruto',       align: 'right',  width: 84,  acc: (it) => Number(it.ite_puni) },
    { key: 'descpct', label: 'Desc%',       align: 'right',  width: 60,  acc: descPctOf },
    { key: 'liq',     label: 'Líquido',     align: 'right',  width: 84,  acc: (it) => Number(it.ite_puniliq) },
    { key: 'totliq',  label: 'Total Líq.',  align: 'right',  width: 90,  acc: (it) => Number(it.ite_totliquido) },
    { key: 'cimp',    label: 'c/ Imp.',     align: 'right',  width: 90,  acc: (it) => Number(it.ite_valcomst) },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(nn => ({
      key: `des${nn}`, label: `${nn}º%`, align: 'center' as const, width: 38,
      acc: (it: ItemRow) => Number((it as any)[`ite_des${nn}`]) || 0,
    })),
    { key: 'add', label: 'ADD%', align: 'center', width: 38, acc: (it) => Number(it.ite_des10) || 0 },
    { key: 'esp', label: 'ESP%', align: 'center', width: 38, acc: (it) => Number(it.ite_des11) || 0 },
    { key: 'ipi', label: 'IPI%', align: 'center', width: 38, acc: (it) => Number(it.ite_ipi) || 0 },
    { key: 'st',  label: 'ST%',  align: 'center', width: 38, acc: (it) => Number(it.ite_st) || 0 },
  ], [cOrigIdx]);
  const confAccessors = useMemo(
    () => Object.fromEntries(CONF_COLS.filter(c => c.acc).map(c => [c.key, c.acc!])),
    [CONF_COLS],
  );
  const { sort: confSort, cycle: confCycle } = useGridSort();
  const sortedConfItems = useSortedRows(orderItems, confSort, confAccessors);
  const autoApplied = useRef(false);

  // Load client discounts + group descs on mount (needed for Desc. Grupo)
  useEffect(() => {
    if (!order?.ped_cliente || !order?.ped_industria) return;
    Promise.all([
      api.get(`/clients/${order.ped_cliente}/discounts`).catch(() => null),
      api.get('/grupo-desc').catch(() => null),
    ]).then(([cliRes, grpRes]) => {
      if (cliRes?.data?.success) setClientDiscs(cliRes.data.data);
      if (grpRes?.data?.success) setGroupDescs(grpRes.data.data);
      setDiscsLoaded(true);
    });
  }, [order?.ped_cliente, order?.ped_industria]);

  // Auto-apply group discounts after import (when parent signals via autoApplyGroupDisc)
  useEffect(() => {
    if (!autoApplyGroupDisc || !discsLoaded || autoApplied.current) return;
    autoApplied.current = true;
    handleDescGrupo();
    onGroupDiscApplied?.();
  }, [autoApplyGroupDisc, discsLoaded]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const usaDecimais = userParams?.usaDecimais ?? true;
  const qtdDecimais = userParams?.qtdDecimais ?? 2;


  const fmtQuant = (v: number) =>
    usaDecimais
      ? (v || 0).toFixed(qtdDecimais).replace('.', ',')
      : String(Math.trunc(v || 0));

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const goNextCell = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = e;
    if (!['Enter', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(key)) return;

    const cells = Array.from(
      gridRef.current?.querySelectorAll<HTMLInputElement>('input[data-grid-cell]') ?? []
    );
    const idx = cells.indexOf(e.currentTarget);
    if (idx < 0) return;

    // Count editable cells in current row to know the column stride
    const currentTr = e.currentTarget.closest('tr');
    const cellsPerRow = currentTr
      ? currentTr.querySelectorAll<HTMLInputElement>('input[data-grid-cell]').length
      : 1;

    let target = -1;

    if (key === 'Enter') {
      target = idx + 1;
    } else if (key === 'ArrowDown') {
      target = idx + cellsPerRow;
    } else if (key === 'ArrowUp') {
      target = idx - cellsPerRow;
    } else if (key === 'ArrowRight') {
      // Navigate only when cursor is already at end of text
      const el = e.currentTarget;
      if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
        target = idx + 1;
      }
    } else if (key === 'ArrowLeft') {
      // Navigate only when cursor is already at start of text
      const el = e.currentTarget;
      if (el.selectionStart === 0 && el.selectionEnd === 0) {
        target = idx - 1;
      }
    }

    if (target >= 0 && target < cells.length) {
      e.preventDefault();
      cells[target].focus();
      cells[target].select();
    }
  }, []);

  // ── Update a single field ─────────────────────────────────────────────────
  const updateItem = useCallback((tempId: string, field: keyof ItemRow, raw: string) => {
    setOrderItems(prev => prev.map(it => {
      if (it.tempId !== tempId) return it;
      let val: any = raw;
      const numFields: (keyof ItemRow)[] = [
        'ite_quant', 'ite_puni',
        'ite_des1', 'ite_des2', 'ite_des3', 'ite_des4', 'ite_des5',
        'ite_des6', 'ite_des7', 'ite_des8', 'ite_des9', 'ite_des10',
      ];
      if (numFields.includes(field)) val = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
      return calcItem({ ...it, [field]: val });
    }));
  }, [setOrderItems]);

  // Regra canônica (mesma de handleAtzTabNova):
  //   ite_promocao='S' = preço fechado (promo ou importado/negociado) → não aceita desconto
  //   ite_promocao='N' = preço especial OU bruto → aceita desconto normal
  // NÃO checar `priceTableItems[].preco_promo` aqui — um produto pode ter promo
  // cadastrada na tabela, mas o item DESTE pedido estar com preço especial
  // intencional. Confiar apenas na flag do próprio item.
  const isPromoItem = useCallback((it: ItemRow) => {
    return it.ite_promocao === 'S';
  }, []);

  // ── 1 · Atz. Valores — reload IPI/ST/nome + recalc + sync to DB ──────────
  async function handleAtzValores() {
    if (!order?.ped_pedido) { toast.error('Pedido sem número — salve o cabeçalho primeiro.'); return; }
    if (orderItems.length === 0) { toast.error('Nenhum item para atualizar.'); return; }

    setSyncing(true);
    try {
      const recalculated = orderItems.map(it => {
        const p = priceTableItems.find(c => c.pro_codigo === it.ite_produto);
        let updated = { ...it };
        if (p) {
          updated.ite_nomeprod = p.pro_nome || it.ite_nomeprod;
          if (hasSuframa) { updated.ite_ipi = 0; updated.ite_st = 0; }

          // Re-classifica item mal-marcado como promo: se a tabela tem promo
          // cadastrada (> 0) mas o ite_puni do item NÃO bate com ela, o item
          // está em outro preço (especial/bruto/manual) e a flag ficou 'S'
          // indevidamente. Corrige pra 'N' antes da zeragem abaixo — resolve
          // resíduo do bug do botão "Preço 3" antigo que marcava especial
          // como promo.
          const promoTabela = Number(p.preco_promo) || 0;
          if (
            updated.ite_promocao === 'S' &&
            promoTabela > 0 &&
            Math.abs(Number(updated.ite_puni) - promoTabela) > 0.001
          ) {
            updated.ite_promocao = 'N';
          }
        } else if (hasSuframa) {
          updated.ite_ipi = 0;
          updated.ite_st  = 0;
        }
        if (isPromoItem(updated)) {
          updated = { ...updated, ite_des1: 0, ite_des2: 0, ite_des3: 0, ite_des4: 0, ite_des5: 0, ite_des6: 0, ite_des7: 0, ite_des8: 0, ite_des9: 0, ite_des10: 0 };
        }
        return calcItem(updated);
      });
      setOrderItems(recalculated);

      await api.post(`/order-items/${encodeURIComponent(order.ped_pedido)}/sync`, { items: recalculated });

      const totbruto  = recalculated.reduce((s, it) => s + (it.ite_totbruto   || 0), 0);
      const totliq    = recalculated.reduce((s, it) => s + (it.ite_totliquido || 0), 0);
      const totalipi  = recalculated.reduce((s, it) => s + (it.ite_valcomipi  || 0), 0);
      onTotaisUpdated?.(totbruto, totliq, totalipi);

      toast.success(`${recalculated.length} iten(s) gravados com sucesso!`);
    } catch {
      toast.error('Erro ao gravar itens. Tente novamente.');
    } finally {
      setSyncing(false);
    }
  }

  // ── 0 · Excluir item ──────────────────────────────────────────────────────
  const handleDeleteItem = useCallback((tempId: string) => {
    setOrderItems(prev => prev.filter(it => it.tempId !== tempId));
    toast.success('Item removido.');
  }, [setOrderItems]);

  // ── I · Excluir todos ─────────────────────────────────────────────────────
  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm('Excluir TODOS os itens do pedido?')) return;
    if (!order?.ped_pedido) { toast.error('Pedido sem número — salve o cabeçalho primeiro.'); return; }
    try {
      await api.post(`/order-items/${encodeURIComponent(order.ped_pedido)}/sync`, { items: [] });
      setOrderItems([]);
      toast.success('Todos os itens foram removidos.');
    } catch {
      toast.error('Erro ao excluir itens.');
    }
  }, [order, setOrderItems]);

  // ── 2 · Desc. Padrão ─────────────────────────────────────────────────────
  const handleDescPadrao = useCallback(() => {
    setOrderItems(prev => prev.map(it => {
      if (isPromoItem(it)) return it;
      return calcItem({
        ...it,
        ite_des1: order.ped_pri || 0, ite_des2: order.ped_seg || 0,
        ite_des3: order.ped_ter || 0, ite_des4: order.ped_qua || 0,
        ite_des5: order.ped_qui || 0, ite_des6: order.ped_sex || 0,
        ite_des7: order.ped_set || 0, ite_des8: order.ped_oit || 0,
        ite_des9: order.ped_nov || 0,
      });
    }));
    toast.success('Descontos padrão aplicados.');
  }, [order, setOrderItems, isPromoItem]);

  // ── 3 · Desc. Grupo ───────────────────────────────────────────────────────
  const handleDescGrupo = useCallback(() => {
    let count = 0;
    setOrderItems(prev => prev.map(it => {
      if (isPromoItem(it)) return it;

      // Priority 1: client-specific group discount — match by product group (ite_grupo = pro_grupo)
      // Prefer industry-specific rule; fall back to any rule for this group
      if (it.ite_grupo) {
        const clientDisc =
          clientDiscs.find(d => Number(d.cli_grupo) === it.ite_grupo && Number(d.cli_forcodigo) === order.ped_industria) ||
          clientDiscs.find(d => Number(d.cli_grupo) === it.ite_grupo);
        if (clientDisc) {
          count++;
          return calcItem({
            ...it,
            ite_des1: clientDisc.cli_desc1 || 0, ite_des2: clientDisc.cli_desc2 || 0,
            ite_des3: clientDisc.cli_desc3 || 0, ite_des4: clientDisc.cli_desc4 || 0,
            ite_des5: clientDisc.cli_desc5 || 0, ite_des6: clientDisc.cli_desc6 || 0,
            ite_des7: clientDisc.cli_desc7 || 0, ite_des8: clientDisc.cli_desc8 || 0,
            ite_des9: clientDisc.cli_desc9 || 0,
            discountSource: 'CLIENT_GROUP',
          });
        }
      }

      // Priority 2: table-level group discount — match by itab_grupodesconto (gde_id)
      const cat = priceTableItems.find(p => p.pro_codigo === it.ite_produto);
      const tableGrupoId = Number(cat?.grupo_desconto);
      if (tableGrupoId) {
        const tableDisc = groupDescs.find(g => Number(g.gde_id) === tableGrupoId);
        if (tableDisc) {
          count++;
          return calcItem({
            ...it,
            ite_des1: tableDisc.gde_desc1 || 0, ite_des2: tableDisc.gde_desc2 || 0,
            ite_des3: tableDisc.gde_desc3 || 0, ite_des4: tableDisc.gde_desc4 || 0,
            ite_des5: tableDisc.gde_desc5 || 0, ite_des6: tableDisc.gde_desc6 || 0,
            ite_des7: tableDisc.gde_desc7 || 0, ite_des8: tableDisc.gde_desc8 || 0,
            ite_des9: tableDisc.gde_desc9 || 0,
            discountSource: 'TABLE_GROUP',
          });
        }
      }

      return it;
    }));
    toast.success(`Desc. de grupo aplicado em ${count} item(s).`);
  }, [order.ped_industria, priceTableItems, clientDiscs, groupDescs, setOrderItems, isPromoItem]);

  // ── 4 · Atz. Tabela Nova ─────────────────────────────────────────────────
  // Prioridade: preco_promo > preco_especial > preco_bruto
  // preco_promo → marca como promoção, zera descontos
  // preco_especial / preco_bruto → mantém descontos normais, marca como N
  //
  // Comportamento explícito: "Atz. Tabela" SEMPRE sobrescreve com a tabela
  // atual, mesmo quando o item está com ite_promocao='S' herdado de outro
  // caminho (Magic Load, XML, digitação). Razão: o botão se chama "Atz. Tabela"
  // — REP que clica espera que sobrescreva. Pra preservar preço digitado, o
  // REP usa "Vlr. Normal" ou "Preço 3", que não tocam em ite_puni desnecessariamente.
  //
  // Removido em 2026-05-29 (incidente FA008997 schema Target): o early return
  // que preservava itens com ite_promocao='S' quando a tabela não tinha promo
  // travava a única via de escape pro REP corrigir pedidos importados via Magic
  // Load com promo marcado indevidamente. Risco era pedido sair pra fábrica e
  // preço errado ser informado ao cliente.
  const handleAtzTabNova = useCallback(() => {
    let count = 0;
    setOrderItems(prev => prev.map(it => {
      const p = priceTableItems.find(c => c.pro_codigo === it.ite_produto);
      if (!p) return it;

      const promo    = n(p.preco_promo);
      const especial = n(p.preco_especial);
      const bruto    = n(p.preco_bruto);

      const ipi = hasSuframa ? 0 : (n(p.ipi) ?? it.ite_ipi);
      const st  = hasSuframa ? 0 : (n(p.st)  ?? it.ite_st);
      const nome = p.pro_nome || it.ite_nomeprod;

      const descAdd = n(p.desconto_add) ?? it.ite_des10;
      // Modo A: preço por peso (itab_prepeso × pro_peso). Quando informado na tabela,
      // vira a base — sobrescreve especial/bruto (mas não promo) e NÃO soma embalagem.
      const precoPeso = n(p.preco_peso);
      const pesoProd  = n(p.pro_peso);
      const peso = precoPeso > 0 && pesoProd > 0 ? Math.round(precoPeso * pesoProd * 100) / 100 : 0;

      if (promo > 0) {
        count++;
        return calcItem({
          ...it,
          ite_puni: promo, ite_promocao: 'S', ite_nomeprod: nome,
          ite_ipi: ipi, ite_st: st, ite_des10: descAdd,
          ite_des1: 0, ite_des2: 0, ite_des3: 0, ite_des4: 0, ite_des5: 0,
          ite_des6: 0, ite_des7: 0, ite_des8: 0, ite_des9: 0,
        });
      }
      if (peso > 0) {
        count++;
        return calcItem({
          ...it,
          ite_puni: peso, ite_promocao: 'N', ite_nomeprod: nome,
          ite_ipi: ipi, ite_st: st, ite_des10: descAdd,
          ite_des1: order.ped_pri || 0, ite_des2: order.ped_seg || 0,
          ite_des3: order.ped_ter || 0, ite_des4: order.ped_qua || 0,
          ite_des5: order.ped_qui || 0, ite_des6: order.ped_sex || 0,
          ite_des7: order.ped_set || 0, ite_des8: order.ped_oit || 0,
          ite_des9: order.ped_nov || 0,
        });
      }
      if (especial > 0) {
        count++;
        return calcItem({
          ...it,
          ite_puni: especial, ite_promocao: 'N', ite_nomeprod: nome,
          ite_ipi: ipi, ite_st: st, ite_des10: descAdd,
          // Aplica descontos do cabeçalho (caso item viesse com promo herdado e descontos zerados)
          ite_des1: order.ped_pri || 0, ite_des2: order.ped_seg || 0,
          ite_des3: order.ped_ter || 0, ite_des4: order.ped_qua || 0,
          ite_des5: order.ped_qui || 0, ite_des6: order.ped_sex || 0,
          ite_des7: order.ped_set || 0, ite_des8: order.ped_oit || 0,
          ite_des9: order.ped_nov || 0,
        });
      }
      if (bruto > 0) {
        count++;
        return calcItem({
          ...it,
          ite_puni: bruto, ite_promocao: 'N', ite_nomeprod: nome,
          ite_ipi: ipi, ite_st: st, ite_des10: descAdd,
          // Aplica descontos do cabeçalho — fundamental quando o item vinha
          // com promo='S' herdado do Magic Load/XML e descontos zerados.
          ite_des1: order.ped_pri || 0, ite_des2: order.ped_seg || 0,
          ite_des3: order.ped_ter || 0, ite_des4: order.ped_qua || 0,
          ite_des5: order.ped_qui || 0, ite_des6: order.ped_sex || 0,
          ite_des7: order.ped_set || 0, ite_des8: order.ped_oit || 0,
          ite_des9: order.ped_nov || 0,
        });
      }
      return it;
    }));
    toast.success(`Tabela atualizada em ${count} item(s).`);
  }, [priceTableItems, setOrderItems, order, hasSuframa]);

  // ── 5 · Atz. IPI/ST — (dialog confirms) ──────────────────────────────────
  const handleAtzIpiSt = useCallback((ipi: number | null, st: number | null) => {
    // Cliente SUFRAMA é isento: ignora o override manual e mantém IPI/ST = 0.
    if (hasSuframa) {
      setOrderItems(prev => prev.map(it => calcItem({ ...it, ite_ipi: 0, ite_st: 0 })));
      toast('Cliente SUFRAMA — IPI/ST mantidos isentos (0).', { icon: 'ℹ️' });
      return;
    }
    setOrderItems(prev => prev.map(it => calcItem({
      ...it,
      ite_ipi: ipi !== null ? ipi : it.ite_ipi,
      ite_st:  st  !== null ? st  : it.ite_st,
    })));
    const parts = [];
    if (ipi !== null) parts.push(`IPI ${fmtPct(ipi)}%`);
    if (st  !== null) parts.push(`ST ${fmtPct(st)}%`);
    toast.success(`${parts.join(' e ')} aplicado(s).`);
  }, [setOrderItems, hasSuframa]);

  // ── 6 · Vlr. Normal — restaura itab_precobruto, remove flag promoção ────
  const handleVlrNormal = useCallback(() => {
    let count = 0;
    setOrderItems(prev => prev.map(it => {
      const cod = String(it.ite_produto ?? '').trim().toUpperCase();
      const p = priceTableItems.find(c => String(c.pro_codigo ?? '').trim().toUpperCase() === cod);
      if (!p) return it;
      const bruto = n(p.preco_bruto);
      if (!bruto) return it;
      count++;
      return calcItem({ ...it, ite_puni: bruto, ite_promocao: 'N' });
    }));
    toast.success(`Preço normal restaurado em ${count} item(s).`);
  }, [priceTableItems, setOrderItems]);

  // ── 7 · Último Preço ─────────────────────────────────────────────────────
  const handleUltimoPreco = useCallback(async () => {
    if (!order?.ped_cliente || !order?.ped_industria) return;
    try {
      const res = await api.post('/order-items/batch-last-prices', {
        pedido:      order.ped_pedido,
        clienteId:   order.ped_cliente,
        industriaId: order.ped_industria,
        productCodes: orderItems.map(it => it.ite_produto),
      });
      if (res.data.success) {
        const map: Record<string, number> = res.data.data;
        let count = 0;
        setOrderItems(prev => prev.map(it => {
          if (map[it.ite_produto] !== undefined) { count++; return calcItem({ ...it, ite_puni: map[it.ite_produto] }); }
          return it;
        }));
        toast.success(count > 0 ? `Último preço aplicado em ${count} item(s).` : 'Nenhum histórico encontrado.');
      }
    } catch {
      toast.error('Erro ao buscar último preço.');
    }
  }, [order, orderItems, setOrderItems]);

  // ── 8 · Forçar Descontos ─────────────────────────────────────────────────
  const handleForcarDescontos = useCallback(() => {
    setOrderItems(prev => prev.map(it => calcItem({
      ...it,
      ite_des1: order.ped_pri || 0, ite_des2: order.ped_seg || 0,
      ite_des3: order.ped_ter || 0, ite_des4: order.ped_qua || 0,
      ite_des5: order.ped_qui || 0, ite_des6: order.ped_sex || 0,
      ite_des7: order.ped_set || 0, ite_des8: order.ped_oit || 0,
      ite_des9: order.ped_nov || 0,
    })));
    toast.success('Descontos forçados em todos os itens (inclusive promoções).');
  }, [order, setOrderItems]);

  // ── 9 · % Adicional — (dialog confirms) ──────────────────────────────────
  const handleDescAdd = useCallback((add: number, esp: number) => {
    setOrderItems(prev => prev.map(it => calcItem({ ...it, ite_des10: add, ite_des11: esp })));
    toast.success(`ADD ${fmtPct(add)}% aplicado.`);
  }, [setOrderItems]);

  // ── A · Checar Múltiplos ─────────────────────────────────────────────────
  // 1) Encontra itens fora do múltiplo, 2) gera PDF via window.print(),
  // 3) ajusta as quantidades na memtable
  const handleChecarMultiplos = useCallback(() => {
    // Coleta itens fora do múltiplo antes de ajustar
    const fora: Array<{ seq: number; codigo: string; nome: string; qty: number; pack: number; correcao: number }> = [];
    orderItems.forEach(it => {
      const p    = priceTableItems.find(c => c.pro_codigo === it.ite_produto);
      const pack = n(p?.pro_embalagem);
      const qty  = n(it.ite_quant);
      if (pack > 1 && qty > 0 && qty % pack !== 0) {
        fora.push({
          seq:      it.ite_seq,
          codigo:   it.ite_produto,
          nome:     it.ite_nomeprod,
          qty,
          pack,
          correcao: Math.ceil(qty / pack) * pack,
        });
      }
    });

    if (fora.length === 0) {
      toast.success('Todos os itens já estão em múltiplos de embalagem.');
      return;
    }

    // Gera relatório PDF via print
    const pedido = order.ped_pedido || 'NOVO';
    const linhas = fora.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#F8F9FA'}">
        <td style="padding:6px 10px;text-align:center">${r.seq}</td>
        <td style="padding:6px 10px;font-family:monospace;font-weight:700">${r.codigo}</td>
        <td style="padding:6px 10px">${r.nome}</td>
        <td style="padding:6px 10px;text-align:center">${r.qty.toLocaleString('pt-BR')}</td>
        <td style="padding:6px 10px;text-align:center">${r.pack}</td>
        <td style="padding:6px 10px;text-align:center;color:#DC2626;font-weight:700">${(r.qty % r.pack).toLocaleString('pt-BR')}</td>
        <td style="padding:6px 10px;text-align:center;color:#16A34A;font-weight:700">${r.correcao.toLocaleString('pt-BR')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Itens Fora da Embalagem — Pedido ${pedido}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #1E293B; }
        h2   { font-size: 15px; margin: 0 0 4px; }
        p    { margin: 0 0 14px; color: #64748B; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #1E293B; color: #fff; }
        th { padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { border-bottom: 1px solid #E2E8F0; font-size: 12px; }
        tfoot td { background: #F1F5F9; font-weight: 700; font-size: 11px; padding: 6px 10px; }
        @media print { body { margin: 10mm; } }
      </style>
    </head><body>
      <h2>Itens Fora da Embalagem — Pedido ${pedido}</h2>
      <p>Gerado em ${new Date().toLocaleString('pt-BR')} · ${fora.length} item(s) identificado(s)</p>
      <table>
        <thead><tr>
          <th style="text-align:center">Seq</th>
          <th>Código</th>
          <th>Descrição</th>
          <th style="text-align:center">Qtd. Atual</th>
          <th style="text-align:center">Embalagem</th>
          <th style="text-align:center">Sobra</th>
          <th style="text-align:center">Qtd. Corrigida</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td colspan="3">Total de itens fora do múltiplo</td>
          <td colspan="4" style="text-align:center">${fora.length} item(s)</td>
        </tr></tfoot>
      </table>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=650');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 400);
    }

    // Ajusta quantidades na memtable
    setOrderItems(prev => prev.map(it => {
      const p    = priceTableItems.find(c => c.pro_codigo === it.ite_produto);
      const pack = n(p?.pro_embalagem);
      const qty  = n(it.ite_quant);
      if (pack > 1 && qty > 0 && qty % pack !== 0) {
        return calcItem({ ...it, ite_quant: Math.ceil(qty / pack) * pack });
      }
      return it;
    }));

    toast.success(`${fora.length} item(s) ajustado(s). Relatório PDF gerado.`);
  }, [order, orderItems, priceTableItems, setOrderItems]);

  // ── P · Excel Fora Embalagem ─────────────────────────────────────────────
  // Exporta para Excel os itens fora do múltiplo SEM ajustar quantidades
  const handleExcelForaEmbal = useCallback(() => {
    const fora: Array<{ Seq: number; Código: string; Descrição: string; Quantidade: number; Embalagem: number; Diferença: number; Correção: number }> = [];
    orderItems.forEach(it => {
      const p    = priceTableItems.find(c => c.pro_codigo === it.ite_produto);
      const pack = n(p?.pro_embalagem);
      const qty  = n(it.ite_quant);
      if (pack > 1 && qty > 0 && qty % pack !== 0) {
        fora.push({
          Seq:       it.ite_seq,
          Código:    it.ite_produto,
          Descrição: it.ite_nomeprod,
          Quantidade: qty,
          Embalagem:  pack,
          Diferença:  qty % pack,
          Correção:   Math.ceil(qty / pack) * pack,
        });
      }
    });

    if (fora.length === 0) {
      toast.success('Nenhum item fora da embalagem.');
      return;
    }

    // Gera Excel via SheetJS (xlsx)
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(fora);
      // Larguras de coluna
      ws['!cols'] = [
        { wch: 6 }, { wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fora Embalagem');
      const pedido = order.ped_pedido || 'NOVO';
      XLSX.writeFile(wb, `itens_fora_embalagem_ped${pedido}.xlsx`);
      toast.success(`${fora.length} item(s) exportado(s) para Excel.`);
    });
  }, [order, orderItems, priceTableItems]);

  // ── B · Preço 3 (Especial) ───────────────────────────────────────────────
  // Preço especial = ite_promocao='N' (aceita desconto). Algumas fábricas, porém,
  // usam preço diferenciado no especial e NÃO concedem desconto — então perguntamos
  // ao usuário se quer ZERAR os descontos dos itens cujo Preço 3 > 0 (facilita a
  // vida dele, que hoje teria de zerar manualmente item a item).
  const handlePreco3 = useCallback(() => {
    const elegiveis = orderItems.filter(it => {
      const p = priceTableItems.find(c => c.pro_codigo === it.ite_produto) as any;
      return (p?.preco_especial ?? 0) > 0;
    }).length;
    if (elegiveis === 0) {
      toast('Nenhum item possui preço especial cadastrado.', { icon: 'ℹ️' });
      return;
    }

    const zerarDesc = window.confirm(
      `Aplicar Preço 3 (especial) em ${elegiveis} item(s).\n\n` +
      `Deseja TAMBÉM zerar os descontos desses itens?\n\n` +
      `OK = aplica e ZERA os descontos\nCancelar = aplica e MANTÉM os descontos`
    );

    let count = 0;
    setOrderItems(prev => prev.map(it => {
      const p = priceTableItems.find(c => c.pro_codigo === it.ite_produto) as any;
      const p3 = p?.preco_especial;
      if (!p3 || p3 <= 0) return it;
      count++;
      const base: any = { ...it, ite_puni: p3, ite_promocao: 'N' };
      if (zerarDesc) {
        base.ite_des1 = 0; base.ite_des2 = 0; base.ite_des3 = 0; base.ite_des4 = 0;
        base.ite_des5 = 0; base.ite_des6 = 0; base.ite_des7 = 0; base.ite_des8 = 0;
        base.ite_des9 = 0; base.ite_des10 = 0; base.ite_des11 = 0;
      }
      return calcItem(base);
    }));
    toast.success(zerarDesc
      ? `Preço 3 aplicado em ${count} item(s) — descontos zerados.`
      : `Preço 3 (especial) aplicado em ${count} item(s).`);
  }, [orderItems, priceTableItems, setOrderItems]);

  // ── D · Conversão → Complemento (truncado em 15) ─────────────────────────
  const handleConversao = useCallback(() => {
    let count = 0;
    setOrderItems(prev => prev.map(it => {
      const p = priceTableItems.find(c => c.pro_codigo === it.ite_produto) as any;
      if (p?.pro_conversao) { count++; return { ...it, ite_embuch: String(p.pro_conversao).slice(0, 15) }; }
      return it;
    }));
    if (count > 0) {
      toast.success(`Conversão aplicada em ${count} item(s).`);
    } else {
      toast('Nenhum item possui conversão cadastrada.', { icon: 'ℹ️' });
    }
  }, [priceTableItems, setOrderItems]);

  // ── C · Código Original ───────────────────────────────────────────────────
  const handleCodOriginal = useCallback(() => {
    let count = 0;
    setOrderItems(prev => prev.map(it => {
      const p = priceTableItems.find(c => c.pro_codigo === it.ite_produto) as any;
      if (p?.pro_codigooriginal) { count++; return { ...it, ite_embuch: p.pro_codigooriginal }; }
      return it;
    }));
    if (count > 0) {
      toast.success(`Código original aplicado em ${count} item(s).`);
    } else {
      toast('Nenhum item possui código original cadastrado.', { icon: 'ℹ️' });
    }
  }, [priceTableItems, setOrderItems]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalBruto   = orderItems.reduce((s, it) => s + (it.ite_totbruto   || 0), 0);
  const totalLiquido = orderItems.reduce((s, it) => s + (it.ite_totliquido || 0), 0);
  const totalComImp  = orderItems.reduce((s, it) => s + (it.ite_valcomst   || 0), 0);
  const totalIPI     = orderItems.reduce((s, it) => s + ((it.ite_valcomipi || 0) - (it.ite_totliquido || 0)), 0);

  // ── Table styles ──────────────────────────────────────────────────────────
  const thStyle = (align: 'left' | 'right' | 'center' = 'left', w?: number): React.CSSProperties => ({
    padding: '7px 6px', textAlign: align, fontSize: 9, fontWeight: 900,
    color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
    background: G.cardHi, borderBottom: `2px solid ${G.border}`,
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, minWidth: w,
  });

  const tdBase = (align: 'left' | 'right' | 'center' = 'left', extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: '2px 4px', textAlign: align, borderBottom: `1px solid ${G.border}40`,
    verticalAlign: 'middle', ...extra,
  });

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      const key = e.key.toUpperCase();
      switch (key) {
        case '1': handleAtzValores(); break;
        case '2': handleDescPadrao(); break;
        case '3': handleDescGrupo(); break;
        case '4': handleAtzTabNova(); break;
        case '5': setShowIpiSt(true); break;
        case '6': handleVlrNormal(); break;
        case '7': handleUltimoPreco(); break;
        case '8': handleForcarDescontos(); break;
        case '9': setShowAdd(true); break;
        case 'A': handleChecarMultiplos(); break;
        case 'B': handlePreco3(); break;
        case 'C': if (userParams?.mostraCodigoOri) handleCodOriginal(); break;
        case 'I': handleDeleteAll(); break;
        case 'P': handleExcelForaEmbal(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    handleAtzValores, handleDescPadrao, handleDescGrupo, handleAtzTabNova,
    handleVlrNormal, handleUltimoPreco, handleForcarDescontos, handleChecarMultiplos,
    handlePreco3, handleCodOriginal, handleDeleteAll, handleExcelForaEmbal
  ]);

  if (orderItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: G.textMuted }}>
        <CheckCircle size={32} style={{ opacity: 0.3 }} />
        <span style={{ fontSize: 13, fontStyle: 'italic' }}>Nenhum item em memória. Digite itens na aba F3.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{
        padding: '10px 20px', borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        background: G.card,
      }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 4 }}>
          Conferência · {orderItems.length} iten(s)
        </span>

        {!isView && (
          <button
            onClick={handleAtzValores}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 22px', borderRadius: 8, border: 'none',
              background: syncing ? G.border : G.mustard,
              color: syncing ? G.textMuted : G.text,
              fontSize: 12, fontWeight: 900, cursor: syncing ? 'default' : 'pointer',
              letterSpacing: 0.3,
              boxShadow: syncing ? 'none' : '0 4px 12px rgba(255,210,0,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { if (!syncing) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.filter = 'brightness(1.05)'; } }}
            onMouseLeave={e => { if (!syncing) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none'; } }}
          >
            <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Gravando...' : '1 · Atz. Valores'}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Summary totals */}
        {[
          { label: 'Bruto',   value: fmtBRL(totalBruto) },
          { label: 'Líquido', value: fmtBRL(totalLiquido) },
          { label: 'IPI',     value: fmtBRL(totalIPI) },
          { label: 'c/ Imp.', value: fmtBRL(totalComImp), highlight: true },
        ].map(t => (
          <div key={t.label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            padding: '4px 12px', borderRadius: 8,
            background: t.highlight ? `${G.textSec}12` : G.cardHi,
            border: `1px solid ${t.highlight ? G.textSec + '30' : G.border}`,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</span>
            <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: t.highlight ? G.textSec : G.text }}>{t.value}</span>
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div ref={gridRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', minWidth: 900 }}>
          <thead>
            <tr>
              {CONF_COLS.map(c => {
                const canSort = c.sortable !== false;
                return (
                  <th key={c.key} onClick={canSort ? () => confCycle(c.key) : undefined}
                    style={{ ...thStyle(c.align, c.width), cursor: canSort ? 'pointer' : 'default', userSelect: 'none' }}>
                    {c.label}{canSort && <span style={{ opacity: confSort?.key === c.key ? 0.9 : 0.3 }}>{sortArrow(confSort, c.key)}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedConfItems.map((item, i) => {
              const catalogProd  = priceTableItems.find((p: any) => p.pro_codigo === item.ite_produto);
              const mult         = (catalogProd as any)?.pro_embalagem || 0;
              const multWarning  = mult > 0 && item.ite_quant % mult !== 0;
              const descPct      = item.ite_puni > 0
                ? ((1 - item.ite_puniliq / item.ite_puni) * 100)
                : 0;
              const rowBg = multWarning ? '#FFF3E0' : i % 2 === 0 ? G.card : G.cardHi;

              return (
                <motion.tr
                  key={item.tempId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.008 }}
                  style={{ background: rowBg, cursor: 'context-menu' }}
                  onContextMenu={e => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, item });
                  }}
                >
                  {/* Seq */}
                  <td style={tdBase('center', { fontFamily: 'monospace', color: G.textMuted, fontSize: 11 })}>
                    {String(item.ite_seq || i + 1).padStart(3, '0')}
                  </td>

                  {/* Código */}
                  <td style={tdBase('left', { fontFamily: 'monospace', fontWeight: 900, color: G.textSec })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {multWarning && <AlertTriangle size={11} style={{ color: '#D97600', flexShrink: 0 }} />}
                      {item.ite_produto}
                    </div>
                  </td>

                  {/* Complemento */}
                  <td style={tdBase('left')}>
                    {isView ? (
                      <span style={{ fontSize: 12, color: G.textMuted }}>{item.ite_embuch || '—'}</span>
                    ) : (
                      <EditCell value={item.ite_embuch || ''} align="left" mono={false}
                        onChange={v => updateItem(item.tempId, 'ite_embuch', v)} onKeyDown={goNextCell} />
                    )}
                  </td>

                  {/* Descrição */}
                  <td style={tdBase('left', { maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: G.text })}>
                    {item.ite_nomeprod}
                  </td>

                  {/* Qtd */}
                  <td style={tdBase('right')}>
                    {isView ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtQuant(item.ite_quant)}</span>
                    ) : (
                      <EditCell value={fmtQuant(item.ite_quant)} align="right"
                        onChange={v => updateItem(item.tempId, 'ite_quant', v)} onKeyDown={goNextCell} />
                    )}
                  </td>

                  {/* Bruto */}
                  <td style={tdBase('right')}>
                    {isView ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: G.textMuted }}>{fmtBRL(item.ite_puni)}</span>
                    ) : (
                      <EditCell value={(n(item.ite_puni)).toFixed(2).replace('.', ',')} align="right"
                        onChange={v => updateItem(item.tempId, 'ite_puni', v)} onKeyDown={goNextCell} />
                    )}
                  </td>

                  {/* Desc% — calculado */}
                  <td style={tdBase('right', { fontFamily: 'monospace', color: descPct > 0 ? '#2563EB' : G.textMuted, fontWeight: 700 })}>
                    {descPct.toFixed(2).replace('.', ',')}%
                  </td>

                  {/* Líquido Unit. */}
                  <td style={tdBase('right', { fontFamily: 'monospace', fontWeight: 700, color: G.success })}>
                    {fmtBRL(item.ite_puniliq)}
                  </td>

                  {/* Total Líquido */}
                  <td style={tdBase('right', { fontFamily: 'monospace', fontWeight: 900 })}>
                    {fmtBRL(item.ite_totliquido)}
                  </td>

                  {/* c/ Imp. */}
                  <td style={tdBase('right', { fontFamily: 'monospace', fontWeight: 900, color: G.textSec })}>
                    {fmtBRL(item.ite_valcomst)}
                  </td>

                  {/* D1 – D9 */}
                  {[1,2,3,4,5,6,7,8,9].map(n => {
                    const key = `ite_des${n}` as keyof ItemRow;
                    const val = (item[key] as number) || 0;
                    return (
                      <td key={n} style={tdBase('center')}>
                        {isView ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: val > 0 ? '#2563EB' : G.textMuted }}>
                            {fmtPct(val)}%
                          </span>
                        ) : (
                          <EditCell value={fmtPct(val)} align="right" pct
                            onChange={v => updateItem(item.tempId, key, v)} onKeyDown={goNextCell} />
                        )}
                      </td>
                    );
                  })}

                  {/* ADD% (des10) */}
                  <td style={tdBase('center')}>
                    {isView ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: item.ite_des10 > 0 ? '#2563EB' : G.textMuted }}>
                        {fmtPct(item.ite_des10)}%
                      </span>
                    ) : (
                      <EditCell value={fmtPct(item.ite_des10)} align="right" pct
                        onChange={v => updateItem(item.tempId, 'ite_des10', v)} onKeyDown={goNextCell} />
                    )}
                  </td>

                  {/* ESP% (des11) */}
                  <td style={tdBase('center')}>
                    {isView ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: item.ite_des11 > 0 ? '#2563EB' : G.textMuted }}>
                        {fmtPct(item.ite_des11)}%
                      </span>
                    ) : (
                      <EditCell value={fmtPct(item.ite_des11)} align="right" pct
                        onChange={v => updateItem(item.tempId, 'ite_des11', v)} onKeyDown={goNextCell} />
                    )}
                  </td>

                  {/* IPI% */}
                  <td style={tdBase('center', { fontFamily: 'monospace', color: item.ite_ipi > 0 ? G.danger : G.textMuted, fontWeight: item.ite_ipi > 0 ? 700 : 400 })}>
                    {fmtPct(item.ite_ipi)}%
                  </td>

                  {/* ST% */}
                  <td style={tdBase('center', { fontFamily: 'monospace', color: item.ite_st > 0 ? '#D97600' : G.textMuted, fontWeight: item.ite_st > 0 ? 700 : 400 })}>
                    {fmtPct(item.ite_st)}%
                  </td>
                </motion.tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr style={{ background: G.cardHi, borderTop: `2px solid ${G.border}` }}>
              <td colSpan={4} style={{ padding: '7px 8px', fontSize: 11, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                TOTAIS
              </td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 12 }}>—</td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 12 }}>{fmtBRL(totalBruto)}</td>
              <td /><td />
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 12 }}>{fmtBRL(totalLiquido)}</td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 12, color: G.textSec }}>{fmtBRL(totalComImp)}</td>
              <td colSpan={12} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Bottom action bar ── */}
      {!isView && (
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${G.border}`,
          background: G.cardHi, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          {/* 1 — Sincronização */}
          <ActionBtn shortcut="1" label="Atz. Valores"   onClick={handleAtzValores} />

          <div style={{ width: 1, height: 24, background: G.border, margin: '0 4px' }} />

          {/* 2-3 — Descontos */}
          <ActionBtn shortcut="2" label="Desc. Padrão"   onClick={handleDescPadrao} />
          <ActionBtn shortcut="3" label="Desc. Grupo"    onClick={handleDescGrupo} />

          <div style={{ width: 1, height: 24, background: G.border, margin: '0 4px' }} />

          {/* 4-9 — Preços / Impostos */}
          <ActionBtn shortcut="4" label="Atz. Tabela"    onClick={handleAtzTabNova} />
          <ActionBtn shortcut="5" label="IPI / ST"       onClick={() => setShowIpiSt(true)} />
          <ActionBtn shortcut="6" label="Vlr. Normal"    onClick={handleVlrNormal} />
          <ActionBtn shortcut="7" label="Último Preço"   onClick={handleUltimoPreco} />
          <ActionBtn shortcut="8" label="Forçar Desc."   onClick={handleForcarDescontos} />
          <ActionBtn shortcut="9" label="% Adicional"    onClick={() => setShowAdd(true)} />

          <div style={{ width: 1, height: 24, background: G.border, margin: '0 4px' }} />

          {/* A-P — Outros */}
          <ActionBtn shortcut="A" label="Múltiplos"      onClick={handleChecarMultiplos} />
          <ActionBtn shortcut="B" label="Preço 3"        onClick={handlePreco3} />
          <ActionBtn shortcut="D" label="Conversão"      onClick={handleConversao} />
          <ActionBtn shortcut="P" label="Excel Embal."   onClick={handleExcelForaEmbal} />
          {userParams?.mostraCodigoOri && <ActionBtn shortcut="C" label="Cód. Original"  onClick={handleCodOriginal} />}

          <div style={{ flex: 1 }} />

          {/* Destrutivo */}
          <ActionBtn shortcut="I" label="Excluir Todos"  onClick={handleDeleteAll} danger />
        </div>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', zIndex: 8000,
            left: contextMenu.x, top: contextMenu.y,
            background: G.card, borderRadius: 10,
            border: `1px solid ${G.border}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            minWidth: 200, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid ${G.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ITEM {contextMenu.item.ite_produto}
            </span>
          </div>
          <button
            onClick={() => { handleDeleteItem(contextMenu.item.tempId); setContextMenu(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '9px 14px', border: 'none',
              background: 'transparent', textAlign: 'left',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              color: '#C0392B',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FFF0F0')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Trash2 size={13} />
            0 · Excluir item do pedido
          </button>
        </div>
      )}

      {/* ── Dialogs ── */}
      {showIpiSt && <IpiStDialog onConfirm={handleAtzIpiSt} onClose={() => setShowIpiSt(false)} />}
      {showAdd   && <AddDialog   onConfirm={handleDescAdd}  onClose={() => setShowAdd(false)} />}
    </div>
  );
}
