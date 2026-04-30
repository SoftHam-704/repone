import { RefreshCw } from 'lucide-react';

interface Props {
  onSync:     () => void;
  syncing:    boolean;
  progress:   number;
  queueCount: number;
  lastSync:   string | null;
  style?:     React.CSSProperties;
}

export function SyncButton({ onSync, syncing, progress, queueCount, lastSync, style }: Props) {
  const fmtSync = lastSync
    ? new Date(lastSync).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Nunca sincronizado';

  return (
    <div style={{
      background: 'var(--sand-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      ...style,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy-muted)' }}>
          Último sync: {fmtSync}
        </div>
        {syncing && (
          <div style={{ marginTop: 6, height: 4, borderRadius: 4,
            background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`,
              background: 'var(--mustard)', transition: 'width 0.4s' }} />
          </div>
        )}
      </div>
      {queueCount > 0 && (
        <div style={{ background: '#DC2626', color: '#FFF', borderRadius: 10,
          padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {queueCount} pendente{queueCount > 1 ? 's' : ''}
        </div>
      )}
      <button
        onClick={onSync}
        disabled={syncing}
        style={{
          background: 'var(--navy)', color: 'var(--mustard)', border: 'none',
          borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 11,
          cursor: syncing ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          opacity: syncing ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
        {syncing ? `${progress}%` : 'Sincronizar para visita'}
      </button>
    </div>
  );
}
