import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, X, ChevronDown, ChevronUp, Check, Trash2, Eye } from 'lucide-react'
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
  amber:   '#F59E0B',
}

function fmtBRL(v: any) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}
function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}
function todayISO() { return new Date().toISOString().split('T')[0] }
function firstOfMonth() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

type Status = 'ABERTO' | 'RECEBIDO' | 'VENCIDO' | 'CANCELADO'

interface Parcela {
  id: number
  numero_parcela: number
  valor: number
  data_vencimento: string
  data_recebimento: string | null
  valor_recebido: number | null
  juros: number
  desconto: number
  status: Status
}

interface Conta {
  id: number
  descricao: string
  numero_documento: string
  valor_total: number
  valor_recebido: number
  saldo: number
  data_emissao: string
  data_vencimento: string
  status: Status
  cliente_nome: string
  plano_contas_descricao: string
  centro_custo_descricao: string
  parcelas?: Parcela[]
}

interface FinCliente { id: number; nome_razao: string }
interface PlanoContas { id: number; codigo: string; descricao: string; tipo: string }

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; bg: string; color: string }> = {
    ABERTO:    { label: 'Aberto',    bg: '#E0F2FE', color: '#0369A1' },
    RECEBIDO:  { label: 'Recebido',  bg: '#DCFCE7', color: '#166534' },
    VENCIDO:   { label: 'Vencido',   bg: '#FEE2E2', color: '#991B1B' },
    CANCELADO: { label: 'Cancelado', bg: '#F3F4F6', color: '#6B7280' },
  }
  const s = map[status] ?? map.ABERTO
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ─── Modal Nova Conta ──────────────────────────────────────────────────────────
function NovaContaModal({ onClose, onSaved, clientes, planoContas }: {
  onClose: () => void
  onSaved: () => void
  clientes: FinCliente[]
  planoContas: PlanoContas[]
}) {
  const [form, setForm] = useState({
    descricao: '', id_cliente: '', numero_documento: '',
    valor_total: '', data_emissao: todayISO(), data_vencimento: todayISO(),
    observacoes: '', id_plano_contas: '', id_centro_custo: '',
    numero_parcelas: '1', intervalo_dias: '30',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descricao || !form.valor_total || !form.data_vencimento) { setError('Preencha os campos obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      await api.post('/financeiro/contas-receber', {
        ...form,
        valor_total: parseFloat(form.valor_total.replace(',', '.')),
        numero_parcelas: parseInt(form.numero_parcelas),
        intervalo_dias: parseInt(form.intervalo_dias),
        id_cliente:     form.id_cliente || null,
        id_plano_contas: form.id_plano_contas || null,
        id_centro_custo: form.id_centro_custo || null,
      })
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>Nova Conta a Receber</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição *
            <input value={form.descricao} onChange={e => set('descricao', e.target.value)}
              style={inputStyle} placeholder="Ex: Comissão de Venda #1234" required />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Valor Total *
              <input value={form.valor_total} onChange={e => set('valor_total', e.target.value)}
                style={inputStyle} placeholder="0,00" inputMode="decimal" required />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>N° Documento
              <input value={form.numero_documento} onChange={e => set('numero_documento', e.target.value)}
                style={inputStyle} placeholder="Opcional" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Emissão
              <input type="date" value={form.data_emissao} onChange={e => set('data_emissao', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Vencimento *
              <input type="date" value={form.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} style={inputStyle} required />
            </label>
          </div>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Cliente
            <select value={form.id_cliente} onChange={e => set('id_cliente', e.target.value)} style={inputStyle}>
              <option value="">— Selecionar —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao}</option>)}
            </select>
          </label>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Plano de Contas
            <select value={form.id_plano_contas} onChange={e => set('id_plano_contas', e.target.value)} style={inputStyle}>
              <option value="">— Selecionar —</option>
              {planoContas.filter(p => p.tipo === 'R').map(p => (
                <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>N° Parcelas
              <input type="number" value={form.numero_parcelas} onChange={e => set('numero_parcelas', e.target.value)}
                style={inputStyle} min="1" max="60" />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Intervalo (dias)
              <input type="number" value={form.intervalo_dias} onChange={e => set('intervalo_dias', e.target.value)}
                style={inputStyle} min="1" />
            </label>
          </div>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Observações
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              style={{ ...inputStyle, height: 70, resize: 'vertical' }} placeholder="Opcional" />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={saving} style={btnPrimary(G.green)}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Baixa Parcela ───────────────────────────────────────────────────────
function BaixaModal({ conta, parcela, onClose, onSaved }: {
  conta: Conta; parcela: Parcela; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    data_recebimento: todayISO(),
    valor_recebido: String(parcela.valor),
    juros: '0', desconto: '0',
    observacoes: '', gerar_residuo: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const vPago = parseFloat(form.valor_recebido || '0')
  const residual = parcela.valor - vPago - parseFloat(form.desconto || '0')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/financeiro/contas-receber/${conta.id}/baixa`, {
        id_parcela: parcela.id,
        data_recebimento: form.data_recebimento,
        valor_recebido: vPago,
        juros: parseFloat(form.juros || '0'),
        desconto: parseFloat(form.desconto || '0'),
        observacoes: form.observacoes,
        gerar_residuo: form.gerar_residuo,
      })
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao registrar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Registrar Recebimento</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginBottom: 16 }}>
          Parcela {parcela.numero_parcela} — {fmtBRL(parcela.valor)} — venc. {fmtDate(parcela.data_vencimento)}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data Recebimento
            <input type="date" value={form.data_recebimento} onChange={e => set('data_recebimento', e.target.value)} style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Valor Recebido
              <input value={form.valor_recebido} onChange={e => set('valor_recebido', e.target.value)} style={inputStyle} inputMode="decimal" />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Juros
              <input value={form.juros} onChange={e => set('juros', e.target.value)} style={inputStyle} inputMode="decimal" />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Desconto
              <input value={form.desconto} onChange={e => set('desconto', e.target.value)} style={inputStyle} inputMode="decimal" />
            </label>
          </div>
          {residual > 0.01 && (
            <div style={{ background: '#FEF9C3', border: '1px solid #FCD34D', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
              Saldo residual: {fmtBRL(residual)}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input type="checkbox" checked={form.gerar_residuo} onChange={e => set('gerar_residuo', e.target.checked)} />
                Gerar parcela para o saldo residual
              </label>
            </div>
          )}
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Observações
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              style={{ ...inputStyle, height: 60, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={saving} style={btnPrimary(G.green)}>{saving ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Detalhes ────────────────────────────────────────────────────────────
function DetalhesModal({ contaId, onClose, onBaixa }: {
  contaId: number; onClose: () => void; onBaixa: (conta: Conta, parcela: Parcela) => void
}) {
  const [conta, setConta] = useState<Conta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/financeiro/contas-receber/${contaId}`)
      .then(r => r.data.success && setConta(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contaId])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Detalhes da Conta a Receber</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: G.muted, padding: 40 }}>Carregando...</div>
        ) : conta ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: G.text, marginBottom: 20 }}>
              <div><span style={{ color: G.muted }}>Descrição: </span>{conta.descricao}</div>
              <div><span style={{ color: G.muted }}>Cliente: </span>{conta.cliente_nome || '—'}</div>
              <div><span style={{ color: G.muted }}>Valor Total: </span>{fmtBRL(conta.valor_total)}</div>
              <div><span style={{ color: G.muted }}>Valor Recebido: </span>{fmtBRL(conta.valor_recebido)}</div>
              <div><span style={{ color: G.muted }}>Vencimento: </span>{fmtDate(conta.data_vencimento)}</div>
              <div><span style={{ color: G.muted }}>Status: </span><StatusBadge status={conta.status} /></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginBottom: 10 }}>Parcelas</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['#', 'Vencimento', 'Valor', 'Recebido', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: G.muted, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conta.parcelas?.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                    <td style={{ padding: '8px 10px', color: G.muted }}>{p.numero_parcela}</td>
                    <td style={{ padding: '8px 10px', color: G.text }}>{fmtDate(p.data_vencimento)}</td>
                    <td style={{ padding: '8px 10px', color: G.text }}>{fmtBRL(p.valor)}</td>
                    <td style={{ padding: '8px 10px', color: G.text }}>{p.valor_recebido != null ? fmtBRL(p.valor_recebido) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '8px 10px' }}>
                      {(p.status === 'ABERTO' || p.status === 'VENCIDO') && (
                        <button onClick={() => { onClose(); onBaixa(conta, p) }} style={{ ...btnPrimary(G.green), padding: '4px 10px', fontSize: 11 }}>
                          Baixar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <div style={{ color: G.red, textAlign: 'center' }}>Conta não encontrada.</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnSecondary}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13,
  background: '#fff', color: G.text, outline: 'none', boxSizing: 'border-box',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', border: `1px solid ${G.border}`, background: 'transparent',
  borderRadius: 7, fontSize: 13, color: G.text, cursor: 'pointer',
}
const btnPrimary = (bg: string): React.CSSProperties => ({
  padding: '8px 18px', border: 'none', background: bg,
  borderRadius: 7, fontSize: 13, color: '#fff', cursor: 'pointer', fontWeight: 600,
})

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ContasReceberPage() {
  const [contas, setContas]           = useState<Conta[]>([])
  const [loading, setLoading]         = useState(true)
  const [clientes, setClientes]       = useState<FinCliente[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([])

  const [filters, setFilters] = useState({
    dataInicio: firstOfMonth(), dataFim: todayISO(), status: '', idCliente: '',
  })
  const [search, setSearch]       = useState('')
  const [showNova, setShowNova]   = useState(false)
  const [detalhesId, setDetalhesId] = useState<number | null>(null)
  const [baixaData, setBaixaData]   = useState<{ conta: Conta; parcela: Parcela } | null>(null)

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio)
    if (filters.dataFim)    params.set('dataFim', filters.dataFim)
    if (filters.status)     params.set('status', filters.status)
    if (filters.idCliente)  params.set('idCliente', filters.idCliente)
    api.get(`/financeiro/contas-receber?${params}`)
      .then(r => r.data.success && setContas(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/financeiro/fin-clientes').then(r => r.data.success && setClientes(r.data.data)).catch(() => {})
    api.get('/financeiro/plano-contas').then(r => r.data.success && setPlanoContas(r.data.data)).catch(() => {})
  }, [])

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta conta e todas as parcelas?')) return
    await api.delete(`/financeiro/contas-receber/${id}`)
    load()
  }

  const filtered = contas.filter(c =>
    !search || c.descricao?.toLowerCase().includes(search.toLowerCase()) || c.cliente_nome?.toLowerCase().includes(search.toLowerCase())
  )

  const totais = filtered.reduce((acc, c) => ({
    total:    acc.total    + Number(c.valor_total),
    recebido: acc.recebido + Number(c.valor_recebido),
    saldo:    acc.saldo    + Number(c.saldo),
  }), { total: 0, recebido: 0, saldo: 0 })

  const isVencida = (c: Conta) => c.status === 'ABERTO' && new Date(c.data_vencimento) < new Date(todayISO())

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: G.text }}>Contas a Receber</h1>
        <button onClick={() => setShowNova(true)} style={{ ...btnPrimary(G.green), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nova Conta
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total a Receber', value: totais.total,    color: G.text },
          { label: 'Já Recebido',     value: totais.recebido, color: G.green },
          { label: 'Saldo Pendente',  value: totais.saldo,    color: G.red },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{fmtBRL(value)}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, color: G.muted }}>De
          <input type="date" value={filters.dataInicio} onChange={e => setFilter('dataInicio', e.target.value)} style={{ ...inputStyle, width: 140 }} />
        </label>
        <label style={{ fontSize: 12, color: G.muted }}>Até
          <input type="date" value={filters.dataFim} onChange={e => setFilter('dataFim', e.target.value)} style={{ ...inputStyle, width: 140 }} />
        </label>
        <label style={{ fontSize: 12, color: G.muted }}>Status
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="">Todos</option>
            <option value="ABERTO">Aberto</option>
            <option value="RECEBIDO">Recebido</option>
            <option value="VENCIDO">Vencido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: G.muted }}>Cliente
          <select value={filters.idCliente} onChange={e => setFilter('idCliente', e.target.value)} style={{ ...inputStyle, width: 180 }}>
            <option value="">Todos</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao}</option>)}
          </select>
        </label>
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft: 30, width: 180, marginTop: 0 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhuma conta encontrada.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: G.bg, borderBottom: `1px solid ${G.border}` }}>
                {['Descrição', 'Cliente', 'Vencimento', 'Valor Total', 'Recebido', 'Saldo', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: G.muted, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${G.border}`, background: isVencida(c) ? '#FFF8F8' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', color: G.text, fontWeight: 500 }}>{c.descricao}</td>
                  <td style={{ padding: '10px 12px', color: G.muted }}>{c.cliente_nome || '—'}</td>
                  <td style={{ padding: '10px 12px', color: isVencida(c) ? G.red : G.text }}>{fmtDate(c.data_vencimento)}</td>
                  <td style={{ padding: '10px 12px', color: G.text }}>{fmtBRL(c.valor_total)}</td>
                  <td style={{ padding: '10px 12px', color: G.green }}>{fmtBRL(c.valor_recebido)}</td>
                  <td style={{ padding: '10px 12px', color: Number(c.saldo) > 0 ? G.amber : G.muted, fontWeight: 600 }}>{fmtBRL(c.saldo)}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button title="Ver detalhes" onClick={() => setDetalhesId(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }}>
                        <Eye size={15} />
                      </button>
                      {(c.status === 'ABERTO' || isVencida(c)) && (
                        <button title="Registrar recebimento" onClick={async () => {
                          const r = await api.get(`/financeiro/contas-receber/${c.id}`)
                          if (r.data.success) {
                            const parcela = r.data.data.parcelas?.find((p: Parcela) => p.status === 'ABERTO' || p.status === 'VENCIDO')
                            if (parcela) setBaixaData({ conta: r.data.data, parcela })
                          }
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.green, padding: 4 }}>
                          <Check size={15} />
                        </button>
                      )}
                      <button title="Excluir" onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showNova && (
        <NovaContaModal
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); load() }}
          clientes={clientes}
          planoContas={planoContas}
        />
      )}
      {detalhesId !== null && (
        <DetalhesModal
          contaId={detalhesId}
          onClose={() => setDetalhesId(null)}
          onBaixa={(conta, parcela) => setBaixaData({ conta, parcela })}
        />
      )}
      {baixaData && (
        <BaixaModal
          conta={baixaData.conta}
          parcela={baixaData.parcela}
          onClose={() => setBaixaData(null)}
          onSaved={() => { setBaixaData(null); load() }}
        />
      )}
    </div>
  )
}
