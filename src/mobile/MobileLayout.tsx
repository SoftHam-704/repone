import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav }     from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { useOffline }    from './hooks/useOffline';

const HIDE_NAV = ['/mobile/pedido'];

export function MobileLayout() {
  const { isOnline } = useOffline();
  const location     = useLocation();
  const showNav      = !HIDE_NAV.some(p => location.pathname.startsWith(p));

  return (
    <div style={{ background: 'var(--sand-bg)', minHeight: '100vh',
      display: 'flex', flexDirection: 'column' }}>
      <OfflineBanner visible={!isOnline} />
      <div style={{ flex: 1, paddingBottom: showNav ? 64 : 0, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
