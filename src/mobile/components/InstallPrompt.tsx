import { useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { usePWAInstall } from '@/shared/hooks/usePWAInstall';

/**
 * Banner discreto de instalação do PWA. Aparece automaticamente quando:
 *   - Android/Chrome dispara beforeinstallprompt (1 toque instala)
 *   - iOS Safari acessando pela web (abre modal com passo-a-passo)
 * Esconde quando o app já está em modo standalone ou o usuário dispensou
 * há menos de 7 dias.
 */
export function InstallPrompt() {
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const { platform, shouldShow, promptInstall, dismiss } = usePWAInstall(
    () => setIosHelpOpen(true),
  );

  if (!shouldShow) return null;

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: 'linear-gradient(90deg, #28374A 0%, #1F2A3A 100%)',
        color: '#FFF',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '2px solid #FFD200',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,210,0,0.18)',
          border: '1.5px solid rgba(255,210,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Download size={18} style={{ color: '#FFD200' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>
            Instalar RepOne
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Acesso direto pelo ícone, sem precisar do navegador
          </div>
        </div>
        <button
          onClick={promptInstall}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: '#FFD200', color: '#28374A',
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Instalar
        </button>
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {iosHelpOpen && platform === 'ios' && (
        <IOSInstallSheet onClose={() => setIosHelpOpen(false)} />
      )}
    </>
  );
}

/** Bottom sheet com instrução visual de "Adicionar à Tela de Início" no iOS Safari */
function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.18s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: '#FFF',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: '20px 22px 28px',
          animation: 'slideUp 0.22s ease-out',
        }}
      >
        <div style={{
          width: 40, height: 4, borderRadius: 4,
          background: '#D4CCBA', margin: '0 auto 16px',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: '#28374A', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={20} style={{ color: '#FFD200' }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#28374A' }}>
              Instalar no iPhone/iPad
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
              Em 3 passos pelo Safari
            </div>
          </div>
        </div>

        <Step n={1}>
          Toque em <Share size={16} style={{ verticalAlign: -3, color: '#0A84FF' }} />
          <strong> Compartilhar</strong> na barra do Safari (em baixo).
        </Step>
        <Step n={2}>
          Role a lista e toque em <Plus size={16} style={{ verticalAlign: -3 }} />
          <strong> Adicionar à Tela de Início</strong>.
        </Step>
        <Step n={3}>
          Confirme tocando em <strong>Adicionar</strong>. Pronto — o ícone do RepOne
          fica na tela inicial, abre sem a barra do navegador.
        </Step>

        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 10,
          background: '#FEF3C7', border: '1px solid #FDE68A',
          fontSize: 11, color: '#92400E', lineHeight: 1.5,
        }}>
          <strong>Importante:</strong> só funciona pelo <strong>Safari</strong>.
          Se abriu pelo Chrome ou outro app, copie o link e cole no Safari primeiro.
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 18, width: '100%',
            padding: '12px 16px', borderRadius: 12, border: 'none',
            background: '#28374A', color: '#FFD200',
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}
        >
          Entendi
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 0', borderBottom: '1px solid #F3F0E8',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: '#FFD200', color: '#28374A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 900, flexShrink: 0,
      }}>
        {n}
      </div>
      <div style={{ fontSize: 13, color: '#28374A', lineHeight: 1.5, paddingTop: 3 }}>
        {children}
      </div>
    </div>
  );
}
