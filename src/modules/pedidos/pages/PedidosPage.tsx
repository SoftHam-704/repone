import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, Eye, Pencil, Copy, Printer, Share2,
  CreditCard, Ban, Trash2,
  Calendar, Hash, Package, Loader2,
  ChevronRight, Factory, LayoutGrid, RefreshCw,
  TrendingUp, ShoppingCart, Globe,
  MessageCircle, Mail, SendHorizontal,
  History, Sparkles, ClipboardCheck, HelpCircle, X, CheckCircle2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { AppSidebar } from '@/shared/components/layout/AppSidebar';
import { G } from '@/shared/components/layout/CadastroShell';
import { IrisAvatar } from '@/shared/components/iris/IrisAvatar';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { usePedidoActions } from '@/shared/stores/usePedidoActions';
import PedidoModal from './PedidoModal';
import ConsolidationDashboard from '../components/ConsolidationDashboard';
import PrintOrderDialog from './PrintOrderDialog';
import SendEmailDialog from './SendEmailDialog';
import { exportOrderToExcel } from '@/shared/utils/exportOrderToExcel';
import BillingDialog from './BillingDialog';
import PortalsDialog from './PortalsDialog';
import FaniaPortalModal from '../components/FaniaPortalModal';
import { LayoutList, PieChart, Users, ChevronDown } from 'lucide-react';
import IrisPanel from './IrisPanel';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Industry {
  for_codigo: number;
  for_nomered: string;
  total_pedidos?: number;
}

interface Order {
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
  ped_cliind: string;
  ped_totbruto: number;
  ped_totliq: number;
  ped_totalipi: number;
  ped_tipofrete: string;
  ped_pri: number; ped_seg: number; ped_ter: number;
  ped_qua: number; ped_qui: number;
  ped_datdigit?: string;
  cli_nomred: string;
  cli_nome: string;
  cli_cnpj?: string;
  cli_cidade?: string;
  cli_uf?: string;
  for_nomered: string;
  ven_nome: string;
  ped_oc?: string | null;
  ped_consolidado_id?: number | null;
  ped_total_quant?: number;
  ped_total_items?: number;
  ped_enviado?: boolean;
}

interface Stats {
  revenue: number;
  quantity: number;
  pdvs: number;
  averageTicket: number;
  orders: number;
  quotes: number;
}

