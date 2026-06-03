import { X } from 'lucide-react';

export interface HelpItem {
  icon: string;
  title: string;
  text: string;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  title?:   string;
  items:    HelpItem[];
}

export function HelpSheet({ open, onClose, title = 'Como usar', items }: Props) {
  if (!open) return null;
  return (
    <>
      {/* overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(40,55,74,0.55)',
      }} />

      {/* sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '0 0 env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 40px rgba(40,55,74,0.18)',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
        </div>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%',
              background: 'var(--navy)', display: 'flex', alignItems: 'center',
              justifyContent: 'center' }}>
              <span style={{ color: '#FFD200', fontWeight: 900, fontSize: 14 }}>?</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none',
            borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* items */}
        <div style={{ overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14,
              background: '#F8FAFC', borderRadius: 12, padding: '12px 14px' }}>
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)',
                  marginBottom: 3 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.55 }}>
                  {item.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
