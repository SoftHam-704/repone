import { useState, useEffect, useMemo } from 'react';
import {
  Bell, Inbox, Mail, MessageCircle, Cake, ChevronRight,
  AlertCircle, Users, Package, Flame, Calendar as CalendarIcon,
  Send, Zap, Sparkles, HelpCircle, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
// AppSidebar é renderizado pelo MainLayout — não duplicar aqui.
import { NoticiasBanner } from '../components/NoticiasBanner';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { useIrisModal } from '@/shared/stores/useIrisModal';

/**
 * RepHome — Home do usuário NÃO master (rep).
 *
 * Diferenças do PortalHome:
 *   • Sem hero de faturamento em R$
 *   • Sem top indústrias por receita
 *   • Sem donut de meta + projeção
 *   • Sem chart YoY de faturamento
 *   • Sem ticket médio (R$ explícito)
 *
 * Mantém: saudação, atenção (clientes sem pedido), KPIs de contagem,
 * análises de carteira (%, contagens), aniversariantes, agenda,
 * Central de Comando (CRM, IRIS, E-mails, WhatsApp IA).
 *
 * Decisão arquitetural ([[feedback_portal_home_rep_separado]]):
 * arquivo NOVO em vez de condicionais espalhados no PortalHome de 2400 linhas
 * — evita regressão no "time que está ganhando".
 */

// ─── Tokens (mesma paleta Areia + Navy do V1) ────────────────────────────────
const G = {
  bg:        '#E8E1D4',
  card:      '#F2ECE2',
  cardHi:    '#F8F4EE',
  border:    '#D3C7AD',
  text:      '#28374A',
  textSec:   '#3D5265',
  textMuted: '#5E7282',
  mustard:   '#FFD200',
  success:   '#16A34A',
  danger:    '#C0392B',
  warning:   '#D97706',
  purple:    '#6D4C8E',
  blue:      '#2563EB',
} as const;

const styles = `
  .card-soft {
    box-shadow: 0 10px 40px -10px rgba(26,26,26,0.06);
    transition: box-shadow .25s, transform .25s;
  }
  .card-soft:hover {
    box-shadow: 0 20px 60px -10px rgba(26,26,26,0.12);
    transform: translateY(-1px);
  }
`;

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Metrics {
  volume_itens?:        number;
  clientes_ativos?:     number;
  clientes_ativos_delta?: number;
  volume_itens_delta?:  number;
  burnout?:             number;
  sem_pedido_mes?:      number;
}
interface Insights {
  concentracao?: { value: number };
  ativacao?:     Array<{ name: string; value: number }>;
  saude?:        Array<{ name: string; value: number }>;
  gap?:          any[];
}
interface AgendaResumo {
  hoje?: number;
  semana?: number;
}
interface CrmDash {
  pipeline?: Array<{ estagio: string; total: number; valor_total: number }>;
  followups?: { atrasados?: number; hoje?: number };
}
interface EmailResumo  { naoLidos?: number; total?: number }
interface WppResumo    { conversasAbertas?: number; mensagensNaoLidas?: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtN = (v: number | undefined) =>
  (v ?? 0).toLocaleString('pt-BR');

const greetingNow = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const todayFmt = () => {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase();
};

// ─── Componente ──────────────────────────────────────────────────────────────
export default function RepHome() {
  const user = useAuthStore(s => s.user);
  const venCodigo = user?.codigo;

  const [metrics, setMetrics]   = useState<Metrics | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [agenda, setAgenda]     = useState<AgendaResumo | null>(null);
  const [crmDash, setCrmDash]   = useState<CrmDash | null>(null);
  const [emailResumo, setEmailResumo] = useState<EmailResumo | null>(null);
  const [wppResumo,   setWppResumo]   = useState<WppResumo | null>(null);
  const [loading,     setLoading]     = useState(true);

  // Filtros simples (ano/mês) — sem indústria/cliente pra manter leve.
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // Carga inicial + reload a cada mudança de filtro
  useEffect(() => {
    const p = new URLSearchParams({ year: String(year), month: String(month) });
    if (venCodigo) p.set('ven_codigo', String(venCodigo));

    setLoading(true);
    Promise.all([
      api.get(`/dashboard/metrics?${p}`).then(r => r.data.success && setMetrics(r.data.data)).catch(() => {}),
      api.get(`/dashboard/aura-insights?${p}`).then(r => r.data.success && setInsights(r.data.data)).catch(() => {}),
      api.get('/agenda/resumo').then(r => r.data.success && setAgenda(r.data.data)).catch(() => {}),
      api.get('/crm/dashboard').then(r => r.data.success && setCrmDash(r.data.data)).catch(() => {}),
      api.get('/email-central/resumo').then(r => r.data.success && setEmailResumo(r.data)).catch(() => {}),
      api.get('/whatsapp/resumo-portal').then(r => r.data.success && setWppResumo(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [year, month, venCodigo]);

  // Derivados de insights (rotineiramente null-safe)
  const concentracao = insights?.concentracao?.value ?? 0;
  const ativos       = insights?.ativacao?.find(d => d.name === 'Ativo')?.value ?? 0;
  const crescendo    = insights?.saude?.find(d => d.name === 'Crescendo')?.value ?? 0;
  const gapInd       = insights?.gap?.length ?? 0;

  const semPedidoMes = metrics?.sem_pedido_mes ?? 0;

  // Pipeline total (count + flag de oportunidades) — sem R$ explícito.
  const pipelineTotalOps = useMemo(() =>
    (crmDash?.pipeline || []).reduce((s, e) => s + (e.total || 0), 0),
  [crmDash]);

  const followupsAtraso = crmDash?.followups?.atrasados ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: G.bg }}>
      <style>{styles}</style>

      <main className="px-6 lg:px-10 py-8" style={{ color: G.text }}>

        {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: G.text }}>
              {greetingNow()}, {(user?.nome || '').toUpperCase()}
            </h1>
            <p className="text-xs font-bold mt-1 tracking-widest" style={{ color: G.textMuted }}>
              {todayFmt()}
            </p>
          </div>

          {/* Filtros leves: ano + mês */}
          <div className="flex items-center gap-2">
            <YearChips current={year} onChange={setYear} />
            <MonthChips current={month} onChange={setMonth} />
          </div>
        </header>

        {/* ── BANNER IRIS · NOVIDADES DOS ÚLTIMOS 2 DIAS ──────────────────── */}
        <NoticiasBanner G={G} />

        {/* ── Banner de Atenção ───────────────────────────────────────────── */}
        {semPedidoMes > 0 && (
          <Link to="/clientes?filtro=sem-pedido-mes"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6 card-soft"
            style={{ background: '#FFF7ED', border: `1px solid #FED7AA`, color: '#9A3412' }}>
            <AlertCircle size={16} style={{ color: G.warning }} />
            <div className="flex-1">
              <span className="text-xs font-black uppercase tracking-widest mr-2">Atenção</span>
              <span className="text-sm font-bold">{fmtN(semPedidoMes)} clientes sem pedido este mês</span>
            </div>
            <ChevronRight size={14} />
          </Link>
        )}

        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <KpiCard
            label="Volume de itens"
            value={fmtN(metrics?.volume_itens)}
            delta={metrics?.volume_itens_delta}
            Icon={Package}
            color={G.blue}
          />
          <KpiCard
            label="Clientes ativos"
            value={fmtN(metrics?.clientes_ativos)}
            delta={metrics?.clientes_ativos_delta}
            Icon={Users}
            color={G.success}
          />
          <KpiCard
            label="Burnout"
            value={`${fmtN(metrics?.burnout)} críticos`}
            Icon={Flame}
            color={G.danger}
          />
        </section>

        {/* ── Grid principal — 8 / 4 ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Coluna esquerda — Análises + Agenda + Consultas */}
          <div className="lg:col-span-8 flex flex-col gap-4">

            <Panel title="Análises da sua carteira" icon={<Bell size={13} style={{ color: G.mustard }} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <InsightRow
                  label="Concentração"
                  val={`${concentracao}%`}
                  danger={concentracao > 60}
                  tip="Quanto do seu faturamento depende dos top clientes. > 60% = risco."
                  to="/bi?tab=clientes"
                />
                <InsightRow
                  label="Ativação"
                  val={`${fmtN(ativos)} ativos`}
                  tip="Clientes com compra nos últimos 60d."
                  to="/clientes?filtro=ativos"
                />
                <InsightRow
                  label="Crescendo"
                  val={`${fmtN(crescendo)} clientes`}
                  tip="Clientes com faturamento dos últimos 90d acima dos 90d anteriores."
                  to="/estatisticas?rotina=clientes-mom"
                />
                <InsightRow
                  label="Gap cross-sell"
                  val={gapInd ? `${gapInd} ind.` : '–'}
                  tip="Indústrias com oportunidade de cross-sell na sua carteira."
                  to="/estatisticas?rotina=gap-catalogo"
                />
              </div>
            </Panel>

            <Panel title="Sua agenda" icon={<CalendarIcon size={13} style={{ color: G.purple }} />} to="/agenda">
              <div className="grid grid-cols-2 gap-3">
                <AgendaTile label="Hoje" value={agenda?.hoje ?? 0} />
                <AgendaTile label="Esta semana" value={agenda?.semana ?? 0} />
              </div>
            </Panel>

            <Panel title="Consultas" icon={<Cake size={13} style={{ color: '#EC4899' }} />}>
              <Link to="/clientes?aniversariantes=1"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                style={{ border: `1px solid ${G.border}` }}>
                <span className="text-xs font-bold" style={{ color: G.textSec }}>Aniversariantes por período</span>
                <ChevronRight size={11} style={{ color: G.textMuted }} />
              </Link>
            </Panel>
          </div>

          {/* Coluna direita — Central de Comando */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={13} style={{ color: G.mustard }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: G.text }}>
                  Central de Comando
                </span>
              </div>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: G.success }} />
            </header>

            <CommandCard
              to="/crm/visitas"
              icon={<Inbox size={14} style={{ color: G.purple }} />}
              title="CRM"
              line1={`${pipelineTotalOps} oportunidade${pipelineTotalOps !== 1 ? 's' : ''} no pipeline`}
              warningCount={followupsAtraso}
              warningLabel={followupsAtraso > 0 ? `${followupsAtraso} atrasado${followupsAtraso > 1 ? 's' : ''}` : null}
            />

            <CommandCard
              to="/email-central"
              icon={<Mail size={14} style={{ color: G.blue }} />}
              title="E-mails"
              line1={emailResumo?.naoLidos
                ? `${emailResumo.naoLidos} não lido${emailResumo.naoLidos > 1 ? 's' : ''}`
                : 'Nenhum e-mail recente'}
              line2={emailResumo?.total ? `${emailResumo.total} no total` : null}
            />

            <CommandCard
              to="/whatsapp"
              icon={<MessageCircle size={14} style={{ color: G.success }} />}
              title="WhatsApp IA"
              line1={wppResumo?.conversasAbertas
                ? `${wppResumo.conversasAbertas} conversa${wppResumo.conversasAbertas > 1 ? 's' : ''} aberta${wppResumo.conversasAbertas > 1 ? 's' : ''}`
                : 'Sem conversas no momento'}
              line2={wppResumo?.mensagensNaoLidas
                ? `${wppResumo.mensagensNaoLidas} mensagem${wppResumo.mensagensNaoLidas > 1 ? 'ns' : ''} não lida${wppResumo.mensagensNaoLidas > 1 ? 's' : ''}`
                : null}
            />

            <CommandCard
              icon={<Send size={14} style={{ color: G.warning }} />}
              title="IRIS Campanhas"
              badge="EM BREVE"
              line1="Disparo inteligente via WhatsApp + E-mail"
            />

            {(['admin', 'superadmin'].includes(user?.role || '') && (user?.iaPlanLevel || 'INATIVA') !== 'INATIVA') ? (
              <CommandCard
                onClick={() => useIrisModal.getState().open()}
                icon={<Sparkles size={14} style={{ color: G.mustard }} />}
                title="IRIS Dev"
                badge="BETA · ATIVA"
                line1="Seu desenvolvedor pessoal — peça e ela monta"
                line2="Relatório, gráfico, mapa · na hora"
              />
            ) : (
              <CommandCard
                icon={<Sparkles size={14} style={{ color: G.mustard }} />}
                title="IRIS Dev"
                badge="EM BREVE"
                line1="Seu desenvolvedor pessoal — peça e ela monta"
                line2="Relatório, gráfico, mapa · na hora"
                helpTitle="O fim do tempo perdido procurando relatório"
                helpContent={IrisPergunteHelpContent}
              />
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center mt-8 text-xs font-bold uppercase tracking-widest"
            style={{ color: G.textMuted }}>
            Carregando…
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function KpiCard({ label, value, delta, Icon, color }: {
  label: string; value: string; delta?: number; Icon: any; color: string;
}) {
  const showDelta = typeof delta === 'number' && delta !== 0;
  return (
    <div className="rounded-2xl px-5 py-4 card-soft"
      style={{ background: G.card, border: `1px solid ${G.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: G.textMuted }}>
          {label}
        </span>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="text-2xl font-black" style={{ color: G.text }}>{value}</div>
      {showDelta && (
        <div className="text-[10px] font-black mt-1"
          style={{ color: delta! > 0 ? G.success : G.danger }}>
          {delta! > 0 ? '↗' : '↘'} {Math.abs(delta!).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function Panel({ title, icon, to, children }: {
  title: string; icon: React.ReactNode; to?: string; children: React.ReactNode;
}) {
  const header = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: G.text }}>
          {title}
        </span>
      </div>
      {to && <ChevronRight size={12} style={{ color: G.textMuted }} />}
    </div>
  );
  const body = (
    <div className="rounded-2xl p-4 card-soft"
      style={{ background: G.card, border: `1px solid ${G.border}` }}>
      {header}
      {children}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function InsightRow({ label, val, danger, tip, to }: {
  label: string; val: string; danger?: boolean; tip?: string; to: string;
}) {
  return (
    <Link to={to} title={tip}
      className="flex items-center justify-between px-3 py-2 rounded-xl transition-all"
      style={{ border: `1px solid ${G.border}` }}>
      <span className="text-xs font-bold" style={{ color: G.textSec }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-black" style={{ color: danger ? G.danger : G.textSec }}>{val}</span>
        <ChevronRight size={11} style={{ color: G.textMuted }} />
      </div>
    </Link>
  );
}

function AgendaTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl px-3 py-3 flex flex-col items-center"
      style={{ background: G.cardHi, border: `1px solid ${G.border}` }}>
      <span className="text-2xl font-black" style={{ color: G.text }}>{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: G.textMuted }}>
        {label}
      </span>
    </div>
  );
}

function CommandCard({ to, onClick, icon, title, line1, line2, badge, warningCount, warningLabel, helpTitle, helpContent }: {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  line1: string;
  line2?: string | null;
  badge?: string;
  warningCount?: number;
  warningLabel?: string | null;
  helpTitle?: string;
  helpContent?: React.ReactNode;
}) {
  const [showHelp, setShowHelp] = useState(false);

  const body = (
    <div className="rounded-2xl card-soft overflow-hidden"
      style={{ background: G.card, border: `1px solid ${G.border}` }}>
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${G.border}` }}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-black" style={{ color: G.text }}>{title}</span>
          {badge && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg"
              style={{ background: `${G.mustard}30`, color: G.text }}>
              {badge}
            </span>
          )}
          {!!warningCount && warningLabel && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
              style={{ background: `${G.danger}18`, color: G.danger }}>
              {warningLabel}
            </span>
          )}
          {helpContent && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setShowHelp(true); }}
              className="ml-1 transition-all hover:scale-110"
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: `${G.mustard}25`, border: `1px solid ${G.mustard}40`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label={`Saiba mais sobre ${title}`}
            >
              <HelpCircle size={11} style={{ color: G.mustard }} />
            </button>
          )}
        </div>
        {to && <ChevronRight size={12} style={{ color: G.textMuted }} />}
      </div>
      <div className="px-4 py-3">
        <p className="text-xs font-bold" style={{ color: G.textSec }}>{line1}</p>
        {line2 && (
          <p className="text-[10px] mt-1" style={{ color: G.textMuted }}>{line2}</p>
        )}
      </div>

      {showHelp && helpContent && (
        <HelpModal title={helpTitle || title} onClose={() => setShowHelp(false)}>
          {helpContent}
        </HelpModal>
      )}
    </div>
  );
  if (to) return <Link to={to}>{body}</Link>;
  if (onClick) return <div onClick={onClick} style={{ cursor: 'pointer' }}>{body}</div>;
  return body;
}

// ─── Modal de "Saiba mais" (persuasão de feature em breve) ──────────────────
function HelpModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15, 23, 35, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease-out',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          background: G.card, borderRadius: 20,
          border: `1px solid ${G.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          position: 'relative',
          animation: 'slideUp 0.25s ease-out',
        }}>
        {/* Header */}
        <div style={{
          padding: '22px 26px 18px',
          borderBottom: `1px solid ${G.border}`,
          background: `linear-gradient(135deg, ${G.mustard}12 0%, transparent 100%)`,
          display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: G.mustard }}>
              ✨ Em breve no RepOne
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: G.text, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 10,
              background: 'transparent', border: `1px solid ${G.border}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <X size={14} style={{ color: G.textMuted }} />
          </button>
        </div>

        <div style={{ padding: '24px 26px 28px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Conteúdo persuasivo: Pergunte à IRIS ───────────────────────────────────
const IrisPergunteHelpContent = (
  <div className="space-y-5">
    <p style={{ fontSize: 14, lineHeight: 1.55, color: G.textSec }}>
      Você nunca mais vai precisar <span style={{ color: G.text, fontWeight: 700 }}>caçar relatório</span> em menu.
      A IRIS vira sua <span style={{ color: G.mustard, fontWeight: 800 }}>gerente comercial pessoal</span>,
      disponível 24h, que responde qualquer pergunta sobre <span style={{ color: G.text, fontWeight: 700 }}>seus clientes, suas vendas, suas metas</span> — em segundos.
    </p>

    {/* SEÇÃO PRINCIPAL — relatórios criados dinamicamente */}
    <div style={{
      padding: '22px 22px 18px', borderRadius: 14,
      background: `linear-gradient(135deg, ${G.mustard}1A 0%, ${G.mustard}30 100%)`,
      border: `2px solid ${G.mustard}`,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -11, left: 16,
        padding: '4px 11px', borderRadius: 6,
        background: G.text, color: G.mustard,
        fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
        textTransform: 'uppercase',
      }}>
        ⭐ O Pulo do Gato
      </div>

      <h3 style={{
        fontSize: 22, fontWeight: 900, color: G.text,
        marginTop: 4, marginBottom: 6, lineHeight: 1.1,
        letterSpacing: '-0.02em',
      }}>
        NÃO TEM O RELATÓRIO?<br/>
        <span style={{ color: G.mustard }}>A IRIS CRIA AGORA.</span>
      </h3>

      <p style={{ fontSize: 13, color: G.text, fontWeight: 700, marginBottom: 14 }}>
        Você fala. Ela faz. Em segundos.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto',
        gap: '8px 12px', alignItems: 'center', marginBottom: 12,
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Você fala</div>
        <div></div>
        <div style={{ fontSize: 10, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>IRIS responde</div>

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
              fontSize: 12.5, color: G.text, fontWeight: 700,
              fontStyle: 'italic', lineHeight: 1.3,
            }}>{q}</span>
            <span key={`a-${i}`} style={{
              fontSize: 11, fontWeight: 900, color: G.mustard,
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Sparkles size={10} />{a}
            </span>
          </>
        ))}
      </div>

      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: G.text,
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 12, fontWeight: 900, color: G.mustard,
          letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.4,
        }}>
          Sem esperar SoftHam · Sem abrir chamado · Sem decorar menu
        </p>
      </div>
    </div>

    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: `${G.mustard}08`, border: `1px solid ${G.mustard}25`,
    }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: G.mustard, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        E pra perguntas rápidas do dia a dia:
      </p>
      <ul className="space-y-2.5">
        {[
          { q: '"Como tá meu mês? Tô na meta?"',                           a: 'Resumo com gráfico em 3 segundos' },
          { q: '"Quanto o Domiciano comprou esse ano?"',                    a: 'Histórico + tendência + curva ABC' },
          { q: '"Quais clientes ficaram pra trás na minha rota?"',          a: 'Lista priorizada, com motivo' },
          { q: '"Que produto da Mahle saiu mais em maio?"',                 a: 'Top 10 com volume e ticket' },
          { q: '"Qual o desconto desse cliente pra IMA?"',                  a: 'Política completa + observações' },
          { q: '"Compara meu top 5 desse ano com o ano passado"',          a: 'Tabela comparativa + insight' },
        ].map((ex, i) => (
          <li key={i} className="flex gap-3" style={{ alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              <Sparkles size={11} style={{ color: G.mustard }} />
            </span>
            <div>
              <p style={{ fontSize: 12, color: G.text, fontWeight: 700, lineHeight: 1.4 }}>{ex.q}</p>
              <p style={{ fontSize: 10, color: G.textMuted, marginTop: 2 }}>→ {ex.a}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>

    <div>
      <p style={{ fontSize: 11, fontWeight: 800, color: G.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Por que isso muda seu dia
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { titulo: 'Sem manual',     desc: 'Você não precisa decorar onde fica nenhum relatório' },
          { titulo: 'Sem espera',     desc: 'Sem ligar pro suporte pedindo "como faz pra…"' },
          { titulo: 'Na sua língua',  desc: 'IRIS entende rolemão, fixão, "tirar pedido" — não precisa ser técnico' },
          { titulo: 'No campo',       desc: 'Funciona no celular durante a visita. Pergunta e pronto' },
          { titulo: 'Tudo agregado',  desc: 'BI + CRM + financeiro respondendo junto sem você abrir 5 telas' },
          { titulo: 'Sob medida',     desc: 'Se um relatório não existe, IRIS monta na hora pra você' },
        ].map((b, i) => (
          <div key={i} style={{
            padding: '10px 12px', borderRadius: 10,
            background: G.bg, border: `1px solid ${G.border}`,
          }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: G.text }}>{b.titulo}</p>
            <p style={{ fontSize: 10, color: G.textMuted, marginTop: 3, lineHeight: 1.4 }}>{b.desc}</p>
          </div>
        ))}
      </div>
    </div>

    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: G.bg, border: `1px solid ${G.border}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Flame size={20} style={{ color: G.warning, flexShrink: 0 }} />
      <p style={{ fontSize: 12, color: G.textSec, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 800, color: G.text }}>Esse é o RepOne sem fricção.</span>{' '}
        Você fala, ela faz. Ela é a primeira coisa que você abre de manhã, e a última que fecha à noite.
      </p>
    </div>

    <p style={{ fontSize: 11, color: G.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
      Em desenvolvimento. Aviso aqui quando liberar.
    </p>
  </div>
);

// ─── Chips de filtro (ano / mês) ─────────────────────────────────────────────
function YearChips({ current, onChange }: { current: number; onChange: (y: number) => void }) {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear];
  return (
    <div className="flex items-center rounded-full overflow-hidden"
      style={{ background: G.card, border: `1px solid ${G.border}` }}>
      {years.map(y => (
        <button key={y} onClick={() => onChange(y)}
          className="text-xs font-black px-3 py-1.5 transition-all"
          style={{
            background: current === y ? G.text : 'transparent',
            color:      current === y ? G.mustard : G.textMuted,
          }}>
          {y}
        </button>
      ))}
    </div>
  );
}

function MonthChips({ current, onChange }: { current: number; onChange: (m: number) => void }) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return (
    <div className="flex items-center rounded-full overflow-hidden"
      style={{ background: G.card, border: `1px solid ${G.border}` }}>
      {meses.map((m, i) => {
        const num = i + 1;
        const active = current === num;
        return (
          <button key={m} onClick={() => onChange(num)}
            className="text-[10px] font-black px-2 py-1.5 transition-all"
            style={{
              background: active ? G.text : 'transparent',
              color:      active ? G.mustard : G.textMuted,
            }}>
            {m}
          </button>
        );
      })}
    </div>
  );
}
