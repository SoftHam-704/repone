import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { TrendingUp, Download } from 'lucide-react'
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
}

function fmtBRL(v: any) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function firstOfMonth() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

interface FluxoRow {
  periodo: string
  data_ref: string
  entradas: number
  saidas: number
  saldo: number
  saldo_acumulado: number
}

const inputStyle: React.CSSProperties = {
  display: 'block', padding: '8px 10px', border: `1px solid ${G.border}`,
  borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, color: G.text, marginBottom: 8 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtBRL(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function FluxoCaixaPage() {
  const [rows, setRows]       = useState<FluxoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [filters, setFilters] = useState({
    dataInicio: firstOfMonth(),
    dataFim: todayISO(),
    agrupamento: 'DIARIO',
  })

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  async function load() {
    if (!filters.dataInicio || !filters.dataFim) return
    setLoading(true); setError('')
    try {
      const r = await api.get('/financeiro/relatorios/fluxo-caixa', {
        params: { dataInicio: filters.dataInicio, dataFim: filters.dataFim, agrupamento: filters.agrupamento }
      })
      if (r.data.success) setRows(r.data.data)
      else setError('Erro ao carregar dados')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao carregar')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const totalEntradas = rows.reduce((s, r) => s + Number(r.entradas), 0)
  const totalSaidas   = rows.reduce((s, r) => s + Number(r.saidas),   0)
  const saldoFinal    = rows.length ? Number(rows[rows.length - 1].saldo_acumulado) : 0

  function exportCSV() {
    const header = 'Período,Entradas,Saídas,Saldo,Saldo Acumulado'
    const lines = rows.map(r =>
      `${r.periodo},${r.entradas},${r.saidas},${r.saldo},${r.saldo_acumulado}`
    )
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'fluxo-caixa.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingUp size={22} color={G.mustard} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: G.text }}>Fluxo de Caixa</h1>
            <p style={{ margin: 0, fontSize: 12, color: G.muted }}>Entradas e saídas por período</p>
          </div>
        </div>
        {rows.length > 0 && (
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: `1px solid ${G.border}`, background: G.card, borderRadius: 7, fontSize: 13, cursor: 'pointer', color: G.text }}>
            <Download size={14} /> Exportar CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data Início
          <input type="date" value={filters.dataInicio} onChange={e => setFilter('dataInicio', e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data Fim
          <input type="date" value={filters.dataFim} onChange={e => setFilter('dataFim', e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Agrupamento
          <select value={filters.agrupamento} onChange={e => setFilter('agrupamento', e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 4 }}>
            <option value="DIARIO">Diário</option>
            <option value="SEMANAL">Semanal</option>
            <option value="MENSAL">Mensal</option>
          </select>
        </label>
        <button onClick={load} disabled={loading}
          style={{ padding: '8px 20px', background: G.mustard, border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', color: G.text }}>
          {loading ? 'Carregando...' : 'Gerar'}
        </button>
      </div>

      {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {rows.length > 0 && (
        <>
          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total Entradas', value: totalEntradas, color: G.green },
              { label: 'Total Saídas',   value: totalSaidas,   color: G.red },
              { label: 'Saldo Final',    value: saldoFinal,    color: saldoFinal >= 0 ? G.green : G.red },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{fmtBRL(value)}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 16 }}>Evolução do Fluxo</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G.green} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={G.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G.red} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={G.red} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G.mustard} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={G.mustard} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={G.border} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: G.muted }} />
                <YAxis tick={{ fontSize: 11, fill: G.muted }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke={G.border} />
                <Area type="monotone" dataKey="entradas"       name="Entradas"         stroke={G.green}   fill="url(#gEnt)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="saidas"         name="Saídas"           stroke={G.red}     fill="url(#gSai)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="saldo_acumulado" name="Saldo Acumulado" stroke={G.mustard} fill="url(#gAcum)" strokeWidth={2} dot={false} strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 600, color: G.text }}>
              Detalhamento por Período
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['Período', 'Entradas', 'Saídas', 'Saldo do Período', 'Saldo Acumulado'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${G.border}` }}>
                    <td style={{ padding: '9px 14px', color: G.text, fontWeight: 500 }}>{r.periodo}</td>
                    <td style={{ padding: '9px 14px', color: G.green }}>{fmtBRL(r.entradas)}</td>
                    <td style={{ padding: '9px 14px', color: G.red }}>{fmtBRL(r.saidas)}</td>
                    <td style={{ padding: '9px 14px', color: Number(r.saldo) >= 0 ? G.green : G.red, fontWeight: 600 }}>{fmtBRL(r.saldo)}</td>
                    <td style={{ padding: '9px 14px', color: Number(r.saldo_acumulado) >= 0 ? G.text : G.red, fontWeight: 700 }}>{fmtBRL(r.saldo_acumulado)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ borderTop: `2px solid ${G.border}`, background: G.bg }}>
                  <td style={{ padding: '9px 14px', fontWeight: 700, color: G.text }}>TOTAL</td>
                  <td style={{ padding: '9px 14px', color: G.green, fontWeight: 700 }}>{fmtBRL(totalEntradas)}</td>
                  <td style={{ padding: '9px 14px', color: G.red,   fontWeight: 700 }}>{fmtBRL(totalSaidas)}</td>
                  <td style={{ padding: '9px 14px', color: (totalEntradas - totalSaidas) >= 0 ? G.green : G.red, fontWeight: 700 }}>{fmtBRL(totalEntradas - totalSaidas)}</td>
                  <td style={{ padding: '9px 14px', color: saldoFinal >= 0 ? G.text : G.red, fontWeight: 700 }}>{fmtBRL(saldoFinal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && rows.length === 0 && !error && (
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 48, textAlign: 'center', color: G.muted }}>
          Selecione o período e clique em "Gerar" para visualizar o fluxo de caixa.
        </div>
      )}
    </div>
  )
}
