import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { G } from './CadastroShell';

interface Tab { path: string; label: string; }

// Mapeamento de rotas → labels das abas
const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':                    'Dashboard',
  '/metas':                        'Metas',
  '/industrias':                   'Indústrias',
  '/clientes':                     'Clientes',
  '/vendedores':                   'Vendedores',
  '/produtos':                     'Tabela de Preços',
  '/cadastros/grupos-produtos':    'Grupos de Produtos',
  '/cadastros/grupos-descontos':   'Grupos Descontos',
  '/utilitarios/importacao-precos': 'Importação de Preços',
};

function getDynamicLabel(path: string): string | null {
  if (path.startsWith('/clientes/'))   return 'Ficha Cliente';
  if (path.startsWith('/vendedores/')) return 'Ficha Vendedor';
  return ROUTE_LABELS[path] ?? null;
}

const SK = 'sm_tabs_v2';

function load(): Tab[] {
  try { return JSON.parse(sessionStorage.getItem(SK) || '[]'); } catch { return []; }
}
function save(tabs: Tab[]) {
  sessionStorage.setItem(SK, JSON.stringify(tabs));
}

export function TabsBar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>(load);

  // Adiciona aba ao navegar para uma rota conhecida
  useEffect(() => {
    const label = getDynamicLabel(location.pathname);
    if (!label) return;

    setTabs(prev => {
      // Já existe → apenas atualizar label (para rotas dinâmicas pode mudar)
      if (prev.some(t => t.path === location.pathname)) return prev;
      const next = [...prev, { path: location.pathname, label }];
      save(next);
      return next;
    });
  }, [location.pathname]);

  const close = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setTabs(prev => {
      const idx  = prev.findIndex(t => t.path === path);
      const next = prev.filter(t => t.path !== path);
      save(next);
      // Se fechou a aba ativa, vai para a aba adjacente
      if (path === location.pathname) {
        if (next.length > 0) navigate(next[Math.min(idx, next.length - 1)].path);
        else                  navigate('/dashboard');
      }
      return next;
    });
  };

  if (tabs.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      background: '#fff',
      borderBottom: `1px solid ${G.border}`,
      overflowX: 'auto',
      flexShrink: 0,
      scrollbarWidth: 'none',
    }}>
      {tabs.map(tab => {
        const active = tab.path === location.pathname;
        return (
          <div
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 14px', height: 38,
              cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
              fontSize: 12, fontWeight: active ? 700 : 600,
              color: active ? G.text : G.textMuted,
              background: active ? G.cardHi : 'transparent',
              borderBottom: `2px solid ${active ? G.mustard : 'transparent'}`,
              borderRight: `1px solid ${G.border}`,
              transition: 'background .1s',
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = G.cardHi; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span>{tab.label}</span>
            {/* Dashboard é fixo — nunca pode ser fechado */}
            {tab.path !== '/dashboard' && (
              <button
                onClick={e => close(e, tab.path)}
                title="Fechar"
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  border: 'none', background: 'transparent', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: G.textMuted,
                }}
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
