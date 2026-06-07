import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertTriangle,
  Plus, BarChart2, Wallet, ChevronRight, BookOpen, PieChart, FileText
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { api } from '@/shared/lib/api'

const G = {
  bg:      '#E8E1D4',
  card:    '#FFFFFF',
  border:  '#D6CDB8',
  text:    '#28374A',
  muted:   '#7A8899',
  mustard: '#FFD200',
  green:   '#059669',
  red:     '#DC2626',
  navy:    '#1E2D3D',
}

const GRID_BG = `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 0v40M40 0v40M0 0h40M0 40h40' stroke='%23ffffff' stroke-width='0.4' stroke-opacity='0.07'/%3E%3C/svg%3E")`

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

interface DashData {
  receber: { vencido: number; hoje: number; prox_7_dias: number; total_aberto: number }
  pagar:   { vencido: number; hoje: number; prox_7_dias: number; total_aberto: number }
  por_centro: { centro: string; receitas: number; despesas: number }[]
  saldo_previsto: number
}

function KpiCard({ label, value, sub, color, icon: Icon, to }: {
  label: string; value: string; sub?: string; color: string; icon: any; to: string
}) {
  return (
    <Link to={to} style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: G.card, borderRadius: 12, padding: '18px 20px',
      textDecoration: 'none', transition: 'box-shadow .15s',
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
    }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.13)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>{label}</span>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: G.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: G.muted }}>{sub}</div>}
    </Link>
  )
}

function AlertBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${G.border}` }}>
      <span style={{ fontSize: 13, color: G.text }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmtBRL(value)}</span>
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
  const anoAtual = new Date().getFullYear()
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [ano, setAno] = useState(anoAtual)
  const [meses, setMeses] = useState<number[]>([])
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/financeiro/dashboard/summary', { params: { ano, meses: meses.join(',') } })
      .then(r => r.data.success && setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ano, meses])

  const toggleMes = (m: number) => setMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b))
  const mesBtn = (active: boolean) => ({ padding: '5px 9px', borderRadius: 7, border: `1px solid ${active ? G.navy : G.border}`, background: active ? G.navy : '#fff', color: active ? '#fff' : G.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' as const })

  if (loading && !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: G.muted }}>
      Carregando dados financeiros...
    </div>
  )

  const r = data?.receber
  const p = data?.pagar
  const saldo = data?.saldo_previsto ?? 0

  return (
    <div style={{ background: G.bg, minHeight: '100%' }}>

      {/* Hero */}
      <div style={{
        background: G.navy, backgroundImage: GRID_BG,
        padding: '32px 32px 60px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 220, height: 220,
          borderRadius: '50%', background: `radial-gradient(circle, ${G.mustard}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Wallet size={22} color={G.mustard} />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Financeiro</h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.55)' }}>Painel administrativo do financeiro</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/financeiro/receber" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: G.green, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
            }}>
              <Plus size={14} /> Recebimento
            </Link>
            <Link to="/financeiro/pagar" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: G.red, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
            }}>
              <Plus size={14} /> Pagamento
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Strip flutuante */}
      <div style={{ padding: '0 32px', marginTop: -36, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard
            label="A Receber"
            value={fmtBRL(Number(r?.total_aberto ?? 0))}
            sub={`Vencido: ${fmtBRL(Number(r?.vencido ?? 0))}`}
            color={G.green} icon={ArrowDownCircle}
            to="/financeiro/receber"
          />
          <KpiCard
            label="A Pagar"
            value={fmtBRL(Number(p?.total_aberto ?? 0))}
            sub={`Vencido: ${fmtBRL(Number(p?.vencido ?? 0))}`}
            color={G.red} icon={ArrowUpCircle}
            to="/financeiro/pagar"
          />
          <KpiCard
            label="Saldo Previsto"
            value={fmtBRL(saldo)}
            sub="Receber − Pagar em aberto"
            color={saldo >= 0 ? G.green : G.red} icon={TrendingUp}
            to="/financeiro/relatorios/fluxo-caixa"
          />
          <KpiCard
            label="Inadimplência"
            value={fmtBRL(Number(r?.vencido ?? 0))}
            sub="Contas a receber vencidas"
            color={G.mustard} icon={AlertTriangle}
            to="/financeiro/receber"
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px 32px' }}>

        {/* Filtro de período (ano + meses) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18, background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: G.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Período</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[anoAtual, anoAtual - 1, anoAtual - 2].map(a => (
              <button key={a} onClick={() => setAno(a)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${ano === a ? G.navy : G.border}`, background: ano === a ? G.navy : '#fff', color: ano === a ? '#fff' : G.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{a}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: G.border }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setMeses([])} style={mesBtn(meses.length === 0)}>Todos</button>
            {MESES.map((m, idx) => (
              <button key={m} onClick={() => toggleMes(idx + 1)} style={mesBtn(meses.includes(idx + 1))}>{m}</button>
            ))}
          </div>
          {loading && <span style={{ fontSize: 11, color: G.muted, marginLeft: 'auto' }}>atualizando…</span>}
        </div>

        {/* Chart + Alerts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>

          {/* Receitas × Despesas por Centro de Custo */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>Receitas × Despesas por Centro de Custo</div>
              <div style={{ fontSize: 12, color: G.muted }}>{ano}{meses.length ? ` · ${meses.length} ${meses.length === 1 ? 'mês' : 'meses'}` : ' · ano todo'} · por vencimento</div>
            </div>
            {(() => {
              const lista = data?.por_centro ?? []
              if (!lista.length) return <div style={{ padding: 40, textAlign: 'center', color: G.muted, fontSize: 13 }}>Sem lançamentos no período selecionado.</div>
              const max = Math.max(1, ...lista.flatMap(c => [Number(c.receitas), Number(c.despesas)]))
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                  {lista.map(c => {
                    const rec = Number(c.receitas), desp = Number(c.despesas)
                    return (
                      <div key={c.centro}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 5 }}>
                          <span style={{ color: G.text, fontWeight: 600, maxWidth: '58%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.centro}</span>
                          <span style={{ color: G.muted, fontSize: 11 }}>Saldo <strong style={{ color: rec - desp >= 0 ? G.green : G.red }}>{fmtBRL(rec - desp)}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <div style={{ flex: 1, height: 13, background: G.bg, borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(rec / max) * 100}%`, background: G.green, borderRadius: 4, minWidth: rec > 0 ? 2 : 0 }} />
                          </div>
                          <span style={{ fontSize: 11, color: G.green, fontWeight: 600, width: 112, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(rec)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 13, background: G.bg, borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(desp / max) * 100}%`, background: G.red, borderRadius: 4, minWidth: desp > 0 ? 2 : 0 }} />
                          </div>
                          <span style={{ fontSize: 11, color: G.red, fontWeight: 600, width: 112, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(desp)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${G.border}`, fontSize: 11, color: G.muted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: G.green }} /> Receitas</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: G.red }} /> Despesas</span>
            </div>
          </div>

          {/* Alertas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,.05)', borderTop: `3px solid ${G.red}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 12 }}>Atenção — A Pagar</div>
              <AlertBox label="Vencidas"     value={Number(p?.vencido ?? 0)}     color={G.red} />
              <AlertBox label="Vencem hoje"  value={Number(p?.hoje ?? 0)}        color={G.mustard} />
              <AlertBox label="Próx. 7 dias" value={Number(p?.prox_7_dias ?? 0)} color={G.text} />
              <Link to="/financeiro/pagar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10, fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none' }}>
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>

            <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,.05)', borderTop: `3px solid ${G.green}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 12 }}>Atenção — A Receber</div>
              <AlertBox label="Vencidas"     value={Number(r?.vencido ?? 0)}     color={G.red} />
              <AlertBox label="Vencem hoje"  value={Number(r?.hoje ?? 0)}        color={G.mustard} />
              <AlertBox label="Próx. 7 dias" value={Number(r?.prox_7_dias ?? 0)} color={G.text} />
              <Link to="/financeiro/receber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10, fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none' }}>
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Ferramentas do Master */}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Ferramentas financeiras</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, color: G.navy, background: G.mustard, padding: '2px 7px', borderRadius: 5 }}>MASTER</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            {[
              { label: 'Livro Caixa',     desc: 'Conta corrente — caixa, bancos e lançamentos', to: '/financeiro/livro-caixa',            icon: BookOpen,  color: G.mustard },
              { label: 'Fluxo de Caixa',  desc: 'Entradas e saídas projetadas por período',     to: '/financeiro/relatorios/fluxo-caixa', icon: BarChart2, color: G.green },
              { label: 'DRE Gerencial',   desc: 'Resultado — receitas, despesas e margem',       to: '/financeiro/relatorios/dre',         icon: PieChart,  color: G.navy },
              { label: 'NFS-e — Comissões', desc: 'Notas de serviço às representadas e apuração de impostos', to: '/financeiro/nfse-comissoes',         icon: FileText,  color: G.red },
            ].map(({ label, desc, to, icon: Icon, color, soon }) => {
              const inner = (
                <>
                  <span style={{ width: 46, height: 46, borderRadius: 12, background: color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} color={color} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>{label}</div>
                    <div style={{ fontSize: 12, color: G.muted }}>{desc}</div>
                  </div>
                  {soon
                    ? <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .5, color: G.muted, background: 'rgba(0,0,0,.05)', border: `1px solid ${G.border}`, padding: '2px 6px', borderRadius: 5, flexShrink: 0 }}>EM BREVE</span>
                    : <ChevronRight size={18} color={G.muted} />}
                </>
              )
              const baseStyle: React.CSSProperties = {
                display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px',
                background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
                textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.05)',
              }
              if (soon) return (
                <div key={to} title="Em desenvolvimento" style={{ ...baseStyle, opacity: .6, cursor: 'default' }}>{inner}</div>
              )
              return (
                <Link key={to} to={to} style={{ ...baseStyle, transition: 'border-color .15s, box-shadow .15s, transform .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = '0 8px 22px rgba(0,0,0,.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.05)'; e.currentTarget.style.transform = 'none' }}
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
