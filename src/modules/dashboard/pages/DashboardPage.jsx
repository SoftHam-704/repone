import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Plus,
  Bell,
  Search,
  ChevronDown,
  Maximize2,
  LayoutGrid,
  Store,
  Box,
  Users,
  Settings,
  HelpCircle,
} from 'lucide-react'
import './DashboardPage.css'

/* =============================================
   MOCK DATA — Estilo Enelys (Português/Pastel)
   ============================================= */

const KIP_STATS = [
  { id: 'vendas', label: 'SALES', value: 'R$ 37.829,21', sub: '↑ R$ 1,2K / Ano', change: '+R$ 2,5K', trend: 'up', color: 'var(--brand-primary)', percent: 65 },
  { id: 'lucro', label: 'PROFIT', value: 'R$ 5.483,83', sub: '↑ R$ 1,2K / Ano', change: '+R$ 1,4K', trend: 'up', color: 'var(--chart-blue)', percent: 78 },
  { id: 'custo', label: 'TOTAL SALES COST', value: 'R$ 2.982,92', sub: '↓ R$ 5,2K / Ano', change: '-R$ 3,2K', trend: 'down', color: 'var(--chart-coral)', percent: 85 },
]

const BUBBLE_DATA = [
  { id: 'a', label: 'Regional A', value: 229, size: 70, color: 'var(--brand-secondary)', x: 25, y: 50 },
  { id: 'b', label: 'Regional B', value: 1283, size: 100, color: 'var(--chart-blue)', x: 45, y: 50 },
  { id: 'c', label: 'Regional C', value: 622, size: 85, color: 'var(--chart-mint)', x: 70, y: 50 },
]

const PERFORMANCE_DATA = [
  { month: 'Jan', revenue: 45, target: 40 },
  { month: 'Fev', revenue: 60, target: 52 },
  { month: 'Mar', revenue: 55, target: 58 },
  { month: 'Abr', revenue: 85, target: 65 },
  { month: 'Mai', revenue: 75, target: 72 },
  { month: 'Jun', revenue: 95, target: 78 },
]

const BARS_DATA = [
  { m: 'Jan', income: 40, exp: 20 },
  { m: 'Fev', income: 60, exp: 35 },
  { m: 'Mar', income: 55, exp: 30 },
  { m: 'Abr', income: 75, exp: 40 },
  { m: 'Mai', income: 65, exp: 45 },
  { m: 'Jun', income: 85, exp: 35 },
]

