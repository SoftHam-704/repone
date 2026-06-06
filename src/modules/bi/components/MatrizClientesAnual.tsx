import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/shared/lib/api'
import { useBIStore, buildBIParams } from '../store/useBIStore'
import { BI, fmtBRL, fmtN } from './biTokens'

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
type Metric = 'valor' | 'qtd'

interface LinhaApi { cli_codigo: number; cli_nome: string; mes: number; total: string | number; quantidade: string | number }
interface AnoApi { ano: number; linhas: LinhaApi[] }

const STICKY_BG = BI.panelHi
const cell = (a: CSSProperties['textAlign'] = 'right'): CSSProperties => ({ padding: '5px 8px', textAlign: a, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 11 })

export default function MatrizClientesAnual() {
  const { filters } = useBIStore()
  const [metric, setMetric] = useState<Metric>('valor')
  const [data, setData] = useState<AnoApi[]>([])
  const [loading, setLoading] = useState(true)

  const [anoAtual, anoAnterior] = useMemo(() => {
    const a = [...(filters.anos || [])].sort((x, y) => y - x)
    if (a.length >= 2) return [a[0], a[1]]
    const base = a[0] || new Date().getFullYear()
    return [base, base - 1]
  }, [filters.anos])

  useEffect(() => {
    setLoading(true)
    const params = buildBIParams({ ...filters, anos: [anoAtual, anoAnterior] })
    api.get(`/bi/matriz-clientes-anual?${params}`)
      .then(r => setData(r.data.data || [])).catch(() => setData([])).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoAtual, anoAnterior, filters.for_codigo, filters.ven_codigo])

  const field = metric === 'valor' ? 'total' : 'quantidade'
  const fmtCell = (v: number) => v === 0 ? '—' : (metric === 'valor' ? Math.round(v).toLocaleString('pt-BR') : fmtN(v))
  const fmtTot = (v: number) => metric === 'valor' ? fmtBRL(v) : fmtN(v)

  const { clientes, meses, totaisMes, totaisGeral } = useMemo(() => {
    const cliMap: Record<number, { codigo: number; nome: string; porAno: Record<number, Record<number, number>> }> = {}
    let maxMes = 0
    for (const ad of data) {
      for (const ln of ad.linhas) {
        const cod = Number(ln.cli_codigo)
        if (!cliMap[cod]) cliMap[cod] = { codigo: cod, nome: ln.cli_nome, porAno: {} }
        if (!cliMap[cod].porAno[ad.ano]) cliMap[cod].porAno[ad.ano] = {}
        const v = Number((ln as any)[field]) || 0
        cliMap[cod].porAno[ad.ano][ln.mes] = v
        if (ad.ano === anoAtual && v > 0 && ln.mes > maxMes) maxMes = ln.mes
      }
    }
    if (maxMes === 0) maxMes = 12
    const meses = Array.from({ length: maxMes }, (_, i) => i + 1)
    const totCli = (c: typeof cliMap[number], ano: number) => meses.reduce((s, m) => s + (c.porAno[ano]?.[m] || 0), 0)
    const clientes = Object.values(cliMap)
      .map(c => ({ ...c, totalAtual: totCli(c, anoAtual), totalAnt: totCli(c, anoAnterior) }))
      .sort((a, b) => b.totalAtual - a.totalAtual)
    const totaisMes: Record<number, Record<number, number>> = { [anoAnterior]: {}, [anoAtual]: {} }
    ;[anoAnterior, anoAtual].forEach(ano => { meses.forEach(m => { totaisMes[ano][m] = clientes.reduce((s, c) => s + (c.porAno[ano]?.[m] || 0), 0) }) })
    const totaisGeral: Record<number, number> = {
      [anoAnterior]: clientes.reduce((s, c) => s + c.totalAnt, 0),
      [anoAtual]: clientes.reduce((s, c) => s + c.totalAtual, 0),
    }
    return { clientes, meses, totaisMes, totaisGeral }
  }, [data, field, anoAtual, anoAnterior])

  const totDelta = totaisGeral[anoAtual] - totaisGeral[anoAnterior]
  const totPct = totaisGeral[anoAnterior] ? (totDelta / totaisGeral[anoAnterior]) * 100 : (totaisGeral[anoAtual] ? 100 : 0)
  const up = totDelta >= 0

  const totColStyle: CSSProperties = { ...cell('right'), background: BI.accentSoft, fontWeight: 700, color: BI.text }
  const cliColStyle: CSSProperties = { ...cell('left'), position: 'sticky', left: 0, background: STICKY_BG, zIndex: 1, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }
  const blocoBorder: CSSProperties = { borderLeft: `2px solid ${BI.borderStrong}` }

  const Bloco = ({ ano, isAtual }: { ano: number; isAtual: boolean }) => (
    <>
      {meses.map((m, i) => (
        <th key={`h-${ano}-${m}`} style={{ ...cell('right'), color: BI.textMuted, fontWeight: 700, ...(i === 0 ? blocoBorder : {}) }}>{MES[m - 1]}</th>
      ))}
      <th style={{ ...cell('right'), color: isAtual ? BI.teal : BI.textSec, fontWeight: 800, background: BI.accentSoft }}>Total</th>
    </>
  )

  return (
    <div className="glass-card rounded-[20px]" style={{ padding: '24px 24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${BI.info}, ${BI.purple})`, borderRadius: '16px 16px 0 0' }} />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: BI.info }}>Faturamento por Cliente · Anual</p>
          <p className="text-[10px]" style={{ color: BI.textMuted }}>{anoAnterior} vs {anoAtual} · mês a mês por cliente · só vendas (P/F){filters.for_codigo ? ' · indústria filtrada' : ''}</p>
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
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BI.textMuted }}>Carregando…</div>
      ) : !clientes.length ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BI.textMuted }}>Sem dados no período/filtro.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', color: BI.textSec, minWidth: '100%' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...cliColStyle, ...cell('left'), color: BI.textMuted, fontWeight: 800, fontSize: 10, textTransform: 'uppercase', position: 'sticky', left: 0, zIndex: 2, background: STICKY_BG }}>Cliente</th>
                <th colSpan={meses.length + 1} style={{ ...cell('center'), color: BI.textSec, fontWeight: 800, ...blocoBorder }}>{anoAnterior}</th>
                <th colSpan={meses.length + 1} style={{ ...cell('center'), color: BI.teal, fontWeight: 800, ...blocoBorder }}>{anoAtual}</th>
              </tr>
              <tr>
                <Bloco ano={anoAnterior} isAtual={false} />
                <Bloco ano={anoAtual} isAtual={true} />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, idx) => (
                <tr key={c.codigo} style={{ borderTop: `1px solid ${BI.border}`, background: idx % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ ...cliColStyle, background: idx % 2 ? '#11414c' : STICKY_BG, color: BI.text, fontWeight: 600 }} title={c.nome}>{c.nome}</td>
                  {meses.map((m, i) => (
                    <td key={`a-${c.codigo}-${m}`} style={{ ...cell('right'), color: BI.textSec, ...(i === 0 ? blocoBorder : {}) }}>{fmtCell(c.porAno[anoAnterior]?.[m] || 0)}</td>
                  ))}
                  <td style={totColStyle}>{fmtTot(c.totalAnt)}</td>
                  {meses.map((m, i) => (
                    <td key={`b-${c.codigo}-${m}`} style={{ ...cell('right'), color: BI.text, ...(i === 0 ? blocoBorder : {}) }}>{fmtCell(c.porAno[anoAtual]?.[m] || 0)}</td>
                  ))}
                  <td style={{ ...totColStyle, color: BI.teal }}>{fmtTot(c.totalAtual)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${BI.teal}`, fontWeight: 800, color: BI.text }}>
                <td style={{ ...cliColStyle, background: STICKY_BG, fontWeight: 800 }}>TOTAL</td>
                {meses.map((m, i) => (
                  <td key={`ta-${m}`} style={{ ...cell('right'), ...(i === 0 ? blocoBorder : {}) }}>{fmtCell(totaisMes[anoAnterior][m] || 0)}</td>
                ))}
                <td style={totColStyle}>{fmtTot(totaisGeral[anoAnterior])}</td>
                {meses.map((m, i) => (
                  <td key={`tb-${m}`} style={{ ...cell('right'), ...(i === 0 ? blocoBorder : {}) }}>{fmtCell(totaisMes[anoAtual][m] || 0)}</td>
                ))}
                <td style={{ ...totColStyle, color: BI.teal }}>{fmtTot(totaisGeral[anoAtual])}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && clientes.length > 0 && (
        <div className="mt-4 flex items-center gap-3 flex-wrap" style={{ padding: '12px 16px', borderRadius: 12, background: up ? 'rgba(180,255,157,0.08)' : 'rgba(255,138,122,0.08)', border: `1px solid ${up ? BI.success : BI.danger}33` }}>
          {up ? <TrendingUp size={20} color={BI.success} /> : <TrendingDown size={20} color={BI.danger} />}
          <span style={{ color: BI.text, fontWeight: 700 }}>Carteira {anoAtual} vs {anoAnterior}: {up ? 'cresceu' : 'caiu'} {Math.abs(totPct).toFixed(1)}%</span>
          <span style={{ color: BI.textMuted, fontSize: 13 }}>{fmtTot(totaisGeral[anoAnterior])} → {fmtTot(totaisGeral[anoAtual])} ({up ? '+' : '−'}{fmtTot(Math.abs(totDelta))})</span>
        </div>
      )}
    </div>
  )
}
