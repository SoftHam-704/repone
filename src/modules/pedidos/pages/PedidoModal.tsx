import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  X, Package, ShoppingCart, Receipt, MessageSquare,
  LayoutDashboard, ClipboardCheck,
  User, Truck, UserCheck, Settings2, BarChart3,
  Loader2, Save, Send, Plus, Star,
  Wand2, Table2, FileCode, FileText, RefreshCw,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { ItemsSection } from './ItemsSection';
import { ConferenciaSection } from './ConferenciaSection';
import { XmsModal, TxtModal, XmlSection, MagicModal } from './ImportModals';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  ite_seq: number;
  ite_produto: string;
  ite_embuch: string;
  ite_nomeprod: string;
  ite_quant: number;
  ite_puni: number;
  ite_puniliq: number;
  ite_totbruto: number;
  ite_totliquido: number;
  ite_valcomipi: number;
  ite_valcomst: number;
  ite_ipi: number;
  ite_des1: number; ite_des2: number; ite_des3: number;
  ite_des4: number; ite_des5: number; ite_des6: number;
  ite_des7: number; ite_des8: number; ite_des9: number;
}

interface OrderFull {
  ped_numero: number;
  ped_pedido: string;
  ped_data: string;
  ped_situacao: string;
  ped_cliente: number;
  ped_industria: number;
  ped_vendedor: number;
  ped_tabela: string;
  ped_condpag: string;
  ped_comprador: string;
  ped_tipofrete: string;
  ped_cliind: string;
  ped_transp?: number;
  ped_totbruto: number;
  ped_totliq: number;
  ped_totalipi: number;
  ped_obs: string;
  ped_oc?: string | null;
  ped_consolidado_id?: number | null;
  ped_pri: number; ped_seg: number; ped_ter: number;
  ped_qua: number; ped_qui: number; ped_sex: number;
  ped_set: number; ped_oit: number; ped_nov: number;
  ped_pedcli?: string;
  ped_pedindustria?: string;
  cli_nomred: string;
  cli_nome: string;
  cli_cnpj?: string;
  cli_cidade?: string;
  cli_uf?: string;
  cli_suframa?: string | null;
  for_nomered: string;
  for_usa_menor_preco?: boolean;
  ven_nome: string;
  items: OrderItem[];
}

export type PedidoModalMode = 'view' | 'edit' | 'new';

interface PedidoModalProps {
  isOpen: boolean;
  mode: PedidoModalMode;
  order: { ped_pedido: string; for_nomered: string } | null;
  onClose: () => void;
  onSaved?: () => void;
  onUpdated?: () => void;
  initialIndustriaId?: number | null;
  initialClienteId?:   number | null;
  initialClienteLabel?: string | null;
}

// ─── Sidebar sections ─────────────────────────────────────────────────────────
const sections = [
  { key: 'principal',   label: 'Principal',   shortcut: 'F1', icon: LayoutDashboard, color: '#4F7EF7' },
  { key: 'itens',       label: 'Itens',       shortcut: 'F3', icon: ShoppingCart,    color: '#F59E0B' },
  { key: 'faturas',     label: 'Faturas',     shortcut: 'F4', icon: Receipt,         color: '#10B981' },
  { key: 'conferencia', label: 'Conferência', shortcut: 'F5', icon: ClipboardCheck,  color: '#8B5CF6' },
] as const;

