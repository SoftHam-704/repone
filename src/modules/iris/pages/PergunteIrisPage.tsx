import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Trash2, Wand2, Bot, User as UserIcon, CheckCircle2, X, Download, HelpCircle, Cpu, Database, TrendingUp, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/shared/lib/api';
import { useAuthStore, iaLigada, podeUsarIris } from '@/shared/stores/useAuthStore';
import { IrisArtifactRenderer, type Artifact } from '../components/IrisArtifacts';

// Exporta um nó DOM (a resposta da IRIS) pra PDF — captura tabela, KPI e gráfico (canvas).
async function exportarRespostaPdf(node: HTMLElement, titulo: string) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#FAF6EE', useCORS: true });
  const img = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const usableW = pageW - margin * 2;

  // Cabeçalho
  pdf.setFillColor(26, 45, 66);
  pdf.rect(0, 0, pageW, 20, 'F');
  pdf.setTextColor(255, 210, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('IRIS · RepOne', margin, 13);
  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(8);
  pdf.text(new Date().toLocaleString('pt-BR'), pageW - margin, 13, { align: 'right' });

  // Imagem da resposta (paginada se passar do rodapé)
  const imgH = (canvas.height * usableW) / canvas.width;
  let y = 26;
  if (imgH <= pageH - y - margin) {
    pdf.addImage(img, 'PNG', margin, y, usableW, imgH);
  } else {
    // quebra em páginas
    let remaining = imgH, sy = 0;
    const ratio = canvas.width / usableW;
    while (remaining > 0) {
      const sliceH = Math.min(pageH - y - margin, remaining);
      const sCanvas = document.createElement('canvas');
      sCanvas.width = canvas.width;
      sCanvas.height = sliceH * ratio;
      const ctx = sCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, sy * ratio, canvas.width, sliceH * ratio, 0, 0, canvas.width, sliceH * ratio);
      pdf.addImage(sCanvas.toDataURL('image/png'), 'PNG', margin, y, usableW, sliceH);
      remaining -= sliceH; sy += sliceH;
      if (remaining > 0) { pdf.addPage(); y = margin; }
    }
  }

  const safe = titulo.replace(/[^\w\sÀ-ú-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'iris-relatorio';
  pdf.save(`${safe}.pdf`);
}

// Exemplos pra abrir a mente do REP (o "?")
const EXEMPLOS_PROMPTS = [
  { t: 'Relatório por indústria', q: 'Quanto vendi em abril de 2026 por indústria?' },
  { t: 'Vira gráfico',            q: 'Me mostra isso num gráfico' },
  { t: 'Vê no mapa',              q: 'E no mapa, como ficou por estado?' },
  { t: 'Só a análise',           q: 'Me explica como foi abril, sem tabela' },
  { t: 'Carteira parada',         q: 'Quais clientes estão parados há 90 dias?' },
  { t: 'Status da meta',          q: 'Como está minha meta deste mês?' },
];

// Paleta alinhada com o visual tecnológico escuro do Centro de Aprendizado
const C = {
  bg:        'radial-gradient(120% 100% at 72% 28%, #16233A 0%, #0B0F19 55%, #070A12 100%)',
  bgDeep:    'rgba(255, 255, 255, 0.04)',
  card:      'linear-gradient(145deg, #111827 0%, #0B0F19 100%)',
  navy:      'rgba(14, 165, 233, 0.15)',
  navyMid:   '#111827',
  text:      '#FFFFFF',
  textSec:   '#9CA3AF',
  textMuted: '#CBD5E1',
  border:    'rgba(14, 165, 233, 0.15)',
  mustard:   '#FFD200',
  mustardDk: '#F59E0B',
  success:   '#10B981',
};

interface ToolEvent {
  name: string;
  input: any;
  ms: number;
  ok: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  toolEvents?: ToolEvent[];
  artifacts?: Artifact[];
}

// Saudação por horário (frontend — instantânea, não gasta token)
function saudacaoPorHorario(nome: string): string {
  const h = new Date().getHours();
  const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (nome || '').trim().split(' ')[0] || 'REP';
  return `${periodo}, ${primeiroNome} — recebi seu pedido e já estou processando…`;
}

// Rótulos amigáveis pras ferramentas (REP não vê nome técnico)
const TOOL_LABELS: Record<string, string> = {
  consultar_vendas_periodo: 'Consultando vendas',
  clientes_sem_compra:      'Verificando carteira parada',
  meta_atual:               'Checando a meta',
};

interface ImproveResult {
  original: string;
  improved: string;
}

export default function PergunteIrisPage({ onClose }: { onClose?: () => void } = {}) {
  const user = useAuthStore(s => s.user);
  // Gerência+ (espelha o backend) + IA habilitada pro tenant.
  const autorizado = podeUsarIris(user?.role) && iaLigada(user?.iaPlanLevel);
  const inModal = !!onClose;

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improvePreview, setImprovePreview] = useState<ImproveResult | null>(null);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const bubbleRefs = useRef<Record<number, HTMLDivElement>>({});

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, ts: Date.now() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const r = await api.post('/iris/ask', {
        question: text,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      });
      const answer = r.data?.data?.answer || '(IRIS ficou em silêncio — tenta de novo)';
      const toolEvents: ToolEvent[] = r.data?.data?.tool_events || [];
      const artifacts: Artifact[] = r.data?.data?.artifacts || [];
      setMessages([...newHistory, { role: 'assistant', content: answer, ts: Date.now(), toolEvents, artifacts }]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao falar com a IRIS.';
      setMessages([...newHistory, { role: 'assistant', content: `⚠️ ${msg}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const improveCurrentPrompt = async () => {
    if (!input.trim() || improving || loading) return;
    setImproving(true);
    try {
      const r = await api.post('/iris/improve-prompt', { raw: input });
      const data = r.data?.data;
      if (data?.improved && data.improved !== data.original) {
        setImprovePreview({ original: data.original, improved: data.improved });
      } else {
        // Refinada igual à original — apenas notifica leve
        setImprovePreview({ original: input, improved: data?.improved || input });
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Não consegui melhorar agora.');
    } finally {
      setImproving(false);
    }
  };

  const acceptImproved = () => {
    if (improvePreview) setInput(improvePreview.improved);
    setImprovePreview(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    if (confirm('Limpar a conversa atual? O histórico será descartado.')) {
      setMessages([]);
      setInput('');
      inputRef.current?.focus();
    }
  };

  if (!autorizado) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 460, textAlign: 'center', padding: '40px 32px', background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 8px 24px rgba(40,55,74,0.06)' }}>
          <Sparkles size={32} style={{ color: C.mustardDk, margin: '0 auto 14px', display: 'block' }} />
          <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 8 }}>IRIS em piloto interno</h2>
          <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
            A IRIS conversacional ainda está em fase de testes na SoftHam.
            <br />Sua empresa será notificada na <strong>Central de Novidades</strong> quando for liberada.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      background: 'radial-gradient(120% 100% at 72% 28%, #16233A 0%, #0B0F19 55%, #070A12 100%)',
    }}>
      {/* IRIS como plano de fundo — lateral direita (igual ao folder de inspiração) */}
      <div className="iris-bg-image" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '54%',
        backgroundImage: 'url(/iris-tech-folder.webp)',
        backgroundSize: 'cover', backgroundPosition: 'center right',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 28%, #000 58%)',
        maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 28%, #000 58%)',
        opacity: 0.95, pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Scrim de legibilidade pro conteúdo à esquerda */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(90deg, rgba(7,10,18,0.97) 30%, rgba(7,10,18,0.5) 56%, transparent 82%)',
      }} />

      {/* Conteúdo: respostas à ESQUERDA da IRIS, prompt embaixo */}
      <div className="iris-split-container" style={{
        position: 'relative', zIndex: 2, height: '100%', maxWidth: 780,
        display: 'flex', flexDirection: 'column', minHeight: 0,
        padding: inModal ? '12px 14px' : '16px 20px',
      }}>

        {/* Folder antigo desativado — a IRIS virou o plano de fundo à direita */}
        <div className="iris-folder-panel" style={{
          display: 'none',
          width: 320,
          background: 'linear-gradient(145deg, #0B0F19 0%, #111827 100%)',
          borderRadius: 20,
          padding: 24,
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid rgba(14, 165, 233, 0.2)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {/* Luzes de fundo decorativas */}
          <div style={{
            position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '50%',
            background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)',
            pointerEvents: 'none', zIndex: 1
          }} />
          <div className="animate-pulse-glow" style={{
            position: 'absolute', bottom: '10%', right: '-10%', width: '80%', height: '40%',
            background: 'radial-gradient(circle, rgba(255,210,0,0.06) 0%, transparent 60%)',
            pointerEvents: 'none', zIndex: 1
          }} />

          {/* Header do Folder */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Cpu size={18} style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#F3F4F6', letterSpacing: '-0.02em' }}>
                    IRIS DEV
                  </span>
                  <span style={{
                    fontSize: 8, fontWeight: 900, color: '#FFD200',
                    background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.25)',
                    padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5
                  }}>ACTIVE</span>
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>Inteligência Comercial SalesMasters</div>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.25, margin: 0 }}>
                SEU COPILOTO <span style={{ color: '#0EA5E9' }}>COMERCIAL</span>
              </h2>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.4 }}>
                Análise preditiva de carteira, acompanhamento de metas em tempo real e insights inteligentes instantâneos.
              </p>
            </div>

            {/* Bullet points tecnológicos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0EA5E9', marginTop: 5, boxShadow: '0 0 8px #0EA5E9' }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#E5E7EB' }}>Identificação Preditiva</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Clientes deixando de comprar</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', marginTop: 5, boxShadow: '0 0 8px #16A34A' }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#E5E7EB' }}>Sugestão de Mix</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Oportunidades de ticket médio</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD200', marginTop: 5, boxShadow: '0 0 8px #FFD200' }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#E5E7EB' }}>Respostas Imediatas</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Dados de vendas convertidos em texto</div>
                </div>
              </div>
            </div>
          </div>

          {/* Personagem / Imagem da IRIS no Computador */}
          <div className="iris-folder-avatar-container" style={{
            position: 'relative',
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            marginTop: 16,
            marginBottom: 16,
          }}>
            {/* Hologramas / Partículas flutuantes ao redor */}
            <div className="animate-float-1" style={{ position: 'absolute', top: '10%', left: '10%', zIndex: 3, color: '#0EA5E9', filter: 'drop-shadow(0 0 6px rgba(14,165,233,0.5))' }}>
              <Database size={18} />
            </div>
            <div className="animate-float-2" style={{ position: 'absolute', bottom: '15%', left: '15%', zIndex: 3, color: '#16A34A', filter: 'drop-shadow(0 0 6px rgba(22,163,74,0.5))' }}>
              <TrendingUp size={16} />
            </div>
            <div className="animate-float-3" style={{ position: 'absolute', top: '20%', right: '10%', zIndex: 3, color: '#FFD200', filter: 'drop-shadow(0 0 6px rgba(255,210,0,0.5))' }}>
              <Zap size={15} />
            </div>

            {/* Imagem Banner Gerada */}
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              position: 'relative'
            }}>
              <img
                src="/iris-tech-folder.webp"
                alt="IRIS DEV no computador"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(11,15,25,0.8) 0%, transparent 40%)'
              }} />
            </div>
          </div>

          {/* Footer do Folder (Status do Servidor) */}
          <div style={{
            position: 'relative', zIndex: 2,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 6px #16A34A' }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Conexão Segura</span>
            </div>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#0EA5E9' }}>v2.4-hybrid</span>
          </div>
        </div>

        {/* Workspace: respostas + prompt (sobre o ambiente escuro) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'transparent',
          overflow: 'hidden'
        }}>
          {/* Header — glass dark */}
          <div style={{
            background: 'rgba(17,24,39,0.55)',
            backdropFilter: 'blur(8px)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: '1px solid rgba(14,165,233,0.18)',
            borderRadius: 16,
            marginBottom: 8, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Sparkles size={18} style={{ color: '#FFD200' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    Área de Análise
                  </span>
                  <span style={{
                    fontSize: 8, fontWeight: 800, color: '#FFD200',
                    background: 'rgba(255,210,0,0.15)', border: '1px solid rgba(255,210,0,0.3)',
                    padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase'
                  }}>PRO</span>
                </div>
                <p style={{ fontSize: 10, color: '#A8B8C4', marginTop: 1 }}>
                  Consulte tabelas, gráficos e resumos comerciais com linguagem natural
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowHelp(true)}
                title="Exemplos do que perguntar"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,210,0,0.1)', border: '1px solid rgba(255,210,0,0.2)',
                  color: '#FFD200', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}>
                <HelpCircle size={15} />
              </button>
              <button
                onClick={clearChat}
                disabled={messages.length === 0}
                title="Limpar conversa"
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: messages.length === 0 ? 'transparent' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: messages.length === 0 ? '#5C6675' : '#A8B8C4',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 5,
                  cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                }}>
                <Trash2 size={12} /> Limpar
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  title="Fechar"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#A8B8C4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}>
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Área de chat — transparente, sobre o ambiente escuro */}
          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              background: 'transparent',
              padding: '20px 4px',
              display: 'flex',
              flexDirection: 'column',
            }}>
            {messages.length === 0 && !loading && (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textMuted, margin: 'auto' }}>
                <div className="animate-float-1" style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', color: '#0EA5E9'
                }}>
                  <Sparkles size={24} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 900, color: '#F3F4F6', marginBottom: 8 }}>
                  Olá, {user?.nome?.split(' ')[0] || 'Representante'}!
                </p>
                <p style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: 440, margin: '0 auto', color: '#9CA3AF' }}>
                  Estou pronta para analisar seus dados. Envie uma pergunta sobre vendas, metas ou carteira de clientes para começar.
                </p>
                <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  <button onClick={() => setInput('Quanto vendi em abril de 2026 por indústria?')} style={{
                    padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(14,165,233,0.25)',
                    fontSize: 11, fontWeight: 600, color: '#CBD5E1', cursor: 'pointer'
                  }}>
                    📊 Faturamento por Indústria
                  </button>
                  <button onClick={() => setInput('Quais clientes não compram há mais de 90 dias?')} style={{
                    padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(14,165,233,0.25)',
                    fontSize: 11, fontWeight: 600, color: '#CBD5E1', cursor: 'pointer'
                  }}>
                    👥 Carteira Inativa
                  </button>
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              // Respostas com bloco visual (tabela/mapa/gráfico) ocupam largura total — o REP vê melhor.
              const hasArtifacts = !!(m.role === 'assistant' && m.artifacts && m.artifacts.length > 0);
              return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 14,
                gap: 10,
              }}>
                {m.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(14,165,233,0.1)', border: `1px solid rgba(14,165,233,0.25)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bot size={15} style={{ color: '#0EA5E9' }} />
                  </div>
                )}
                <div
                  className="iris-bubble"
                  ref={hasArtifacts ? (el) => { if (el) bubbleRefs.current[i] = el; } : undefined}
                  style={{
                  maxWidth: m.role === 'user' ? '76%' : hasArtifacts ? '100%' : '76%',
                  flex: hasArtifacts ? 1 : undefined,
                  padding: '12px 16px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'rgba(14, 165, 233, 0.12)' : 'linear-gradient(145deg, #111827 0%, #0B0F19 100%)',
                  color:      '#FFFFFF',
                  fontSize: 13,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                  border: m.role === 'user' ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(14, 165, 233, 0.15)',
                }}>
                  {m.role === 'user' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  ) : (
                    <>
                      {/* 1. Chips de ferramentas consultadas */}
                      {m.toolEvents && m.toolEvents.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {m.toolEvents.map((te, ti) => (
                            <span key={ti} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 10, fontWeight: 700,
                              padding: '3px 9px', borderRadius: 999,
                              background: te.ok ? 'rgba(22,163,74,0.10)' : 'rgba(180,130,11,0.10)',
                              color: te.ok ? C.success : C.mustardDk,
                              border: `1px solid ${te.ok ? 'rgba(22,163,74,0.25)' : 'rgba(180,130,11,0.25)'}`,
                            }}>
                              <CheckCircle2 size={10} />
                              {TOOL_LABELS[te.name] || te.name} · {(te.ms / 1000).toFixed(1)}s
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 2. KPIs no topo (contexto rápido) */}
                      {m.artifacts?.filter(a => a.type === 'kpi').map((a, ai) => (
                        <IrisArtifactRenderer key={`kpi-${ai}`} artifact={a} />
                      ))}

                      {/* 3. Texto narrativo da IRIS */}
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>

                      {/* 4. Tabelas e listas (detalhe) depois do texto */}
                      {m.artifacts?.filter(a => a.type !== 'kpi').map((a, ai) => (
                        <div key={`art-${ai}`} style={{ marginTop: 10 }}>
                          <IrisArtifactRenderer artifact={a} />
                        </div>
                      ))}

                      {/* 5. Botão de exportar PDF (só quando há bloco visual) */}
                      {hasArtifacts && (
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              const node = bubbleRefs.current[i];
                              if (node) {
                                setPdfLoading(i);
                                exportarRespostaPdf(node, `IRIS ${new Date().toLocaleDateString('pt-BR')}`)
                                  .finally(() => setPdfLoading(null));
                              }
                            }}
                            disabled={pdfLoading === i}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', borderRadius: 8,
                              background: 'transparent', border: `1px solid ${C.border}`,
                              color: C.textSec, fontSize: 11, fontWeight: 700,
                              cursor: pdfLoading === i ? 'wait' : 'pointer',
                            }}>
                            {pdfLoading === i
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Download size={12} />}
                            {pdfLoading === i ? 'Gerando PDF…' : 'Baixar PDF'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {m.role === 'user' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: C.navy, color: '#F5F0E5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    <UserIcon size={15} />
                  </div>
                )}
              </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(14,165,233,0.1)', border: `1px solid rgba(14,165,233,0.25)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={15} style={{ color: '#0EA5E9' }} />
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: '14px 14px 14px 4px',
                  background: 'linear-gradient(145deg, #111827 0%, #0B0F19 100%)',
                  border: '1px solid rgba(14, 165, 233, 0.15)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12.5, color: '#FFFFFF', fontWeight: 600, maxWidth: '76%',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: '#0EA5E9', flexShrink: 0 }} />
                  {/* Cordialidade só na 1ª interação; depois, status neutro adaptado ao contexto */}
                  {messages.filter(m => m.role === 'assistant').length === 0
                    ? saudacaoPorHorario(user?.nome || '')
                    : 'Consultando os dados…'}
                </div>
              </div>
            )}
          </div>

          {/* Input bar — dark glass */}
          <div style={{
            background: 'rgba(17,24,39,0.55)',
            backdropFilter: 'blur(8px)',
            padding: 14,
            border: '1px solid rgba(14,165,233,0.18)',
            borderRadius: 16,
            flexShrink: 0,
            marginTop: 8,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunta direto…  (Enter envia · Shift+Enter quebra linha)"
              disabled={loading}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 15,
                fontWeight: 400,
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                outline: 'none',
                background: 'rgba(7,10,18,0.5)',
                color: '#F3F4F6',
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: 84,
                lineHeight: 1.5,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#0EA5E9';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 12,
            }}>
              <button
                onClick={improveCurrentPrompt}
                disabled={!input.trim() || improving || loading}
                title="Melhorar a pergunta com IA (economiza tokens na resposta principal)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: !input.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(14,165,233,0.12)',
                  border: `1px solid ${!input.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.35)'}`,
                  color: !input.trim() ? '#6B7280' : '#38BDF8',
                  fontSize: 11, fontWeight: 800,
                  cursor: !input.trim() ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (input.trim() && !improving && !loading) e.currentTarget.style.background = 'rgba(14,165,233,0.12)'; }}
                onMouseLeave={e => { if (input.trim() && !improving && !loading) e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}>
                {improving ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {improving ? 'Refinando…' : 'Melhorar prompt'}
              </button>

              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>
                {input.length > 0 && `${input.length} char`}
              </div>

              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 8,
                  background: !input.trim() || loading ? 'rgba(255,255,255,0.08)' : '#FFD200',
                  border: 'none',
                  color: !input.trim() || loading ? '#6B7280' : '#0B0F19',
                  fontSize: 12, fontWeight: 900,
                  cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  letterSpacing: 0.3,
                  boxShadow: !input.trim() || loading ? 'none' : '0 4px 14px rgba(255,210,0,0.3)',
                  transition: 'all 0.2s'
                }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {loading ? 'Enviando' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Estilos do markdown renderizado nas bolhas da IRIS */}
      <style>{`
        .iris-bubble p { margin: 0 0 8px; }
        .iris-bubble p:last-child { margin-bottom: 0; }
        .iris-bubble strong { font-weight: 800; color: #FFFFFF; }
        .iris-bubble em { font-style: italic; }
        .iris-bubble ul, .iris-bubble ol { margin: 4px 0 8px 18px; padding: 0; }
        .iris-bubble li { margin-bottom: 3px; }
        .iris-bubble h1, .iris-bubble h2, .iris-bubble h3 {
          font-weight: 900; color: #38BDF8;
          margin: 12px 0 6px; letter-spacing: -0.01em;
        }
        .iris-bubble h1 { font-size: 15px; }
        .iris-bubble h2 { font-size: 14px; }
        .iris-bubble h3 { font-size: 13px; }
        .iris-bubble hr {
          border: none; border-top: 1px solid ${C.border};
          margin: 10px 0;
        }
        .iris-bubble code {
          font-family: 'SF Mono', Consolas, monospace;
          font-size: 12px;
          background: rgba(255,255,255,0.06);
          padding: 1px 5px;
          border-radius: 4px;
          color: #38BDF8;
        }
        .iris-bubble pre {
          background: #0B0F19; color: #F3F4F6;
          padding: 10px 12px; border-radius: 8px;
          font-size: 11.5px; overflow-x: auto;
          margin: 8px 0;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .iris-bubble pre code {
          background: transparent; color: inherit; padding: 0;
        }
        .iris-bubble blockquote {
          border-left: 3px solid ${C.mustard};
          padding-left: 10px; margin: 8px 0;
          color: ${C.textSec}; font-style: italic;
        }
        .iris-bubble table {
          border-collapse: collapse; width: 100%;
          margin: 8px 0; font-size: 12px;
        }
        .iris-bubble th, .iris-bubble td {
          border: 1px solid ${C.border};
          padding: 6px 9px; text-align: left;
        }
        .iris-bubble th {
          background: rgba(255,255,255,0.04);
          font-weight: 800; color: #FFFFFF;
          font-size: 10.5px; text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .iris-bubble td:has(+ td:last-child),
        .iris-bubble td:last-child { font-family: 'SF Mono', Consolas, monospace; font-weight: 600; }
        .iris-bubble a {
          color: #38BDF8; text-decoration: underline;
        }

        /* ── Identidade IRIS Dev: hologramas flutuantes + glow ── */
        @keyframes irisFloat {
          0%, 100% { transform: translateY(0) translateX(0); }
          50%      { transform: translateY(-10px) translateX(4px); }
        }
        @keyframes irisPulseGlow {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        .animate-float-1     { animation: irisFloat 4s   ease-in-out infinite;        }
        .animate-float-2     { animation: irisFloat 5s   ease-in-out infinite 0.5s;   }
        .animate-float-3     { animation: irisFloat 3.5s ease-in-out infinite 1s;     }
        .animate-pulse-glow  { animation: irisPulseGlow 4s ease-in-out infinite;      }

        /* ── Responsivo: colapsa o folder em telas estreitas ── */
        @media (max-width: 900px) {
          .iris-split-container { flex-direction: column !important; gap: 12px !important; }
          .iris-folder-panel {
            width: 100% !important;
            flex-direction: row !important;
            align-items: center !important;
            padding: 14px 16px !important;
          }
          .iris-folder-avatar-container { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-float-1, .animate-float-2, .animate-float-3, .animate-pulse-glow { animation: none !important; }
        }
      `}</style>

      {/* Modal "?" — exemplos pra abrir a mente do REP */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,35,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto',
              background: C.card, borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #1A2D42 0%, #28374A 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Sparkles size={18} style={{ color: '#FFD200' }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#F5F0E5' }}>O que dá pra perguntar?</div>
                  <div style={{ fontSize: 11, color: '#A8B8C4', marginTop: 1 }}>Toque num exemplo pra mandar na hora</div>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', color: '#A8B8C4', padding: 4,
              }}>
                <X size={16} />
              </button>
            </div>

            {/* Exemplos */}
            <div style={{ padding: '16px 20px 22px' }}>
              <p style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.55, marginBottom: 14 }}>
                A IRIS consulta seus dados de verdade e mostra do jeito que você pedir — <strong style={{ color: C.text }}>tabela, gráfico, mapa ou só a análise</strong>. Veja:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXEMPLOS_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { setShowHelp(false); send(ex.q); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      padding: '11px 14px', borderRadius: 12,
                      background: C.bgDeep, border: `1px solid ${C.border}`,
                      cursor: 'pointer', width: '100%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.mustard; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
                    <span style={{
                      fontSize: 9, fontWeight: 900, color: C.mustardDk,
                      background: 'rgba(184,134,11,0.12)', border: '1px solid rgba(184,134,11,0.25)',
                      padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>{ex.t}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>"{ex.q}"</span>
                    <Send size={13} style={{ color: C.textMuted, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.55, marginTop: 14, fontStyle: 'italic' }}>
                Dica: depois de ver uma tabela, peça "<strong style={{ color: C.textSec }}>me mostra num gráfico</strong>" ou "<strong style={{ color: C.textSec }}>e no mapa?</strong>" — ela adapta na hora.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de preview da varinha mágica */}
      {improvePreview && (
        <div
          onClick={() => setImprovePreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,35,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580, width: '100%',
              background: C.card, borderRadius: 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}>
            <div style={{
              padding: '16px 22px',
              borderBottom: `1px solid ${C.border}`,
              background: 'linear-gradient(135deg, rgba(255,210,0,0.10) 0%, transparent 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Wand2 size={16} style={{ color: C.mustardDk }} />
                <span style={{ fontSize: 14, fontWeight: 900, color: C.text }}>Pergunta refinada pela IRIS</span>
              </div>
              <button onClick={() => setImprovePreview(null)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.textMuted, padding: 4,
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                ANTES
              </div>
              <div style={{
                padding: '10px 12px', borderRadius: 8, background: C.bgDeep,
                fontSize: 12.5, color: C.textSec, marginBottom: 14, lineHeight: 1.5,
              }}>
                {improvePreview.original}
              </div>

              <div style={{ fontSize: 10, fontWeight: 800, color: C.mustardDk, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                ✨ DEPOIS
              </div>
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,210,0,0.10)',
                border: '1px solid rgba(255,210,0,0.3)',
                fontSize: 13, color: C.text, marginBottom: 18, lineHeight: 1.5, fontWeight: 600,
              }}>
                {improvePreview.improved}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setImprovePreview(null)} style={{
                  padding: '8px 16px', borderRadius: 9,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  Cancelar
                </button>
                <button onClick={acceptImproved} style={{
                  padding: '8px 18px', borderRadius: 9,
                  background: C.navy, border: 'none', color: C.mustard,
                  fontSize: 12, fontWeight: 900, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  boxShadow: '0 3px 10px rgba(26,45,66,0.25)',
                }}>
                  <CheckCircle2 size={13} /> Usar pergunta refinada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
