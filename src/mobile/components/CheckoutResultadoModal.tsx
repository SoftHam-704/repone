import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const RESULTADOS = [
  { value: 'positivou',     emoji: '✅', label: 'Positivou',     sub: 'Saí com pedido' },
  { value: 'nao_positivou', emoji: '❌', label: 'Não positivou', sub: 'Sem pedido desta vez' },
  { value: 'reagendou',     emoji: '📅', label: 'Reagendou',     sub: 'Marcamos novo contato' },
  { value: 'ausente',       emoji: '🚪', label: 'Ausente',       sub: 'Loja fechada / sem responsável' },
] as const;

const MOTIVOS = [
  'Sem estoque / estoque cheio',
  'Preço acima do mercado',
  'Concorrência',
  'Sem interesse no momento',
  'Comprador ausente',
  'Outro',
];

const MARKETING_OPCOES = [
  { value: 'dia_foco',       emoji: '🎯', label: 'Dia Foco' },
  { value: 'relacionamento', emoji: '🤝', label: 'Relacionamento' },
  { value: 'sellout_cliente',emoji: '📦', label: 'Sell-out Cliente' },
] as const;

type MarketingValue = 'dia_foco' | 'relacionamento' | 'sellout_cliente';

interface Props {
  clienteNome: string;
  onConfirm: (resultado: string, motivo: string | null, marketing: MarketingValue | null) => Promise<void>;
  onCancel: () => void;
}

export function CheckoutResultadoModal({ clienteNome, onConfirm, onCancel }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [motivo,      setMotivo]      = useState('');
  const [marketing,   setMarketing]   = useState<MarketingValue | null>(null);
  const [loading,     setLoading]     = useState(false);

  const podeConfirmar =
    (selecionado !== null || marketing !== null) &&
    (selecionado !== 'nao_positivou' || motivo !== '');

  async function handleConfirm() {
    if (!podeConfirmar) return;
    setLoading(true);
    await onConfirm(
      selecionado ?? 'visita_marketing',
      selecionado === 'nao_positivou' ? motivo : null,
      marketing,
    );
    setLoading(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#1E2A3A', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px',
        overflowY: 'auto', maxHeight: '92vh',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
          Check-out
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 22 }}>
          {clienteNome}
        </div>

        {/* ── Como foi a visita ── */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Como foi a visita?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {RESULTADOS.map(r => (
            <button
              key={r.value}
              onClick={() => { setSelecionado(r.value); setMotivo(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px', borderRadius: 14,
                border: selecionado === r.value
                  ? '2px solid #FFD200'
                  : '1px solid rgba(255,255,255,0.1)',
                background: selecionado === r.value
                  ? 'rgba(255,210,0,0.12)'
                  : 'rgba(255,255,255,0.05)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{r.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{r.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {selecionado === 'nao_positivou' && (
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 14,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: motivo ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13,
              appearance: 'none',
            }}>
            <option value=''>Selecione o motivo *</option>
            {MOTIVOS.map(m => (
              <option key={m} value={m} style={{ background: '#1E2A3A', color: '#fff' }}>{m}</option>
            ))}
          </select>
        )}

        {/* ── Marketing (opcional) ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          marginTop: 6, paddingTop: 18, marginBottom: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Marketing <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)', textTransform: 'none', fontSize: 10 }}>— opcional</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {MARKETING_OPCOES.map(op => {
              const ativo = marketing === op.value;
              return (
                <button
                  key={op.value}
                  onClick={() => setMarketing(ativo ? null : op.value as MarketingValue)}
                  style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 6px', borderRadius: 12,
                    border: ativo ? '2px solid #A78BFA' : '1px solid rgba(255,255,255,0.1)',
                    background: ativo ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 20 }}>{op.emoji}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
                    color: ativo ? '#C4B5FD' : 'rgba(255,255,255,0.55)',
                  }}>{op.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Botões ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!podeConfirmar || loading}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 14, border: 'none',
              background: podeConfirmar ? '#FFD200' : 'rgba(255,255,255,0.08)',
              color: podeConfirmar ? '#1E2A3A' : 'rgba(255,255,255,0.25)',
              fontSize: 14, fontWeight: 800,
              cursor: podeConfirmar ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : 'Confirmar Check-out'
            }
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
