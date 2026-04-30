import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
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

interface PlanoItem {
  id: number
  codigo: string
  descricao: string
  tipo: 'R' | 'D'
  nivel: number
  id_pai: number | null
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
  borderRadius: 7, fontSize: 13, color: '#fff', cursor: 'pointer', fontWeight: 600,
})

// ─── Modal Plano ──────────────────────────────────────────────────────────────
function PlanoModal({ initial, items, onClose, onSaved }: {
  initial: Partial<PlanoItem> | null
  items: PlanoItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!initial?.id
  const [form, setForm] = useState({
    codigo:    initial?.codigo    ?? '',
    descricao: initial?.descricao ?? '',
    tipo:      initial?.tipo      ?? 'D',
    nivel:     String(initial?.nivel ?? 1),
    id_pai:    String(initial?.id_pai ?? ''),
    ativo:     initial?.ativo     ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.codigo || !form.descricao) { setError('Código e descrição são obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        nivel:  parseInt(form.nivel),
        id_pai: form.id_pai ? parseInt(form.id_pai) : null,
      }
      if (editing) {
        await api.put(`/financeiro/plano-contas/${initial!.id}`, payload)
      } else {
        await api.post('/financeiro/plano-contas', payload)
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const pais = items.filter(i => i.id !== initial?.id)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>{editing ? 'Editar' : 'Nova'} Conta</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, fontSize: 18 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Código *
              <input value={form.codigo} onChange={e => set('codigo', e.target.value)} style={inputStyle} placeholder="1.1.01" required />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição *
              <input value={form.descricao} onChange={e => set('descricao', e.target.value)} style={inputStyle} required />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Tipo
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inputStyle}>
                <option value="R">Receita</option>
                <option value="D">Despesa</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Nível
              <select value={form.nivel} onChange={e => set('nivel', e.target.value)} style={inputStyle}>
                <option value="1">1 — Grupo</option>
                <option value="2">2 — Subgrupo</option>
                <option value="3">3 — Conta</option>
              </select>
            </label>
          </div>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Conta Pai (opcional)
            <select value={form.id_pai} onChange={e => set('id_pai', e.target.value)} style={inputStyle}>
              <option value="">— Nenhuma —</option>
              {pais.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
            </select>
          </label>

          {editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: G.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
              Conta ativa
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlanoContasPage() {
  const [items, setItems]     = useState<PlanoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterTipo, setFilterTipo] = useState<'' | 'R' | 'D'>('')
  const [modal, setModal]     = useState<{ open: boolean; item: Partial<PlanoItem> | null }>({ open: false, item: null })

  function load() {
    setLoading(true)
    api.get('/financeiro/plano-contas')
      .then(r => r.data.success && setItems(r.data.data))
      .catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: number) {
    if (!confirm('Inativar esta conta?')) return
    await api.delete(`/financeiro/plano-contas/${id}`)
    load()
  }

  const filtered = items.filter(item => {
    const matchSearch = !search
      || item.codigo.toLowerCase().includes(search.toLowerCase())
      || item.descricao.toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filterTipo || item.tipo === filterTipo
    return matchSearch && matchTipo
  })

  const receitas = items.filter(i => i.tipo === 'R').length
  const despesas = items.filter(i => i.tipo === 'D').length

  function nivelPad(item: PlanoItem) {
    return item.nivel > 1 ? '—'.repeat(item.nivel - 1) + ' ' : ''
  }

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={22} color={G.mustard} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: G.text }}>Plano de Contas</h1>
            <p style={{ margin: 0, fontSize: 12, color: G.muted }}>Estrutura hierárquica de receitas e despesas</p>
          </div>
        </div>
        <button onClick={() => setModal({ open: true, item: null })}
          style={{ ...btnPrimary(G.mustard), display: 'flex', alignItems: 'center', gap: 6, color: G.text }}>
          <Plus size={15} /> Nova Conta
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total de Contas', value: items.length, color: G.text },
          { label: 'Receitas',         value: receitas,    color: G.green },
          { label: 'Despesas',         value: despesas,    color: G.red },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código ou descrição..."
          style={{ flex: 1, padding: '7px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none' }} />
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as '' | 'R' | 'D')}
          style={{ padding: '7px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none' }}>
          <option value="">Todos os tipos</option>
          <option value="R">Receitas</option>
          <option value="D">Despesas</option>
        </select>
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
              <tr style={{ background: G.bg }}>
                {['Código', 'Descrição', 'Tipo', 'Nível', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderTop: `1px solid ${G.border}` }}>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: G.muted, fontSize: 12 }}>{item.codigo}</td>
                  <td style={{ padding: '9px 14px', color: G.text, fontWeight: item.nivel === 1 ? 700 : 400 }}>
                    {nivelPad(item)}{item.descricao}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: item.tipo === 'R' ? '#DCFCE7' : '#FEE2E2',
                      color: item.tipo === 'R' ? '#166534' : '#991B1B'
                    }}>
                      {item.tipo === 'R' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: G.muted }}>{item.nivel}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: item.ativo ? '#DCFCE7' : '#F3F4F6',
                      color: item.ativo ? '#166534' : '#6B7280'
                    }}>
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setModal({ open: true, item })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }} title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 4 }} title="Inativar">
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

      {modal.open && (
        <PlanoModal
          initial={modal.item}
          items={items}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load() }}
        />
      )}
    </div>
  )
}
