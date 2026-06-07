import { useEffect, useMemo, useState } from 'react'
import { X, FileSpreadsheet } from 'lucide-react'
import { api } from '@/shared/lib/api'
import { exportRelatorioContasReceber } from '../utils/exportRelatorioContasReceber'

const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8', text: '#28374A',
  muted: '#7A8899', navy: '#1E2D3D', green: '#059669', amber: '#D97706', red: '#DC2626',
  yellow: '#FEF9C3',
}
const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
function fmtDate(d?: string | null) {
  if (!d) return '—'
  const [y, m, day] = String(d).substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}
const cR: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
const cL: React.CSSProperties = { padding: '6px 10px', textAlign: 'left' }

interface Linha {
  centro_custo: string; cliente: string; conta_descricao: string; numero_documento: string | null
  numero_parcela: number; data_vencimento: string; valor: number; recebido: number; saldo: number; status: string
}
interface Filters { dataInicio: string; dataFim: string; status: string; idCliente: string; idCentroCusto: string }

export default function RelatorioContasReceberModal({ filters, onClose }: { filters: Filters; onClose: () => void }) {
  const [rows, setRows] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const p = new URLSearchParams()
    if (filters.dataInicio) p.set('dataInicio', filters.dataInicio)
    if (filters.dataFim) p.set('dataFim', filters.dataFim)
    if (filters.status) p.set('status', filters.status)
    if (filters.idCliente) p.set('idCliente', filters.idCliente)
    if (filters.idCentroCusto) p.set('idCentroCusto', filters.idCentroCusto)
    api.get(`/financeiro/contas-receber/relatorio?${p}`)
      .then(r => setRows(r.data.data || [])).catch(() => setRows([])).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { grupos, totV, totR, totS } = useMemo(() => {
    const grupos: Record<string, { items: Linha[]; v: number; r: number; s: number }> = {}
    let totV = 0, totR = 0, totS = 0
    for (const r of rows) {
      const k = r.centro_custo
      if (!grupos[k]) grupos[k] = { items: [], v: 0, r: 0, s: 0 }
      grupos[k].items.push(r)
      grupos[k].v += Number(r.valor); grupos[k].r += Number(r.recebido); grupos[k].s += Number(r.saldo)
      totV += Number(r.valor); totR += Number(r.recebido); totS += Number(r.saldo)
    }
    return { grupos, totV, totR, totS }
  }, [rows])

  const periodo = `${fmtDate(filters.dataInicio)} a ${fmtDate(filters.dataFim)}`

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: G.card, borderRadius: 14, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ background: G.navy, color: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Relatório de Contas a Receber · por Centro de Custo</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Período {periodo} · parcelas recebidas em amarelo</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportRelatorioContasReceber(rows, periodo)} disabled={!rows.length}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: G.green, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: rows.length ? 1 : 0.5 }}>
              <FileSpreadsheet size={15} /> Exportar Excel
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: 8 }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: 18, background: G.bg }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando…</div>
          ) : !rows.length ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhuma parcela no período/filtros.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: G.card, borderRadius: 10, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: G.navy, color: '#fff' }}>
                  <th style={cL}>Cliente</th><th style={cL}>Descrição</th><th style={{ ...cL, textAlign: 'center' }}>Parc.</th>
                  <th style={cL}>Vencimento</th><th style={cR}>Valor</th><th style={cR}>Recebido</th><th style={cR}>Saldo</th><th style={{ ...cL, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grupos).map(([centro, g]) => (
                  <Grupo key={centro} centro={centro} g={g} />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F1ECE0', borderTop: `2px solid ${G.navy}`, fontWeight: 800, color: G.text }}>
                  <td colSpan={4} style={{ ...cR, paddingRight: 14 }}>TOTAL GERAL</td>
                  <td style={cR}>{fmtBRL(totV)}</td>
                  <td style={{ ...cR, color: G.green }}>{fmtBRL(totR)}</td>
                  <td style={{ ...cR, color: G.amber }}>{fmtBRL(totS)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function Grupo({ centro, g }: { centro: string; g: { items: Linha[]; v: number; r: number; s: number } }) {
  return (
    <>
      <tr style={{ background: '#D4EDDA' }}>
        <td colSpan={8} style={{ padding: '7px 10px', fontWeight: 800, color: '#155724', fontSize: 12 }}>CENTRO DE CUSTO: {centro}</td>
      </tr>
      {g.items.map(it => {
        const recebida = it.status === 'RECEBIDO'
        return (
          <tr key={it.numero_parcela + '-' + it.conta_descricao + '-' + it.data_vencimento} style={{ borderTop: `1px solid ${G.border}`, background: recebida ? G.yellow : 'transparent' }}>
            <td style={{ ...cL, fontWeight: 500 }}>{it.cliente}</td>
            <td style={{ ...cL, color: G.muted, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.conta_descricao}</td>
            <td style={{ ...cL, textAlign: 'center' }}>{it.numero_parcela}</td>
            <td style={cL}>{fmtDate(it.data_vencimento)}</td>
            <td style={cR}>{fmtBRL(it.valor)}</td>
            <td style={{ ...cR, color: G.green }}>{Number(it.recebido) > 0 ? fmtBRL(it.recebido) : '—'}</td>
            <td style={{ ...cR, color: Number(it.saldo) > 0 ? G.amber : G.muted }}>{Number(it.saldo) > 0 ? fmtBRL(it.saldo) : '—'}</td>
            <td style={{ ...cL, textAlign: 'center', fontWeight: 700, color: recebida ? '#92400E' : G.muted, fontSize: 11 }}>{recebida ? 'RECEBIDO' : 'Aberto'}</td>
          </tr>
        )
      })}
      <tr style={{ background: '#FBF9F4', fontWeight: 700, color: G.text }}>
        <td colSpan={4} style={{ ...cR, paddingRight: 14, fontSize: 11 }}>Subtotal · {centro}</td>
        <td style={cR}>{fmtBRL(g.v)}</td>
        <td style={{ ...cR, color: G.green }}>{fmtBRL(g.r)}</td>
        <td style={{ ...cR, color: G.amber }}>{fmtBRL(g.s)}</td>
        <td />
      </tr>
    </>
  )
}
