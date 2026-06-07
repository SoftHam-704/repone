import { useEffect, useMemo, useState } from 'react'
import { X, FileSpreadsheet, Printer } from 'lucide-react'
import { api } from '@/shared/lib/api'
import { exportRelatorioContasPagar } from '../utils/exportRelatorioContasPagar'
import { imprimirRelatorioFinanceiro, type LinhaRel, type Empresa } from './RelatorioFinanceiroPdf'

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
const inp: React.CSSProperties = { marginTop: 3, padding: '6px 8px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 12, background: '#fff', color: G.text }
const lbl: React.CSSProperties = { fontSize: 11, color: G.muted, display: 'flex', flexDirection: 'column' }

interface Linha {
  centro_custo: string; fornecedor: string; conta_descricao: string; numero_documento: string | null
  numero_parcela: number; data_vencimento: string; valor: number; pago: number; saldo: number; status: string
}
interface Filters { dataInicio: string; dataFim: string; status: string; idFornecedor: string; idCentroCusto: string }

export default function RelatorioContasPagarModal({ filters, fornecedores = [], centrosCusto = [], onClose }: {
  filters: Filters
  fornecedores?: { id: number; nome_razao: string }[]
  centrosCusto?: { id: number; descricao: string; codigo?: string; ativo?: boolean }[]
  onClose: () => void
}) {
  const [f, setF] = useState<Filters>({ ...filters })
  const [agruparPor, setAgruparPor] = useState<'centro' | 'entidade'>('centro')
  const [rows, setRows] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const setFil = (k: keyof Filters, v: string) => setF(s => ({ ...s, [k]: v }))

  const carregar = () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (f.dataInicio) p.set('dataInicio', f.dataInicio)
    if (f.dataFim) p.set('dataFim', f.dataFim)
    if (f.status) p.set('status', f.status)
    if (f.idFornecedor) p.set('idFornecedor', f.idFornecedor)
    if (f.idCentroCusto) p.set('idCentroCusto', f.idCentroCusto)
    api.get(`/financeiro/contas-pagar/relatorio?${p}`)
      .then(r => setRows(r.data.data || [])).catch(() => setRows([])).finally(() => setLoading(false))
  }

  useEffect(() => {
    carregar()
    api.get('/empresa').then(r => setEmpresa(r.data?.data || null)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { grupos, totV, totP, totS } = useMemo(() => {
    const grupos: Record<string, { items: Linha[]; v: number; p: number; s: number }> = {}
    let totV = 0, totP = 0, totS = 0
    for (const r of rows) {
      const k = (agruparPor === 'centro' ? r.centro_custo : r.fornecedor) || '(Sem)'
      if (!grupos[k]) grupos[k] = { items: [], v: 0, p: 0, s: 0 }
      grupos[k].items.push(r)
      grupos[k].v += Number(r.valor); grupos[k].p += Number(r.pago); grupos[k].s += Number(r.saldo)
      totV += Number(r.valor); totP += Number(r.pago); totS += Number(r.saldo)
    }
    return { grupos, totV, totP, totS }
  }, [rows, agruparPor])

  const periodo = `${fmtDate(f.dataInicio)} a ${fmtDate(f.dataFim)}`
  const fornNome = f.idFornecedor ? (fornecedores.find(x => String(x.id) === f.idFornecedor)?.nome_razao || '—') : 'Todos'
  const centroNome = f.idCentroCusto ? (centrosCusto.find(x => String(x.id) === f.idCentroCusto)?.descricao || '—') : 'Todos'
  const statusNome = f.status === 'ABERTO' ? 'Em aberto' : f.status === 'PAGO' ? 'Pagas' : 'Todas'

  const imprimir = () => {
    const linhas: LinhaRel[] = rows.map(r => ({
      centro_custo: r.centro_custo, entidade: r.fornecedor, conta_descricao: r.conta_descricao,
      numero_documento: r.numero_documento, numero_parcela: r.numero_parcela, data_vencimento: r.data_vencimento,
      valor: Number(r.valor), pago: Number(r.pago), saldo: Number(r.saldo), status: r.status, paga: r.status === 'PAGO',
    }))
    imprimirRelatorioFinanceiro({
      titulo: 'Relatório de Contas a Pagar', entidadeLabel: 'Fornecedor', valorPagoLabel: 'Pago',
      statusPagoLabel: 'PAGO', accent: 'pagar', empresa, periodo,
      filtros: [`Fornecedor: ${fornNome}`, `Centro de custo: ${centroNome}`, `Status: ${statusNome}`],
      agruparPor, rows: linhas, emitidoEm: new Date().toLocaleString('pt-BR'),
    })
  }

  const centrosAtivos = centrosCusto.filter(c => c.ativo !== false)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: G.card, borderRadius: 14, width: '100%', maxWidth: 1000, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ background: G.navy, color: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Relatório de Contas a Pagar</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Período {periodo} · parcelas pagas em amarelo</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={imprimir} disabled={!rows.length}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: G.navy, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: rows.length ? 1 : 0.5 }}>
              <Printer size={15} /> Imprimir / PDF
            </button>
            <button onClick={() => exportRelatorioContasPagar(rows, periodo, agruparPor)} disabled={!rows.length}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: G.green, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: rows.length ? 1 : 0.5 }}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: 8 }}><X size={18} /></button>
          </div>
        </div>

        {/* filtros */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', background: '#FBF9F4' }}>
          <label style={lbl}>De<input type="date" value={f.dataInicio} onChange={e => setFil('dataInicio', e.target.value)} style={{ ...inp, width: 130 }} /></label>
          <label style={lbl}>Até<input type="date" value={f.dataFim} onChange={e => setFil('dataFim', e.target.value)} style={{ ...inp, width: 130 }} /></label>
          <label style={lbl}>Fornecedor
            <select value={f.idFornecedor} onChange={e => setFil('idFornecedor', e.target.value)} style={{ ...inp, width: 190 }}>
              <option value="">Todos</option>
              {fornecedores.map(x => <option key={x.id} value={x.id}>{x.nome_razao}</option>)}
            </select>
          </label>
          <label style={lbl}>Centro de Custo
            <select value={f.idCentroCusto} onChange={e => setFil('idCentroCusto', e.target.value)} style={{ ...inp, width: 190 }}>
              <option value="">Todos</option>
              {centrosAtivos.map(c => <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} · ` : ''}{c.descricao}</option>)}
            </select>
          </label>
          <label style={lbl}>Status
            <select value={f.status} onChange={e => setFil('status', e.target.value)} style={{ ...inp, width: 120 }}>
              <option value="">Todas</option>
              <option value="ABERTO">Em aberto</option>
              <option value="PAGO">Pagas</option>
            </select>
          </label>
          <label style={lbl}>Agrupar por
            <select value={agruparPor} onChange={e => setAgruparPor(e.target.value as any)} style={{ ...inp, width: 150 }}>
              <option value="centro">Centro de Custo</option>
              <option value="entidade">Fornecedor</option>
            </select>
          </label>
          <button onClick={carregar} style={{ padding: '7px 16px', background: G.navy, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Aplicar</button>
        </div>

        {/* body */}
        <div style={{ overflowY: 'auto', padding: 18, background: G.bg }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando…</div>
          ) : !rows.length ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhuma parcela no período/filtros.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: G.card, borderRadius: 10, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: G.navy, color: '#fff' }}>
                  <th style={cL}>{agruparPor === 'centro' ? 'Fornecedor' : 'Centro de Custo'}</th><th style={cL}>Descrição</th><th style={{ ...cL, textAlign: 'center' }}>Parc.</th>
                  <th style={cL}>Vencimento</th><th style={cR}>Valor</th><th style={cR}>Pago</th><th style={cR}>Saldo</th><th style={{ ...cL, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grupos).map(([nome, g]) => (
                  <Grupo key={nome} nome={nome} g={g} agruparPor={agruparPor} />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F1ECE0', borderTop: `2px solid ${G.navy}`, fontWeight: 800, color: G.text }}>
                  <td colSpan={4} style={{ ...cR, paddingRight: 14 }}>TOTAL GERAL</td>
                  <td style={cR}>{fmtBRL(totV)}</td>
                  <td style={{ ...cR, color: G.green }}>{fmtBRL(totP)}</td>
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

function Grupo({ nome, g, agruparPor }: { nome: string; g: { items: Linha[]; v: number; p: number; s: number }; agruparPor: 'centro' | 'entidade' }) {
  const rotulo = agruparPor === 'centro' ? 'CENTRO DE CUSTO' : 'FORNECEDOR'
  return (
    <>
      <tr style={{ background: '#D4EDDA' }}>
        <td colSpan={8} style={{ padding: '7px 10px', fontWeight: 800, color: '#155724', fontSize: 12 }}>{rotulo}: {nome}</td>
      </tr>
      {g.items.map((it, idx) => {
        const paid = it.status === 'PAGO'
        const outra = agruparPor === 'centro' ? it.fornecedor : it.centro_custo
        return (
          <tr key={idx} style={{ borderTop: `1px solid ${G.border}`, background: paid ? G.yellow : 'transparent' }}>
            <td style={{ ...cL, fontWeight: 500 }}>{outra}</td>
            <td style={{ ...cL, color: G.muted, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.conta_descricao}</td>
            <td style={{ ...cL, textAlign: 'center' }}>{it.numero_parcela}</td>
            <td style={cL}>{fmtDate(it.data_vencimento)}</td>
            <td style={cR}>{fmtBRL(it.valor)}</td>
            <td style={{ ...cR, color: G.green }}>{Number(it.pago) > 0 ? fmtBRL(it.pago) : '—'}</td>
            <td style={{ ...cR, color: Number(it.saldo) > 0 ? G.amber : G.muted }}>{Number(it.saldo) > 0 ? fmtBRL(it.saldo) : '—'}</td>
            <td style={{ ...cL, textAlign: 'center', fontWeight: 700, color: paid ? '#92400E' : G.muted, fontSize: 11 }}>{paid ? 'PAGO' : 'Aberto'}</td>
          </tr>
        )
      })}
      <tr style={{ background: '#FBF9F4', fontWeight: 700, color: G.text }}>
        <td colSpan={4} style={{ ...cR, paddingRight: 14, fontSize: 11 }}>Subtotal · {nome}</td>
        <td style={cR}>{fmtBRL(g.v)}</td>
        <td style={{ ...cR, color: G.green }}>{fmtBRL(g.p)}</td>
        <td style={{ ...cR, color: G.amber }}>{fmtBRL(g.s)}</td>
        <td />
      </tr>
    </>
  )
}
