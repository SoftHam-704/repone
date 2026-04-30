import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Tag } from 'lucide-react';

interface Props {
  title:       string;
  showBack?:   boolean;
  showPrecos?: boolean;
}

export function MobileHeader({ title, showBack, showPrecos }: Props) {
  const navigate = useNavigate();
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--navy)', height: 56,
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12, flexShrink: 0,
    }}>
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', padding: 4, display: 'flex' }}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <span style={{ flex: 1, color: '#FFF', fontWeight: 700, fontSize: 17,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </span>
      {showPrecos && (
        <button
          onClick={() => navigate('/mobile/precos')}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--mustard)', padding: 4,
            display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Tag size={18} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>Preços</span>
        </button>
      )}
    </header>
  );
}
