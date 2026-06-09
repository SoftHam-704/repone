import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  ArrowUpRight, ArrowDownRight, Flame, Factory,
  UserCircle, Calendar as CalendarIcon, Cake,
  Check, X, Info, ShieldAlert, RefreshCw, Target,
  TrendingUp, LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Mail, MessageCircle, Inbox, Clock,
  ChevronRight, ChevronLeft, Bell, Users,
  Radar, Users2, ListChecks, Kanban, AlertTriangle,
  Send, Zap, Bot, Phone, Sparkles, HelpCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
// AppSidebar é renderizado pelo MainLayout — não duplicar aqui.
import { NoticiasBanner } from '../components/NoticiasBanner';
import { api } from '@/shared/lib/api';
import { useAuthStore, iaLigada } from '@/shared/stores/useAuthStore';
import { useIrisModal } from '@/shared/stores/useIrisModal';

// ─── TOKENS — Mustard Precision ──────────────────────────────────────────────
const G = {
  bg:        '#E8E1D4',  // Areia — fundo principal
  card:      '#F2ECE2',  // Areia clara — cards
  cardHi:    '#F8F4EE',  // Areia muito clara — hover/destaque
  border:    '#D3C7AD',  // Areia pura — bordas
  text:      '#28374A',  // Azul navy — texto principal
  textSec:   '#3D5265',  // Navy médio — texto secundário
  textMuted: '#5E7282',  // Navy suave — texto muted (legível sobre areia)
  mustard:   '#FFD200',  // Mostarda — acento de ação (mantido)
  mustardDk: '#E6BD00',
  success:   '#16A34A',
  danger:    '#C0392B',
  warning:   '#D97706',
  purple:    '#6D4C8E',
  blue:      '#2563EB',
  teal:      '#2A7A6F',  // Terra queimada-teal adaptado
} as const;

const PortalStyles = () => (
  <style>{`
    @keyframes irisGlow {
      0%, 100% { box-shadow: 0 0 14px 4px rgba(255,210,0,0.4); }
      50%       { box-shadow: 0 0 32px 10px rgba(255,210,0,0.65); }
    }
    .iris-glow { animation: irisGlow 2.5s ease-in-out infinite; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .card-soft {
      box-shadow: 0 10px 40px -10px rgba(26,26,26,0.06);
      transition: box-shadow .25s, transform .25s;
    }
    .card-soft:hover {
      box-shadow: 0 20px 60px -10px rgba(26,26,26,0.12);
      transform: translateY(-1px);
    }
    input::placeholder {
      color: #28374A;
      font-weight: 700;
      opacity: 1;
    }
    @keyframes irisScan {
      0%   { left: -28%; }
      50%  { left: 110%; }
      100% { left: -28%; }
    }
    @keyframes irisDotPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }
    .iris-scan-bar  { animation: irisScan 3.6s cubic-bezier(0.45,0,0.55,1) infinite; }
    .iris-dot-pulse { animation: irisDotPulse 2s ease-in-out infinite; }
  `}</style>
);

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
const DarkTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: G.text, border: `1px solid ${G.textSec}30` }}
      className="p-3 rounded-xl shadow-2xl min-w-[150px]">
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: G.border }}>{label}</p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-xs" style={{ color: G.border }}>{e.name}</span>
          </div>
          <span className="text-sm font-bold font-mono" style={{ color: G.mustard }}>
            {typeof e.value === 'number' ? e.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : e.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── META RING ────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const MetaRing = ({
  pct, projected, loading, industries, month, year,
}: { pct: number; projected: number | null; loading: boolean; industries: any[]; month: number | null; year: number }) => {
  const r    = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const [showTip, setShowTip] = useState(false);

  const color = pct >= 95 ? G.success : pct > 80 ? '#0EA5E9' : pct > 50 ? G.warning : G.danger;
  const label = pct >= 95 ? 'Excelente' : pct > 80 ? 'Bom' : pct > 50 ? 'Satisfatório' : 'Crítico';

  const semVendas = industries.filter(r => Number(r.total_faturamento || 0) === 0 && Number(r.total_meta || 0) > 0);

  return (
    <div className="flex items-center gap-4" style={{ position: 'relative' }}>
      <div className="relative w-[140px] h-[140px] flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
          {/* track */}
          <circle cx="70" cy="70" r={r} stroke={G.border} strokeWidth="10" fill="none" />
          {/* fill */}
          <motion.circle cx="70" cy="70" r={r} stroke={color} strokeWidth="10" fill="none"
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: loading ? circ : offset }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.4 }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading
            ? <div className="w-16 h-9 rounded-lg animate-pulse" style={{ background: G.border }} />
            : <>
                <span className="font-black leading-none"
                  style={{ color, fontSize: pct >= 100 ? 28 : pct >= 10 ? 32 : 36 }}>
                  {Number(pct).toFixed(0)}%
                </span>
                <span className="text-[10px] font-bold mt-1" style={{ color: G.textMuted }}>da meta</span>
              </>
          }
        </div>
      </div>
      
      <div className="flex flex-col justify-center gap-2">
        {/* label status */}
        <span className="text-sm font-black uppercase tracking-widest" style={{ color: loading ? G.textMuted : color }}>
          {loading ? '...' : label}
        </span>
        {/* projeção */}
        {!loading && projected !== null && (
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: G.textMuted }}>
              Projeção final
            </span>
            <span className="text-base font-black" style={{
              color: projected > 80 ? G.success : projected > 50 ? G.warning : G.danger,
            }}>
              {Math.round(projected)}%
            </span>
          </div>
        )}

        {/* aviso: indústrias sem vendas */}
        {!loading && semVendas.length > 0 && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: G.warning,
            background: `${G.warning}15`, border: `1px solid ${G.warning}30`,
            borderRadius: 6, padding: '2px 6px', lineHeight: 1.5,
          }}>
            ⚠ {semVendas.length} ind. com R$ 0
          </div>
        )}

        {/* botão de ajuda */}
        <button
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: G.textMuted, display: 'flex', alignItems: 'center', marginTop: 4 }}
        >
          <Info size={13} />
        </button>
      </div>

      {/* tooltip */}
      {showTip && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 9999,
          background: G.text, color: '#fff', borderRadius: 10, padding: '12px 14px',
          width: 280, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8, color: G.mustardHi, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Como é calculado
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: '#cbd5e1' }}>
            <b style={{ color: '#fff' }}>% da Meta</b> — resultado <b style={{ color: G.mustardHi }}>consolidado</b> de todas as indústrias:<br />
            <span style={{ fontFamily: 'monospace', fontSize: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 6px', display: 'inline-block', margin: '4px 0' }}>
              Σ vendas de todas as indústrias ÷ Σ metas × 100
            </span><br />
            <span style={{ color: '#fbbf24' }}>⚠ Atenção:</span> uma indústria com resultado muito acima da meta (ex: 500%) eleva o percentual geral e pode mascarar outras com vendas zeradas. Consulte a tela de <b style={{ color: '#fff' }}>Metas</b> para ver o desempenho individual por indústria.<br /><br />
            <b style={{ color: '#fff' }}>Projeção Final</b> — extrapola o ritmo atual até o fim do mês:<br />
            <span style={{ fontFamily: 'monospace', fontSize: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 6px', display: 'inline-block', margin: '4px 0' }}>
              % atingido ÷ (dias passados ÷ dias do mês)
            </span><br />
            Exemplo: 60% atingido no dia 15 de 30 → projeção de 120%.
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { label: 'Excelente', range: '≥ 95%', color: G.success },
              { label: 'Bom',       range: '> 80%', color: '#0EA5E9' },
              { label: 'Satisfatório', range: '> 50%', color: G.warning },
              { label: 'Crítico',   range: '≤ 50%', color: G.danger  },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ color: '#fff', fontWeight: 700 }}>{s.label}</span>
                <span style={{ color: '#94a3b8' }}>{s.range} da meta</span>
              </div>
            ))}
          </div>

          {/* breakdown por indústria */}
          {industries.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Por indústria</span>
                <span style={{ color: G.mustardHi }}>
                  {month ? `${MONTHS_SHORT[month - 1]} ${year}` : `Ano ${year}`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {industries
                  .slice()
                  .sort((a, b) => Number(b.total_faturamento || 0) - Number(a.total_faturamento || 0))
                  .map((ind: any) => {
                    const fat  = Number(ind.total_faturamento || 0);
                    const meta = Number(ind.total_meta || 0);
                    const p    = meta > 0 ? Math.round((fat / meta) * 100) : null;
                    const semV = fat === 0 && meta > 0;
                    return (
                      <div key={ind.industria_codigo || ind.for_codigo} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: semV ? G.danger : p !== null && p >= 95 ? G.success : p !== null && p > 50 ? G.warning : '#94a3b8', flexShrink: 0 }} />
                        <span style={{ color: semV ? '#fca5a5' : '#fff', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                          {ind.industria_nome || ind.for_nomered}
                        </span>
                        <span style={{ color: semV ? '#fca5a5' : '#94a3b8', fontWeight: semV ? 800 : 400, flexShrink: 0 }}>
                          {semV ? 'R$ 0' : p !== null ? `${p}%` : 'sem meta'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          {/* seta */}
          <div style={{ position: 'absolute', bottom: -6, left: 20, width: 12, height: 12, background: G.text, transform: 'rotate(45deg)', borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
};

// ─── KPI LINE (sem caixa, só texto) ──────────────────────────────────────────
const KPI_TIPS: Record<string, string> = {
  'Volume de Itens': 'Quantidade total de itens vendidos no período selecionado.',
  'Clientes Ativos': 'Total de clientes com pelo menos 1 pedido (P/F) no período.',
  'Ticket Médio': 'Valor médio por pedido no período (faturamento ÷ nº de pedidos).',
};

// Mini-card de KPI (grid 2×2 — compacto pra ganhar vertical em telas de notebook)
const KpiLine = ({ label, value, mom, loading }: {
  label: string; value: string; mom?: number; loading?: boolean;
}) => (
  <div className="rounded-xl px-3 py-2.5" style={{ border: `1px solid ${G.border}`, background: G.card }}
    title={KPI_TIPS[label] || label}>
    <p className="text-[10px] font-bold uppercase tracking-wider mb-1 truncate" style={{ color: G.textMuted }}>{label}</p>
    {loading
      ? <div className="h-6 w-16 rounded animate-pulse" style={{ background: G.cardHi }} />
      : (
        <div className="flex items-end justify-between gap-1">
          <p className="text-xl font-black leading-none" style={{ color: G.text }}>{value}</p>
          {mom !== undefined && (
            <span title={`Variação vs mês anterior: ${mom >= 0 ? '+' : ''}${Number(mom).toFixed(1)}%`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 6,
              background: mom >= 0 ? '#16A34A22' : '#C0392B22',
              color: mom >= 0 ? G.success : G.danger,
              border: `1px solid ${mom >= 0 ? '#16A34A44' : '#C0392B44'}`,
            }}>
              {mom >= 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
              {Math.abs(Number(mom)).toFixed(1)}%
            </span>
          )}
        </div>
      )}
  </div>
);


// ─── INSIGHT MODAL ────────────────────────────────────────────────────────────
const InsightModal = ({ isOpen, onClose, data }: {
  isOpen: boolean; onClose: () => void;
  data: {
    Icon: React.ElementType; color: string; title: string; type: string; impact: string;
    description: string; problem: string; solution: string; formula: string;
    visualExample: string; alertTrigger: string;
    typeClassName: string; impactClassName: string;
  } | null;
}) => {
  if (!isOpen || !data) return null;
  const { Icon } = data;
  return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{ background: G.card, border: `1px solid rgba(40,55,74,0.12)` }}
          className="relative rounded-2xl overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}>
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: data.color }} />
          <div className="p-6" style={{ borderBottom: `1px solid ${G.border}` }}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${data.color}15`, border: `1px solid ${data.color}30` }}>
                  <Icon size={18} style={{ color: data.color }} />
                </div>
                <div>
                  <div className="flex gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${data.typeClassName}`}>{data.type}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${data.impactClassName}`}>{data.impact}</span>
                  </div>
                  <h2 className="text-xl font-black" style={{ color: G.text }}>{data.title}</h2>
                </div>
              </div>
              <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(40,55,74,0.06)', color: G.textSec }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,55,74,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,55,74,0.06)'; }}>
                <X size={13} /> Fechar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: G.textSec }}>{data.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(248,81,73,0.07)', border: '1px solid rgba(248,81,73,0.15)' }}>
                <div className="flex items-center gap-2 mb-2"><X size={13} style={{ color: G.danger }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: G.danger }}>Problema</span></div>
                <p className="text-sm leading-relaxed" style={{ color: G.textSec }}>{data.problem}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(63,185,80,0.07)', border: '1px solid rgba(63,185,80,0.15)' }}>
                <div className="flex items-center gap-2 mb-2"><Check size={13} style={{ color: G.success }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: G.success }}>Ação</span></div>
                <p className="text-sm leading-relaxed" style={{ color: G.textSec }}>{data.solution}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl relative overflow-hidden"
              style={{ background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.2)' }}>
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: G.mustard }} />
              <span className="text-xs font-bold uppercase tracking-wider block mb-1 ml-3" style={{ color: G.textMuted }}>Gatilho de Decisão</span>
              <span className="text-sm font-bold ml-3" style={{ color: G.mustard }}>{data.alertTrigger}</span>
            </div>
          </div>
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: `1px solid ${G.border}` }}>
            <LineChartIcon size={13} style={{ color: G.mustard }} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-tight" style={{ color: G.textMuted }}>SOFTHAM AI AGENT · Commercial Intelligence V2</span>
          </div>
        </motion.div>
      </motion.div>
  );
};

// ─── WHATSAPP CONVERSAS MODAL ────────────────────────────────────────────────
const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  aguardando_humano: { label: 'Aguardando',    color: '#F59E0B' },
  humano_ativo:      { label: 'Em atendimento',color: '#3B82F6' },
  ia_ativa:          { label: 'IRIS ativa',    color: '#10B981' },
  nova:              { label: 'Nova',           color: '#94A3B8' },
  encerrada:         { label: 'Encerrada',      color: '#CBD5E1' },
};

const WppConversasModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [conversas,      setConversas]      = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [filtro,         setFiltro]         = useState('');
  const [detail,         setDetail]         = useState<any>(null);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const msgsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) { setDetail(null); setFiltro(''); return; }
    setLoading(true);
    api.get('/whatsapp/conversas?limit=100')
      .then(r => setConversas(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (detail) setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [detail]);

  if (!isOpen) return null;

  const openDetail = (c: any) => {
    setLoadingDetail(true);
    api.get(`/whatsapp/conversas/${c.id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  };

  const lista = filtro
    ? conversas.filter(c => {
        const q = filtro.toLowerCase();
        return (c.nome_informado || c.nome_push || c.telefone || '').toLowerCase().includes(q)
            || (c.empresa || '').toLowerCase().includes(q)
            || (c.resumo_ia || '').toLowerCase().includes(q);
      })
    : conversas;

  const aguardando = conversas.filter(c => c.estado === 'aguardando_humano').length;

  // ── Bolha de mensagem ───────────────────────────────────────────────────────
  const Bubble = ({ msg }: { msg: any }) => {
    const isLead = msg.remetente === 'lead';
    const isIA   = msg.remetente === 'ia';
    const hora   = msg.created_at
      ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <div className={`flex ${isLead ? 'justify-start' : 'justify-end'} mb-2`}>
        {isLead && (
          <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black mr-1.5 self-end"
            style={{ background: '#E2E8F0', color: '#64748B' }}>
            <Phone size={10} />
          </div>
        )}
        <div style={{
          maxWidth: '75%', padding: '8px 12px', borderRadius: isLead ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          background: isLead ? '#fff' : isIA ? `${G.success}18` : `${G.blue}18`,
          border: `1px solid ${isLead ? G.border : isIA ? `${G.success}30` : `${G.blue}30`}`,
        }}>
          {!isLead && (
            <div className="flex items-center gap-1 mb-1">
              {isIA ? <Bot size={10} style={{ color: G.success }} /> : <UserCircle size={10} style={{ color: G.blue }} />}
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: isIA ? G.success : G.blue }}>
                {isIA ? 'IRIS' : 'Humano'}
              </span>
            </div>
          )}
          <p className="text-xs leading-relaxed" style={{ color: G.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {msg.conteudo}
          </p>
          <span className="text-[9px] block mt-1 text-right" style={{ color: G.textMuted }}>{hora}</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ background: G.card, border: `1px solid rgba(40,55,74,0.12)` }}
        className="relative rounded-2xl overflow-hidden w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: G.success }} />

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${G.border}` }}>
          <div className="flex items-center gap-2.5">
            {detail ? (
              <button onClick={() => setDetail(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity"
                style={{ background: `${G.success}15`, border: `1px solid ${G.success}30` }}>
                <ChevronLeft size={15} style={{ color: G.success }} />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${G.success}15`, border: `1px solid ${G.success}30` }}>
                <MessageCircle size={15} style={{ color: G.success }} />
              </div>
            )}
            <div>
              {detail ? (
                <>
                  <h2 className="text-sm font-black" style={{ color: G.text }}>
                    {detail.nome_informado || detail.nome_push || detail.telefone}
                  </h2>
                  <span className="text-[10px] font-bold" style={{ color: G.textMuted }}>
                    {detail.telefone}{detail.empresa ? ` · ${detail.empresa}` : ''}
                  </span>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-black" style={{ color: G.text }}>WhatsApp IA — Conversas</h2>
                  {aguardando > 0 && (
                    <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>{aguardando} aguardando resposta</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {detail && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                style={{ background: `${(ESTADO_LABEL[detail.estado] ?? { color: '#94A3B8' }).color}18`, color: (ESTADO_LABEL[detail.estado] ?? { color: '#94A3B8' }).color }}>
                {(ESTADO_LABEL[detail.estado] ?? { label: detail.estado }).label}
              </span>
            )}
            <button onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'rgba(40,55,74,0.06)', color: G.textSec }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,55,74,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,55,74,0.06)'; }}>
              <X size={13} /> Fechar
            </button>
          </div>
        </div>

        {/* ── DETALHE DA CONVERSA ────────────────────────────────────────────── */}
        {detail ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Resumo IA */}
            {detail.resumo_ia && (
              <div className="px-5 py-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${G.border}`, background: `${G.success}08` }}>
                <div className="flex items-start gap-2">
                  <Bot size={12} style={{ color: G.success, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-[11px] leading-relaxed" style={{ color: G.textSec }}>
                    <span className="font-black" style={{ color: G.success }}>Resumo IRIS: </span>
                    {detail.resumo_ia}
                  </p>
                </div>
              </div>
            )}
            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: G.bg }}>
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: G.success, borderTopColor: 'transparent' }} />
                </div>
              ) : (detail.mensagens || []).length === 0 ? (
                <p className="text-center text-xs py-8" style={{ color: G.textMuted }}>Nenhuma mensagem registrada.</p>
              ) : (
                (detail.mensagens || []).map((msg: any) => <Bubble key={msg.id} msg={msg} />)
              )}
              <div ref={msgsEndRef} />
            </div>
          </div>
        ) : (
          /* ── LISTA DE CONVERSAS ────────────────────────────────────────────── */
          <>
            <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${G.border}` }}>
              <input value={filtro} onChange={e => setFiltro(e.target.value)}
                placeholder="Buscar por nome, empresa ou assunto..."
                className="w-full text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: G.bg, border: `1px solid ${G.border}`, color: G.text }} />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: G.success, borderTopColor: 'transparent' }} />
                </div>
              ) : lista.length === 0 ? (
                <p className="text-center text-xs py-10" style={{ color: G.textMuted }}>
                  {filtro ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ativa no momento.'}
                </p>
              ) : (
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
                  {lista.map((c: any) => {
                    const nome    = c.nome_informado || c.nome_push || c.telefone || '?';
                    const inicial = nome[0].toUpperCase();
                    const hora    = c.ultima_msg_at
                      ? new Date(c.ultima_msg_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const estado       = ESTADO_LABEL[c.estado] ?? { label: c.estado, color: '#94A3B8' };
                    const isAguardando = c.estado === 'aguardando_humano';
                    return (
                      <button key={c.id} onClick={() => openDetail(c)}
                        className="w-full px-5 py-3.5 flex items-start gap-3 hover:opacity-80 transition-opacity text-left"
                        style={{ borderColor: G.border, background: isAguardando ? `${G.success}06` : 'transparent' }}>
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
                          style={{ background: `${estado.color}20`, color: estado.color }}>
                          {inicial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <span className="text-xs font-bold truncate" style={{ color: G.text }}>{nome}</span>
                            <span className="text-[10px] font-mono flex-shrink-0" style={{ color: G.textMuted }}>{hora}</span>
                          </div>
                          {c.empresa && <span className="text-[10px] font-semibold block mb-0.5" style={{ color: G.textMuted }}>{c.empresa}</span>}
                          {c.resumo_ia && <span className="text-[11px] truncate block" style={{ color: G.textSec }}>{c.resumo_ia}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                            style={{ background: `${estado.color}18`, color: estado.color }}>
                            {estado.label}
                          </span>
                          <ChevronRight size={12} style={{ color: G.textMuted }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${G.border}`, background: G.cardHi }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: G.textMuted }}>
                {lista.length} conversa{lista.length !== 1 ? 's' : ''}
              </span>
              <Link to="/utilitarios/whatsapp-ia" onClick={onClose}
                className="flex items-center gap-1.5 text-xs font-black transition-opacity hover:opacity-80"
                style={{ color: G.success }}>
                Abrir WhatsApp IA completo <ChevronRight size={12} />
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── INSIGHT DRAWER ──────────────────────────────────────────────────────────
const fmtBRLd = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDateBR = (d: string) => {
  if (!d) return '–';
  const dateOnly = String(d).substring(0, 10);
  return new Date(dateOnly + 'T00:00:00').toLocaleDateString('pt-BR');
};

