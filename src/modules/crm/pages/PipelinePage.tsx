import { useEffect, useState, useCallback } from 'react'
import { Kanban, Plus, X, GripVertical, DollarSign, TrendingUp } from 'lucide-react'
import { InfoBanner } from '../components/InfoBanner'
import { api } from '@/shared/lib/api'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const G = {
  bg: '#E8E1D4', card: '#F2EDE4', border: '#D6CCBA',
  text: '#28374A', muted: '#6B7A8A', mustard: '#FFD200',
  green: '#22C55E', red: '#EF4444', amber: '#F59E0B', blue: '#3B82F6',
}

const STAGES = [
  { etapa_id: 1, descricao: 'Prospecção',   color: '#60A5FA' },
  { etapa_id: 2, descricao: 'Qualificação', color: '#818CF8' },
  { etapa_id: 3, descricao: 'Proposta',     color: '#FB923C' },
  { etapa_id: 4, descricao: 'Negociação',   color: '#EAB308' },
  { etapa_id: 5, descricao: 'Fechamento',   color: '#10B981' },
]

function fmtBRL(v: any) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(Number(v) || 0)
}

interface Oportunidade {
  id: number
  cli_codigo: number
  cliente_nome: string
  titulo: string
  descricao: string | null
  etapa_id: number
  valor_estimado: number | null
  probabilidade: number | null
  data_prevista_fechamento: string | null
  ven_codigo: number | null
}

interface Cliente { cli_codigo: number; cli_nome: string }

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13,
  background: '#fff', color: G.text, outline: 'none', boxSizing: 'border-box',
}
const btnPrimary = (bg = G.mustard): React.CSSProperties => ({
  padding: '7px 16px', border: 'none', background: bg,
  borderRadius: 7, fontSize: 13, color: bg === G.mustard ? G.text : '#fff',
  cursor: 'pointer', fontWeight: 600,
})
const btnSecondary: React.CSSProperties = {
  padding: '7px 16px', border: `1px solid ${G.border}`, background: 'transparent',
  borderRadius: 7, fontSize: 13, color: G.text, cursor: 'pointer',
}

