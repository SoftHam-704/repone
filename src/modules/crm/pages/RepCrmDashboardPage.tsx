import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Target, ClipboardCheck, Kanban, AlertTriangle, Calendar, ChevronRight, TrendingUp, MessageCircle } from 'lucide-react'
import { api } from '@/shared/lib/api'

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

interface DashData {
  pipeline: { etapa_id: number; descricao: string; color: string; total: number; valor_total: number }[]
  followups: { atrasados: number; hoje: number; semana: number; total_pendentes: number }
  interacoes: { total_mes: number }
}

export default function RepCrmDashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  // Pega o vendedor logado do localStorage
  const authState = (() => {
    try { return JSON.parse(localStorage.getItem('sm_auth_state') || '{}') } catch { return {} }
  })()
  const venCodigo = authState?.seller?.ven_codigo ?? authState?.ven_codigo

  useEffect(() => {
    const params = venCodigo ? `?ven_codigo=${venCodigo}` : ''
    api.get(`/crm/dashboard${params}`)
      .then(r => r.data.success && setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [venCodigo])

  const totalOpp   = data?.pipeline.reduce((s, p) => s + p.total, 0) ?? 0
  const totalValor = data?.pipeline.reduce((s, p) => s + p.valor_total, 0) ?? 0
  const fp = data?.followups

  return (
    <div style={{ padding: '24px 28px', background: G.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <LayoutDashboard size={22} color={G.mustard} />
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: G.text }}>Dashboard CRM</h1>
          <p style={{ margin: 0, fontSize: 12, color: G.muted }}>Visão geral de relacionamentos e pipeline</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: G.muted }}>Carregando...</div>
      ) : (
        <>
          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Oportunidades',      value: totalOpp,                  unit: 'no pipeline', color: G.blue,   icon: Target },
              { label: 'Valor em Pipeline',  value: fmtBRL(totalValor),        unit: 'estimado',    color: G.green,  icon: TrendingUp },
              { label: 'Follow-ups Hoje',    value: fp?.hoje ?? 0,             unit: 'pendentes',   color: fp?.atrasados ? G.amber : G.text, icon: Calendar },
              { label: 'Atrasados',          value: fp?.atrasados ?? 0,        unit: 'follow-ups',  color: fp?.atrasados ? G.red : G.muted,  icon: AlertTriangle },
            ].map(({ label, value, unit, color, icon: Icon }) => (
              <div key={label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>{label}</span>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>{unit}</div>
              </div>
            ))}
          </div>

          {/* Pipeline Funil */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>Pipeline de Vendas</div>
              <Link to="/repcrm/pipeline" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none' }}>
                Ver Kanban <ChevronRight size={13} />
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(data?.pipeline ?? STAGES.map(s => ({ ...s, total: 0, valor_total: 0 }))).map(stage => (
                <div key={stage.etapa_id} style={{ flex: 1, background: G.bg, borderRadius: 8, padding: '12px 14px', border: `2px solid ${stage.color}20` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, marginBottom: 6 }} />
                  <div style={{ fontSize: 11, color: G.muted, marginBottom: 4 }}>{stage.descricao}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: G.text }}>{stage.total}</div>
                  <div style={{ fontSize: 11, color: stage.color, fontWeight: 600, marginTop: 2 }}>{fmtBRL(stage.valor_total)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-ups Widget */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>Follow-ups Pendentes</div>
                <Link to="/repcrm/atividades" style={{ fontSize: 12, color: G.mustard, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Ver todos <ChevronRight size={13} />
                </Link>
              </div>
              {[
                { label: 'Atrasados',    value: fp?.atrasados ?? 0, color: G.red },
                { label: 'Para hoje',    value: fp?.hoje ?? 0,      color: G.amber },
                { label: 'Esta semana',  value: fp?.semana ?? 0,    color: G.blue },
                { label: 'Total pendente', value: fp?.total_pendentes ?? 0, color: G.text },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${G.border}` }}>
                  <span style={{ fontSize: 13, color: G.text }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Atalhos */}
            <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 14 }}>Ações Rápidas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Atividades',          to: '/repcrm/atividades',  icon: ClipboardCheck, color: G.blue },
                  { label: 'Pipeline Kanban',     to: '/repcrm/pipeline',    icon: Kanban,         color: G.green },
                  { label: 'WhatsApp IA',         to: '/utilitarios/whatsapp-ia', icon: MessageCircle, color: '#25D366' },
                ].map(({ label, to, icon: Icon, color }) => (
                  <Link key={to} to={to} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: G.bg, borderRadius: 8, border: `1px solid ${G.border}`,
                    textDecoration: 'none', color: G.text, fontSize: 13, fontWeight: 500,
                    transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = G.border)}
                  >
                    <Icon size={16} color={color} /> {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
