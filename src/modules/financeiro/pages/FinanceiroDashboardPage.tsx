import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertTriangle,
  Plus, BarChart2, Wallet, ChevronRight, BookOpen, PieChart, FileText
} from 'lucide-react'
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

// Rosca (donut) de um centro de custo — mostra só o valor daquele centro e o seu peso no período.
function Donut({ name, value, pct, color }: { name: string; value: number; pct: number; color: string }) {
  const size = 108, stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, pct))
  const dash = frac * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '10px 6px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={G.bg} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: G.text, lineHeight: 1 }}>{Math.round(frac * 100)}%</span>
          <span style={{ fontSize: 9, color: G.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>do período</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 158 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: G.text, lineHeight: 1.25, height: 28, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={name}>{name}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(value)}</div>
      </div>
    </div>
  )
}

function VencItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${G.border}` }}>
      <span style={{ fontSize: 13, color: G.text }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(value)}</span>
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

        {/* Em aberto por Centro de Custo — roscas */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>Em aberto por Centro de Custo</div>
            <div style={{ fontSize: 12, color: G.muted }}>Saldo a pagar/receber · {ano}{meses.length ? ` · ${meses.length} ${meses.length === 1 ? 'mês' : 'meses'}` : ' · ano todo'} · por vencimento</div>
          </div>
          {(() => {
            const lista = data?.por_centro ?? []
            if (!lista.length) return <div style={{ padding: 40, textAlign: 'center', color: G.muted, fontSize: 13 }}>Sem lançamentos em aberto no período selecionado.</div>
            const itens = lista.map(c => {
              const rec = Number(c.receitas), desp = Number(c.despesas)
              const net = rec - desp
              return { centro: c.centro, rec, desp, net, abs: Math.abs(net) }
            })
            const somaAbs = itens.reduce((s, i) => s + i.abs, 0) || 1
            const totDesp = itens.reduce((s, i) => s + i.desp, 0)
            const totRec  = itens.reduce((s, i) => s + i.rec, 0)
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                  {itens.map(i => (
                    <Donut key={i.centro} name={i.centro} value={i.abs} pct={i.abs / somaAbs}
                      color={i.net >= 0 ? G.green : G.red} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${G.border}`, fontSize: 12, color: G.muted }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: G.red }} /> Despesas em aberto: <strong style={{ color: G.red }}>{fmtBRL(totDesp)}</strong></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: G.green }} /> Receitas em aberto: <strong style={{ color: G.green }}>{fmtBRL(totRec)}</strong></span>
                  <span style={{ marginLeft: 'auto', color: G.text }}>Confere com os cards <strong>A Pagar</strong> / <strong>A Receber</strong> acima.</span>
                </div>
              </>
            )
          })()}
        </div>

        {/* Próximos vencimentos — A Pagar × A Receber lado a lado */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 16 }}>Próximos vencimentos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <ArrowUpCircle size={15} color={G.red} />
                <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>A Pagar</span>
              </div>
              <VencItem label="Vencidas"     value={Number(p?.vencido ?? 0)}     color={G.red} />
              <VencItem label="Vencem hoje"  value={Number(p?.hoje ?? 0)}        color={G.mustard} />
              <VencItem label="Próx. 7 dias" value={Number(p?.prox_7_dias ?? 0)} color={G.text} />
              <Link to="/financeiro/pagar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10, fontSize: 12, color: G.muted, fontWeight: 600, textDecoration: 'none' }}>
                Abrir Contas a Pagar <ChevronRight size={13} />
              </Link>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <ArrowDownCircle size={15} color={G.green} />
                <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>A Receber</span>
              </div>
              <VencItem label="Vencidas"     value={Number(r?.vencido ?? 0)}     color={G.red} />
              <VencItem label="Vencem hoje"  value={Number(r?.hoje ?? 0)}        color={G.mustard} />
              <VencItem label="Próx. 7 dias" value={Number(r?.prox_7_dias ?? 0)} color={G.text} />
              <Link to="/financeiro/receber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10, fontSize: 12, color: G.muted, fontWeight: 600, textDecoration: 'none' }}>
                Abrir Contas a Receber <ChevronRight size={13} />
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
