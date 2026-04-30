import { WifiOff } from 'lucide-react';

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      background: '#92400E', color: '#FEF3C7',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12, fontWeight: 600,
    }}>
      <WifiOff size={14} />
      Sem conexão — trabalhando com dados locais
    </div>
  );
}
