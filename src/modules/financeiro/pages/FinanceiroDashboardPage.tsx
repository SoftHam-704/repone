import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertTriangle,
  Plus, BarChart2, Wallet, ChevronRight
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { api } from '@/shared/lib/api'

const G = {
  bg:      '#E8E1D4',
  card:    '#F2EDE4',
  border:  '#D6CCBA',
  text:    '#28374A',
  muted:   '#6B7A8A',
  mustard: '#FFD200',
  green:   '#22C55E',
  red:     '#EF4444',
  navy:    '#1A2A3A',
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

interface DashData {
  receber: { vencido: number; hoje: number; prox_7_dias: number; total_aberto: number }
  pagar:   { vencido: number; hoje: number; prox_7_dias: number; total_aberto: number }
  grafico: { label: string; receitas: number; despesas: number }[]
  saldo_previsto: number
}

function KpiCard({ label, value, sub, color, icon: Icon, to }: {
  label: string; value: string; sub?: string; color: string; icon: any; to: string
}) {
  return (
    <Link to={to} style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
      padding: '20px 24px', textDecoration: 'none', transition: 'box-shadow .15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: G.muted, fontWeight: 500 }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 8, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: G.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: G.muted }}>{sub}</div>}
    </Link>
  )
}

function AlertBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${G.border}` }}>
      <span style={{ fontSize: 13, color: G.text }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{fmtBRL(value)}</span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, color: G.text, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmtBRL(Number(p.value))}
        </div>
      ))}
    </div>
  )
}

export default function FinanceiroDashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/financeiro/dashboard/summary')
      .then(r => r.data.success && setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: G.muted }}>
      Carregando dados financeiros...
    </div>
  )

  const r = data?.receber
  const p = data?.pagar

  return (
    <div style={{ padding: '28px 32px', background: G.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Wallet size={22} color={G.mustard} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: G.text, margin: 0 }}>Financeiro</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: G.muted }}>Visão geral da saúde financeira</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/financeiro/receber" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: G.green, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
          }}>
            <Plus size={15} /> Novo Recebimento
          </Link>
          <Link to="/financeiro/pagar" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: G.red, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
          }}>
            <Plus size={15} /> Novo Pagamento
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          label="A Receber (total)"
          value={fmtBRL(Number(r?.total_aberto ?? 0))}
          sub={`Vencido: ${fmtBRL(Number(r?.vencido ?? 0))}`}
          color={G.green}
          icon={ArrowDownCircle}
          to="/financeiro/receber"
        />
        <KpiCard
          label="A Pagar (total)"
          value={fmtBRL(Number(p?.total_aberto ?? 0))}
          sub={`Vencido: ${fmtBRL(Number(p?.vencido ?? 0))}`}
          color={G.red}
          icon={ArrowUpCircle}
          to="/financeiro/pagar"
        />
        <KpiCard
          label="Saldo Previsto"
          value={fmtBRL(data?.saldo_previsto ?? 0)}
          sub="Receber − Pagar em aberto"
          color={(data?.saldo_previsto ?? 0) >= 0 ? G.green : G.red}
          icon={TrendingUp}
          to="/financeiro/relatorios/fluxo-caixa"
        />
        <KpiCard
          label="Inadimplência"
          value={fmtBRL(Number(r?.vencido ?? 0))}
          sub="Contas a receber vencidas"
          color={G.mustard}
          icon={AlertTriangle}
          to="/financeiro/receber"
        />
      </div>

      {/* Chart + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Gráfico Evolução */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: G.text }}>Evolução dos Últimos 6 Meses</div>
              <div style={{ fontSize: 12, color: G.muted }}>Receitas x Despesas lançadas</div>
            </div>
            <Link to="/financeiro/relatorios/fluxo-caixa" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none' }}>
              Ver fluxo <ChevronRight size={14} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.grafico ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={G.green} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={G.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={G.red} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={G.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={G.border} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: G.muted }} />
              <YAxis tick={{ fontSize: 11, fill: G.muted }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="receitas" name="Receitas" stroke={G.green} fill="url(#colorRec)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="despesas" name="Despesas" stroke={G.red}   fill="url(#colorPag)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Atenção Pagar */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 14 }}>
              Atenção — Contas a Pagar
            </div>
            <AlertBox label="Vencidas"      value={Number(p?.vencido ?? 0)}    color={G.red} />
            <AlertBox label="Vencem hoje"   value={Number(p?.hoje ?? 0)}       color={G.mustard} />
            <AlertBox label="Próx. 7 dias"  value={Number(p?.prox_7_dias ?? 0)} color={G.text} />
            <Link to="/financeiro/pagar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12, fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none' }}>
              Ver todos <ChevronRight size={13} />
            </Link>
          </div>

          {/* Atenção Receber */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 14 }}>
              Atenção — Contas a Receber
            </div>
            <AlertBox label="Vencidas"      value={Number(r?.vencido ?? 0)}    color={G.red} />
            <AlertBox label="Vencem hoje"   value={Number(r?.hoje ?? 0)}       color={G.mustard} />
            <AlertBox label="Próx. 7 dias"  value={Number(r?.prox_7_dias ?? 0)} color={G.text} />
            <Link to="/financeiro/receber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12, fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none' }}>
              Ver todos <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {[
          { label: 'Fluxo de Caixa', to: '/financeiro/relatorios/fluxo-caixa', icon: BarChart2 },
          { label: 'DRE Gerencial',  to: '/financeiro/relatorios/dre',         icon: TrendingUp },
          { label: 'Plano de Contas',to: '/financeiro/plano-contas',           icon: Wallet },
        ].map(({ label, to, icon: Icon }) => (
          <Link key={to} to={to} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            background: G.card, border: `1px solid ${G.border}`, borderRadius: 8,
            fontSize: 13, fontWeight: 500, color: G.text, textDecoration: 'none', transition: 'border-color .15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = G.mustard)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = G.border)}
          >
            <Icon size={16} color={G.mustard} /> {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
