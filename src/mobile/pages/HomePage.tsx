import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, CalendarDays, Users, Package, BarChart3,
  Target, Sparkles, Wifi, WifiOff, ArrowUpRight,
  AlertTriangle, Shield, ChevronRight, Zap,
} from 'lucide-react';
import { api }           from '@/shared/lib/api';
import { useAuthStore }  from '@/shared/stores/useAuthStore';
import { useOffline }    from '../hooks/useOffline';
import { useSync }       from '../hooks/useSync';
import { SyncButton }    from '../components/SyncButton';

/* ─── types ────────────────────────────────────────────────────────────────── */
interface DashStats {
  total_sales:    number;
  monthly_goal:   number;
  progress:       number;
  ticket_medio:   number;
  total_orders:   number;
  active_clients: number;
  churn_count:    number;
  recent_orders:  RecentOrder[];
  insights:       Insight[];
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

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/* ─── HEADER ────────────────────────────────────────────────────────────────── */
function SalesHeader({ nome, empresa, loading }: { nome: string; empresa?: string; loading: boolean }) {
  const { isOnline } = useOffline();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div style={{
      background: 'var(--navy)', padding: '28px 20px 48px',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* subtle radial glows */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 70% 20%, rgba(255,210,0,0.08) 0%, transparent 60%)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <motion.div initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#FFF', lineHeight: 1.2, margin: 0 }}>
              {greeting},<br />{nome}!
            </h1>
            <motion.span style={{ fontSize: 28, marginTop: 4 }}
              animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={{ duration: 1.5, delay: 0.6 }}>
              👋
            </motion.span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              {loading ? 'Sincronizando dados...' : `Analisando ${empresa || 'seu progresso'}`}
            </span>
          </div>
        </motion.div>

        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            borderRadius: 14, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isOnline ? '#4ade80' : '#f87171',
              boxShadow: isOnline ? '0 0 8px rgba(74,222,128,0.6)' : 'none',
            }} />
            {isOnline ? <Wifi size={14} color="rgba(255,255,255,0.8)" /> : <WifiOff size={14} color="rgba(255,255,255,0.4)" />}
          </div>
        </motion.div>
      </div>

      {/* curved bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
        background: 'var(--sand-bg)', borderRadius: '32px 32px 0 0',
      }} />
    </div>
  );
}

/* ─── ANALYTICS CARD ────────────────────────────────────────────────────────── */
function AnalyticsCard({ stats }: { stats: DashStats }) {
  const month = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  const year  = new Date().getFullYear();
  const pct   = Math.min(stats.progress, 100);

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

      {/* Header row */}
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
              {month} <span style={{ opacity: 0.4 }}>·</span> {year}
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

      {/* Big number */}
      <p style={{ fontSize: 36, fontWeight: 900, color: 'var(--navy)', margin: '0 0 2px', letterSpacing: -1 }}>
        {fmtBRL(stats.total_sales)}
      </p>
      {stats.monthly_goal > 0 && (
        <p style={{ fontSize: 11, color: 'var(--navy-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>
          Meta: <span style={{ color: 'var(--navy)' }}>{fmtShort(stats.monthly_goal)}</span>
        </p>
      )}

      {/* Progress bar */}
      {stats.monthly_goal > 0 && (
        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 18, border: '1px solid #e2e8f0' }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 1.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', background: 'linear-gradient(90deg, var(--mustard) 0%, #f59e0b 100%)', borderRadius: 10 }}
          />
        </div>
      )}

      {/* 3-stat row */}
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

/* ─── QUICK ACTIONS ──────────────────────────────────────────────────────────── */
const ACTIONS = [
  { icon: ShoppingCart, label: 'Novo Pedido', bg: '#28374A', path: '/mobile/pedido' },
  { icon: CalendarDays, label: 'Agenda',      bg: '#7c3aed', path: '#' },
  { icon: Users,        label: 'Clientes',    bg: '#2563eb', path: '/mobile/clientes' },
  { icon: Package,      label: 'Catálogo',    bg: '#0891b2', path: '/mobile/precos' },
  { icon: BarChart3,    label: 'Sell-Out',    bg: '#059669', path: '/mobile/sellout' },
  { icon: Target,       label: 'Campanhas',   bg: '#dc2626', path: '#' },
  { icon: Sparkles,     label: 'Smart Mix',   bg: '#d97706', path: '#' },
  { icon: BarChart3,    label: 'BI',          bg: '#6b7280', path: '/mobile/bi' },
  { icon: Sparkles,     label: 'Soon',        bg: '#9ca3af', path: '#' },
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
              <div style={{
                width: 44, height: 44, borderRadius: 14, background: a.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
          borderRadius: 20, background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.3)',
        }}>
          <Sparkles size={9} color="var(--mustard)" />
          <span style={{ fontSize: 8, fontWeight: 900, color: 'var(--mustard)', textTransform: 'uppercase', letterSpacing: 1 }}>IA Engine</span>
        </div>
      </div>

      {insights.length > 0 ? insights.map((ins, i) => (
        <motion.div key={ins.cli_codigo} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.05 }}
          style={{
            background: '#FFF', borderRadius: 14, padding: '14px 14px 14px 18px',
            border: '1px solid var(--border)', marginBottom: 10, position: 'relative', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(40,55,74,0.06)',
          }}>
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
        style={{
          background: '#FFF', borderRadius: 14, padding: '14px 14px 14px 18px',
          border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(40,55,74,0.06)',
        }}>
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
        <button onClick={() => navigate('/mobile/pedido')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mustard)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
          Ver tudo <ChevronRight size={13} />
        </button>
      </div>

      {orders.length > 0 ? orders.slice(0, 5).map((o, i) => (
        <motion.div key={o.ped_pedido} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 + i * 0.06 }}
          style={{
            background: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10,
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 2px 8px rgba(40,55,74,0.06)',
          }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'rgba(40,55,74,0.06)', border: '1px solid rgba(40,55,74,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
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

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [stats,   setStats]   = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user }              = useAuthStore();
  const { isOnline }          = useOffline();
  const { sync, syncing, progress, queueCount } = useSync();
  const { lastSync } = useOffline();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      setLoading(true);
      try {
        if (isOnline) {
          const r = await api.get('/dashboard/mobile-summary');
          if (r.data.success) { setStats(r.data.data); return; }
        }
      } catch { /* fall to zeros */ }
      setStats({ total_sales: 0, monthly_goal: 0, progress: 0, ticket_medio: 0, total_orders: 0, active_clients: 0, churn_count: 0, recent_orders: [], insights: [] });
    })().finally(() => setLoading(false));
  }, [isOnline]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <SalesHeader nome={user?.nome || 'Vendedor'} empresa={user?.empresa} loading={loading} />

        <SyncButton onSync={() => sync(true)} syncing={syncing} progress={progress} queueCount={queueCount} lastSync={lastSync}
          style={{ margin: '0 16px 0', position: 'relative', zIndex: 5 }} />

        {stats ? (
          <>
            <AnalyticsCard stats={stats} />
            <QuickActions />
            <SmartInsights insights={stats.insights} />
            <RiskInsights churnCount={stats.churn_count} />
            <RecentOrders orders={stats.recent_orders} />
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