/* === Bubble Chart (Vendas por Produto/Regional) === */
const BubbleChart = () => {
  return (
    <div className="bubble-container">
      {/* Store B (Large Blue) */}
      <div 
        className="bubble-node z-10 backdrop-blur-[2px]"
        style={{ width: 160, height: 160, background: '#C7D2FE66', border: '2px solid #C7D2FE33', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <span className="text-[10px] font-bold text-[#4F46E5] mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Store B</span>
        <span className="text-2xl font-extrabold text-[#1E1B4B]" style={{ fontFamily: 'Plus Jakarta Sans' }}>1,283</span>
      </div>
      
      {/* Store C (Medium Green) */}
      <div 
        className="bubble-node z-20"
        style={{ width: 128, height: 128, background: '#D1E7E580', border: '2px solid #D1E7E54D', right: 0, top: '50%', transform: 'translateY(-50%)' }}
      >
        <span className="text-[10px] font-bold text-[#0E6D77] mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Store C</span>
        <span className="text-xl font-extrabold text-[#003D44]" style={{ fontFamily: 'Plus Jakarta Sans' }}>622</span>
      </div>
      
      {/* Store A (Small Red/Peach) */}
      <div 
        className="bubble-node z-30"
        style={{ width: 96, height: 96, background: '#FEE2E299', border: '2px solid #FEE2E266', left: 32, top: '50%', transform: 'translateY(-50%)' }}
      >
        <span className="text-[10px] font-bold text-red-600 mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Store A</span>
        <span className="text-lg font-extrabold text-red-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>229</span>
      </div>
    </div>
  )
}

/* === Stepped Area Chart (Vendas vs Meta) === */
function SteppedAreaChart({ data }) {
  const w = 550, h = 180, pL = 40, pT = 20, pR = 10, pB = 30
  const iW = w - pL - pR, iH = h - pT - pB
  const max = 110

  const getPoints = (key) =>
    data.map((d, i) => ({
      x: pL + (i / (data.length - 1)) * iW,
      y: pT + iH - (d[key] / max) * iH
    }))

  const buildPath = (pts, stepped = false) => {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
        const cpx1 = pts[i-1].x + (pts[i].x - pts[i-1].x) * 0.4
        const cpx2 = pts[i].x - (pts[i].x - pts[i-1].x) * 0.4
        d += ` C ${cpx1},${pts[i-1].y} ${cpx2},${pts[i].y} ${pts[i].x},${pts[i].y}`
    }
    return d
  }

  const rPts = getPoints('revenue'), tPts = getPoints('target')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="stepped-chart-svg overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="salesGradient" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#0E6D77" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0E6D77" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid Lines (Dashed as per HTML) */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = pT + iH - (v / max) * iH
        return <line key={v} x1={pL} y1={y} x2={w - pR} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      })}
      {/* Area Shading */}
      <path 
        d={`${buildPath(rPts)} L ${rPts[rPts.length-1].x},${pT+iH} H ${pL} Z`} 
        fill="url(#salesGradient)" 
      />
      {/* Target Line (Dashed) */}
      <path d={buildPath(tPts)} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Sales Line (Solid Deep Teal) */}
      <path d={buildPath(rPts)} fill="none" stroke="#0E6D77" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

