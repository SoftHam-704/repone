import { useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav }      from './components/BottomNav';
import { OfflineBanner }  from './components/OfflineBanner';
import { InstallPrompt }  from './components/InstallPrompt';
import { PullToRefresh }  from './components/PullToRefresh';
import { useOffline }     from './hooks/useOffline';

const HIDE_NAV = ['/mobile/pedido'];
// Não habilitar o pull-to-refresh (que recarrega) no meio de um pedido — evita
// perder um rascunho em digitação.
const NO_PULL  = ['/mobile/pedido'];

export function MobileLayout() {
  const { isOnline } = useOffline();
  const location     = useLocation();
  const showNav      = !HIDE_NAV.some(p => location.pathname.startsWith(p));
  const allowPull    = isOnline && !NO_PULL.some(p => location.pathname.startsWith(p));

  // Puxar pra baixo → recarrega (refetch universal de todas as telas). A fila
  // offline mora no IndexedDB e sobe sozinha no próximo carregamento.
  const onRefresh = useCallback(async () => {
    await new Promise(r => setTimeout(r, 150)); // deixa o spinner engatar
    window.location.reload();
  }, []);

  return (
    <div style={{ background: 'var(--sand-bg)', minHeight: '100vh',
      display: 'flex', flexDirection: 'column' }}>
      <InstallPrompt />
      <OfflineBanner visible={!isOnline} />
      <div style={{ flex: 1, paddingBottom: showNav ? 64 : 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PullToRefresh onRefresh={onRefresh} disabled={!allowPull}>
          <Outlet />
        </PullToRefresh>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
