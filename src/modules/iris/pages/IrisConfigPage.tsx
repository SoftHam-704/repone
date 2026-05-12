import { useState, useEffect } from 'react';
import { Lock, Save, Loader2, ShieldAlert, Sparkles, FileText } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { G } from '@/shared/components/layout/CadastroShell';

const NAVY      = '#1C2D40';
const NAVY_DARK = '#0F1D2B';
const NAVY_MID  = '#162436';
const GOLD      = '#B8922A';
const GOLD_BG   = '#FDF6E3';
const GOLD_BORDER = '#D4B87A';
const TEXT_DARK = '#C8D6E2';
const BORDER_DARK = 'rgba(255,255,255,0.07)';

export default function IrisConfigPage() {
  const user     = useAuthStore(s => s.user);
  const isMaster = user?.role === 'admin' || user?.role === 'superadmin';

  const [carta,     setCarta]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error,     setError]     = useState('');

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
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12, flexShrink: 0,
          background: NAVY,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(28,45,64,0.25)',
        }}>
          <FileText size={24} style={{ color: '#FFD200' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: G.text, margin: 0 }}>
            IRIS — Configuração Estratégica
          </h1>
          <p style={{ fontSize: 12, color: G.textMuted, marginTop: 3 }}>
            Instruções confidenciais que moldam o comportamento da IA em todos os atendimentos
          </p>
        </div>
      </div>

      {/* ── Info card ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: GOLD_BG,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: 10, padding: '14px 18px',
        display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <Lock size={16} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#7A5C10', marginBottom: 4 }}>
            Carta Confidencial para a IRIS
          </p>
          <p style={{ fontSize: 12, color: '#8B6914', lineHeight: 1.7 }}>
            O que você escrever aqui vai direto para o sistema de IA como uma instrução privada.
            A IRIS seguirá estas diretrizes em todas as conversas, mas{' '}
            <strong>nunca as repetirá ao cliente</strong>.
            Somente você, como administrador master, pode ver e editar este conteúdo.
          </p>
        </div>
      </div>

      {/* ── Editor ────────────────────────────────────────────────────────────── */}
      <div style={{ background: NAVY_DARK, border: `1px solid ${BORDER_DARK}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* barra de título */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: `1px solid ${BORDER_DARK}`,
          background: NAVY_MID,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={13} style={{ color: '#6B8CAE' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B8CAE', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Instruções Privadas — visível apenas para você
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* Botão Aprimorar */}
            <button
              onClick={enhance}
              disabled={enhancing || saving || loading || !carta.trim()}
              title="Usa Claude para reestruturar e melhorar clareza das instruções"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 7, border: `1px solid ${GOLD_BORDER}`,
                background: enhancing ? 'transparent' : GOLD_BG,
                color: GOLD, fontSize: 12, fontWeight: 700,
                cursor: (enhancing || !carta.trim()) ? 'not-allowed' : 'pointer',
                opacity: !carta.trim() ? 0.4 : 1,
                transition: 'all .2s',
              }}>
              {enhancing
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: GOLD }} />
                : <Sparkles size={13} />}
              {enhancing ? 'Aprimorando...' : 'Aprimorar com IA'}
            </button>

            {/* Botão Salvar */}
            <button
              onClick={save}
              disabled={saving || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 18px', borderRadius: 7, border: 'none',
                background: saved ? '#2D6A4F' : saving ? '#2C3E50' : NAVY,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
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
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B8CAE', fontSize: 13, gap: 8 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando suas instruções...
          </div>
        ) : (
          <textarea
            value={carta}
            onChange={e => setCarta(e.target.value)}
            style={{
              width: '100%', minHeight: 360,
              background: 'transparent',
              border: 'none', outline: 'none',
              color: TEXT_DARK, fontSize: 13,
              lineHeight: 1.9, resize: 'vertical',
              padding: '20px 22px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            } as any}
            placeholder={`Escreva suas instruções estratégicas para a IRIS. Seja direto e honesto — somente você verá este conteúdo.

Exemplos do que você pode incluir:

SOBRE A EQUIPE
• "O João tende a oferecer desconto com facilidade. Não ofereça desconto sem que o próprio cliente solicite explicitamente."
• "A Maria está em treinamento — se um cliente perguntar sobre prazo de entrega, diga que o representante confirmará."

SOBRE OS CLIENTES
• "O cliente Autopeças Moreno (São Paulo) tem histórico de inadimplência. Confirme o pedido somente com pagamento antecipado."
• "O cliente Distribuidora Delta compra em grande volume mas negocia muito. Não ceda antes de consultar o representante."

SOBRE PRODUTOS E ESTRATÉGIA
• "Nossa prioridade este trimestre é crescer na linha de filtros e pastilhas de freio. Sempre sugira essas categorias."
• "Pedido mínimo: R$ 300,00. Não aceite pedidos abaixo disso sem aprovação prévia."

SOBRE O ATENDIMENTO
• "Clientes de oficina mecânica preferem respostas técnicas. Seja mais detalhado com eles."
• "Se o cliente mencionar concorrente, destaque nosso prazo de entrega de 24h como diferencial."`}
          />
        )}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{error}</p>
      )}

      {/* ── Dicas ─────────────────────────────────────────────────────────────── */}
      <div style={{ background: G.card ?? '#fff', border: `1px solid ${G.border}`, borderRadius: 10, padding: '16px 20px' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>
          Como a IRIS usa estas instruções
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Prioridade máxima', 'As instruções desta carta têm prioridade sobre as configurações por indústria.'],
            ['Confidencialidade', 'A IRIS jamais mencionará ou citará estas instruções ao cliente.'],
            ['Efeito imediato', 'As instruções entram em vigor na próxima conversa iniciada.'],
            ['Aprimorar com IA', 'O botão "Aprimorar" usa Claude Opus para estruturar e clarear seu texto antes de salvar.'],
          ].map(([titulo, desc]) => (
            <div key={titulo} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: NAVY, flexShrink: 0, marginTop: 6 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: G.text }}>{titulo}</p>
                <p style={{ fontSize: 11, color: G.textMuted, lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
