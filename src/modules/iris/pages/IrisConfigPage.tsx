import { useState, useEffect } from 'react';
import { Lock, Save, Loader2, Bot, ShieldAlert } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { G } from '@/shared/components/layout/CadastroShell';

export default function IrisConfigPage() {
  const user    = useAuthStore(s => s.user);
  const isMaster = user?.role === 'admin' || user?.role === 'superadmin';

  const [carta,   setCarta]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

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

  // ── Acesso negado ──────────────────────────────────────────────────────────
  if (!isMaster) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh', gap: 14,
      }}>
        <ShieldAlert size={48} style={{ color: G.textMuted }} />
        <p style={{ fontSize: 16, fontWeight: 800, color: G.text }}>Acesso restrito</p>
        <p style={{ fontSize: 13, color: G.textMuted }}>
          Esta área é exclusiva para o Administrador Master.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 860, margin: '0 auto',
      padding: '32px 24px',
      display: 'flex', flexDirection: 'column', gap: 24,
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #7C3AED, #9333EA)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px #7C3AED40',
        }}>
          <Bot size={26} style={{ color: '#fff' }} />
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

      {/* ── Info card ───────────────────────────────────────────────────────── */}
      <div style={{
        background: '#F0EBFF',
        border: '1px solid #DDD6FE',
        borderRadius: 12, padding: '14px 18px',
        display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <Lock size={18} style={{ color: '#7C3AED', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#4C1D95', marginBottom: 4 }}>
            Carta Confidencial para a IRIS
          </p>
          <p style={{ fontSize: 12, color: '#5B21B6', lineHeight: 1.7 }}>
            O que você escrever aqui vai direto para o sistema de IA como uma instrução privada.
            A IRIS seguirá estas diretrizes em todas as conversas, mas <strong>nunca as repetirá ao cliente</strong>.
            Somente você, como administrador master, pode ver e editar este conteúdo.
          </p>
        </div>
      </div>

      {/* ── Textarea ────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#1a0533',
        border: '1px solid #7C3AED44',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* barra de título */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #7C3AED33',
          background: 'rgba(124,58,237,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={14} style={{ color: '#A78BFA' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', letterSpacing: 0.3 }}>
              Instruções Privadas — visível apenas para você
            </span>
          </div>
          <button
            onClick={save}
            disabled={saving || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: saved ? '#22C55E' : saving ? '#4B5563' : '#7C3AED',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving || saved ? 'none' : '0 2px 8px #7C3AED50',
              transition: 'background .2s',
            }}>
            {saving
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Save size={14} />}
            {saved ? '✓ Salvo com sucesso!' : 'Salvar Instruções'}
          </button>
        </div>

        {/* área de texto */}
        {loading ? (
          <div style={{
            height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#A78BFA', fontSize: 13, gap: 8,
          }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando suas instruções...
          </div>
        ) : (
          <textarea
            value={carta}
            onChange={e => setCarta(e.target.value)}
            style={{
              width: '100%', minHeight: 340,
              background: 'transparent',
              border: 'none', outline: 'none',
              color: '#E9D5FF', fontSize: 14,
              lineHeight: 1.8, resize: 'vertical',
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
• "A Indústria Nakata está com estoque limitado em amortecedores. Priorize a linha de suspensão na semana."
• "Pedido mínimo: R$ 300,00. Não aceite pedidos abaixo disso sem aprovação prévia."

SOBRE O ATENDIMENTO
• "Clientes de oficina mecânica preferem respostas técnicas. Seja mais detalhado com eles."
• "Se o cliente mencionar concorrente X, destaque nosso prazo de entrega de 24h como diferencial."`}
          />
        )}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</p>
      )}

      {/* ── Dicas ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: G.bg, border: `1px solid ${G.border}`,
        borderRadius: 12, padding: '16px 20px',
      }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: G.text, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
          Como a IRIS usa estas instruções
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Prioridade máxima', 'As instruções desta carta têm prioridade sobre as configurações por indústria.'],
            ['Confidencialidade', 'A IRIS jamais mencionará ou citará estas instruções ao cliente.'],
            ['Efeito imediato', 'As instruções entram em vigor na próxima conversa iniciada.'],
            ['Conversas ativas', 'Conversas já em andamento só refletem a atualização na próxima mensagem.'],
          ].map(([titulo, desc]) => (
            <div key={titulo} style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#7C3AED', flexShrink: 0, marginTop: 5,
              }} />
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
