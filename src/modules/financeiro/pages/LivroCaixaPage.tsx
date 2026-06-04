import { useEffect, useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, X, BookOpen, Wallet, Landmark, Trash2 } from 'lucide-react'
import { api } from '@/shared/lib/api'
import { apenasAnaliticas } from '../utils/planoContas'

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
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', border: `1px solid ${G.border}`, borderRadius: 8, fontSize: 13, color: G.text, background: '#fff', marginTop: 4, boxSizing: 'border-box' }
const btnPrimary = (c: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: c, color: c === G.mustard ? G.text : '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const btnSecondary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: G.text, border: `1px solid ${G.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }
const lblHero: React.CSSProperties = { fontSize: 11, color: '#B9C4D0', display: 'block', marginBottom: 2 }
const inputHero: React.CSSProperties = { ...inputStyle, width: 148, marginTop: 0 }
const btnHeroGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.28)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const lblStyle: React.CSSProperties = { fontSize: 12, color: G.muted, fontWeight: 500, display: 'flex', flexDirection: 'column' }

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
  const contaSel = contas.find(c => c.id === contaId) || null

  function reload() { loadContas(); loadConfig(); loadLancamentos() }

  return (
    <div style={{ background: G.bg, minHeight: '100%', paddingBottom: 40 }}>
      {/* HERO */}
      <div style={{ background: G.navy, color: '#fff', padding: '20px 28px 46px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} color={G.mustard} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Livro Caixa</h1>
              <div style={{ fontSize: 12, color: '#B9C4D0', marginTop: 2 }}>Conta corrente · selecione uma conta abaixo</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={lblHero}>De</label>
              <input type="date" value={de} onChange={e => setDe(e.target.value)} style={inputHero} />
            </div>
            <div>
              <label style={lblHero}>Até</label>
              <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={inputHero} />
            </div>
            <button onClick={() => setGerirContas(true)} style={btnHeroGhost}><Wallet size={14} />Contas</button>
            <button onClick={() => setTransf(true)} style={btnHeroGhost} disabled={contas.length < 2}><ArrowLeftRight size={14} />Transferência</button>
            <button onClick={() => setNovo(true)} style={btnPrimary(G.mustard)} disabled={contas.length === 0}><Plus size={14} />Novo lançamento</button>
          </div>
        </div>
      </div>

      {/* PÍLULAS DE CONTA — selecionar = filtrar (a ativa fica destacada). Flutua sobre o hero. */}
      <div style={{ padding: '0 28px', marginTop: -30 }}>
        {contas.length === 0 ? (
          <div style={{ background: G.card, border: `1px dashed ${G.border}`, borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', boxShadow: '0 6px 18px rgba(0,0,0,.06)' }}>
            <span style={{ color: G.muted, fontSize: 14 }}>Nenhuma conta de caixa cadastrada ainda. Cadastre o caixa, bancos e PIX para começar.</span>
            <button onClick={() => setGerirContas(true)} style={btnPrimary(G.mustard)}><Plus size={14} />Cadastrar conta</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {contas.map(c => {
              const active = c.id === contaId
              return (
                <button key={c.id} onClick={() => setContaId(c.id)} style={{
                  cursor: 'pointer', textAlign: 'left', minWidth: 178,
                  background: active ? '#FFFDF3' : G.card,
                  border: active ? `2px solid ${G.mustard}` : `1px solid ${G.border}`,
                  borderRadius: 12, padding: '12px 16px',
                  boxShadow: active ? '0 10px 24px rgba(0,0,0,.12)' : '0 5px 16px rgba(0,0,0,.05)',
                  transition: 'all .15s', outline: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: G.muted, marginBottom: 3 }}>
                    {c.conta_tipo === 'banco' ? <Landmark size={13} /> : <Wallet size={13} />}
                    <span style={{ fontWeight: 600, color: active ? G.text : G.muted }}>{c.conta_nome}</span>
                    {active && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: .5, color: '#B8860B' }}>● ATIVA</span>}
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: c.saldo_atual < 0 ? G.red : G.text }}>{fmtBRL(c.saldo_atual)}</div>
                </button>
              )
            })}
            <div style={{ minWidth: 160, background: G.navy, color: '#fff', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 12, color: '#B9C4D0' }}>Total Geral</div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{fmtBRL(totalGeral)}</div>
            </div>
          </div>
        )}
      </div>

      {/* HISTÓRIA DO PERÍODO — conta corrente da conta selecionada */}
      {contaSel && (
        <div style={{ padding: '18px 28px 0' }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '16px 22px', boxShadow: '0 4px 14px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 13, color: G.muted, marginBottom: 14 }}>
              <strong style={{ color: G.text, fontSize: 15 }}>{contaSel.conta_nome}</strong>
              <span style={{ marginLeft: 8 }}>· período {fmtDate(de)} a {fmtDate(ate)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <FlowItem label="Saldo anterior" value={fmtBRL(saldoAnterior)} color={saldoAnterior < 0 ? G.red : G.text} />
              <Op>+</Op>
              <FlowItem label="Entradas" value={fmtBRL(entradas)} color={G.green} />
              <Op>−</Op>
              <FlowItem label="Saídas" value={fmtBRL(saidas)} color={G.red} />
              <Op>=</Op>
              <FlowItem label="Saldo final" value={fmtBRL(saldoFinal)} color={saldoFinal < 0 ? G.red : G.text} big />
            </div>
          </div>
        </div>
      )}

      {/* Teto de imposto (só quando ligado) */}
      {teto > 0 && (
        <div style={{ padding: '12px 28px 0' }}>
          <div style={{ background: accImposto > teto ? '#FEF2F2' : '#FEF9C3', border: `1px solid ${accImposto > teto ? G.red : '#FCD34D'}`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#92400E', fontWeight: 700 }}>Pagamentos COM IMPOSTO no mês</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: accImposto > teto ? G.red : '#92400E' }}>{fmtBRL(accImposto)} <span style={{ fontSize: 12, fontWeight: 500 }}>de {fmtBRL(teto)}</span></div>
            <div style={{ flex: 1, minWidth: 120, height: 7, background: 'rgba(0,0,0,.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, teto ? (accImposto / teto) * 100 : 0)}%`, background: accImposto > teto ? G.red : G.mustard }} />
            </div>
            {accImposto > teto && <span style={{ fontSize: 12, color: G.red, fontWeight: 700 }}>⚠️ Teto ultrapassado</span>}
          </div>
        </div>
      )}

      {/* EXTRATO (conta corrente) */}
      {contaSel && (
        <div style={{ padding: '18px 28px' }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAF7F0', color: G.muted, textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', width: 54 }}>Seq</th>
                  <th style={{ padding: '10px 12px', width: 110 }}>Data</th>
                  <th style={{ padding: '10px 12px' }}>Histórico</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Débito</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Crédito</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo</th>
                  <th style={{ padding: '10px 12px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#F3EEE3' }}>
                  <td colSpan={5} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: G.muted }}>Saldo anterior (antes de {fmtDate(de)})</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: saldoAnterior < 0 ? G.red : G.text }}>{fmtBRL(saldoAnterior)}</td>
                  <td />
                </tr>
                {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: G.muted }}>Carregando…</td></tr>}
                {!loading && lancamentos.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: G.muted }}>Sem lançamentos neste período.</td></tr>}
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
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: G.red, whiteSpace: 'nowrap' }}>{l.tipo === 'D' ? fmtBRL(l.valor) : ''}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: G.green, whiteSpace: 'nowrap' }}>{l.tipo === 'C' ? fmtBRL(l.valor) : ''}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: l.saldo < 0 ? G.red : G.text, whiteSpace: 'nowrap' }}>{fmtBRL(l.saldo)}</td>
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
      )}

      {novo && <NovoLancamentoModal contas={contas} contaInicial={contaId} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); reload() }} />}
      {transf && <TransferenciaModal contas={contas} onClose={() => setTransf(false)} onSaved={() => { setTransf(false); reload() }} />}
      {gerirContas && <ContasModal onClose={() => setGerirContas(false)} onChanged={reload} />}
    </div>
  )
}