type DrawerTipo = 'burnout' | 'concentracao' | 'ativacao' | 'crescendo' | 'gap';

const DRAWER_META: Record<DrawerTipo, { title: string; subtitle: string; color: string; Icon: React.ElementType }> = {
  burnout:      { title: 'Burnout — Clientes em Risco', subtitle: 'Compraram no mês passado, mas não neste mês', color: '#f97316', Icon: Flame },
  concentracao: { title: 'Concentração de Carteira',    subtitle: 'Participação de cada cliente no faturamento', color: G.danger,  Icon: ShieldAlert },
  ativacao:     { title: 'Ativação Real',               subtitle: 'Status de cada cliente pelo tempo sem pedido',color: G.success, Icon: Target },
  crescendo:    { title: 'Tendência 90 dias',           subtitle: 'Comparativo últimos 90d vs 90d anteriores',  color: G.blue,    Icon: TrendingUp },
  gap:          { title: 'Gap Cross-sell por Indústria',subtitle: 'Clientes que não compram de cada indústria', color: G.teal,    Icon: Factory },
};

// ─── IRIS STATUS BAR ─────────────────────────────────────────────────────────
const IRIS_MESSAGES_BASE = [
  'Monitorando sua carteira em tempo real',
  'Sincronizando emails e cotações',
  'Analisando oportunidades de cross-sell',
  'Verificando clientes sem compra recente',
  'Processando dados de pedidos pendentes',
];

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function IrisStatusBar({ aniversariosMes = [] }: { aniversariosMes?: any[] }) {
  const [msgIdx, setMsgIdx] = useState(0);

  const messages = useMemo(() => {
    const msgs = [...IRIS_MESSAGES_BASE];
    if (aniversariosMes.length > 0) {
      const mesNome = MESES[new Date().getMonth()];
      const nomes = aniversariosMes.slice(0, 3).map((a: any) => `${a.con_nome.split(' ')[0]} (dia ${a.dia})`).join(', ');
      const sufixo = aniversariosMes.length > 3 ? ` e mais ${aniversariosMes.length - 3}` : '';
      msgs.splice(1, 0, `🎂 ${aniversariosMes.length} aniversariante${aniversariosMes.length > 1 ? 's' : ''} em ${mesNome} — ${nomes}${sufixo}`);
    }
    return msgs;
  }, [aniversariosMes]);

  useEffect(() => {
    setMsgIdx(0);
    const t = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages]);

  const isBirthday = messages[msgIdx]?.startsWith('🎂');

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      height: 34, flexShrink: 0,
      background: G.text,
      display: 'flex', alignItems: 'center',
      paddingLeft: 18, paddingRight: 18,
      gap: 10,
    }}>
      {/* scanning bar */}
      <div className="iris-scan-bar" style={{
        position: 'absolute', top: 0, bottom: 0,
        width: '28%', pointerEvents: 'none',
        background: isBirthday
          ? 'linear-gradient(90deg, transparent 0%, rgba(236,72,153,0.13) 35%, rgba(236,72,153,0.28) 50%, rgba(236,72,153,0.13) 65%, transparent 100%)'
          : 'linear-gradient(90deg, transparent 0%, rgba(255,210,0,0.13) 35%, rgba(255,210,0,0.32) 50%, rgba(255,210,0,0.13) 65%, transparent 100%)',
      }} />

      {/* dot */}
      <div className="iris-dot-pulse" style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: isBirthday ? '#EC4899' : G.mustard,
        boxShadow: isBirthday ? '0 0 6px 2px rgba(236,72,153,0.6)' : `0 0 6px 2px rgba(255,210,0,0.6)`,
      }} />

      {/* label */}
      <span style={{ fontSize: 10, fontWeight: 900, color: isBirthday ? '#EC4899' : G.mustard, letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 0 }}>
        IRIS
      </span>

      <span style={{ fontSize: 10, color: 'rgba(232,225,212,0.35)', flexShrink: 0 }}>·</span>

      {/* rotating message */}
      <motion.span
        key={msgIdx}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.35 }}
        style={{ fontSize: 10, fontWeight: 600, color: isBirthday ? 'rgba(236,72,153,0.85)' : 'rgba(232,225,212,0.55)', letterSpacing: 0.4 }}
      >
        {messages[msgIdx]}
      </motion.span>
    </div>
  );
}

