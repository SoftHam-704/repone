import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, BarChart2,
  PieChart, Target, Briefcase, Package, AlertTriangle, AlertCircle, X,
  UserX, TrendingDown, Building, HelpCircle, TrendingUp, Filter,
  MousePointerClick, Layers, Sparkles, CheckCircle2, ArrowLeftRight,
} from 'lucide-react';
import { BI, fmtBRL } from './biTokens';
import { PeriodSelector } from './PeriodSelector';
import { BIExtraFilters } from './BIExtraFilters';
import { FilterPills } from './FilterPills';
import { useBIStore, type BITab } from '../store/useBIStore';
import { useAlertasStore, type Alerta } from '@/shared/stores/useAlertasStore';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { api } from '@/shared/lib/api';

// ─── Global CSS para o BI shell — TelaBI Design System ───────────────────────
const BIStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

    :root {
      --bi-cyan:   #00e5d1;
      --bi-purple: #BC66FF;
    }

    body {
      font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif !important;
      background-color: #163242 !important;
      background-image:
        radial-gradient(ellipse at 0% 0%, rgba(17,67,79,0.6) 0%, transparent 55%),
        radial-gradient(ellipse at 100% 100%, rgba(14,51,61,0.4) 0%, transparent 55%) !important;
      background-attachment: fixed !important;
    }

    * { font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif !important; }

    .glass-card {
      background: #104351 !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      box-shadow: 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 24px -14px rgba(0,0,0,0.55) !important;
      transition: background 0.2s cubic-bezier(0.4,0,0.2,1),
                  border-color 0.2s cubic-bezier(0.4,0,0.2,1),
                  box-shadow 0.2s cubic-bezier(0.4,0,0.2,1);
    }

    .glass-card:hover {
      background: #0e3a47 !important;
      border-color: rgba(0,229,209,0.25) !important;
      box-shadow: 0 0 0 1px rgba(0,229,209,0.2), 0 12px 32px rgba(0,0,0,0.5) !important;
    }

    .bi-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
    .bi-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .bi-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(0,229,209,0.2);
      border-radius: 4px;
    }
    .bi-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(0,229,209,0.4);
    }

    .bi-nav-pill {
      transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
      position: relative;
    }

    .bi-nav-pill::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      width: 0;
      height: 2px;
      background: #00e5d1;
      transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
      transform: translateX(-50%);
      box-shadow: 0 0 8px rgba(0,229,209,0.6);
    }

    .bi-nav-pill.active::after { width: 20px; }

    .bi-nav-pill:hover {
      background: rgba(0,229,209,0.08) !important;
      color: #00e5d1 !important;
    }
  `}</style>
);


// ─── Tabs do bottom nav ───────────────────────────────────────────────────────
const TABS: { id: BITab; label: string; Icon: React.ElementType }[] = [
  { id: 'visao-geral',  label: 'Visão Geral',  Icon: LayoutDashboard },
  { id: 'industrias',   label: 'Indústrias',   Icon: Building2 },
  { id: 'clientes',     label: 'Clientes',     Icon: Users },
  { id: 'estatisticas', label: 'Estatísticas', Icon: BarChart2 },
  { id: 'curva-abc',    label: 'Curva ABC',    Icon: PieChart },
  { id: 'metas',        label: 'Metas',        Icon: Target },
  { id: 'equipe',       label: 'Equipe',       Icon: Briefcase },
  { id: 'produtos',     label: 'Produtos',     Icon: Package },
  { id: 'sell-in-out',  label: 'Sell In/Out',  Icon: ArrowLeftRight },
];

// ─── Modal de Ajuda — BI Intelligence ────────────────────────────────────────

function BIHelpModal({ onClose }: { onClose: () => void }) {
  const teal = '#00e5d1', gold = '#FFD200', dim = '#7EB5CC', light = '#E0F2FE', navy = '#0D2137';
  const sec: React.CSSProperties = { marginBottom: 26 };
  const h2: React.CSSProperties = { fontSize: 11, fontWeight: 900, color: teal, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 };
  const p: React.CSSProperties = { fontSize: 12, color: dim, lineHeight: 1.8, marginBottom: 8 };
  const tip = (accent = teal): React.CSSProperties => ({ background: `${accent}0D`, border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: light, lineHeight: 1.75, marginBottom: 8 });
  const stp = (n: number): React.CSSProperties => ({ width: 22, height: 22, borderRadius: '50%', background: teal, color: navy, fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

  const tabs = [
    { label: 'Visão Geral', desc: 'Resumo completo do período: faturamento total, pedidos, clientes ativos, crescimento vs. período anterior, evolução mensal e drill-down por indústria.' },
    { label: 'Indústrias', desc: 'Comparativo de desempenho entre as indústrias representadas. Veja quais cresceram, quais caíram e qual a participação de cada uma no total.' },
    { label: 'Clientes', desc: 'Análise por carteira de clientes: quem comprou mais, quem está inativo, curva ABC, ticket médio e oportunidades de cross-sell.' },
    { label: 'Produtos', desc: 'Ranking de produtos e famílias mais vendidas. Identifique os SKUs campeões e os produtos parados.' },
    { label: 'Curva ABC', desc: 'Classifica clientes e produtos em A (top 20%), B (30%) e C (50% restante). Essencial para priorizar visitas e ações comerciais.' },
    { label: 'Metas', desc: 'Acompanhamento das metas definidas por indústria ou por período.' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(5,15,30,0.8)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101, width: 620, background: '#0A1929', boxShadow: '-8px 0 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${teal}22` }}>

        <div style={{ background: '#0D2137', borderBottom: `1px solid ${teal}22`, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, background: `${teal}22`, border: `1px solid ${teal}44`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={18} color={teal} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>Guia — BI Intelligence</div>
              <div style={{ fontSize: 11, color: dim, marginTop: 1 }}>⚡ Inteligência comercial que guia decisões</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: `${teal}11`, border: `1px solid ${teal}22`, borderRadius: 8, cursor: 'pointer', padding: '6px 8px', color: dim, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          <div style={sec}>
            <div style={h2}><Sparkles size={12} color={teal} /> O que é o BI Intelligence?</div>
            <p style={p}>O BI (Business Intelligence) é o <strong style={{ color: light }}>painel de análise comercial</strong> do RepOne. Ele transforma todos os pedidos em indicadores visuais para que o representante e o gestor tomem decisões baseadas em dados reais — não em intuição.</p>
            <p style={p}>O BI <strong style={{ color: light }}>não exige nenhum lançamento manual</strong> — ele lê automaticamente tudo que foi pedido, faturado e cancelado no sistema.</p>
          </div>

          <div style={sec}>
            <div style={h2}><Filter size={12} color={teal} /> Como usar os Filtros</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { rotulo: 'Ano (2023 / 2024 / 2025 / 2026)', desc: 'Selecione um ou mais anos para comparar. Clicar em "Ano todo" remove o filtro de mês.' },
                { rotulo: 'Meses (Jan / Fev / ... / Dez)', desc: 'Filtre por meses específicos dentro do(s) ano(s) selecionado(s). Útil para analisar sazonalidade.' },
                { rotulo: 'Todas Indústrias', desc: 'Restringir a análise a uma única indústria. O drill-down e todos os gráficos filtram por ela.' },
                { rotulo: 'Todos Clientes', desc: 'Focar em um único cliente para ver o histórico completo de relacionamento com todas as indústrias.' },
                { rotulo: 'Métrica (R$ / Qtd / SKU)', desc: 'Alterna entre valor financeiro, quantidade de peças ou diversidade de SKUs vendidos.' },
              ].map(f => (
                <div key={f.rotulo} style={{ display: 'flex', gap: 10, padding: '9px 12px', background: 'rgba(0,229,209,0.04)', borderRadius: 8, border: `1px solid ${teal}1A` }}>
                  <div style={{ minWidth: 180, fontWeight: 900, fontSize: 11, color: teal }}>{f.rotulo}</div>
                  <div style={{ fontSize: 12, color: dim, lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><MousePointerClick size={12} color={teal} /> Drill-Down — Como navegar pelos dados</div>
            <p style={p}>O drill-down é o recurso mais poderoso do BI. Ele permite <strong style={{ color: light }}>clicar em qualquer barra ou item para aprofundar a análise</strong>, indo do mais geral ao mais específico.</p>
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', marginBottom: 14, overflowX: 'auto' }}>
              {['Indústrias', 'Meses', 'Clientes', 'Famílias', 'SKUs'].map((nivel, i, arr) => (
                <div key={nivel} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ padding: '8px 14px', background: i === 0 ? `${teal}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? teal : teal + '33'}`, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: teal, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nível {i + 1}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: light, marginTop: 2 }}>{nivel}</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ padding: '0 6px', color: dim, fontSize: 14 }}>›</div>}
                </div>
              ))}
            </div>
            <div style={tip()}>
              <strong style={{ color: teal }}>Exemplo prático:</strong> Clique na IMA → veja os meses em que mais vendeu → clique em Abril → veja quais clientes compraram → clique na Auto Peças Silva → veja as famílias de produto → clique em Rolamentos → veja cada SKU vendido com quantidade e valor.
            </div>
            <p style={{ ...p, fontSize: 11 }}>O caminho de navegação fica salvo no topo do gráfico. Clique em qualquer etapa para voltar àquele nível.</p>
          </div>

          <div style={sec}>
            <div style={h2}><Layers size={12} color={teal} /> As Abas do BI</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tabs.map(t => (
                <div key={t.label} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${teal}1A` }}>
                  <div style={{ minWidth: 110, fontWeight: 900, fontSize: 11, color: teal }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: dim, lineHeight: 1.65 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><TrendingUp size={12} color={teal} /> KPIs Principais</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { kpi: 'Faturamento Total', desc: 'Soma dos pedidos com situação P (Pedido) e F (Faturado). Cancelados (E) nunca entram.' },
                { kpi: 'Crescimento %', desc: 'Variação em relação ao mesmo período do ano anterior. Verde = crescimento, vermelho = queda.' },
                { kpi: 'Clientes Ativos', desc: 'Clientes que fizeram pelo menos um pedido no período selecionado.' },
                { kpi: 'Ticket Médio', desc: 'Valor médio por pedido. Subir o ticket médio é uma das formas mais rápidas de crescer sem novos clientes.' },
                { kpi: 'Positivação', desc: 'Percentual de clientes da carteira que compraram no período. Meta ideal: acima de 70%.' },
              ].map(f => (
                <div key={f.kpi} style={{ display: 'flex', gap: 10, padding: '9px 12px', background: 'rgba(0,229,209,0.04)', borderRadius: 8, border: `1px solid ${teal}1A` }}>
                  <div style={{ minWidth: 130, fontWeight: 900, fontSize: 11, color: teal }}>{f.kpi}</div>
                  <div style={{ fontSize: 12, color: dim, lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><CheckCircle2 size={12} color={teal} /> Boas Práticas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Comece sempre pela Visão Geral para ter o panorama do período antes de aprofundar.',
                'Use o filtro de indústria ao visitar um fornecedor — leve os dados de desempenho da carteira para a reunião.',
                'A Curva ABC é a sua lista de prioridades de visita: foque nos A, recupere os B que caíram.',
                'Compare meses equivalentes (Abr 2026 vs Abr 2025) para análises sazonais — não compare Dezembro com Janeiro.',
                'Se um cliente soma mais de 30% do seu faturamento, é um risco de concentração — use o BI para diversificar.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, ...tip(teal), alignItems: 'flex-start' }}>
                  <CheckCircle2 size={12} color={teal} style={{ flexShrink: 0, marginTop: 2 }} />
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

// ─────────────────────────────────────────────────────────────────────────────

interface BIShellProps {
  children: React.ReactNode;
}

export const BIShell = ({ children }: BIShellProps) => {
  const navigate = useNavigate();
  const { activeTab, setTab, filters, syncFromURL, toURLParams } = useBIStore();
  const [showHelp, setShowHelp] = useState(false);
  const { user } = useAuthStore();
  const firstName = user?.nome?.split(' ')[0]?.toUpperCase() || 'USUÁRIO';

  // Sync URL → store on mount
  useEffect(() => {
    syncFromURL(window.location.search);
  }, []);

  // Sync store → URL on filter/tab change
  useEffect(() => {
    const p = toURLParams();
    const newSearch = `?${p.toString()}`;
    if (window.location.search !== newSearch) {
      window.history.replaceState(null, '', `/bi${newSearch}`);
    }
  }, [activeTab, filters]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bi-scrollbar"
      style={{ background: BI.pageBg, color: BI.text }}>
      <BIStyles />
      {showHelp && <BIHelpModal onClose={() => setShowHelp(false)} />}

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col gap-0"
        style={{ background: BI.panel, borderBottom: `1px solid ${BI.border}` }}>

        {/* Row 1: Pequeno seletor de tabs superior (estilo V1) */}
        <div className="flex items-center px-6 py-1.5 gap-1 border-b" style={{ borderColor: BI.border }}>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md hover:bg-white/5 transition-colors"
            style={{ color: BI.textMuted }}>
            <LayoutDashboard size={13} /> Dashboard
          </button>
          <div className="px-3 py-1 text-[11px] font-bold rounded-md bg-white/5"
            style={{ color: BI.text }}>
            <BarChart2 size={13} className="inline mr-1" /> Bi intelligence
          </div>
        </div>

        {/* Row 2: Header Saudação + Período (DENTRO DO CONTAINER ESTREITO) */}
        <div className="max-w-[1140px] mx-auto w-full px-8 py-6 flex items-start justify-between glass-effect">
          <div>
            <h1 className="text-3xl font-black mb-1 transition-all" style={{ color: BI.text }}>
              {(() => {
                const hour = new Date().getHours();
                if (hour >= 5 && hour < 12) return 'Bom dia';
                if (hour >= 12 && hour < 18) return 'Boa tarde';
                return 'Boa noite';
              })()}, {firstName} ! ✨
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50" style={{ color: BI.text }}>
              ⚡ INTELIGÊNCIA COMERCIAL QUE GUIA DECISÕES.
            </p>
            <button onClick={() => setShowHelp(true)}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg"
              style={{ background: `${BI.teal}14`, border: `1px solid ${BI.teal}33`, color: BI.teal, cursor: 'pointer' }}>
              <HelpCircle size={12} /> Como usar o BI
            </button>
          </div>

          <div className="flex flex-col items-end gap-3 mt-1">
            <PeriodSelector />
            <BIExtraFilters />
          </div>
        </div>

        {/* Row 3: Filtros (DENTRO DO CONTAINER ESTREITO) */}
        <div className="max-w-[1140px] mx-auto w-full px-8 pb-4">
           <FilterPillsRow />
        </div>
      </div>

      {/* ── ALERT STRIP ──────────────────────────────────────────────────── */}
      <AlertStrip />

      {/* ── CONTENT AREA (CONTAINER ESTREITO) ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bi-scrollbar">
        <div className="max-w-[1140px] mx-auto w-full px-8 py-4">
          {children}
        </div>
      </div>

      {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
      <nav className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-2"
        style={{ background: BI.panel, borderTop: `1px solid ${BI.border}` }}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`bi-nav-pill flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl ${isActive ? 'active' : ''}`}
              style={{
                background: isActive ? BI.tealGlow : 'transparent',
                border: isActive ? `1px solid ${BI.teal}40` : '1px solid transparent',
                color: isActive ? BI.teal : BI.textMuted,
                minWidth: 72,
              }}>
              <Icon size={15} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

// ─── Alert Strip + Detalhe ────────────────────────────────────────────────────
const ALERTA_COLORS: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  error:   { bg: 'rgba(229,62,62,0.12)',  border: 'rgba(229,62,62,0.35)',  text: '#FC8181', hover: 'rgba(229,62,62,0.22)' },
  warning: { bg: 'rgba(246,173,85,0.12)', border: 'rgba(246,173,85,0.35)', text: '#F6AD55', hover: 'rgba(246,173,85,0.22)' },
};

const ALERTA_HAS_DETALHE = new Set(['clientes_inativos', 'industrias_zeradas', 'queda_mensal']);

const AlertChip = ({ alert, onClick }: { alert: Alerta; onClick: () => void }) => {
  const c = ALERTA_COLORS[alert.severidade] ?? ALERTA_COLORS.warning;
  const Icon = alert.severidade === 'error' ? AlertCircle : AlertTriangle;
  const hasDetail = ALERTA_HAS_DETALHE.has(alert.tipo);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: '6px 14px', whiteSpace: 'nowrap',
        cursor: hasDetail ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.background = c.hover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = c.bg; }}
    >
      <Icon size={13} style={{ color: c.text, flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{alert.titulo}</span>
        <span style={{ fontSize: 10, color: BI.textMuted, marginLeft: 6 }}>{alert.descricao}</span>
      </div>
      {hasDetail && (
        <span style={{ fontSize: 9, color: c.text, opacity: 0.6, marginLeft: 2 }}>▸ ver</span>
      )}
    </button>
  );
};

const AlertStrip = () => {
  const { items } = useAlertasStore();
  const [activeAlert, setActiveAlert] = useState<Alerta | null>(null);
  const [detalheData, setDetalheData] = useState<any[] | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);

  const openDetalhe = async (alert: Alerta) => {
    if (!ALERTA_HAS_DETALHE.has(alert.tipo)) return;
    setActiveAlert(alert);
    setDetalheData(null);
    setDetalheLoading(true);
    try {
      const res = await api.get(`/bi/alertas/detalhe?tipo=${alert.tipo}`);
      if (res.data.success) setDetalheData(res.data.data);
    } finally {
      setDetalheLoading(false);
    }
  };

  if (!items.length) return null;
  return (
    <>
      <div style={{ borderBottom: `1px solid ${BI.border}`, background: 'rgba(0,0,0,0.2)' }}>
        <div className="max-w-[1140px] mx-auto w-full px-8 py-2.5 flex items-center gap-3 overflow-x-auto bi-scrollbar" style={{ flexWrap: 'nowrap' }}>
          <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, color: BI.textMuted, flexShrink: 0 }}>
            Alertas
          </span>
          {items.map((a, i) => (
            <AlertChip key={i} alert={a} onClick={() => openDetalhe(a)} />
          ))}
        </div>
      </div>

      {/* Painel deslizante */}
      {activeAlert && (
        <AlertDetalheDrawer
          alert={activeAlert}
          data={detalheData}
          loading={detalheLoading}
          onClose={() => setActiveAlert(null)}
        />
      )}
    </>
  );
};

// ─── Painel de Detalhe ────────────────────────────────────────────────────────
function AlertDetalheDrawer({
  alert, data, loading, onClose,
}: {
  alert: Alerta;
  data: any[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  const c = ALERTA_COLORS[alert.severidade] ?? ALERTA_COLORS.warning;

  // Fecha com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 401,
        width: 420, maxWidth: '95vw',
        background: BI.panel,
        borderLeft: `1px solid ${c.border}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${BI.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {alert.severidade === 'error'
                ? <AlertCircle size={16} style={{ color: c.text }} />
                : <AlertTriangle size={16} style={{ color: c.text }} />}
              <span style={{ fontSize: 13, fontWeight: 800, color: c.text }}>{alert.titulo}</span>
            </div>
            <span style={{ fontSize: 11, color: BI.textMuted }}>{alert.descricao}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: BI.textMuted, padding: 4, flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="bi-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: BI.textMuted, fontSize: 12 }}>
              Carregando...
            </div>
          )}

          {!loading && data && alert.tipo === 'clientes_inativos' && (
            <ClientesInativosLista data={data} />
          )}
          {!loading && data && alert.tipo === 'industrias_zeradas' && (
            <IndustriasZeradasLista data={data} />
          )}
          {!loading && data && alert.tipo === 'queda_mensal' && (
            <QuedaMensalLista data={data} />
          )}
        </div>

        {/* Footer */}
        {data && (
          <div style={{
            padding: '12px 24px',
            borderTop: `1px solid ${BI.border}`,
            fontSize: 10, color: BI.textMuted, textAlign: 'center',
          }}>
            {data.length} {alert.tipo === 'clientes_inativos' ? 'clientes' : 'indústrias'} listadas
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-listas por tipo ───────────────────────────────────────────────────────
function ClientesInativosLista({ data }: { data: any[] }) {
  return (
    <div>
      {data.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 24px',
          borderBottom: `1px solid ${BI.border}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'rgba(252,129,129,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserX size={14} style={{ color: '#FC8181' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BI.text, marginBottom: 2 }}>
              {row.cli_nome}
            </div>
            <div style={{ fontSize: 10, color: BI.textMuted }}>
              {row.cli_cidade && `${row.cli_cidade}${row.cli_uf ? `/${row.cli_uf}` : ''} · `}
              Última compra: {row.ultima_compra
                ? new Date(row.ultima_compra).toLocaleDateString('pt-BR')
                : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#FC8181',
              background: 'rgba(252,129,129,0.12)',
              borderRadius: 6, padding: '2px 8px', marginBottom: 2,
            }}>
              {row.dias_inativo}d
            </div>
            <div style={{ fontSize: 9, color: BI.textMuted }}>
              {Number(row.faturamento_12m) > 0 ? fmtBRL(Number(row.faturamento_12m)) : '—'} / ano
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IndustriasZeradasLista({ data }: { data: any[] }) {
  return (
    <div>
      {data.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 24px',
          borderBottom: `1px solid ${BI.border}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'rgba(246,173,85,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building size={14} style={{ color: '#F6AD55' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BI.text }}>{row.for_nome}</div>
            <div style={{ fontSize: 10, color: BI.textMuted, marginTop: 2 }}>
              Nenhum pedido neste mês
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BI.textSec }}>
              {fmtBRL(Number(row.faturamento_mes_ant))}
            </div>
            <div style={{ fontSize: 9, color: BI.textMuted }}>mês anterior</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuedaMensalLista({ data }: { data: any[] }) {
  return (
    <div>
      {data.map((row, i) => {
        const atual    = Number(row.total_atual);
        const anterior = Number(row.total_anterior);
        const delta    = anterior > 0 ? ((atual - anterior) / anterior * 100) : 0;
        const isDown   = delta < 0;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 24px',
            borderBottom: `1px solid ${BI.border}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: isDown ? 'rgba(252,129,129,0.12)' : 'rgba(180,255,157,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingDown size={14} style={{ color: isDown ? '#FC8181' : '#b4ff9d' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BI.text }}>{row.for_nome}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: BI.textMuted }}>
                  Atual: {fmtBRL(atual)}
                </span>
                <span style={{ fontSize: 10, color: BI.textMuted }}>
                  Ant: {fmtBRL(anterior)}
                </span>
              </div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 800,
              color: isDown ? '#FC8181' : '#b4ff9d',
              background: isDown ? 'rgba(252,129,129,0.12)' : 'rgba(180,255,157,0.08)',
              borderRadius: 6, padding: '2px 8px', flexShrink: 0,
            }}>
              {isDown ? '▼' : '▲'} {Math.abs(delta).toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Linha de pills — omite se não houver filtros
const FilterPillsRow = () => {
  const { filters } = useBIStore();
  const hasFilters = filters.meses.length > 0 || !!filters.for_codigo || !!filters.ven_codigo || !!filters.cli_codigo || filters.agrupar_rede;
  if (!hasFilters) return null;
  return (
    <div className="flex items-center gap-2 px-6 pb-2.5">
      <FilterPills />
    </div>
  );
};
