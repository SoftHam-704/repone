import { BookOpen, Download, Music, ShoppingCart, Send, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/shared/lib/api';

// ─── palette Fresh Corporate ────────────────────────────────────────────────
const C = {
  bgMain:      'radial-gradient(120% 100% at 30% 20%, #16233A 0%, #0B0F19 55%, #070A12 100%)',
  bgSecondary: 'rgba(255, 255, 255, 0.04)',
  card:        'linear-gradient(145deg, #111827 0%, #0B0F19 100%)',
  border:      'rgba(14, 165, 233, 0.15)',
  textPrimary: '#FFFFFF',
  textSec:     '#9CA3AF',
  textDis:     'rgba(255, 255, 255, 0.1)',
  green:       '#0EA5E9',
  greenDark:   '#1E293B',
  orange:      '#F59E0B',
  blue:        '#38BDF8',
  yellow:      '#FFD200',
  red:         '#EF4444',
  heroTop:     '#0B0F19',
  heroBot:     '#111827',
  glass:       'rgba(255,255,255,0.58)',
  glassSoft:   'rgba(255,255,255,0.40)',
  glassBorder: 'rgba(255,255,255,0.70)',
} as const;

const GLASS_BLUR = 'blur(12px)';

// ─── URLs estáticas ─────────────────────────────────────────────────────────
const PODCAST_GERAL_URL   = 'https://softham.com.br/repone/repone-treinamento.mp3';
const PODCAST_PEDIDOS_URL = 'https://softham.com.br/repone/podcast-pedidos.m4a';
const MANUAL_URL          = 'https://softham.com.br/repone/manual-repone.pdf';

const CHAPTERS_GERAL = [
  { time: '00:00', title: 'Introdução ao SalesMasters' },
  { time: '02:30', title: 'Fazendo seu primeiro pedido' },
  { time: '06:00', title: 'Gestão de clientes' },
  { time: '09:30', title: 'Painel de BI e análise' },
  { time: '14:00', title: 'CRM e agenda de visitas' },
  { time: '18:30', title: 'Campanhas e metas' },
  { time: '22:00', title: 'IRIS — Inteligência Artificial' },
];

const CHAPTERS_PEDIDOS = [
  { time: '00:00', title: 'O papel do representante no ciclo comercial' },
  { time: '03:00', title: 'O que precisa estar pronto antes do pedido' },
  { time: '07:00', title: 'Estrutura: F1, F3, F4 e F5' },
  { time: '12:00', title: 'Criando um pedido — passo a passo' },
  { time: '17:00', title: 'Como os descontos funcionam na prática' },
  { time: '22:00', title: 'Os 8 status e o que cada um significa' },
  { time: '26:00', title: 'Importação em lote: XLS, TXT, XML e Magic Load' },
  { time: '32:00', title: 'Smart Order — pedido inteligente por histórico' },
  { time: '36:00', title: 'Carrinho em Lote — vários clientes de uma vez' },
  { time: '41:00', title: 'Baixa via XML — fechando o ciclo de faturamento' },
  { time: '46:00', title: 'Erros comuns e como evitá-los' },
  { time: '50:00', title: 'Boas práticas do representante profissional' },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CentroAprendizadoPage() {
  return (
    <div style={{
      background: C.bgMain,
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>

      {/* ── Hero (faixa enxuta, sem imagem — a Professora vive no corpo) ──── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.heroTop} 0%, ${C.heroBot} 100%)`,
        padding: '22px 48px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* glow decorativo */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, background: `radial-gradient(circle, ${C.yellow}12 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: `${C.yellow}18`, border: `1px solid ${C.yellow}35`,
            color: C.yellow, fontSize: 9, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', padding: '4px 10px', borderRadius: 2, marginBottom: 10,
          }}>
            <BookOpen size={10} />
            Centro de Aprendizado
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: 21, fontWeight: 800, lineHeight: 1.2, margin: '0 0 5px' }}>
            Aprenda o <span style={{ color: C.yellow }}>SalesMasters</span> no seu ritmo
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.6, maxWidth: 460, margin: 0 }}>
            Manual completo, podcasts de treinamento por módulo e assistente de IA prontos para você dominar cada rotina do sistema.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 32, flexShrink: 0, position: 'relative', zIndex: 2 }}>
          {[
            { value: '2',  label: 'Podcasts'     },
            { value: '17', label: 'Capítulos'    },
            { value: 'IA', label: 'Tire dúvidas' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ color: C.yellow, fontSize: 20, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body — conteúdo à esquerda, Professora IRIS à direita ─────────── */}
      <div className="ca-body" style={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 420 }}>

        {/* Professora IRIS — presença à direita do form (padrão IRIS Dev) */}
        <div className="ca-teacher" style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          backgroundImage: 'url(/iris-teacher.webp)',
          backgroundSize: 'cover', backgroundPosition: 'bottom right', backgroundRepeat: 'no-repeat',
          maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 20%, #000 58%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 20%, #000 58%)',
          opacity: 0.95, pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Conteúdo — coluna à esquerda */}
        <div className="ca-content" style={{
          position: 'relative', zIndex: 2,
          padding: '30px 48px 48px',
          display: 'flex', flexDirection: 'column', gap: 26,
        }}>

          {/* Treinamento — 2 podcasts + manual na MESMA linha (libera vertical) */}
          <div>
            <SectionHeader tag="// Treinamento" title="Podcasts & Manual" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'stretch' }}>
              <PodcastCard
                episode="EPISÓDIO 01"
                title="Visão Geral do SalesMasters"
                subtitle="Todos os módulos do sistema • pt-BR"
                icon={<Music size={16} color={C.yellow} />}
                src={PODCAST_GERAL_URL}
                chapters={CHAPTERS_GERAL}
              />
              <PodcastCard
                episode="EPISÓDIO 02"
                title="Módulo de Pedidos — Do Zero ao Avançado"
                subtitle="O coração do sistema, passo a passo • pt-BR"
                icon={<ShoppingCart size={16} color={C.yellow} />}
                src={PODCAST_PEDIDOS_URL}
                chapters={CHAPTERS_PEDIDOS}
                chapterAccent={C.orange}
              />

              {/* Manual — 3ª coluna, compacto */}
              <div style={{
                background: C.card, borderRadius: 6,
                border: `1px solid ${C.border}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
                display: 'flex', flexDirection: 'column',
                padding: '14px 16px', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, background: C.greenDark, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Download size={16} color="#FFFFFF" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.green, fontSize: 8, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>MANUAL</div>
                    <div style={{ color: C.textPrimary, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                      Manual Completo SalesMasters V2
                    </div>
                    <div style={{ color: C.textSec, fontSize: 9, marginTop: 2 }}>
                      PDF • 19 capítulos · v2.0
                    </div>
                  </div>
                </div>
                <a
                  href={MANUAL_URL}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 'auto',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: C.green, color: '#FFFFFF',
                    fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    padding: '9px 14px', borderRadius: 4, textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0284C7'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.green; }}
                >
                  <Download size={12} />
                  BAIXAR MANUAL
                </a>
              </div>
            </div>
          </div>

          {/* Assistente */}
          <div>
            <SectionHeader tag="// Pergunte" title="Assistente de Treinamento" />
            <TrainingChat />
          </div>

        </div>
      </div>

      <style>{`
        .ca-content { max-width: 64%; }
        .ca-teacher { width: 48%; }
        @media (max-width: 1180px) {
          .ca-content { max-width: 100%; }
          .ca-teacher { display: none; }
        }
      `}</style>
    </div>
  );
}

// ─── PodcastCard ─────────────────────────────────────────────────────────────
interface PodcastCardProps {
  episode: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  src: string;
  chapters: { time: string; title: string }[];
  chapterAccent?: string;
}

function PodcastCard({ episode, title, subtitle, icon, src, chapters, chapterAccent = C.green }: PodcastCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: C.card,
      borderRadius: 6,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
    }}>
      {/* Player — dark, só o necessário */}
      <div style={{ background: C.heroTop, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34,
            background: `${C.yellow}18`, border: `1px solid ${C.yellow}35`,
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.yellow, fontSize: 8, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>{episode}</div>
            <div style={{ color: '#F8FAFC', fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <audio controls style={{ width: '100%', borderRadius: 3, height: 30 }} src={src} />
      </div>

      {/* Toggle do índice */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          borderTop: `1px solid ${C.border}`,
          padding: '9px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        <span style={{
          color: C.textSec, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {open ? '▾' : '▸'} Índice — {chapters.length} capítulos
        </span>
        <span style={{ color: C.textDis, fontSize: 9 }}>🎙️ Google NotebookLM + IA</span>
      </button>

      {/* Chapters — colapsável */}
      {open && (
        <div style={{ padding: '4px 16px 12px', overflowY: 'auto', maxHeight: 220, background: 'transparent' }}>
          {chapters.map((ch, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              borderBottom: i < chapters.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{
                color: chapterAccent, fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10, width: 34, flexShrink: 0, fontWeight: 600,
              }}>
                {ch.time}
              </span>
              <span style={{ color: C.textPrimary, fontSize: 12, lineHeight: 1.4 }}>
                {ch.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TrainingChat ─────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED = [
  'Como duplicar um pedido?',
  'O que é o Smart Order?',
  'Como funciona a Curva ABC?',
  'Diferença entre Sell-In e Sell-Out',
];

function TrainingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou a IRIS, assistente de treinamento do SalesMasters. Pergunte qualquer coisa sobre o sistema.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rola APENAS o container de mensagens — nunca a página.
  // scrollIntoView() borbulharia pros ancestrais e arrastaria o app inteiro.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: question };
    const history = messages.slice(1);
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/training/ask', { question, history });
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao consultar a IA. Verifique sua conexão e tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: C.card,
      borderRadius: 6,
      border: `1px solid ${C.border}`,
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', gap: 0,
      overflow: 'hidden',
      minHeight: 480,
    }}>

      {/* Messages area */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: 380,
        background: 'transparent',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.6,
            maxWidth: '88%',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'assistant' ? C.greenDark : C.bgSecondary,
            color: '#FFFFFF',
            border: m.role === 'user' ? `1px solid ${C.border}` : 'none',
          }}>
            {m.role === 'assistant' ? <MarkdownLite text={m.content} /> : m.content}
          </div>
        ))}
        {loading && (
          <div style={{
            padding: '10px 14px', borderRadius: 6, fontSize: 13,
            alignSelf: 'flex-start',
            background: C.greenDark,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Loader2 size={13} color="#F8FAFC" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(248,250,252,0.7)' }}>Pensando...</span>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div style={{
          padding: '10px 16px',
          borderTop: `1px solid ${C.border}`,
          background: C.bgSecondary,
          display: 'flex', flexWrap: 'wrap', gap: 6,
        }}>
          <div style={{ width: '100%', color: C.textSec, fontSize: 10, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
            Sugestões
          </div>
          {SUGGESTED.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{
                background: C.card, border: `1px solid ${C.border}`,
                color: C.textPrimary, fontSize: 11, padding: '5px 11px',
                borderRadius: 4, cursor: 'pointer', fontWeight: 500,
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = C.green)}
              onMouseOut={e => (e.currentTarget.style.borderColor = C.border)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${C.border}`,
        background: C.heroTop,
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Pergunte sobre o SalesMasters..."
          disabled={loading}
          style={{
            flex: 1,
            background: '#0B0F19',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '9px 13px',
            color: C.textPrimary,
            fontSize: 13,
            outline: 'none',
            fontFamily: "'IBM Plex Sans', sans-serif",
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = '#0EA5E9';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.15)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? C.textDis : C.greenDark,
            border: 'none', borderRadius: 4,
            padding: '9px 14px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <Send size={15} color="#F8FAFC" />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── MarkdownLite ─────────────────────────────────────────────────────────────
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, i) => {
        // headings
        if (line.startsWith('### ')) return <strong key={i} style={{ fontSize: 13, display: 'block', marginTop: 6 }}>{line.slice(4)}</strong>;
        if (line.startsWith('## '))  return <strong key={i} style={{ fontSize: 14, display: 'block', marginTop: 8 }}>{line.slice(3)}</strong>;
        if (line.startsWith('# '))   return <strong key={i} style={{ fontSize: 15, display: 'block', marginTop: 8 }}>{line.slice(2)}</strong>;
        // horizontal rule
        if (/^---+$/.test(line.trim())) return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '4px 0' }} />;
        // bullet
        if (line.startsWith('- ') || line.startsWith('* ')) return <span key={i} style={{ display: 'block', paddingLeft: 12 }}>• {renderInline(line.slice(2))}</span>;
        // numbered list
        if (/^\d+\.\s/.test(line)) return <span key={i} style={{ display: 'block', paddingLeft: 12 }}>{renderInline(line)}</span>;
        // empty line
        if (line.trim() === '') return <span key={i} style={{ display: 'block', height: 4 }} />;
        // normal
        return <span key={i} style={{ display: 'block' }}>{renderInline(line)}</span>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // bold **text** and *text*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*')  && p.endsWith('*'))  return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
      <span style={{
        color: C.green, fontSize: 9, fontWeight: 700,
        letterSpacing: 3, textTransform: 'uppercase',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        {tag}
      </span>
      <span style={{ color: C.textPrimary, fontSize: 17, fontWeight: 800 }}>
        {title}
      </span>
    </div>
  );
}
