import { useEffect, useState, useCallback } from 'react'
import {
  Activity, Plus, Search, CheckCircle, Clock, AlertTriangle,
  X, Building2, Check, Pencil, Trash2, Calendar, ChevronDown, ChevronUp,
  ListChecks, ClipboardCheck,
} from 'lucide-react'
import { InfoBanner } from '../components/InfoBanner'
import { api } from '@/shared/lib/api'
import SearchCombobox from '@/shared/components/ui/SearchCombobox'

const G = {
  bg: '#E8E1D4', card: '#F2EDE4', border: '#D6CCBA',
  text: '#28374A', muted: '#6B7A8A', mustard: '#FFD200',
  green: '#22C55E', red: '#EF4444', amber: '#F59E0B', blue: '#3B82F6',
}

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

interface Followup {
  id: number
  cli_codigo: number
  cli_nomred: string
  data_prevista: string
  hora_prevista: string | null
  titulo: string
  descricao: string | null
  prioridade: string
  status: string
  dias_atraso: number
}

interface Interacao {
  interacao_id: number
  cli_codigo: number
  cli_nomred: string
  tipo_interacao_id: number
  tipo: string
  canal_id: number | null
  canal: string
  resultado_id: number | null
  resultado: string | null
  data_interacao: string
  descricao: string | null
  industrias: number[] | null
}

interface Lookup { id: number; descricao: string }
interface Cliente { cli_codigo: number; cli_nome: string; cli_nomred?: string; cli_cnpj?: string }
interface Industria { for_codigo: number; for_nomered: string; for_nome?: string }

type Tab = 'pendentes' | 'historico'

const PRIORIDADE_COLORS: Record<string, { bg: string; color: string }> = {
  alta:  { bg: '#FEE2E2', color: '#991B1B' },
  media: { bg: '#FEF3C7', color: '#92400E' },
  baixa: { bg: '#EFF6FF', color: '#1D4ED8' },
}

