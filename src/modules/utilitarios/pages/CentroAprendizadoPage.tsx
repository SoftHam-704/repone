import { BookOpen, Download, Music, ShoppingCart, Send, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/shared/lib/api';

// ─── palette Fresh Corporate ────────────────────────────────────────────────
const C = {
  bgMain:      '#F8FAFC',
  bgSecondary: '#F1F5F9',
  card:        '#FFFFFF',
  border:      '#E2E8F0',
  textPrimary: '#1E293B',
  textSec:     '#64748B',
  textDis:     '#94A3B8',
  green:       '#10B981',
  greenDark:   '#064E4B',   // Background Narrativa
  orange:      '#FB923C',
  blue:        '#60A5FA',
  yellow:      '#EAB308',
  red:         '#DC2626',
  heroTop:     '#0F1D2B',
  heroBot:     '#1C2D40',
} as const;

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
    <div style={{ background: C.bgMain, minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.heroTop} 0%, ${C.heroBot} 100%)`,
        padding: '28px 48px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* glow decorativo */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, background: `radial-gradient(circle, ${C.yellow}12 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: `${C.yellow}18`, border: `1px solid ${C.yellow}35`,
            color: C.yellow, fontSize: 9, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', padding: '4px 10px', borderRadius: 2, marginBottom: 12,
          }}>
            <BookOpen size={10} />
            Centro de Aprendizado
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 6, margin: '0 0 6px' }}>
            Aprenda o <span style={{ color: C.yellow }}>SalesMasters</span> no seu ritmo
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.6, maxWidth: 400, margin: 0 }}>
            Manual completo, podcasts de treinamento por módulo e assistente de IA prontos para você dominar cada rotina do sistema.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 32, flexShrink: 0 }}>
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

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '32px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Podcasts */}
          <div>
            <SectionHeader tag="// Ouça" title="Podcasts de Treinamento" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PodcastCard
                episode="EPISÓDIO 01"
                title="Visão Geral do SalesMasters"
                subtitle="Todos os módulos do sistema • pt-BR"
                icon={<Music size={18} color={C.yellow} />}
                src={PODCAST_GERAL_URL}
                chapters={CHAPTERS_GERAL}
              />
              <PodcastCard
                episode="EPISÓDIO 02"
                title="Módulo de Pedidos — Do Zero ao Avançado"
                subtitle="O coração do sistema, passo a passo • pt-BR"
                icon={<ShoppingCart size={18} color={C.yellow} />}
                src={PODCAST_PEDIDOS_URL}
                chapters={CHAPTERS_PEDIDOS}
                chapterAccent={C.orange}
              />
            </div>
          </div>

          {/* Manual */}
          <div>
            <SectionHeader tag="// Leia" title="Manual do Sistema" />
            <div style={{
              background: C.card, borderRadius: 6,
              border: `1px solid ${C.border}`,
              padding: 20,
              boxShadow: '0 1px 4px rgba(30,41,59,0.06)',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 42, height: 52,
                background: C.greenDark,
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Download size={18} color="#FFFFFF" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.textPrimary, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                  Manual Completo SalesMasters V2
                </div>
                <div style={{ color: C.textSec, fontSize: 11, lineHeight: 1.4, marginBottom: 10 }}>
                  Documentação completa com todos os módulos, passo a passo em português.
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {['PDF • 141 KB', '17 Capítulos', 'Versão 2.0'].map(c => (
                    <span key={c} style={{
                      background: C.bgSecondary, color: C.textSec,
                      fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
                      padding: '3px 8px', borderRadius: 3,
                      border: `1px solid ${C.border}`,
                    }}>{c}</span>
                  ))}
                </div>
                <a
                  href={MANUAL_URL}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: C.greenDark, color: '#FFFFFF',
                    fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    padding: '9px 18px', borderRadius: 4, textDecoration: 'none',
                  }}
                >
                  <Download size={12} />
                  BAIXAR MANUAL
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Coluna direita — Chat */}
        <div style={{ position: 'sticky', top: 20 }}>
          <SectionHeader tag="// Pergunte" title="Assistente de Treinamento" />
          <TrainingChat />
        </div>

      </div>
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
  return (
    <div style={{
      background: C.card,
      borderRadius: 6,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(30,41,59,0.06)',
      display: 'grid',
      gridTemplateColumns: '55% 45%',
    }}>
      {/* Player — dark */}
      <div style={{ background: C.heroTop, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36,
            background: `${C.yellow}18`, border: `1px solid ${C.yellow}35`,
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ color: C.yellow, fontSize: 8, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>{episode}</div>
            <div style={{ color: '#F8FAFC', fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <audio controls style={{ width: '100%', borderRadius: 3, height: 30 }} src={src} />
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, marginTop: 7, textAlign: 'center' }}>
          🎙️ Gerado com Google NotebookLM + IA
        </p>
      </div>

      {/* Chapters — light */}
      <div style={{ padding: '14px 16px', overflowY: 'auto', maxHeight: 180, background: C.card }}>
        {/* TableHead style */}
        <div style={{
          color: C.textSec, fontSize: 10, fontWeight: 500,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: 8, paddingBottom: 6,
          borderBottom: `1px solid ${C.border}`,
        }}>
          Índice
        </div>
        {/* TableCell style rows */}
        {chapters.map((ch, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 0',
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      boxShadow: '0 1px 4px rgba(30,41,59,0.06)',
      display: 'flex', flexDirection: 'column', gap: 0,
      overflow: 'hidden',
      minHeight: 560,
    }}>

      {/* Messages area */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: 440,
        background: C.bgMain,
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
            color: m.role === 'assistant' ? '#F8FAFC' : C.textPrimary,
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
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div style={{
          padding: '10px 16px',
          borderTop: `1px solid ${C.border}`,
          background: C.bgMain,
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
        background: C.card,
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
            background: C.bgMain,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: '9px 13px',
            color: C.textPrimary,
            fontSize: 13,
            outline: 'none',
            fontFamily: "'IBM Plex Sans', sans-serif",
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
