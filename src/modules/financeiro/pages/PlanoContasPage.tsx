import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, HelpCircle, X, TrendingUp, TrendingDown, GitBranch } from 'lucide-react'
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
  borderRadius: 7, fontSize: 13, color: bg === G.mustard ? G.text : '#fff',
  cursor: 'pointer', fontWeight: 600,
})

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
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>{editing ? 'Editar' : 'Nova'} Conta</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
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

export default function PlanoContasPage() {
  const [items, setItems]     = useState<PlanoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterTipo, setFilterTipo] = useState<'' | 'R' | 'D'>('')
  const [modal, setModal]     = useState<{ open: boolean; item: Partial<PlanoItem> | null }>({ open: false, item: null })
  const [helpOpen, setHelpOpen] = useState(false)

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
            <BookOpen size={22} color={G.mustard} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>Plano de Contas</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Estrutura hierárquica de receitas e despesas</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setHelpOpen(true)}
              style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.7)' }}
              title="Ajuda">
              <HelpCircle size={17} />
            </button>
            <button onClick={() => setModal({ open: true, item: null })}
              style={{ ...btnPrimary(G.mustard), display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nova Conta
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ padding: '0 28px', marginTop: -28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'Total de Contas', value: items.length, color: G.navy },
            { label: 'Contas de Receita', value: receitas,   color: G.green },
            { label: 'Contas de Despesa', value: despesas,   color: G.red },
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

      {/* Content */}
      <div style={{ padding: '20px 28px 28px' }}>

        {/* Filters */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
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
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhuma conta encontrada.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['Código', 'Descrição', 'Tipo', 'Nível', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${G.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9F7F4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: G.muted, fontSize: 12 }}>{item.codigo}</td>
                    <td style={{ padding: '9px 14px', color: G.text, fontWeight: item.nivel === 1 ? 700 : 400 }}>
                      {nivelPad(item)}{item.descricao}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: item.tipo === 'R' ? '#D1FAE5' : '#FEE2E2',
                        color: item.tipo === 'R' ? '#065F46' : '#991B1B',
                      }}>
                        {item.tipo === 'R' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: G.muted }}>{item.nivel}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: item.ativo ? '#D1FAE5' : '#F3F4F6',
                        color: item.ativo ? '#065F46' : '#6B7280',
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
      </div>

      {modal.open && (
        <PlanoModal
          initial={modal.item}
          items={items}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load() }}
        />
      )}

      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(40,55,74,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: G.card, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: G.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>Como usar o Plano de Contas</h2>
                  <p style={{ margin: 0, fontSize: 11, color: G.muted }}>Guia rápido da funcionalidade</p>
                </div>
              </div>
              <button onClick={() => setHelpOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: G.muted, padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: TrendingUp, color: G.green, title: 'Contas de Receita (R)', desc: 'Agrupe todas as entradas financeiras: comissões, serviços, aluguéis. Use o código hierárquico (ex: 1.1, 1.2) para organizar em grupos e subgrupos.' },
                { icon: TrendingDown, color: G.red, title: 'Contas de Despesa (D)', desc: 'Classifique seus gastos por natureza: aluguel, folha, fornecedores, impostos. Cada conta vinculada em Contas a Pagar aparece no DRE.' },
                { icon: GitBranch, color: '#7C3AED', title: 'Hierarquia de contas', desc: 'Crie contas pai e filho. As contas filho herdam o tipo da conta pai. O DRE agrupa automaticamente os totais por nível hierárquico.' },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10, background: G.bg, border: `1px solid ${G.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color={color} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: G.text }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: G.muted, lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