// ── História do período: item + operador ────────────────────────────────────
function FlowItem({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: G.muted, textTransform: 'uppercase', letterSpacing: .4, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: big ? 24 : 18, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
  return big
    ? <div style={{ background: '#FFFDF3', border: `1.5px solid ${G.mustard}`, borderRadius: 10, padding: '8px 16px' }}>{inner}</div>
    : <div style={{ padding: '6px 10px' }}>{inner}</div>
}
function Op({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 22, color: G.muted, fontWeight: 300, padding: '0 2px' }}>{children}</span>
}
function TipoChip({ tipo }: { tipo: string }) {
  const map: Record<string, { bg: string; c: string; l: string }> = {
    caixa: { bg: '#FEF3C7', c: '#92400E', l: 'Caixa' }, banco: { bg: '#DBEAFE', c: '#1E40AF', l: 'Banco' },
    pix: { bg: '#D1FAE5', c: '#065F46', l: 'PIX' }, outro: { bg: '#F3F4F6', c: '#374151', l: 'Outro' },
  }
  const s = map[tipo] ?? map.outro
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: s.bg, color: s.c, marginLeft: 6, verticalAlign: 'middle' }}>{s.l}</span>
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
        {error && <div style={errBox}>{error}</div>}
        {/* tipo: toggle entrada/saída — mais claro que um select */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => set('tipo', 'C')} style={toggleStyle(form.tipo === 'C', G.green)}>↑ Crédito (entrada)</button>
          <button type="button" onClick={() => set('tipo', 'D')} style={toggleStyle(form.tipo === 'D', G.red)}>↓ Débito (saída)</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Conta
            <select value={form.conta_id} onChange={e => set('conta_id', e.target.value)} style={inputStyle}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Data<input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputStyle} /></label>
        </div>
        <label style={lblStyle}>Valor<input value={maskBRLFromDigits(form.valor)} onChange={e => set('valor', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" /></label>
        <label style={lblStyle}>Histórico<input value={form.historico} onChange={e => set('historico', e.target.value)} style={inputStyle} placeholder="Descrição do lançamento" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Plano de Contas
            <select value={form.id_plano_contas} onChange={e => set('id_plano_contas', e.target.value)} style={inputStyle}>
              <option value="">—</option>{apenasAnaliticas(planos).map((p: any) => <option key={p.id} value={p.id}>{p.codigo} {p.descricao}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Centro de Custo
            <select value={form.id_centro_custo} onChange={e => set('id_centro_custo', e.target.value)} style={inputStyle}>
              <option value="">—</option>{centros.map(c => <option key={c.id} value={c.id}>{c.codigo} {c.descricao}</option>)}
            </select>
          </label>
        </div>
        <label style={lblStyle}>Documento<input value={form.documento} onChange={e => set('documento', e.target.value)} style={inputStyle} placeholder="NF, cheque…" /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
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
        {error && <div style={errBox}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end' }}>
          <label style={lblStyle}>De
            <select value={form.conta_origem} onChange={e => set('conta_origem', e.target.value)} style={inputStyle}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
          <ArrowLeftRight size={18} color={G.muted} style={{ marginBottom: 10 }} />
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
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={saving} style={btnPrimary(G.navy)}>{saving ? 'Salvando…' : 'Transferir'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Modal: Gerir contas ─────────────────────────────────────────────────────
function ContasModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [contas, setContas] = useState<ContaCaixa[]>([])
  const [form, setForm] = useState<any>({ conta_nome: '', conta_tipo: 'caixa', saldo_inicial: '', data_saldo_inicial: todayISO() })
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  async function load() { const r = await api.get('/livro-caixa/contas'); setContas(r.data.data) }
  useEffect(() => { load() }, [])
  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.conta_nome.trim()) { setError('Informe o nome da conta.'); return }
    setSaving(true); setError('')
    try {
      await api.post('/livro-caixa/contas', { ...form, conta_nome: form.conta_nome.trim(), saldo_inicial: digitsToReais(form.saldo_inicial) })
      setForm({ conta_nome: '', conta_tipo: 'caixa', saldo_inicial: '', data_saldo_inicial: todayISO() })
      load(); onChanged()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }
  async function del(id: number) { if (confirm('Excluir/inativar esta conta?')) { await api.delete(`/livro-caixa/contas/${id}`); load(); onChanged() } }
  return (
    <ModalShell title="Contas de caixa" onClose={onClose} wide>
      {error && <div style={errBox}>{error}</div>}
      {/* form de nova conta */}
      <form onSubmit={add} style={{ background: '#FAF7F0', border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: .4 }}>Nova conta</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .9fr 1fr 1fr', gap: 12 }}>
          <label style={lblStyle}>Nome<input value={form.conta_nome} onChange={e => set('conta_nome', e.target.value)} style={inputStyle} placeholder="Ex: Banco do Brasil" /></label>
          <label style={lblStyle}>Tipo
            <select value={form.conta_tipo} onChange={e => set('conta_tipo', e.target.value)} style={inputStyle}>
              <option value="caixa">Caixa</option><option value="banco">Banco</option><option value="pix">PIX</option><option value="outro">Outro</option>
            </select>
          </label>
          <label style={lblStyle}>Saldo inicial<input value={maskBRLFromDigits(form.saldo_inicial)} onChange={e => set('saldo_inicial', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" /></label>
          <label style={lblStyle}>Data do saldo<input type="date" value={form.data_saldo_inicial} onChange={e => set('data_saldo_inicial', e.target.value)} style={inputStyle} /></label>
        </div>
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button type="submit" disabled={saving} style={btnPrimary(G.mustard)}><Plus size={14} />{saving ? 'Salvando…' : 'Adicionar conta'}</button>
        </div>
      </form>
      {/* lista de contas */}
      <div style={{ fontSize: 12, fontWeight: 700, color: G.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .4 }}>Contas cadastradas ({contas.length})</div>
      <div style={{ maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contas.length === 0 && <div style={{ color: G.muted, fontSize: 13, padding: '8px 0' }}>Nenhuma conta cadastrada ainda.</div>}
        {contas.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${G.border}`, borderRadius: 10, background: '#fff' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#F3EEE3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.navy, flexShrink: 0 }}>
              {c.conta_tipo === 'banco' ? <Landmark size={17} /> : <Wallet size={17} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{c.conta_nome}<TipoChip tipo={c.conta_tipo} /></div>
              <div style={{ fontSize: 12, color: G.muted }}>Saldo inicial {fmtBRL(c.saldo_inicial)} · desde {fmtDate(c.data_saldo_inicial)}</div>
            </div>
            <div style={{ textAlign: 'right', marginRight: 4 }}>
              <div style={{ fontSize: 11, color: G.muted }}>Saldo atual</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.saldo_atual < 0 ? G.red : G.text }}>{fmtBRL(c.saldo_atual)}</div>
            </div>
            <button onClick={() => del(c.id)} title="Excluir / inativar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, flexShrink: 0 }}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </ModalShell>
  )
}

// ── Shared primitives ───────────────────────────────────────────────────────
const errBox: React.CSSProperties = { background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 4 }
function toggleStyle(active: boolean, color: string): React.CSSProperties {
  return {
    flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: active ? `1.5px solid ${color}` : `1px solid ${G.border}`,
    background: active ? `${color}14` : '#fff', color: active ? color : G.muted,
  }
}
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: 24, width: wide ? 620 : 460, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
