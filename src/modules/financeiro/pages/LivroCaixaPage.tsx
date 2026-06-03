import { useEffect, useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, X, BookOpen, Wallet, Trash2 } from 'lucide-react'
import { api } from '@/shared/lib/api'
import SearchCombobox from '@/shared/components/ui/SearchCombobox'

// ── tokens (espelha PlanoContasPage.tsx — Areia+Navy) ───────────────────────
const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8', text: '#28374A',
  muted: '#7A8899', navy: '#1E2D3D', mustard: '#FFD200', green: '#059669', red: '#DC2626',
}
const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
// Máscara BRL: estado guarda dígitos (centavos); display formatado; digita da direita p/ esquerda.
function maskBRLFromDigits(digits: string): string {
  const cents = (digits || '').replace(/\D/g, '')
  if (!cents) return ''
  return (parseInt(cents, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const digitsToReais = (digits: string): number => {
  const cents = (digits || '').replace(/\D/g, '')
  return cents ? parseInt(cents, 10) / 100 : 0
}
function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}
const todayISO = () => new Date().toISOString().split('T')[0]
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, color: G.text, background: '#fff', marginTop: 4 }
const btnPrimary = (c: string): React.CSSProperties => ({ background: c, color: c === G.mustard ? G.text : '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const btnSecondary: React.CSSProperties = { background: '#fff', color: G.text, border: `1px solid ${G.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }

interface ContaCaixa { id: number; conta_nome: string; conta_tipo: string; saldo_inicial: number; data_saldo_inicial: string; saldo_atual: number }
interface Lancamento { id: number; data: string; historico: string; tipo: 'C' | 'D'; valor: number; documento: string | null; origem: string; plano_descricao: string | null; centro_descricao: string | null; saldo: number }

export default function LivroCaixaPage() {
  const hoje = new Date()
  const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const hojeISO = hoje.toISOString().split('T')[0]
  const [contas, setContas] = useState<ContaCaixa[]>([])
  const [contaId, setContaId] = useState<number | null>(null)
  const [de, setDe] = useState(primeiroDia)
  const [ate, setAte] = useState(hojeISO)
  const [saldoAnterior, setSaldoAnterior] = useState(0)
  const [saldoFinal, setSaldoFinal] = useState(0)
  const [entradas, setEntradas] = useState(0)
  const [saidas, setSaidas] = useState(0)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(false)
  const [teto, setTeto] = useState(0)
  const [accImposto, setAccImposto] = useState(0)
  const [novo, setNovo] = useState(false)
  const [transf, setTransf] = useState(false)
  const [gerirContas, setGerirContas] = useState(false)

  async function loadContas() {
    const r = await api.get('/livro-caixa/contas')
    const cs: ContaCaixa[] = r.data.data
    setContas(cs)
    if (contaId == null && cs.length) setContaId(cs[0].id)
  }
  async function loadConfig() {
    try {
      const r = await api.get('/livro-caixa/config')
      setTeto(Number(r.data.data.teto_com_imposto_mensal) || 0)
      setAccImposto(Number(r.data.data.acumulado_mes) || 0)
    } catch { /* config opcional */ }
  }
  async function loadLancamentos() {
    if (contaId == null) { setLancamentos([]); setSaldoAnterior(0); setSaldoFinal(0); setEntradas(0); setSaidas(0); return }
    setLoading(true)
    try {
      const r = await api.get('/livro-caixa/lancamentos', { params: { conta_id: contaId, de, ate } })
      const d = r.data.data
      setSaldoAnterior(d.saldo_anterior); setSaldoFinal(d.saldo_final)
      setEntradas(d.total_entradas); setSaidas(d.total_saidas)
      setLancamentos(d.lancamentos)
    } finally { setLoading(false) }
  }
  useEffect(() => { loadContas(); loadConfig() }, [])         // eslint-disable-line
  useEffect(() => { loadLancamentos() }, [contaId, de, ate]) // eslint-disable-line

  const totalGeral = useMemo(() => contas.reduce((s, c) => s + c.saldo_atual, 0), [contas])

  function reload() { loadContas(); loadConfig(); loadLancamentos() }

  return (
    <div style={{ background: G.bg, minHeight: '100%', paddingBottom: 40 }}>
      {/* HERO */}
      <div style={{ background: G.navy, color: '#fff', padding: '24px 28px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <BookOpen size={22} color={G.mustard} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Livro Caixa</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 240 }}>
            <label style={{ fontSize: 11, color: '#B9C4D0', display: 'block', marginBottom: 4 }}>Conta</label>
            {/* SearchCombobox espera { id, nome } — adaptado do padrão real do componente */}
            <SearchCombobox
              value={contaId ? String(contaId) : ''}
              onChange={(v: string) => setContaId(v ? Number(v) : null)}
              options={contas.map(c => ({ id: String(c.id), nome: `${c.conta_nome} — ${fmtBRL(c.saldo_atual)}` }))}
              placeholder="Selecione a conta"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#B9C4D0', display: 'block' }}>De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#B9C4D0', display: 'block' }}>Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setGerirContas(true)} style={btnSecondary}><Wallet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Contas</button>
          <button onClick={() => setTransf(true)} style={btnSecondary}><ArrowLeftRight size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Transferência</button>
          <button onClick={() => setNovo(true)} style={btnPrimary(G.mustard)}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Novo lançamento</button>
        </div>
      </div>

      {/* KPI strip — resultado do período + card do teto de imposto */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '0 28px', marginTop: -36 }}>
        <KpiCard label="Entradas no período" value={fmtBRL(entradas)} color={G.green} />
        <KpiCard label="Saídas no período" value={fmtBRL(saidas)} color={G.red} />
        <KpiCard label="Resultado do período" value={fmtBRL(entradas - saidas)} color={(entradas - saidas) < 0 ? G.red : G.text} />
        <KpiCard label="Saldo final" value={fmtBRL(saldoFinal)} color={saldoFinal < 0 ? G.red : G.text} strong />
        {teto > 0 && (
          <div style={{ background: accImposto > teto ? '#FEF2F2' : '#FEF9C3', border: `1px solid ${accImposto > teto ? G.red : '#FCD34D'}`, borderRadius: 10, padding: 16, minWidth: 230, boxShadow: '0 6px 18px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>Imposto no mês (teto)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: accImposto > teto ? G.red : '#92400E' }}>{fmtBRL(accImposto)} <span style={{ fontSize: 12, fontWeight: 500 }}>de {fmtBRL(teto)}</span></div>
            <div style={{ height: 6, background: 'rgba(0,0,0,.08)', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, teto ? (accImposto / teto) * 100 : 0)}%`, background: accImposto > teto ? G.red : G.mustard }} />
            </div>
            {accImposto > teto && <div style={{ fontSize: 11, color: G.red, marginTop: 4, fontWeight: 600 }}>⚠️ Teto ultrapassado</div>}
          </div>
        )}
      </div>

      {/* Saldo por conta */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '14px 28px 0' }}>
        {contas.map(c => (
          <div key={c.id} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 16px', minWidth: 160 }}>
            <div style={{ fontSize: 12, color: G.muted }}>{c.conta_nome}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.saldo_atual < 0 ? G.red : G.text }}>{fmtBRL(c.saldo_atual)}</div>
          </div>
        ))}
        <div style={{ background: G.text, color: '#fff', borderRadius: 10, padding: '12px 16px', minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#B9C4D0' }}>Total Geral</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtBRL(totalGeral)}</div>
        </div>
      </div>

      {/* SALDO ANTERIOR + tabela */}
      <div style={{ padding: '20px 28px' }}>
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F3EEE3', borderBottom: `1px solid ${G.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: G.muted }}>SALDO ANTERIOR (antes de {de.split('-').reverse().join('/')})</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: saldoAnterior < 0 ? G.red : G.text }}>{fmtBRL(saldoAnterior)}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAF7F0', color: G.muted, textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Seq</th>
                <th style={{ padding: '8px 12px' }}>Data</th>
                <th style={{ padding: '8px 12px' }}>Histórico</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Débito</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Crédito</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saldo</th>
                <th style={{ padding: '8px 12px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Carregando…</td></tr>}
              {!loading && lancamentos.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Sem lançamentos neste período.</td></tr>}
              {!loading && lancamentos.map(l => {
                const isBaixa = l.origem === 'CP' || l.origem === 'CR'
                return (
                  <tr key={l.id} style={{ borderTop: `1px solid ${G.border}`, background: isBaixa ? '#FBFAF6' : '#fff' }}>
                    <td style={{ padding: '8px 12px', color: G.muted, fontVariantNumeric: 'tabular-nums' }}>{l.id}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(l.data)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {l.historico}
                      {isBaixa && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: G.muted, border: `1px solid ${G.border}`, borderRadius: 4, padding: '1px 4px' }}>{l.origem}</span>}
                      {(l.plano_descricao || l.centro_descricao) && <span style={{ marginLeft: 6, fontSize: 11, color: G.muted }}>· {[l.plano_descricao, l.centro_descricao].filter(Boolean).join(' / ')}</span>}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: G.red }}>{l.tipo === 'D' ? fmtBRL(l.valor) : ''}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: G.green }}>{l.tipo === 'C' ? fmtBRL(l.valor) : ''}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: l.saldo < 0 ? G.red : G.text }}>{fmtBRL(l.saldo)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {!isBaixa && (
                        <button title="Excluir" onClick={async () => { if (confirm('Excluir este lançamento?')) { await api.delete(`/livro-caixa/lancamentos/${l.id}`); reload() } }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {novo && <NovoLancamentoModal contas={contas} contaInicial={contaId} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); reload() }} />}
      {transf && <TransferenciaModal contas={contas} onClose={() => setTransf(false)} onSaved={() => { setTransf(false); reload() }} />}
      {gerirContas && <ContasModal onClose={() => setGerirContas(false)} onChanged={reload} />}
    </div>
  )
}

// ── Modal: Novo lançamento manual ───────────────────────────────────────────
function NovoLancamentoModal({ contas, contaInicial, onClose, onSaved }: {
  contas: ContaCaixa[]; contaInicial: number | null; onClose: () => void; onSaved: () => void
}) {
  const [planos, setPlanos] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [form, setForm] = useState<any>({ conta_id: contaInicial ?? (contas[0]?.id ?? ''), data: todayISO(), tipo: 'D', valor: '', historico: '', id_plano_contas: '', id_centro_custo: '', documento: '' })
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  useEffect(() => {
    api.get('/financeiro/plano-contas').then(r => setPlanos(r.data.data)).catch(() => {})
    api.get('/financeiro/centro-custo').then(r => setCentros(r.data.data)).catch(() => {})
  }, [])
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/livro-caixa/lancamentos', {
        conta_id: Number(form.conta_id), data: form.data, tipo: form.tipo,
        valor: digitsToReais(form.valor), historico: form.historico,
        id_plano_contas: form.id_plano_contas || null, id_centro_custo: form.id_centro_custo || null,
        documento: form.documento || null,
      })
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }
  return (
    <ModalShell title="Novo lançamento" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
        <label style={lblStyle}>Conta
          <select value={form.conta_id} onChange={e => set('conta_id', e.target.value)} style={inputStyle}>
            {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Data<input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputStyle} /></label>
          <label style={lblStyle}>Tipo
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inputStyle}>
              <option value="D">Débito (saída)</option><option value="C">Crédito (entrada)</option>
            </select>
          </label>
        </div>
        <label style={lblStyle}>Valor<input value={form.valor} onChange={e => set('valor', e.target.value)} style={inputStyle} inputMode="decimal" placeholder="0,00" /></label>
        <label style={lblStyle}>Histórico<input value={form.historico} onChange={e => set('historico', e.target.value)} style={inputStyle} placeholder="Descrição do lançamento" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Plano de Contas
            <select value={form.id_plano_contas} onChange={e => set('id_plano_contas', e.target.value)} style={inputStyle}>
              <option value="">—</option>{planos.map(p => <option key={p.id} value={p.id}>{p.codigo} {p.descricao}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Centro de Custo
            <select value={form.id_centro_custo} onChange={e => set('id_centro_custo', e.target.value)} style={inputStyle}>
              <option value="">—</option>{centros.map(c => <option key={c.id} value={c.id}>{c.codigo} {c.descricao}</option>)}
            </select>
          </label>
        </div>
        <label style={lblStyle}>Documento<input value={form.documento} onChange={e => set('documento', e.target.value)} style={inputStyle} placeholder="NF, cheque…" /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={saving} style={btnPrimary(G.mustard)}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Modal: Transferência ────────────────────────────────────────────────────
function TransferenciaModal({ contas, onClose, onSaved }: { contas: ContaCaixa[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ conta_origem: contas[0]?.id ?? '', conta_destino: contas[1]?.id ?? '', valor: '', data: todayISO(), historico: '' })
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/livro-caixa/transferencia', {
        conta_origem: Number(form.conta_origem), conta_destino: Number(form.conta_destino),
        valor: digitsToReais(form.valor), data: form.data, historico: form.historico,
      })
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }
  return (
    <ModalShell title="Transferência entre contas" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>De
            <select value={form.conta_origem} onChange={e => set('conta_origem', e.target.value)} style={inputStyle}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Para
            <select value={form.conta_destino} onChange={e => set('conta_destino', e.target.value)} style={inputStyle}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Valor<input value={maskBRLFromDigits(form.valor)} onChange={e => set('valor', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" /></label>
          <label style={lblStyle}>Data<input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputStyle} /></label>
        </div>
        <label style={lblStyle}>Histórico<input value={form.historico} onChange={e => set('historico', e.target.value)} style={inputStyle} placeholder="Opcional" /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={saving} style={btnPrimary(G.text)}>{saving ? 'Salvando…' : 'Transferir'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Modal: Gerir contas ─────────────────────────────────────────────────────
function ContasModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [contas, setContas] = useState<ContaCaixa[]>([])
  const [form, setForm] = useState<any>({ conta_nome: '', conta_tipo: 'caixa', saldo_inicial: '', data_saldo_inicial: todayISO() })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  async function load() { const r = await api.get('/livro-caixa/contas'); setContas(r.data.data) }
  useEffect(() => { load() }, [])
  async function add(e: React.FormEvent) {
    e.preventDefault()
    await api.post('/livro-caixa/contas', { ...form, saldo_inicial: digitsToReais(form.saldo_inicial) })
    setForm({ conta_nome: '', conta_tipo: 'caixa', saldo_inicial: '', data_saldo_inicial: todayISO() })
    load(); onChanged()
  }
  async function del(id: number) { if (confirm('Excluir/inativar esta conta?')) { await api.delete(`/livro-caixa/contas/${id}`); load(); onChanged() } }
  return (
    <ModalShell title="Contas de caixa" onClose={onClose}>
      <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 14 }}>
        <label style={lblStyle}>Nome<input value={form.conta_nome} onChange={e => set('conta_nome', e.target.value)} style={inputStyle} required /></label>
        <label style={lblStyle}>Tipo
          <select value={form.conta_tipo} onChange={e => set('conta_tipo', e.target.value)} style={inputStyle}>
            <option value="caixa">Caixa</option><option value="banco">Banco</option><option value="pix">PIX</option><option value="outro">Outro</option>
          </select>
        </label>
        <label style={lblStyle}>Saldo inicial<input value={maskBRLFromDigits(form.saldo_inicial)} onChange={e => set('saldo_inicial', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" /></label>
        <button type="submit" style={btnPrimary(G.mustard)}>+ Add</button>
      </form>
      <div style={{ maxHeight: 240, overflow: 'auto' }}>
        {contas.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderTop: `1px solid ${G.border}` }}>
            <span>{c.conta_nome} <span style={{ color: G.muted, fontSize: 12 }}>· {c.conta_tipo} · inicial {fmtBRL(c.saldo_inicial)}</span></span>
            <button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </ModalShell>
  )
}

// ── Shared primitives ───────────────────────────────────────────────────────
const lblStyle: React.CSSProperties = { fontSize: 12, color: G.muted, fontWeight: 500 }

function KpiCard({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <div style={{ background: G.card, border: `1px solid ${G.border}`, borderTop: strong ? `3px solid ${G.mustard}` : `1px solid ${G.border}`, borderRadius: 10, padding: 16, minWidth: 170, boxShadow: '0 6px 18px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 12, color: G.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, width: 480, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
