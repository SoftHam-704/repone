import { useState }           from 'react';
import { useNavigate }         from 'react-router-dom';
import { ChevronLeft, Tag }    from 'lucide-react';
import { HelpSheet }           from './HelpSheet';
import type { HelpItem }       from './HelpSheet';

interface Props {
  title:       string;
  showBack?:   boolean;
  showPrecos?: boolean;
  helpItems?:  HelpItem[];
}

export function MobileHeader({ title, showBack, showPrecos, helpItems }: Props) {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
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

        {helpItems && helpItems.length > 0 && (
          <button
            onClick={() => setHelpOpen(true)}
            style={{ width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,210,0,0.18)', border: '1.5px solid rgba(255,210,0,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0 }}
          >
            <span style={{ color: '#FFD200', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>?</span>
          </button>
        )}
      </header>

      {helpItems && (
        <HelpSheet
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          title="Como usar"
          items={helpItems}
        />
      )}
    </>
  );
}
