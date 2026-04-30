import { useEffect, useState, useCallback } from 'react'
import { api } from '@/shared/lib/api'
import {
  Search, MapPin, CheckCircle2, AlertTriangle, XCircle,
  MinusCircle, Loader2, RefreshCw, ChevronRight, Phone,
  ShoppingBag, CalendarCheck,
} from 'lucide-react'
import FichaCarteiraPanel from './FichaCarteiraPanel'

const G = {
  bg: '#E8E1D4', card: '#F2EDE4', cardHi: '#EDE7DB', border: '#D6CCBA',
  text: '#28374A', textSec: '#3D5265', textMuted: '#6B7A8A',
  mustard: '#FFD200', success: '#16A34A', danger: '#DC2626', amber: '#D97706',
}

const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtDate = (d: string | null) =>
  d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const diasDesde = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null

type StatusCarteira = 'ativo' | 'risco' | 'inativo' | 'perdido'

const STATUS_MAP: Record<StatusCarteira, { label: string; color: string; bg: string; icon: any }> = {
  ativo:   { label: 'Ativo',    color: G.success, bg: '#16A34A18', icon: CheckCircle2 },
  risco:   { label: 'Em Risco', color: G.amber,   bg: '#D9760018', icon: AlertTriangle },
  inativo: { label: 'Inativo',  color: G.danger,  bg: '#DC262618', icon: XCircle },
  perdido: { label: 'Perdido',  color: G.textMuted, bg: '#6B7A8A18', icon: MinusCircle },
}

interface ClienteCarteira {
  cli_codigo: number
  cli_nomred: string
  cli_cidade: string
  cli_uf: string
  cli_fone1: string
  ultima_compra: string | null
  ultima_visita: string | null
  ultimo_resultado: string | null
  ped_t0: number
  ped_t1: number
  valor_t0: number
  valor_t1: number
  ltv: number
  status_carteira: StatusCarteira
}

const FILTROS: { key: string; label: string }[] = [
  { key: 'todos',   label: 'Todos' },
  { key: 'risco',   label: 'Em Risco' },
  { key: 'ativo',   label: 'Ativos' },
  { key: 'inativo', label: 'Inativos' },
  { key: 'perdido', label: 'Perdidos' },
]

function StatusBadge({ status }: { status: StatusCarteira }) {
  const s = STATUS_MAP[status]
  const Icon = s.icon
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
    }}>
      <Icon size={10} />
      {s.label}
    </div>
  )
}

function ClienteRow({ c, onSelect }: { c: ClienteCarteira; onSelect: () => void }) {
  const diasCompra = diasDesde(c.ultima_compra)
  const diasVisita = diasDesde(c.ultima_visita)

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: `1px solid ${G.border}`,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Status icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: STATUS_MAP[c.status_carteira].bg,
        border: `1px solid ${STATUS_MAP[c.status_carteira].color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {(() => { const Icon = STATUS_MAP[c.status_carteira].icon; return <Icon size={16} style={{ color: STATUS_MAP[c.status_carteira].color }} /> })()}
      </div>

      {/* Name + location */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.cli_nomred}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <MapPin size={9} style={{ color: G.textMuted, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: G.textMuted }}>{c.cli_cidade}/{c.cli_uf}</span>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <StatusBadge status={c.status_carteira} />
        <div style={{ display: 'flex', gap: 6 }}>
          {diasCompra !== null && (
            <span style={{ fontSize: 10, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <ShoppingBag size={9} />
              {diasCompra}d
            </span>
          )}
          {diasVisita !== null && (
            <span style={{ fontSize: 10, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <CalendarCheck size={9} />
              {diasVisita}d
            </span>
          )}
        </div>
      </div>

      {/* Valor trimestre anterior */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: G.textSec }}>{fmt(c.valor_t1)}</div>
        <div style={{ fontSize: 10, color: G.textMuted }}>trim. ant.</div>
      </div>

      <ChevronRight size={14} style={{ color: G.textMuted, flexShrink: 0 }} />
    </div>
  )
}

export default function CarteiraClientesPage() {
  const [clientes, setClientes] = useState<ClienteCarteira[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [search, setSearch] = useState('')
  const [fichaCli, setFichaCli] = useState<ClienteCarteira | null>(null)

  const authState = (() => {
    try { return JSON.parse(localStorage.getItem('sm_auth_state') || '{}') } catch { return {} }
  })()
  const venCodigo = authState?.seller?.ven_codigo ?? authState?.ven_codigo

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (venCodigo) p.set('ven_codigo', String(venCodigo))
    if (filtro !== 'todos') p.set('status', filtro)
    if (search.trim()) p.set('search', search.trim())
    api.get(`/crm/carteira/clientes?${p}`)
      .then(r => r.data.success && setClientes(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [venCodigo, filtro, search])

  useEffect(() => { load() }, [load])

  // Count by status for tab badges
  const counts = clientes.reduce<Record<string, number>>((acc, c) => {
    acc[c.status_carteira] = (acc[c.status_carteira] || 0) + 1
    acc.todos = (acc.todos || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: G.text, letterSpacing: -0.5 }}>
            Carteira de Clientes
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: G.textMuted }}>
            {loading ? 'Carregando...' : `${counts.todos ?? 0} clientes ativos na carteira`}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, cursor: 'pointer', fontSize: 12, color: G.textSec }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Buscar cliente..."
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
            border: `1px solid ${G.border}`, background: G.card, fontSize: 13,
            color: G.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTROS.map(f => {
          const active = filtro === f.key
          const count = counts[f.key] ?? 0
          return (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: `1px solid ${active ? G.mustard : G.border}`,
                background: active ? G.mustard : G.card,
                color: active ? G.text : G.textSec,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {f.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                  background: active ? '#0002' : G.cardHi,
                  color: active ? G.text : G.textMuted,
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: G.textMuted }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Carregando carteira...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            <CheckCircle2 size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>Nenhum cliente encontrado.</p>
          </div>
        ) : (
          clientes.map(c => (
            <ClienteRow key={c.cli_codigo} c={c} onSelect={() => setFichaCli(c)} />
          ))
        )}
      </div>

      {/* Ficha panel */}
      {fichaCli && (
        <FichaCarteiraPanel
          cliCodigo={fichaCli.cli_codigo}
          cliNomred={fichaCli.cli_nomred}
          statusCarteira={fichaCli.status_carteira}
          venCodigo={venCodigo}
          onClose={() => setFichaCli(null)}
          onVisitaSalva={load}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