type SectionKey = (typeof sections)[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtNum = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const [y, m, day] = d.substring(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

function statusLabel(s: string) {
  switch (s) {
    case 'P': return 'Pedido';
    case 'C': return 'Cotação';
    case 'CC': return 'Cot. Confirmada';
    case 'F': return 'Faturado';
    case 'Q': return 'FILA';
    case 'G': return 'Garantia';
    case 'B': return 'Bonificação';
    default:  return 'Cancelado';
  }
}

function statusColor(s: string) {
  switch (s) {
    case 'P':  return { bg: '#28374A12', color: G.text,    border: '#28374A25' };
    case 'C':  return { bg: '#D9760012', color: '#D97600', border: '#D9760025' };
    case 'CC': case 'A': return { bg: '#0891B218', color: '#0891B2', border: '#0891B225' };
    case 'F':  return { bg: '#16A34A12', color: G.success, border: '#16A34A25' };
    case 'Q':  return { bg: '#D9760012', color: '#D97600', border: '#D9760025' };
    default:   return { bg: '#C0392B12', color: G.danger,  border: '#C0392B25' };
  }
}

// ─── Read-only field ──────────────────────────────────────────────────────────
function ReadField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${G.border}30` }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: G.text, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── Edit field ───────────────────────────────────────────────────────────────
const einp: React.CSSProperties = {
  width: '100%', background: '#fff', border: `1px solid ${G.border}`,
  borderRadius: 8, padding: '5px 9px', fontSize: 13, fontWeight: 700,
  color: G.text, outline: 'none', boxSizing: 'border-box',
};

function EditField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div style={{ padding: '6px 0', borderBottom: `1px solid ${G.border}30` }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>
        {label}
      </span>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={einp} />
    </div>
  );
}

function EditSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ padding: '6px 0', borderBottom: `1px solid ${G.border}30` }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>
        {label}
      </span>
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...einp, cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Enter = Tab (navegação por Enter nos campos) ─────────────────────────────
function handleEnterAsTab(e: React.KeyboardEvent) {
  if (e.key !== 'Enter') return;
  const focusable = Array.from(
    (e.currentTarget as HTMLElement).querySelectorAll(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
    )
  ) as HTMLElement[];
  const idx = focusable.indexOf(document.activeElement as HTMLElement);
  if (idx > -1 && idx < focusable.length - 1) {
    e.preventDefault();
    focusable[idx + 1].focus();
  }
}

// ─── Percent input — máscara numérica automática (dígitos entram da direita) ──
function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const fmt = (v: number) => v.toFixed(2).replace('.', ',');

  const [display, setDisplay] = React.useState(() => fmt(value));

  useEffect(() => {
    setDisplay(fmt(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep only digits
    const digits = e.target.value.replace(/\D/g, '');
    const num = parseInt(digits || '0', 10);
    // Treat as centésimos: last 2 digits are decimals
    const floatVal = num / 100;
    if (floatVal > 100) return; // max 100%
    setDisplay(fmt(floatVal));
    onChange(floatVal);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleBlur = () => {
    setDisplay(fmt(value));
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{ ...einp, textAlign: 'right', fontFamily: 'monospace', padding: '5px 22px 5px 6px', fontSize: 12 }}
      />
      <span style={{ position: 'absolute', right: 7, fontSize: 11, fontWeight: 700, color: G.textMuted, pointerEvents: 'none' }}>%</span>
    </div>
  );
}

// ─── Discount chip ────────────────────────────────────────────────────────────
function DiscountBox({ index, value }: { index: number; value: number }) {
  const active = value > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.4 }}>
        {index + 1}º desc.
      </span>
      <div style={{
        height: 32, borderRadius: 8, border: `1px solid ${active ? `${G.textSec}40` : G.border}`,
        background: active ? G.cardHi : G.card,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 900, fontFamily: 'monospace',
        color: active ? G.text : G.textMuted,
      }}>
        {active ? `${value.toFixed(2).replace('.', ',')}%` : '—'}
      </div>
    </div>
  );
}

// ─── Items table ──────────────────────────────────────────────────────────────
function ItemsTable({ items, usaDecimais = true, qtdDecimais = 2, priceTableItems: _priceTableItems = [] }: { items: OrderItem[]; usaDecimais?: boolean; qtdDecimais?: number; priceTableItems?: any[] }) {
  const fmtQuant = (v: number) =>
    usaDecimais
      ? (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: qtdDecimais, maximumFractionDigits: qtdDecimais })
      : String(Math.trunc(v || 0));
  const V = 96; // largura padrão para todas as colunas de valor
  const cols = [
    { label: 'SEQ',      align: 'left',  w: 44 },
    { label: 'CÓDIGO',   align: 'left',  w: 88 },
    { label: 'COMPLEM.', align: 'left',  w: 76 },
    { label: 'DESCRIÇÃO',align: 'left',  w: 200 },
    { label: 'QUANT',    align: 'right', w: 60 },
    { label: 'UNITÁRIO', align: 'right', w: V },
    { label: 'DESC%',    align: 'right', w: 64 },
    { label: 'UNI.LQ',  align: 'right', w: V },
    { label: 'UN.IMP.',  align: 'right', w: V },
    { label: 'TOT.BR.',  align: 'right', w: V },
    { label: 'TOT.LIQ',  align: 'right', w: V },
    { label: 'C/IMPOS',  align: 'right', w: V },
    ...Array.from({ length: 9 }, (_, i) => ({ label: `${i + 1}º`, align: 'right', w: 46 })),
    { label: 'IPI',      align: 'right', w: 50 },
  ];

  const th: React.CSSProperties = {
    padding: '8px 6px', textAlign: 'left', fontSize: 9, fontWeight: 900,
    color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    whiteSpace: 'nowrap', background: G.cardHi,
    borderBottom: `1px solid ${G.border}`,
    position: 'sticky', top: 0,
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.label} style={{ ...th, textAlign: c.align as any, minWidth: c.w }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={cols.length} style={{ textAlign: 'center', padding: 32, color: G.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                Nenhum item lançado.
              </td>
            </tr>
          ) : items.map((item, i) => {
            const uniImp = (item.ite_valcomipi || 0) / (item.ite_quant || 1);
            const descPct = item.ite_puni > 0 ? ((1 - (item.ite_puniliq / item.ite_puni)) * 100) : 0;
            const td = (align: string = 'left', opts: React.CSSProperties = {}): React.CSSProperties => ({
              padding: '6px 6px', textAlign: align as any, whiteSpace: 'nowrap',
              borderBottom: `1px solid ${G.border}40`,
              background: i % 2 === 0 ? G.card : G.cardHi,
              ...opts,
            });
            return (
              <motion.tr
                key={item.ite_seq || i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015 }}
              >
                <td style={td('left', { fontFamily: 'monospace', color: G.textMuted })}>
                  {String(item.ite_seq || i + 1).padStart(3, '0')}
                </td>
                <td style={td('left', { fontFamily: 'monospace', fontWeight: 900, color: G.textSec })}>
                  {item.ite_produto}
                </td>
                <td style={td('left', { color: G.textMuted, textTransform: 'uppercase' })}>
                  {item.ite_embuch || '—'}
                </td>
                <td style={td('left', { maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 })}>
                  {item.ite_nomeprod}
                </td>
                <td style={td('right', { fontWeight: 900 })}>{fmtQuant(item.ite_quant)}</td>
                <td style={td('right', { fontFamily: 'monospace', color: G.textMuted })}>{fmtNum(item.ite_puni)}</td>
                <td style={td('right', { fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' })}>{descPct.toFixed(2)}%</td>
                <td style={td('right', { fontFamily: 'monospace', fontWeight: 700, color: G.success })}>{fmtNum(item.ite_puniliq)}</td>
                <td style={td('right', { fontFamily: 'monospace', color: G.textMuted })}>{uniImp.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                <td style={td('right', { fontFamily: 'monospace', color: G.textMuted })}>{fmtNum(item.ite_totbruto)}</td>
                <td style={td('right', { fontFamily: 'monospace', fontWeight: 700 })}>{fmtNum(item.ite_totliquido)}</td>
                <td style={td('right', { fontFamily: 'monospace', fontWeight: 700, color: G.success })}>{fmtNum(item.ite_valcomst || item.ite_valcomipi)}</td>
                {[1,2,3,4,5,6,7,8,9].map(n => {
                  const v = parseFloat((item as any)[`ite_des${n}`]) || 0;
                  return (
                    <td key={n} style={td('right', { fontFamily: 'monospace', color: v > 0 ? '#2563EB' : G.textMuted, opacity: v > 0 ? 1 : 0.4 })}>
                      {v.toFixed(2)}%
                    </td>
                  );
                })}
                <td style={td('right', { fontFamily: 'monospace', fontWeight: 700, color: G.danger })}>
                  {(parseFloat(String(item.ite_ipi)) || 0).toFixed(2)}%
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── ClientCombobox ───────────────────────────────────────────────────────────
function fmtCnpj(v?: string) {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return v;
}

function ClientCombobox({
  value, onChange, style, selectedLabel,
}: {
  value: number;
  onChange: (v: number, vendedor?: number, nomred?: string) => void;
  style?: React.CSSProperties;
  selectedLabel?: string;
}) {
  const [open, setOpen]       = useState(false);
  const [q,    setQ]          = useState('');
  const [clients, setClients] = useState<{ cli_codigo: number; cli_nomred: string; cli_nome: string; cli_cnpj?: string; cli_vendedor?: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [hiIdx,   setHiIdx]   = useState(-1);
  const listRef               = useRef<HTMLDivElement>(null);
  const ref                   = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const selected = clients.find(c => c.cli_codigo === value);
  const label = selected
    ? `${selected.cli_nomred || selected.cli_nome}${selected.cli_cnpj ? ' — ' + fmtCnpj(selected.cli_cnpj) : ''}`
    : value > 0 && selectedLabel ? selectedLabel : '— Selecione —';

  // Server-side search: debounce typing, instant load on open
  useEffect(() => {
    if (!open) return;
    const delay = q.trim() ? 300 : 0;
    const timer = setTimeout(async () => {
      setLoading(true);
      setHiIdx(-1);
      try {
        const url = q.trim()
          ? `/clients?search=${encodeURIComponent(q)}&limit=100`
          : '/clients?limit=100';
        const r = await api.get(url);
        setClients(r.data.data || []);
      } catch { setClients([]); }
      finally { setLoading(false); }
    }, delay);
    return () => clearTimeout(timer);
  }, [open, q]);

  const handleOpen = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
    setOpen(true);
    setQ('');
    setHiIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSelect = useCallback((code: number, vendedor?: number) => {
    const client = clients.find(c => c.cli_codigo === code);
    const nomred = client ? (client.cli_nomred || client.cli_nome) : undefined;
    onChange(code, vendedor, nomred);
    setOpen(false);
    setQ('');
  }, [onChange, clients]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHiIdx(i => {
        const next = Math.min(i + 1, clients.length - 1);
        listRef.current?.children[next + 1]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHiIdx(i => {
        const prev = Math.max(i - 1, -1);
        if (prev >= 0) listRef.current?.children[prev + 1]?.scrollIntoView({ block: 'nearest' });
        return prev;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hiIdx >= 0 && clients[hiIdx]) handleSelect(clients[hiIdx].cli_codigo, clients[hiIdx].cli_vendedor);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, hiIdx, clients, handleSelect]);

  // Close on outside click; do NOT close on scroll so the list stays while user scrolls inside it
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const drop = document.getElementById('client-combobox-portal');
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        drop && !drop.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const dropdown = open && dropPos && (
    <div
      id="client-combobox-portal"
      style={{
        position: 'fixed',
        top: dropPos.top, left: dropPos.left, width: dropPos.width,
        zIndex: 99999,
        background: G.card, border: `1px solid ${G.mustard}60`,
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        maxHeight: 300, display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ padding: '6px 8px', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nome, razão social ou CNPJ..."
          style={{
            width: '100%', border: 'none', outline: 'none',
            background: 'transparent', fontSize: 12, color: G.text,
          }}
        />
      </div>
      {/* stopPropagation no wheel impede que o scroll vaze para o modal */}
      <div
        ref={listRef}
        style={{ overflowY: 'auto', flex: 1 }}
        onWheel={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ padding: '10px', fontSize: 11, color: G.textMuted, textAlign: 'center' }}>
            Carregando...
          </div>
        ) : (
          <>
            <div
              onClick={() => handleSelect(0)}
              style={{ padding: '7px 10px', fontSize: 11, color: G.textMuted, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = G.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              — Selecione —
            </div>
            {clients.map((c, idx) => (
              <div
                key={c.cli_codigo}
                onClick={() => handleSelect(c.cli_codigo, c.cli_vendedor)}
                style={{
                  padding: '7px 10px', cursor: 'pointer', fontSize: 11,
                  background: idx === hiIdx ? `${G.mustard}30` : c.cli_codigo === value ? `${G.mustard}20` : 'transparent',
                  borderLeft: c.cli_codigo === value ? `3px solid ${G.mustard}` : '3px solid transparent',
                }}
                onMouseEnter={e => { setHiIdx(idx); e.currentTarget.style.background = `${G.mustard}30`; }}
                onMouseLeave={e => { e.currentTarget.style.background = c.cli_codigo === value ? `${G.mustard}20` : 'transparent'; }}
              >
                <div style={{ fontWeight: 600, color: G.text }}>{c.cli_nomred || c.cli_nome}</div>
                {c.cli_cnpj && (
                  <div style={{ fontSize: 10, color: G.textMuted, fontFamily: 'monospace', marginTop: 1 }}>
                    {fmtCnpj(c.cli_cnpj)}
                  </div>
                )}
              </div>
            ))}
            {clients.length === 0 && (
              <div style={{ padding: '10px', fontSize: 11, color: G.textMuted, textAlign: 'center' }}>
                Nenhum cliente encontrado
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={handleOpen}
        style={{
          ...style,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {label}
        </span>
        <span style={{ color: G.textMuted, fontSize: 9, marginLeft: 6, flexShrink: 0 }}>▼</span>
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}

// ─── Principal section ────────────────────────────────────────────────────────
function PrincipalSection({
  order, mode, formData, onChangeField, onPriceTableItemsChange, orderItems, transportadoras, onReaplicarPolitica,
  allowDuplicateOverride, setAllowDuplicateOverride, userParams,
}: {
  order: OrderFull;
  mode: PedidoModalMode;
  formData: Partial<OrderFull>;
  onChangeField: (field: keyof OrderFull, value: any) => void;
  onPriceTableItemsChange?: (items: any[]) => void;
  orderItems?: any[];
  transportadoras: { value: number; label: string }[];
  onReaplicarPolitica?: () => void;
  allowDuplicateOverride: boolean | null;
  setAllowDuplicateOverride: (v: boolean) => void;
  userParams: { usaDecimais: boolean; qtdDecimais: number; itemDuplicado: boolean; qtdEnter: number; fmtPesquisa: string; mostraCodigoOri: boolean } | null;
}) {
  const isView = mode === 'view';
  const fd = formData; // alias

  // Listas para os selects de cliente e vendedor (carregadas apenas no modo edição)
  const [sellers, setSellers]       = useState<{ ven_codigo: number; ven_nome: string }[]>([]);
  const [industrias, setIndustrias] = useState<{ for_codigo: number; for_nomered: string }[]>([]);
  const [priceTables, setPriceTables] = useState<{ nome_tabela: string }[]>([]);
  const [compradorModal, setCompradorModal]     = useState(false);
  const [tornarPadraoModal, setTornarPadraoModal] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  const [compForm, setCompForm] = useState({
    ani_nome: '', ani_funcao: 'COMPRADOR', ani_fone: '', ani_email: '', ani_diaaniv: '', ani_mes: '',
  });
  const [padForm, setPadForm] = useState({
    cli_desc1: 0, cli_desc2: 0, cli_desc3: 0, cli_desc4: 0, cli_desc5: 0,
    cli_desc6: 0, cli_desc7: 0, cli_desc8: 0, cli_desc9: 0,
    cli_prazopg: '', cli_tabela: '', cli_frete: 'C',
    cli_comprador: '', cli_emailcomprador: '',
    cli_transportadora: '',
  });

  const openCompradorModal = () => {
    setCompForm({
      ani_nome: ((fd.ped_comprador ?? order.ped_comprador) as string) || '',
      ani_funcao: 'COMPRADOR', ani_fone: '', ani_email: '', ani_diaaniv: '', ani_mes: '',
    });
    setCompradorModal(true);
  };

  const openTornarPadraoModal = () => {
    setPadForm({
      cli_desc1: parseFloat(String(fd.ped_pri ?? order.ped_pri)) || 0,
      cli_desc2: parseFloat(String(fd.ped_seg ?? order.ped_seg)) || 0,
      cli_desc3: parseFloat(String(fd.ped_ter ?? order.ped_ter)) || 0,
      cli_desc4: parseFloat(String(fd.ped_qua ?? order.ped_qua)) || 0,
      cli_desc5: parseFloat(String(fd.ped_qui ?? order.ped_qui)) || 0,
      cli_desc6: parseFloat(String(fd.ped_sex ?? order.ped_sex)) || 0,
      cli_desc7: parseFloat(String(fd.ped_set ?? order.ped_set)) || 0,
      cli_desc8: parseFloat(String(fd.ped_oit ?? order.ped_oit)) || 0,
      cli_desc9: parseFloat(String(fd.ped_nov ?? order.ped_nov)) || 0,
      cli_prazopg:        ((fd.ped_condpag   ?? order.ped_condpag)   as string) || '',
      cli_tabela:         ((fd.ped_tabela    ?? order.ped_tabela)    as string) || '',
      cli_frete:          ((fd.ped_tipofrete ?? order.ped_tipofrete) as string) || 'C',
      cli_comprador:      ((fd.ped_comprador ?? order.ped_comprador) as string) || '',
      cli_emailcomprador: '',
      cli_transportadora: String(fd.ped_transp ?? order.ped_transp ?? ''),
    });
    setTornarPadraoModal(true);
  };

  const saveComprador = async () => {
    const clienteId = fd.ped_cliente ?? order.ped_cliente;
    if (!clienteId || !compForm.ani_nome.trim()) return;
    setModalSaving(true);
    try {
      await api.post(`/clients/${clienteId}/contacts`, compForm);
      setCompradorModal(false);
    } catch (err) { console.error(err); }
    finally { setModalSaving(false); }
  };

  const saveTornarPadrao = async () => {
    const clienteId = fd.ped_cliente ?? order.ped_cliente;
    if (!clienteId || !industriaId) return;
    setModalSaving(true);
    try {
      await api.post(`/clients/${clienteId}/industries`, { ...padForm, cli_forcodigo: industriaId });
      setTornarPadraoModal(false);
    } catch (err) { console.error(err); }
    finally { setModalSaving(false); }
  };

  useEffect(() => {
    if (isView) return;
    api.get('/sellers').then(r => setSellers(r.data.data || [])).catch(() => {});
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || [])).catch(() => {});
  }, [isView, mode]);

  // IDs derivados — declarados antes dos useEffects que dependem deles
  const industriaId = fd.ped_industria ?? order.ped_industria;
  const clienteId   = fd.ped_cliente   ?? (mode === 'new' ? undefined : order.ped_cliente);

  // Carregar lista de tabelas disponíveis para a indústria
  useEffect(() => {
    if (!industriaId) { setPriceTables([]); onPriceTableItemsChange?.([]); return; }
    api.get(`/price-tables/${industriaId}`).then(r => setPriceTables(r.data.data || [])).catch(() => {});
  }, [industriaId]);

  // Carregar itens da tabela selecionada na memória (para entrada de itens)
  const currentTabela = (fd.ped_tabela ?? order.ped_tabela) as string;
  useEffect(() => {
    if (!industriaId || !currentTabela) { onPriceTableItemsChange?.([]); return; }
    api.get(`/price-tables/${industriaId}/items?tabela=${encodeURIComponent(currentTabela)}`)
      .then(r => onPriceTableItemsChange?.(r.data.data || []))
      .catch(() => {});
  }, [industriaId, currentTabela]);
  const rawSituacao = (fd.ped_situacao ?? order.ped_situacao) as string;
  const currentSituacao = rawSituacao === 'A' ? 'CC' : rawSituacao;
  const sc = statusColor(currentSituacao);
  const discountKeys = ['ped_pri','ped_seg','ped_ter','ped_qua','ped_qui','ped_sex','ped_set','ped_oit'] as const;
  const totalBruto = order.ped_totbruto || 0;
  const totalLiq   = order.ped_totliq   || 0;
  const discPct    = totalBruto > 0 ? (((totalBruto - totalLiq) / totalBruto) * 100).toFixed(0) : '0';

  const card: React.CSSProperties = {
    background: G.card, borderRadius: 16, border: `1px solid ${G.border}`,
    padding: '14px 16px', position: 'relative', overflow: 'hidden',
  };

  const cardTitle = (_color: string) => ({
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
  });

  const colorBar = (color: string): React.CSSProperties => ({
    position: 'absolute', left: 0, top: 16, bottom: 16,
    width: 3, borderRadius: '0 3px 3px 0', background: color,
  });

  return (
    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }} onKeyDown={handleEnterAsTab}>

      {/* ── Strip topo: ID, Status, Tabela, OC ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

        {/* ID + Data */}
        <div style={{ ...card, minWidth: 160, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, height: 16, display: 'flex', alignItems: 'center' }}>
            Identificação
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: G.text, letterSpacing: -1, fontFamily: 'monospace', marginTop: 6, lineHeight: 1 }}>
            {order.ped_pedido}
          </span>
          <div style={{ marginTop: 6, flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            {isView ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: '#FFD20020', color: G.textSec, border: `1px solid ${G.border}`,
              }}>
                {fmtDate(order.ped_data)}
              </span>
            ) : (
              <input
                type="date"
                value={(fd.ped_data ?? order.ped_data ?? '').split('T')[0]}
                onChange={e => onChangeField('ped_data', e.target.value)}
                style={{ ...einp, fontSize: 11, width: '100%' }}
              />
            )}
          </div>
        </div>

        {/* Status */}
        <div style={{ ...card, width: 190, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, height: 16, display: 'flex', alignItems: 'center' }}>
            Status Operacional
          </span>
          <div style={{ marginTop: 6, flex: 1 }}>
            {isView ? (
              <span style={{
                fontSize: 11, fontWeight: 900, padding: '5px 0', borderRadius: 20,
                width: 120, textAlign: 'center',
                background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                display: 'inline-block', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {statusLabel(currentSituacao)}
              </span>
            ) : (
              <select
                value={currentSituacao}
                onChange={e => onChangeField('ped_situacao', e.target.value === 'CC' ? 'A' : e.target.value)}
                style={{ ...einp, cursor: 'pointer' }}
              >
                <option value="P">Pedido</option>
                <option value="C">Cotação</option>
                <option value="CC">Cot. Confirmada</option>
                <option value="F">Faturado</option>
                <option value="Q">FILA</option>
                <option value="G">Garantia</option>
                <option value="B">Bonificação</option>
                <option value="X">Cancelado</option>
              </select>
            )}
          </div>
          <div style={{ paddingTop: 8, borderTop: `1px solid ${G.border}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase' }}>Fluxo de venda</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: G.success, display: 'inline-block', boxShadow: '0 0 0 3px #16A34A22' }} />
          </div>
        </div>

        {/* Indústria */}
        <div style={{ ...card, width: 200, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, height: 16, display: 'flex', alignItems: 'center' }}>
            Indústria
          </span>
          <div style={{ marginTop: 6, flex: 1 }}>
            {isView ? (
              <span style={{ fontSize: 14, fontWeight: 800, color: G.text }}>
                {order.for_nomered || '—'}
              </span>
            ) : (
              <select
                value={fd.ped_industria ?? order.ped_industria ?? ''}
                onChange={e => onChangeField('ped_industria', parseInt(e.target.value))}
                style={{ ...einp, cursor: 'pointer' }}
              >
                <option value="">— Selecione —</option>
                {industrias.map(i => (
                  <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ paddingTop: 8, borderTop: `1px solid ${G.border}40` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase' }}>Fornecedor</span>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ ...card, width: 220, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, height: 16, display: 'flex', alignItems: 'center' }}>
            Tabela de Preço
          </span>
          <div style={{ marginTop: 6, flex: 1 }}>
            {isView ? (
              <span style={{ fontSize: 14, fontWeight: 800, color: G.text }}>
                {order.ped_tabela || 'Padrão'}
              </span>
            ) : (
              <select
                value={fd.ped_tabela ?? order.ped_tabela ?? ''}
                onChange={e => onChangeField('ped_tabela', e.target.value)}
                style={{ ...einp, cursor: 'pointer' }}
              >
                <option value="">— Selecione —</option>
                {priceTables.map(t => (
                  <option key={t.nome_tabela} value={t.nome_tabela}>{t.nome_tabela}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ paddingTop: 8, borderTop: `1px solid ${G.border}40` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase' }}>Preços ativos</span>
          </div>
        </div>

        {/* OC Control */}
        <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, height: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShoppingCart size={10} /> Nº DA OC (Ord. Compra)
          </span>
          <div style={{ marginTop: 6, flex: 1 }}>
            {isView ? (
              <span style={{
                fontSize: 14, fontWeight: 900, color: order.ped_oc ? G.success : G.text,
                background: order.ped_oc ? G.success + '10' : 'transparent',
                padding: order.ped_oc ? '2px 8px' : 0, borderRadius: 6
              }}>
                {order.ped_oc || 'Não informado'}
              </span>
            ) : (
              <input
                placeholder="Ex: OC-50123"
                value={fd.ped_oc ?? order.ped_oc ?? ''}
                onChange={e => onChangeField('ped_oc', e.target.value)}
                style={{ ...einp, fontWeight: 700, color: G.success, width: '100%' }}
              />
            )}
          </div>
          <div style={{ paddingTop: 8, borderTop: `1px solid ${G.border}40` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase' }}>Referência do cliente</span>
          </div>
        </div>

        {/* Descontos */}
        <div style={{ ...card, flex: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 10 }}>
            Descontos Progressivos
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {discountKeys.map((k, i) => {
              const rawVal = (fd as any)[k] ?? (order as any)[k];
              let val = parseFloat(String(rawVal)) || 0;
              // Normaliza dados legados do V1 que armazenavam % em centésimos (ex: 4500 → 45,00%)
              if (val > 100) val = parseFloat((val / 100).toFixed(2));
              if (isView) {
                return <DiscountBox key={k} index={i} value={val} />;
              }
              return (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.4 }}>
                    {i + 1}º desc.
                  </span>
                  <PercentInput
                    value={val}
                    onChange={v => onChangeField(k as keyof OrderFull, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4 cards: Cliente, Transportadora, Vendedor, Dados ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

        {/* Cliente */}
        <div style={{ ...card }}>
          <div style={colorBar('#0891B2')} />
          <div style={cardTitle('#0891B2')}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#0891B212', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={13} style={{ color: '#0891B2' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Cliente</span>
          </div>
          {isView ? (
            <>
              <ReadField label="Nome" value={order.cli_nomred || order.cli_nome} />
              <ReadField label="CNPJ" value={order.cli_cnpj} mono />
              <ReadField label="Cidade/UF" value={order.cli_cidade ? `${order.cli_cidade} / ${order.cli_uf || ''}` : undefined} />
              <ReadField label="Vendedor" value={order.ven_nome} />
            </>
          ) : (
            <>
              <div style={{ padding: '6px 0', borderBottom: `1px solid ${G.border}30` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>
                  Cliente
                </span>
                <ClientCombobox
                  value={(fd.ped_cliente ?? order.ped_cliente) || 0}
                  onChange={(v, vendedor, nomred) => {
                    onChangeField('ped_cliente', v);
                    if (nomred) onChangeField('cli_nomred' as any, nomred);
                    if (mode === 'new' && vendedor) onChangeField('ped_vendedor', vendedor);
                  }}
                  style={einp}
                  selectedLabel={(fd as any).cli_nomred || order.cli_nomred || order.cli_nome}
                />
                {onReaplicarPolitica && (
                  <button
                    onClick={onReaplicarPolitica}
                    title="Reaplicar política de descontos do cliente em todos os itens"
                    style={{
                      marginTop: 6, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '5px 0', borderRadius: 8, border: `1px solid ${'#2563EB'}44`,
                      background: '#2563EB12', color: '#2563EB',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={11} /> Reaplicar Política
                  </button>
                )}
              </div>
              <div style={{ padding: '6px 0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>
                  Vendedor
                </span>
                <select
                  value={(fd.ped_vendedor ?? order.ped_vendedor) || ''}
                  onChange={e => onChangeField('ped_vendedor', parseInt(e.target.value))}
                  style={{ ...einp, cursor: 'pointer' }}
                >
                  <option value="">— Selecione —</option>
                  {sellers.map(v => (
                    <option key={v.ven_codigo} value={v.ven_codigo}>{v.ven_nome}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Transportadora */}
        <div style={{ ...card }}>
          <div style={colorBar('#D97600')} />
          <div style={cardTitle('#D97600')}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#D9760012', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={13} style={{ color: '#D97600' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Transportadora</span>
          </div>
          {isView ? (
            <>
              <ReadField label="Frete" value={(fd.ped_tipofrete ?? order.ped_tipofrete) === 'C' ? 'CIF — Por conta da indústria' : 'FOB — Por conta do cliente'} />
              <ReadField label="Transportadora" value={
                transportadoras.find(t => t.value === (fd.ped_transp ?? order.ped_transp))?.label || '—'
              } />
            </>
          ) : (
            <>
              <EditSelect
                label="Tipo de Frete"
                value={(fd.ped_tipofrete ?? order.ped_tipofrete) as string}
                onChange={v => onChangeField('ped_tipofrete', v)}
                options={[
                  { value: 'C', label: 'CIF — Por conta da indústria' },
                  { value: 'F', label: 'FOB — Por conta do cliente' },
                ]}
              />
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Transportadora</span>
                <select
                  value={fd.ped_transp ?? order.ped_transp ?? ''}
                  onChange={e => onChangeField('ped_transp', e.target.value ? parseInt(e.target.value) : null)}
                  style={{ ...einp, cursor: 'pointer' }}
                >
                  <option value="">— Selecione —</option>
                  {transportadoras.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Observação */}
        <div style={{ ...card }}>
          <div style={colorBar('#EC4899')} />
          <div style={cardTitle('#EC4899')}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#EC489912', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={13} style={{ color: '#EC4899' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Observação</span>
          </div>
          {isView ? (
            <ReadField label="Obs." value={(fd.ped_obs ?? order.ped_obs) as string} />
          ) : (
            <div style={{ padding: '6px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>
                Observação
              </span>
              <textarea
                value={((fd.ped_obs ?? order.ped_obs) as string) || ''}
                onChange={e => onChangeField('ped_obs', e.target.value)}
                rows={5}
                style={{ ...einp, resize: 'none', flex: 1, fontFamily: 'inherit', lineHeight: 1.5 }}
                placeholder="Observações do pedido..."
              />
              {/* Toggle permitir itens duplicados */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                marginTop: 10, padding: '8px 10px', borderRadius: 8,
                background: (allowDuplicateOverride ?? (userParams?.itemDuplicado ?? false))
                  ? '#FEF9C322' : `${G.border}`,
                border: `1px solid ${(allowDuplicateOverride ?? (userParams?.itemDuplicado ?? false)) ? G.mustard + '99' : G.border}`,
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 32, height: 18, borderRadius: 9, position: 'relative', flexShrink: 0,
                  background: (allowDuplicateOverride ?? (userParams?.itemDuplicado ?? false)) ? G.mustard : '#CBD5E1',
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, borderRadius: '50%',
                    width: 14, height: 14, background: '#fff',
                    left: (allowDuplicateOverride ?? (userParams?.itemDuplicado ?? false)) ? 16 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                  <input
                    type="checkbox"
                    checked={allowDuplicateOverride ?? (userParams?.itemDuplicado ?? false)}
                    onChange={e => setAllowDuplicateOverride(e.target.checked)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: G.textSec, display: 'block', lineHeight: 1.2 }}>
                    Permitir itens repetidos
                  </span>
                  <span style={{ fontSize: 10, color: G.textMuted }}>
                    Permite lançar o mesmo produto mais de uma vez
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Dados do Pedido */}
        <div style={{ ...card }}>
          <div style={colorBar('#7C3AED')} />
          <div style={cardTitle('#7C3AED')}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#7C3AED12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings2 size={13} style={{ color: '#7C3AED' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Dados do Pedido</span>
          </div>
          {isView ? (
            <>
              <ReadField label="Pagamento" value={fd.ped_condpag ?? order.ped_condpag} />
              <ReadField label="Contato" value={fd.ped_comprador ?? order.ped_comprador} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><ReadField label="Ped. Cliente / OC" value={order.ped_pedcli} mono /></div>
                <div style={{ flex: 1 }}><ReadField label="Ped. Ind." value={order.ped_pedindustria} mono /></div>
              </div>
            </>
          ) : (
            <>
              <EditField label="Condição de Pagamento" value={(fd.ped_condpag ?? order.ped_condpag) as string} onChange={v => onChangeField('ped_condpag', v)} />
              <div style={{ padding: '6px 0', borderBottom: `1px solid ${G.border}30` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>
                  Contato / Comprador
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={((fd.ped_comprador ?? order.ped_comprador) as string) || ''}
                    onChange={e => onChangeField('ped_comprador', e.target.value)}
                    style={{ ...einp }}
                  />
                  <button
                    onClick={openCompradorModal}
                    title="Cadastrar comprador"
                    style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: G.mustard, border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} style={{ color: G.text }} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <EditField label="Ped. Cliente / OC" value={(fd.ped_pedcli ?? order.ped_pedcli ?? '') as string} onChange={v => onChangeField('ped_pedcli', v)} />
                </div>
                <div style={{ flex: 1 }}>
                  <EditField label="Ped. Ind." value={(fd.ped_pedindustria ?? order.ped_pedindustria ?? '') as string} onChange={v => onChangeField('ped_pedindustria', v)} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Items + Financial ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Items table */}
        <div style={{
          flex: 1, minWidth: 0, background: G.card,
          borderRadius: 16, border: `1px solid ${G.border}`, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Resumo dos Itens — {(orderItems ?? order.items).length} item(s)
            </span>
          </div>
          <div style={{ height: 1, background: G.border, margin: '10px 16px 0' }} />
          <ItemsTable items={orderItems ?? order.items} />
        </div>

        {/* Financial summary */}
        <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Resumo */}
          <div style={{
            background: G.card, borderRadius: 16, border: `1px solid ${G.border}`,
            padding: '16px', textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', bottom: -12, right: -12, width: 60, height: 60, borderRadius: '50%', background: `${G.mustard}22`, filter: 'blur(16px)' }} />
            <BarChart3 size={18} style={{ color: G.textSec, margin: '0 auto 6px' }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>
              Resumo Financeiro
            </span>
            <span style={{ fontSize: 22, fontWeight: 900, color: G.text, letterSpacing: -0.8, display: 'block', marginTop: 4 }}>
              {fmt(totalBruto)}
            </span>
            <span style={{ fontSize: 10, color: G.textMuted, display: 'block', marginTop: 2 }}>valor bruto total</span>
          </div>

          {/* Sub-grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: 'Subtotal', value: fmt(totalBruto), color: G.text },
              { label: 'Descontos', value: `-${discPct}%`, color: G.danger },
              { label: 'IPI', value: fmt(order.ped_totalipi), color: G.text },
              { label: 'Frete', value: order.ped_tipofrete === 'C' ? 'CIF' : 'FOB', color: G.textMuted },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: G.card, borderRadius: 10, border: `1px solid ${G.border}`,
                padding: '8px', textAlign: 'center',
              }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color, display: 'block', marginTop: 2 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Total líquido */}
          <div style={{
            background: G.text, borderRadius: 16, padding: '16px',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.12), transparent)' }} />
            <div style={{ position: 'relative' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#ffffff99', textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>
                Total Líquido
              </span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5, display: 'block', marginTop: 4 }}>
                {fmt(totalLiq)}
              </span>
            </div>
          </div>

          {/* TORNAR PADRÃO — só no modo edição */}
          {!isView && (
            <button
              onClick={openTornarPadraoModal}
              title="Definir condição de pagamento e frete como padrão para novos pedidos desta indústria"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 12, width: '100%',
                background: `${G.mustard}22`, border: `1px solid ${G.mustard}66`,
                color: G.textSec, fontSize: 10, fontWeight: 800,
                letterSpacing: 0.6, textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <Star size={12} style={{ color: G.mustard }} />
              Tornar Padrão
            </button>
          )}

        </div>
      </div>

      {/* ── Modal: Cadastrar Comprador ── */}
      {compradorModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1200,
              background: 'rgba(28,37,46,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={e => { if (e.target === e.currentTarget) setCompradorModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={{
                background: G.bg, borderRadius: 20, border: `1px solid ${G.border}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                width: 420, padding: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${G.mustard}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={15} style={{ color: G.textSec }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: G.text }}>Cadastrar Comprador</div>
                    <div style={{ fontSize: 10, color: G.textMuted }}>Será vinculado ao cliente do pedido</div>
                  </div>
                </div>
                <button onClick={() => setCompradorModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.textMuted }}>
                  <X size={16} />
                </button>
              </div>

              {[
                { label: 'Nome *', key: 'ani_nome', type: 'text' },
                { label: 'Cargo / Função', key: 'ani_funcao', type: 'text' },
                { label: 'Telefone', key: 'ani_fone', type: 'text' },
                { label: 'E-mail', key: 'ani_email', type: 'email' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>{f.label}</span>
                  <input
                    type={f.type}
                    value={(compForm as any)[f.key] || ''}
                    onChange={e => setCompForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ ...einp, background: G.card }}
                  />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>Dia Aniversário</span>
                  <input
                    type="number" min="1" max="31" placeholder="1-31"
                    value={compForm.ani_diaaniv}
                    onChange={e => setCompForm(p => ({ ...p, ani_diaaniv: e.target.value }))}
                    style={{ ...einp, background: G.card }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>Mês Aniversário</span>
                  <select
                    value={compForm.ani_mes}
                    onChange={e => setCompForm(p => ({ ...p, ani_mes: e.target.value }))}
                    style={{ ...einp, background: G.card, cursor: 'pointer' }}
                  >
                    <option value="">—</option>
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setCompradorModal(false)} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  onClick={saveComprador}
                  disabled={modalSaving || !compForm.ani_nome.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', borderRadius: 10, border: 'none',
                    background: modalSaving || !compForm.ani_nome.trim() ? G.border : G.mustard,
                    color: G.text, fontSize: 12, fontWeight: 800,
                    cursor: modalSaving || !compForm.ani_nome.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {modalSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
      )}

      {/* ── Modal: Tornar Padrão ── */}
      {tornarPadraoModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1200,
              background: 'rgba(28,37,46,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={e => { if (e.target === e.currentTarget) setTornarPadraoModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={{
                background: G.card, borderRadius: 20, border: `1px solid ${G.border}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                width: 500, padding: 24,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${G.mustard}22`, border: `1px solid ${G.mustard}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardCheck size={17} style={{ color: G.textSec }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: G.text }}>Definir Padrão do Cliente</div>
                    <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2, maxWidth: 340 }}>
                      Revise e edite as condições comerciais que serão salvas como padrão para este cliente.
                    </div>
                  </div>
                </div>
                <button onClick={() => setTornarPadraoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.textMuted, flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>

              {/* Indústria + Cliente info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Indústria', value: order.for_nomered || String(industriaId) },
                  { label: 'Cliente',   value: order.cli_nomred || order.cli_nome },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: G.bg, borderRadius: 10, border: `1px solid ${G.border}`, padding: '8px 12px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: G.text }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Prazo de Pagamento | Tabela de Preço */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { label: 'Prazo de Pagamento', key: 'cli_prazopg' },
                  { label: 'Tabela de Preço',    key: 'cli_tabela'  },
                ].map(f => (
                  <div key={f.key}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>{f.label}</span>
                    <input type="text" value={(padForm as any)[f.key] || ''} onChange={e => setPadForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...einp, background: G.bg }} />
                  </div>
                ))}
              </div>

              {/* Tipo de Frete | Cód. Transportadora */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>Tipo de Frete</span>
                  <select value={padForm.cli_frete} onChange={e => setPadForm(p => ({ ...p, cli_frete: e.target.value }))} style={{ ...einp, background: G.bg, cursor: 'pointer' }}>
                    <option value="C">CIF (Pago)</option>
                    <option value="F">FOB (A pagar)</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>Cód. Transportadora</span>
                  <input type="text" value={padForm.cli_transportadora} onChange={e => setPadForm(p => ({ ...p, cli_transportadora: e.target.value }))} style={{ ...einp, background: G.bg }} />
                </div>
              </div>

              {/* Dados do Comprador */}
              <div style={{ background: G.bg, borderRadius: 12, border: `1px solid ${G.border}`, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Dados do Comprador</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>Nome</span>
                    <input type="text" value={padForm.cli_comprador} onChange={e => setPadForm(p => ({ ...p, cli_comprador: e.target.value }))} style={{ ...einp, background: G.card }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>Email</span>
                    <input type="email" value={padForm.cli_emailcomprador} onChange={e => setPadForm(p => ({ ...p, cli_emailcomprador: e.target.value }))} placeholder="email@empresa.com" style={{ ...einp, background: G.card }} />
                  </div>
                </div>
              </div>

              {/* Descontos Padrão */}
              <div style={{ background: G.bg, borderRadius: 12, border: `1px solid ${G.border}`, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Descontos Padrão (%)</div>
                {/* Row 1: 1º–5º */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 8 }}>
                  {['cli_desc1','cli_desc2','cli_desc3','cli_desc4','cli_desc5'].map((k, i) => (
                    <div key={k}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, display: 'block', textAlign: 'center', marginBottom: 3 }}>{i+1}º</span>
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={(padForm as any)[k] === 0 ? '' : (padForm as any)[k]}
                        placeholder="0"
                        onChange={e => setPadForm(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))}
                        style={{ ...einp, background: G.card, textAlign: 'center', padding: '6px 4px', fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
                {/* Row 2: 6º–9º */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {['cli_desc6','cli_desc7','cli_desc8','cli_desc9'].map((k, i) => (
                    <div key={k}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, display: 'block', textAlign: 'center', marginBottom: 3 }}>{i+6}º</span>
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={(padForm as any)[k] === 0 ? '' : (padForm as any)[k]}
                        placeholder="0"
                        onChange={e => setPadForm(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))}
                        style={{ ...einp, background: G.card, textAlign: 'center', padding: '6px 4px', fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setTornarPadraoModal(false)} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  onClick={saveTornarPadrao}
                  disabled={modalSaving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', borderRadius: 10, border: 'none',
                    background: modalSaving ? G.border : G.mustard,
                    color: G.text, fontSize: 12, fontWeight: 800,
                    cursor: modalSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {modalSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ClipboardCheck size={13} />}
                  Salvar Padrão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
    </div>
  );
}

// ─── Obs section ──────────────────────────────────────────────────────────────
function ObsModal({
  obs, isEdit, onChange, onClose,
}: {
  obs: string; isEdit?: boolean;
  onChange?: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState(obs || '');
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    taRef.current?.focus();
    taRef.current?.setSelectionRange(draft.length, draft.length);
  }, []);

  function handleSave() {
    onChange?.(draft);
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, background: G.card,
          borderRadius: 18, border: `1px solid ${G.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${G.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontWeight: 900, fontSize: 14, color: G.text, margin: 0 }}>Observações do Pedido</p>
            <p style={{ fontSize: 11, color: G.textMuted, margin: '2px 0 0' }}>F6 · Campo livre para anotações</p>
          </div>
          <button
            onClick={onClose}
            title="Fechar observações"
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`,
              background: G.cardHi, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: G.textMuted,
              fontSize: 16, fontWeight: 700, lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {isEdit ? (
            <textarea
              ref={taRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={8}
              style={{
                width: '100%', background: G.cardHi, border: `1px solid ${G.border}`,
                borderRadius: 10, padding: '14px 16px',
                fontSize: 13, color: G.text, lineHeight: 1.7,
                outline: 'none', resize: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = G.textSec)}
              onBlur={e => (e.target.style.borderColor = G.border)}
              placeholder="Digite as observações do pedido..."
            />
          ) : (
            <div style={{
              background: G.cardHi, borderRadius: 10, border: `1px solid ${G.border}`,
              padding: '14px 16px', minHeight: 160,
              fontSize: 13, color: draft ? G.text : G.textMuted, lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {draft || 'Nenhuma observação registrada.'}
            </div>
          )}
          {isEdit && (
            <p style={{ fontSize: 10, color: G.textMuted, margin: '8px 0 0', textAlign: 'right' }}>
              {draft.length} caractere{draft.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Footer */}
        {isEdit && (
          <div style={{
            padding: '14px 24px', borderTop: `1px solid ${G.border}`,
            display: 'flex', gap: 8, justifyContent: 'flex-end',
          }}>
            <button
              onClick={onClose}
              title="Descartar alterações nas observações"
              style={{
                padding: '8px 20px', borderRadius: 9, border: `1px solid ${G.border}`,
                background: G.cardHi, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', color: G.textMuted,
              }}
            >Cancelar</button>
            <button
              onClick={handleSave}
              title="Salvar observações do pedido"
              style={{
                padding: '8px 24px', borderRadius: 9, border: 'none',
                background: G.mustard, fontSize: 12, fontWeight: 900,
                cursor: 'pointer', color: G.text,
              }}
            >Salvar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Placeholder section ──────────────────────────────────────────────────────
function PlaceholderSection({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: G.textMuted, fontSize: 13, gap: 8 }}>
      <Package size={16} style={{ opacity: 0.4 }} />
      {label} — em breve
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function PedidoModal({ isOpen, mode, order, onClose, onSaved, onUpdated, initialIndustriaId, initialClienteId, initialClienteLabel }: PedidoModalProps) {
  const navigate = useNavigate();
  const authUser = useAuthStore(s => s.user);
  const [activeSection, setActiveSection] = useState<SectionKey | 'xml'>('principal');
  const [hoveredNav, setHoveredNav]       = useState<SectionKey | null>(null);
  const [showXms,    setShowXms]          = useState(false);
  const [showTxt,    setShowTxt]          = useState(false);
  const [showMagic,  setShowMagic]        = useState(false);
  const [pendingGroupDisc, setPendingGroupDisc] = useState(false);
  const [pedidoSalvo, setPedidoSalvo]     = useState(false);
  const [fullOrder, setFullOrder]         = useState<OrderFull | null>(null);
  const [formData, setFormData]           = useState<Partial<OrderFull>>({});
  const [loading, setLoading]             = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [userParams, setUserParams]       = useState<{ usaDecimais: boolean; qtdDecimais: number; itemDuplicado: boolean; qtdEnter: number; fmtPesquisa: string; mostraCodigoOri: boolean } | null>(null);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState<boolean | null>(null);
  const [priceTableItems, setPriceTableItems] = useState<any[]>([]);
  const [orderItems,      setOrderItems]      = useState<any[]>([]);
  const [transportadoras, setTransportadoras] = useState<{ value: number; label: string }[]>([]);
  const [clientDiscounts,  setClientDiscounts]  = useState<any[]>([]);
  const [clientIndustries, setClientIndustries] = useState<any[]>([]);
  const [tableGroupDiscs,  setTableGroupDiscs]  = useState<any[]>([]);
  const isView = mode === 'view';
  const isPersisted = mode !== 'new' || pedidoSalvo;

  const requireSaved = async (action: () => void) => {
    if (!isPersisted) {
      const ok = await handleSave(false);
      if (!ok) return;
    }
    action();
  };

  const onChangeField = (field: keyof OrderFull, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Passo 1 — defaults da indústria (só modo new). Fica aqui para não re-executar ao trocar aba.
  const newIndId = mode === 'new' ? (formData.ped_industria ?? fullOrder?.ped_industria) : null;
  const newCliId = mode === 'new' ? (formData.ped_cliente   ?? fullOrder?.ped_cliente)   : null;
  const indDefaultsRef = useRef<Partial<Record<string, number>>>({});

  useEffect(() => {
    if (!newIndId) return;
    api.get(`/suppliers/${newIndId}`)
      .then(r => {
        if (!r.data.success) return;
        const s = r.data.data;
        const normPct = (v: any) => { const n = parseFloat(v) || 0; return n > 100 ? parseFloat((n / 100).toFixed(2)) : n; };
        const defaults = {
          ped_pri: normPct(s.for_des1), ped_seg: normPct(s.for_des2),
          ped_ter: normPct(s.for_des3), ped_qua: normPct(s.for_des4),
          ped_qui: normPct(s.for_des5), ped_sex: normPct(s.for_des6),
          ped_set: normPct(s.for_des7), ped_oit: normPct(s.for_des8),
          ped_nov: normPct(s.for_des9),
        };
        indDefaultsRef.current = defaults;
        Object.entries(defaults).forEach(([k, v]) => onChangeField(k as any, v));
        if (s.for_tipofrete) onChangeField('ped_tipofrete', String(s.for_tipofrete).trim().substring(0, 1) || 'C');
      })
      .catch(() => {});
  }, [newIndId]);

  // Passo 2 — condições comerciais do cli_ind sobrescrevem defaults da indústria
  useEffect(() => {
    if (!newCliId || !newIndId) return;
    api.get(`/clients/${newCliId}/industries`)
      .then(r => {
        const list: any[] = r.data.data || [];
        const match = list.find(i => Number(i.cli_forcodigo) === Number(newIndId));
        if (!match) return;
        const normC = (v: any, fallback: number) => { const n = parseFloat(v) || 0; return n > 0 ? (n > 100 ? parseFloat((n / 100).toFixed(2)) : n) : fallback; };
        const d = indDefaultsRef.current;
        onChangeField('ped_pri', normC(match.cli_desc1, d.ped_pri ?? 0));
        onChangeField('ped_seg', normC(match.cli_desc2, d.ped_seg ?? 0));
        onChangeField('ped_ter', normC(match.cli_desc3, d.ped_ter ?? 0));
        onChangeField('ped_qua', normC(match.cli_desc4, d.ped_qua ?? 0));
        onChangeField('ped_qui', normC(match.cli_desc5, d.ped_qui ?? 0));
        onChangeField('ped_sex', normC(match.cli_desc6, d.ped_sex ?? 0));
        onChangeField('ped_set', normC(match.cli_desc7, d.ped_set ?? 0));
        onChangeField('ped_oit', normC(match.cli_desc8, d.ped_oit ?? 0));
        onChangeField('ped_nov', normC(match.cli_desc9, d.ped_nov ?? 0));
        if (match.cli_prazopg)        onChangeField('ped_condpag',   match.cli_prazopg);
        if (match.cli_tabela)         onChangeField('ped_tabela',    match.cli_tabela);
        if (match.cli_frete)          onChangeField('ped_tipofrete', String(match.cli_frete).trim().substring(0, 1) || 'C');
        if (match.cli_comprador)      onChangeField('ped_comprador', match.cli_comprador);
        if (match.cli_transportadora) onChangeField('ped_transp',    parseInt(match.cli_transportadora));
      })
      .catch(() => {});
  }, [newCliId, newIndId]);

  // Carrega descontos e política da indústria do cliente sempre que o cliente mudar
  const clienteIdAtual = (formData.ped_cliente ?? fullOrder?.ped_cliente) || 0;
  useEffect(() => {
    if (!clienteIdAtual) { setClientDiscounts([]); setClientIndustries([]); return; }
    api.get(`/clients/${clienteIdAtual}/discounts`).then(r => r.data.success && setClientDiscounts(r.data.data || [])).catch(() => {});
    api.get(`/clients/${clienteIdAtual}/industries`).then(r => r.data.success && setClientIndustries(r.data.data || [])).catch(() => {});
  }, [clienteIdAtual]);

  useEffect(() => {
    api.get('/grupo-desc').then(r => r.data.success && setTableGroupDiscs(r.data.data || [])).catch(() => {});
  }, []);

  // Reaplica política de descontos do cliente em todos os itens do pedido
  function reaplicarPolitica() {
    if (!fullOrder) return;
    const ord = { ...fullOrder, ...formData };
    const normV = (v: any) => { const n = parseFloat(v) || 0; return n > 100 ? parseFloat((n / 100).toFixed(2)) : n; };

    const indPolicy = clientIndustries.find(i => Number(i.cli_forcodigo) === Number(ord.ped_industria));
    const descs: number[] = indPolicy
      ? ['cli_desc1','cli_desc2','cli_desc3','cli_desc4','cli_desc5','cli_desc6','cli_desc7','cli_desc8','cli_desc9'].map(k => normV(indPolicy[k]))
      : [ord.ped_pri,ord.ped_seg,ord.ped_ter,ord.ped_qua,ord.ped_qui,ord.ped_sex,ord.ped_set,ord.ped_oit,ord.ped_nov].map(normV);

    if (!indPolicy && !clientIndustries.length) {
      toast.error('Política do cliente não carregada. Aguarde e tente novamente.');
      return;
    }

    const catalogMap = new Map(priceTableItems.map((p: any) => [String(p.pro_codigo).trim().toUpperCase(), p]));

    let updated = 0;

    setOrderItems(prev => prev.map((item: any) => {
      const [d1,d2,d3,d4,d5,d6,d7,d8,d9] = descs;
      const catalogItem = catalogMap.get(String(item.ite_produto).trim().toUpperCase());
      const d10 = parseFloat(catalogItem?.desconto_add) || 0;

      let liq = item.ite_puni;
      [d1,d2,d3,d4,d5,d6,d7,d8,d9].forEach((d: number) => { liq = liq * (1 - d / 100); });
      liq = liq * (1 - d10 / 100);
      const totliquido = Math.round((liq  * item.ite_quant) * 100) / 100;
      const totbruto   = Math.round((item.ite_puni * item.ite_quant) * 100) / 100;
      const valcomipi  = Math.round((totliquido * (1 + (item.ite_ipi || 0) / 100)) * 100) / 100;
      const valcomst   = Math.round((valcomipi  * (1 + (item.ite_st  || 0) / 100)) * 100) / 100;

      updated++;
      return {
        ...item,
        ite_des1: d1, ite_des2: d2, ite_des3: d3, ite_des4: d4, ite_des5: d5,
        ite_des6: d6, ite_des7: d7, ite_des8: d8, ite_des9: d9, ite_des10: d10,
        ite_puniliq: liq, ite_totbruto: totbruto, ite_totliquido: totliquido,
        ite_valcomipi: valcomipi, ite_valcomst: valcomst,
      };
    }));

    toast.success(`Política reaplicada em ${updated} item(s).`);
  }

  // Load full order (with items) when modal opens
  useEffect(() => {
    if (!isOpen || !order) {
      if (isOpen && mode === 'new') {
        // Limpa imediatamente qualquer dado do pedido anterior antes do fetch
        setFullOrder(null);
        setFormData({});
        setOrderItems([]);
        setPedidoSalvo(false);
        setSaveError(null);

        const fetchNextNumber = async () => {
          setLoading(true);
          try {
            const [numRes, paramsRes] = await Promise.allSettled([
              api.get('/orders/next-number'),
              authUser?.id ? api.get(`/parametros/${authUser.id}`) : Promise.reject('no user'),
            ]);

            if (numRes.status === 'rejected') throw new Error('Erro ao buscar número do pedido');
            const data = numRes.value.data.data;

            const params = paramsRes.status === 'fulfilled' && paramsRes.value.data.success
              ? paramsRes.value.data.data
              : null;

            setUserParams({
              usaDecimais:    params?.par_usadecimais  !== 'N',
              qtdDecimais:    parseInt(String(params?.par_qtddecimais ?? 2)) || 2,
              itemDuplicado:  params?.par_itemduplicado === 'S',
              qtdEnter:       parseInt(String(params?.par_qtdenter    ?? 2)) || 2,
              fmtPesquisa:    params?.par_fmtpesquisa ?? 'D',
              mostraCodigoOri: params?.par_mostracodori === 'S',
            });

            const newOrder: OrderFull = {
              ped_numero: data.sequence,
              ped_pedido: data.formatted_number,
              ped_data: new Date().toISOString().split('T')[0],
              ped_situacao: params?.par_iniciapedido ?? 'P',
              ped_cliente: initialClienteId ?? 0,
              ped_industria: initialIndustriaId ?? 0,
              ped_vendedor: 0,
              ped_tabela: 'Padrão',
              ped_condpag: '',
              ped_comprador: '',
              ped_tipofrete: params?.par_tipofretepadrao ?? 'C',
              ped_cliind: '',
              ped_totbruto: 0,
              ped_totliq: 0,
              ped_totalipi: 0,
              ped_obs: params?.par_obs_padrao ?? '',
              ped_pri:0, ped_seg:0, ped_ter:0, ped_qua:0, ped_qui:0, ped_sex:0, ped_set:0, ped_oit:0, ped_nov:0,
              cli_nomred: initialClienteLabel ?? '', cli_nome: initialClienteLabel ?? '', for_nomered: '', ven_nome: '',
              items: []
            };
            setFullOrder(newOrder);
            setFormData({});
            setSaveError(null);
          } catch (err) {
            console.error('❌ PedidoModal next-number load:', err);
            setSaveError('Erro ao buscar número do pedido');
          } finally {
            setLoading(false);
          }
        };
        fetchNextNumber();
        setActiveSection('principal');
        setPedidoSalvo(false);
      }
      return;
    }
    setFullOrder(null);
    setActiveSection('principal');
    setOrderItems([]);
    setPedidoSalvo(true);
    setLoading(true);

    // Carrega params do usuário para formatação de quantidades
    if (authUser?.id) {
      api.get(`/parametros/${authUser.id}`)
        .then(r => {
          if (r.data.success) {
            const p = r.data.data;
            setUserParams({
              usaDecimais:    p.par_usadecimais  !== 'N',
              qtdDecimais:    parseInt(String(p.par_qtddecimais ?? 2)) || 2,
              itemDuplicado:  p.par_itemduplicado === 'S',
              qtdEnter:       parseInt(String(p.par_qtdenter    ?? 2)) || 2,
              fmtPesquisa:    p.par_fmtpesquisa ?? 'D',
              mostraCodigoOri: p.par_mostracodori === 'S',
            });
          }
        })
        .catch(() => {});
    }

    api.get(`/orders/${encodeURIComponent(order.ped_pedido)}`)
      .then(res => {
        const data = res.data;
        const loaded = { ...data, items: data.items || [] };
        setFullOrder(loaded);
        setFormData({});
        setSaveError(null);
      })
      .catch(err => {
        console.error('❌ PedidoModal load:', err);
        const status = err?.response?.status;
        if (status === 404) {
          toast.error(`Pedido ${order.ped_pedido} não encontrado. Pode ter sido excluído.`);
        } else {
          toast.error('Erro ao carregar o pedido. Tente novamente.');
        }
        onClose();
      })
      .finally(() => setLoading(false));

    // Carrega itens do pedido para a memtable
    api.get(`/order-items/${encodeURIComponent(order.ped_pedido)}`)
      .then(res => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const rows = res.data.data.map((it: any, idx: number) => ({
            ...it,
            ite_seq: idx + 1,
            tempId: `db-${idx + 1}-${it.ite_produto}`,
          }));
          setOrderItems(rows);
        }
      })
      .catch(() => {});
  }, [isOpen, order?.ped_pedido, mode]);

  // Load transportadoras once when modal opens (persists across section navigation)
  useEffect(() => {
    if (!isOpen || isView) return;
    api.get('/aux/transportadoras').then(r => setTransportadoras(r.data.data || [])).catch(() => {});
  }, [isOpen, isView]);

  // F-key shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const match = sections.find(s => s.shortcut === e.key);
      if (match) {
        e.preventDefault();
        if (match.key === 'itens') { requireSaved(() => setActiveSection('itens')); }
        else { setActiveSection(match.key); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isPersisted]);

  if (!isOpen) return null;

  const handleSave = async (closeAfter: boolean): Promise<boolean> => {
    if (!fullOrder) return false;
    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = {
        ped_data:        formData.ped_data        ?? fullOrder.ped_data,
        ped_situacao:    formData.ped_situacao     ?? fullOrder.ped_situacao,
        ped_cliente:     formData.ped_cliente      ?? fullOrder.ped_cliente,
        ped_transp:      formData.ped_transp       ?? fullOrder.ped_transp ?? 0,
        ped_vendedor:    formData.ped_vendedor     ?? fullOrder.ped_vendedor,
        ped_condpag:     formData.ped_condpag      ?? fullOrder.ped_condpag,
        ped_comprador:   formData.ped_comprador     ?? fullOrder.ped_comprador,
        ped_tipofrete:   formData.ped_tipofrete     ?? fullOrder.ped_tipofrete,
        ped_tabela:      formData.ped_tabela        ?? fullOrder.ped_tabela,
        ped_cliind:      formData.ped_cliind        ?? fullOrder.ped_cliind,
        ped_pedcli:      formData.ped_pedcli        ?? fullOrder.ped_pedcli  ?? '',
        ped_pedindustria:     formData.ped_pedindustria       ?? fullOrder.ped_pedindustria ?? '',
        ped_pri:  formData.ped_pri  ?? fullOrder.ped_pri,
        ped_seg:  formData.ped_seg  ?? fullOrder.ped_seg,
        ped_ter:  formData.ped_ter  ?? fullOrder.ped_ter,
        ped_qua:  formData.ped_qua  ?? fullOrder.ped_qua,
        ped_qui:  formData.ped_qui  ?? fullOrder.ped_qui,
        ped_sex:  formData.ped_sex  ?? fullOrder.ped_sex,
        ped_set:  formData.ped_set  ?? fullOrder.ped_set,
        ped_oit:  formData.ped_oit  ?? fullOrder.ped_oit,
        ped_nov:  formData.ped_nov  ?? fullOrder.ped_nov,
        ped_totbruto:  fullOrder.ped_totbruto,
        ped_totliq:    fullOrder.ped_totliq,
        ped_totalipi:  fullOrder.ped_totalipi,
        ped_obs:       formData.ped_obs       ?? fullOrder.ped_obs,
        ped_oc:        formData.ped_oc        ?? fullOrder.ped_oc,
        ped_industria: formData.ped_industria ?? fullOrder.ped_industria,
      };

      if (mode === 'new' && !pedidoSalvo) {
        // Primeira gravação — cria o pedido
        const res = await api.post('/orders', payload);
        if (res.data.success) {
          setPedidoSalvo(true);
          if (res.data.data) setFullOrder(prev => prev ? { ...prev, ...res.data.data } : prev);
          if (closeAfter) {
            onSaved?.();
          } else {
            onUpdated?.();
          }
          return true;
        } else {
          setSaveError(res.data.message || 'Erro ao criar pedido');
          return false;
        }
      } else {
        // Edição ou re-gravação de pedido novo já persistido — atualiza
        const pedPedido = order?.ped_pedido || fullOrder.ped_pedido;
        await api.put(`/orders/${encodeURIComponent(pedPedido)}`, payload);
        setPedidoSalvo(true);
        if (closeAfter) {
          onSaved?.();
        } else {
          setFullOrder(prev => prev ? { ...prev, ...formData } : prev);
          setFormData({});
          onUpdated?.();
        }
        return true;
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || 'Erro ao salvar pedido');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const renderContent = () => {
    if (loading || !fullOrder) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: G.textMuted }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Carregando pedido...</span>
        </div>
      );
    }

    switch (activeSection) {
      case 'principal':   return <PrincipalSection order={fullOrder} mode={mode} formData={formData} onChangeField={onChangeField} onPriceTableItemsChange={setPriceTableItems} orderItems={orderItems} transportadoras={transportadoras} onReaplicarPolitica={mode === 'edit' ? reaplicarPolitica : undefined} allowDuplicateOverride={allowDuplicateOverride} setAllowDuplicateOverride={setAllowDuplicateOverride} userParams={userParams} />;
      case 'itens':       return (
        <ItemsSection
          order={fullOrder as any}
          mode={mode}
          hasSuframa={!!fullOrder.cli_suframa}
          usaMenorPreco={!!fullOrder.for_usa_menor_preco}
          priceTableItems={priceTableItems}
          userParams={userParams ? {
            usaDecimais:   userParams.usaDecimais,
            qtdDecimais:   userParams.qtdDecimais,
            qtdEnter:      userParams.qtdEnter,
            fmtPesquisa:   userParams.fmtPesquisa,
            itemDuplicado: allowDuplicateOverride ?? userParams.itemDuplicado,
          } : null}
          orderItems={orderItems}
          setOrderItems={setOrderItems}
          onFinalizar={() => setActiveSection('conferencia')}
        />
      );
      case 'conferencia': return (
        <ConferenciaSection
          order={{
            ...fullOrder,
            ped_pri: formData.ped_pri ?? fullOrder.ped_pri,
            ped_seg: formData.ped_seg ?? fullOrder.ped_seg,
            ped_ter: formData.ped_ter ?? fullOrder.ped_ter,
            ped_qua: formData.ped_qua ?? fullOrder.ped_qua,
            ped_qui: formData.ped_qui ?? fullOrder.ped_qui,
            ped_sex: formData.ped_sex ?? fullOrder.ped_sex,
            ped_set: formData.ped_set ?? fullOrder.ped_set,
            ped_oit: formData.ped_oit ?? fullOrder.ped_oit,
            ped_nov: formData.ped_nov ?? fullOrder.ped_nov,
          } as any}
          orderItems={orderItems}
          setOrderItems={setOrderItems}
          priceTableItems={priceTableItems}
          isView={isView}
          hasSuframa={!!fullOrder.cli_suframa}
          userParams={userParams ? { usaDecimais: userParams.usaDecimais, qtdDecimais: userParams.qtdDecimais, mostraCodigoOri: userParams.mostraCodigoOri } : null}
          autoApplyGroupDisc={pendingGroupDisc}
          onGroupDiscApplied={() => setPendingGroupDisc(false)}
          onTotaisUpdated={(totbruto, totliq, totalipi) =>
            setFullOrder(prev => prev ? { ...prev, ped_totbruto: totbruto, ped_totliq: totliq, ped_totalipi: totalipi } : prev)
          }
        />
      );
      case 'xml':         return fullOrder ? (
        <XmlSection
          order={fullOrder as any} priceTableItems={priceTableItems}
          orderItems={orderItems} setOrderItems={setOrderItems}
          onBack={() => setActiveSection('principal')}
          onDone={() => requireSaved(() => { setPendingGroupDisc(true); setActiveSection('conferencia'); })}
        />
      ) : null;
      default:            return <PlaceholderSection label={sections.find(s => s.key === (activeSection as SectionKey))?.label || ''} />;
    }
  };

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
          style={{ position: 'absolute', inset: 0, background: 'rgba(28,37,46,0.45)', backdropFilter: 'blur(4px)' }}
        />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease }}
          style={{
            position: 'fixed', right: 0, top: 0, bottom: 0,
            width: '100%', background: G.bg,
            borderRadius: 0,
            boxShadow: 'none',
            border: 'none',
            display: 'flex', overflow: 'hidden',
          }}
        >
          {/* ── Left sidebar nav ── */}
          <div style={{
            width: 72, flexShrink: 0, background: G.card,
            borderRight: `1px solid ${G.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '16px 0', position: 'relative',
          }}>
            {/* Logo */}
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              style={{
                width: 40, height: 40, borderRadius: 14,
                background: `${G.mustard}22`, border: `1px solid ${G.mustard}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Package size={18} style={{ color: G.textSec }} />
            </motion.div>

            {/* Nav items */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', padding: '0 8px' }}>
              {sections.map((section, i) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;
                const isHov   = hoveredNav === section.key;
                const color   = section.color;
                return (
                  <motion.button
                    key={section.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.03 }}
                    onClick={() => section.key === 'itens' ? requireSaved(() => setActiveSection('itens')) : setActiveSection(section.key)}
                    onMouseEnter={() => setHoveredNav(section.key)}
                    onMouseLeave={() => setHoveredNav(null)}
                    style={{
                      position: 'relative', width: '100%', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 3, padding: '10px 4px', borderRadius: 12,
                      border: 'none', cursor: 'pointer',
                      background: isActive ? `${color}18` : isHov ? `${color}0D` : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute', left: 0, top: 8, bottom: 8,
                        width: 3, borderRadius: '0 3px 3px 0', background: color,
                      }} />
                    )}
                    <Icon size={15} style={{ color: isActive || isHov ? color : G.text, transition: 'color 0.15s' }} />
                    <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, color: isActive || isHov ? color : G.text, transition: 'color 0.15s' }}>
                      {section.label.length > 7 ? section.label.slice(0, 5) + '.' : section.label}
                    </span>
                    {/* Tooltip */}
                      {isHov && !isActive && (
                        <motion.div
                          initial={{ opacity: 0, x: 6, scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          style={{
                            position: 'absolute', left: '100%', marginLeft: 8,
                            padding: '4px 8px', borderRadius: 8,
                            background: G.text, color: '#fff',
                            fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                            pointerEvents: 'none', zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          }}
                        >
                          {section.label}
                          <span style={{ marginLeft: 6, opacity: 0.5, fontFamily: 'monospace' }}>
                            {section.shortcut}
                          </span>
                        </motion.div>
                      )}
                  </motion.button>
                );
              })}
            </nav>

            {/* Divisor */}
            <div style={{ width: 40, height: 1, background: G.border, margin: '4px 0' }} />

            {/* Import buttons */}
            {[
              { icon: Wand2,    label: 'Magic', color: '#EC4899', action: () => requireSaved(() => setShowMagic(true)), tooltip: 'Magic Load — IA', sub: 'PDF, Excel, Imagem' },
              { icon: Table2,   label: 'XLS',   color: '#10B981', action: () => requireSaved(() => setShowXms(true)),   tooltip: 'Importar via Planilha', sub: 'Copiar/colar colunas do Excel' },
              { icon: FileCode, label: 'XML',   color: '#8B5CF6', action: () => requireSaved(() => setActiveSection('xml')), tooltip: 'Importar Nota Fiscal', sub: 'Arquivo .xml de NF-e' },
              { icon: FileText, label: 'TXT',   color: '#F59E0B', action: () => requireSaved(() => setShowTxt(true)),   tooltip: 'Importar via Texto', sub: 'Formato PP2, Arca/KV ou livre' },
            ].map(({ icon: Icon, label, color, action, tooltip, sub }) => {
              const isHov = hoveredNav === (label as any);
              return (
                <motion.button
                  key={label}
                  onClick={action}
                  onMouseEnter={() => setHoveredNav(label as any)}
                  onMouseLeave={() => setHoveredNav(null)}
                  whileTap={{ scale: 0.92 }}
                  style={{
                    position: 'relative', width: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4, padding: '7px 4px',
                    border: 'none', cursor: 'pointer', background: 'transparent',
                  }}
                >
                  {/* Colored pill */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 11,
                    background: isHov ? color : `${color}CC`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isHov ? `0 4px 12px ${color}55` : `0 2px 6px ${color}33`,
                    transition: 'all 0.15s ease',
                    transform: isHov ? 'scale(1.08)' : 'scale(1)',
                  }}>
                    <Icon size={16} style={{ color: '#fff' }} />
                  </div>
                  <span style={{
                    fontSize: 7, fontWeight: 900, textTransform: 'uppercase',
                    letterSpacing: 0.8, color: isHov ? color : G.text,
                    transition: 'color 0.15s',
                  }}>
                    {label}
                  </span>

                  {/* Tooltip */}
                    {isHov && (
                      <motion.div
                        initial={{ opacity: 0, x: 6, scale: 0.92 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ duration: 0.12 }}
                        style={{
                          position: 'absolute', left: '100%', marginLeft: 10,
                          top: '50%', transform: 'translateY(-50%)',
                          background: G.text, borderRadius: 10,
                          padding: '8px 12px', pointerEvents: 'none', zIndex: 50,
                          boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
                          minWidth: 160,
                        }}
                      >
                        {/* Arrow */}
                        <div style={{
                          position: 'absolute', left: -5, top: '50%',
                          transform: 'translateY(-50%)',
                          width: 0, height: 0,
                          borderTop: '5px solid transparent',
                          borderBottom: '5px solid transparent',
                          borderRight: `5px solid ${G.text}`,
                        }} />
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap' }}>{tooltip}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>{sub}</p>
                      </motion.div>
                    )}
                </motion.button>
              );
            })}
          </div>

          {/* ── Main content ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{
              padding: '14px 24px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${G.border}`,
              background: G.card, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(255,210,0,0.04), transparent)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: G.text, margin: 0 }}>
                    {isView ? 'Visualizar Pedido' : mode === 'new' ? 'Novo Pedido' : 'Editar Pedido'}
                  </h2>
                  {order && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20,
                      background: `${G.mustard}22`, border: `1px solid ${G.mustard}55`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: G.mustard, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, fontWeight: 900, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {order.for_nomered}
                      </span>
                    </span>
                  )}
                  {loading && <Loader2 size={14} style={{ color: G.textMuted, animation: 'spin 1s linear infinite' }} />}
                </div>
                <p style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>
                  {fullOrder
                    ? `${fullOrder.cli_nomred} · ${fmtDate(fullOrder.ped_data)} · ${orderItems.length} itens`
                    : 'Carregando...'}
                </p>
              </div>
              <button
                onClick={onClose}
                title="Fechar pedido (Esc)"
                style={{
                  position: 'relative', width: 36, height: 36, borderRadius: 10,
                  background: G.cardHi, border: `1px solid ${G.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: G.textMuted,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <motion.div
                key={activeSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              >
                {renderContent()}
              </motion.div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 24px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderTop: `1px solid ${G.border}`, background: G.card,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                borderRadius: 10, background: G.cardHi, border: `1px solid ${G.border}`,
              }}>
                <Package size={13} style={{ color: G.textSec }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: G.textSec }}>
                  {orderItems.length} itens
                </span>
                <span style={{ color: G.border }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: G.text, fontFamily: 'monospace' }}>
                  {fmt(orderItems.reduce((s, it) => s + (it.ite_totbruto || 0), 0))}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeSection === 'principal' && saveError && (
                  <span style={{ fontSize: 11, color: G.danger, fontWeight: 700, maxWidth: 260 }}>
                    ⚠ {saveError}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (activeSection === 'principal') onClose();
                    else setActiveSection('principal');
                  }}
                  title={activeSection === 'principal' ? "Fechar sem salvar alterações" : "Voltar para F1 - Principal"}
                  style={{
                    padding: '8px 18px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${G.border}`,
                    color: G.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {activeSection === 'principal' ? 'Fechar' : 'Voltar'}
                </button>
                {activeSection === 'principal' && !isView && (
                  <>
                    <button
                      onClick={() => handleSave(false)}
                      disabled={isSaving}
                      title="Salvar alterações e continuar editando"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 18px', borderRadius: 10,
                        background: G.cardHi, border: `1px solid ${G.border}`,
                        color: G.text, fontSize: 12, fontWeight: 700,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                      Salvar
                    </button>
                    <button
                      onClick={() => handleSave(true)}
                      disabled={isSaving}
                      title="Salvar alterações e fechar o formulário"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 20px', borderRadius: 10,
                        background: isSaving ? G.border : G.text, border: 'none',
                        color: '#fff', fontSize: 12, fontWeight: 800,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        boxShadow: isSaving ? 'none' : '0 4px 12px rgba(40,55,74,0.25)',
                      }}
                    >
                      <Send size={13} />
                      Salvar e Fechar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    {showXms && fullOrder && (
      <XmsModal
        order={fullOrder as any} priceTableItems={priceTableItems}
        orderItems={orderItems} setOrderItems={setOrderItems}
        onClose={() => setShowXms(false)}
        onDone={() => requireSaved(() => { setPendingGroupDisc(true); setActiveSection('conferencia'); })}
        usaMenorPreco={!!fullOrder.for_usa_menor_preco}
      />
    )}
    {showTxt && fullOrder && (
      <TxtModal
        order={fullOrder as any} priceTableItems={priceTableItems}
        orderItems={orderItems} setOrderItems={setOrderItems}
        onClose={() => setShowTxt(false)}
        onDone={() => requireSaved(() => { setPendingGroupDisc(true); setActiveSection('conferencia'); })}
        usaMenorPreco={!!fullOrder.for_usa_menor_preco}
      />
    )}
    {showMagic && fullOrder && (
      <MagicModal
        order={fullOrder as any} priceTableItems={priceTableItems}
        orderItems={orderItems} setOrderItems={setOrderItems}
        onClose={() => setShowMagic(false)}
        onDone={() => requireSaved(() => { setPendingGroupDisc(true); setActiveSection('conferencia'); })}
        allowDuplicate={allowDuplicateOverride ?? (userParams?.itemDuplicado ?? true)}
        usaMenorPreco={!!fullOrder.for_usa_menor_preco}
      />
    )}
    </>
  );
}
