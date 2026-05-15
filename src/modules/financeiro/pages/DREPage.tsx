import { useState } from 'react'
import { BarChart2, Download } from 'lucide-react'
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

function fmtBRL(v: any) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}

function fmtPct(v: number, total: number) {
  if (!total) return '—'
  return ((v / total) * 100).toFixed(1) + '%'
}

interface DREItem {
  tipo: 'R' | 'D'
  codigo: string
  descricao: string
  valor: number
}

interface DREData {
  receitas: DREItem[]
  despesas: DREItem[]
  totais: { receitas: number; despesas: number; resultado: number }
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const inputStyle: React.CSSProperties = {
  display: 'block', padding: '8px 10px', border: `1px solid ${G.border}`,
  borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none',
}

export default function DREPage() {
  const now = new Date()
  const [mes, setMes]         = useState(String(now.getMonth() + 1))
  const [ano, setAno]         = useState(String(now.getFullYear()))
  const [data, setData]       = useState<DREData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function gerar() {
    setLoading(true); setError('')
    try {
      const r = await api.get('/financeiro/relatorios/dre', { params: { mes, ano } })
      if (r.data.success) setData(r.data.data)
      else setError('Erro ao gerar DRE')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao carregar')
    } finally { setLoading(false) }
  }

  function exportCSV() {
    if (!data) return
    const lines = [
      'Tipo,Código,Descrição,Valor',
      ...data.receitas.map(r => `RECEITA,${r.codigo},${r.descricao},${r.valor}`),
      `RECEITA TOTAL,,,${data.totais.receitas}`,
      ...data.despesas.map(d => `DESPESA,${d.codigo},${d.descricao},${d.valor}`),
      `DESPESA TOTAL,,,${data.totais.despesas}`,
      `RESULTADO,,,${data.totais.resultado}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `dre-${ano}-${mes}.csv`; a.click()
  }

  const totalReceitas = data?.totais.receitas ?? 0
  const resultado = data?.totais.resultado ?? 0

  return (
    <div style={{ background: G.bg, minHeight: '100%' }}>

      {/* Hero */}
      <div style={{
        background: G.navy, backgroundImage: GRID_BG,
        padding: '28px 28px 52px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', background: `radial-gradient(circle, ${G.mustard}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} color={G.mustard} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>DRE Gerencial</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Demonstração do Resultado do Exercício</p>
            </div>
          </div>
          {data && (
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid rgba(255,255,255,.2)', background: 'transparent', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: 'rgba(255,255,255,.8)' }}>
              <Download size={14} /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      {data ? (
        <div style={{ padding: '0 28px', marginTop: -28, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Total Receitas',    value: fmtBRL(data.totais.receitas),  color: G.green },
              { label: 'Total Despesas',    value: fmtBRL(data.totais.despesas),  color: G.red },
              { label: 'Resultado Líquido', value: fmtBRL(resultado),             color: resultado >= 0 ? G.green : G.red },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: G.card, borderRadius: 10, padding: '14px 18px',
                borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.08)',
              }}>
                <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 28px', marginTop: -28, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {['Total Receitas', 'Total Despesas', 'Resultado Líquido'].map(label => (
              <div key={label} style={{ background: G.card, borderRadius: 10, padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,.08)', opacity: 0.6 }}>
                <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: G.muted }}>—</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '20px 28px 28px' }}>

        {/* Filters */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-end', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Mês
            <select value={mes} onChange={e => setMes(e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 4, width: 140 }}>
              {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Ano
            <select value={ano} onChange={e => setAno(e.target.value)} style={{ ...inputStyle, display: 'block', marginTop: 4, width: 100 }}>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button onClick={gerar} disabled={loading}
            style={{ padding: '8px 24px', background: G.mustard, border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', color: G.text }}>
            {loading ? 'Gerando...' : 'Gerar DRE'}
          </button>
          {data && (
            <div style={{ marginLeft: 'auto', fontSize: 13, color: G.muted }}>
              Competência: <strong style={{ color: G.text }}>{MONTHS[parseInt(mes) - 1]} / {ano}</strong>
            </div>
          )}
        </div>

        {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {data && (
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: G.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Código</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: G.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Descrição</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: G.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Valor</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: G.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>% Receita</th>
                </tr>
              </thead>
              <tbody>

                {/* RECEITAS */}
                <tr>
                  <td colSpan={4} style={{ padding: '10px 16px', fontWeight: 700, color: '#065F46', fontSize: 12, letterSpacing: '0.05em', background: '#D1FAE5', borderTop: `2px solid ${G.border}` }}>
                    RECEITAS
                  </td>
                </tr>
                {data.receitas.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${G.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9F7F4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 16px', color: G.muted, fontFamily: 'monospace', fontSize: 12 }}>{r.codigo}</td>
                    <td style={{ padding: '9px 16px', color: G.text }}>{r.descricao}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: G.green, fontWeight: 600 }}>{fmtBRL(r.valor)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: G.muted }}>{fmtPct(Number(r.valor), totalReceitas)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#F0FDF4', borderTop: `2px solid #86EFAC` }}>
                  <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, color: '#065F46' }}>Total Receitas</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: G.green }}>{fmtBRL(data.totais.receitas)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: G.green }}>100%</td>
                </tr>

                {/* DESPESAS */}
                <tr>
                  <td colSpan={4} style={{ padding: '10px 16px', fontWeight: 700, color: '#991B1B', fontSize: 12, letterSpacing: '0.05em', background: '#FEE2E2', borderTop: `2px solid ${G.border}` }}>
                    DESPESAS
                  </td>
                </tr>
                {data.despesas.map((d, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${G.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9F7F4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 16px', color: G.muted, fontFamily: 'monospace', fontSize: 12 }}>{d.codigo}</td>
                    <td style={{ padding: '9px 16px', color: G.text }}>{d.descricao}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: G.red, fontWeight: 600 }}>{fmtBRL(d.valor)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: G.muted }}>{fmtPct(Number(d.valor), totalReceitas)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#FFF5F5', borderTop: `2px solid #FECACA` }}>
                  <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, color: '#991B1B' }}>Total Despesas</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: G.red }}>{fmtBRL(data.totais.despesas)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: G.red }}>{fmtPct(data.totais.despesas, totalReceitas)}</td>
                </tr>

                {/* RESULTADO */}
                <tr style={{
                  background: resultado >= 0 ? '#F0FDF4' : '#FFF5F5',
                  borderTop: `3px solid ${resultado >= 0 ? G.green : G.red}`,
                }}>
                  <td colSpan={2} style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: resultado >= 0 ? G.green : G.red }}>
                    RESULTADO LÍQUIDO
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: resultado >= 0 ? G.green : G.red }}>
                    {fmtBRL(resultado)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: resultado >= 0 ? G.green : G.red }}>
                    {fmtPct(resultado, totalReceitas)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!loading && !data && !error && (
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 48, textAlign: 'center', color: G.muted, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
            Selecione o mês e o ano e clique em <strong>"Gerar DRE"</strong>.
          </div>
        )}
      </div>
    </div>
  )
}
