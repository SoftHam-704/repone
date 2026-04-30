import { useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'
import {
  AlertTriangle, TrendingUp, CheckCircle2, Phone,
  Loader2, RefreshCw, Calendar, Target, MapPin,
} from 'lucide-react'

const G = {
  bg: '#E8E1D4', card: '#F2EDE4', cardHi: '#EDE7DB', border: '#D6CCBA',
  text: '#28374A', textSec: '#3D5265', textMuted: '#6B7A8A',
  mustard: '#FFD200', success: '#16A34A', danger: '#DC2626', amber: '#D97706',
}

const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtDate = (d: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

interface ClienteRisco {
  cli_codigo: number
  cli_nomred: string
  cli_cidade: string
  cli_uf: string
  cli_fone1: string
  ultima_compra: string
  pedidos_trimestre_anterior: number
  valor_trimestre_anterior: number
}

interface Meta {
  for_codigo: number
  for_nomered: string
  meta_trimestre: number
  realizado: number
}

interface VisitasSemana {
  total_semana: number
  com_pedido: number
  hoje: number
}

interface RadarData {
  trimestre_atual: { start: string; end: string }
  trimestre_anterior: { start: string; end: string }
  em_risco: ClienteRisco[]
  metas: Meta[]
  visitas: VisitasSemana
}

// ─── Meta bar ──────────────────────────────────────────────────────────────────
function MetaBar({ meta }: { meta: Meta }) {
  const pct = meta.meta_trimestre > 0
    ? Math.min((meta.realizado / meta.meta_trimestre) * 100, 100)
    : 0
  const cor = pct >= 100 ? G.success : pct >= 60 ? G.mustard : G.danger

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{meta.for_nomered}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: cor }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 6, background: G.cardHi, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: G.textMuted }}>{fmt(meta.realizado)}</span>
        <span style={{ fontSize: 11, color: G.textMuted }}>meta {fmt(meta.meta_trimestre)}</span>
      </div>
    </div>
  )
}

// ─── Card cliente em risco ─────────────────────────────────────────────────────
function ClienteRiscoCard({ c, onLigar }: { c: ClienteRisco; onLigar: (fone: string) => void }) {
  const diasSemComprar = c.ultima_compra
    ? Math.floor((Date.now() - new Date(c.ultima_compra).getTime()) / 86400000)
    : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderBottom: `1px solid ${G.border}`,
      cursor: 'default',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: '#D9760018', border: '1px solid #D9760033',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={16} style={{ color: G.amber }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.cli_nomred}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <MapPin size={10} style={{ color: G.textMuted, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: G.textMuted }}>{c.cli_cidade}/{c.cli_uf}</span>
          {diasSemComprar && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
              background: '#D9760018', color: G.amber,
            }}>
              {diasSemComprar}d sem comprar
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: G.textSec }}>{fmt(c.valor_trimestre_anterior)}</div>
        <div style={{ fontSize: 10, color: G.textMuted }}>trimestre ant.</div>
      </div>
      {c.cli_fone1 && (
        <button
          onClick={() => onLigar(c.cli_fone1)}
          title={c.cli_fone1}
          style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`,
            background: G.card, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Phone size={13} style={{ color: G.textSec }} />
        </button>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function CarteiraRadarPage() {
  const [data, setData] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)

  const authState = (() => {
    try { return JSON.parse(localStorage.getItem('sm_auth_state') || '{}') } catch { return {} }
  })()
  const venCodigo = authState?.seller?.ven_codigo ?? authState?.ven_codigo

  const load = () => {
    setLoading(true)
    const p = venCodigo ? `?ven_codigo=${venCodigo}` : ''
    api.get(`/crm/carteira/radar${p}`)
      .then(r => r.data.success && setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const fmtTrimestre = (t: { start: string; end: string }) =>
    `${fmtDate(t.start)} – ${fmtDate(t.end)}`

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: G.text, letterSpacing: -0.5 }}>
            Radar do Rep
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: G.textMuted }}>
            Trimestre atual · {data ? fmtTrimestre(data.trimestre_atual) : '—'}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, cursor: 'pointer', fontSize: 12, color: G.textSec }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {loading && !data ? (
        <div style={{ padding: 60, textAlign: 'center', color: G.textMuted }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13 }}>Calculando carteira...</p>
        </div>
      ) : !data ? null : (
        <>
          {/* ── KPIs de visita ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Visitas esta semana', value: data.visitas?.total_semana ?? 0, icon: Calendar, color: G.text },
              { label: 'Visitas com pedido', value: data.visitas?.com_pedido ?? 0, icon: CheckCircle2, color: G.success },
              { label: 'Clientes em risco', value: data.em_risco.length, icon: AlertTriangle, color: G.amber },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{
                background: G.card, border: `1px solid ${G.border}`, borderRadius: 14,
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: color + '14', border: `1px solid ${color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: G.textMuted, marginTop: 3 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Grid principal ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Clientes em risco */}
            <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                padding: '14px 16px', borderBottom: `1px solid ${G.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#D9760008',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={15} style={{ color: G.amber }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: G.text }}>
                    Compraram no trimestre anterior, sumiram agora
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                  background: G.amber + '18', color: G.amber,
                }}>{data.em_risco.length}</span>
              </div>

              {data.em_risco.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                  <CheckCircle2 size={28} style={{ color: G.success, marginBottom: 8, opacity: 0.6 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Nenhum cliente em risco!</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11 }}>Todos que compraram antes continuam ativos.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {data.em_risco.map(c => (
                    <ClienteRiscoCard key={c.cli_codigo} c={c} onLigar={fone => window.open(`tel:${fone}`)} />
                  ))}
                </div>
              )}
            </div>

            {/* Metas */}
            <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                padding: '14px 16px', borderBottom: `1px solid ${G.border}`,
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#FFD20008',
              }}>
                <Target size={15} style={{ color: G.mustard }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: G.text }}>
                  Meta por Indústria — Trimestre Atual
                </span>
              </div>

              {data.metas.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                  <TrendingUp size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>Sem metas cadastradas.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {data.metas.map(m => <MetaBar key={m.for_codigo} meta={m} />)}
                </div>
              )}
            </div>

          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
