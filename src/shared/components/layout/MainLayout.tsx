import { useEffect, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TabHeader } from './TabHeader';
import { useTabStore } from '@/shared/stores/useTabStore';
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

  // Atalhos globais de teclado
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        navigate('/produtos');
      }
      if (e.key === 'F11') {
        e.preventDefault();
        navigate('/pedidos');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  // 1. Sync URL -> Tab Store
  useEffect(() => {
    if (currentPath === '/' || currentPath === '/login') return;

    const route = findRouteByPath(location.pathname);
    if (route) {
      // Use full path as ID for specific items (like /clientes/123)
      // but keep base routes as they are.
      addTab({
        id: currentPath,
        label: route.label,
        path: location.pathname,
        icon: route.id,
      });
    }
  }, [currentPath, addTab, location.pathname]);


  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: G.bg }}>
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
                style={{
                  display: isActive ? 'block' : 'none',
                }}
              >
                <div className="h-full w-full overflow-auto">
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full font-bold" style={{ color: G.text }}>
                      Carregando {tab.label}...
                    </div>
                  }>
                    {/* Component handles its own state. 
                        Note: react-router's useParams() will work because the main Router URL matches. */}
                    {route.element}
                  </Suspense>
                </div>
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}
