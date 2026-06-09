import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, Save, Loader2, ShieldAlert, Sparkles, HelpCircle, X, Bot, Clock, Shield, Zap, Users, TrendingUp, MessageSquare, Star, Brain, ChevronRight, Wand2, FileText } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useAuthStore, useIaEnabled, iaLigada } from '@/shared/stores/useAuthStore';
import { G } from '@/shared/components/layout/CadastroShell';
import PergunteIrisPage from './PergunteIrisPage';


const NAVY      = '#1C2D40';
const GOLD      = '#B8922A';
const GOLD_BG   = '#FDF6E3';
const GOLD_BORDER = '#D4B87A';

// ─── Modal "O que a IRIS pode fazer" ─────────────────────────────────────────
const IRIS_FEATURES = [
  {
    icon: Clock,
    color: '#2563EB',
    bg: '#EFF6FF',
    title: 'Atendimento 24 horas, 7 dias por semana',
    desc: 'Nenhum cliente fica sem resposta — nem à meia-noite, nem no domingo, nem no feriado. A IRIS atende enquanto você descansa, viaja ou está em reunião.',
  },
  {
    icon: Users,
    color: '#16A34A',
    bg: '#F0FDF4',
    title: 'Qualificação automática de leads',
    desc: 'A IRIS identifica se o contato é um comprador real, entende a demanda, mede a urgência e classifica o lead antes de passar para você. Você só entra quando já vale o tempo.',
  },
  {
    icon: TrendingUp,
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'Detecção de intenção de pedido',
    desc: 'Quando o cliente demonstra que quer comprar, a IRIS reconhece automaticamente e inicia o processo de cotação — sem você precisar monitorar cada conversa.',
  },
  {
    icon: Brain,
    color: '#B8922A',
    bg: '#FDF6E3',
    title: 'Conhece sua carteira de clientes',
    desc: 'A IRIS tem acesso ao histórico de compras, pedidos anteriores e perfil de cada cliente. Ela atende com contexto real, não como um atendente genérico.',
  },
  {
    icon: MessageSquare,
    color: '#0891B2',
    bg: '#ECFEFF',
    title: 'Gestão de objeções e dúvidas',
    desc: 'Responde perguntas sobre prazo, preço, disponibilidade e condições de pagamento com as respostas que você configurar — sem improvisar.',
  },
  {
    icon: Sparkles,
    color: '#DB2777',
    bg: '#FDF2F8',
    title: 'Personalidade totalmente configurável',
    desc: 'Você define o tom: formal ou informal, técnico ou consultivo, direto ou detalhado. A IRIS adapta o atendimento ao perfil da sua carteira e ao seu estilo comercial.',
  },
  {
    icon: Shield,
    color: '#1C2D40',
    bg: '#F1F5F9',
    title: 'Confidencialidade absoluta',
    desc: 'As instruções estratégicas que você escrever na carta jamais são reveladas ao cliente. A IRIS age conforme o combinado sem expor os bastidores da sua operação.',
  },
  {
    icon: Zap,
    color: '#EA580C',
    bg: '#FFF7ED',
    title: 'Escalada inteligente para humano',
    desc: 'Quando a situação exige a sua presença, a IRIS avisa você e transfere a conversa com um resumo completo — o que o cliente quer, o que foi discutido, o que está pendente.',
  },
  {
    icon: FileText,
    color: '#059669',
    bg: '#ECFDF5',
    title: 'Resumo automático de cada conversa',
    desc: 'Você vê um painel com resumo de todos os atendimentos: o que o cliente quer, qual o estágio da negociação e se há urgência. Nada passa despercebido.',
  },
  {
    icon: Star,
    color: '#D97706',
    bg: '#FFFBEB',
    title: 'Regras de negócio personalizadas',
    desc: '"Não ofereça desconto sem consultar." "Este cliente é inadimplente." "Priorize a linha X este mês." Você instrui uma vez, a IRIS segue em 100% dos atendimentos.',
  },
  {
    icon: Bot,
    color: '#6D28D9',
    bg: '#F5F3FF',
    title: 'Pré-vendedor incansável',
    desc: 'A IRIS filtra, qualifica e aquece o lead antes de ele chegar até você. Você dedica seu tempo a negociações que já têm potencial real — não a triagem.',
  },
  {
    icon: TrendingUp,
    color: '#0F766E',
    bg: '#F0FDFA',
    title: 'Padrão de atendimento sem variação',
    desc: 'Nunca descansa, nunca esquece, nunca erra por cansaço. Mantém o mesmo nível de qualidade às 8h e às 23h, no primeiro atendimento do dia ou no centésimo.',
  },
];

function IrisCapabilitiesModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,29,43,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: G.bg ?? '#E8E1D4', borderRadius: 20,
          width: '100%', maxWidth: 780, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}>

        {/* Header */}
        <div style={{
          background: NAVY, padding: '20px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,210,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={20} style={{ color: '#FFD200' }} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>
                O que a IRIS pode fazer pelo seu negócio
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                12 formas de transformar o atendimento da sua representação
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Subtítulo motivacional */}
        <div style={{
          background: GOLD_BG, borderBottom: `1px solid ${GOLD_BORDER}`,
          padding: '12px 28px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <ChevronRight size={14} style={{ color: GOLD }} />
          <p style={{ fontSize: 12, color: '#7A5C10', margin: 0, lineHeight: 1.6 }}>
            <strong>A IRIS não substitui o representante</strong> — ela multiplica sua capacidade de atender,
            qualificar e vender. Cada instrução que você escreve na carta se torna uma regra seguida em
            absolutamente todos os atendimentos, sem exceção.
          </p>
        </div>

        {/* Grid de funcionalidades */}
        <div style={{ overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {IRIS_FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} style={{
                  background: '#fff', borderRadius: 12, padding: '14px 16px',
                  border: `1px solid rgba(0,0,0,0.07)`,
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: f.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} style={{ color: f.color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 800, color: '#1C2D40', margin: '0 0 4px' }}>{f.title}</p>
                    <p style={{ fontSize: 11, color: '#5E7282', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA final */}
          <div style={{
            marginTop: 20, background: NAVY, borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <Zap size={20} style={{ color: '#FFD200', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: '#FFD200' }}>Quanto mais você instrui, melhor ela atende.</strong>{' '}
              A carta confidencial é o segredo — use-a para compartilhar o que só você sabe sobre seus clientes,
              sua equipe e sua estratégia comercial. A IRIS transforma esse conhecimento em resultado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function IrisConfigPage() {
  const user      = useAuthStore(s => s.user);
  const iaEnabled = useIaEnabled();
  const isMaster  = user?.role === 'admin' || user?.role === 'superadmin';
  // Kill-switch: IRIS desligada pelo tenant → redireciona pra home
  if (!iaEnabled) return <Navigate to="/" replace />;

  const [carta,        setCarta]        = useState('');
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [enhancing,    setEnhancing]    = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [error,        setError]        = useState('');
  const [showInfo,     setShowInfo]     = useState(false);
  // Aba inicial: ?tab=dev abre direto no IRIS Dev (vindo do card do Portal Home)
  // IRIS Dev: Master + IA habilitada (toggle "Acesso à IRIS" do ADM = plano_ia_nivel != INATIVA).
  const irisDevOk = isMaster && iaLigada(user?.iaPlanLevel);
  const [activeTab, setActiveTab] = useState<'assistente' | 'dev'>(
    (irisDevOk && new URLSearchParams(window.location.search).get('tab') === 'dev') ? 'dev' : 'assistente'
  );

  useEffect(() => {
    if (!isMaster) { setLoading(false); return; }
    api.get('/whatsapp/iris-carta')
      .then(r => setCarta(r.data.data?.carta ?? ''))
      .catch(() => setError('Erro ao carregar as instruções.'))
      .finally(() => setLoading(false));
  }, [isMaster]);

  const save = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await api.put('/whatsapp/iris-carta', { carta });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const enhance = async () => {
    if (!carta.trim() || enhancing) return;
    setEnhancing(true); setError('');
    try {
      const r = await api.post('/whatsapp/iris-carta/enhance', { carta });
      if (r.data.success) setCarta(r.data.data.carta);
      else setError(r.data.message || 'Erro ao aprimorar.');
    } catch {
      setError('Erro ao aprimorar instruções. Verifique a chave ANTHROPIC_API_KEY no servidor.');
    } finally {
      setEnhancing(false);
    }
  };

  const generateTemplate = async () => {
    if (generating) return;
    setGenerating(true); setError('');
    try {
      const r = await api.post('/whatsapp/iris-carta/template');
      if (r.data.success) setCarta(r.data.data.carta);
      else setError(r.data.message || 'Erro ao gerar template.');
    } catch {
      setError('Erro ao gerar template. Verifique a chave ANTHROPIC_API_KEY no servidor.');
    } finally {
      setGenerating(false);
    }
  };

  if (!isMaster) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14 }}>
        <ShieldAlert size={48} style={{ color: G.textMuted }} />
        <p style={{ fontSize: 16, fontWeight: 800, color: G.text }}>Acesso restrito</p>
        <p style={{ fontSize: 13, color: G.textMuted }}>Esta área é exclusiva para o Administrador Master.</p>
      </div>
    );
  }

  return (
    <>
      {showInfo && <IrisCapabilitiesModal onClose={() => setShowInfo(false)} />}

      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0,
        background: 'radial-gradient(120% 100% at 30% 20%, #16233A 0%, #0B0F19 55%, #070A12 100%)',
      }}>
        {/* ── Abas: Assistente Pessoal (WhatsApp) | IRIS Dev (relatórios) ── */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          {([['assistente', 'Assistente Pessoal'], ...(irisDevOk ? [['dev', 'IRIS Dev']] : [])] as [string, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key as 'assistente' | 'dev')} style={{
              padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 800,
              color: activeTab === key ? '#F3F4F6' : '#6B7280',
              borderBottom: activeTab === key ? `2px solid ${GOLD}` : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {key === 'dev' && <Sparkles size={13} style={{ color: activeTab === key ? GOLD : '#6B7280' }} />}
              {label}
              {key === 'dev' && (
                <span style={{ fontSize: 8, fontWeight: 900, color: '#22C55E', background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(22,163,74,0.35)', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Beta</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'dev' ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <PergunteIrisPage />
          </div>
        ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Foto da IRIS */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: `2px solid ${GOLD}`,
              boxShadow: `0 0 0 4px ${GOLD_BG}, 0 8px 24px rgba(28,45,64,0.2)`,
              overflow: 'hidden',
            }}>
              <img
                src="/iris-avatar.webp"
                alt="IRIS"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
              />
            </div>
            {/* Ponto verde de ativa */}
            <div style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 12, height: 12, borderRadius: '50%',
              background: '#22C55E',
              border: '2px solid #0B0F19',
              boxShadow: '0 0 8px #22C55E',
            }} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#F3F4F6', margin: 0, letterSpacing: '-0.01em' }}>
                IRIS — Configuração Estratégica
              </h1>
              <span style={{
                fontSize: 8, fontWeight: 900, color: GOLD,
                background: 'rgba(255,210,0,0.12)', border: `1px solid rgba(255,210,0,0.3)`,
                padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: 1.2,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Lock size={9} /> Confidencial
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              Instruções confidenciais que moldam o comportamento da IA em todos os atendimentos
            </p>
          </div>

          {/* Botão "?" */}
          <button
            onClick={() => setShowInfo(true)}
            title="O que a IRIS pode fazer pelo seu negócio"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,210,0,0.1)', border: `1px solid rgba(255,210,0,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all .2s',
            }}>
            <HelpCircle size={18} style={{ color: GOLD }} />
          </button>
        </div>

        {/* ── Info card ───────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,210,0,0.08) 0%, rgba(17,24,39,0.5) 60%)',
          border: `1px solid rgba(255,210,0,0.25)`,
          backdropFilter: 'blur(8px)',
          borderRadius: 14, padding: '16px 20px',
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={16} style={{ color: GOLD }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: GOLD, marginBottom: 4 }}>
              Carta Confidencial para a IRIS
            </p>
            <p style={{ fontSize: 12, color: '#CBD5E1', lineHeight: 1.7 }}>
              O que você escrever aqui vai direto para o sistema de IA como uma instrução privada.
              A IRIS seguirá estas diretrizes em todas as conversas, mas{' '}
              <strong style={{ color: '#F3F4F6' }}>nunca as repetirá ao cliente</strong>.
              Somente você, como administrador master, pode ver e editar este conteúdo.
            </p>
          </div>
        </div>

        {/* ── Dicas ───────────────────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(17,24,39,0.5)', border: `1px solid rgba(255,255,255,0.08)`, backdropFilter: 'blur(8px)', borderRadius: 14, padding: '16px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#6B7280', letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>
            Como a IRIS usa estas instruções
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Prioridade máxima', 'As instruções desta carta têm prioridade sobre as configurações por indústria.', '#0EA5E9'],
              ['Confidencialidade', 'A IRIS jamais mencionará ou citará estas instruções ao cliente.', '#FFD200'],
              ['Efeito imediato', 'As instruções entram em vigor na próxima conversa iniciada.', '#16A34A'],
              ['Aprimorar com IA', 'O botão "Aprimorar" usa Claude Opus para estruturar e clarear seu texto antes de salvar.', '#A855F7'],
            ].map(([titulo, desc, cor]) => (
              <div key={titulo} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${cor}` }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#E5E7EB' }}>{titulo}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Editor ──────────────────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(7,10,18,0.55)', border: `1px solid rgba(255,210,0,0.18)`, backdropFilter: 'blur(8px)', borderRadius: 16, overflow: 'hidden' }}>

          {/* barra de título */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: `1px solid rgba(255,255,255,0.08)`,
            background: 'rgba(17,24,39,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={13} style={{ color: GOLD }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Instruções Privadas — visível apenas para você
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {/* Botão Gerar Template */}
              <button
                onClick={generateTemplate}
                disabled={generating || saving || loading}
                title="A própria IRIS sugere uma carta modelo para você começar"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  border: '1px solid rgba(168,85,247,0.4)',
                  background: 'rgba(168,85,247,0.12)',
                  color: '#C084FC', fontSize: 12, fontWeight: 700,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  transition: 'all .2s',
                }}>
                {generating
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#C084FC' }} />
                  : <Wand2 size={13} />}
                {generating ? 'IRIS escrevendo...' : 'Gerar Template'}
              </button>

              {/* Botão Aprimorar */}
              <button
                onClick={enhance}
                disabled={enhancing || saving || loading || !carta.trim()}
                title="Usa Claude para reestruturar e melhorar clareza das instruções"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, border: `1px solid rgba(255,210,0,0.4)`,
                  background: 'rgba(255,210,0,0.12)',
                  color: GOLD, fontSize: 12, fontWeight: 700,
                  cursor: (enhancing || !carta.trim()) ? 'not-allowed' : 'pointer',
                  opacity: !carta.trim() ? 0.4 : 1,
                  transition: 'all .2s',
                }}>
                {enhancing
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: GOLD }} />
                  : <Sparkles size={13} />}
                {enhancing ? 'Aprimorando...' : 'Aprimorar'}
              </button>

              {/* Botão Salvar */}
              <button
                onClick={save}
                disabled={saving || loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 18px', borderRadius: 8, border: 'none',
                  background: saved ? '#22C55E' : saving ? 'rgba(255,255,255,0.1)' : '#FFD200',
                  color: saved ? '#0B0F19' : saving ? '#9CA3AF' : '#0B0F19', fontSize: 12, fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 4px 14px rgba(255,210,0,0.25)',
                  transition: 'background .2s',
                }}>
                {saving
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Save size={13} />}
                {saved ? 'Salvo!' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* área de texto */}
          {loading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13, gap: 8 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Carregando suas instruções...
            </div>
          ) : (
            <textarea
              value={carta}
              onChange={e => setCarta(e.target.value)}
              style={{
                width: '100%', minHeight: 520,
                background: 'transparent',
                border: 'none', outline: 'none',
                color: '#E5E7EB', fontSize: 13,
                lineHeight: 1.9, resize: 'vertical',
                padding: '20px 22px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              } as any}
              placeholder={`Escreva suas instruções estratégicas para a IRIS. Seja direto e honesto — somente você verá este conteúdo.\n\nExemplos do que você pode incluir:\n\nSOBRE A EQUIPE\n• "O João tende a oferecer desconto com facilidade. Não ofereça desconto sem que o próprio cliente solicite explicitamente."\n• "A Maria está em treinamento — se um cliente perguntar sobre prazo de entrega, diga que o representante confirmará."\n\nSOBRE OS CLIENTES\n• "O cliente Autopeças Moreno (São Paulo) tem histórico de inadimplência. Confirme o pedido somente com pagamento antecipado."\n• "O cliente Distribuidora Delta compra em grande volume mas negocia muito. Não ceda antes de consultar o representante."\n\nSOBRE PRODUTOS E ESTRATÉGIA\n• "Nossa prioridade este trimestre é crescer na linha de filtros e pastilhas de freio. Sempre sugira essas categorias."\n• "Pedido mínimo: R$ 300,00. Não aceite pedidos abaixo disso sem aprovação prévia."\n\nSOBRE O ATENDIMENTO\n• "Clientes de oficina mecânica preferem respostas técnicas. Seja mais detalhado com eles."\n• "Se o cliente mencionar concorrente, destaque nosso prazo de entrega de 24h como diferencial."`}
            />
          )}
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{error}</p>
        )}

      </div>
        </div>
        )}
      </div>
    </>
  );
}