// ─── Confirm Clone Dialog ─────────────────────────────────────────────────────
function ConfirmCloneDialog({
  order,
  onConfirm,
  onCancel,
  cloning,
}: {
  order: { ped_pedido: string; cli_nomred?: string; cli_nome: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
  cloning: boolean;
}) {
  return (
      order ? (
        <motion.div
          key="clone-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(40,55,74,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={onCancel}
        >
          <motion.div
            key="clone-dialog"
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#F2ECE2', borderRadius: 20,
              border: '1px solid #D3C7AD',
              boxShadow: '0 24px 64px rgba(40,55,74,0.22)',
              width: 420, padding: '28px 28px 24px',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: '#D9760018', border: '1px solid #D9760033',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}>
              <Copy size={22} style={{ color: '#D97600' }} />
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#28374A', margin: '0 0 6px', letterSpacing: -0.3 }}>
              Duplicar Pedido
            </h2>
            <p style={{ fontSize: 13, color: '#5E7282', margin: '0 0 8px', lineHeight: 1.6 }}>
              Será criada uma cópia fiel do pedido
              {' '}<span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#28374A' }}>#{order.ped_pedido}</span>
              {' '}de <strong>{order.cli_nomred || order.cli_nome}</strong>.
            </p>
            <p style={{ fontSize: 12, color: '#5E7282', margin: '0 0 24px', lineHeight: 1.5 }}>
              O novo pedido terá número sequencial, data de hoje e situação <strong>PEDIDO</strong>.
              Todos os itens serão copiados.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                disabled={cloning}
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  border: '1px solid #D3C7AD', background: 'transparent',
                  color: '#3D5265', fontSize: 13, fontWeight: 700,
                  cursor: cloning ? 'not-allowed' : 'pointer', opacity: cloning ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={cloning}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 22px', borderRadius: 10, border: 'none',
                  background: cloning ? '#D3C7AD' : '#D97600',
                  color: '#fff', fontSize: 13, fontWeight: 800,
                  cursor: cloning ? 'not-allowed' : 'pointer',
                  minWidth: 130, justifyContent: 'center',
                }}
              >
                {cloning
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Duplicando...</>
                  : <><Copy size={14} /> Confirmar Cópia</>
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const [y, m, day] = d.substring(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

function statusLabel(s: string) {
  switch (s) {
    case 'P': return 'PEDIDO';
    case 'C': return 'COTAÇÃO';
    case 'A': case 'CC': return 'COT. CONFIRMADA';
    case 'F': return 'FATURADO';
    case 'Q': return 'FILA';
    case 'G': return 'GARANTIA';
    case 'B': return 'BONIFICAÇÃO';
    case 'D': return 'BONIF. PENDENTE';
    case 'N': return 'NOTIFICAÇÃO';
    case 'L': return 'FATURADO';
    case 'E': case 'X': return 'EXCLUÍDO';
    case 'J': return 'WHATSAPP';
    default: return s;
  }
}

function statusColor(s: string): { bg: string; color: string; border: string } {
  switch (s) {
    case 'P':  return { bg: '#28374A18', color: G.text,      border: '#28374A33' };
    case 'C':  return { bg: '#D9760018', color: '#D97600',   border: '#D9760033' };
    case 'A':
    case 'CC': return { bg: '#0891B218', color: '#0891B2',   border: '#0891B233' };
    case 'F':
    case 'L':  return { bg: '#16A34A18', color: G.success,   border: '#16A34A33' };
    case 'Q':  return { bg: '#D9760018', color: '#D97600',   border: '#D9760033' };
    case 'G':  return { bg: '#7C3AED18', color: '#7C3AED',   border: '#7C3AED33' };
    case 'B':  return { bg: '#E7661D18', color: '#E7661D',   border: '#E7661D33' };
    case 'D':  return { bg: '#CA8A0418', color: '#CA8A04',   border: '#CA8A0433' };
    case 'N':  return { bg: '#FFC10718', color: '#B45309',   border: '#FFC10733' };
    case 'E': case 'X': return { bg: '#8B451318', color: '#8B4513', border: '#8B451333' };
    case 'J':           return { bg: '#DCFCE7',   color: '#15803D', border: '#86EFAC' };
    default:   return { bg: '#C0392B18', color: G.danger,    border: '#C0392B33' };
  }
}

function leftBorder(s: string): string {
  switch (s) {
    case 'P':  return G.text;
    case 'C':  return '#D97600';
    case 'F':  return G.success;
    case 'G': case 'B': return '#7C3AED';
    case 'D':           return '#CA8A04';
    case 'J':           return '#15803D';
    default:   return G.danger;
  }
}

// ─── Industry Sidebar ─────────────────────────────────────────────────────────
function IndustrySidebar({
  industries, selected, onSelect,
}: {
  industries: Industry[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = industries.reduce((s, i) => s + (i.total_pedidos || 0), 0);

  if (collapsed) {
    return (
      <aside style={{
        width: 52, background: G.card, borderRight: `1px solid ${G.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0', gap: 4, flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Expandir"
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: G.cardHi, border: `1px solid ${G.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginBottom: 8, color: G.textSec,
          }}
        >
          <Factory size={15} />
        </button>
        {industries.map(ind => (
          <button
            key={ind.for_codigo}
            title={ind.for_nomered}
            onClick={() => onSelect(ind.for_codigo)}
            style={{
              width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
              background: selected === ind.for_codigo ? G.mustard : 'transparent',
              border: selected === ind.for_codigo ? `1px solid ${G.border}` : '1px solid transparent',
              color: selected === ind.for_codigo ? G.text : G.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900,
            }}
          >
            {ind.for_nomered.substring(0, 2).toUpperCase()}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside style={{
      width: 200, background: G.card, borderRight: `1px solid ${G.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '14px 14px 10px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${G.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Factory size={13} style={{ color: G.textSec }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>
            Indústrias
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            width: 20, height: 20, borderRadius: 6, border: 'none',
            background: 'transparent', cursor: 'pointer', color: G.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {/* Todas */}
        <button
          onClick={() => onSelect(null)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: selected === null ? G.mustard : 'transparent',
            color: selected === null ? G.text : G.textMuted,
            fontSize: 12, fontWeight: selected === null ? 800 : 600, marginBottom: 2,
          }}
        >
          <span>Todas</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{total}</span>
        </button>

        {industries.map(ind => (
          <button
            key={ind.for_codigo}
            onClick={() => onSelect(ind.for_codigo)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: selected === ind.for_codigo ? G.cardHi : 'transparent',
              color: selected === ind.for_codigo ? G.text : G.textMuted,
              fontSize: 12, fontWeight: selected === ind.for_codigo ? 800 : 500,
              borderLeft: selected === ind.for_codigo ? `3px solid ${G.mustard}` : '3px solid transparent',
              marginBottom: 2, transition: 'all 0.15s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
              {ind.for_nomered}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', flexShrink: 0, marginLeft: 4 }}>
              {ind.total_pedidos || 0}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

// Formata CNPJ (14 dígitos) ou devolve o valor cru.
function fmtCnpj(v?: string): string {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return v;
}

// ─── Combobox de cliente (filtro) ─────────────────────────────────────────────
// Busca no /clients?search= com debounce; passa o cli_codigo escolhido pro filtro.
function ClientFilterCombo({ value, label, onChange }: {
  value: number | null; label: string;
  onChange: (id: number | null, nome: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ cli_codigo: number; cli_nomred?: string; cli_nome?: string; cli_cnpj?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = q.trim()
          ? `/clients?search=${encodeURIComponent(q.trim())}&limit=50`
          : '/clients?limit=50';
        const r = await api.get(url);
        setResults(r.data.data || r.data.clientes || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div
        onClick={() => { setOpen(o => !o); if (!value) setQ(''); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
          background: value ? '#28374A12' : G.cardHi,
          border: `1px solid ${value ? `${G.text}55` : G.border}`,
          cursor: 'pointer', minWidth: 130, maxWidth: 200,
        }}
      >
        <Users size={12} style={{ color: value ? G.text : G.textMuted, flexShrink: 0 }} />
        {value ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: G.textMuted }}>Cliente</span>
        )}
        {value ? (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null, ''); setOpen(false); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: G.textMuted, fontSize: 14, lineHeight: 1, display: 'flex' }}
          >×</button>
        ) : (
          <ChevronDown size={12} style={{ marginLeft: 'auto', color: G.textMuted, flexShrink: 0 }} />
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60, width: 300,
          background: '#fff', border: `1px solid ${G.border}`, borderRadius: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,0.16)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${G.border}` }}>
            <Search size={12} style={{ color: G.textMuted }} />
            <input
              autoFocus placeholder="Digite o nome do cliente…"
              value={q} onChange={e => setQ(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 600, color: G.text, width: '100%' }}
            />
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {loading && <div style={{ padding: '10px 12px', fontSize: 11, color: G.textMuted }}>Buscando…</div>}
            {!loading && results.length === 0 && <div style={{ padding: '10px 12px', fontSize: 11, color: G.textMuted }}>Nenhum cliente encontrado.</div>}
            {results.map(c => (
              <button
                key={c.cli_codigo}
                onClick={() => { onChange(c.cli_codigo, c.cli_nomred || c.cli_nome || `#${c.cli_codigo}`); setOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${G.border}`, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cli_nomred || c.cli_nome}</div>
                {c.cli_cnpj && <div style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: G.textMuted, marginTop: 1 }}>{fmtCnpj(c.cli_cnpj)}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Order Card (list item) ───────────────────────────────────────────────────
const OrderCard = memo(function OrderCard({
  order, index, isSelected, onSelect, onContextMenu, showIndustry,
}: {
  order: Order; index: number; isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent, order: Order) => void;
  showIndustry?: boolean;
}) {
  const sc = statusColor(order.ped_situacao);
  const lb = leftBorder(order.ped_situacao);

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.3) }}
      onClick={onSelect}
      onContextMenu={e => onContextMenu(e, order)}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 16px',
        borderBottom: `1px solid ${G.border}`,
        background: isSelected ? G.cardHi : 'transparent',
        cursor: 'pointer', position: 'relative',
        borderTop: 'none', borderRight: 'none',
        borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: G.border,
        borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: isSelected ? G.mustard : lb,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {order.cli_nomred || order.cli_nome}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, fontFamily: 'monospace', flexShrink: 0 }}>
              #{order.ped_cliente}
            </span>
          </div>
          {order.cli_cnpj && (
            <div style={{
              fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
              color: G.textSec, letterSpacing: 0.3, marginBottom: 1,
            }}>
              {fmtCnpj(order.cli_cnpj)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: G.textSec, fontFamily: 'monospace', letterSpacing: -0.5 }}>
              #{order.ped_pedido}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: G.border, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: G.textMuted }}>
              {fmtDate(order.ped_data)}
            </span>
            {showIndustry && order.for_nomered && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: G.border, display: 'inline-block' }} />
                <span style={{
                  fontSize: 9, fontWeight: 700, color: G.textMuted, opacity: 0.65,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90,
                }}>
                  {order.for_nomered}
                </span>
              </>
            )}
          </div>
          {order.ped_oc && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase',
                color: G.muted, lineHeight: 1,
              }}>OC</span>
              <span style={{
                fontSize: 13, fontWeight: 900, fontFamily: 'monospace',
                color: G.text, letterSpacing: 0.5, lineHeight: 1,
              }}>
                {order.ped_oc}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {order.ped_enviado === true && (
              <span style={{
                fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 20,
                background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7',
                letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                ✓ Enviado
              </span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 10px', borderRadius: 20,
              minWidth: 80, textAlign: 'center', whiteSpace: 'nowrap',
              background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
              letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              {statusLabel(order.ped_situacao)}
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: G.text, fontFamily: 'monospace' }}>
            {fmt(order.ped_totliq)}
          </span>
        </div>
      </div>
    </motion.button>
  );
});

// ─── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target: number, trigger: number | string | undefined): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!target) { setDisplay(0); return; }
    const start = 0;
    const duration = 900;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setDisplay(start + (target - start) * ease);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, trigger]); // retrigger on order change or value change

  return display;
}

// ─── Order Detail Panel ───────────────────────────────────────────────────────
function OrderDetailPanel({
  order, orders, dataInicio, dataFim,
  onEdit, onView, onDuplicate, onDelete, onPrint, onShare, onBilling, onPortals, onIris,
}: {
  order: Order | null;
  orders: Order[];
  dataInicio: string;
  dataFim: string;
  onEdit: (o: Order) => void;
  onView: (o: Order) => void;
  onDuplicate: (o: Order) => void;
  onDelete: (o: Order) => void;
  onPrint: (o: Order) => void;
  onShare: (o: Order, channel: 'whatsapp' | 'email' | 'link') => void;
  onBilling: (o: Order) => void;
  onPortals: (o: Order) => void;
  onIris: (o: Order) => void;
}) {
  if (!order) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: G.textMuted, gap: 12,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: `2px dashed ${G.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LayoutGrid size={28} style={{ opacity: 0.3 }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 500 }}>Selecione um pedido para visualizar</p>
      </div>
    );
  }

  const [shareOpen, setShareOpen] = useState(false);
  const shareRef                  = useRef<HTMLDivElement>(null);

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  const sc = statusColor(order.ped_situacao);
  const animatedTotal = useCountUp(order.ped_totliq, order.ped_numero);

  // ── Curva ABC do cliente DENTRO da indústria (Pareto 80/95) no período do painel ──
  const [abc, setAbc] = useState<{ curva: string; total: number; total_geral: number; sem_compras: boolean } | null>(null);
  useEffect(() => {
    setAbc(null);
    if (!order.ped_cliente || !order.ped_industria || !dataInicio || !dataFim) return;
    api.get(`/orders/cliente-curva-abc?cli=${order.ped_cliente}&ind=${order.ped_industria}&inicio=${dataInicio}&fim=${dataFim}`)
      .then(r => setAbc(r.data?.data || null))
      .catch(() => setAbc(null));
  }, [order.ped_cliente, order.ped_industria, dataInicio, dataFim]);

  const abcColor =
    abc?.curva === 'A' ? '#16A34A' :
    abc?.curva === 'B' ? '#D97600' :
    abc?.curva === 'C' ? G.textMuted :
    G.border;

  // ── Últimos 12 meses corridos (mês atual pra trás) — fat + qtd dual axis ──
  const [histData, setHistData] = useState<{ serie: any[] } | null>(null);
  useEffect(() => {
    setHistData(null);
    if (!order.ped_cliente || !order.ped_industria) return;
    api.get(`/orders/cliente-historico-mensal?cli=${order.ped_cliente}&ind=${order.ped_industria}`)
      .then(r => setHistData(r.data?.data || null))
      .catch(() => setHistData(null));
  }, [order.ped_cliente, order.ped_industria]);

  const tlData = histData?.serie ?? [];
  const fmtFat = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toFixed(0)}`;
  const fmtQtd = (v: number) => v.toLocaleString('pt-BR');


  const actions: { icon: any; label: string; bg: string; color: string; border: string; onClick: () => void }[] = [
    { icon: Eye,      label: 'Visualizar',  bg: '#0891B218', color: '#0891B2', border: '#0891B233', onClick: () => onView(order) },
    { icon: Pencil,   label: 'Editar',      bg: '#16A34A18', color: '#16A34A', border: '#16A34A33', onClick: () => onEdit(order) },
    { icon: Copy,     label: 'Duplicar',    bg: '#D9760018', color: '#D97600', border: '#D9760033', onClick: () => onDuplicate(order) },
    { icon: Ban,       label: 'Excluir',     bg: '#C0392B18', color: G.danger, border: '#C0392B33', onClick: () => onDelete(order) },
    { icon: Printer,  label: 'Imprimir',    bg: '#7C3AED18', color: '#7C3AED', border: '#7C3AED33', onClick: () => onPrint(order) },
    { icon: Share2,   label: 'Compartilhar',bg: '#0891B218', color: '#0891B2', border: '#0891B233', onClick: () => setShareOpen(o => !o) },
    { icon: CreditCard,label:'Faturar',     bg: '#28374A18', color: G.text,    border: '#28374A33', onClick: () => onBilling(order) },
    { icon: Globe,     label:'Portais',     bg: '#0F766E18', color: '#0F766E', border: '#0F766E33', onClick: () => onPortals(order) },
  ];


  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: G.bg }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                padding: '3px 9px', borderRadius: 20,
                background: G.cardHi, color: G.textSec, border: `1px solid ${G.border}`,
              }}>
                #{order.ped_pedido}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                minWidth: 80, textAlign: 'center', whiteSpace: 'nowrap',
                background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {statusLabel(order.ped_situacao)}
              </span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: G.text, letterSpacing: -0.5, margin: 0 }}>
              {order.cli_nomred || order.cli_nome}
            </h2>
            <p style={{ fontSize: 12, color: G.textMuted, marginTop: 3 }}>
              {order.cli_nome} &nbsp;·&nbsp; {order.ped_tabela || 'Padrão'}
            </p>
          </div>
        </div>

        {/* ── Banner WhatsApp draft ── */}
        {order.ped_situacao === 'J' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 12,
            padding: '12px 16px', marginBottom: 16,
          }}>
            <MessageCircle size={18} style={{ color: '#15803D', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#15803D' }}>
                Rascunho recebido via WhatsApp
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
                Revise os itens (os marcados em amarelo não foram identificados), ajuste indústria e vendedor, e clique em Editar para confirmar.
              </p>
            </div>
          </div>
        )}

        {/* ── Bento grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

          {/* Hero: valor total com sparkline */}
          <div style={{ ...bentoCard, gridColumn: '1 / 4', position: 'relative', overflow: 'hidden' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Valor Total do Pedido
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <motion.span
                  key={order.ped_pedido}
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  style={{ fontSize: 38, fontWeight: 900, color: G.text, letterSpacing: -1.5, display: 'block', lineHeight: 1.1 }}
                >
                  {fmt(animatedTotal)}
                </motion.span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  {/* Contagem real de itens */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: G.cardHi, color: G.text, border: `1px solid ${G.border}`,
                  }}>
                    <Package size={11} />
                    {Number(order.ped_total_items ?? 0)} {Number(order.ped_total_items) === 1 ? 'item' : 'itens'}
                  </span>
                  {/* Somatória de quantidades */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: G.cardHi, color: G.text, border: `1px solid ${G.border}`,
                  }}>
                    <ShoppingCart size={11} />
                    {Number(order.ped_total_quant ?? 0).toLocaleString('pt-BR')} un
                  </span>
                </div>
              </div>

              {/* Últimos 12 meses corridos — cliente × indústria — fat (R$) + qtd (un) dual axis */}
              <div style={{ flex: 1, minWidth: 0, maxWidth: 520 }}>
                <div style={{ width: '100%', height: 180 }}>
                  {histData === null
                    ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: G.textMuted }}>carregando…</div>
                    : tlData.length === 0 || tlData.every(d => d.fat_atual === 0 && d.qtd_atual === 0)
                      ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: G.textMuted }}>sem histórico nos últimos 12 meses</div>
                      : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tlData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                          <defs>
                            <linearGradient id="histFat" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="#0F766E" stopOpacity={0.32} />
                              <stop offset="100%" stopColor="#0F766E" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="histQtd" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="#7C3AED" stopOpacity={0.18} />
                              <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(40,55,74,0.05)" vertical={false} />
                          <XAxis dataKey="mes" tick={{ fontSize: 9, fill: G.textMuted }} axisLine={false} tickLine={false} interval={0} />
                          <YAxis yAxisId="fat" orientation="left"  tick={{ fontSize: 9, fill: '#0F766E' }} axisLine={false} tickLine={false} tickFormatter={fmtFat} width={48} />
                          <YAxis yAxisId="qtd" orientation="right" tick={{ fontSize: 9, fill: '#7C3AED' }} axisLine={false} tickLine={false} tickFormatter={fmtQtd} width={40} />
                          <RTooltip
                            contentStyle={{
                              background:   '#F8F4EE',
                              border:       '1px solid #D3C7AD',
                              borderRadius: 10,
                              fontSize:     11,
                              color:        '#28374A',
                              boxShadow:    '0 4px 12px rgba(40,55,74,.12)',
                              padding:      '8px 12px',
                            }}
                            labelStyle={{ color: '#28374A', fontWeight: 800, marginBottom: 4 }}
                            itemStyle={{ padding: '1px 0' }}
                            formatter={(v: any, name: any) => {
                              if (name === 'Faturamento') return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                              return `${Number(v).toLocaleString('pt-BR')} un`;
                            }}
                          />
                          <Legend verticalAlign="top" align="right" iconType="circle"
                            wrapperStyle={{ paddingBottom: 2, fontSize: 9, fontWeight: 700, color: G.textSec }} />
                          <Area yAxisId="fat" type="monotone" dataKey="fat_atual" stroke="#0F766E" strokeWidth={2.4}
                                fill="url(#histFat)" name="Faturamento" dot={false} activeDot={{ r: 3, fill: '#0F766E', strokeWidth: 0 }} />
                          <Area yAxisId="qtd" type="monotone" dataKey="qtd_atual" stroke="#7C3AED" strokeWidth={1.6}
                                strokeDasharray="5 4" fill="url(#histQtd)" name="Quantidade" dot={false} activeDot={{ r: 3, fill: '#7C3AED', strokeWidth: 0 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Curva ABC do cliente na indústria (Pareto, período do painel) */}
          {(() => {
            // Cor escura (sólida) e clara (10% opaca) derivadas da curva
            const colorDark  = abcColor;
            const colorLight = abc?.curva === 'A' ? 'rgba(22,163,74,0.10)'
                             : abc?.curva === 'B' ? 'rgba(217,118,0,0.10)'
                             : abc?.curva === 'C' ? 'rgba(94,114,130,0.10)'
                             : 'transparent';
            const pctTotal = (abc && !abc.sem_compras && abc.total_geral > 0)
              ? (abc.total / abc.total_geral * 100)
              : 0;
            const gradId = `abcGrad-${abc?.curva ?? 'none'}`;
            return (
              <div
                style={{ ...bentoCard, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 12px' }}
                title={
                  'Mostra a importância deste cliente dentro da indústria, pelo princípio de Pareto.\n\n' +
                  'A = clientes que juntos somam até 80% do faturamento da indústria (os mais valiosos).\n' +
                  'B = clientes entre 80% e 95% do acumulado.\n' +
                  'C = últimos 5% (cauda).\n\n' +
                  `O valor é o quanto o cliente comprou desta indústria no período ${dataInicio} a ${dataFim} (filtro do painel).`
                }
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Classificação
                </span>

                {/* Medalhão com letra + anel duplo + gradiente */}
                <motion.div
                  key={abc?.curva ?? 'loading'}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  style={{ position: 'relative', width: 96, height: 96 }}
                >
                  <svg width="96" height="96" viewBox="0 0 96 96" style={{ display: 'block' }}>
                    <defs>
                      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%"   stopColor={colorDark} stopOpacity="0.95" />
                        <stop offset="100%" stopColor={colorDark} stopOpacity="0.55" />
                      </linearGradient>
                      <filter id={`shadow-${abc?.curva ?? 'none'}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
                        <feOffset dx="0" dy="1" result="offsetblur" />
                        <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Background interno tom claro */}
                    <circle cx="48" cy="48" r="40" fill={colorLight} />
                    {/* Anel externo tracejado fino — efeito moldura */}
                    <circle cx="48" cy="48" r="44" fill="none" stroke={colorDark} strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 3" />
                    {/* Anel principal espesso com gradiente */}
                    <circle cx="48" cy="48" r="40" fill="none" stroke={`url(#${gradId})`} strokeWidth="4.5"
                      strokeOpacity={abc?.sem_compras ? 0.25 : 1} />
                  </svg>
                  {/* Letra grande com sombra */}
                  <span
                    style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 50, fontWeight: 900, color: colorDark, lineHeight: 1,
                      letterSpacing: -2.5, fontFamily: 'system-ui',
                      textShadow: abc?.sem_compras ? 'none' : `0 2px 4px ${colorLight.replace('0.10', '0.45')}`,
                    }}
                  >
                    {abc === null ? '…' : abc.sem_compras ? '—' : abc.curva}
                  </span>
                </motion.div>

                {/* % do cliente no total da indústria — informação nova */}
                {abc && !abc.sem_compras && pctTotal > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: colorDark, letterSpacing: 0.3,
                    padding: '2px 8px', borderRadius: 10, background: colorLight,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {pctTotal < 0.1 ? '<0,1' : pctTotal.toFixed(pctTotal < 10 ? 1 : 0)}% da indústria
                  </span>
                )}

                <span style={{ fontSize: 14, fontWeight: 900, color: G.text, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>
                  {abc === null
                    ? ''
                    : abc.sem_compras
                      ? 'sem compras'
                      : abc.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            );
          })()}

          {/* 4 info cards — Data · Canal · OC · IRIS */}
          <div style={bentoCard}>
            <InfoRow icon={Calendar} label="Data" value={fmtDate(order.ped_data)} />
          </div>
          <div style={bentoCard}>
            <InfoRow icon={Globe} label="Canal" value={order.ped_tabela || 'Padrão'} />
          </div>
          <div style={bentoCard}>
            <InfoRow icon={Hash} label="OC do Cliente" value={order.ped_oc || '—'} mono />
          </div>

          {/* Card IRIS — assistente comercial com IA */}
          <button
            onClick={() => onIris(order)}
            title={
              'IRIS é sua assistente comercial com inteligência artificial.\n\n' +
              'Analisa este pedido + o histórico do cliente e te entrega:\n' +
              '• Oportunidades de cross-sell (indústrias que faltam no cliente)\n' +
              '• Sinais de risco do cliente (silêncio, queda de frequência)\n' +
              '• Sugestões concretas de ação para fechar a venda\n' +
              '• Narrativa em linguagem de gerente experiente\n\n' +
              'Clique para abrir a análise completa deste pedido.'
            }
            style={{
              ...bentoCard,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: '#28374A',
              border: '1px solid #28374A',
              cursor: 'pointer',
              padding: 12,
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(40,55,74,.45)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: '#E8E1D4', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.7 }}>
              IRIS
            </span>
            <IrisAvatar size={32} animated={false} />
            <span style={{ fontSize: 13, fontWeight: 900, color: '#FFD200', letterSpacing: 0.5 }}>
              INSIGHTS
            </span>
          </button>

          {/* Action buttons — full width, coloridos */}
          <div style={{ ...bentoCard, gridColumn: '1 / -1', padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {actions.map(({ icon: Icon, label, bg, color, border, onClick }) => {
                const isShare = label === 'Compartilhar';
                return (
                  <div key={label} ref={isShare ? shareRef : undefined} style={{ position: 'relative', minWidth: 0 }}>
                    <button
                      onClick={onClick}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 12px', borderRadius: 10,
                        background: isShare && shareOpen ? bg.replace('18', '35') : bg,
                        border: `1px solid ${isShare && shareOpen ? border.replace('33', '66') : border}`,
                        color, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Icon size={13} />
                      {label}
                    </button>

                    {/* Popover de Compartilhar */}
                    {isShare && shareOpen && (
                      <div style={{
                        position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#fff', borderRadius: 14, padding: 8,
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 8px 32px rgba(40,55,74,0.18)',
                        minWidth: 200, zIndex: 999,
                      }}>
                        {/* Seta */}
                        <div style={{
                          position: 'absolute', bottom: -6, left: '50%',
                          width: 12, height: 12, background: '#fff',
                          border: '1px solid #E2E8F0', borderTop: 'none', borderLeft: 'none',
                          transform: 'translateX(-50%) rotate(45deg)',
                        }} />

                        {/* WhatsApp */}
                        <button
                          onClick={() => { setShareOpen(false); onShare(order, 'whatsapp'); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 8, border: 'none',
                            background: 'transparent', cursor: 'pointer', textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageCircle size={14} style={{ color: '#16A34A' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#15803D' }}>WhatsApp</div>
                            <div style={{ fontSize: 10, color: '#86EFAC' }}>PDF + mensagem</div>
                          </div>
                        </button>

                        {/* E-mail */}
                        <button
                          onClick={() => { setShareOpen(false); onShare(order, 'email'); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 8, border: 'none',
                            background: 'transparent', cursor: 'pointer', textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail size={14} style={{ color: '#2563EB' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#1D4ED8' }}>E-mail</div>
                            <div style={{ fontSize: 10, color: '#93C5FD' }}>PDF + Excel opcional</div>
                          </div>
                        </button>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Últimos pedidos da indústria */}
          {(() => {
            const recentOrders = [...orders]
              .filter(o => o.ped_cliente === order.ped_cliente)
              .sort((a, b) => new Date(b.ped_data).getTime() - new Date(a.ped_data).getTime())
              .slice(0, 15);
            return (
              <div style={{ ...bentoCard, gridColumn: '1 / 4' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 12 }}>
                  Últimos pedidos — {order.cli_nomred || order.cli_nome}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 80px 60px', gap: '4px 8px', alignItems: 'center' }}>
                  {/* Header */}
                  {['Pedido', 'Cliente', 'Data', 'Total', 'Status'].map(h => (
                    <span key={h} style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, paddingBottom: 4, borderBottom: `1px solid ${G.border}`, textAlign: h === 'Total' ? 'right' : 'left' }}>
                      {h}
                    </span>
                  ))}
                  {/* Rows */}
                  {recentOrders.map(o => {
                    const sc = statusColor(o.ped_situacao);
                    const isActive = o.ped_numero === order.ped_numero;
                    return (
                      <React.Fragment key={o.ped_numero}>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: isActive ? sc.color : G.text, opacity: isActive ? 1 : 0.75 }}>
                          {o.ped_pedido}
                        </span>
                        <span style={{ fontSize: 11, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.cli_nomred || o.cli_nome}
                        </span>
                        <span style={{ fontSize: 11, color: G.textMuted }}>
                          {fmtDate(o.ped_data)}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: G.text, fontFamily: 'monospace', textAlign: 'right' }}>
                          {(o.ped_totliq || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: sc.bg, color: sc.color, textAlign: 'center', whiteSpace: 'nowrap',
                        }}>
                          {statusLabel(o.ped_situacao)}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Dados do Pedido */}
          <div style={bentoCard}>
            <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 14 }}>
              Dados do Pedido
            </span>
            {/* Desconto aplicado em destaque — REP confere no 1º clique, sem editar o pedido */}
            {order.ped_totbruto > 0 && (order.ped_totbruto - order.ped_totliq) > 0.01 && (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: `${G.mustard}1A`, border: `1px solid ${G.mustard}55` }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.8 }}>Desconto aplicado</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: G.text }}>
                  {((1 - order.ped_totliq / order.ped_totbruto) * 100).toFixed(2).replace('.', ',')}%
                  <span style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, marginLeft: 6 }}>{fmt(order.ped_totbruto - order.ped_totliq)}</span>
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Cond. Pagamento', value: order.ped_condpag || '—' },
                { label: 'Frete',           value: order.ped_tipofrete === 'C' ? 'CIF — Ind. paga' : 'FOB — Cliente paga' },
                { label: 'Comprador',       value: order.ped_comprador || '—' },
                { label: 'Tabela de Preço', value: order.ped_tabela || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ borderBottom: `1px solid ${G.border}40`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
const bentoCard: React.CSSProperties = {
  background: G.card, borderRadius: 14, border: `1px solid ${G.border}`, padding: '16px 18px',
};

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: G.cardHi,
        border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={13} style={{ color: G.textMuted }} />
      </div>
      <div>
        <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block' }}>
          {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: G.text, fontFamily: mono ? 'monospace' : 'inherit' }}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── Modal de Ajuda — Pedidos ─────────────────────────────────────────────────

function PedidosHelpModal({ onClose }: { onClose: () => void }) {
  const sec: React.CSSProperties = { marginBottom: 26 };
  const h2: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: G.text, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7, borderBottom: `2px solid ${G.mustard}`, paddingBottom: 8 };
  const p: React.CSSProperties = { fontSize: 12, color: G.textMuted, lineHeight: 1.8, marginBottom: 8 };
  const tip = (accent = G.mustard): React.CSSProperties => ({ background: `${accent}0D`, border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: G.text, lineHeight: 1.75, marginBottom: 8 });
  const stp = (): React.CSSProperties => ({ width: 22, height: 22, borderRadius: '50%', background: G.mustard, color: G.card, fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

  const statuses = [
    { code: 'C', label: 'Cotação Aberta', color: '#F59E0B', desc: 'Pedido em elaboração pelo rep. Não foi enviado ainda.' },
    { code: 'A', label: 'Cotação Enviada', color: '#3B82F6', desc: 'Aguardando aprovação ou confirmação do cliente.' },
    { code: 'CC', label: 'Cotação Confirmada', color: '#8B5CF6', desc: 'Cliente aprovou — pronto para converter em pedido.' },
    { code: 'P', label: 'Pedido', color: '#10B981', desc: 'Pedido confirmado e ativo. Conta em todas as estatísticas.' },
    { code: 'Q', label: 'Aguard. Consolidação', color: '#0891B2', desc: 'Pedido pronto para ser consolidado e enviado à indústria.' },
    { code: 'F', label: 'Faturado', color: '#059669', desc: 'Pedido foi faturado pela indústria. Histórico permanente.' },
    { code: 'D', label: 'Bonificação Pendente', color: '#CA8A04', desc: 'Bonificação aguardando aprovação. Não conta em vendas/BI até virar Bonificação (B).' },
    { code: 'E', label: 'Excluído', color: '#94A3B8', desc: 'Cancelado. Não aparece em vendas nem estatísticas.' },
  ];

  const acoes = [
    { icone: Eye, label: 'Visualizar', desc: 'Abre o pedido em modo somente leitura para conferência.' },
    { icone: Pencil, label: 'Editar', desc: 'Abre o pedido para alterações. Disponível enquanto não estiver Faturado.' },
    { icone: Copy, label: 'Clonar', desc: 'Cria uma cópia exata do pedido. Ótimo para repetir pedidos de reposição.' },
    { icone: ClipboardCheck, label: 'Converter para Pedido', desc: 'Transforma uma Cotação (C, A ou CC) em Pedido (P), atualizando a data para hoje.' },
    { icone: SendHorizontal, label: 'Marcar Enviado', desc: 'Registra que o pedido foi enviado para a indústria. Muda o indicador de status de envio.' },
    { icone: Printer, label: 'Imprimir', desc: 'Gera o documento do pedido em PDF ou tela para impressão.' },
    { icone: CreditCard, label: 'Faturar', desc: 'Marca o pedido como Faturado (F). Ação irreversível — só após confirmação da nota fiscal.' },
    { icone: Trash2, label: 'Excluir', desc: 'Cancela o pedido (situação E). O pedido fica arquivado mas sai de todas as estatísticas.' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.6)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101, width: 640, background: G.card, boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: `1px solid ${G.border}` }}>

        <div style={{ background: G.text, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, background: G.mustard, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={18} color={G.text} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>Guia — Pedidos de Vendas</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Status, ações, importação e boas práticas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', color: '#94A3B8', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          <div style={sec}>
            <div style={h2}><Package size={14} /> O que é um Pedido de Vendas?</div>
            <p style={p}>Um pedido de vendas registra a intenção de compra de um cliente com uma indústria, intermediada pelo representante. O RepOne gerencia todo o ciclo: desde a cotação inicial até o faturamento.</p>
            <p style={p}>O pedido pode começar como <strong style={{ color: G.mustard }}>Cotação</strong> (quando o cliente ainda está decidindo) e evoluir até <strong style={{ color: G.mustard }}>Faturado</strong> (quando a nota fiscal é emitida).</p>
          </div>

          <div style={sec}>
            <div style={h2}><Hash size={14} /> Status dos Pedidos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {statuses.map(s => (
                <div key={s.code} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 14px', background: G.cardHi, borderRadius: 10, border: `1px solid ${G.border}` }}>
                  <div style={{ minWidth: 36, height: 22, borderRadius: 6, background: `${s.color}22`, border: `1px solid ${s.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 10, color: s.color }}>{s.code}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: G.text }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: G.textMuted, marginTop: 1 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...tip(), marginTop: 10 }}>
              ⚠ Apenas pedidos com status <strong>P</strong> e <strong>F</strong> contam em vendas, BI e relatórios. Excluídos (<strong>E</strong>) são desconsiderados em todas as estatísticas.
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><Plus size={14} /> Como criar um Pedido</div>
            {[
              { titulo: 'Clique em "Novo Pedido"', texto: 'Botão no canto superior direito da tela. Abre o formulário de criação.' },
              { titulo: 'Selecione o cliente e a indústria', texto: 'Use a busca rápida. O sistema carrega automaticamente a tabela de preços ativa da indústria selecionada.' },
              { titulo: 'Adicione os produtos', texto: 'Digite o código ou nome do produto na busca. O preço é preenchido automaticamente da tabela. Ajuste a quantidade.' },
              { titulo: 'Revise e salve', texto: 'Confira totais, condição de pagamento e observações. Salve como Cotação ou diretamente como Pedido.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={stp()}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 12, color: G.text, marginBottom: 2 }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: G.textMuted, lineHeight: 1.7 }}>{item.texto}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={sec}>
            <div style={h2}><TrendingUp size={14} /> Como importar Pedidos do Lojista</div>
            <p style={p}>Quando o lojista envia um pedido por e-mail ou WhatsApp (geralmente em Excel ou lista de texto), você pode importá-lo sem digitar produto por produto.</p>
            <div style={tip()}>
              <strong style={{ color: G.mustard }}>Botão "Importar"</strong> dentro do pedido → Cole a lista de produtos (código + quantidade) → O sistema identifica os produtos e monta o pedido automaticamente.
            </div>
            <p style={{ ...p, fontSize: 11 }}>Se o lojista usa siglas da indústria (ex: IMA-7052), remova a sigla antes de importar — deixe apenas o código do produto.</p>
          </div>

          <div style={sec}>
            <div style={h2}><LayoutGrid size={14} /> Ações do Menu de Contexto</div>
            <p style={{ ...p, marginBottom: 10 }}>Clique com o botão direito em qualquer pedido na lista (ou use o ícone ⋮) para acessar as ações:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {acoes.map(a => (
                <div key={a.label} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: G.cardHi, borderRadius: 10, border: `1px solid ${G.border}`, alignItems: 'flex-start' }}>
                  <a.icone size={14} color={G.mustard} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 11, color: G.text }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2, lineHeight: 1.55 }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><Factory size={14} /> Consolidação de Pedidos</div>
            <p style={p}>A view <strong style={{ color: G.mustard }}>Consolidação</strong> (botão no topo) agrupa pedidos da mesma indústria para envio em lote. Use quando acumular vários pedidos de um mesmo fornecedor antes de transmitir.</p>
            <div style={tip()}>Pedidos em status <strong>Q (Aguardando Consolidação)</strong> ficam prontos para serem agrupados e enviados juntos para a indústria.</div>
          </div>

          <div style={sec}>
            <div style={h2}><CheckCircle2 size={14} /> Boas Práticas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Use Cotação quando o cliente ainda está decidindo — evita "sujar" as estatísticas com pedidos incertos.',
                'Sempre converta a cotação para Pedido assim que o cliente confirmar, para aparecer corretamente no BI.',
                'Marque como "Enviado para Indústria" logo após transmitir — ajuda a controlar o que já foi e o que está pendente.',
                'Clone pedidos de reposição periódica (lubrificantes, filtros) em vez de criar do zero a cada mês.',
                'Fature apenas quando tiver a NF em mãos — o status F é irreversível e sinaliza entrega concluída.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, ...tip(), alignItems: 'flex-start' }}>
                  <CheckCircle2 size={12} color={G.mustard} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PedidosPage() {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const authUser = useAuthStore(s => s.user);

  const [industries, setIndustries]         = useState<Industry[]>([]);
  const [selectedInd, setSelectedInd]       = useState<number | null>(null);
  const [orders, setOrders]                 = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder]   = useState<Order | null>(null);
  const [loading, setLoading]               = useState(false);
  const [stats, setStats]                   = useState<Stats>({ revenue: 0, quantity: 0, pdvs: 0, averageTicket: 0, orders: 0, quotes: 0 });

  const [modalOpen, setModalOpen]           = useState(false);
  const [modalMode, setModalMode]           = useState<'view' | 'edit' | 'new'>('view');

  const [cloneTarget, setCloneTarget]       = useState<Order | null>(null);
  const [cloning, setCloning]               = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; ok: boolean } | null>(null);

  const [printDialogOpen, setPrintDialogOpen]   = useState(false);
  const [emailDialogOpen, setEmailDialogOpen]   = useState(false);
  const [orderToEmailData, setOrderToEmailData] = useState<any>(null);
  const [billingOpen, setBillingOpen]           = useState(false);
  const [billingOrder, setBillingOrder]         = useState<Order | null>(null);
  const [portalsOpen, setPortalsOpen]           = useState(false);
  const [portalsOrderId, setPortalsOrderId]     = useState<string | null>(null);
  const [faniaOpen, setFaniaOpen]               = useState(false);
  const [ctxMenu, setCtxMenu]                   = useState<{ x: number; y: number; order: Order } | null>(null);
  const [irisOrder, setIrisOrder]               = useState<Order | null>(null);
  const [defaultPrintModel, setDefaultPrintModel] = useState(1);
  const [separaLinhas, setSeparaLinhas] = useState<'S' | 'N'>('N');

  // Carrega formato padrão de impressão dos parâmetros
  useEffect(() => {
    if (!authUser?.id) return;
    api.get(`/parametros/${authUser.id}`).then(r => {
      if (r.data.success) {
        const model = parseInt(r.data.data.par_pedidopadrao) || 1;
        setDefaultPrintModel(model);
        localStorage.setItem('printModel', String(model));
        setSeparaLinhas(r.data.data.par_separalinhas === 'S' ? 'S' : 'N');
      }
    }).catch(() => {});
  }, [authUser?.id]);

  // Fecha context menu ao clicar em qualquer lugar
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleHardDelete = async (order: Order) => {
    setCtxMenu(null);
    if (!window.confirm(
      `⚠️ EXCLUSÃO DEFINITIVA\n\nEsta ação irá remover permanentemente o pedido #${order.ped_pedido} e todos os seus itens do banco de dados.\n\nEsta operação NÃO pode ser desfeita.\n\nDeseja continuar?`
    )) return;
    try {
      await api.delete(`/orders/${order.ped_pedido}`);
      showToast(`Pedido #${order.ped_pedido} excluído definitivamente.`);
      if (selectedOrder?.ped_pedido === order.ped_pedido) setSelectedOrder(null);
      loadOrders();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Erro ao excluir pedido', false);
    }
  };

  const handleToggleSent = async (order: Order) => {
    setCtxMenu(null);
    const novoStatus = !order.ped_enviado;
    try {
      await api.patch(`/orders/${order.ped_pedido}/enviado`, { enviado: novoStatus });
      showToast(`Pedido #${order.ped_pedido} marcado como ${novoStatus ? 'enviado' : 'não enviado'}.`);
      loadOrders();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Erro ao atualizar status de envio', false);
    }
  };

  const handleConvertToPedido = async (order: Order) => {
    setCtxMenu(null);
    try {
      await api.patch(`/orders/${order.ped_pedido}/converter-pedido`);
      setSelectedOrder(prev => prev?.ped_pedido === order.ped_pedido
        ? { ...prev, ped_situacao: 'P', ped_data: new Date().toISOString().split('T')[0] }
        : prev
      );
      showToast(`Cotação #${order.ped_pedido} convertida em pedido!`);
      loadOrders();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Erro ao converter cotação', false);
    }
  };

  const handleOpenPrint = (order: Order) => {
    setSelectedOrder(order);
    setPrintDialogOpen(true);
  };

  const handleOpenEmail = async (order: Order, sorting = 'digitacao') => {
    try {
      const res = await api.get(`/orders/${order.ped_pedido}/print-data?industria=${order.ped_industria}&sortBy=${sorting}`);
      if (res.data.success) {
        setOrderToEmailData(res.data.data);
        setEmailDialogOpen(true);
      }
    } catch { showToast('Erro ao carregar dados para e-mail', false); }
  };

  const handleShare = async (order: Order, channel: 'whatsapp' | 'email' | 'link') => {
    if (channel === 'email') {
      handleOpenEmail(order);
      return;
    }
    if (channel === 'whatsapp') {
      const token = localStorage.getItem('sm_token') || '';
      const model = localStorage.getItem('printModel') || '1';
      const printUrl = `${window.location.origin}/print/order/${order.ped_pedido}?model=${model}&sortBy=digitacao&industria=${order.ped_industria}&separateGroups=${separaLinhas}&token=${token}`;
      const msgText =
        `Olá! Segue o pedido *${order.ped_pedido}*.\n\n` +
        `Cliente: *${order.cli_nomred || order.cli_nome}*\n` +
        `Total: *R$ ${Number(order.ped_totliq).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n` +
        `🔗 Visualizar pedido: ${printUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msgText)}`, '_blank');
    }
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleClone = async () => {
    if (!cloneTarget) return;
    setCloning(true);
    try {
      const res = await api.post(`/orders/${cloneTarget.ped_pedido}/clone`);
      const { newPedPedido, itemsCloned } = res.data;
      setCloneTarget(null);
      showToast(`Pedido clonado! Novo: ${newPedPedido} (${itemsCloned} iten${itemsCloned !== 1 ? 's' : ''})`);
      loadOrders();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Erro ao clonar pedido', false);
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async (order: Order) => {
    if (!window.confirm(`Deseja marcar o pedido #${order.ped_pedido} como excluído?`)) return;
    try {
      await api.patch(`/orders/${order.ped_pedido}/situacao`);
      showToast(`Pedido #${order.ped_pedido} marcado como excluído.`);
      setSelectedOrder(null);
      loadOrders();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Erro ao excluir pedido', false);
    }
  };

  const [search, setSearch]                 = useState('');
  const [searchInput, setSearchInput]       = useState('');
  const [situacao, setSituacao]             = useState('Z');
  const [sortBy, setSortBy]                 = useState('date-desc');
  const [dataInicio, setDataInicio]         = useState(iso(new Date(today.getFullYear(), 0, 1)));
  const [dataFim, setDataFim]               = useState(iso(today));
  const [view, setView]                     = useState<'list' | 'consolidation'>('list');
  const [showHelp, setShowHelp]             = useState(false);
  const [clienteFiltro, setClienteFiltro]   = useState<number | null>(null);
  const [clienteFiltroNome, setClienteFiltroNome] = useState('');

  // Auto-trigger search 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load industries (reuse suppliers endpoint)
  useEffect(() => {
    api.get('/suppliers?active=true&limit=200').then(res => {
      const list: Industry[] = (res.data.data || res.data.fornecedores || []).map((f: any) => ({
        for_codigo: f.for_codigo,
        for_nomered: f.for_nomered,
        total_pedidos: 0,
      }));
      setIndustries(list);
    }).catch(() => {});
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: '700',
        situacao,
        dataInicio,
        dataFim,
      };
      if (selectedInd) params.industria = String(selectedInd);
      if (search) params.pesquisa = search;
      if (clienteFiltro) params.cliente = String(clienteFiltro);
      if (!selectedInd) params.ignorarIndustria = 'true';

      // Carregar pedidos (principal) — nunca deve falhar silenciosamente
      const ordersRes = await api.get('/orders', { params });
      let list: Order[] = ordersRes.data.pedidos || [];

      // Sort — ped_data primeiro; ped_numero como desempate dentro do mesmo dia
      list.sort((a, b) => {
        const dateA = new Date(a.ped_data).getTime();
        const dateB = new Date(b.ped_data).getTime();
        switch (sortBy) {
          case 'date-desc': return dateB !== dateA ? dateB - dateA : (b.ped_numero || 0) - (a.ped_numero || 0);
          case 'date-asc':  return dateA !== dateB ? dateA - dateB : (a.ped_numero || 0) - (b.ped_numero || 0);
          case 'val-desc':  return (b.ped_totliq || 0) - (a.ped_totliq || 0);
          case 'val-asc':   return (a.ped_totliq || 0) - (b.ped_totliq || 0);
          default:          return dateB !== dateA ? dateB - dateA : (b.ped_numero || 0) - (a.ped_numero || 0);
        }
      });

      setOrders(list);
      setSelectedOrder(prev => prev ? (list.find(o => o.ped_numero === prev.ped_numero) ?? prev) : null);

      // Update industry counts from loaded orders
      setIndustries(prev => prev.map(ind => ({
        ...ind,
        total_pedidos: list.filter(o => o.ped_industria === ind.for_codigo).length,
      })));

      // Carregar stats separadamente — falha aqui NÃO deve apagar a lista de pedidos
      try {
        const statsRes = await api.get('/orders/stats', { params });
        const s = statsRes.data.data || {};
        setStats({
          revenue: parseFloat(String(s.total_faturamento)) || 0,
          quantity: Number(s.total_quantidade) || 0,
          pdvs: Number(s.total_clientes) || 0,
          averageTicket: parseFloat(String(s.ticket_medio)) || 0,
          orders: list.filter(o => o.ped_situacao === 'P').length,
          quotes: list.filter(o => o.ped_situacao === 'C').length,
        });
      } catch {
        // Stats falhou — preenche com dados locais calculados da lista
        setStats({
          revenue: list.reduce((s, o) => s + (o.ped_totliq || 0), 0),
          quantity: 0,
          pdvs: new Set(list.map(o => o.ped_cliente)).size,
          averageTicket: list.length ? list.reduce((s, o) => s + (o.ped_totliq || 0), 0) / list.length : 0,
          orders: list.filter(o => o.ped_situacao === 'P').length,
          quotes: list.filter(o => o.ped_situacao === 'C').length,
        });
      }
    } catch (e) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedInd, search, situacao, sortBy, dataInicio, dataFim, clienteFiltro]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const pending = usePedidoActions.getState().pendingOpen;
    if (!pending || orders.length === 0) return;
    const order = orders.find(o => o.ped_pedido === pending);
    if (order) {
      usePedidoActions.getState().setPendingOpen(null);
      setSelectedOrder(order);
      setModalMode('edit');
      setModalOpen(true);
    }
  }, [orders]);

  // Ouve importações de portal (PATRAL, ARCA, etc.) disparadas pelo PortalsDialog
  useEffect(() => {
    const handler = async (e: Event) => {
      const { cliente, clienteNome: _cn, items, industriaId, tabela } = (e as CustomEvent).detail;
      if (!items?.length || !cliente || !industriaId) return;

      const user = useAuthStore.getState().user;
      const initials = user?.iniciais || user?.nome?.substring(0, 2).toUpperCase() || 'IMP';

      const formattedItems = items.map((it: any) => ({
        codigo:         (it.codigo || it.ite_produto || '').toString().trim().toUpperCase(),
        descricao:      it.descricao || it.codigo || 'Produto',
        quantidade:     Number(it.quantidade ?? it.ite_quant ?? 1),
        preco_unitario: Number(it.preco_unitario ?? it.portal_price ?? 0),
      }));

      try {
        const res = await api.post('/orders/from-portal', {
          cli_codigo:  cliente,
          industria_id: industriaId,
          tabela:      tabela || '',
          items:       formattedItems,
          user_initials: initials,
        });
        if (res.data.success) {
          usePedidoActions.getState().setPendingOpen(res.data.ped_pedido);
          loadOrders();
        }
      } catch (err: any) {
        console.error('[PedidosPage] from-portal error:', err?.response?.data ?? err);
      }
    };

    window.addEventListener('portalImportCompleted', handler);
    return () => window.removeEventListener('portalImportCompleted', handler);
  }, [loadOrders]);

  const filteredOrders = orders; // server-side filtered

  // Quando busca retorna pedidos de um único cliente, pré-seleciona ele no novo pedido
  const preselectedCliente = search.trim() && orders.length > 0
    ? (() => {
        const ids = new Set(orders.map(o => o.ped_cliente));
        if (ids.size === 1) return { id: orders[0].ped_cliente, nome: orders[0].cli_nomred || orders[0].cli_nome };
        return null;
      })()
    : null;

  const statItems = [
    { label: 'Faturamento',  value: fmt(stats.revenue)                          },
    { label: 'Quantidade',   value: stats.quantity.toLocaleString('pt-BR')      },
    { label: 'PDVs',         value: stats.pdvs.toLocaleString('pt-BR')          },
    { label: 'Ticket Médio', value: fmt(stats.averageTicket)                    },
    { label: 'Pedidos',      value: stats.orders.toLocaleString('pt-BR')        },
    { label: 'Cotações',     value: stats.quotes.toLocaleString('pt-BR')        },
  ];

  return (
    <>
    {showHelp && <PedidosHelpModal onClose={() => setShowHelp(false)} />}
    <div style={{ display: 'flex', height: '100vh', background: G.bg, overflow: 'hidden' }}>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{
          padding: '12px 20px', background: G.card, borderBottom: `1px solid ${G.border}`,
          display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: G.text, letterSpacing: -0.5, margin: 0 }}>
                PEDIDOS <span style={{ color: G.mustard }}>DE VENDAS</span>
              </h1>
              <div style={{ 
                display: 'flex', background: G.cardHi, padding: 3, borderRadius: 10, 
                border: `1px solid ${G.border}`, marginLeft: 10, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' 
              }}>
                <button
                  onClick={() => setView('list')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: view === 'list' ? G.mustard : 'transparent',
                    color: G.text,
                    fontSize: 12, fontWeight: 900, cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: view === 'list' ? '0 4px 12px rgba(217,118,0,0.25)' : 'none',
                  }}
                >
                  <LayoutList size={16} /> LISTAGEM
                </button>
                <button
                  onClick={() => setView('consolidation')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: view === 'consolidation' ? G.mustard : 'transparent',
                    color: G.text,
                    fontSize: 12, fontWeight: 900, cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: view === 'consolidation' ? '0 4px 12px rgba(217,118,0,0.25)' : 'none',
                    position: 'relative',
                  }}
                >
                  <PieChart size={16} /> 
                  CONSOLIDAÇÃO
                  {orders.filter(o => o.ped_situacao === 'Q').length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        position: 'absolute', top: -5, right: -5,
                        minWidth: 18, height: 18, borderRadius: 9,
                        background: G.danger, color: '#fff',
                        fontSize: 10, fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(192,57,43,0.3)',
                        padding: '0 4px',
                      }}
                    >
                      {orders.filter(o => o.ped_situacao === 'Q').length}
                    </motion.span>
                  )}
                </button>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20,
                background: '#16A34A18', color: G.success, border: '1px solid #16A34A33',
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                LIVE
              </span>
              {selectedInd && industries.find(i => i.for_codigo === selectedInd) && (
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  background: G.cardHi, border: `1px solid ${G.border}`, color: G.textSec,
                }}>
                  {industries.find(i => i.for_codigo === selectedInd)!.for_nomered}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Date range */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 8,
                background: G.cardHi, border: `1px solid ${G.border}`,
              }}>
                <Calendar size={12} style={{ color: G.textMuted }} />
                <input
                  type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 700, color: G.text, cursor: 'pointer' }}
                />
                <span style={{ color: G.textMuted, fontSize: 11 }}>–</span>
                <input
                  type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 700, color: G.text, cursor: 'pointer' }}
                />
              </div>

              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 8,
                background: G.cardHi, border: `1px solid ${G.border}`,
              }}>
                <Search size={12} style={{ color: G.textMuted }} />
                <input
                  placeholder="Buscar cliente, pedido, OC..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, fontWeight: 600, color: G.text, width: 160 }}
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearch(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: G.textMuted, fontSize: 14, lineHeight: 1, display: 'flex' }}
                  >×</button>
                )}
              </div>

              {/* Filtro por cliente (combobox) */}
              <ClientFilterCombo
                value={clienteFiltro}
                label={clienteFiltroNome}
                onChange={(id, nome) => { setClienteFiltro(id); setClienteFiltroNome(nome); }}
              />

              {/* Situação */}
              <select
                value={situacao}
                onChange={e => setSituacao(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: 8, border: `1px solid ${G.border}`,
                  background: G.cardHi, color: G.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                  appearance: 'auto' as any,
                }}
              >
                <option value="Z">Todos</option>
                <option value="P">Pedido</option>
                <option value="Q">Fila de Consolidação</option>
                <option value="C">Cotação pendente</option>
                <option value="A">Cotação confirmada</option>
                <option value="F">Faturado</option>
                <option value="G">Garantia</option>
                <option value="B">Bonificação</option>
                <option value="D">Bonificação Pendente</option>
                <option value="N">Notificação</option>
                <option value="E">Excluído</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: 8, border: `1px solid ${G.border}`,
                  background: G.cardHi, color: G.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none',
                  appearance: 'auto' as any,
                }}
              >
                <option value="date-desc">Mais Recentes</option>
                <option value="date-asc">Mais Antigos</option>
                <option value="val-desc">Maior Valor</option>
                <option value="val-asc">Menor Valor</option>
              </select>

              <button
                onClick={loadOrders}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: G.cardHi, border: `1px solid ${G.border}`,
                  cursor: 'pointer', color: G.textSec,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <RefreshCw size={13} />
              </button>

              {/* Portais */}
              <button
                onClick={() => { setPortalsOrderId(null); setPortalsOpen(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#D97600', color: '#fff',
                  fontSize: 12, fontWeight: 800,
                }}
              >
                <Globe size={13} />
                Portais
              </button>


              {/* Ajuda */}
              <button
                onClick={() => setShowHelp(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 8, border: `1px solid ${G.border}`, cursor: 'pointer',
                  background: G.cardHi, color: G.textSec,
                  fontSize: 12, fontWeight: 700,
                }}
              >
                <HelpCircle size={13} />
                Ajuda
              </button>

            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'flex', gap: 16 }}>
            {statItems.map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {label}
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: G.text, letterSpacing: -0.5 }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {view === 'consolidation' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: G.bg }}>
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: G.text, margin: 0 }}>Dashboard de Consolidação</h2>
                  <p style={{ fontSize: 12, color: G.textMuted }}>Monitore o volume acumulado para atingir o faturamento mínimo por indústria.</p>
                </div>
                <ConsolidationDashboard />
              </div>
            </div>
          ) : (
            <>
              {/* Industry sidebar */}
              <IndustrySidebar
                industries={industries}
                selected={selectedInd}
                onSelect={id => { setSelectedInd(id); setSelectedOrder(null); }}
              />

          {/* Order list */}
          <div style={{
            width: 380, background: G.card, borderRight: `1px solid ${G.border}`,
            display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            {/* List header */}
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${G.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={13} style={{ color: G.textSec }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {filteredOrders.length} registros
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Filter tabs */}
                {(['Todos', 'Pedidos', 'Cotações'] as const).map((t, i) => {
                  const vals = [null, 'P', 'C'];
                  const active = (vals[i] === null ? situacao === 'Z' : situacao === vals[i]);
                  return (
                    <button
                      key={t}
                      onClick={() => setSituacao(vals[i] === null ? 'Z' : vals[i]!)}
                      style={{
                        padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: active ? G.text : 'transparent',
                        color: active ? '#fff' : G.textMuted,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
                <button
                  onClick={() => setSituacao(situacao === 'J' ? 'Z' : 'J')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: situacao === 'J' ? '#15803D' : 'transparent',
                    color: situacao === 'J' ? '#fff' : '#15803D',
                  }}
                >
                  <MessageCircle size={11} />
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Order list body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: G.textMuted }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 12 }}>Carregando...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: G.textMuted }}>
                  <Package size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: 13 }}>Nenhum pedido encontrado</span>
                  {!selectedInd && <span style={{ fontSize: 11 }}>Selecione uma indústria</span>}
                </div>
              ) : (
                <>
                  {filteredOrders.map((order, idx) => (
                    <OrderCard
                      key={order.ped_pedido}
                      order={order}
                      index={idx}
                      isSelected={selectedOrder?.ped_numero === order.ped_numero}
                      onSelect={() => setSelectedOrder(
                        selectedOrder?.ped_numero === order.ped_numero ? null : order
                      )}
                      onContextMenu={(e, o) => {
                        e.preventDefault();
                        setSelectedOrder(o);
                        setCtxMenu({ x: e.clientX, y: e.clientY, order: o });
                      }}
                      showIndustry={!selectedInd}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Detail panel */}
              <OrderDetailPanel
                order={selectedOrder}
                orders={orders}
                dataInicio={dataInicio}
                dataFim={dataFim}
                onEdit={() => { setModalMode('edit'); setModalOpen(true); }}
                onView={() => { setModalMode('view'); setModalOpen(true); }}
                onDuplicate={o => setCloneTarget(o)}
                onDelete={o => handleDelete(o)}
                onPrint={o => handleOpenPrint(o)}
                onShare={(o, channel) => handleShare(o, channel)}
                onBilling={o => { setBillingOrder(o); setBillingOpen(true); }}
                onPortals={o => { setPortalsOrderId(o.ped_pedido); setPortalsOpen(true); }}
                onIris={o => setIrisOrder(o)}
              />
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── IRIS Panel ── */}
      {irisOrder && (
        <IrisPanel
          clienteId={irisOrder.ped_cliente}
          clienteNome={irisOrder.cli_nomred || irisOrder.cli_nome}
          industriaId={irisOrder.ped_industria}
          industriaNome={irisOrder.for_nomered}
          tabelaId={irisOrder.ped_tabela || undefined}
          onClose={() => setIrisOrder(null)}
          onNewOrder={(clienteId, industriaId) => {
            setIrisOrder(null);
            setSelectedInd(industriaId);
            setModalMode('new');
            setModalOpen(true);
          }}
        />
      )}

      {/* ── Pedido Modal (Visualizar / Editar) ── */}
      <PedidoModal
        isOpen={modalOpen}
        mode={modalMode}
        order={selectedOrder}
        onClose={() => { setModalOpen(false); loadOrders(); }}
        onSaved={() => { setModalOpen(false); loadOrders(); }}
        onUpdated={() => loadOrders()}
        initialIndustriaId={modalMode === 'new' ? selectedInd : null}
        initialClienteId={modalMode === 'new' ? (preselectedCliente?.id ?? null) : null}
        initialClienteLabel={modalMode === 'new' ? (preselectedCliente?.nome ?? null) : null}
      />

      {/* ── Print Dialog ── */}
      <PrintOrderDialog
        isOpen={printDialogOpen}
        onClose={() => setPrintDialogOpen(false)}
        orderNumber={selectedOrder?.ped_pedido || null}
        defaultModel={defaultPrintModel}
        orderToPrintIndustryName={selectedOrder ? (industries.find(i => i.for_codigo === selectedOrder.ped_industria)?.for_nomered || '') : ''}
        orderTotal={selectedOrder ? `R$ ${Number(selectedOrder.ped_totliq).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
        onPrint={(model, sorting) => {
          if (!selectedOrder) return;
          const url = `/print/order/${selectedOrder.ped_pedido}?model=${model}&sortBy=${sorting}&industria=${selectedOrder.ped_industria}&separateGroups=${separaLinhas}`;
          const w = 900, h = 700;
          window.open(url, 'PrintPreview', `width=${w},height=${h},left=${(window.screen.width - w) / 2},top=${(window.screen.height - h) / 2},scrollbars=yes,resizable=yes`);
        }}
        onExportExcel={async (sorting) => {
          if (!selectedOrder) return;
          try {
            const res = await api.get(`/orders/${selectedOrder.ped_pedido}/print-data?industria=${selectedOrder.ped_industria}&sortBy=${sorting}`);
            await exportOrderToExcel(res.data.data.order, res.data.data.items, separaLinhas);
            setPrintDialogOpen(false);
          } catch { showToast('Erro ao exportar Excel', false); }
        }}
        onSendEmail={(sorting) => {
          if (!selectedOrder) return;
          setPrintDialogOpen(false);
          handleOpenEmail(selectedOrder, sorting);
        }}
        onWhatsApp={(model, sorting) => {
          if (!selectedOrder) return;
          const token = localStorage.getItem('sm_token') || '';
          const printUrl = `${window.location.origin}/print/order/${selectedOrder.ped_pedido}?model=${model}&sortBy=${sorting}&industria=${selectedOrder.ped_industria}&separateGroups=${separaLinhas}&token=${token}`;
          const msgText =
            `Olá! Segue o pedido *${selectedOrder.ped_pedido}*.\n\n` +
            `Cliente: *${selectedOrder.cli_nomred || selectedOrder.cli_nome}*\n` +
            `Total: *R$ ${Number(selectedOrder.ped_totliq).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n` +
            `🔗 Visualizar pedido: ${printUrl}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msgText)}`, '_blank');
          setPrintDialogOpen(false);
        }}
      />

      {/* ── Send Email Dialog ── */}
      <SendEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        orderData={orderToEmailData}
        separateGroups={separaLinhas}
      />

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', zIndex: 9000,
            left: ctxMenu.x, top: ctxMenu.y,
            background: G.card, borderRadius: 10,
            border: `1px solid ${G.border}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: 210, overflow: 'hidden',
          }}
        >
          {/* Cabeçalho */}
          <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid ${G.border}` }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              #{ctxMenu.order.ped_pedido}
            </span>
          </div>

          {/* Opções */}
          {([
            { icon: Eye,     label: 'Visualizar Pedido',  color: G.text,     action: () => { setCtxMenu(null); setModalMode('view'); setModalOpen(true); } },
            { icon: Pencil,  label: 'Editar Registro',    color: G.text,     action: () => { setCtxMenu(null); setModalMode('edit'); setModalOpen(true); } },
            { icon: Printer, label: 'Imprimir Relatório', color: G.text,     action: () => { setCtxMenu(null); handleOpenPrint(ctxMenu.order); } },
            null, // separator
            { icon: Copy,         label: 'Clonar Pedido',      color: '#D97600',  action: () => { setCtxMenu(null); setCloneTarget(ctxMenu.order); } },
            { icon: Mail,         label: 'Enviar p/ Cliente',  color: '#0891B2',  action: () => { setCtxMenu(null); handleOpenEmail(ctxMenu.order); } },
            { icon: SendHorizontal, label: ctxMenu.order.ped_enviado === true ? 'Desmarcar como Enviado' : 'Marcar como Enviado', color: '#059669', action: () => handleToggleSent(ctxMenu.order) },
            ['C','A','CC'].includes(ctxMenu.order.ped_situacao) ? { icon: ClipboardCheck, label: 'Converter para Pedido', color: '#0891B2', action: () => handleConvertToPedido(ctxMenu.order) } : null,
            null, // separator
            { icon: Trash2,       label: 'Excluir Definitivamente', color: '#C0392B', action: () => handleHardDelete(ctxMenu.order) },
          ] as any[]).map((item, i) =>
            item === null ? (
              <div key={`sep-${i}`} style={{ height: 1, background: G.border, margin: '2px 0' }} />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '9px 14px', border: 'none',
                  background: 'transparent', textAlign: 'left',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  color: item.color,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `${item.color}12`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <item.icon size={13} />
                {item.label}
              </button>
            )
          )}
        </div>
      )}

      {/* ── Billing Dialog ── */}
      {billingOpen && billingOrder && (
        <BillingDialog
          order={billingOrder}
          onClose={() => { setBillingOpen(false); setBillingOrder(null); }}
        />
      )}

      {/* ── Portais Industriais Dialog ── */}
      <PortalsDialog
        open={portalsOpen}
        onOpenChange={open => { setPortalsOpen(open); if (!open) setPortalsOrderId(null); }}
        orderId={portalsOrderId}
        onFaniaRequest={() => setFaniaOpen(true)}
      />

      {/* ── Portal FANIA ── */}
      {faniaOpen && (
        <FaniaPortalModal
          onClose={() => setFaniaOpen(false)}
          onOrderCreated={() => { loadOrders(); }}
        />
      )}

      {/* ── Confirm Clone Dialog ── */}
      <ConfirmCloneDialog
        order={cloneTarget}
        onConfirm={handleClone}
        onCancel={() => !cloning && setCloneTarget(null)}
        cloning={cloning}
      />

      {/* ── FAB Orbital — Novo Pedido — só quando nenhum modal aberto ── */}
      {!modalOpen && <div style={{ position: 'fixed', bottom: 88, right: 28, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Anéis orbitais */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'absolute', width: 110, height: 110, borderRadius: '50%', border: '1px dashed rgba(40,55,74,0.25)' }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: '1px dashed rgba(255,210,0,0.18)' }}
          />
          {/* Partículas orbitais */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'relative', width: 80, height: 80 }}
          >
            {[0, 72, 144, 216, 288].map((angle, i) => (
              <motion.div
                key={angle}
                style={{
                  position: 'absolute',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  left: `calc(50% + ${Math.cos((angle * Math.PI) / 180) * 45}px - 3px)`,
                  top: `calc(50% + ${Math.sin((angle * Math.PI) / 180) * 45}px - 3px)`,
                  background: i % 2 === 0 ? '#28374A' : '#FFD200',
                  boxShadow: i % 2 === 0 ? '0 0 6px rgba(40,55,74,0.5)' : '0 0 6px rgba(255,210,0,0.6)',
                }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </motion.div>
        </div>

        {/* Botão principal */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (!selectedInd) {
              showToast('Selecione uma indústria no painel lateral antes de criar um pedido.', false);
              return;
            }
            setModalMode('new');
            setSelectedOrder(null);
            setModalOpen(true);
          }}
          className="group"
          style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
        >
          <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Glow + disco */}
            <motion.div
              animate={{ boxShadow: ['0 0 18px rgba(40,55,74,0.35)', '0 0 36px rgba(40,55,74,0.55)', '0 0 18px rgba(40,55,74,0.35)'] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: selectedInd
                  ? 'linear-gradient(135deg, #28374A, #1a2535)'
                  : 'linear-gradient(135deg, #94A3B8, #64748B)',
              }}
            />
            {/* Brilho interno */}
            <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)', pointerEvents: 'none' }} />
            {/* Ícone */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              <Plus size={26} color="#FFD200" strokeWidth={3} />
              <span style={{ fontSize: 7, fontWeight: 900, color: '#FFD200', letterSpacing: 1, textTransform: 'uppercase', marginTop: -2 }}>NOVO</span>
            </div>
            {/* Ripple hover */}
            <motion.div
              initial={{ scale: 1, opacity: 0 }}
              whileHover={{ scale: 1.55, opacity: [0, 0.25, 0] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #FFD200', pointerEvents: 'none' }}
            />
          </div>

          {/* Tooltip */}
          <div style={{
            position: 'absolute', right: '100%', marginRight: 14, top: '50%', transform: 'translateY(-50%)',
            opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none', whiteSpace: 'nowrap',
          }} className="group-hover:opacity-100">
            <div style={{
              padding: '5px 12px', background: '#28374A', color: '#FFD200',
              fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}>
              Novo Pedido
              <div style={{
                position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
                borderWidth: 5, borderStyle: 'solid', borderColor: 'transparent transparent transparent #28374A',
              }} />
            </div>
          </div>
        </motion.button>
      </div>}

      {/* ── Toast ── */}
      {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 9100,
              background: toast.ok ? '#16A34A' : '#C0392B',
              color: '#fff', borderRadius: 12, padding: '12px 20px',
              fontSize: 13, fontWeight: 700,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              display: 'flex', alignItems: 'center', gap: 8, maxWidth: 380,
            }}
          >
            {toast.ok
              ? <Copy size={15} style={{ flexShrink: 0 }} />
              : <Loader2 size={15} style={{ flexShrink: 0 }} />
            }
            {toast.msg}
          </motion.div>
        )}
    </div>
    </>
  );
}
