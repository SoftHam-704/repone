import { useState } from 'react'
import { X, LightbulbIcon } from 'lucide-react'

const G = {
  text: '#28374A', textSec: '#3D5265', textMuted: '#6B7A8A',
  mustard: '#FFD200', border: '#D6CCBA', card: '#F2EDE4',
}

interface Props {
  storageKey: string
  icon: React.ReactNode
  title: string
  description: string
  tip?: string
}

export function InfoBanner({ storageKey, icon, title, description, tip }: Props) {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'dismissed' } catch { return true }
  })

  if (!visible) return null

  const dismiss = () => {
    try { localStorage.setItem(storageKey, 'dismissed') } catch {}
    setVisible(false)
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, #28374A08 0%, #FFD20010 100%)`,
      border: `1px solid ${G.mustard}40`,
      borderLeft: `4px solid ${G.mustard}`,
      borderRadius: 14,
      padding: '16px 20px',
      marginBottom: 20,
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      {/* Ícone */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: G.mustard + '20', border: `1px solid ${G.mustard}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: G.textSec, lineHeight: 1.6 }}>
          {description}
        </div>
        {tip && (
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: G.textMuted,
          }}>
            <LightbulbIcon size={11} style={{ color: G.mustard, flexShrink: 0 }} />
            <span>{tip}</span>
          </div>
        )}
      </div>

      {/* Botão dispensar */}
      <button
        onClick={dismiss}
        title="Dispensar"
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 8,
          border: `1px solid ${G.border}`, background: G.card,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={13} style={{ color: G.textMuted }} />
      </button>
    </div>
  )
}
