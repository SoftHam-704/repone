import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ReactECharts from 'echarts-for-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/shared/lib/api'
import { useBIStore, buildBIParams } from '../store/useBIStore'
import { BI, fmtBRL, fmtN } from './biTokens'

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
type Metric = 'valor' | 'qtd'

interface SerieMes { mes: number; total: string | number; quantidade: string | number; pedidos: number }
interface AnoData { ano: number; series: SerieMes[] }

const th = (a: CSSProperties['textAlign']): CSSProperties => ({ padding: '6px 8px', textAlign: a, fontWeight: 700, whiteSpace: 'nowrap' })
const td = (a: CSSProperties['textAlign']): CSSProperties => ({ padding: '6px 8px', textAlign: a, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' })

export default function ComparativoAnual() {
  const { filters } = useBIStore()
  const [metric, setMetric] = useState<Metric>('valor')
  const [data, setData] = useState<AnoData[]>([])
  const [loading, setLoading] = useState(true)

  // Dois anos: se 2 selecionados, usa-os; senão ano-base + anterior.
  const [anoAtual, anoAnterior] = useMemo(() => {
    const a = [...(filters.anos || [])].sort((x, y) => y - x)
    if (a.length >= 2) return [a[0], a[1]]
    const base = a[0] || new Date().getFullYear()
    return [base, base - 1]
  }, [filters.anos])

  useEffect(() => {
    setLoading(true)
    const params = buildBIParams({ ...filters, anos: [anoAtual, anoAnterior] })
    api.get(`/bi/comparativo-anual?${params}`)
      .then(r => setData(r.data.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoAtual, anoAnterior, filters.for_codigo, filters.cli_codigo, filters.ven_codigo])

  const field = metric === 'valor' ? 'total' : 'quantidade'
  const mapaAno = (ano: number) => {
    const yr = data.find(d => d.ano === ano)
    const m: Record<number, number> = {}
    ;(yr?.series || []).forEach(s => { m[s.mes] = Number(s[field]) || 0 })
    return m
  }
  const mAtual = mapaAno(anoAtual)
  const mAnt = mapaAno(anoAnterior)

  const linhas = MES.map((label, i) => {
    const mes = i + 1
    const atual = mAtual[mes] || 0
    const ant = mAnt[mes] || 0
    const delta = atual - ant
    const pct = ant ? (delta / ant) * 100 : (atual ? 100 : 0)
    return { mes, label, atual, ant, delta, pct }
  })
  const totAtual = linhas.reduce((s, l) => s + l.atual, 0)
  const totAnt = linhas.reduce((s, l) => s + l.ant, 0)
  const totDelta = totAtual - totAnt
  const totPct = totAnt ? (totDelta / totAnt) * 100 : (totAtual ? 100 : 0)
  const up = totDelta >= 0

  const fmt = (v: number) => metric === 'valor' ? fmtBRL(v) : fmtN(v)

  const option = useMemo(() => ({
    grid: { left: 6, right: 10, top: 30, bottom: 18, containLabel: true },
    legend: { data: [String(anoAnterior), String(anoAtual)], top: 0, textStyle: { color: BI.textSec, fontSize: 11 } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
    xAxis: { type: 'category', data: MES, axisLabel: { color: BI.textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: BI.border } } },
    yAxis: {
      type: 'value',
      axisLabel: { color: BI.textMuted, fontSize: 10, formatter: (v: number) => (v || 0).toLocaleString('pt-BR') },
      splitLine: { lineStyle: { color: BI.border } },
    },
    series: [
      { name: String(anoAnterior), type: 'bar', data: linhas.map(l => l.ant), itemStyle: { color: BI.textDisabled, borderRadius: [3, 3, 0, 0] } },
      { name: String(anoAtual), type: 'bar', data: linhas.map(l => l.atual), itemStyle: { color: BI.teal, borderRadius: [3, 3, 0, 0] } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, metric, anoAtual, anoAnterior])

  return (
    <div className="glass-card rounded-[20px]" style={{ padding: '24px 24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${BI.teal}, ${BI.info})`, borderRadius: '16px 16px 0 0' }} />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: BI.teal }}>Comparativo Anual</p>
          <p className="text-[10px]" style={{ color: BI.textMuted }}>{anoAnterior} vs {anoAtual} · mês a mês · só vendas (P/F)</p>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BI.border}` }}>
          {(['valor', 'qtd'] as Metric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)} className="px-3 py-1 text-xs font-bold transition-colors"
              style={{ background: metric === m ? BI.teal : 'transparent', color: metric === m ? '#06202a' : BI.textSec }}>
              {m === 'valor' ? 'Valor (R$)' : 'Quantidade'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BI.textMuted }}>Carregando…</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: BI.textSec }}>
              <thead>
                <tr style={{ color: BI.textMuted, fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={th('left')}>Mês</th>
                  <th style={th('right')}>{anoAnterior}</th>
                  <th style={th('right')}>{anoAtual}</th>
                  <th style={th('right')}>Δ</th>
                  <th style={th('center')}>Δ%</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.mes} style={{ borderTop: `1px solid ${BI.border}` }}>
                    <td style={td('left')}>{l.label}</td>
                    <td style={td('right')}>{fmt(l.ant)}</td>
                    <td style={{ ...td('right'), color: BI.text, fontWeight: 700 }}>{fmt(l.atual)}</td>
                    <td style={{ ...td('right'), color: l.delta >= 0 ? BI.success : BI.danger }}>{l.delta >= 0 ? '+' : '−'}{fmt(Math.abs(l.delta))}</td>
                    <td style={{ ...td('center'), color: l.delta >= 0 ? BI.success : BI.danger, fontWeight: 700 }}>{l.delta >= 0 ? '▲' : '▼'} {Math.abs(l.pct).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${BI.teal}`, fontWeight: 800, color: BI.text }}>
                  <td style={td('left')}>TOTAL</td>
                  <td style={td('right')}>{fmt(totAnt)}</td>
                  <td style={td('right')}>{fmt(totAtual)}</td>
                  <td style={{ ...td('right'), color: up ? BI.success : BI.danger }}>{up ? '+' : '−'}{fmt(Math.abs(totDelta))}</td>
                  <td style={{ ...td('center'), color: up ? BI.success : BI.danger }}>{up ? '▲' : '▼'} {Math.abs(totPct).toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />
          </div>
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex items-center gap-3 flex-wrap" style={{ padding: '12px 16px', borderRadius: 12, background: up ? 'rgba(180,255,157,0.08)' : 'rgba(255,138,122,0.08)', border: `1px solid ${up ? BI.success : BI.danger}33` }}>
          {up ? <TrendingUp size={20} color={BI.success} /> : <TrendingDown size={20} color={BI.danger} />}
          <span style={{ color: BI.text, fontWeight: 700 }}>
            Produção {anoAtual} vs {anoAnterior}: {up ? 'cresceu' : 'caiu'} {Math.abs(totPct).toFixed(1)}%
          </span>
          <span style={{ color: BI.textMuted, fontSize: 13 }}>
            {fmt(totAnt)} → {fmt(totAtual)} ({up ? '+' : '−'}{fmt(Math.abs(totDelta))})
          </span>
        </div>
      )}
    </div>
  )
}
