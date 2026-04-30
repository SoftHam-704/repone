import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Factory,
  UserCheck,
  Package,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HelpCircle,
} from 'lucide-react'
import './Sidebar.css'

const MAIN_MENU = [
  { id: 'dashboard',    label: 'Dashboard',     icon: LayoutDashboard, path: '/' },
  { id: 'orders',       label: 'Pedidos',        icon: ShoppingCart,    path: '/pedidos' },
  { id: 'clients',      label: 'Clientes',       icon: Users,           path: '/clientes' },
  { id: 'suppliers',    label: 'Fornecedores',   icon: Factory,         path: '/fornecedores' },
  { id: 'sellers',      label: 'Vendedores',     icon: UserCheck,       path: '/vendedores' },
  { id: 'products',     label: 'Produtos',       icon: Package,         path: '/produtos' },
  { id: 'billing',      label: 'Faturamento',    icon: BarChart3,       path: '/faturamento' },
]

const BOTTOM_MENU = [
  { id: 'settings', label: 'Configurações', icon: Settings,    path: '/config' },
  { id: 'help',     label: 'Ajuda',         icon: HelpCircle,  path: '/ajuda' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo" onClick={() => navigate('/')}>
        <div className="sidebar__logo-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#2DD4BF" />
            <text x="7" y="20" fontFamily="Inter" fontWeight="800" fontSize="16" fill="#0E1D21">S</text>
          </svg>
        </div>
        {!collapsed && (
          <span className="sidebar__logo-text">
            Sales<span className="sidebar__logo-accent">Masters</span>
          </span>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        className="sidebar__toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Main Navigation */}
      <nav className="sidebar__nav">
        <span className="sidebar__section-label">{!collapsed && 'MENU PRINCIPAL'}</span>
        {MAIN_MENU.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button
              key={item.id}
              className={`sidebar__item ${active ? 'sidebar__item--active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              {active && <div className="sidebar__item-indicator" />}
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="sidebar__bottom">
        <span className="sidebar__section-label">{!collapsed && 'OUTROS'}</span>
        {BOTTOM_MENU.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`sidebar__item ${isActive(item.path) ? 'sidebar__item--active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}

        {/* User */}
        <div className="sidebar__user">
          <div className="sidebar__user-avatar">MR</div>
          {!collapsed && (
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">Miguel Rodrigues</span>
              <span className="sidebar__user-email">miguel@repsoma.com.br</span>
            </div>
          )}
          {!collapsed && (
            <button className="sidebar__user-logout" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
