import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Factory, X } from 'lucide-react'
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

interface FinFornecedor {
  id: number
  tipo_pessoa: 'F' | 'J'
  cpf_cnpj: string
  nome_razao: string
  nome_fantasia: string
  cidade: string
  uf: string
  telefone: string
  celular: string
  email: string
  ativo: boolean
}

interface FinFornecedorForm {
  tipo_pessoa: 'F' | 'J'
  cpf_cnpj: string
  nome_razao: string
  nome_fantasia: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  telefone: string
  celular: string
  email: string
  observacoes: string
  ativo: boolean
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13,
  background: '#fff', color: G.text, outline: 'none', boxSizing: 'border-box',
}
const btnSecondary: React.CSSProperties = {
  padding: '7px 16px', border: `1px solid ${G.border}`, background: 'transparent',
  borderRadius: 7, fontSize: 13, color: G.text, cursor: 'pointer',
}
const btnPrimary = (bg: string): React.CSSProperties => ({
  padding: '7px 16px', border: 'none', background: bg,
  borderRadius: 7, fontSize: 13, color: bg === G.mustard ? G.text : '#fff',
  cursor: 'pointer', fontWeight: 600,
})

function FinFornecedorModal({ initial, onClose, onSaved }: {
  initial: FinFornecedor | null
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!initial?.id
  const blank: FinFornecedorForm = {
    tipo_pessoa: 'J', cpf_cnpj: '', nome_razao: '', nome_fantasia: '',
    endereco: '', numero: '', complemento: '', bairro: '',
    cidade: '', uf: '', cep: '', telefone: '', celular: '',
    email: '', observacoes: '', ativo: true,
  }
  const [form, setForm] = useState<FinFornecedorForm>(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (initial?.id) {
      api.get(`/financeiro/fin-fornecedores/${initial.id}`)
        .then(r => r.data.success && setForm({ ...blank, ...r.data.data }))
        .catch(() => {})
    }
  }, [initial?.id])

  const set = (k: keyof FinFornecedorForm, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome_razao.trim()) { setError('Nome/Razão Social é obrigatório.'); return }
    setSaving(true); setError('')
    try {
      if (editing) {
        await api.put(`/financeiro/fin-fornecedores/${initial!.id}`, form)
      } else {
        await api.post('/financeiro/fin-fornecedores', form)
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>{editing ? 'Editar' : 'Novo'} Fornecedor Financeiro</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Tipo de Pessoa
              <select value={form.tipo_pessoa} onChange={e => set('tipo_pessoa', e.target.value as 'F' | 'J')} style={inputStyle}>
                <option value="J">Jurídica</option>
                <option value="F">Física</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>{form.tipo_pessoa === 'J' ? 'CNPJ' : 'CPF'}
              <input value={form.cpf_cnpj} onChange={e => set('cpf_cnpj', e.target.value)} style={inputStyle} placeholder={form.tipo_pessoa === 'J' ? '00.000.000/0000-00' : '000.000.000-00'} />
            </label>
          </div>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Razão Social / Nome *
            <input value={form.nome_razao} onChange={e => set('nome_razao', e.target.value)} style={inputStyle} required />
          </label>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Nome Fantasia
            <input value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} style={inputStyle} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Endereço
              <input value={form.endereco} onChange={e => set('endereco', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Número
              <input value={form.numero} onChange={e => set('numero', e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Complemento
              <input value={form.complemento} onChange={e => set('complemento', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Bairro
              <input value={form.bairro} onChange={e => set('bairro', e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 110px', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Cidade
              <input value={form.cidade} onChange={e => set('cidade', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>UF
              <input value={form.uf} onChange={e => set('uf', e.target.value)} style={inputStyle} maxLength={2} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>CEP
              <input value={form.cep} onChange={e => set('cep', e.target.value)} style={inputStyle} placeholder="00000-000" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Telefone
              <input value={form.telefone} onChange={e => set('telefone', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Celular
              <input value={form.celular} onChange={e => set('celular', e.target.value)} style={inputStyle} />
            </label>
          </div>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>E-mail
            <input value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} type="email" />
          </label>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Observações
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} style={{ ...inputStyle, height: 72, resize: 'vertical' }} />
          </label>

          {editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: G.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
              Fornecedor ativo
            </label>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={saving} style={btnPrimary(G.mustard)}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FinFornecedoresPage() {
  const [items, setItems]     = useState<FinFornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState<{ open: boolean; item: FinFornecedor | null }>({ open: false, item: null })

  function load() {
    setLoading(true)
    api.get(`/financeiro/fin-fornecedores?search=${encodeURIComponent(search)}`)
      .then(r => r.data.success && setItems(r.data.data))
      .catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  async function handleDelete(id: number) {
    if (!confirm('Inativar este fornecedor financeiro?')) return
    await api.delete(`/financeiro/fin-fornecedores/${id}`)
    load()
  }

  const ativos   = items.filter(i => i.ativo).length
  const inativos = items.filter(i => !i.ativo).length

  return (
    <div style={{ background: G.bg, minHeight: '100%' }}>

      {/* Hero */}
      <div style={{
        background: G.navy, backgroundImage: GRID_BG,
        padding: '28px 28px 52px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', background: `radial-gradient(circle, ${G.mustard}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Factory size={22} color={G.mustard} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>Fornecedores Financeiros</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Fornecedores vinculados a contas a pagar</p>
            </div>
          </div>
          <button onClick={() => setModal({ open: true, item: null })}
            style={{ ...btnPrimary(G.mustard), display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Novo Fornecedor
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ padding: '0 28px', marginTop: -28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'Total de Fornecedores', value: items.length, color: G.navy },
            { label: 'Ativos',                value: ativos,       color: G.green },
            { label: 'Inativos',              value: inativos,     color: G.muted },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: G.card, borderRadius: 10, padding: '14px 18px',
              borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.08)',
            }}>
              <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 28px 28px' }}>

        {/* Search */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou CPF/CNPJ..."
            style={{ width: '100%', padding: '7px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Table */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhum fornecedor encontrado.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['Tipo', 'CPF / CNPJ', 'Razão Social', 'Fantasia', 'Cidade / UF', 'Telefone', 'E-mail', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${G.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9F7F4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                        background: item.tipo_pessoa === 'J' ? '#DBEAFE' : '#EDE9FE',
                        color: item.tipo_pessoa === 'J' ? '#1E40AF' : '#6D28D9' }}>
                        {item.tipo_pessoa === 'J' ? 'PJ' : 'PF'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: G.muted }}>{item.cpf_cnpj || '—'}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: G.text }}>{item.nome_razao}</td>
                    <td style={{ padding: '9px 14px', color: G.muted }}>{item.nome_fantasia || '—'}</td>
                    <td style={{ padding: '9px 14px', color: G.muted, fontSize: 12 }}>{item.cidade}{item.uf ? ` / ${item.uf}` : ''}</td>
                    <td style={{ padding: '9px 14px', color: G.muted, fontSize: 12 }}>{item.telefone || item.celular || '—'}</td>
                    <td style={{ padding: '9px 14px', color: G.muted, fontSize: 12 }}>{item.email || '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: item.ativo ? '#D1FAE5' : '#F3F4F6',
                        color: item.ativo ? '#065F46' : '#6B7280' }}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setModal({ open: true, item })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }} title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 4 }} title="Inativar">
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
      </div>

      {modal.open && (
        <FinFornecedorModal
          initial={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load() }}
        />
      )}
    </div>
  )
}
