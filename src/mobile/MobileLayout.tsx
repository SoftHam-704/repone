import { Outlet } from 'react-router-dom';
import { BottomNav }     from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { useOffline }    from './hooks/useOffline';

export function MobileLayout() {
  const { isOnline } = useOffline();
  return (
    <div style={{ background: 'var(--sand-bg)', minHeight: '100vh',
      display: 'flex', flexDirection: 'column' }}>
      <OfflineBanner visible={!isOnline} />
      <div style={{ flex: 1, paddingBottom: 64, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
