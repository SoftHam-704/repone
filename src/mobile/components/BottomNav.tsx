import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, ShoppingCart, TrendingUp, BarChart2 } from 'lucide-react';

const TABS = [
  { path: '/mobile/home',    icon: Home,         label: 'Home'     },
  { path: '/mobile/clientes',icon: Users,        label: 'Clientes' },
  { path: '/mobile/pedido',  icon: ShoppingCart, label: 'Pedido'   },
  { path: '/mobile/sellout', icon: TrendingUp,   label: 'Sell-Out' },
  { path: '/mobile/bi',      icon: BarChart2,    label: 'BI'       },
] as const;

export function BottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--navy)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', height: 64, zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const active = location.pathname.startsWith(tab.path);
        const Icon   = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--mustard)' : 'rgba(255,255,255,0.4)',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.3 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