const InsightDrawer = ({
  tipo, data, loading, onClose, redeData = [],
}: {
  tipo: DrawerTipo | null; data: any[]; loading: boolean; onClose: () => void; redeData?: any[];
}) => {
  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    if (tipo === 'ativacao') setActiveTab('Ativo');
    else if (tipo === 'crescendo') setActiveTab('Crescendo');
    else if (tipo === 'concentracao') setActiveTab('Individual');
    else setActiveTab('');
  }, [tipo]);

  if (!tipo) return null;
  const meta = DRAWER_META[tipo];
  const Icon = meta.Icon;

  const tabStyle = (active: boolean) => ({
    padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
    cursor: 'pointer', border: 'none', transition: 'all .15s',
    background: active ? G.text : 'transparent',
    color: active ? G.card : G.textMuted,
  } as React.CSSProperties);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-2 mt-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: G.card }} />
          ))}
        </div>
      );
    }
    if (!data.length) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Users size={32} style={{ color: G.textMuted }} />
          <p className="text-sm font-bold" style={{ color: G.textMuted }}>Nenhum dado encontrado</p>
        </div>
      );
    }

    if (tipo === 'burnout') {
      return (
        <div className="space-y-2 mt-1">
          {data.map((c: any, i: number) => (
            <div key={c.cli_codigo} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: G.card, border: `1px solid ${G.border}` }}>
              <span className="text-xs font-black w-6 text-right flex-shrink-0" style={{ color: G.textMuted }}>{i+1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: G.text }}>{c.cli_nome}</p>
                <p className="text-xs" style={{ color: G.textMuted }}>
                  Último pedido: {fmtDateBR(c.ultimo_pedido)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-black" style={{ color: G.danger }}>{c.dias_sem_pedido}d</span>
                <p className="text-xs truncate" style={{ color: G.textMuted, maxWidth: 120 }}>{c.ultima_industria || 'sem pedido'}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (tipo === 'concentracao') {
      const tabs = ['Individual', 'Rede de Lojas'];
      const isRede = activeTab === 'Rede de Lojas';
      const items = isRede ? redeData : data;
      const maxTotal = items[0]?.total || 1;

      return (
        <div>
          <div className="flex gap-1.5 mb-3">
            {tabs.map(t => (
              <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
                {t} <span style={{ opacity: 0.7 }}>({(t === 'Rede de Lojas' ? redeData : data).length})</span>
              </button>
            ))}
          </div>
          {!items.length ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users size={28} style={{ color: G.textMuted }} />
              <p className="text-sm font-bold" style={{ color: G.textMuted }}>
                {isRede ? 'Nenhuma rede de lojas cadastrada' : 'Nenhum dado encontrado'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((c: any, i: number) => {
                const barW = Math.round((c.total / maxTotal) * 100);
                const name = isRede ? c.grupo_nome : c.cli_nome;
                const key = isRede ? c.grupo_nome : c.cli_codigo;
                return (
                  <div key={key} className="px-3 py-2.5 rounded-xl"
                    style={{ background: G.card, border: `1px solid ${G.border}` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-black w-5 text-right" style={{ color: G.textMuted }}>{i+1}</span>
                      <span className="text-xs font-bold flex-1 truncate" style={{ color: G.text }}>{name}</span>
                      {isRede && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: `${G.blue}15`, color: G.blue, border: `1px solid ${G.blue}25` }}>
                          {c.lojas} loja{c.lojas > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-xs font-black" style={{ color: i < 3 ? G.danger : G.textSec }}>
                        {parseFloat(c.pct_total).toFixed(1)}%
                      </span>
                      <span className="text-xs font-bold" style={{ color: G.textSec }}>{fmtBRLd(parseFloat(c.total))}</span>
                    </div>
                    <div className="ml-7 h-1.5 rounded-full overflow-hidden" style={{ background: `${G.border}60` }}>
                      <div className="h-full rounded-full" style={{
                        width: `${barW}%`,
                        background: i < 3 ? G.danger : i < 8 ? G.warning : G.success,
                      }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-center pt-2" style={{ color: G.textMuted }}>
                Top 3 concentram {items.slice(0,3).reduce((s: number, c: any) => s + parseFloat(c.pct_total||0), 0).toFixed(1)}% do faturamento
              </p>
            </div>
          )}
        </div>
      );
    }

    if (tipo === 'ativacao') {
      const tabs = ['Ativo', 'Dormindo', 'Inativo'];
      const filtered = activeTab ? data.filter((c: any) => c.status === activeTab) : data;
      const counts = tabs.reduce((acc: any, t) => { acc[t] = data.filter((c: any) => c.status === t).length; return acc; }, {});
      const tabColors: Record<string, string> = { Ativo: G.success, Dormindo: G.warning, Inativo: G.danger };
      return (
        <div>
          <div className="flex gap-1.5 mb-3">
            {tabs.map(t => (
              <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
                {t} <span style={{ opacity: 0.7 }}>({counts[t]})</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            {filtered.map((c: any) => (
              <div key={c.cli_codigo} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: G.card, border: `1px solid ${G.border}` }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: tabColors[c.status] || G.textMuted }} />
                <span className="text-xs font-bold flex-1 truncate" style={{ color: G.text }}>{c.cli_nome}</span>
                <span className="text-xs" style={{ color: G.textMuted }}>{fmtDateBR(c.ultimo_pedido)}</span>
                <span className="text-xs font-black" style={{ color: tabColors[c.status] || G.textMuted }}>
                  {c.dias_sem_pedido}d
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (tipo === 'crescendo') {
      const tabs = ['Crescendo', 'Em Queda', 'Estável', 'Novo'];
      const filtered = activeTab ? data.filter((c: any) => c.tendencia === activeTab) : data;
      const counts = tabs.reduce((acc: any, t) => { acc[t] = data.filter((c: any) => c.tendencia === t).length; return acc; }, {});
      const trendColor = (t: string) => t === 'Crescendo' ? G.success : t === 'Em Queda' ? G.danger : t === 'Estável' ? G.blue : G.purple;
      return (
        <div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {tabs.map(t => (
              <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
                {t} <span style={{ opacity: 0.7 }}>({counts[t]})</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            {filtered.map((c: any) => (
              <div key={c.cli_codigo} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: G.card, border: `1px solid ${G.border}` }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: trendColor(c.tendencia) }} />
                <span className="text-xs font-bold flex-1 truncate" style={{ color: G.text }}>{c.cli_nome}</span>
                <span className="text-xs" style={{ color: G.textSec }}>{fmtBRLd(parseFloat(c.total_atual||0))}</span>
                {c.delta_pct !== null && (
                  <span className="text-xs font-black" style={{ color: trendColor(c.tendencia) }}>
                    {parseFloat(c.delta_pct) >= 0 ? '+' : ''}{parseFloat(c.delta_pct).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (tipo === 'gap') {
      return (
        <div className="space-y-3 mt-1">
          {data.map((ind: any) => (
            <div key={ind.for_codigo} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${G.border}` }}>
              <div className="flex items-center justify-between px-3 py-2.5"
                style={{ background: G.card }}>
                <div>
                  <p className="text-xs font-black" style={{ color: G.text }}>{ind.for_nomered}</p>
                  <p className="text-xs" style={{ color: G.textMuted }}>
                    {ind.compra} compram · <span style={{ color: G.danger }}>{ind.gap_count} não compram</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black" style={{ color: G.danger }}>{ind.gap_count}</span>
                  <p className="text-xs" style={{ color: G.textMuted }}>gap</p>
                </div>
              </div>
              {ind.clientes_sem_compra?.length > 0 && (
                <div className="px-3 py-2 space-y-1" style={{ borderTop: `1px solid ${G.border}`, background: G.bg }}>
                  {ind.clientes_sem_compra.slice(0, 8).map((c: any) => (
                    <p key={c.cli_codigo} className="text-xs truncate" style={{ color: G.textSec }}>• {c.cli_nome}</p>
                  ))}
                  {ind.clientes_sem_compra.length > 8 && (
                    <p className="text-xs" style={{ color: G.textMuted }}>
                      + {ind.clientes_sem_compra.length - 8} outros...
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100]"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}>
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 flex flex-col overflow-hidden"
          style={{
            width: 480, background: G.bg, borderLeft: `1px solid ${G.border}`,
            boxShadow: '-20px 0 60px rgba(0,0,0,0.15)',
          }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: `1px solid ${G.border}`, background: G.card }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}>
              <Icon size={16} style={{ color: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black truncate" style={{ color: G.text }}>{meta.title}</h3>
              <p className="text-xs truncate" style={{ color: G.textMuted }}>{meta.subtitle}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all flex-shrink-0"
              style={{ color: G.textMuted, border: `1px solid ${G.border}` }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${G.border}50`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}>
              <X size={14} />
            </button>
          </div>

          {/* Count badge */}
          {!loading && (tipo === 'concentracao' ? (data.length > 0 || redeData.length > 0) : data.length > 0) && (
            <div className="px-5 py-2.5 flex items-center gap-2"
              style={{ borderBottom: `1px solid ${G.border}`, background: `${meta.color}08` }}>
              <Users size={12} style={{ color: meta.color }} />
              <span className="text-xs font-bold" style={{ color: meta.color }}>
                {tipo === 'gap'
                  ? `${data.length} indústrias com gap`
                  : tipo === 'concentracao'
                    ? `${data.length} clientes · ${redeData.length} redes`
                    : `${data.length} clientes`}
              </span>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
            {renderContent()}
          </div>
        </motion.div>
      </motion.div>
  );
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Metrics {
  total_vendido_current: number;
  quantidade_vendida_current: number;
  clientes_atendidos_current: number;
  ticket_medio_current: number;
  vendas_mom: number; vendas_yoy: number;
  quantidade_mom: number; quantidade_yoy: number;
  clientes_mom: number; clientes_yoy: number;
  ticket_mom: number; ticket_yoy: number;
}
interface Industry { for_codigo: number; for_nomered: string; }
interface Client   { value: string; label: string; }

// ─── PORTAL HOME ─────────────────────────────────────────────────────────────
const PortalHome = () => {
  const { user } = useAuthStore();

  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [year,               setYear]               = useState(currentYear);
  const [month,              setMonth]              = useState<number | null>(currentMonth);
  const [industryId,         setIndustryId]         = useState('');
  const [clientId,           setClientId]           = useState('');
  const [clientSearch,       setClientSearch]       = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [timelineTab,        setTimelineTab]        = useState<'fat' | 'qtd'>('fat');

  const [industries,      setIndustries]      = useState<Industry[]>([]);
  const [clients,         setClients]         = useState<Client[]>([]);
  const [metrics,         setMetrics]         = useState<Metrics | null>(null);
  const [industryRevenue, setIndustryRevenue] = useState<any[]>([]);
  const [insights,        setInsights]        = useState<any>(null);
  const [salesComp,       setSalesComp]       = useState<any[]>([]);
  const [qtdComp,         setQtdComp]         = useState<any[]>([]);

  const [loadingMetrics,  setLoadingMetrics]  = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [loadingCharts,   setLoadingCharts]   = useState(true);
  const [modalData,       setModalData]       = useState<any>(null);
  const [drawerTipo,      setDrawerTipo]      = useState<DrawerTipo | null>(null);
  const [drawerData,      setDrawerData]      = useState<any[]>([]);
  const [concRedeData,    setConcRedeData]    = useState<any[]>([]);
  const [loadingDrawer,   setLoadingDrawer]   = useState(false);
  const [agendaResumo,          setAgendaResumo]          = useState<any>(null);
  const [emailResumo,           setEmailResumo]           = useState<any>(null);
  const [crmDash,               setCrmDash]               = useState<any>(null);
  const [wppResumo,             setWppResumo]             = useState<any>(null);
  const [showAniversariosModal, setShowAniversariosModal] = useState(false);
  const [showAnivPeriodoModal,  setShowAnivPeriodoModal]  = useState(false);
  const [showWppModal,          setShowWppModal]          = useState(false);

  // Estado do modal de aniversariantes por período (independente do modal mensal)
  const today = new Date();
  const in30  = new Date(); in30.setDate(in30.getDate() + 30);
  const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  const [anivPeriodoInicio, setAnivPeriodoInicio] = useState(toYMD(today));
  const [anivPeriodoFim,    setAnivPeriodoFim]    = useState(toYMD(in30));
  const [anivPeriodoData,   setAnivPeriodoData]   = useState<any[]>([]);
  const [anivPeriodoLoading,setAnivPeriodoLoading]= useState(false);
  const [anivPeriodoBuscou, setAnivPeriodoBuscou] = useState(false);

  const buscarAnivPeriodo = useCallback(async () => {
    if (!anivPeriodoInicio || !anivPeriodoFim) return;
    setAnivPeriodoLoading(true);
    try {
      const r = await api.get('/agenda/aniversariantes-periodo', {
        params: { data_inicial: anivPeriodoInicio, data_final: anivPeriodoFim },
      });
      setAnivPeriodoData(r.data?.data || []);
      setAnivPeriodoBuscou(true);
    } catch (e) {
      console.error('Erro ao buscar aniversariantes por período:', e);
      setAnivPeriodoData([]);
    } finally {
      setAnivPeriodoLoading(false);
    }
  }, [anivPeriodoInicio, anivPeriodoFim]);

  const exportAnivPeriodoXlsx = () => {
    if (!anivPeriodoData.length) return;
    const ws = XLSX.utils.json_to_sheet(anivPeriodoData.map((a: any) => ({
      Data:    a.data_aniv,
      Nome:    a.con_nome,
      Empresa: a.empresa,
      Rede:    a.cli_redeloja || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aniversariantes');
    const fname = `aniversariantes_${anivPeriodoInicio}_${anivPeriodoFim}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const h        = now.getHours();
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.nome?.split(' ')[0] || 'Usuário';

  const YEARS = [2022, 2023, 2024, 2025, 2026];
  const MONTHS = [
    { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' }, { v: 4, l: 'Abr' },
    { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' }, { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' },
    { v: 9, l: 'Set' }, { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
  ].filter(m => year < currentYear || m.v <= currentMonth);

  const params = useCallback(() => {
    const p = new URLSearchParams({ ano: String(year) });
    if (month) p.append('mes', String(month));
    if (industryId && industryId !== 'ALL') p.append('for_codigo', industryId);
    if (clientId   && clientId   !== 'ALL') p.append('cli_codigo', clientId);
    return p.toString();
  }, [year, month, industryId, clientId]);

  const openInsightDrawer = useCallback(async (tipo: DrawerTipo) => {
    setDrawerTipo(tipo);
    setDrawerData([]);
    setConcRedeData([]);
    setLoadingDrawer(true);
    try {
      const p = new URLSearchParams({ tipo, ano: String(year) });
      if (month) p.append('mes', String(month));
      if (industryId && industryId !== 'ALL') p.append('for_codigo', industryId);
      const r = await api.get(`/dashboard/insight-detail?${p.toString()}`);
      if (r.data.success) {
        if (tipo === 'concentracao' && r.data.data?.individual) {
          setDrawerData(r.data.data.individual || []);
          setConcRedeData(r.data.data.rede || []);
        } else {
          setDrawerData(Array.isArray(r.data.data) ? r.data.data : []);
        }
      }
    } catch (err) {
      console.error('insight-detail error', err);
    } finally {
      setLoadingDrawer(false);
    }
  }, [year, month, industryId]);

  const fetchEmailResumo = useCallback(() => {
    api.get('/email-central/resumo').then(r => r.data.success && setEmailResumo(r.data)).catch(() => {});
  }, []);

  const syncEmailsSilencioso = useCallback(() => {
    api.post('/email-central/sync').catch(() => {}); // fire & forget
  }, []);

  const fetchWpp = useCallback(() => {
    api.get('/whatsapp/resumo-portal').then(r => r.data.success && setWppResumo(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/dashboard/industries-list').then(r => r.data.success && setIndustries(r.data.data)).catch(console.error);
    api.get('/clients?limit=1000').then(r => {
      if (r.data.success) setClients(r.data.data.map((c: any) => ({ value: String(c.cli_codigo), label: c.cli_nomred || c.cli_nome })));
    }).catch(console.error);
    api.get('/agenda/resumo').then(r => r.data.success && setAgendaResumo(r.data.data)).catch(() => {});
    const venCodigo = (user as any)?.seller?.ven_codigo ?? (user as any)?.ven_codigo;
    const crmP = venCodigo ? `?ven_codigo=${venCodigo}` : '';
    api.get(`/crm/dashboard${crmP}`).then(r => r.data.success && setCrmDash(r.data.data)).catch(() => {});
    fetchWpp();

    // Email Central: sync + leitura ao carregar dashboard
    syncEmailsSilencioso();
    fetchEmailResumo();

    // Timer de email: sync + leitura a cada 2 minutos
    const emailTimer = setInterval(() => {
      syncEmailsSilencioso();
      fetchEmailResumo();
    }, 2 * 60 * 1000);

    return () => clearInterval(emailTimer);
  }, [fetchEmailResumo, syncEmailsSilencioso, fetchWpp]);

  // Timer dedicado ao WhatsApp: atualiza a cada 60 segundos
  useEffect(() => {
    const wppTimer = setInterval(fetchWpp, 60 * 1000);
    return () => clearInterval(wppTimer);
  }, [fetchWpp]);

  useEffect(() => {
    const p = params();
    setLoadingMetrics(true);
    api.get(`/dashboard/metrics?${p}`).then(r => r.data.success && setMetrics(r.data.data)).catch(console.error).finally(() => setLoadingMetrics(false));
    api.get(`/dashboard/industry-revenue?${p}`).then(r => r.data.success && setIndustryRevenue(r.data.data || [])).catch(console.error);
    setLoadingInsights(true);
    api.get(`/dashboard/aura-insights?${p}`).then(r => r.data.success && setInsights(r.data.data)).catch(console.error).finally(() => setLoadingInsights(false));

    const cp = new URLSearchParams({ anoAtual: String(year), anoAnterior: String(year - 1) });
    if (industryId && industryId !== 'ALL') cp.append('for_codigo', industryId);
    if (clientId   && clientId   !== 'ALL') cp.append('cli_codigo', clientId);
    const cps = cp.toString();

    setLoadingCharts(true);
    Promise.all([
      api.get(`/dashboard/sales-comparison?${cps}`),
      api.get(`/dashboard/quantities-comparison?${cps}`),
    ]).then(([sr, qr]) => {
      if (sr.data.success && Array.isArray(sr.data.data))
        setSalesComp(sr.data.data.map((i: any) => ({ mes: (i.mes_nome || '???').substring(0, 3), atual: Number(i.vendas_ano_atual || 0) / 1000, anterior: Number(i.vendas_ano_anterior || 0) / 1000 })));
      if (qr.data.success && Array.isArray(qr.data.data))
        setQtdComp(qr.data.data.map((i: any) => ({ mes: (i.mes_nome || '???').substring(0, 3), atual: parseFloat(i.quantidade_ano_atual || 0), anterior: parseFloat(i.quantidade_ano_anterior || 0) })));
    }).catch(console.error).finally(() => setLoadingCharts(false));
  }, [year, month, industryId, clientId, params]);

  const fmt    = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const fmtBRL = (v: number) => `R$ ${fmt(v)}`;
  const filteredClients     = clients.filter(c => c.label.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 60);
  const selectedClientLabel = clients.find(c => c.value === clientId)?.label;

  // ─── META STATS (% atingida + projeção) ────────────────────────────────────
  const metaStats = useMemo(() => {
    // Só inclui indústrias com meta cadastrada: sem meta = não entra no cálculo
    // (indústrias com meta > 0 e vendas = 0 puxam o % pra baixo corretamente)
    const comMeta   = industryRevenue.filter(r => Number(r.total_meta || 0) > 0);
    const totalFat  = comMeta.reduce((s, r) => s + Number(r.total_faturamento || 0), 0);
    const totalMeta = comMeta.reduce((s, r) => s + Number(r.total_meta || 0), 0);
    const pct = totalMeta > 0 ? (totalFat / totalMeta) * 100 : 0;

    // Projeção: só faz sentido quando o mês selecionado é o mês atual
    let projected: number | null = null;
    if (month !== null && year === currentYear && month === currentMonth) {
      const totalDays = new Date(year, month, 0).getDate(); // dias no mês
      const today     = now.getDate();
      if (today > 0 && pct > 0) {
        projected = Math.min((pct / (today / totalDays)), 200); // cap 200%
      }
    }

    return { pct, projected };
  }, [industryRevenue, month, year, currentYear, currentMonth]);

  // ─── ALERTAS CRÍTICOS (máx 2) ─────────────────────────────────────────────
  const criticalAlerts = useMemo(() => {
    if (!insights) return [];
    const list: { msg: string; icon: React.ElementType; color: string; helpKey: string }[] = [];
    const burn = insights.risco_inativacao?.count || 0;
    if (burn > 0) list.push({ msg: `${burn} clientes sem pedido este mês`, icon: Flame, color: G.danger, helpKey: 'burnout' });
    const conc = insights.concentracao?.value || 0;
    if (conc > 60) list.push({ msg: `Concentração crítica: ${conc}% nos Top 3 clientes`, icon: ShieldAlert, color: G.warning, helpKey: 'concentracao' });
    return list.slice(0, 2);
  }, [insights]);

  // ─── INSIGHT HELP ──────────────────────────────────────────────────────────
  const insightHelp: Record<string, any> = {
    burnout: {
      Icon: Flame, color: '#f97316', type: 'Risco Inatividade', impact: 'Perda Imediata', title: 'Burnout Rate',
      typeClassName: 'bg-orange-500/10 text-orange-400 border-orange-500/20', impactClassName: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
      description: 'Clientes que compraram no mês passado mas ainda não realizaram pedidos neste mês.',
      problem: 'A perda de recorrência sinaliza insatisfação ou avanço da concorrência.',
      solution: 'Ligue hoje para entender por que não houve pedido.',
      formula: 'Inatividade detectada no ciclo mensal', visualExample: '32 clientes = R$ 45k em risco',
      alertTrigger: 'Qualquer aumento vs média histórica',
    },
    concentracao: {
      Icon: ShieldAlert, color: G.danger, type: 'Risco da Carteira', impact: 'Impacto ALTO', title: 'Concentração',
      typeClassName: 'bg-red-500/10 text-red-400 border-red-500/20', impactClassName: 'bg-red-500/15 text-red-300 border-red-500/25',
      description: '% do faturamento que vem dos 3 maiores clientes.',
      problem: 'Se um deles reduzir compras, o impacto é devastador.',
      solution: 'Diversifique focando em clientes médios com potencial.',
      formula: 'Top 3 clientes / Faturamento total × 100', visualExample: 'Top 3 = 71% do faturamento',
      alertTrigger: 'Se > 60%, risco alto de dependência',
    },
    ativacao: {
      Icon: Target, color: G.success, type: 'Monitor de Retenção', impact: 'Saúde Operacional', title: 'Ativação Real',
      typeClassName: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', impactClassName: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
      description: 'Classificação da base pelo tempo desde a última compra.',
      problem: 'Muitos Dormindo/Inativo indicam falha no ciclo de acompanhamento.',
      solution: 'Régua de relacionamento para clientes > 60 dias sem compra.',
      formula: 'Ativo < 60d · Dormindo 60–120d · Inativo > 120d', visualExample: '70% Ativos · 20% Dormindo · 10% Inativos',
      alertTrigger: 'Inativos > 20% da base',
    },
    predictability: {
      Icon: RefreshCw, color: G.purple, type: 'Ciclo de Recompra', impact: 'Previsibilidade', title: 'Predictability',
      typeClassName: 'bg-purple-500/10 text-purple-400 border-purple-500/20', impactClassName: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
      description: 'Tempo médio em dias entre pedidos.',
      problem: 'Clientes acima do ciclo médio em 20% estão em atraso.',
      solution: 'Contato proativo 2-3 dias antes do vencimento.',
      formula: 'Média de dias entre transações consecutivas', visualExample: 'Ciclo 21d → alerta no dia 25',
      alertTrigger: 'Atraso > 20% do ciclo individual',
    },
    tendencia: {
      Icon: TrendingUp, color: G.success, type: 'Saúde dos Clientes', impact: 'Crescimento Base', title: 'Tendência 90d',
      typeClassName: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', impactClassName: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
      description: 'Compara faturamento dos últimos 90 dias com o período anterior.',
      problem: 'Tendência negativa indica erosão da base.', solution: 'Visitas de recuperação nas contas em queda.',
      formula: 'Variação % do volume trimestral', visualExample: '+15% vs trimestre anterior',
      alertTrigger: 'Tendência < -10%',
    },
    mix: {
      Icon: PieChartIcon, color: G.purple, type: 'Cobertura Portfolio', impact: 'Cross-Selling', title: 'Mix Pro',
      typeClassName: 'bg-purple-500/10 text-purple-400 border-purple-500/20', impactClassName: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
      description: 'Distribuição dos clientes pelas marcas que consomem.',
      problem: 'Clientes mono-marca são vulneráveis à concorrência.', solution: 'Cross-sell de indústrias complementares.',
      formula: 'Marcas distintas ativas no faturamento', visualExample: '45% dos clientes compram 1 marca',
      alertTrigger: 'Concentração em clientes mono-marca',
    },
    gap: {
      Icon: Target, color: G.teal, type: 'Oportunidade Cross', impact: 'Potencial de Venda', title: 'Gap Indústria',
      typeClassName: 'bg-teal-500/10 text-teal-400 border-teal-500/20', impactClassName: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
      description: 'Potencial de faturamento vendendo uma marca a quem ainda não compra.',
      problem: 'Cross-sell negligenciado deixa dinheiro na mesa.', solution: 'Ofereça a marca certa para o cliente certo.',
      formula: 'Diferencial vs média regional', visualExample: "R$ 12k de Gap na 'SOFTHAM Cosméticos'",
      alertTrigger: 'Gap total > R$ 50k',
    },
    ranking: {
      Icon: Factory, color: G.blue, type: 'Produtos Estrela', impact: 'Foco de Mix', title: 'Ranking Top 5',
      typeClassName: 'bg-blue-500/10 text-blue-400 border-blue-500/20', impactClassName: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
      description: 'Os 5 itens mais vendidos e sua participação no faturamento.',
      problem: 'Dependência de poucos SKUs é arriscada.', solution: 'Monitore ruptura e introduza complementares.',
      formula: 'Participação relativa no total vendido', visualExample: 'Item X = 22% do faturamento',
      alertTrigger: 'Top 1 SKU acima de 25%',
    },
  };

  const inp = { background: G.card, border: `1px solid ${G.border}`, color: G.text };


  // Timeline
  const tlData   = timelineTab === 'fat' ? salesComp : qtdComp;
  const tlColor1 = timelineTab === 'fat' ? G.mustard   : G.purple;
  const tlColor2 = timelineTab === 'fat' ? G.blue   : G.teal;
  const tlFmt    = timelineTab === 'fat' ? (v: number) => `R$${v}k` : (v: number) => v.toLocaleString();

  const exportAniversariosXlsx = () => {
    const todos = (agendaResumo?.aniversarios_mes || []) as any[];
    const todayMonth = new Date().getMonth() + 1;
    const mesStr = String(todayMonth).padStart(2, '0');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const ws = XLSX.utils.json_to_sheet(todos.map((a: any) => ({
      Data:    `${String(a.dia).padStart(2, '0')}/${mesStr}`,
      Nome:    a.con_nome,
      Empresa: a.empresa || '',
      Tipo:    a.origem === 'industria' ? 'Indústria' : 'Cliente',
    })));
    ws['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 35 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Aniversários ${meses[todayMonth - 1]}`);
    XLSX.writeFile(wb, `Aniversariantes_${meses[todayMonth - 1]}_${new Date().getFullYear()}.xlsx`);
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: G.bg }}>
      <PortalStyles />

      {/* Modal Aniversariantes do mês */}
      {showAniversariosModal && agendaResumo?.aniversarios_mes && (() => {
        const todos = Array.from(
          // dedup: clientes pela rede (cli_redeloja); contatos de indústria por empresa+origem
          new Map((agendaResumo.aniversarios_mes as any[]).map((a: any) => [`${a.origem || 'cliente'}|${a.con_nome?.trim().toUpperCase()}|${(a.cli_redeloja || a.empresa || '').trim().toUpperCase()}`, a])).values()
        );
        const todayDay  = new Date().getDate();
        const todayMon  = new Date().getMonth() + 1;
        const meses     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowAniversariosModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ background: G.card, border: `1px solid ${G.border}` }}
              className="relative rounded-2xl overflow-hidden w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              {/* barra rosa no topo */}
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: '#EC4899' }} />
              {/* header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${G.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EC489915', border: '1px solid #EC489930' }}>
                    <Cake size={16} style={{ color: '#EC4899' }} />
                  </div>
                  <div>
                    <h2 className="text-base font-black" style={{ color: G.text }}>
                      Aniversariantes de {meses[todayMon - 1]}
                    </h2>
                    <p className="text-xs" style={{ color: G.textMuted }}>{todos.length} pessoa{todos.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={exportAniversariosXlsx}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: '#EC489915', color: '#EC4899', border: '1px solid #EC489930' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#EC489925')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#EC489915')}>
                    <ArrowUpRight size={12} />
                    Exportar Excel
                  </button>
                  <button onClick={() => setShowAniversariosModal(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: 'transparent', border: `1px solid ${G.border}`, color: G.textMuted }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,55,74,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              {/* grid */}
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${G.border}`, background: `${G.bg}` }}>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted, width: 70 }}>Data</th>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted }}>Nome</th>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted }}>Empresa</th>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted, width: 90 }}>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todos.map((a: any, i: number) => {
                      const isHoje = a.dia === todayDay;
                      const diaStr = `${String(a.dia).padStart(2, '0')}/${String(todayMon).padStart(2, '0')}`;
                      return (
                        <tr key={i}
                          style={{
                            borderBottom: `1px solid ${G.border}`,
                            background: isHoje ? '#EC489908' : 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = isHoje ? '#EC489912' : 'rgba(40,55,74,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = isHoje ? '#EC489908' : 'transparent')}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isHoje && <span style={{ fontSize: 13 }}>🎂</span>}
                              <span className="font-bold" style={{ color: isHoje ? '#EC4899' : G.textSec }}>{diaStr}</span>
                              {isHoje && (
                                <span className="text-[9px] font-black px-1 py-0.5 rounded"
                                  style={{ background: '#EC489920', color: '#EC4899' }}>HOJE</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-bold" style={{ color: G.text }}>{a.con_nome}</td>
                          <td className="px-4 py-2.5" style={{ color: G.textSec }}>{a.empresa || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                              style={{
                                background: a.origem === 'industria' ? `${G.purple}15` : `${G.teal}15`,
                                color: a.origem === 'industria' ? G.purple : G.teal,
                                border: `1px solid ${a.origem === 'industria' ? G.purple : G.teal}30`,
                              }}>
                              {a.origem === 'industria' ? 'Indústria' : 'Cliente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}

      {/* Modal Aniversariantes por Período (filtro custom) */}
      {showAnivPeriodoModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowAnivPeriodoModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: G.card, border: `1px solid ${G.border}` }}
            className="relative rounded-2xl overflow-hidden w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* barra rosa no topo */}
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: '#EC4899' }} />
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${G.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EC489915', border: '1px solid #EC489930' }}>
                  <Cake size={16} style={{ color: '#EC4899' }} />
                </div>
                <div>
                  <h2 className="text-base font-black" style={{ color: G.text }}>Aniversariantes por período</h2>
                  <p className="text-xs" style={{ color: G.textMuted }}>
                    {anivPeriodoBuscou
                      ? `${anivPeriodoData.length} pessoa${anivPeriodoData.length !== 1 ? 's' : ''} no período`
                      : 'Escolha o intervalo e clique em Buscar'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {anivPeriodoData.length > 0 && (
                  <button onClick={exportAnivPeriodoXlsx}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: '#EC489915', color: '#EC4899', border: '1px solid #EC489930' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#EC489925')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#EC489915')}>
                    <ArrowUpRight size={12} />
                    Exportar Excel
                  </button>
                )}
                <button onClick={() => setShowAnivPeriodoModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'transparent', border: `1px solid ${G.border}`, color: G.textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,55,74,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* filtros */}
            <div className="flex flex-wrap items-end gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${G.border}`, background: G.bg }}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: G.textMuted }}>De</label>
                <input type="date" value={anivPeriodoInicio}
                  onChange={e => setAnivPeriodoInicio(e.target.value)}
                  className="h-9 rounded-lg px-3 text-xs font-bold outline-none"
                  style={{ border: `1px solid ${G.border}`, background: G.card, color: G.text }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: G.textMuted }}>Até</label>
                <input type="date" value={anivPeriodoFim}
                  onChange={e => setAnivPeriodoFim(e.target.value)}
                  className="h-9 rounded-lg px-3 text-xs font-bold outline-none"
                  style={{ border: `1px solid ${G.border}`, background: G.card, color: G.text }} />
              </div>
              <button onClick={buscarAnivPeriodo}
                disabled={anivPeriodoLoading || !anivPeriodoInicio || !anivPeriodoFim}
                className="h-9 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                style={{ background: '#EC4899', color: '#fff' }}>
                {anivPeriodoLoading ? 'Buscando...' : 'Buscar'}
              </button>
              {/* atalhos rápidos */}
              <div className="flex items-center gap-1 ml-auto">
                {[
                  { label: '7d',   days: 7 },
                  { label: '30d',  days: 30 },
                  { label: '90d',  days: 90 },
                ].map(p => (
                  <button key={p.label}
                    onClick={() => {
                      const d1 = new Date();
                      const d2 = new Date(); d2.setDate(d2.getDate() + p.days);
                      setAnivPeriodoInicio(toYMD(d1));
                      setAnivPeriodoFim(toYMD(d2));
                    }}
                    className="text-[10px] font-bold px-2 py-1 rounded-md transition-all"
                    style={{ background: 'transparent', color: G.textMuted, border: `1px solid ${G.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,55,74,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* grid */}
            <div className="overflow-y-auto flex-1">
              {!anivPeriodoBuscou && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Cake size={32} style={{ color: G.textMuted, opacity: 0.5 }} />
                  <p className="text-xs font-bold" style={{ color: G.textMuted }}>
                    Defina o período e clique em Buscar
                  </p>
                </div>
              )}
              {anivPeriodoBuscou && anivPeriodoData.length === 0 && !anivPeriodoLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-xs font-bold" style={{ color: G.textMuted }}>
                    Nenhum aniversariante encontrado no período selecionado.
                  </p>
                </div>
              )}
              {anivPeriodoData.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${G.border}`, background: G.bg }}>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted, width: 70 }}>Data</th>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted }}>Nome</th>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted }}>Empresa</th>
                      <th className="text-left px-4 py-2.5 font-bold" style={{ color: G.textMuted, width: 110 }}>Rede</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anivPeriodoData.map((a: any, i: number) => {
                      const todayDay = new Date().getDate();
                      const todayMon = new Date().getMonth() + 1;
                      const isHoje   = a.dia === todayDay && a.mes === todayMon;
                      return (
                        <tr key={i}
                          style={{
                            borderBottom: `1px solid ${G.border}`,
                            background: isHoje ? '#EC489908' : 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = isHoje ? '#EC489912' : 'rgba(40,55,74,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = isHoje ? '#EC489908' : 'transparent')}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isHoje && <span style={{ fontSize: 13 }}>🎂</span>}
                              <span className="font-bold" style={{ color: isHoje ? '#EC4899' : G.textSec }}>{a.data_aniv}</span>
                              {isHoje && (
                                <span className="text-[9px] font-black px-1 py-0.5 rounded"
                                  style={{ background: '#EC489920', color: '#EC4899' }}>HOJE</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-bold" style={{ color: G.text }}>{a.con_nome}</td>
                          <td className="px-4 py-2.5" style={{ color: G.textSec }}>{a.empresa || '—'}</td>
                          <td className="px-4 py-2.5" style={{ color: G.textMuted }}>{a.cli_redeloja || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      <main className="flex-1 overflow-y-auto scrollbar-hide">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-50 px-8 pt-6 pb-0"
          style={{ background: `${G.bg}ec`, backdropFilter: 'blur(20px)', borderBottom: `1px solid rgba(40,55,74,0.06)` }}>
          <div className="flex items-start justify-between mb-5">
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-3xl font-black tracking-tight" style={{ color: G.text }}>
                {greeting}, <span className="uppercase">{firstName}</span>
                <span style={{ color: G.mustard }}> ✦</span>
              </h1>
              <p className="text-xs font-mono font-bold mt-1.5 uppercase tracking-widest" style={{ color: G.textMuted }}>
                {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </motion.div>

            {/* Filtros compactos */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
              {/* INDÚSTRIA */}
              <select value={industryId} onChange={e => setIndustryId(e.target.value)}
                className="h-9 rounded-xl px-3 pr-8 text-xs font-bold outline-none cursor-pointer"
                style={{ ...inp, minWidth: 170, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%233d444d' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                <option value="" style={{ background: G.card }}>Todas as indústrias</option>
                {industries.map(ind => <option key={ind.for_codigo} value={String(ind.for_codigo)} style={{ background: G.card }}>{ind.for_nomered}</option>)}
              </select>
              {/* CLIENTE */}
              <div className="relative">
                <input value={clientSearch || selectedClientLabel || ''} placeholder="Todos os clientes"
                  onChange={e => { setClientSearch(e.target.value); setClientId(''); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)} onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  className="h-9 rounded-xl px-3 pr-8 text-xs font-bold outline-none cursor-pointer"
                  style={{
                    ...inp, minWidth: 220,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2020/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%233d444d' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  }} />
                {showClientDropdown && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full mt-1 left-0 right-0 rounded-2xl shadow-2xl overflow-hidden z-[60] max-h-[220px] overflow-y-auto"
                      style={{ background: G.card, border: `1px solid ${G.border}` }}>
                      <div className="px-3 py-2 text-xs font-bold cursor-pointer" style={{ color: G.textSec, borderBottom: `1px solid ${G.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.background = `rgba(40,55,74,0.06)`)} onMouseLeave={e => (e.currentTarget.style.background = '')}
                        onMouseDown={() => { setClientId(''); setClientSearch(''); setShowClientDropdown(false); }}>Todos os Clientes</div>
                      {filteredClients.map(c => (
                        <div key={c.value} className="px-3 py-2 text-xs font-bold cursor-pointer" style={{ color: G.text }}
                          onMouseEnter={e => (e.currentTarget.style.background = `rgba(40,55,74,0.06)`)} onMouseLeave={e => (e.currentTarget.style.background = '')}
                          onMouseDown={() => { setClientId(c.value); setClientSearch(''); setShowClientDropdown(false); }}>
                          {c.label}
                        </div>
                      ))}
                    </motion.div>
                  )}
              </div>
              {/* ANO */}
              <div className="flex p-0.5 rounded-xl h-9 items-center gap-0.5"
                style={{ background: G.card, border: `1px solid ${G.border}` }}>
                {YEARS.map(y => (
                  <button key={y} onClick={() => { setYear(y); if (month && y === currentYear && month > currentMonth) setMonth(null); }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={year === y ? { background: G.text, color: G.card } : { color: G.textSec }}>
                    {y}
                  </button>
                ))}
              </div>
              </div>
              {/* MÊS — linha própria */}
              <div className="flex p-0.5 rounded-xl h-9 items-center gap-0.5"
                style={{ background: G.card, border: `1px solid ${G.border}` }}>
                {MONTHS.map(m => (
                  <button key={m.v} onClick={() => setMonth(month === m.v ? null : m.v)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={month === m.v ? { background: G.text, color: G.card } : { color: G.textSec }}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTEÚDO ─────────────────────────────────────────────────────── */}
        <div className="px-8 pt-7 pb-24 space-y-7">

          {/* Banner de notícias movido pro rodapé da coluna central (destaque que força leitura) */}

          {/* Banner de alerta crítico */}
          {!loadingInsights && criticalAlerts.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 px-5 py-3 rounded-2xl"
                style={{ background: 'rgba(248,81,73,0.07)', border: '1px solid rgba(248,81,73,0.18)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: G.danger }} />
                <span className="text-xs font-black uppercase tracking-widest flex-shrink-0" style={{ color: G.danger }}
                  title="Alertas críticos que precisam de ação imediata para evitar perda de clientes ou receita.">Atenção</span>
                <div className="flex gap-5 flex-wrap">
                  {criticalAlerts.map((a, i) => {
                    const Icon = a.icon;
                    const drawerKey = a.helpKey === 'burnout' ? 'burnout' : a.helpKey === 'concentracao' ? 'concentracao' : null;
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        <button onClick={() => drawerKey && openInsightDrawer(drawerKey as DrawerTipo)}
                          className="flex items-center gap-2 text-xs font-bold transition-opacity hover:opacity-70"
                          style={{ color: G.textSec }}>
                          <Icon size={13} style={{ color: a.color }} />
                          {a.msg}
                          <Users size={11} style={{ color: G.textMuted }} />
                        </button>
                        <button onClick={() => setModalData(insightHelp[a.helpKey])}
                          className="transition-opacity hover:opacity-70"
                          title="Saiba mais">
                          <Info size={11} style={{ color: G.textMuted }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          {/* Aniversariantes (hoje + mês) fundidos no card de Consultas da coluna central */}

          {/* ── ZONA PRINCIPAL ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-12 gap-6">

            {/* Centro-esq: faturamento hero + timeline — col 5 */}
            <div className="col-span-5 flex flex-col gap-6">

              {/* Faturamento hero & Meta Ring */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G.textMuted }}
                    title="Total faturado em pedidos com status Positivado (P) e Faturado (F) no período selecionado.">
                    <CalendarIcon size={11} className="inline mr-1.5" />
                    Faturamento · {month ? MONTHS.find(m => m.v === month)?.l : 'Ano'} {year}
                  </p>
                  {loadingMetrics
                    ? <div className="h-14 w-64 rounded-2xl animate-pulse" style={{ background: G.card }} />
                    : (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex flex-col gap-3">
                          <span className="text-6xl font-black tracking-tight leading-none" style={{ color: G.text }}>
                            {fmtBRL(parseFloat(String(metrics?.total_vendido_current || 0)))}
                          </span>
                          <div className="flex gap-2">
                            {metrics?.vendas_mom !== undefined && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 2,
                                fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                                background: metrics.vendas_mom >= 0 ? '#16A34A22' : '#C0392B22',
                                color: metrics.vendas_mom >= 0 ? G.success : G.danger,
                                border: `1px solid ${metrics.vendas_mom >= 0 ? '#16A34A44' : '#C0392B44'}`,
                              }}
                                title="MoM (Month over Month): variação percentual em relação ao mês anterior.">
                                {metrics.vendas_mom >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                {Math.abs(Number(metrics.vendas_mom)).toFixed(1)}% MoM
                              </div>
                            )}
                            {metrics?.vendas_yoy !== undefined && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 2,
                                fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                                background: metrics.vendas_yoy >= 0 ? '#2563EB22' : '#C0392B22',
                                color: metrics.vendas_yoy >= 0 ? G.blue : G.danger,
                                border: `1px solid ${metrics.vendas_yoy >= 0 ? '#2563EB44' : '#C0392B44'}`,
                              }}
                                title="YoY (Year over Year): variação percentual comparada ao mesmo período do ano anterior.">
                                {metrics.vendas_yoy >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                {Math.abs(Number(metrics.vendas_yoy)).toFixed(1)}% YoY
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  }
                </div>

                <div className="flex items-center gap-3 pr-2">
                  {/* Lista de indústrias — lado esquerdo do anel */}
                  {!loadingMetrics && industryRevenue.length > 0 && (
                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 150 }}
                      className="scrollbar-hide">
                      {industryRevenue
                        .slice()
                        .sort((a, b) => Number(b.total_faturamento || 0) - Number(a.total_faturamento || 0))
                        .map((ind: any) => {
                          const fat  = Number(ind.total_faturamento || 0);
                          const meta = Number(ind.total_meta || 0);
                          const pct  = meta > 0 ? Math.round((fat / meta) * 100) : null;
                          const semV = fat === 0 && meta > 0;
                          const semM = meta === 0;
                          const dotColor = semM ? G.textMuted : semV ? G.danger : pct! >= 95 ? G.success : pct! > 50 ? G.warning : G.danger;
                          return (
                            <div key={ind.for_codigo || ind.industria_nome} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, color: G.textSec, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ind.industria_nome}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: semM ? G.textMuted : semV ? G.danger : dotColor }}>
                                {semM ? '—' : semV ? 'R$0' : `${pct}%`}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Anel */}
                  <Link to="/metas" style={{ textDecoration: 'none' }}
                    className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                    title="Ver detalhes das metas">
                    <MetaRing pct={metaStats.pct} projected={metaStats.projected} loading={loadingMetrics} industries={industryRevenue} month={month} year={year} />
                  </Link>
                </div>
              </div>

              {/* Timeline chart */}
              <div style={{ background: G.card, border: `1px solid ${G.border}` }}
                className="rounded-2xl overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${G.border}` }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: G.textMuted }}>
                    {year - 1} vs {year}
                  </p>
                  <div className="flex gap-1 p-0.5 rounded-xl"
                    style={{ background: 'rgba(40,55,74,0.06)', border: `1px solid ${G.border}` }}>
                    {([['fat', 'Faturamento', 'Exibir evolução do faturamento mês a mês'], ['qtd', 'Quantidades', 'Exibir evolução da quantidade de itens vendidos mês a mês']] as const).map(([tab, label, tip]) => (
                      <button key={tab} onClick={() => setTimelineTab(tab)}
                        title={tip}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={timelineTab === tab ? { background: G.text, color: G.bg } : { color: G.textSec }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-4 pt-3 pb-2 h-[160px]">
                  {loadingCharts
                    ? <div className="h-full flex items-center justify-center"><span className="text-xs font-mono" style={{ color: G.textMuted }}>Carregando...</span></div>
                    : (
                      <ResponsiveContainer width="99%" height="100%" debounce={50}>
                        <AreaChart data={tlData} margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                          <defs>
                            <linearGradient id="tl1" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={tlColor1} stopOpacity={0.22} />
                              <stop offset="100%" stopColor={tlColor1} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="tl2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={tlColor2} stopOpacity={0.12} />
                              <stop offset="100%" stopColor={tlColor2} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(40,55,74,0.04)" vertical={false} />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: G.textMuted }} axisLine={false} tickLine={false} dy={6} />
                          <YAxis tick={{ fontSize: 10, fill: G.textMuted }} axisLine={false} tickLine={false} tickFormatter={tlFmt} />
                          <Tooltip content={<DarkTip />} />
                          <Legend verticalAlign="top" align="right" iconType="circle"
                            wrapperStyle={{ paddingBottom: 6, fontSize: 11, fontWeight: 700, color: G.textSec }} />
                          <Area type="monotone" dataKey="atual" stroke={tlColor1} strokeWidth={2.5}
                            fill="url(#tl1)" name={String(year)} dot={false} activeDot={{ r: 4, fill: tlColor1, strokeWidth: 0 }} />
                          <Area type="monotone" dataKey="anterior" stroke={tlColor2} strokeWidth={1.5}
                            strokeDasharray="5 4" fill="url(#tl2)" name={String(year - 1)} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )
                  }
                </div>
              </div>

              {/* ── AGENDA (movida do Central de Comando) ────────────── */}
              <div style={{ background: G.card, border: `1px solid ${G.border}` }} className="rounded-2xl overflow-hidden card-soft">
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${G.border}` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} style={{ color: G.mustard }} />
                      <span className="text-sm font-black" style={{ color: G.text }}
                        title="Resumo dos seus compromissos de hoje. Clique em 'Minha Agenda' para ver detalhes.">Agenda</span>
                    </div>
                    {(agendaResumo?.atrasadas || 0) > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
                        style={{ background: `${G.danger}18`, color: G.danger }}>
                        {agendaResumo.atrasadas} atrasada{agendaResumo.atrasadas > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-3xl font-black leading-none" style={{ color: G.text }}>
                      {agendaResumo?.tarefas_hoje ?? '—'}
                    </span>
                    <span className="text-xs font-bold mb-0.5" style={{ color: '#754437' }}>hoje</span>
                  </div>

                  {/* Birthday badge in agenda widget */}
                  {agendaResumo?.aniversarios_hoje?.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{ background: '#EC489915', border: '1px solid #EC489930' }}>
                      <Cake size={11} style={{ color: '#EC4899' }} />
                      <span className="text-[10px] font-black" style={{ color: '#EC4899' }}>
                        {agendaResumo.aniversarios_hoje.length} niver{agendaResumo.aniversarios_hoje.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-4 py-3">
                  {agendaResumo?.proximo_compromisso ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: G.textMuted }}>Próximo</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-black flex-shrink-0" style={{ color: '#754437' }}>
                          {agendaResumo.proximo_compromisso.hora_inicio
                            ? String(agendaResumo.proximo_compromisso.hora_inicio).substring(0, 5)
                            : 'Dia todo'}
                        </span>
                        <span className="text-xs truncate" style={{ color: G.textSec }}>
                          {agendaResumo.proximo_compromisso.titulo}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: G.textMuted }}>
                      {agendaResumo ? 'Agenda limpa por hoje.' : 'Carregando...'}
                    </p>
                  )}
                </div>
                <Link to="/agenda"
                  className="px-4 py-2.5 flex items-center justify-between hover:opacity-80 transition-opacity"
                  style={{ borderTop: `1px solid ${G.border}`, background: G.cardHi }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: G.textMuted }}>Minha Agenda</span>
                  <ChevronRight size={11} style={{ color: G.mustard }} />
                </Link>
              </div>
            </div>

            {/* Centro-dir: KPIs — col 3 */}
            <div className="col-span-3 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-2 pt-2">
                <KpiLine
                  label="Volume de Itens"
                  value={loadingMetrics ? '...' : fmt(parseFloat(String(metrics?.quantidade_vendida_current || 0)))}
                  mom={metrics?.quantidade_mom}
                  loading={loadingMetrics}
                />
                <KpiLine
                  label="Clientes Ativos"
                  value={loadingMetrics ? '...' : fmt(parseFloat(String(metrics?.clientes_atendidos_current || 0)))}
                  mom={metrics?.clientes_mom}
                  loading={loadingMetrics}
                />
                <KpiLine
                  label="Ticket Médio"
                  value={loadingMetrics ? '...' : fmtBRL(parseFloat(String(metrics?.ticket_medio_current || 0)))}
                  mom={metrics?.ticket_mom}
                  loading={loadingMetrics}
                />
                {/* Burnout — mini-card clicável (abre a lista de clientes em risco) */}
                {loadingInsights ? (
                  <div className="rounded-xl px-3 py-2.5" style={{ border: `1px solid ${G.border}` }}>
                    <div className="h-6 w-14 rounded animate-pulse" style={{ background: G.cardHi }} />
                  </div>
                ) : (() => {
                  const burnout = insights?.risco_inativacao?.count || 0;
                  const crit = burnout > 0;
                  return (
                    <button onClick={() => openInsightDrawer('burnout')}
                      title="Clientes que compraram no mês passado mas ainda não compraram neste mês. Clique para ver a lista."
                      className="rounded-xl px-3 py-2.5 text-left transition-all"
                      style={{ border: `1px solid ${crit ? G.danger + '40' : G.border}`, background: crit ? `${G.danger}0C` : G.card }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = crit ? `${G.danger}18` : 'rgba(40,55,74,0.04)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = crit ? `${G.danger}0C` : G.card; }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: G.textMuted }}>Burnout</span>
                        <span role="button" title="O que é Burnout?"
                          onClick={(e) => { e.stopPropagation(); setModalData(insightHelp.burnout); }}
                          style={{ display: 'inline-flex', color: G.textMuted, cursor: 'help' }}>
                          <Info size={10} />
                        </span>
                      </div>
                      <div className="flex items-end gap-1">
                        <p className="text-xl font-black leading-none" style={{ color: crit ? G.danger : G.success }}>{burnout}</p>
                        <span className="text-[9px] font-bold mb-0.5" style={{ color: G.textMuted }}>críticos</span>
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Atalhos de insight */}
              {!loadingInsights && (
                <div className="space-y-2" style={{ borderTop: `1px solid ${G.border}`, paddingTop: 20 }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G.textMuted }}>Análises</p>
                  {[
                    { key: 'concentracao', drawerKey: 'concentracao' as DrawerTipo, label: 'Concentração', val: `${insights?.concentracao?.value || 0}%`, danger: (insights?.concentracao?.value || 0) > 60,
                      tip: 'Mostra o quanto seu faturamento depende de poucos clientes. Quanto maior o %, maior o risco de perda de receita se um cliente sair.' },
                    { key: 'ativacao',     drawerKey: 'ativacao'     as DrawerTipo, label: 'Ativação', val: `${insights?.ativacao?.find((d: any) => d.name === 'Ativo')?.value || 0} ativos`, danger: false,
                      tip: 'Classifica seus clientes em Ativo (comprou nos últimos 60d), Dormindo (60-120d) e Inativo (+120d). Acompanhe a saúde da sua carteira.' },
                    { key: 'tendencia',    drawerKey: 'crescendo'    as DrawerTipo, label: 'Crescendo', val: `${insights?.saude?.find((d: any) => d.name === 'Crescendo')?.value || 0} clientes`, danger: false,
                      tip: 'Compara o faturamento dos últimos 90 dias com os 90 dias anteriores. Identifica quem está crescendo, em queda, estável ou é novo.' },
                    { key: 'gap',          drawerKey: 'gap'          as DrawerTipo, label: 'Gap cross-sell', val: insights?.gap?.length ? `${insights.gap.length} ind.` : '–', danger: false,
                      tip: 'Identifica clientes ativos que compram de algumas indústrias mas não de outras. Oportunidade para venda cruzada (cross-sell).' },
                  ].map(item => (
                    <button key={item.key} onClick={() => openInsightDrawer(item.drawerKey)}
                      title={item.tip}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                      style={{ border: `1px solid ${G.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,55,74,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <span className="text-xs font-bold" style={{ color: G.textSec }}>{item.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black" style={{ color: item.danger ? G.danger : G.textSec }}>{item.val}</span>
                        <ChevronRight size={11} style={{ color: G.textMuted }} />
                      </div>
                    </button>
                  ))}

                  {/* ── Consultas: Aniversariantes (hoje + mês + período, fundidos num card só) ── */}
                  <p className="text-xs font-bold uppercase tracking-widest mt-4 mb-3" style={{ color: G.textMuted }}>Consultas</p>
                  {(() => {
                    const todayDay   = new Date().getDate();
                    const todayMonth = new Date().getMonth() + 1;
                    const meses      = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
                    const mesLabel   = meses[todayMonth - 1];
                    const todos = Array.from(
                      new Map(((agendaResumo?.aniversarios_mes as any[]) || []).map((a: any) =>
                        [`${a.con_nome?.trim().toUpperCase()}|${a.cli_redeloja || ''}`, a]
                      )).values()
                    );
                    const hoje = todos.filter((a: any) => a.dia === todayDay);
                    return (
                      <div className="w-full rounded-xl px-3.5 py-3" style={{ border: `1px solid ${G.border}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-2">
                            <Cake size={16} style={{ color: '#EC4899' }} />
                            <span className="text-sm font-bold" style={{ color: G.textSec }}>Aniversariantes</span>
                          </span>
                          {todos.length > 0 && (
                            <button onClick={() => setShowAniversariosModal(true)}
                              title={`Ver todos os aniversariantes de ${mesLabel}`}
                              className="text-[13px] font-bold transition-opacity hover:opacity-70"
                              style={{ color: '#EC4899', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              {mesLabel} ({todos.length}) →
                            </button>
                          )}
                        </div>
                        <div className="text-[13px] mb-2.5" style={{ color: hoje.length ? G.textSec : G.textMuted }}>
                          {hoje.length > 0
                            ? <>🎂 Hoje: <strong>{hoje.length <= 2 ? hoje.map((a: any) => a.con_nome).join(', ') : `${hoje.length} aniversariantes`}</strong></>
                            : 'Nenhum aniversário hoje'}
                        </div>
                        <button
                          onClick={() => setShowAnivPeriodoModal(true)}
                          title="Listar aniversariantes em um período personalizado (próximos dias, semana, próximo trimestre, etc.)"
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
                          style={{ border: `1px solid ${G.border}` }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,55,74,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <span className="text-sm font-semibold" style={{ color: G.textSec }}>Buscar por período…</span>
                          <ChevronRight size={13} style={{ color: G.textMuted }} />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── NOVIDADES (card destacado — força o REP a LER) ── */}
              <NoticiasBanner G={G} variant="card" />

            </div>

            {/* ── CENTRAL DE COMANDO — col 4 ─────────────────────────────── */}
            <div className="col-span-4 flex flex-col gap-4">

              {/* Cabeçalho do painel */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={13} style={{ color: G.mustard }} />
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: G.text }}>
                    Central de Comando
                  </span>
                </div>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: G.success }} />
              </div>

              {/* CRM Widget — full width */}
              <div style={{ background: G.card, border: `1px solid ${G.border}` }} className="rounded-2xl overflow-hidden card-soft">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${G.border}` }}>
                  <div className="flex items-center gap-2">
                    <Inbox size={14} style={{ color: G.purple }} />
                    <span className="text-sm font-black" style={{ color: G.text }}>CRM</span>
                    {(crmDash?.followups?.atrasados > 0) && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
                        style={{ background: `${G.danger}18`, color: G.danger }}>
                        {crmDash.followups.atrasados} atrasado{crmDash.followups.atrasados > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {crmDash && (
                      <span className="text-xs font-bold" style={{ color: G.textMuted }}>
                        {crmDash.pipeline.reduce((s: number, e: any) => s + e.total, 0)} oport.
                        · {(crmDash.pipeline.reduce((s: number, e: any) => s + e.valor_total, 0))
                            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pipeline por etapa */}
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${G.border}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: G.textMuted }}>Pipeline de Vendas</p>
                  <div className="flex gap-2 flex-wrap">
                    {(crmDash?.pipeline ?? [
                      { etapa_id: 1, descricao: 'Prospecção',   color: '#60A5FA', total: 0, valor_total: 0 },
                      { etapa_id: 2, descricao: 'Qualificação', color: '#818CF8', total: 0, valor_total: 0 },
                      { etapa_id: 3, descricao: 'Proposta',     color: '#FB923C', total: 0, valor_total: 0 },
                      { etapa_id: 4, descricao: 'Negociação',   color: '#EAB308', total: 0, valor_total: 0 },
                      { etapa_id: 5, descricao: 'Fechamento',   color: '#10B981', total: 0, valor_total: 0 },
                    ]).map((stage: any) => (
                      <Link key={stage.etapa_id} to="/repcrm/pipeline"
                        className="flex-1 min-w-[70px] rounded-xl px-3 py-2 hover:opacity-80 transition-opacity"
                        style={{ background: stage.color + '14', border: `1px solid ${stage.color}30` }}>
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
                          <span className="text-[10px] font-bold truncate" style={{ color: G.textMuted }}>{stage.descricao}</span>
                        </div>
                        <div className="text-lg font-black leading-none" style={{ color: stage.color }}>{stage.total}</div>
                        {stage.valor_total > 0 && (
                          <div className="text-[10px] font-bold mt-0.5" style={{ color: stage.color + 'AA' }}>
                            {stage.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Follow-ups resumo */}
                <div className="px-4 py-3 flex items-center gap-4" style={{ borderBottom: `1px solid ${G.border}` }}>
                  <ListChecks size={13} style={{ color: G.purple, flexShrink: 0 }} />
                  {[
                    { label: 'Atrasados', val: crmDash?.followups?.atrasados ?? '—', color: G.danger },
                    { label: 'Hoje',      val: crmDash?.followups?.hoje      ?? '—', color: G.warning },
                    { label: 'Semana',    val: crmDash?.followups?.semana    ?? '—', color: G.blue },
                    { label: 'Total',     val: crmDash?.followups?.total_pendentes ?? '—', color: G.textMuted },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="text-sm font-black" style={{ color }}>{val}</span>
                      <span className="text-[10px]" style={{ color: G.textMuted }}>{label}</span>
                    </div>
                  ))}
                  <Link to="/repcrm/atividades" className="ml-auto text-[10px] font-bold flex items-center gap-1 hover:opacity-70"
                    style={{ color: G.purple }}>
                    Ver todos <ChevronRight size={10} />
                  </Link>
                </div>

                {/* Ações Rápidas */}
                <div className="px-4 py-3 grid grid-cols-5 gap-2">
                  {[
                    { label: 'Radar',     icon: Radar,       path: '/repcrm/radar',               color: G.purple, tip: 'Radar de oportunidades: identifica clientes com potencial de compra.' },
                    { label: 'Carteira',  icon: Users2,      path: '/repcrm/carteira',            color: G.teal,   tip: 'Visão completa da sua carteira de clientes com status e histórico.' },
                    { label: 'Atividades',icon: ListChecks,  path: '/repcrm/atividades',          color: G.warning, tip: 'Suas tarefas e follow-ups pendentes organizados por prioridade.' },
                    { label: 'Pipeline',  icon: Kanban,      path: '/repcrm/pipeline',            color: '#60A5FA', tip: 'Funil de vendas: acompanhe suas oportunidades em cada etapa.' },
                    { label: 'WhatsApp',  icon: MessageCircle, path: '/utilitarios/whatsapp-ia',  color: G.success, tip: 'WhatsApp IA: envie mensagens inteligentes e gerencie conversas.' },
                  ].map(({ label, icon: Icon, path, color, tip }) => (
                    <Link key={label} to={path}
                      title={tip}
                      className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl hover:opacity-80 transition-opacity"
                      style={{ background: color + '12', border: `1px solid ${color}25` }}>
                      <Icon size={16} style={{ color }} />
                      <span className="text-[10px] font-bold text-center leading-tight" style={{ color: G.textSec }}>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Cards IRIS Dev / IRIS Campanhas removidos: a IRIS Dev agora é o
                  orbe do sidebar + Ctrl+K. IRIS Campanhas fica para a V2. */}

              {/* Email + WhatsApp — 2 colunas */}
              <div className="grid grid-cols-2 gap-4">

                {/* Email */}
                <div style={{ background: G.card, border: `1px solid ${G.border}` }} className="rounded-2xl overflow-hidden card-soft flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: `1px solid ${G.border}` }}>
                    <div className="flex items-center gap-2">
                      <Mail size={14} style={{ color: G.blue }} />
                      <span className="text-sm font-black" style={{ color: G.text }}>E-mails</span>
                    </div>
                    {emailResumo && emailResumo.nao_lidos > 0 && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                        style={{ background: `${G.blue}20`, color: G.blue }}>
                        {emailResumo.nao_lidos} não lido{emailResumo.nao_lidos > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-3 flex-1">
                    {emailResumo?.recentes?.length > 0
                      ? emailResumo.recentes.slice(0, 6).map((email: any) => {
                          const isNovo = email.estado === 'novo';
                          const hora   = email.recebido_em
                            ? new Date(email.recebido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : '';
                          const nome   = email.de_nome || email.de || '—';
                          return (
                            <Link to="/utilitarios/email-central" key={email.id} className="flex items-start gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                                style={{ background: isNovo ? G.blue : G.border }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className="text-xs font-bold truncate"
                                    style={{ color: isNovo ? G.text : G.textSec }}>{nome}</span>
                                  <span className="text-xs font-mono flex-shrink-0" style={{ color: G.textMuted }}>{hora}</span>
                                </div>
                                <span className="text-xs truncate block mt-0.5"
                                  style={{ color: isNovo ? G.textSec : G.textMuted }}>{email.assunto}</span>
                              </div>
                            </Link>
                          );
                        })
                      : (
                        <p className="text-xs text-center py-2" style={{ color: G.textMuted }}>
                          {emailResumo ? 'Nenhum email recente.' : 'Sincronizando...'}
                        </p>
                      )
                    }
                  </div>
                  <Link to="/utilitarios/email-central"
                    className="px-4 py-2.5 flex items-center justify-between hover:opacity-80 transition-opacity"
                    style={{ borderTop: `1px solid ${G.border}`, background: G.cardHi }}>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: G.blue }}>Abrir E-mails</span>
                    <ChevronRight size={12} style={{ color: G.blue }} />
                  </Link>
                </div>

                {/* WhatsApp IA */}
                <div style={{ background: G.card, border: `1px solid ${G.border}` }} className="rounded-2xl overflow-hidden card-soft flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: `1px solid ${G.border}` }}>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={14} style={{ color: G.success }} />
                      <span className="text-sm font-black" style={{ color: G.text }}>WhatsApp IA</span>
                      <div className="relative group">
                        <Info size={12} style={{ color: G.textMuted, cursor: 'help' }} />
                        <div className="absolute left-0 top-5 z-50 hidden group-hover:block w-72 p-3 rounded-xl shadow-xl text-xs leading-relaxed"
                          style={{ background: G.text, color: '#F2ECE2', border: `1px solid rgba(255,255,255,0.1)` }}>
                          <p className="font-black mb-1.5" style={{ color: '#FFD200' }}>Como funciona o WhatsApp IA</p>
                          <p className="mb-1.5">A <strong>IRIS</strong> atende automaticamente clientes e prospects que entram em contato pelo WhatsApp. Ela identifica o interesse, extrai produtos, quantidades e urgência — e só aciona você quando a conversa está pronta para fechamento.</p>
                          <p className="mb-1.5"><strong style={{ color: '#FFD200' }}>Aguardando:</strong> conversas que a IRIS qualificou e estão esperando sua resposta humana.</p>
                          <p><strong style={{ color: '#FFD200' }}>Em atendimento:</strong> conversas que você já assumiu ou a IA está conduzindo ativamente.</p>
                          <p className="mt-1.5 opacity-60">Configure em Utilitários → WhatsApp IA.</p>
                        </div>
                      </div>
                    </div>
                    {(wppResumo?.aguardando > 0) && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                        style={{ background: `${G.success}20`, color: G.success }}>
                        {wppResumo.aguardando} aguardando
                      </span>
                    )}
                  </div>

                  {wppResumo?.sem_acesso ? (
                    <div className="px-4 py-4 text-center flex-1">
                      <span className="text-xs" style={{ color: G.textMuted }}>
                        Seu número não está vinculado a esta instância
                      </span>
                    </div>
                  ) : wppResumo?.conversas?.length > 0 ? (
                    <div className="px-4 py-3 space-y-3 flex-1">
                      {wppResumo.conversas.map((w: any, i: number) => {
                        const aguardando = w.estado === 'aguardando_humano';
                        const hora = w.ultima_msg_at
                          ? new Date(w.ultima_msg_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : '';
                        const preview = w.resumo_ia || (aguardando ? 'Aguardando sua resposta' : 'Conversa em andamento');
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
                              style={{
                                background: aguardando ? `${G.success}25` : `${G.border}`,
                                color: aguardando ? G.success : G.textSec,
                              }}>
                              {(w.nome || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-1">
                                <span className="text-xs font-bold truncate" style={{ color: G.text }}>{w.nome}</span>
                                <span className="text-xs font-mono flex-shrink-0" style={{ color: G.textMuted }}>{hora}</span>
                              </div>
                              <span className="text-xs truncate block mt-0.5" style={{ color: G.textSec }}>{preview}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-center flex-1">
                      <span className="text-xs" style={{ color: G.textMuted }}>
                        {wppResumo ? 'Nenhuma conversa ativa no momento' : 'WhatsApp IA não configurado'}
                      </span>
                    </div>
                  )}

                  <button onClick={() => setShowWppModal(true)}
                    className="px-4 py-2.5 flex items-center justify-between hover:opacity-80 transition-opacity w-full"
                    style={{ borderTop: `1px solid ${G.border}`, background: G.cardHi }}>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: G.success }}>Abrir WhatsApp IA</span>
                    <ChevronRight size={12} style={{ color: G.success }} />
                  </button>
                </div>

              </div>

            </div>
            {/* ── fim CENTRAL DE COMANDO ─────────────────────────────────── */}

          </div>


        </div>

        {/* ── INSIGHT MODAL ─────────────────────────────────────────────── */}
        <InsightModal isOpen={!!modalData} onClose={() => setModalData(null)} data={modalData} />

        {/* ── WHATSAPP CONVERSAS MODAL ───────────────────────────────────── */}
        <WppConversasModal isOpen={showWppModal} onClose={() => setShowWppModal(false)} />

        {/* ── INSIGHT DRAWER ────────────────────────────────────────────── */}
        <InsightDrawer
          tipo={drawerTipo}
          data={drawerData}
          redeData={concRedeData}
          loading={loadingDrawer}
          onClose={() => setDrawerTipo(null)}
        />

      </main>
    </div>
  );
};

export default PortalHome;

// ─── Pergunte à IRIS — teaser com modal persuasivo (ou link funcional no piloto) ──
function PergunteIrisTeaser() {
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore.getState().user;
  // IRIS Dev: Master + IA habilitada (toggle "Acesso à IRIS" do ADM = plano_ia_nivel != INATIVA).
  const irisLive = ['admin', 'superadmin'].includes(user?.role || '') && iaLigada(user?.iaPlanLevel);

  return (
    <>
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1F2D40 0%, #2A3D55 60%, #1E2D40 100%)', border: '1px solid rgba(255,210,0,0.25)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,210,0,0.18)', border: '1px solid rgba(255,210,0,0.35)' }}>
              <Sparkles size={14} style={{ color: '#FFD200' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black" style={{ color: '#E8E1D4' }}>IRIS Dev</span>
                {irisLive ? (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest"
                    style={{ background: 'rgba(22,163,74,0.22)', color: '#22C55E', border: '1px solid rgba(22,163,74,0.35)' }}>BETA · Ativa</span>
                ) : (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest"
                    style={{ background: 'rgba(255,210,0,0.2)', color: '#FFD200' }}>Em breve</span>
                )}
              </div>
              <span className="text-[10px]" style={{ color: '#A8B8C4' }}>Seu desenvolvedor pessoal — peça e ela monta o relatório na hora</span>
            </div>
          </div>
          {irisLive ? (
            <button
              onClick={() => useIrisModal.getState().open()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: '#FFD200', color: '#1A2D42', border: '1px solid #FFD200' }}>
              <Sparkles size={11} />
              Conversar agora
            </button>
          ) : (
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-opacity hover:opacity-80 flex-shrink-0"
              style={{ background: 'rgba(255,210,0,0.15)', color: '#FFD200', border: '1px solid rgba(255,210,0,0.4)' }}>
              <HelpCircle size={11} />
              Ver mais
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 35, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              background: '#F2EDE4', borderRadius: 20,
              border: '1px solid rgba(40,55,74,0.12)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              position: 'relative',
            }}>
            {/* Header */}
            <div style={{
              padding: '22px 26px 18px',
              borderBottom: '1px solid rgba(40,55,74,0.10)',
              background: 'linear-gradient(135deg, rgba(255,210,0,0.10) 0%, transparent 100%)',
              display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16,
            }}>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#B8860B' }}>
                  ✨ Em breve no RepOne
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#28374A', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  O fim do tempo perdido procurando relatório
                </h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 10,
                  background: 'transparent', border: '1px solid rgba(40,55,74,0.18)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                <X size={14} style={{ color: '#5C6675' }} />
              </button>
            </div>

            <div style={{ padding: '24px 26px 28px' }}>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: '#3D4A5C', marginBottom: 18 }}>
                Você nunca mais vai precisar <span style={{ color: '#28374A', fontWeight: 700 }}>caçar relatório</span> em menu.
                A IRIS vira sua <span style={{ color: '#B8860B', fontWeight: 800 }}>gerente comercial pessoal</span>,
                disponível 24h, que responde qualquer pergunta sobre <span style={{ color: '#28374A', fontWeight: 700 }}>seus clientes, suas vendas, suas metas</span> — em segundos.
              </p>

              {/* SEÇÃO PRINCIPAL — relatórios criados dinamicamente */}
              <div style={{
                padding: '22px 22px 18px', borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(255,210,0,0.18) 0%, rgba(255,210,0,0.32) 100%)',
                border: '2px solid #FFD200',
                marginBottom: 18,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: -11, left: 16,
                  padding: '4px 11px', borderRadius: 6,
                  background: '#28374A', color: '#FFD200',
                  fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}>
                  ⭐ O Pulo do Gato
                </div>

                <h3 style={{
                  fontSize: 22, fontWeight: 900, color: '#28374A',
                  marginTop: 4, marginBottom: 6, lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}>
                  NÃO TEM O RELATÓRIO?<br/>
                  <span style={{ color: '#B8860B' }}>A IRIS CRIA AGORA.</span>
                </h3>

                <p style={{ fontSize: 13, color: '#28374A', fontWeight: 700, marginBottom: 14 }}>
                  Você fala. Ela faz. Em segundos.
                </p>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                  gap: '8px 12px', alignItems: 'center', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#5C6675', textTransform: 'uppercase', letterSpacing: 1 }}>Você fala</div>
                  <div></div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#5C6675', textTransform: 'uppercase', letterSpacing: 1 }}>IRIS responde</div>

                  {[
                    ['Matriz indústria × cidade × volume',  'Pronto em 5s'],
                    ['Gráfico dos meus 6 últimos sábados', 'Pronto em 5s'],
                    ['Clientes BA que compram filtro mas não pastilha', 'Pronto em 5s'],
                    ['Curva ABC só dos pagadores até 30d', 'Pronto em 5s'],
                    ['Ranking de queda do trimestre + motivo', 'Pronto em 5s'],
                  ].map(([q, a], i) => (
                    <>
                      <span key={`q-${i}`} style={{ fontSize: 18 }}>🗣️</span>
                      <span key={`t-${i}`} style={{
                        fontSize: 12.5, color: '#28374A', fontWeight: 700,
                        fontStyle: 'italic', lineHeight: 1.3,
                      }}>{q}</span>
                      <span key={`a-${i}`} style={{
                        fontSize: 11, fontWeight: 900, color: '#B8860B',
                        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Sparkles size={10} />{a}
                      </span>
                    </>
                  ))}
                </div>

                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: '#28374A',
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontSize: 12, fontWeight: 900, color: '#FFD200',
                    letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.4,
                  }}>
                    Sem esperar SoftHam · Sem abrir chamado · Sem decorar menu
                  </p>
                </div>
              </div>

              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,210,0,0.08)', border: '1px solid rgba(255,210,0,0.25)',
                marginBottom: 18,
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#B8860B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  E pra perguntas rápidas do dia a dia:
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { q: '"Como tá meu mês? Tô na meta?"',                       a: 'Resumo com gráfico em 3 segundos' },
                    { q: '"Quanto o Domiciano comprou esse ano?"',                a: 'Histórico + tendência + curva ABC' },
                    { q: '"Quais clientes ficaram pra trás na minha rota?"',      a: 'Lista priorizada, com motivo' },
                    { q: '"Que produto da Mahle saiu mais em maio?"',             a: 'Top 10 com volume e ticket' },
                    { q: '"Qual o desconto desse cliente pra IMA?"',              a: 'Política completa + observações' },
                    { q: '"Compara meu top 5 desse ano com o ano passado"',       a: 'Tabela comparativa + insight' },
                  ].map((ex, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, marginTop: 2 }}>
                        <Sparkles size={11} style={{ color: '#B8860B' }} />
                      </span>
                      <div>
                        <p style={{ fontSize: 12, color: '#28374A', fontWeight: 700, lineHeight: 1.4 }}>{ex.q}</p>
                        <p style={{ fontSize: 10, color: '#7C8896', marginTop: 2 }}>→ {ex.a}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#28374A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Por que isso muda seu dia
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { titulo: 'Sem manual',     desc: 'Não precisa decorar onde fica nenhum relatório' },
                    { titulo: 'Sem espera',     desc: 'Sem ligar pro suporte pedindo "como faz pra…"' },
                    { titulo: 'Na sua língua',  desc: 'Entende rolemão, fixão, "tirar pedido"' },
                    { titulo: 'No campo',       desc: 'Funciona no celular durante a visita' },
                    { titulo: 'Tudo agregado',  desc: 'BI + CRM + financeiro respondendo junto' },
                    { titulo: 'Sob medida',     desc: 'Se um relatório não existe, IRIS monta na hora' },
                  ].map((b, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: '#FFFFFF', border: '1px solid rgba(40,55,74,0.10)',
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: '#28374A' }}>{b.titulo}</p>
                      <p style={{ fontSize: 10, color: '#7C8896', marginTop: 3, lineHeight: 1.4 }}>{b.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: '#FFFFFF', border: '1px solid rgba(40,55,74,0.10)',
                display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: 14,
              }}>
                <Flame size={20} style={{ color: '#F59E0B', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#3D4A5C', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 800, color: '#28374A' }}>Esse é o RepOne sem fricção.</span>{' '}
                  Você fala, ela faz. A primeira coisa que você abre de manhã, e a última que fecha à noite.
                </p>
              </div>

              <p style={{ fontSize: 11, color: '#7C8896', textAlign: 'center', fontStyle: 'italic' }}>
                Em desenvolvimento. Aviso aqui quando liberar.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
