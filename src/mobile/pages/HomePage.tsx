import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, CalendarDays, Users, Package, BarChart3,
  Target, Sparkles, Wifi, WifiOff, ArrowUpRight, Wrench, Route,
  AlertTriangle, Shield, ChevronRight, Zap, LogOut, Loader2,
} from 'lucide-react';
import { api }           from '@/shared/lib/api';
import { useAuthStore, useIaEnabled }  from '@/shared/stores/useAuthStore';
import { useOffline }    from '../hooks/useOffline';
import { useSync }       from '../hooks/useSync';
import { SyncButton }    from '../components/SyncButton';

/* ─── consts ────────────────────────────────────────────────────────────────── */
const NOW   = new Date();
const ANOS  = [2023, 2024, 2025, 2026];
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface IndMetaRow {
  for_codigo:  number;
  for_nomered: string;
  vendido:     number;
  meta:        number;
  pct:         number;
}
interface DashStats {
  total_sales:     number;
  monthly_goal:    number;
  progress:        number;
  ticket_medio:    number;
  total_orders:    number;
  active_clients:  number;
  churn_count:     number;
  recent_orders:   RecentOrder[];
  insights:        Insight[];
  industrias_meta: IndMetaRow[];
}
interface RecentOrder {
  ped_pedido:  string;
  ped_data:    string;
  cli_nomred:  string;
  for_nomered: string;
  ped_totliq:  number;
}
interface Insight {
  cli_codigo:       number;
  cliente_fantasia: string;
  industria:        string;
  gap_vlr:          number;
  tipo:             string;
}

const fmtBRL   = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/* ─── PILL BUTTON HELPERS ────────────────────────────────────────────────────── */
function pillStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    background:   active   ? 'rgba(255,210,0,0.22)' : 'rgba(255,255,255,0.08)',
    border:       active   ? '1.5px solid rgba(255,210,0,0.75)' : '1px solid rgba(255,255,255,0.14)',
    borderRadius: 9,
    color:        disabled ? 'rgba(255,255,255,0.18)' : active ? '#FFD200' : 'rgba(255,255,255,0.65)',
    fontSize:     12,
    fontWeight:   900,
    padding:      '8px 12px',
    cursor:       disabled ? 'default' : 'pointer',
    minHeight:    36,
    flexShrink:   0,
    fontFamily:   'inherit',
    lineHeight:   1,
    transition:   'background 0.15s, border-color 0.15s, color 0.15s',
  };
}

/* ─── HEADER ─────────────────────────────────────────────────────────────────── */
interface HeaderProps {
  nome: string; empresa?: string; loading: boolean;
  selectedYear: number; selectedMonth: number;
  onYearChange: (y: number) => void; onMonthChange: (m: number) => void;
}

