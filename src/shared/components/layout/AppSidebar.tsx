import { useState, useRef, useEffect, useCallback } from 'react';
import { IrisAvatar } from '@/shared/components/iris/IrisAvatar';
import { createPortal } from 'react-dom';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BarChart2, CalendarDays, Target,
  Building2, Users, Briefcase, Package, Tags, DollarSign,
  Map, MapPin, Route, Truck, FileText,
  ShoppingCart, ShoppingBag, Zap, TrendingUp,
  Wallet, PieChart, Settings, Wrench,
  MessageCircle, ClipboardCheck, ListChecks, Kanban, Activity,
  BookOpen, Gamepad2, LogOut, ChevronRight, MessageSquare,
  Radar, Users2, CalendarCheck, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { useAlertasStore } from '@/shared/stores/useAlertasStore';
import { api } from '@/shared/lib/api';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const S = {
  bg:      '#1E2D3D',          // Navy escuro — fundo sidebar
  bgHover: 'rgba(255,255,255,0.06)',
  bgActive:'#754437',          // Terra Queimada — item ativo
  border:  'rgba(255,255,255,0.08)',
  text:    '#E8E1D4',          // Areia — texto principal
  textSec: '#A8B8C4',          // Areia/navy suave — texto secundário
  muted:   'rgba(232,225,212,0.45)',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface NavLeaf {
  label: string;
  path: string;
  icon: React.ElementType;
  feature?: 'biEnabled' | 'whatsappEnabled' | 'crmRepEnabled';
  masterOnly?: boolean;
}
interface NavSubGroup {
  id: string;
  label: string;
  items: NavLeaf[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items?: NavLeaf[];
  subgroups?: NavSubGroup[];
}

// ─── Menus ────────────────────────────────────────────────────────────────────
const TOP_ITEMS: NavLeaf[] = [
  { label: 'Dashboard',             path: '/dashboard', icon: LayoutDashboard },
  { label: 'Business Intelligence', path: '/bi',        icon: BarChart2,    feature: 'biEnabled' },
  { label: 'Central Estatísticos',  path: '/estatisticas', icon: BarChart2 },
  { label: 'Minha Agenda',          path: '/agenda',    icon: CalendarDays },
  { label: 'Metas',                 path: '/metas',     icon: Target },
];

const GROUPS: NavGroup[] = [
  {
    id: 'cadastros', label: 'Cadastros', icon: Building2,
    items: [
      { label: 'Indústrias',            path: '/industrias',                   icon: Building2 },
      { label: 'Clientes',              path: '/clientes',                     icon: Users },
      { label: 'Vendedores',            path: '/vendedores',                   icon: Briefcase },
      { label: 'Tabela de Preços',      path: '/produtos',                     icon: Package },
      { label: 'Grupos de Produtos',    path: '/cadastros/grupos-produtos',    icon: Tags },
      { label: 'Grupos Descontos',      path: '/cadastros/grupos-descontos',   icon: DollarSign },
      { label: 'Regiões',               path: '/cadastros/regioes',            icon: Map },
      { label: 'Setores / Bairros',     path: '/cadastros/setores',            icon: MapPin },
      { label: 'Itinerários de Visita', path: '/cadastros/itinerarios',        icon: Route },
      { label: 'Área de Atuação',       path: '/cadastros/area-atuacao',       icon: Map },
      { label: 'Transportadoras',       path: '/cadastros/transportadoras',    icon: Truck },
    ],
  },
  {
    id: 'movimentacoes', label: 'Movimentações', icon: ShoppingCart,
    items: [
      { label: 'Pedidos de Venda',        path: '/pedidos',                     icon: ShoppingCart },
      { label: 'Carrinho em Lote', path: '/movimentacoes/importador',    icon: ShoppingBag },
      { label: 'Campanhas',               path: '/vendas/campanhas',            icon: Zap },
      { label: 'Baixa via XML',           path: '/movimentacoes/baixa-xml',     icon: FileText },
      { label: 'SELL-OUT',                path: '/movimentacoes/sell-out',      icon: TrendingUp },
      { label: 'Envio de Emails',         path: '/utilitarios/envio-emails',    icon: MessageSquare },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: Wallet,
    items: [
      { label: 'Dashboard Hub',    path: '/financeiro/dashboard',              icon: LayoutDashboard },
      { label: 'Contas a Receber', path: '/financeiro/receber',                icon: DollarSign },
      { label: 'Contas a Pagar',   path: '/financeiro/pagar',                  icon: DollarSign },
      { label: 'Fluxo de Caixa',   path: '/financeiro/relatorios/fluxo-caixa', icon: TrendingUp },
      { label: 'DRE Gerencial',    path: '/financeiro/relatorios/dre',         icon: PieChart },
      { label: 'Plano de Contas',  path: '/financeiro/plano-contas',           icon: Settings },
      { label: 'Centro de Custo',  path: '/financeiro/centro-custo',           icon: Building2 },
      { label: 'Clientes Fin.',    path: '/financeiro/fin-clientes',           icon: Users },
      { label: 'Fornecedores Fin.',path: '/financeiro/fin-fornecedores',       icon: Building2 },
    ],
  },
  {
    id: 'crm', label: 'CRM', icon: MessageCircle,
    items: [
      { label: 'Radar do Rep',      path: '/repcrm/radar',            icon: Radar,          feature: 'crmRepEnabled' },
      { label: 'Carteira',          path: '/repcrm/carteira',         icon: Users2 },
      { label: 'Atividades',         path: '/repcrm/atividades',       icon: Activity },
      { label: 'Relacionamentos',   path: '/repcrm/relacionamentos',  icon: ClipboardCheck },
      { label: 'Pipeline',          path: '/repcrm/pipeline',         icon: Kanban,         feature: 'crmRepEnabled' },
      { label: 'Visitas',           path: '/repcrm/visitas',          icon: CalendarDays },
      { label: 'Campo Ao Vivo',     path: '/repcrm/campo',            icon: MapPin },
      { label: 'WhatsApp IA',       path: '/utilitarios/whatsapp-ia', icon: MessageCircle,  feature: 'whatsappEnabled' },
    ],
  },
  {
    id: 'relatorios', label: 'Relatórios', icon: FileText,
    items: [
      { label: 'Central de Relatórios', path: '/relatorios', icon: FileText },
    ],
  },
  {
    id: 'utilitarios', label: 'Utilitários', icon: Wrench,
    items: [
      { label: 'Catálogo Digital',  path: '/utilitarios/catalogo-produtos', icon: Package },
      { label: 'Centro de Aprendizado', path: '/utilitarios/tutoriais',       icon: BookOpen },
      { label: 'Usuários',          path: '/utilitarios/usuarios',           icon: Users,     masterOnly: true },
      { label: 'Parâmetros',        path: '/utilitarios/parametros',         icon: Settings },
      { label: 'Configurações',     path: '/utilitarios/configuracoes',      icon: Settings },
      { label: 'IRIS — Config. IA', path: '/utilitarios/iris-config',        icon: Sparkles, masterOnly: true },
      { label: '🎮 Tetris',          path: '/utilitarios/tetris',            icon: Gamepad2 },
    ],
  },
];

// ─── IRIS Sidebar Bar ─────────────────────────────────────────────────────────
const IRIS_MSGS = [
  'Monitorando sua carteira',
  'Sincronizando emails',
  'Analisando oportunidades',
  'Verificando clientes inativos',
  'Processando pedidos',
];

const IRIS_STYLES = `
  @keyframes irisSidebarScan {
    0%   { left: -40%; }
    50%  { left: 120%; }
    100% { left: -40%; }
  }
  @keyframes irisDotPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  .iris-sb-scan { animation: irisSidebarScan 3.4s cubic-bezier(0.45,0,0.55,1) infinite; }
  .iris-sb-dot  { animation: irisDotPulse 2s ease-in-out infinite; }
`;

function IrisSidebarBar({ collapsed }: { collapsed: boolean }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % IRIS_MSGS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{IRIS_STYLES}</style>
      <div style={{
        position: 'relative', overflow: 'hidden',
        margin: collapsed ? '8px 6px' : '8px 8px',
        borderRadius: 10,
        background: 'rgba(255,210,0,0.05)',
        border: '1px solid rgba(255,210,0,0.15)',
        height: collapsed ? 38 : 54,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'flex-start',
        justifyContent: 'center',
        padding: collapsed ? 0 : '0 12px',
        gap: 4,
        transition: 'height 0.22s ease',
      }}>
        {/* scanning glow */}
        <div className="iris-sb-scan" style={{
          position: 'absolute', top: 0, bottom: 0,
          width: '40%', pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,210,0,0.10) 35%, rgba(255,210,0,0.28) 50%, rgba(255,210,0,0.10) 65%, transparent 100%)',
        }} />

        {collapsed ? (
          /* modo collapsed: só o olho */
          <IrisAvatar size={28} animated />
        ) : (
          <>
            {/* linha 1: olho + IRIS · ativa */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              <IrisAvatar size={30} animated />
              <span style={{
                fontSize: 9, fontWeight: 900, color: '#FFD200',
                letterSpacing: 2, textTransform: 'uppercase',
              }}>
                IRIS · ativa
              </span>
            </div>

            {/* linha 2: mensagem rotativa */}
            <motion.span
              key={msgIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: 10, fontWeight: 600,
                color: 'rgba(232,225,212,0.45)',
                letterSpacing: 0.2,
                position: 'relative',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {IRIS_MSGS[msgIdx]}
            </motion.span>
          </>
        )}
      </div>
    </>
  );
}

// ─── Tooltip via portal (escapa overflow do sidebar) ─────────────────────────
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 10 });
    }
  };

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && createPortal(
          <motion.div
            key="tip"
            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed', top: pos.top, left: pos.left,
              transform: 'translateY(-50%)',
              zIndex: 9999, pointerEvents: 'none',
              background: '#1E2D3D', color: '#E8E1D4',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              padding: '5px 10px', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
            {label}
          </motion.div>,
        document.body
      )}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [autoHide, setAutoHide] = useState(() => localStorage.getItem('sidebar-auto-hide') === 'true');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-auto-hide') === 'true');
  const { count: alertCount, fetch: fetchAlertas } = useAlertasStore();
  const [wppJCount, setWppJCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('sidebar-auto-hide', String(autoHide));
    if (autoHide) { setCollapsed(true); setOpenGroup(null); }
  }, [autoHide]);

  // Busca alertas ao montar e a cada 5 minutos
  useEffect(() => {
    fetchAlertas();
    const interval = setInterval(fetchAlertas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Busca contagem de pedidos WhatsApp pendentes a cada 2 minutos
  useEffect(() => {
    const fetchWpp = async () => {
      try {
        const r = await api.get('/orders/count-whatsapp');
        setWppJCount(r.data?.count ?? 0);
      } catch { /* silencioso */ }
    };
    fetchWpp();
    const t = setInterval(fetchWpp, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    for (const g of GROUPS) {
      if (g.items?.some(i => location.pathname.startsWith(i.path))) return g.id;
    }
    return null;
  });

  const W = collapsed ? 60 : 260;

  const initials = [user?.nome?.[0], user?.sobrenome?.[0]].filter(Boolean).join('').toUpperCase() || 'US';
  const fullName = [user?.nome, user?.sobrenome].filter(Boolean).join(' ') || 'Usuário';

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isMasterRole = user?.role === 'admin' || user?.role === 'superadmin';
  const canShow  = (f?: NavLeaf['feature'], masterOnly?: boolean) => {
    if (masterOnly && !isMasterRole) return false;
    return !f || user?.[f] !== false;
  };

  // ─── Item leaf ──────────────────────────────────────────────────────────────
  const LeafItem = ({ item, indent = false }: { item: NavLeaf; indent?: boolean }) => {
    if (!canShow(item.feature, item.masterOnly)) return null;
    const active = isActive(item.path);
    const Icon   = item.icon;

    const inner = (
      <Link to={item.path} style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 9,
        padding: collapsed ? '8px 0' : indent ? '7px 12px 7px 34px' : '7px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 9, textDecoration: 'none',
        fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? '#fff' : S.text,
        background: active ? S.bgActive : 'transparent',
        transition: 'background .15s, color .15s',
        position: 'relative',
      }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = S.bgHover; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
        <Icon size={18} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            {item.path === '/bi' && alertCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 999,
                background: '#E53E3E', color: '#fff',
                fontSize: 9, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px', flexShrink: 0,
              }}>
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
            {item.path === '/pedidos' && wppJCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 999,
                background: '#15803D', color: '#fff',
                fontSize: 9, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px', flexShrink: 0,
              }}>
                {wppJCount > 9 ? '9+' : wppJCount}
              </span>
            )}
          </>
        )}
        {collapsed && item.path === '/bi' && alertCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8, borderRadius: 999,
            background: '#E53E3E',
          }} />
        )}
        {collapsed && item.path === '/pedidos' && wppJCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8, borderRadius: 999,
            background: '#15803D',
          }} />
        )}
      </Link>
    );

    return collapsed ? <Tooltip label={item.label}>{inner}</Tooltip> : inner;
  };

  // ─── Group section ──────────────────────────────────────────────────────────
  const GroupSection = ({ group }: { group: NavGroup }) => {
    const Icon     = group.icon;
    const isOpen   = openGroup === group.id;
    const hasActive = (group.items?.some(i => isActive(i.path) && canShow(i.feature)) || 
                       group.subgroups?.some(s => s.items.some(i => isActive(i.path) && canShow(i.feature))));
    
    const visibles = (group.items || []).filter(i => canShow(i.feature, i.masterOnly));
    const hasVisibleSubgroups = group.subgroups?.some(s => s.items.some(i => canShow(i.feature)));
    
    if (!visibles.length && !hasVisibleSubgroups) return null;

    const [openSub, setOpenSub] = useState<string | null>(null);

    const toggle = () => {
      if (collapsed) {
        setCollapsed(false);
        setOpenGroup(group.id);
      } else {
        setOpenGroup(prev => prev === group.id ? null : group.id);
      }
    };

    const btn = (
      <button onClick={toggle} style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 9,
        width: '100%', padding: collapsed ? '8px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 9, border: 'none', cursor: 'pointer',
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9,
        color: hasActive ? S.text : S.textSec,
        background: hasActive && !isOpen ? 'rgba(117,68,55,0.25)' : 'transparent',
        transition: 'background .15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.bgHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = hasActive && !isOpen ? 'rgba(117,68,55,0.25)' : 'transparent'; }}>
        <Icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
            <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronRight size={12} />
            </motion.span>
          </>
        )}
      </button>
    );

    return (
      <div>
        {collapsed ? <Tooltip label={group.label}>{btn}</Tooltip> : btn}

        {isOpen && !collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}>
              <div style={{
                marginLeft: 19, marginTop: 2, marginBottom: 4,
                paddingLeft: 4,
                borderLeft: '1px solid rgba(255,255,255,0.12)',
              }}>
                {/* Render items if direct children */}
                {visibles.map(item => <LeafItem key={item.path} item={item} indent />)}
                
                {/* Render subgroups if present */}
                {group.subgroups?.map(sub => (
                  <div key={sub.id} style={{ marginTop: 4 }}>
                    <button 
                      onClick={() => setOpenSub(prev => prev === sub.id ? null : sub.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', background: 'transparent', border: 'none',
                        color: openSub === sub.id ? '#fff' : S.muted, cursor: 'pointer',
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        transition: 'color .2s'
                      }}>
                      <ChevronRight size={10} style={{ transform: openSub === sub.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                      <span>{sub.label}</span>
                    </button>
                    {openSub === sub.id && (
                      <div style={{ marginLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
                        {sub.items.map(item => <LeafItem key={item.path} item={item} indent />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
      </div>
    );
  };

  return (
    <motion.aside
      animate={{ width: W, minWidth: W }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      onClick={() => { if (collapsed) setCollapsed(false); }}
      onMouseEnter={() => { if (autoHide) setCollapsed(false); }}
      onMouseLeave={() => { if (autoHide) { setCollapsed(true); setOpenGroup(null); } }}
      style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        backgroundColor: S.bg, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, overflow: 'hidden',
        cursor: collapsed ? 'pointer' : 'default',
      }}>

      {/* ── Logo ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: collapsed ? '18px 0' : '14px 14px',
        borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <img src="/logo.png" alt="SalesMasters" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: S.text, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
                  SalesMasters
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  Enterprise Edition
                </div>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setCollapsed(true); setOpenGroup(null); }}
              title="Retrair menu"
              style={{
                width: 24, height: 24, borderRadius: 6, border: `1px solid ${S.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', cursor: 'pointer', flexShrink: 0, color: S.muted,
                transition: 'background .15s, color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.bgHover; (e.currentTarget as HTMLElement).style.color = S.text; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = S.muted; }}>
              <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </>
        ) : (
          <img src="/logo.png" alt="SalesMasters" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
        )}
      </div>

      {/* ── Scroll body ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        padding: collapsed ? '8px 6px' : '8px 8px',
      }}>
        {/* Top items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {TOP_ITEMS.map(item => canShow(item.feature) && <LeafItem key={item.path} item={item} />)}
        </div>

        {/* Divisor */}
        <div style={{ height: 1, background: S.border, margin: collapsed ? '8px 4px' : '8px 4px' }} />

        {/* Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {GROUPS.map(g => <GroupSection key={g.id} group={g} />)}
        </div>
      </div>

      {/* ── IRIS Status Bar ─────────────────────────────────────────────── */}
      <IrisSidebarBar collapsed={collapsed} />

      {/* ── Footer: user + logout ────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
        {!collapsed && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', cursor: 'pointer',
            borderBottom: `1px solid ${S.border}`,
          }}>
            <input
              type="checkbox"
              checked={autoHide}
              onChange={e => setAutoHide(e.target.checked)}
              style={{ accentColor: '#FFD200', cursor: 'pointer', width: 13, height: 13 }}
            />
            <span style={{ fontSize: 10, fontWeight: 600, color: S.muted, userSelect: 'none' }}>
              Auto-ocultar sidebar
            </span>
          </label>
        )}
        {!collapsed && user?.empresa && (
          <div style={{ padding: '8px 14px 4px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: S.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Empresa
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: S.textSec, marginTop: 1, lineHeight: 1.3 }}
              title={user.empresa}>
              {user.empresa.length > 26 ? user.empresa.substring(0, 26) + '…' : user.empresa}
            </div>
          </div>
        )}
        <div style={{
          padding: collapsed ? '10px 0' : '8px 10px 12px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 9,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: '#754437', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#E8E1D4' }}>{initials}</span>
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: 10, color: S.textSec }}>
                  {isMasterRole ? 'Administrador' : 'Representante'}
                </div>
              </div>
              <button onClick={logout} title="Sair"
                style={{
                  width: 28, height: 28, borderRadius: 7, border: `1px solid ${S.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', cursor: 'pointer', flexShrink: 0,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.bgHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <LogOut size={13} color={S.textSec} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
