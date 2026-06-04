import { useEffect, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TabHeader } from './TabHeader';
import { useTabStore } from '@/shared/stores/useTabStore';
import { IrisModal } from '@/shared/components/iris/IrisModal';
import { useIrisModal } from '@/shared/stores/useIrisModal';
import { findRouteByPath } from '@/shared/lib/routeConfig';

const G = {
  bg: '#E8E1D4',
  text: '#28374A',
};

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tabs, addTab, activeTabId } = useTabStore();
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); navigate('/produtos'); }
      if (e.key === 'F11') { e.preventDefault(); navigate('/pedidos'); }
      // Ctrl+K / Cmd+K → invoca/fecha a IRIS (modal global)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        useIrisModal.getState().toggle();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  useEffect(() => {
    if (currentPath === '/' || currentPath === '/login') return;
    const route = findRouteByPath(location.pathname);
    if (route) {
      addTab({
        id: currentPath,
        label: route.label,
        path: location.pathname,
        icon: route.id,
      });
    }
  }, [currentPath, addTab, location.pathname]);

  return (
    // Coluna principal: ocupa h-screen inteiro em flex-col
    <div className="flex flex-col h-screen w-full overflow-hidden" style={{ backgroundColor: G.bg, paddingTop: 'env(titlebar-area-height, 0px)' }}>

      {/* Linha do meio: sidebar + área de conteúdo */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AppSidebar />

        <div className="flex flex-col flex-1 min-w-0">
          <TabHeader />

          <main className="flex-1 overflow-hidden relative" style={{ backgroundColor: G.bg }}>
            {tabs.map((tab) => {
              const route = findRouteByPath(tab.path);
              if (!route) return null;

              const isActive = activeTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  className="absolute inset-0"
                  style={{ display: isActive ? 'block' : 'none' }}
                >
                  <div className="h-full w-full overflow-auto">
                    <Suspense fallback={
                      <div className="flex items-center justify-center h-full font-bold" style={{ color: G.text }}>
                        Carregando {tab.label}...
                      </div>
                    }>
                      {route.element}
                    </Suspense>
                  </div>
                </div>
              );
            })}
          </main>
        </div>
      </div>

      {/* IRIS Dev — modal global (Ctrl+K ou orbe do sidebar). Sem barra de rodapé:
          o monitor de eventos (IrisTerminal) ficou fora do layout, arquivo preservado
          pra futuramente alimentar o orbe (insight proativo). */}
      <IrisModal />
    </div>
  );
}