/* === Sidebar Component (Unificado Enelys Style) === */
function Sidebar({ active = 'Overview' }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="var(--brand-primary)" />
          <path d="M16 8L10 16H22L16 8Z" fill="white" />
        </svg>
        <span style={{ fontSize: '1.25rem', color: 'var(--brand-primary)', fontWeight: 800, fontFamily: 'Plus Jakarta Sans' }}>SalesMasters</span>
      </div>
      
      <span className="sidebar-label" style={{ fontFamily: 'Plus Jakarta Sans' }}>MAIN MENU</span>
      <div className="sidebar-nav">
        <div className="sidebar-item-active" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 2px 4px rgba(14, 109, 119, 0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>grid_view</span>
          <span className="text-sm font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Overview</span>
        </div>
        <div className="sidebar-item-inactive">
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-sm font-medium" style={{ fontFamily: 'Plus Jakarta Sans' }}>Store</span>
        </div>
        <div className="sidebar-item-inactive">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="text-sm font-medium" style={{ fontFamily: 'Plus Jakarta Sans' }}>Product</span>
        </div>
        <div className="sidebar-item-inactive">
          <span className="material-symbols-outlined">group</span>
          <span className="text-sm font-medium" style={{ fontFamily: 'Plus Jakarta Sans' }}>Customer</span>
        </div>
      </div>

      <span className="sidebar-label" style={{ fontFamily: 'Plus Jakarta Sans', marginTop: '1.5rem' }}>OTHER</span>
      <div className="sidebar-nav">
        <div className="sidebar-item-inactive">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-sm font-medium" style={{ fontFamily: 'Plus Jakarta Sans' }}>Setting</span>
        </div>
        <div className="sidebar-item-inactive">
          <span className="material-symbols-outlined">help</span>
          <span className="text-sm font-medium" style={{ fontFamily: 'Plus Jakarta Sans' }}>Help Center</span>
        </div>
      </div>
      
      <div className="sidebar-user" style={{marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
        <div style={{width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans'}}>M</div>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <span style={{fontSize: 12, fontWeight: 700, fontFamily: 'Plus Jakarta Sans'}}>Miguel Rodrigues</span>
          <span style={{fontSize: 10, color: '#94a3b8', fontFamily: 'Plus Jakarta Sans'}}>miguel@repsoma.com.br</span>
        </div>
      </div>
    </aside>
  )
}

export default function DashboardPage() {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="layout-root">
      <Sidebar />
      <div className="dashboard-content">
        {/* Top Header */}
        <header className="dashboard-header header-blur animate-in">
          <div className="greeting-section">
            <h1 className="header-title">{getGreeting()}, Miguel 👋</h1>
            <p className="header-sub">Welcome to the Sales Analytics Dashboard</p>
          </div>
          <div className="header-actions">
            <Search size={18} color="#94a3b8" />
            <div className="notification-icon"><Bell size={18} color="#94a3b8" /></div>
            <button className="fullscreen-btn"><Maximize2 size={14} /> Tela Cheia</button>
          </div>
        </header>

        {/* Filters Row */}
        <div className="filters-row animate-in delay-1">
          <div className="dropdown-pill">📅 Últimos 6 meses <ChevronDown size={14} /></div>
          <div className="dropdown-pill">🏢 Todas as Unidades <ChevronDown size={14} /></div>
          <button className="customize-btn">Personalizar</button>
        </div>

        {/* KPI Row (Row 1) */}
        <section className="kpi-grid animate-in delay-2">
          {KIP_STATS.map(stat => (
            <div key={stat.id} className="kpi-card relative overflow-hidden group">
              <div className="relative z-10">
                <span className="card-label" style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.1em', fontFamily: 'Plus Jakarta Sans' }}>{stat.label}</span>
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <h3 className="text-2xl font-extrabold" style={{ color: 'var(--text-dark)', fontFamily: 'Plus Jakarta Sans' }}>{stat.value}</h3>
                    <p className="text-[10px] text-muted mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }}>{stat.sub}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold mb-1" style={{ color: stat.trend === 'up' ? 'var(--brand-primary)' : '#EF4444', fontFamily: 'Plus Jakarta Sans' }}>{stat.change}</span>
                    <div className="w-16 h-4 bg-surface rounded-sm relative overflow-hidden" style={{ background: stat.trend === 'up' ? '#D7EBEB' : '#F2DEDE' }}>
                      <div className="absolute left-0 top-0 h-full bg-primary/40" style={{ width: `${stat.percent}%`, background: stat.trend === 'up' ? '#0E6D7766' : '#EF444466' }} />
                      <div className="absolute top-0 h-full w-[2px] bg-primary" style={{ left: `${stat.percent}%`, background: stat.trend === 'up' ? '#0E6D77' : '#EF4444' }} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Subtle background icon from HTML */}
              <div className="absolute -right-4 top-2 opacity-[0.03] scale-150 pointer-events-none group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined" style={{ fontSize: '96px' }}>
                  {stat.id === 'vendas' ? 'payments' : stat.id === 'lucro' ? 'account_balance_wallet' : 'receipt_long'}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* Middle Row (Bubble + Triple Split Row 2) */}
        <section className="triple-grid animate-in delay-3">
          <div className="glass-card">
            <h2 className="card-title-sm" style={{ fontFamily: 'Plus Jakarta Sans' }}>VENDAS POR PRODUTO</h2>
            <div className="legend-pills">
               <span className="legend-pill" style={{ fontFamily: 'Plus Jakarta Sans' }}><span className="dot" style={{background: '#122E34'}}/> Loja A</span> 
               <span className="legend-pill" style={{ fontFamily: 'Plus Jakarta Sans' }}><span className="dot" style={{background: '#818CF8'}}/> Loja B</span> 
               <span className="legend-pill" style={{ fontFamily: 'Plus Jakarta Sans' }}><span className="dot" style={{background: '#2DD4BF'}}/> Loja C</span>
            </div>
            <BubbleChart data={BUBBLE_DATA} />
          </div>

          <div className="glass-card">
            <h2 className="card-title-sm" style={{ fontFamily: 'Plus Jakarta Sans' }}>LUCRO E DESPESA</h2>
            <div className="legend-pills">
              <span className="legend-pill-income" style={{ fontFamily: 'Plus Jakarta Sans' }}>Receita</span> 
              <span className="legend-pill-expense" style={{ fontFamily: 'Plus Jakarta Sans' }}>Despesa</span>
            </div>
            <div className="thin-bars-chart">
               {BARS_DATA.map((d, i) => (
                 <div key={i} className="bar-pair">
                   <div className="bar-income" style={{ height: `${d.income}%` }} />
                   <div className="bar-expense" style={{ height: `${d.exp}%` }} />
                   <span className="bar-label-m" style={{ fontFamily: 'Plus Jakarta Sans' }}>{d.m}</span>
                 </div>
               ))}
            </div>
          </div>

          <div className="col-span-3 bg-[#E9EEF2] p-8 rounded-2xl relative overflow-hidden flex flex-col">
          <div className="relative z-10 flex-1">
            <h3 className="text-sm font-bold text-on-surface mb-3 leading-relaxed" style={{ fontFamily: 'Plus Jakarta Sans' }}>Scan receipts effortlessly, anywhere or import from excel</h3>
            <p className="text-[10px] text-on-surface-variant leading-relaxed mb-6" style={{ fontFamily: 'Plus Jakarta Sans' }}>Automatic expense tracking with Enelys's mobile app and web upload.</p>
          </div>
          <button className="relative z-10 w-max px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--brand-primary)', fontFamily: 'Plus Jakarta Sans' }}>Get Started</button>
          <div className="promo-svg-container">
            <svg height="80" viewBox="0 0 100 100" width="80" xmlns="http://www.w3.org/2000/svg">
              <path d="M50,10 C60,40 20,60 10,90 M50,10 C80,40 90,60 80,90" fill="none" stroke="#0E6D77" strokeWidth="1.5"></path>
              <ellipse cx="85" cy="65" fill="#C7D2FE" rx="15" ry="25" transform="rotate(-30, 85, 65)"></ellipse>
            </svg>
          </div>
        </div>
        </section>

        {/* Bottom Split (Row 3) */}
        <section className="bottom-grid animate-in delay-4">
          <div className="glass-card flex-2">
            <h2 className="card-title-sm">REALIZADO VS. META POR PERÍODO</h2>
            <div className="big-metrics">
              <div className="big-metric-item">
                <span className="big-v">R$ 37.829,21</span>
                <span className="big-l">TOTAL VENDAS</span>
              </div>
              <div className="big-metric-item">
                <span className="big-v">R$ 20.000,00</span>
                <span className="big-l">META TOTAL</span>
              </div>
            </div>
            <SteppedAreaChart data={PERFORMANCE_DATA} />
          </div>

          <div className="glass-card flex-1">
            <h2 className="card-title-sm" style={{ fontFamily: 'Plus Jakarta Sans' }}>SALES BY STORE LOCATION</h2>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--brand-primary)' }}></span>
                <h4 className="text-2xl font-extrabold" style={{ color: 'var(--text-dark)', fontFamily: 'Plus Jakarta Sans' }}>$37,829.21</h4>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest ml-3" style={{ color: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }}>TOTAL SALES</p>
            </div>
            
            <div className="space-y-8 mt-6">
              {[
                { name: 'Downtown', val: '$17.0M', p: 85 },
                { name: 'Commercial', val: '$7.1M', p: 35 },
                { name: 'Airport', val: '$13.0M', p: 65 }
              ].map(loc => (
                <div key={loc.name} className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }}>{loc.name}</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-dark)', fontFamily: 'Plus Jakarta Sans' }}>{loc.val}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-visible" style={{ background: '#F1F5F9' }}>
                    <div className="h-full rounded-full relative" style={{ background: 'var(--brand-primary)', width: `${loc.p}%` }}>
                      <div className="absolute -right-1.5 -top-1.5 w-4 h-4 bg-white border-2 rounded-full" style={{ borderColor: 'var(--brand-primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
