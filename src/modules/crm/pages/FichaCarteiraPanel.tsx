import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/shared/lib/api'
import {
  X, MapPin, Phone, CheckCircle2, AlertTriangle, XCircle, MinusCircle,
  ShoppingBag, Package, CalendarCheck, Loader2, Plus, ChevronDown,
} from 'lucide-react'

const G = {
  bg: '#E8E1D4', card: '#F2EDE4', cardHi: '#EDE7DB', border: '#D6CCBA',
  text: '#28374A', textSec: '#3D5265', textMuted: '#6B7A8A',
  mustard: '#FFD200', success: '#16A34A', danger: '#DC2626', amber: '#D97706',
}

const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtDate = (d: string | null) =>
  d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

type StatusCarteira = 'ativo' | 'risco' | 'inativo' | 'perdido'

const STATUS_MAP: Record<StatusCarteira, { label: string; color: string; bg: string; icon: any }> = {
  ativo:   { label: 'Ativo',    color: G.success,   bg: '#16A34A18', icon: CheckCircle2 },
  risco:   { label: 'Em Risco', color: G.amber,     bg: '#D9760018', icon: AlertTriangle },
  inativo: { label: 'Inativo',  color: G.danger,    bg: '#DC262618', icon: XCircle },
  perdido: { label: 'Perdido',  color: G.textMuted, bg: '#6B7A8A18', icon: MinusCircle },
}

const RESULTADO_OPTIONS = [
  { value: 'pedido_gerado',  label: 'Pedido Gerado',   enum: 'positivou' },
  { value: 'sem_pedido',     label: 'Sem Pedido',      enum: 'nao_positivou' },
  { value: 'reagendou',      label: 'Reagendou',       enum: 'reagendou' },
  { value: 'nao_encontrado', label: 'Não Encontrado',  enum: 'ausente' },
]

// Aceita tanto valor UI quanto enum DB
const RESULTADO_LABELS: Record<string, string> = {
  pedido_gerado: 'Pedido Gerado', positivou:      'Pedido Gerado',
  sem_pedido:    'Sem Pedido',    nao_positivou:  'Sem Pedido',
  reagendou:     'Reagendou',
  nao_encontrado:'Não Encontrado',ausente:        'Não Encontrado',
  fechado:       'Fechado',
}

const RESULTADO_COLORS: Record<string, string> = {
  pedido_gerado: G.success,  positivou:     G.success,
  sem_pedido:    G.textMuted, nao_positivou: G.textMuted,
  reagendou:     G.amber,
  nao_encontrado:G.danger,   ausente:       G.danger,
  fechado:       G.textSec,
}

interface FichaData {
  cliente: Record<string, any>
  pedidos: Array<{ ped_pedido: string; ped_data: string; ped_totliq: number; ped_situacao: string; industria: string }>
  visitas: Array<{ id: number; data_visita: string; resultado: string; obs: string; industria_nome: string | null }>
  produtos_favs: Array<{ ite_produto: string; ite_nomeprod: string; vezes: number; qtd_total: number }>
}

interface Props {
  cliCodigo: number
  cliNomred: string
  statusCarteira: StatusCarteira
  venCodigo: number | null
  onClose: () => void
  onVisitaSalva: () => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', padding: '16px 20px 8px' }}>
      {children}
    </div>
  )
}