// ─── Modal Nova Atividade ──────────────────────────────────────────────────────
function AtividadeModal({ venCodigo, onClose, onSaved }: {
  venCodigo: number | null
  onClose: () => void
  onSaved: () => void
}) {
  type Modo = 'agendar' | 'registrar'
  const [modo, setModo] = useState<Modo>('agendar')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tipos, setTipos] = useState<Lookup[]>([])
  const [canais, setCanais] = useState<Lookup[]>([])
  const [resultados, setResultados] = useState<Lookup[]>([])
  const [industrias, setIndustrias] = useState<Industria[]>([])
  const [industriasSel, setIndustriasSel] = useState<Set<number>>(new Set())

  // Campos agendar
  const [ag, setAg] = useState({
    cli_codigo: '', titulo: '', descricao: '',
    data_prevista: new Date().toISOString().slice(0, 10),
    hora_prevista: '', prioridade: 'media',
  })

  // Campos registrar
  const [re, setRe] = useState({
    cli_codigo: '', tipo_id: '', canal_id: '', resultado_id: '',
    data_interacao: new Date().toISOString().slice(0, 10),
    descricao: '',
  })

  useEffect(() => {
    Promise.all([
      api.get('/clients?limit=500'),
      api.get('/crm/tipos'),
      api.get('/crm/canais'),
      api.get('/crm/resultados'),
      api.get('/suppliers'),
    ]).then(([cl, t, c, r, ind]) => {
      setClientes(cl.data.data ?? [])
      setTipos(t.data.data ?? [])
      setCanais(c.data.data ?? [])
      setResultados(r.data.data ?? [])
      setIndustrias(ind.data.data ?? ind.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleInd = (cod: number) => {
    setIndustriasSel(prev => {
      const next = new Set(prev)
      if (next.has(cod)) next.delete(cod); else next.add(cod)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (modo === 'agendar') {
        if (!ag.cli_codigo || !ag.titulo) { setError('Cliente e assunto são obrigatórios.'); setSaving(false); return }
        await api.post('/crm/followups', {
          cli_codigo: parseInt(ag.cli_codigo),
          ven_codigo: venCodigo ?? 1,
          titulo: ag.titulo,
          descricao: ag.descricao || null,
          data_prevista: ag.data_prevista,
          hora_prevista: ag.hora_prevista || null,
          prioridade: ag.prioridade,
        })
      } else {
        if (!re.cli_codigo || !re.tipo_id || !re.canal_id) { setError('Cliente, tipo e canal são obrigatórios.'); setSaving(false); return }
        await api.post('/crm/interacoes', {
          cli_codigo: parseInt(re.cli_codigo),
          ven_codigo: venCodigo ?? 1,
          tipo_interacao_id: parseInt(re.tipo_id),
          canal_id: parseInt(re.canal_id),
          resultado_id: re.resultado_id ? parseInt(re.resultado_id) : null,
          data_interacao: re.data_interacao,
          descricao: re.descricao || null,
          industrias: Array.from(industriasSel),
        })
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: 28, width: 580, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>Nova Atividade</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>

        {/* Seletor de modo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {([
            { key: 'agendar',   label: 'Agendar compromisso',       icon: Calendar },
            { key: 'registrar', label: 'Registrar atendimento',      icon: ClipboardCheck },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setModo(key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              border: modo === key ? `2px solid ${G.mustard}` : `1px solid ${G.border}`,
              borderRadius: 10, cursor: 'pointer',
              background: modo === key ? G.mustard + '20' : '#fff',
              color: modo === key ? G.text : G.muted,
              fontWeight: modo === key ? 700 : 400, fontSize: 13,
            }}>
              <Icon size={15} color={modo === key ? G.text : G.muted} />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}

          {/* ─── Campos: Agendar ─── */}
          {modo === 'agendar' && (
            <>
              <div>
                <div style={{ fontSize: 12, color: G.muted, fontWeight: 500, marginBottom: 4 }}>Cliente *</div>
                <SearchCombobox
                  options={clientes.map(c => ({ id: c.cli_codigo, nome: `${c.cli_nomred || c.cli_nome}${c.cli_cnpj ? ' — ' + c.cli_cnpj : ''}` }))}
                  value={ag.cli_codigo}
                  onChange={v => setAg(p => ({ ...p, cli_codigo: v }))}
                  placeholder="— Selecione —"
                  searchPlaceholder="Buscar cliente..."
                  required
                  minWidth={0}
                />
              </div>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Assunto *
                <input value={ag.titulo} onChange={e => setAg(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} placeholder="O que precisa ser feito?" required />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data *
                  <input type="date" value={ag.data_prevista} onChange={e => setAg(p => ({ ...p, data_prevista: e.target.value }))} style={inputStyle} required />
                </label>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Hora
                  <input type="time" value={ag.hora_prevista} onChange={e => setAg(p => ({ ...p, hora_prevista: e.target.value }))} style={inputStyle} />
                </label>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Prioridade
                  <select value={ag.prioridade} onChange={e => setAg(p => ({ ...p, prioridade: e.target.value }))} style={inputStyle}>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </label>
              </div>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição
                <textarea value={ag.descricao} onChange={e => setAg(p => ({ ...p, descricao: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Detalhes adicionais..." />
              </label>
            </>
          )}

          {/* ─── Campos: Registrar ─── */}
          {modo === 'registrar' && (
            <>
              <div>
                <div style={{ fontSize: 12, color: G.muted, fontWeight: 500, marginBottom: 4 }}>Cliente *</div>
                <SearchCombobox
                  options={clientes.map(c => ({ id: c.cli_codigo, nome: `${c.cli_nomred || c.cli_nome}${c.cli_cnpj ? ' — ' + c.cli_cnpj : ''}` }))}
                  value={re.cli_codigo}
                  onChange={v => setRe(p => ({ ...p, cli_codigo: v }))}
                  placeholder="— Selecione —"
                  searchPlaceholder="Buscar cliente..."
                  required
                  minWidth={0}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Tipo *
                  <select value={re.tipo_id} onChange={e => setRe(p => ({ ...p, tipo_id: e.target.value }))} style={inputStyle} required>
                    <option value="">— Selecione —</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Canal *
                  <select value={re.canal_id} onChange={e => setRe(p => ({ ...p, canal_id: e.target.value }))} style={inputStyle} required>
                    <option value="">— Selecione —</option>
                    {canais.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Resultado
                  <select value={re.resultado_id} onChange={e => setRe(p => ({ ...p, resultado_id: e.target.value }))} style={inputStyle}>
                    <option value="">— Nenhum —</option>
                    {resultados.map(r => <option key={r.id} value={r.id}>{r.descricao}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data *
                  <input type="date" value={re.data_interacao} onChange={e => setRe(p => ({ ...p, data_interacao: e.target.value }))} style={inputStyle} required />
                </label>
              </div>

              {/* Indústrias */}
              <div>
                <div style={{ fontSize: 12, color: G.muted, fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={13} color={G.muted} />
                  Indústrias Abordadas
                  {industriasSel.size > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: G.mustard, color: G.text, padding: '1px 7px', borderRadius: 10 }}>
                      {industriasSel.size} selecionada{industriasSel.size > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                  {loading && <span style={{ fontSize: 12, color: G.muted, fontStyle: 'italic', gridColumn: '1/-1' }}>Carregando...</span>}
                  {industrias.map(ind => {
                    const sel = industriasSel.has(ind.for_codigo)
                    return (
                      <button key={ind.for_codigo} type="button" onClick={() => toggleInd(ind.for_codigo)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        padding: '7px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: sel ? `2px solid ${G.mustard}` : `1px solid ${G.border}`,
                        background: sel ? G.mustard : '#fff', color: sel ? G.text : G.muted,
                        textTransform: 'uppercase', letterSpacing: '0.02em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {sel && <Check size={10} strokeWidth={3} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ind.for_nomered || ind.for_nome}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição / Resumo
                <textarea value={re.descricao} onChange={e => setRe(p => ({ ...p, descricao: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Detalhes do atendimento..." />
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={saving} style={btnPrimary()}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Editar Followup ─────────────────────────────────────────────────────
function EditFollowupModal({ item, venCodigo, onClose, onSaved }: {
  item: Followup
  venCodigo: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    titulo: item.titulo,
    descricao: item.descricao ?? '',
    data_prevista: item.data_prevista?.slice(0, 10) ?? '',
    hora_prevista: item.hora_prevista?.slice(0, 5) ?? '',
    prioridade: item.prioridade,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/crm/followups/${item.id}`, {
        titulo: form.titulo,
        descricao: form.descricao || null,
        data_prevista: form.data_prevista,
        hora_prevista: form.hora_prevista || null,
        prioridade: form.prioridade,
      })
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Editar Compromisso</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Assunto *
            <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} required />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data
              <input type="date" value={form.data_prevista} onChange={e => setForm(p => ({ ...p, data_prevista: e.target.value }))} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Hora
              <input type="time" value={form.hora_prevista} onChange={e => setForm(p => ({ ...p, hora_prevista: e.target.value }))} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Prioridade
              <select value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: e.target.value }))} style={inputStyle}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição
            <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} />
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

// ─── Modal Concluir com próximo ────────────────────────────────────────────────
function ConcluirModal({ item, venCodigo, onClose, onSaved }: {
  item: Followup
  venCodigo: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [criarProximo, setCriarProximo] = useState(false)
  const [proximaData, setProximaData] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [saving, setSaving] = useState(false)

  async function confirmar() {
    setSaving(true)
    try {
      await api.patch(`/crm/followups/${item.id}`, { status: 'concluido' })
      if (criarProximo) {
        await api.post('/crm/followups', {
          cli_codigo: item.cli_codigo,
          ven_codigo: venCodigo ?? 1,
          titulo: item.titulo,
          descricao: item.descricao || null,
          data_prevista: proximaData,
          prioridade: item.prioridade,
        })
      }
      onSaved()
    } catch { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Concluir Compromisso</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: G.muted, lineHeight: 1.5 }}>
          Marcar <strong style={{ color: G.text }}>"{item.titulo}"</strong> com {item.cli_nomred} como concluído?
        </p>

        {/* Próximo follow-up */}
        <div style={{
          border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 14px',
          background: criarProximo ? G.mustard + '10' : '#fff',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: G.text, fontWeight: 600 }}>
            <input type="checkbox" checked={criarProximo} onChange={e => setCriarProximo(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: G.mustard, cursor: 'pointer' }} />
            Criar próximo follow-up automaticamente
          </label>
          {criarProximo && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data do próximo retorno
                <input type="date" value={proximaData} onChange={e => setProximaData(e.target.value)}
                  style={{ ...inputStyle, marginTop: 4 }} />
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={confirmar} disabled={saving}
            style={{ ...btnPrimary('#22C55E'), display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} />
            {saving ? 'Salvando...' : 'Concluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Editar Interacao ────────────────────────────────────────────────────
function EditInteracaoModal({ item, onClose, onSaved }: {
  item: Interacao
  onClose: () => void
  onSaved: () => void
}) {
  const [tipos,      setTipos]      = useState<Lookup[]>([])
  const [canais,     setCanais]     = useState<Lookup[]>([])
  const [resultados, setResultados] = useState<Lookup[]>([])
  const [industrias, setIndustrias] = useState<Industria[]>([])
  const [indSel,     setIndSel]     = useState<Set<number>>(new Set(item.industrias ?? []))
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const [form, setForm] = useState({
    tipo_id:      String(item.tipo_interacao_id),
    canal_id:     String(item.canal_id ?? ''),
    resultado_id: String(item.resultado_id ?? ''),
    data_interacao: item.data_interacao?.slice(0, 10) ?? '',
    descricao:    item.descricao ?? '',
  })

  useEffect(() => {
    Promise.all([
      api.get('/crm/tipos'),
      api.get('/crm/canais'),
      api.get('/crm/resultados'),
      api.get('/suppliers'),
    ]).then(([t, c, r, ind]) => {
      setTipos(t.data.data ?? [])
      setCanais(c.data.data ?? [])
      setResultados(r.data.data ?? [])
      setIndustrias(ind.data.data ?? ind.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleInd = (cod: number) => {
    setIndSel(prev => { const n = new Set(prev); n.has(cod) ? n.delete(cod) : n.add(cod); return n })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo_id || !form.canal_id) { setError('Tipo e canal são obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      await api.put(`/crm/interacoes/${item.interacao_id}`, {
        tipo_interacao_id: parseInt(form.tipo_id),
        canal_id:          parseInt(form.canal_id),
        resultado_id:      form.resultado_id ? parseInt(form.resultado_id) : null,
        data_interacao:    form.data_interacao || null,
        descricao:         form.descricao || null,
        industrias:        Array.from(indSel),
      })
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: 28, width: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Editar Atendimento</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: G.muted }}>{item.cli_nomred}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>

        {loading ? <div style={{ padding: 20, textAlign: 'center', color: G.muted }}>Carregando...</div> : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Tipo *
                <select value={form.tipo_id} onChange={e => setForm(p => ({ ...p, tipo_id: e.target.value }))} style={inputStyle} required>
                  <option value="">— Selecione —</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Canal *
                <select value={form.canal_id} onChange={e => setForm(p => ({ ...p, canal_id: e.target.value }))} style={inputStyle} required>
                  <option value="">— Selecione —</option>
                  {canais.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Resultado
                <select value={form.resultado_id} onChange={e => setForm(p => ({ ...p, resultado_id: e.target.value }))} style={inputStyle}>
                  <option value="">— Nenhum —</option>
                  {resultados.map(r => <option key={r.id} value={r.id}>{r.descricao}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data
                <input type="date" value={form.data_interacao} onChange={e => setForm(p => ({ ...p, data_interacao: e.target.value }))} style={inputStyle} />
              </label>
            </div>

            <div>
              <div style={{ fontSize: 12, color: G.muted, fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={13} color={G.muted} />
                Indústrias Abordadas
                {indSel.size > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: G.mustard, color: G.text, padding: '1px 7px', borderRadius: 10 }}>
                    {indSel.size} selecionada{indSel.size > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                {industrias.map(ind => {
                  const sel = indSel.has(ind.for_codigo)
                  return (
                    <button key={ind.for_codigo} type="button" onClick={() => toggleInd(ind.for_codigo)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '7px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: sel ? `2px solid ${G.mustard}` : `1px solid ${G.border}`,
                      background: sel ? G.mustard : '#fff', color: sel ? G.text : G.muted,
                      textTransform: 'uppercase', letterSpacing: '0.02em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {sel && <Check size={10} strokeWidth={3} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ind.for_nomered || ind.for_nome}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Descrição / Resumo
              <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Detalhes do atendimento..." />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={saving} style={btnPrimary()}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Row Histórico (Interacao) ─────────────────────────────────────────────────
function InteracaoRow({ item, onDelete, onEdit }: {
  item: Interacao
  onDelete: (id: number) => void
  onEdit: (item: Interacao) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const date = item.data_interacao?.slice(0, 10).split('-').reverse().join('/')
  return (
    <>
      <tr style={{ borderTop: `1px solid ${G.border}`, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <td style={{ padding: '10px 14px', fontSize: 12, color: G.muted }}>{date}</td>
        <td style={{ padding: '10px 14px', fontWeight: 500, color: G.text }}>{item.cli_nomred}</td>
        <td style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8' }}>{item.tipo}</span>
        </td>
        <td style={{ padding: '10px 14px', color: G.muted, fontSize: 12 }}>{item.canal}</td>
        <td style={{ padding: '10px 14px', color: G.text, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</td>
        <td style={{ padding: '10px 14px' }}>
          {item.resultado && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#F0FDF4', color: '#166534' }}>{item.resultado}</span>
          )}
        </td>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={e => { e.stopPropagation(); onEdit(item) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }}>
              <Pencil size={14} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(item.interacao_id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 4 }}>
              <Trash2 size={14} />
            </button>
            {expanded ? <ChevronUp size={14} color={G.muted} /> : <ChevronDown size={14} color={G.muted} />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: G.bg }}>
          <td colSpan={7} style={{ padding: '10px 24px 14px', fontSize: 13, color: G.text, borderTop: `1px solid ${G.border}` }}>
            {item.descricao && (
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: G.muted, fontSize: 11, fontWeight: 500 }}>DESCRIÇÃO</strong>
                <p style={{ margin: '4px 0 0', lineHeight: 1.6 }}>{item.descricao}</p>
              </div>
            )}
            {item.industrias && item.industrias.length > 0 && (
              <div>
                <strong style={{ color: G.muted, fontSize: 11, fontWeight: 500 }}>INDÚSTRIAS ABORDADAS</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {item.industrias.map(id => (
                    <span key={id} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: '#FFFBEB', color: '#92400E', border: `1px solid ${G.mustard}`,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <Building2 size={10} /> #{id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AtividadesPage() {
  const [tab, setTab] = useState<Tab>('pendentes')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [tipos, setTipos] = useState<Lookup[]>([])
  const [counts, setCounts] = useState({ atrasados: 0, hoje: 0, semana: 0, total_pendentes: 0 })

  const [modalNovo, setModalNovo] = useState(false)
  const [modalConcluir, setModalConcluir] = useState<Followup | null>(null)
  const [modalEdit, setModalEdit] = useState<Followup | null>(null)
  const [modalEditInteracao, setModalEditInteracao] = useState<Interacao | null>(null)

  const authState = (() => {
    try { return JSON.parse(localStorage.getItem('sm_auth_state') || '{}') } catch { return {} }
  })()
  const venCodigo = authState?.seller?.ven_codigo ?? authState?.ven_codigo

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (venCodigo) p.set('ven_codigo', String(venCodigo))

    Promise.all([
      api.get(`/crm/followups?${p}`),
      api.get(`/crm/interacoes?${p}`),
      api.get(`/crm/followups/count${venCodigo ? `?ven_codigo=${venCodigo}` : ''}`),
    ]).then(([fu, int, cnt]) => {
      if (fu.data.success)  setFollowups(fu.data.data ?? [])
      if (int.data.success) setInteracoes(int.data.data ?? [])
      if (cnt.data.success) setCounts(cnt.data.data ?? counts)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [venCodigo])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/crm/tipos').then(r => setTipos(r.data.data ?? [])).catch(() => {})
  }, [])

  async function handleDeleteInteracao(id: number) {
    if (!confirm('Excluir este atendimento?')) return
    await api.delete(`/crm/interacoes/${id}`)
    load()
  }

  async function handleDeleteFollowup(id: number) {
    if (!confirm('Excluir este compromisso?')) return
    await api.delete(`/crm/followups/${id}`)
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const pendentes = followups.filter(f => f.status === 'pendente')
  const historico = interacoes

  const filteredPendentes = pendentes.filter(f =>
    !search
    || (f.cli_nomred ?? '').toLowerCase().includes(search.toLowerCase())
    || (f.titulo ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredHistorico = historico.filter(i => {
    const matchSearch = !search
      || (i.cli_nomred ?? '').toLowerCase().includes(search.toLowerCase())
      || (i.descricao ?? '').toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filterTipo || String(i.tipo_interacao_id) === filterTipo
    return matchSearch && matchTipo
  })

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>
      <InfoBanner
        storageKey="crm_atividades_banner"
        icon={<Activity size={18} style={{ color: G.mustard }} />}
        title="Atividades — compromissos e histórico em uma tela só"
        description="Agende retornos, ligações e visitas na aba Pendentes. Quando realizar, clique em Concluir — o atendimento vai direto para o Histórico. Nada se perde, nada é digitado duas vezes."
        tip="Dica: ao concluir um compromisso, você pode criar automaticamente o próximo follow-up — mantendo o ciclo de relacionamento sempre ativo."
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={22} color={G.mustard} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: G.text }}>Atividades</h1>
            <p style={{ margin: 0, fontSize: 12, color: G.muted }}>Compromissos pendentes e histórico de atendimentos</p>
          </div>
        </div>
        <button onClick={() => setModalNovo(true)}
          style={{ ...btnPrimary(), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nova Atividade
        </button>
      </div>

      {/* Contadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Atrasados',      value: counts.atrasados,       color: G.red,   icon: AlertTriangle },
          { label: 'Para hoje',      value: counts.hoje,            color: G.amber, icon: Clock },
          { label: 'Esta semana',    value: counts.semana,          color: G.blue,  icon: Calendar },
          { label: 'Total pendente', value: counts.total_pendentes, color: G.text,  icon: ListChecks },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon size={20} color={color} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 11, color: G.muted }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([
          { key: 'pendentes', label: 'Pendentes', icon: ListChecks, count: filteredPendentes.length },
          { key: 'historico', label: 'Histórico',  icon: ClipboardCheck, count: null },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 700 : 400,
            border: tab === key ? 'none' : `1px solid ${G.border}`,
            background: tab === key ? G.text : 'transparent',
            color: tab === key ? '#E8E1D4' : G.muted,
          }}>
            <Icon size={14} />
            {label}
            {count !== null && (
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: tab === key ? G.mustard : G.border, color: G.text, padding: '0 5px',
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
        <Search size={14} color={G.muted} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'pendentes' ? 'Buscar por cliente ou assunto...' : 'Buscar por cliente ou descrição...'}
          style={{ flex: 1, padding: '6px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none' }} />
        {tab === 'historico' && (
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            style={{ padding: '6px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, background: '#fff', color: G.text, outline: 'none' }}>
            <option value="">Todos os tipos</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
        )}
        <span style={{ fontSize: 12, color: G.muted, whiteSpace: 'nowrap' }}>
          {tab === 'pendentes' ? filteredPendentes.length : filteredHistorico.length} registros
        </span>
      </div>

      {/* Conteúdo */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando...</div>
        ) : tab === 'pendentes' ? (
          filteredPendentes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhum compromisso pendente.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['Data/Hora', 'Cliente', 'Assunto', 'Prioridade', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPendentes.map(item => {
                  const dateFmt = item.data_prevista?.slice(0, 10).split('-').reverse().join('/')
                  const pCols = PRIORIDADE_COLORS[item.prioridade] ?? PRIORIDADE_COLORS.media
                  const atrasado = item.dias_atraso > 0
                  const isHoje = item.data_prevista?.slice(0, 10) === today
                  return (
                    <tr key={item.id} style={{
                      borderTop: `1px solid ${G.border}`,
                      background: atrasado ? '#FEF2F2' : isHoje ? '#FFFBEB' : 'transparent',
                    }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: G.muted, whiteSpace: 'nowrap' }}>
                        <div>{dateFmt}</div>
                        {item.hora_prevista && <div style={{ fontSize: 11 }}>{item.hora_prevista.slice(0, 5)}</div>}
                        {atrasado && <div style={{ fontSize: 10, color: G.red, fontWeight: 600 }}>+{item.dias_atraso}d atrasado</div>}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: G.text }}>{item.cli_nomred}</td>
                      <td style={{ padding: '10px 14px', color: G.text, maxWidth: 300 }}>
                        {item.titulo}
                        {item.descricao && <div style={{ fontSize: 11, color: G.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{item.descricao}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, ...pCols }}>{item.prioridade?.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => setModalConcluir(item)} title="Concluir"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.green, padding: 4 }}>
                            <CheckCircle size={16} />
                          </button>
                          <button onClick={() => setModalEdit(item)} title="Editar"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteFollowup(item.id)} title="Excluir"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 4 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          filteredHistorico.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhum atendimento registrado.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['Data', 'Cliente', 'Tipo', 'Canal', 'Descrição', 'Resultado', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: G.muted, fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistorico.map(item => (
                  <InteracaoRow key={item.interacao_id} item={item} onDelete={handleDeleteInteracao} onEdit={setModalEditInteracao} />
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Modais */}
      {modalNovo && (
        <AtividadeModal
          venCodigo={venCodigo ?? null}
          onClose={() => setModalNovo(false)}
          onSaved={() => { setModalNovo(false); load() }}
        />
      )}
      {modalConcluir && (
        <ConcluirModal
          item={modalConcluir}
          venCodigo={venCodigo ?? null}
          onClose={() => setModalConcluir(null)}
          onSaved={() => { setModalConcluir(null); load() }}
        />
      )}
      {modalEdit && (
        <EditFollowupModal
          item={modalEdit}
          venCodigo={venCodigo ?? null}
          onClose={() => setModalEdit(null)}
          onSaved={() => { setModalEdit(null); load() }}
        />
      )}
      {modalEditInteracao && (
        <EditInteracaoModal
          item={modalEditInteracao}
          onClose={() => setModalEditInteracao(null)}
          onSaved={() => { setModalEditInteracao(null); load() }}
        />
      )}
    </div>
  )
}