function SalesHeader({ nome, empresa, loading, selectedYear, selectedMonth, onYearChange, onMonthChange }: HeaderProps) {
  const { isOnline } = useOffline();
  const { logout }   = useAuthStore();
  const navigate     = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const currentYear  = NOW.getFullYear();
  const currentMonth = NOW.getMonth() + 1;

  return (
    <div style={{
      background: 'var(--navy)', padding: '28px 20px 48px',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 70% 20%, rgba(255,210,0,0.08) 0%, transparent 60%)',
      }} />

      {/* ── Row 1: greeting + status badges ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', gap: 10 }}>
        <motion.div style={{ flex: 1 }} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#FFF', lineHeight: 1.2, margin: 0 }}>
              {greeting},<br />{nome}!
            </h1>
            <motion.span style={{ fontSize: 26, marginTop: 4 }}
              animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={{ duration: 1.5, delay: 0.6 }}>
              👋
            </motion.span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              {loading ? 'Carregando dados...' : `Analisando ${empresa || 'seu progresso'}`}
            </span>
          </div>

          {/* ── Ano pills ── */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {ANOS.map(a => (
              <button key={a} onClick={() => onYearChange(a)} style={pillStyle(selectedYear === a)}>
                {a}
              </button>
            ))}
          </div>
        </motion.div>

        {/* connectivity + logout */}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 4, flexShrink: 0 }}>

          <div style={{
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            borderRadius: 12, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? '#4ade80' : '#f87171',
              boxShadow: isOnline ? '0 0 8px rgba(74,222,128,0.6)' : 'none',
            }} />
            {isOnline
              ? <Wifi size={13} color="rgba(255,255,255,0.7)" />
              : <WifiOff size={13} color="rgba(255,255,255,0.35)" />}
          </div>

          <button
            onClick={() => { logout(); navigate('/mobile/login'); }}
            style={{
              background: 'rgba(248,71,71,0.15)', border: '1px solid rgba(248,71,71,0.3)',
              borderRadius: 12, padding: '8px 10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
            <LogOut size={13} color="#f87171" />
            <span style={{ fontSize: 10, fontWeight: 900, color: '#f87171', fontFamily: 'inherit', letterSpacing: 0.5 }}>
              SAIR
            </span>
          </button>
        </motion.div>
      </div>

      {/* ── Row 2: Mês pills (scroll horizontal) ── */}
      <div style={{ margin: '12px -20px 0', paddingLeft: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6, paddingRight: 20, width: 'max-content' }}>
          {MESES.map((m, i) => {
            const mesNum  = i + 1;
            const isFuture = selectedYear === currentYear && mesNum > currentMonth;
            return (
              <button
                key={mesNum}
                onClick={() => !isFuture && onMonthChange(mesNum)}
                disabled={isFuture}
                style={pillStyle(selectedMonth === mesNum, isFuture)}
              >
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      {/* curved bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
        background: 'var(--sand-bg)', borderRadius: '32px 32px 0 0',
      }} />
    </div>
  );
}

/* ─── INDUSTRIAS META ────────────────────────────────────────────────────────── */
function indBarColor(pct: number, hasMeta: boolean): string {
  if (!hasMeta)   return '#e2e8f0';
  if (pct >= 100) return '#059669';
  if (pct >= 80)  return '#d97706';
  if (pct >= 50)  return '#f59e0b';
  return '#dc2626';
}

function IndustriasMeta({ rows, year, month }: { rows: IndMetaRow[]; year: number; month: number }) {
  if (!rows || rows.length === 0) return null;

  const now            = new Date();
  const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;
  const dayOfMonth     = now.getDate();
  const daysInMonth    = new Date(year, month, 0).getDate();

  const GRID_MAX     = 10;
  const gridRows     = rows.slice(0, GRID_MAX);
  const scrollRows   = rows.slice(GRID_MAX);

  /* ── status geral ── */
  const rowsWithMeta = rows.filter(r => r.meta > 0);
  const minPct       = rowsWithMeta.length > 0 ? Math.min(...rowsWithMeta.map(r => r.pct)) : 100;
  const worstColor   = indBarColor(minPct, rowsWithMeta.length > 0);
  const worstLabel   = minPct >= 100 ? 'META' : minPct >= 80 ? 'OK' : minPct >= 50 ? 'ATENÇÃO' : 'CRÍTICO';

  /* ── projeção total ── */
  const totalVendido = rows.reduce((s, r) => s + r.vendido, 0);
  const totalMeta    = rows.reduce((s, r) => s + r.meta, 0);
  const totalPct     = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;
  const projPct      = isCurrentMonth && dayOfMonth > 0 && totalPct > 0 && totalMeta > 0
    ? Math.round((totalPct / dayOfMonth) * daysInMonth * 10) / 10
    : null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.1 }}
      style={{
        margin: '16px 16px 34px',   /* 34px bottom = 22px (overlap do AnalyticsCard) + 12px gap */
        borderRadius: 20, background: '#FFF',
        boxShadow: '0 4px 20px rgba(40,55,74,0.09)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>

      {/* ── Header discreto — mesmo estilo dos outros cards ── */}
      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 16, background: 'var(--mustard)', borderRadius: 2, boxShadow: '0 0 6px rgba(255,210,0,0.4)' }} />
          <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Meta por Indústria
          </span>
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>({rows.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {projPct !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Projeção</div>
              <div style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace',
                color: projPct >= 100 ? '#059669' : projPct >= 80 ? '#d97706' : '#dc2626' }}>
                {projPct.toFixed(1)}%
              </div>
            </div>
          )}
          <div style={{
            padding: '3px 9px', borderRadius: 20,
            background: `${worstColor}18`, border: `1px solid ${worstColor}44`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: worstColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {worstLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── Separador ── */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 18px' }} />

      {/* ── Grid top 10: 2 colunas, sem bordas pesadas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {gridRows.map((row, i) => {
          const color    = indBarColor(row.pct, row.meta > 0);
          const barWidth = Math.min(row.pct, 100);
          const isLeft   = i % 2 === 0;
          const isLastRow = i >= gridRows.length - 2;
          return (
            <div key={row.for_codigo} style={{
              padding: '12px 14px',
              borderRight:  isLeft  ? '1px solid var(--border)' : 'none',
              borderBottom: isLastRow && scrollRows.length === 0 ? 'none' : '1px solid var(--border)',
            }}>
              {/* dot + nome + % */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontSize: 10, fontWeight: 700, color: 'var(--navy)',
                  textTransform: 'uppercase', letterSpacing: 0.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.for_nomered}
                </span>
                <span style={{ fontSize: 12, fontWeight: 900, color, fontFamily: 'monospace', flexShrink: 0 }}>
                  {row.meta > 0 ? `${row.pct}%` : '—'}
                </span>
              </div>
              {/* barra fina */}
              <div style={{ height: 3, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                {row.meta > 0 && (
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    style={{ height: '100%', background: color, borderRadius: 3 }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scroll horizontal — demais indústrias ── */}
      {scrollRows.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0 12px' }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase',
            letterSpacing: 0.8, padding: '0 18px 8px' }}>
            Demais · {scrollRows.length}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingLeft: 18, paddingRight: 18, WebkitOverflowScrolling: 'touch' }}>
            {scrollRows.map((row, i) => {
              const color = indBarColor(row.pct, row.meta > 0);
              const bw    = Math.min(row.pct, 100);
              return (
                <div key={row.for_codigo} style={{
                  flexShrink: 0, width: 84,
                  background: '#f8fafc', borderRadius: 10,
                  border: '1px solid var(--border)', padding: '8px 9px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--navy)',
                      textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.for_nomered}
                    </span>
                  </div>
                  <div style={{ height: 3, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                    {row.meta > 0 && (
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${bw}%` }}
                        transition={{ duration: 0.9, delay: 0.4 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', background: color, borderRadius: 3 }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900, color, fontFamily: 'monospace', textAlign: 'right' }}>
                    {row.meta > 0 ? `${row.pct}%` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ─── ANALYTICS CARD ─────────────────────────────────────────────────────────── */
function AnalyticsCard({ stats, year, month }: { stats: DashStats; year: number; month: number }) {
  const mesNome = MESES[month - 1];
  const pct     = Math.min(stats.progress, 100);

  return (
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.15 }}
      style={{
        margin: '-22px 16px 0', borderRadius: 20, padding: '20px 18px',
        background: '#FFF', boxShadow: '0 8px 32px rgba(40,55,74,0.12)',
        border: '1px solid rgba(255,255,255,0.6)', position: 'relative', overflow: 'hidden', zIndex: 10,
      }}>

      <div style={{ position: 'absolute', top: 0, right: 0, width: 160, height: 160,
        background: 'radial-gradient(circle, rgba(255,210,0,0.08) 0%, transparent 70%)',
        borderRadius: '0 20px 0 100%', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 18, background: 'var(--mustard)', borderRadius: 2, boxShadow: '0 0 8px rgba(255,210,0,0.5)' }} />
            <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Performance de Vendas
            </span>
          </div>
          <div style={{
            marginTop: 6, display: 'inline-block', padding: '3px 10px', borderRadius: 20,
            background: 'rgba(255,210,0,0.1)', border: '1px solid rgba(255,210,0,0.3)',
          }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--navy-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
              {mesNome.slice(0, 3)} <span style={{ opacity: 0.4 }}>·</span> {year}
            </span>
          </div>
        </div>

        {stats.monthly_goal > 0 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 400 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: stats.progress >= 100 ? 'var(--mustard)' : 'var(--navy)',
              color: stats.progress >= 100 ? 'var(--navy)' : '#FFF',
              borderRadius: 20, padding: '6px 12px',
            }}>
              <ArrowUpRight size={13} strokeWidth={3} />
              <span style={{ fontSize: 13, fontWeight: 900 }}>{stats.progress}%</span>
            </div>
          </motion.div>
        )}
      </div>

      <p style={{ fontSize: 36, fontWeight: 900, color: 'var(--navy)', margin: '0 0 2px', letterSpacing: -1 }}>
        {fmtBRL(stats.total_sales)}
      </p>
      {stats.monthly_goal > 0 && (
        <p style={{ fontSize: 11, color: 'var(--navy-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>
          Meta: <span style={{ color: 'var(--navy)' }}>{fmtShort(stats.monthly_goal)}</span>
        </p>
      )}

      {stats.monthly_goal > 0 && (
        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 18, border: '1px solid #e2e8f0' }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 1.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', background: 'linear-gradient(90deg, var(--mustard) 0%, #f59e0b 100%)', borderRadius: 10 }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Ticket Médio', value: fmtShort(stats.ticket_medio), sub: 'por pedido', color: '#059669', bg: 'rgba(5,150,105,0.06)' },
          { label: 'Positivação',  value: stats.active_clients,          sub: 'clientes',  color: '#2563eb', bg: 'rgba(37,99,235,0.06)' },
          { label: 'Qtd Pedidos',  value: stats.total_orders,            sub: 'no mês',    color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            style={{ background: s.bg, borderRadius: 16, padding: '12px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.4)' }}>
            <p style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: s.color, letterSpacing: -0.5, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>{s.sub}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── IRIS PORTFOLIO ANALYSIS ───────────────────────────────────────────────── */
interface PortfolioRow {
  for_codigo: number; for_nomered: string;
  total_12m: number; pedidos_12m: number; clientes_ativos: number;
  contribuicao_pct: number; tendencia_pct: number | null;
  ult_90d: number; ant_90d: number;
  score: number; zona: 'MANTER' | 'MONITORAR' | 'REVISAR'; narrative: string;
}

const ZONA_CFG = {
  REVISAR:   { color: '#dc2626', bg: 'rgba(220,38,38,0.07)',   border: 'rgba(220,38,38,0.20)',   label: 'Revisar',   icon: '⚠️' },
  MONITORAR: { color: '#d97706', bg: 'rgba(217,119,6,0.07)',   border: 'rgba(217,119,6,0.20)',   label: 'Monitorar', icon: '👀' },
  MANTER:    { color: '#059669', bg: 'rgba(5,150,105,0.07)',   border: 'rgba(5,150,105,0.20)',   label: 'Manter',    icon: '✓'  },
};

function PortfolioCard({ row, delay }: { row: PortfolioRow; delay: number }) {
  const cfg = ZONA_CFG[row.zona];
  const fmtK = (v: number) =>
    v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
    : v >= 1_000   ? `R$ ${Math.round(v / 1_000)}k`
    : `R$ ${v.toFixed(0)}`;

  return (
    <motion.div initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 24 }}
      style={{
        background: cfg.bg, border: `1.5px solid ${cfg.border}`,
        borderRadius: 14, padding: '13px 14px', marginBottom: 8,
        borderLeft: `4px solid ${cfg.color}`,
      }}>
      {/* header: nome + badge zona */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase' }}>
          {row.for_nomered}
        </span>
        <span style={{
          fontSize: 8, fontWeight: 900, color: cfg.color,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      {/* métricas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { label: 'Receita 12m',  value: fmtK(row.total_12m) },
          { label: '% Carteira',   value: `${row.contribuicao_pct.toFixed(1)}%` },
          { label: 'Clientes',     value: String(row.clientes_ativos) },
          ...(row.tendencia_pct != null ? [{ label: 'Tendência 90d', value: `${row.tendencia_pct > 0 ? '+' : ''}${row.tendencia_pct}%` }] : []),
        ].map(m => (
          <div key={m.label} style={{
            flex: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 9,
            padding: '6px 4px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--navy)', fontFamily: 'monospace' }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* narrativa IRIS */}
      <div style={{
        background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: '9px 11px',
        borderLeft: `3px solid ${cfg.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <Sparkles size={9} color={cfg.color} />
          <span style={{ fontSize: 8, fontWeight: 900, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            IRIS
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--navy)', lineHeight: 1.55, margin: 0 }}>
          {row.narrative}
        </p>
      </div>
    </motion.div>
  );
}

function PortfolioIris() {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState<PortfolioRow[] | null>(null);
  const { isOnline } = useOffline();

  const load = async () => {
    if (data) { setOpen(true); return; }
    setLoading(true); setOpen(true);
    try {
      const r = await api.get('/dashboard/iris-portfolio-analysis');
      if (r.data.success) setData(r.data.data);
    } catch { setData([]); }
    finally  { setLoading(false); }
  };

  if (!isOnline && !data) return null;

  const revisar   = data?.filter(r => r.zona === 'REVISAR')   ?? [];
  const monitorar = data?.filter(r => r.zona === 'MONITORAR') ?? [];
  const manter    = data?.filter(r => r.zona === 'MANTER')    ?? [];

  return (
    <div style={{ padding: '20px 16px 0' }}>
      {/* ── trigger button / header ── */}
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={() => open ? setOpen(false) : load()}
        style={{
          background: open ? 'var(--navy)' : '#FFF',
          borderRadius: open ? '16px 16px 0 0' : 16,
          padding: '14px 16px', cursor: 'pointer',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 12px rgba(40,55,74,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background 0.2s, border-radius 0.2s',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: open ? 'rgba(255,210,0,0.2)' : 'var(--navy)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={15} color={open ? 'var(--mustard)' : '#FFF'} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: open ? '#FFF' : 'var(--navy)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Análise de Portfólio
            </div>
            <div style={{ fontSize: 9, color: open ? 'rgba(255,255,255,0.5)' : 'var(--navy-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              IRIS · Viabilidade por Indústria
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && !open && revisar.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 900, color: '#dc2626',
              background: 'rgba(220,38,38,0.1)', padding: '3px 9px', borderRadius: 20,
            }}>
              {revisar.length} a revisar
            </span>
          )}
          <ChevronRight size={16} color={open ? 'rgba(255,255,255,0.5)' : 'var(--navy-muted)'}
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </motion.div>

      {/* ── painel expandido ── */}
      {open && (
        <div style={{
          background: 'var(--sand-bg)', border: '1px solid var(--border)',
          borderTop: 'none', borderRadius: '0 0 16px 16px',
          padding: '16px 14px 14px',
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: 'var(--navy-muted)', fontSize: 12 }}>
              <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
              IRIS analisando seu portfólio...
            </div>
          ) : !data || data.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--navy-muted)', padding: '20px 0' }}>
              Dados insuficientes para análise.
            </p>
          ) : (
            <>
              {/* sumário de zonas */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {([['REVISAR', revisar.length], ['MONITORAR', monitorar.length], ['MANTER', manter.length]] as const).map(([zona, count]) => {
                  const cfg = ZONA_CFG[zona];
                  return (
                    <div key={zona} style={{
                      flex: 1, textAlign: 'center', background: cfg.bg,
                      border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '8px 4px',
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: cfg.color }}>{count}</div>
                      <div style={{ fontSize: 8, fontWeight: 900, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{cfg.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* REVISAR */}
              {revisar.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.8 }}>⚠️ Revisar representação</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(220,38,38,0.2)' }} />
                  </div>
                  {revisar.map((r, i) => <PortfolioCard key={r.for_codigo} row={r} delay={i * 0.06} />)}
                </>
              )}

              {/* MONITORAR */}
              {monitorar.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 10px' }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.8 }}>👀 Monitorar de perto</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(217,119,6,0.2)' }} />
                  </div>
                  {monitorar.map((r, i) => <PortfolioCard key={r.for_codigo} row={r} delay={0.2 + i * 0.05} />)}
                </>
              )}

              {/* MANTER — só contagem */}
              {manter.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
                  background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)',
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(5,150,105,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 14 }}>✓</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#059669' }}>
                      {manter.length} indústria{manter.length !== 1 ? 's' : ''} saudável{manter.length !== 1 ? 'is' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, opacity: 0.7 }}>
                      {manter.map(r => r.for_nomered).join(' · ')}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── QUICK ACTIONS ──────────────────────────────────────────────────────────── */
const ACTIONS = [
  { icon: ShoppingCart, label: 'Novo Pedido', bg: '#28374A', path: '/mobile/pedido' },
  { icon: CalendarDays, label: 'Agenda',      bg: '#7c3aed', path: '/mobile/agenda' },
  { icon: Users,        label: 'Clientes',    bg: '#2563eb', path: '/mobile/clientes' },
  { icon: Package,      label: 'Catálogo',    bg: '#0891b2', path: '/mobile/precos' },
  { icon: BarChart3,    label: 'Sell-Out',    bg: '#059669', path: '/mobile/sellout' },
  { icon: Target,       label: 'Campanhas',   bg: '#dc2626', path: '/mobile/campanhas' },
  { icon: Sparkles,     label: 'Smart Mix',   bg: '#d97706', path: '#' },
  { icon: BarChart3,    label: 'BI',          bg: '#6b7280', path: '/mobile/bi' },
  { icon: Route,        label: 'Rotas',       bg: '#1d4ed8', path: '/mobile/rotas' },
  { icon: Wrench,       label: 'Aftermarket', bg: '#0f766e', path: '/mobile/aftermarket' },
];

function QuickActions() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <h2 style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
        Acesso Rápido
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button key={a.label} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => a.path !== '#' && navigate(a.path)}
              style={{
                background: '#FFF', borderRadius: 16, padding: '16px 4px 12px',
                border: '1px solid var(--border)', cursor: a.path === '#' ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                boxShadow: '0 2px 8px rgba(40,55,74,0.06)',
                opacity: a.path === '#' ? 0.5 : 1,
              }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color="#FFF" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {a.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── SMART INSIGHTS ─────────────────────────────────────────────────────────── */
function SmartInsights({ insights }: { insights: Insight[] }) {
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--mustard)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="var(--navy)" strokeWidth={3} />
          </div>
          <h2 style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Smart Insights</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.3)' }}>
          <Sparkles size={9} color="var(--mustard)" />
          <span style={{ fontSize: 8, fontWeight: 900, color: 'var(--mustard)', textTransform: 'uppercase', letterSpacing: 1 }}>IA Engine</span>
        </div>
      </div>

      {insights.length > 0 ? insights.map((ins, i) => (
        <motion.div key={ins.cli_codigo} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.05 }}
          style={{ background: '#FFF', borderRadius: 14, padding: '14px 14px 14px 18px', border: '1px solid var(--border)', marginBottom: 10, position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 3px 3px 0', background: ins.tipo === 'AUTO' ? '#059669' : 'var(--mustard)' }} />
          <p style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
            {ins.tipo === 'AUTO' ? 'Sugestão de Giro' : 'Oportunidade de Campanha'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase' }}>{ins.cliente_fantasia}</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)', textTransform: 'uppercase' }}>{ins.industria}</p>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <p style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>GAP</p>
                <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--mustard)', letterSpacing: -0.5 }}>{fmtShort(ins.gap_vlr)}</p>
              </div>
              <div style={{ width: 34, height: 34, background: '#f8fafc', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpRight size={15} color="#94a3b8" strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </motion.div>
      )) : (
        <div style={{ background: '#FFF', borderRadius: 14, padding: 28, textAlign: 'center', border: '2px dashed var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Processando com IA...</p>
        </div>
      )}
    </div>
  );
}

/* ─── RISK INSIGHTS ──────────────────────────────────────────────────────────── */
function RiskInsights({ churnCount }: { churnCount: number }) {
  const hasRisk = churnCount > 0;
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 10, background: hasRisk ? '#dc2626' : '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasRisk ? <AlertTriangle size={14} color="#FFF" strokeWidth={3} /> : <Shield size={14} color="#FFF" strokeWidth={3} />}
        </div>
        <h2 style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Saúde da Carteira</h2>
      </div>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        style={{ background: '#FFF', borderRadius: 14, padding: '14px 14px 14px 18px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
        <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 3px 3px 0', background: hasRisk ? '#dc2626' : '#059669' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase' }}>
              {hasRisk ? 'Ação Necessária' : 'Carteira Blindada'}
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)', textTransform: 'uppercase', marginTop: 2 }}>
              {hasRisk
                ? `${churnCount} parceiro${churnCount > 1 ? 's' : ''} em risco de churn (+60 dias)`
                : 'Excelente! Nenhuma inatividade detectada'}
            </p>
          </div>
          <div style={{ width: 34, height: 34, background: '#f8fafc', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={17} color="#94a3b8" strokeWidth={2.5} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── RECENT ORDERS ──────────────────────────────────────────────────────────── */
function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={13} color="#FFF" />
          </div>
          <h2 style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Atividade Recente</h2>
        </div>
        <button onClick={() => navigate('/mobile/pedidos')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mustard)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
          Ver tudo <ChevronRight size={13} />
        </button>
      </div>

      {orders.length > 0 ? orders.slice(0, 5).map((o, i) => (
        <motion.div key={o.ped_pedido} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 + i * 0.06 }}
          style={{ background: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(40,55,74,0.06)', border: '1px solid rgba(40,55,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase' }}>
              {(o.cli_nomred || 'C')[0]}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {o.cli_nomred}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--mustard)', textTransform: 'uppercase', letterSpacing: 1 }}>#{o.ped_pedido}</span>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--navy-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {o.for_nomered}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', letterSpacing: -0.5 }}>
              {fmtBRL(o.ped_totliq)}
            </p>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--navy-muted)', marginTop: 2 }}>
              {new Date(o.ped_data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
          </div>
        </motion.div>
      )) : (
        <div style={{ background: '#FFF', borderRadius: 14, padding: 32, textAlign: 'center', border: '2px dashed var(--border)' }}>
          <ShoppingCart size={24} color="#cbd5e1" style={{ display: 'block', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Nenhum pedido recente</p>
        </div>
      )}
    </div>
  );
}

/* ─── period persistence ─────────────────────────────────────────────────────── */
const SS_YEAR  = 'home_period_year';
const SS_MONTH = 'home_period_month';

function readYear()  { const v = sessionStorage.getItem(SS_YEAR);  return v ? parseInt(v) : NOW.getFullYear(); }
function readMonth() { const v = sessionStorage.getItem(SS_MONTH); return v ? parseInt(v) : NOW.getMonth() + 1; }

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [selectedYear,  setSelectedYear]  = useState(readYear);
  const [selectedMonth, setSelectedMonth] = useState(readMonth);
  const [stats,         setStats]         = useState<DashStats | null>(null);
  const [loading,       setLoading]       = useState(true);

  const { user }    = useAuthStore();
  const iaEnabled   = useIaEnabled();
  const { isOnline } = useOffline();
  const { sync, syncing, progress, queueCount } = useSync();
  const { lastSync } = useOffline();

  // Controla se já houve o primeiro load (evita re-mount duplicado em StrictMode)
  const firstLoad = useRef(false);
  // Guarda o valor anterior de syncing para detectar transição true→false
  const prevSyncing = useRef(false);

  const fetchStats = useMemo(() => async (year: number, month: number) => {
    if (!isOnline) {
      setStats({ total_sales: 0, monthly_goal: 0, progress: 0, ticket_medio: 0, total_orders: 0, active_clients: 0, churn_count: 0, recent_orders: [], insights: [], industrias_meta: [] });
      return;
    }
    setLoading(true);
    try {
      const r = await api.get(`/dashboard/mobile-summary?ano=${year}&mes=${month}`);
      if (r.data.success) setStats(r.data.data);
      else throw new Error('no data');
    } catch {
      setStats({ total_sales: 0, monthly_goal: 0, progress: 0, ticket_medio: 0, total_orders: 0, active_clients: 0, churn_count: 0, recent_orders: [], insights: [], industrias_meta: [] });
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  // Carrega ao montar
  useEffect(() => {
    if (firstLoad.current) return;
    firstLoad.current = true;
    fetchStats(selectedYear, selectedMonth);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recarrega quando o período muda
  useEffect(() => {
    if (!firstLoad.current) return;
    fetchStats(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, fetchStats]);

  // Recarrega quando o sync termina (syncing: true → false)
  useEffect(() => {
    if (prevSyncing.current && !syncing) {
      fetchStats(selectedYear, selectedMonth);
    }
    prevSyncing.current = syncing;
  }, [syncing, selectedYear, selectedMonth, fetchStats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <SalesHeader
          nome={user?.nome || 'Vendedor'}
          empresa={user?.empresa}
          loading={loading}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={y  => { sessionStorage.setItem(SS_YEAR,  String(y)); setSelectedYear(y);  }}
          onMonthChange={m => { sessionStorage.setItem(SS_MONTH, String(m)); setSelectedMonth(m); }}
        />

        <SyncButton
          onSync={() => sync(true)}
          syncing={syncing}
          progress={progress}
          queueCount={queueCount}
          lastSync={lastSync}
          style={{ margin: '8px 16px 0', position: 'relative', zIndex: 5 }}
        />

        {stats ? (
          <>
            {/* Metas + Performance só pra Gerência/Master/SuperAdmin — usuário ativo (role='user') não vê */}
            {user?.role !== 'user' && (
              <>
                <IndustriasMeta rows={stats.industrias_meta ?? []} year={selectedYear} month={selectedMonth} />
                <AnalyticsCard stats={stats} year={selectedYear} month={selectedMonth} />
              </>
            )}
            <QuickActions />
            {/* SmartInsights/RiskInsights/PortfolioIris só com IRIS ligada */}
            {iaEnabled && <SmartInsights insights={stats.insights} />}
            {iaEnabled && <RiskInsights churnCount={stats.churn_count} />}
            <RecentOrders orders={stats.recent_orders} />
            {iaEnabled && <PortfolioIris />}
          </>
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--navy-muted)' }}>
            {loading ? 'Carregando...' : 'Sem dados disponíveis'}
          </div>
        )}
      </div>
    </div>
  );
}