// ─── Modal Nova/Editar Oportunidade ───────────────────────────────────────────
function OportunidadeModal({ initial, onClose, onSaved }: {
  initial: Oportunidade | null
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!initial?.id
  const [form, setForm] = useState({
    cli_codigo:               String(initial?.cli_codigo ?? ''),
    titulo:                   initial?.titulo ?? '',
    descricao:                initial?.descricao ?? '',
    etapa_id:                 String(initial?.etapa_id ?? 1),
    valor_estimado:           String(initial?.valor_estimado ?? ''),
    probabilidade:            String(initial?.probabilidade ?? ''),
    data_prevista_fechamento: initial?.data_prevista_fechamento?.slice(0, 10) ?? '',
  })
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.get('/clients?limit=5000').then(r => setClientes(r.data.data ?? [])).catch(() => {})
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.cli_codigo || !form.titulo) {
      setError('Cliente e título são obrigatórios.'); return
    }
    setSaving(true); setError('')
    try {
      const payload = {
        cli_codigo:               parseInt(form.cli_codigo),
        titulo:                   form.titulo,
        descricao:                form.descricao || null,
        etapa_id:                 parseInt(form.etapa_id),
        valor_estimado:           form.valor_estimado ? parseFloat(form.valor_estimado.replace(',', '.')) : null,
        probabilidade:            form.probabilidade ? parseInt(form.probabilidade) : null,
        data_prevista_fechamento: form.data_prevista_fechamento || null,
      }
      if (editing) {
        await api.put(`/crm/oportunidades/${initial!.id}`, payload)
      } else {
        await api.post('/crm/oportunidades', payload)
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>{editing ? 'Editar' : 'Nova'} Oportunidade</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Cliente *
            <select value={form.cli_codigo} onChange={e => set('cli_codigo', e.target.value)} style={inputStyle} required>
              <option value="">— Selecione —</option>
              {clientes.map(c => <option key={c.cli_codigo} value={c.cli_codigo}>{c.cli_nome}</option>)}
            </select>
          </label>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Título *
            <input value={form.titulo} onChange={e => set('titulo', e.target.value)} style={inputStyle} placeholder="Nome da oportunidade" required />
          </label>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Etapa
            <select value={form.etapa_id} onChange={e => set('etapa_id', e.target.value)} style={inputStyle}>
              {STAGES.map(s => <option key={s.etapa_id} value={s.etapa_id}>{s.descricao}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Valor Estimado (R$)
              <input type="number" value={form.valor_estimado} onChange={e => set('valor_estimado', e.target.value)}
                style={inputStyle} placeholder="0,00" min="0" step="0.01" />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Probabilidade (%)
              <input type="number" value={form.probabilidade} onChange={e => set('probabilidade', e.target.value)}
                style={inputStyle} placeholder="0–100" min="0" max="100" />
            </label>
          </div>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Previsão de Fechamento
            <input type="date" value={form.data_prevista_fechamento} onChange={e => set('data_prevista_fechamento', e.target.value)} style={inputStyle} />
          </label>

          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={saving} style={btnPrimary()}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ opp, stageColor, onEdit, onDelete, overlay = false }: {
  opp: Oportunidade
  stageColor: string
  onEdit: (o: Oportunidade) => void
  onDelete: (id: number) => void
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opp.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: G.card,
    border: `1px solid ${G.border}`,
    borderLeft: `3px solid ${stageColor}`,
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    cursor: overlay ? 'grabbing' : 'grab',
    boxShadow: overlay ? '0 4px 16px rgba(0,0,0,.15)' : undefined,
    userSelect: 'none',
  }

  const fechamento = opp.data_prevista_fechamento?.slice(0, 10).split('-').reverse().join('/')

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: G.text, flex: 1, marginRight: 6 }}>{opp.titulo}</div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onEdit(opp) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 2, fontSize: 11 }}
            onPointerDown={e => e.stopPropagation()}>✏</button>
          <button onClick={e => { e.stopPropagation(); onDelete(opp.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 2, fontSize: 11 }}
            onPointerDown={e => e.stopPropagation()}>✕</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: G.muted, marginBottom: 4 }}>{opp.cliente_nome}</div>
      {opp.valor_estimado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: stageColor, fontWeight: 600 }}>
          <DollarSign size={11} /> {fmtBRL(opp.valor_estimado)}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {opp.probabilidade != null && (
          <span style={{ fontSize: 10, color: G.muted }}>prob. {opp.probabilidade}%</span>
        )}
        {fechamento && (
          <span style={{ fontSize: 10, color: G.muted }}>{fechamento}</span>
        )}
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
const COL_PREFIX = 'col-'

