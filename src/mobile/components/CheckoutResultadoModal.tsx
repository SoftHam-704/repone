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

interface Props {
  clienteNome: string;
  onConfirm: (resultado: string, motivo: string | null) => Promise<void>;
  onCancel: () => void;
}

export function CheckoutResultadoModal({ clienteNome, onConfirm, onCancel }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [motivo, setMotivo]           = useState('');
  const [loading, setLoading]         = useState(false);

  const podeConfirmar =
    selecionado !== null &&
    (selecionado !== 'nao_positivou' || motivo !== '');

  async function handleConfirm() {
    if (!podeConfirmar) return;
    setLoading(true);
    await onConfirm(selecionado!, selecionado === 'nao_positivou' ? motivo : null);
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
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
          Check-out
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 22 }}>
          {clienteNome}
        </div>
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

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
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