export default function FichaCarteiraPanel({ cliCodigo, cliNomred, statusCarteira, venCodigo, onClose, onVisitaSalva }: Props) {
  const [ficha, setFicha] = useState<FichaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVisitaForm, setShowVisitaForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [visitaForm, setVisitaForm] = useState({
    data_visita: new Date().toISOString().slice(0, 10),
    resultado: 'sem_pedido',
    ped_numero: '',
    obs: '',
  })

  useEffect(() => {
    setLoading(true)
    const p = venCodigo ? `?ven_codigo=${venCodigo}` : ''
    api.get(`/crm/carteira/clientes/${cliCodigo}/ficha${p}`)
      .then(r => r.data.success && setFicha(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cliCodigo])

  const salvarVisita = async () => {
    setSalvando(true)
    try {
      await api.post('/crm/carteira/visitas', {
        cli_codigo: cliCodigo,
        ven_codigo: venCodigo,
        data_visita: visitaForm.data_visita,
        resultado: visitaForm.resultado,
        ped_numero: visitaForm.ped_numero || null,
        obs: visitaForm.obs || null,
      })
      setShowVisitaForm(false)
      setVisitaForm({ data_visita: new Date().toISOString().slice(0, 10), resultado: 'sem_pedido', ped_numero: '', obs: '' })
      // Reload ficha
      const p = venCodigo ? `?ven_codigo=${venCodigo}` : ''
      const r = await api.get(`/crm/carteira/clientes/${cliCodigo}/ficha${p}`)
      if (r.data.success) setFicha(r.data.data)
      onVisitaSalva()
    } catch (e) {
      // silent
    } finally {
      setSalvando(false)
    }
  }

  const s = STATUS_MAP[statusCarteira]
  const StatusIcon = s.icon

  const panel = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: '#00000040', zIndex: 1000,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
        background: G.bg, zIndex: 1001, overflowY: 'auto',
        boxShadow: '-4px 0 32px #0000001a',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 20px 16px', background: G.card,
          borderBottom: `1px solid ${G.border}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color,
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <StatusIcon size={10} />
                  {s.label}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: G.text, lineHeight: 1.2 }}>
                {cliNomred}
              </div>
              {ficha?.cliente && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MapPin size={10} style={{ color: G.textMuted }} />
                  <span style={{ fontSize: 12, color: G.textMuted }}>
                    {ficha.cliente.cli_cidade}/{ficha.cliente.cli_uf}
                  </span>
                  {ficha.cliente.cli_fone1 && (
                    <>
                      <span style={{ color: G.border }}>·</span>
                      <a
                        href={`tel:${ficha.cliente.cli_fone1}`}
                        style={{ fontSize: 12, color: G.textSec, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                      >
                        <Phone size={10} />
                        {ficha.cliente.cli_fone1}
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <X size={14} style={{ color: G.textSec }} />
            </button>
          </div>
        </div>

        {/* Register Visit CTA */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${G.border}`, background: G.card, flexShrink: 0 }}>
          <button
            onClick={() => setShowVisitaForm(v => !v)}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: 10,
              border: `1px solid ${G.mustard}`, background: G.mustard,
              color: G.text, fontSize: 13, fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Plus size={14} />
            Registrar Visita
            <ChevronDown size={12} style={{ transform: showVisitaForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showVisitaForm && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>Data</label>
                  <input
                    type="date"
                    value={visitaForm.data_visita}
                    onChange={e => setVisitaForm(f => ({ ...f, data_visita: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.bg, fontSize: 12, color: G.text, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>Resultado</label>
                  <select
                    value={visitaForm.resultado}
                    onChange={e => setVisitaForm(f => ({ ...f, resultado: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.bg, fontSize: 12, color: G.text, boxSizing: 'border-box' }}
                  >
                    {RESULTADO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {visitaForm.resultado === 'pedido_gerado' && (
                <input
                  placeholder="Nº do pedido (opcional)"
                  value={visitaForm.ped_numero}
                  onChange={e => setVisitaForm(f => ({ ...f, ped_numero: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.bg, fontSize: 12, color: G.text }}
                />
              )}
              <textarea
                placeholder="Observações (opcional)"
                value={visitaForm.obs}
                onChange={e => setVisitaForm(f => ({ ...f, obs: e.target.value }))}
                rows={2}
                style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.bg, fontSize: 12, color: G.text, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button
                onClick={salvarVisita}
                disabled={salvando}
                style={{
                  padding: '10px', borderRadius: 8, border: 'none',
                  background: G.text, color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {salvando && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {salvando ? 'Salvando...' : 'Salvar Visita'}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: G.textMuted }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Carregando ficha...</p>
          </div>
        ) : !ficha ? null : (
          <>
            {/* Últimos Pedidos */}
            <SectionTitle>Últimos Pedidos</SectionTitle>
            {ficha.pedidos.length === 0 ? (
              <p style={{ margin: 0, padding: '8px 20px', fontSize: 12, color: G.textMuted }}>Sem pedidos recentes.</p>
            ) : (
              <div style={{ margin: '0 20px 4px', background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {ficha.pedidos.map((p, i) => (
                  <div key={p.ped_pedido} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: i < ficha.pedidos.length - 1 ? `1px solid ${G.border}` : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: G.text }}>#{p.ped_pedido}</div>
                      <div style={{ fontSize: 11, color: G.textMuted }}>{p.industria ?? '—'} · {fmtDate(p.ped_data)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: G.textSec }}>{fmt(p.ped_totliq)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Produtos mais comprados */}
            <SectionTitle>Produtos Favoritos</SectionTitle>
            {ficha.produtos_favs.length === 0 ? (
              <p style={{ margin: 0, padding: '8px 20px', fontSize: 12, color: G.textMuted }}>Sem dados.</p>
            ) : (
              <div style={{ margin: '0 20px 4px', background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {ficha.produtos_favs.map((p, i) => (
                  <div key={p.ite_produto} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    borderBottom: i < ficha.produtos_favs.length - 1 ? `1px solid ${G.border}` : 'none',
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: G.cardHi, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package size={13} style={{ color: G.textMuted }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.ite_nomeprod}
                      </div>
                      <div style={{ fontSize: 10, color: G.textMuted }}>Cód. {p.ite_produto}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: G.textSec }}>{p.vezes}×</div>
                      <div style={{ fontSize: 10, color: G.textMuted }}>pedidos</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Histórico de visitas */}
            <SectionTitle>Histórico de Visitas</SectionTitle>
            {ficha.visitas.length === 0 ? (
              <p style={{ margin: 0, padding: '8px 20px 20px', fontSize: 12, color: G.textMuted }}>Nenhuma visita registrada ainda.</p>
            ) : (
              <div style={{ margin: '0 20px 20px', background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {ficha.visitas.map((v, i) => (
                  <div key={v.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: i < ficha.visitas.length - 1 ? `1px solid ${G.border}` : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: G.text, fontWeight: 600 }}>{fmtDate(v.data_visita)}</div>
                      {v.obs && <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{v.obs}</div>}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: (RESULTADO_COLORS[v.resultado] || G.textMuted) + '18',
                      color: RESULTADO_COLORS[v.resultado] || G.textMuted,
                    }}>
                      {RESULTADO_LABELS[v.resultado] ?? v.resultado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )

  return createPortal(panel, document.body)
}