function KanbanColumn({ stage, items, onAdd, onEdit, onDelete }: {
  stage: typeof STAGES[0]
  items: Oportunidade[]
  onAdd: () => void
  onEdit: (o: Oportunidade) => void
  onDelete: (id: number) => void
}) {
  const totalValor = items.reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
  const { setNodeRef, isOver } = useDroppable({ id: `${COL_PREFIX}${stage.etapa_id}` })

  return (
    <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column' }}>
      {/* Column header */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderTop: `3px solid ${stage.color}`, borderRadius: '8px 8px 0 0', padding: '10px 12px', marginBottom: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: G.text }}>{stage.descricao}</div>
          <span style={{ fontSize: 11, fontWeight: 700, background: stage.color + '20', color: stage.color, padding: '2px 7px', borderRadius: 12 }}>{items.length}</span>
        </div>
        {totalValor > 0 && <div style={{ fontSize: 11, color: G.muted, marginTop: 3 }}>{fmtBRL(totalValor)}</div>}
      </div>

      {/* Droppable area */}
      <div ref={setNodeRef} style={{
        flex: 1, background: isOver ? stage.color + '12' : G.bg + 'AA',
        border: `1px solid ${isOver ? stage.color : G.border}`,
        borderTop: 'none', borderRadius: '0 0 8px 8px',
        padding: '8px 8px 4px', minHeight: 160, overflowY: 'auto',
        maxHeight: 'calc(100vh - 280px)', transition: 'background 0.15s, border-color 0.15s',
      }}>
        <SortableContext items={items.map(o => o.id)} strategy={verticalListSortingStrategy}>
          {items.map(opp => (
            <KanbanCard key={opp.id} opp={opp} stageColor={stage.color} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
        <button onClick={onAdd} style={{
          width: '100%', padding: '8px', border: `1px dashed ${G.border}`, borderRadius: 6,
          background: 'transparent', cursor: 'pointer', color: G.muted, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4,
        }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [opps,    setOpps]    = useState<Oportunidade[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<{ open: boolean; item: Oportunidade | null; defaultStage?: number }>({ open: false, item: null })
  const [activeId, setActiveId] = useState<number | null>(null)

  const authState = (() => {
    try { return JSON.parse(localStorage.getItem('sm_auth_state') || '{}') } catch { return {} }
  })()
  const venCodigo = authState?.seller?.ven_codigo ?? authState?.ven_codigo

  const load = useCallback(() => {
    setLoading(true)
    const params = venCodigo ? `?ven_codigo=${venCodigo}` : ''
    api.get(`/crm/pipeline${params}`)
      .then(r => r.data.success && setOpps(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [venCodigo])

  useEffect(() => { load() }, [load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeOpp = activeId ? opps.find(o => o.id === activeId) : null
  const activeStage = activeOpp ? STAGES.find(s => s.etapa_id === activeOpp.etapa_id) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const draggedOpp = opps.find(o => o.id === active.id)
    if (!draggedOpp) return

    // over.id is either a card id (number) or 'col-N' (column drop zone)
    let targetStageId: number
    const overId = String(over.id)
    if (overId.startsWith(COL_PREFIX)) {
      targetStageId = parseInt(overId.slice(COL_PREFIX.length))
    } else {
      const overOpp = opps.find(o => o.id === over.id)
      if (!overOpp) return
      targetStageId = overOpp.etapa_id
    }

    if (draggedOpp.etapa_id === targetStageId) return

    // Optimistic update
    setOpps(prev => prev.map(o => o.id === draggedOpp.id ? { ...o, etapa_id: targetStageId } : o))

    try {
      await api.put(`/crm/oportunidades/${draggedOpp.id}/move`, { etapa_id: targetStageId })
    } catch {
      load()
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta oportunidade?')) return
    await api.delete(`/crm/oportunidades/${id}`)
    load()
  }

  const totalValor = opps.reduce((s, o) => s + (o.valor_estimado ?? 0), 0)

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Kanban size={22} color={G.mustard} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: G.text }}>Pipeline Kanban</h1>
            <p style={{ margin: 0, fontSize: 12, color: G.muted }}>
              {opps.length} oportunidades · {fmtBRL(totalValor)} em pipeline
            </p>
          </div>
        </div>
        <button onClick={() => setModal({ open: true, item: null })}
          style={{ ...btnPrimary(), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nova Oportunidade
        </button>
      </div>

      <InfoBanner
        storageKey="crm_pipeline_banner"
        icon={<TrendingUp size={18} style={{ color: '#FFD200' }} />}
        title="Pipeline Kanban — seu funil de vendas visual"
        description="Registre cada oportunidade de venda e acompanhe sua evolução pelas etapas: Prospecção → Qualificação → Proposta → Negociação → Fechamento. Com o pipeline organizado você sabe exatamente onde está cada negócio e onde concentrar sua energia."
        tip="Dica: arraste os cards entre colunas conforme o negócio avança. Quanto mais atualizado, mais precisa é sua previsão de fechamento."
      />

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: G.muted }}>Carregando...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, flex: 1 }}>
            {STAGES.map(stage => {
              const stageOpps = opps.filter(o => o.etapa_id === stage.etapa_id)
              return (
                <KanbanColumn
                  key={stage.etapa_id}
                  stage={stage}
                  items={stageOpps}
                  onAdd={() => setModal({ open: true, item: null, defaultStage: stage.etapa_id })}
                  onEdit={o => setModal({ open: true, item: o })}
                  onDelete={handleDelete}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeOpp && activeStage ? (
              <KanbanCard opp={activeOpp} stageColor={activeStage.color} onEdit={() => {}} onDelete={() => {}} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {modal.open && (
        <OportunidadeModal
          initial={modal.item ?? (modal.defaultStage ? { etapa_id: modal.defaultStage } as any : null)}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { setModal({ open: false, item: null }); load() }}
        />
      )}
    </div>
  )
}
