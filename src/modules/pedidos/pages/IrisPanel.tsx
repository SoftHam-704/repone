import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, History, Sparkles, AlertTriangle, Clock, Search,
  ShoppingCart, RotateCcw, ChevronRight, Package, Info, TrendingUp, Users,
  Zap, Copy, Check, Target, MessageSquare, BarChart2, ChevronDown, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { api } from '@/shared/lib/api'
import { IrisAvatar } from '@/shared/components/iris/IrisAvatar'

// ─── Tokens ────────────────────────────────────────────────────────────────────
const G = {
  bg: '#E8E1D4', card: '#F2EDE4', border: '#D6CCBA',
  text: '#28374A', muted: '#6B7A8A', mustard: '#FFD200',
}

const URGENCIA = {
  critica: { label: 'CRÍTICA',  bg: '#FEE2E2', color: '#991B1B', icon: AlertTriangle },
  alta:    { label: 'ALTA',     bg: '#FEF3C7', color: '#92400E', icon: Clock },
  atencao: { label: 'ATENÇÃO',  bg: '#EFF6FF', color: '#1D4ED8', icon: History },
}

interface Suggestion {
  ite_produto: string
  nome_produto: string
  frequencia: number
  ultima_compra: string
  dias_sem_compra: number
  ultima_quantidade: number
  media_quantidade: number
  preco_tabela: number
  pro_embalagem: string | null
  urgencia: 'critica' | 'alta' | 'atencao'
  historico_mensal: { mes: string; qty: number }[]
}

interface MixItem {
  ite_produto: string
  nome_produto: string
  preco_tabela: number
  pro_embalagem: string | null
  total_clientes: number
  total_pedidos: number
}

type Tab = 'recomprar' | 'mix' | 'iris'

const MIX_BADGE = (n: number) =>
  n >= 20 ? { label: 'POPULAR',  bg: '#DCFCE7', color: '#15803D' } :
  n >= 5  ? { label: 'EM ALTA',  bg: '#CCFBF1', color: '#0F766E' } :
  n >= 1  ? { label: 'NICHO',    bg: '#EFF6FF', color: '#1D4ED8' } :
            { label: 'INÉDITO',  bg: '#F3E8FF', color: '#7C3AED' }

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fillMeses(raw: { mes: string; qty: number }[]): { mes: string; qty: number; label: string }[] {
  const result = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('pt-BR', { month: 'short' })[0].toUpperCase()
    result.push({ mes: key, qty: raw.find(r => r.mes === key)?.qty ?? 0, label })
  }
  return result
}

const MIX_BAR_COLOR: Record<string, string> = {
  POPULAR: '#15803D', 'EM ALTA': '#0F766E', NICHO: '#1D4ED8', INÉDITO: '#7C3AED',
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#16A34A' }: {
  data: { mes: string; qty: number; label: string }[]
  color?: string
}) {
  const maxQty = Math.max(...data.map(d => d.qty), 1)
  const isLast = (i: number) => i === data.length - 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
      {data.map((d, i) => (
        <div key={d.mes} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          {d.qty === 0 && isLast(i) ? (
            <div style={{
              width: 8, height: 14,
              border: `1.5px dashed ${color === '#16A34A' ? '#DC2626' : '#D97706'}`,
              borderRadius: '2px 2px 0 0',
            }} />
          ) : (
            <div style={{
              width: 8,
              height: Math.max(Math.round((d.qty / maxQty) * 14), d.qty > 0 ? 3 : 0),
              background: color,
              borderRadius: '2px 2px 0 0',
              opacity: 0.85 + (i / data.length) * 0.15,
            }} />
          )}
          <span style={{
            fontSize: 7, color: isLast(i) && d.qty === 0 ? '#DC2626' : G.muted,
            fontWeight: isLast(i) && d.qty === 0 ? 800 : 400,
          }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── PenetrationBar ────────────────────────────────────────────────────────────
function PenetrationBar({ totalClientes, maxClientes, totalPedidos, badge }: {
  totalClientes: number
  maxClientes: number
  totalPedidos: number
  badge: string
}) {
  const pct = maxClientes > 0 ? Math.round((totalClientes / maxClientes) * 100) : 0
  const fillColor = MIX_BAR_COLOR[badge] ?? '#1D4ED8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <div style={{ width: 100, height: 5, background: G.border, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: fillColor, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 9, color: G.muted }}>
        {pct}% da carteira · {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ─── IrisNarrativeStrip ────────────────────────────────────────────────────────
function IrisNarrativeStrip({ tipo, clienteNome, industriaNome, summaryData }: {
  tipo: 'recomprar' | 'mix'
  clienteNome: string
  industriaNome: string
  summaryData: Record<string, any>
}) {
  const [narrativa, setNarrativa] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)

  const gerar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.post('/orders/iris-panel-narrative', {
        tipo, clienteNome, industriaNome, ...summaryData,
      })
      setNarrativa(r.data.narrativa || null)
    } catch {
      setNarrativa(null)
    } finally {
      setLoading(false)
    }
  }, [tipo, clienteNome, industriaNome, JSON.stringify(summaryData)])

  useEffect(() => { gerar() }, [])

  const isRecomprar = tipo === 'recomprar'
  const bg  = isRecomprar ? 'linear-gradient(90deg,#1E2D3A,#28374A)' : 'linear-gradient(90deg,#14532D,#166534)'
  const lbl = isRecomprar ? 'IRIS · Briefing de Visita'               : 'IRIS · Oportunidade de Mix'
  const lblColor  = isRecomprar ? '#FFD200' : '#4ADE80'
  const textColor = isRecomprar ? '#C8D8E4' : '#BBF7D0'
  const avatarBg  = isRecomprar ? 'linear-gradient(135deg,#FFD200,#F59E0B)' : 'linear-gradient(135deg,#4ADE80,#16A34A)'

  return (
    <div style={{ padding: '10px 14px', background: bg, display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 7, background: avatarBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 11, fontWeight: 900, color: '#28374A',
      }}>✦</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: lblColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {lbl}
        </div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${lblColor}30`, borderTopColor: lblColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 10, color: textColor, opacity: 0.6 }}>Gerando briefing...</span>
          </div>
        ) : narrativa ? (
          <p style={{ fontSize: 11, color: textColor, lineHeight: 1.65, margin: 0 }}>{narrativa}</p>
        ) : (
          <span style={{ fontSize: 10, color: textColor, opacity: 0.5 }}>Clique em ↺ para gerar</span>
        )}
      </div>
      <button
        onClick={gerar}
        disabled={loading}
        style={{
          flexShrink: 0, padding: '4px 8px', borderRadius: 6,
          border: `1px solid rgba(255,255,255,.15)`, background: 'transparent',
          color: textColor, fontSize: 9, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >↺ Gerar</button>
    </div>
  )
}

// ─── Linha de produto (Expandir Mix) ──────────────────────────────────────────
function MixRow({ item, selected, onToggle, qty, onQtyChange, maxClientes }: {
  item: MixItem
  selected: boolean
  onToggle: () => void
  qty: number
  onQtyChange: (v: number) => void
  maxClientes: number
}) {
  const badge = MIX_BADGE(item.total_clientes)
  const total = item.preco_tabela > 0
    ? (item.preco_tabela * qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'grid', gridTemplateColumns: '28px 1fr auto',
        gap: 10, alignItems: 'center',
        padding: '12px 14px',
        borderBottom: `1px solid ${G.border}`,
        background: selected ? G.mustard + '18' : 'transparent',
        cursor: 'pointer', transition: 'background .12s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: selected ? 'none' : `2px solid ${G.border}`,
        background: selected ? G.mustard : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ fontSize: 12, fontWeight: 900, color: G.text }}>✓</span>}
      </div>

      <div style={{ minWidth: 0 }}>
        {/* Linha 1: código (destaque) + badge popularidade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: G.text, letterSpacing: 0.5 }}>
            {item.ite_produto}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: badge.bg, color: badge.color, flexShrink: 0,
          }}>
            <Users size={8} />
            {badge.label}{item.total_clientes > 0 ? ` · ${item.total_clientes} cli.` : ''}
          </span>
        </div>
        {/* Linha 2: nome (secundário) */}
        <div style={{ fontSize: 11, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
          {item.nome_produto}
        </div>
        {/* Linha 2b: embalagem + preço */}
        {(item.pro_embalagem || item.preco_tabela > 0) && (
          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: G.muted, marginBottom: 2 }}>
            {item.pro_embalagem && <span>Emb: {item.pro_embalagem}</span>}
            {item.preco_tabela > 0 && (
              <span style={{ color: '#16A34A', fontWeight: 700 }}>
                {item.preco_tabela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>
        )}
        {/* Linha 3: barra de penetração */}
        <PenetrationBar
          totalClientes={item.total_clientes}
          maxClientes={maxClientes}
          totalPedidos={item.total_pedidos}
          badge={badge.label}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
        <input
          type="number" min={1} value={qty}
          onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            width: 64, padding: '4px 6px', borderRadius: 6, textAlign: 'center',
            border: `1px solid ${selected ? G.mustard : G.border}`,
            fontSize: 13, fontWeight: 700, color: G.text,
            background: selected ? G.mustard + '20' : '#fff', outline: 'none',
          }}
        />
        {total && selected && (
          <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>{total}</span>
        )}
      </div>
    </div>
  )
}

interface Props {
  clienteId: number
  clienteNome: string
  industriaId: number
  industriaNome: string
  tabelaId?: string
  onClose: () => void
  onNewOrder: (clienteId: number, industriaId: number) => void
}

// ─── Linha de produto ──────────────────────────────────────────────────────────
function SuggestionRow({
  item, selected, onToggle, qty, onQtyChange,
}: {
  item: Suggestion
  selected: boolean
  onToggle: () => void
  qty: number
  onQtyChange: (v: number) => void
}) {
  const u    = URGENCIA[item.urgencia]
  const Icon = u.icon
  const totalStr = item.preco_tabela > 0
    ? (item.preco_tabela * qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null
  const sparkData = fillMeses(item.historico_mensal ?? [])

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'grid', gridTemplateColumns: '28px 1fr auto',
        gap: 10, alignItems: 'start',
        padding: '11px 14px',
        borderBottom: `1px solid ${G.border}`,
        background: selected ? G.mustard + '18' : 'transparent',
        cursor: 'pointer', transition: 'background .12s',
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
        border: selected ? 'none' : `2px solid ${G.border}`,
        background: selected ? G.mustard : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ fontSize: 12, fontWeight: 900, color: G.text }}>✓</span>}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        {/* Linha 1: código + badge urgência */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: G.text, letterSpacing: 0.5 }}>
            {item.ite_produto}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: u.bg, color: u.color, flexShrink: 0,
          }}>
            <Icon size={8} />
            {u.label} · {item.dias_sem_compra}d
          </span>
        </div>
        {/* Linha 2: nome + embalagem */}
        <div style={{ fontSize: 10, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
          {item.nome_produto}{item.pro_embalagem ? ` · Emb: ${item.pro_embalagem}` : ''}
        </div>
        {/* Linha 3: sparkline + metadados */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkline data={sparkData} color={u.color === '#991B1B' ? '#16A34A' : '#16A34A'} />
          <span style={{ fontSize: 9, color: G.muted, whiteSpace: 'nowrap' }}>
            {item.frequencia}x · méd {Math.round(item.media_quantidade)}un
            {item.preco_tabela > 0 && (
              <span style={{ color: '#16A34A', fontWeight: 700, marginLeft: 6 }}>
                {item.preco_tabela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Qty + total */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
        <input
          type="number" min={1} value={qty}
          onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            width: 60, padding: '4px 6px', borderRadius: 6, textAlign: 'center',
            border: `1.5px solid ${selected ? G.mustard : G.border}`,
            fontSize: 13, fontWeight: 700, color: G.text,
            background: selected ? G.mustard + '20' : '#fff', outline: 'none',
          }}
        />
        {totalStr && selected && (
          <span style={{ fontSize: 9, color: '#16A34A', fontWeight: 700 }}>= {totalStr}</span>
        )}
      </div>
    </div>
  )
}

// ─── IrisPanel ─────────────────────────────────────────────────────────────────
export default function IrisPanel({ clienteId, clienteNome, industriaId, industriaNome, tabelaId, onClose, onNewOrder }: Props) {
  const [tab, setTab] = useState<Tab>('recomprar')

  // — Recomprar state
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [totalPedidos, setTotalPedidos] = useState(0)

  // — IRIS Analisa state
  const [irisResult, setIrisResult] = useState<{
    raio_x: string
    oportunidade_principal: string
    alertas: string[]
    argumentos: string[]
    frase_abertura: string
  } | null>(null)
  const [irisLoading, setIrisLoading] = useState(false)
  const [irisError, setIrisError] = useState<string | null>(null)
  const [copiedFrase, setCopiedFrase] = useState(false)
  const [showCriticos, setShowCriticos] = useState(true)
  const [showParados, setShowParados] = useState(false)

  // — Expandir Mix state
  const [mixItems, setMixItems] = useState<MixItem[]>([])
  const [mixLoading, setMixLoading] = useState(false)
  const [mixLoaded, setMixLoaded] = useState(false)
  const [mixSearch, setMixSearch] = useState('')
  const [mixSelected, setMixSelected] = useState<Set<string>>(new Set())
  const [mixQtys, setMixQtys] = useState<Record<string, number>>({})

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({
      clienteId: String(clienteId),
      industriaId: String(industriaId),
      ...(tabelaId ? { tabelaId } : {}),
    })
    api.get(`/orders/smart-suggestions?${p}`)
      .then(r => {
        const data: Suggestion[] = r.data.data ?? []
        setTotalPedidos(r.data.meta?.total_pedidos ?? 0)
        setItems(data)
        // Pré-seleciona itens críticos e pre-preenche qtd com média histórica
        const initSel = new Set<string>()
        const initQty: Record<string, number> = {}
        data.forEach(it => {
          initQty[it.ite_produto] = Math.round(it.media_quantidade) || 1
          if (it.urgencia === 'critica') initSel.add(it.ite_produto)
        })
        setSelected(initSel)
        setQtys(initQty)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clienteId, industriaId, tabelaId])

  useEffect(() => { load() }, [load])

  const loadMix = useCallback(() => {
    setMixLoading(true)
    const p = new URLSearchParams({
      clienteId: String(clienteId),
      industriaId: String(industriaId),
      ...(tabelaId ? { tabelaId } : {}),
    })
    api.get(`/orders/expand-mix?${p}`)
      .then(r => {
        const data: MixItem[] = r.data.data ?? []
        setMixItems(data)
        const initQty: Record<string, number> = {}
        data.forEach(it => { initQty[it.ite_produto] = 1 })
        setMixQtys(initQty)
        setMixLoaded(true)
      })
      .catch(() => {})
      .finally(() => setMixLoading(false))
  }, [clienteId, industriaId, tabelaId])

  // Carrega mix quando a aba é acessada pela primeira vez
  useEffect(() => {
    if (tab === 'mix' && !mixLoaded) loadMix()
  }, [tab, mixLoaded, loadMix])

  const runIrisAnalisa = () => {
    setIrisLoading(true)
    setIrisError(null)
    api.post('/orders/iris-analisa', {
      clienteId, industriaId, clienteNome, industriaNome,
      ...(tabelaId ? { tabelaId } : {}),
    })
      .then(r => setIrisResult(r.data.analise))
      .catch(e => setIrisError(e?.response?.data?.message || 'Erro ao gerar análise.'))
      .finally(() => setIrisLoading(false))
  }

  const copyFrase = () => {
    if (!irisResult?.frase_abertura) return
    navigator.clipboard.writeText(irisResult.frase_abertura)
    setCopiedFrase(true)
    setTimeout(() => setCopiedFrase(false), 2000)
  }

  const toggle = (cod: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(cod)) next.delete(cod); else next.add(cod)
      return next
    })
  }

  const filtered = items.filter(it =>
    !search
    || it.nome_produto.toLowerCase().includes(search.toLowerCase())
    || it.ite_produto.toLowerCase().includes(search.toLowerCase())
  )

  const criticas  = items.filter(i => i.urgencia === 'critica').length
  const altas     = items.filter(i => i.urgencia === 'alta').length
  const totalSel  = selected.size
  const emRisco   = items
    .filter(i => i.urgencia === 'critica')
    .reduce((s, i) => s + i.preco_tabela * (i.media_quantidade || 1), 0)

  const totalValue = Array.from(selected).reduce((sum, cod) => {
    const it = items.find(i => i.ite_produto === cod)
    if (!it || it.preco_tabela <= 0) return sum
    return sum + it.preco_tabela * (qtys[cod] || 1)
  }, 0)

  const mixFiltered = mixItems.filter(it =>
    !mixSearch
    || it.nome_produto.toLowerCase().includes(mixSearch.toLowerCase())
    || it.ite_produto.toLowerCase().includes(mixSearch.toLowerCase())
  )
  const mixTotalSel = mixSelected.size
  const mixTotalValue = Array.from(mixSelected).reduce((sum, cod) => {
    const it = mixItems.find(i => i.ite_produto === cod)
    if (!it || it.preco_tabela <= 0) return sum
    return sum + it.preco_tabela * (mixQtys[cod] || 1)
  }, 0)
  const toggleMix = (cod: string) => {
    setMixSelected(prev => {
      const next = new Set(prev)
      if (next.has(cod)) next.delete(cod); else next.add(cod)
      return next
    })
  }

  const exportExcel = () => {
    const slug = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').trim()
    if (tab === 'recomprar') {
      const data = filtered.map(it => ({
        'Código':           it.ite_produto,
        'Produto':          it.nome_produto,
        'Embalagem':        it.pro_embalagem ?? '',
        'Frequência':       it.frequencia,
        'Última Compra':    it.ultima_compra?.slice(0, 10).split('-').reverse().join('/') ?? '',
        'Dias Sem Compra':  it.dias_sem_compra,
        'Qtd Média':        it.media_quantidade,
        'Qtd Últ. Pedido':  it.ultima_quantidade,
        'Preço Tabela':     it.preco_tabela,
        'Urgência':         URGENCIA[it.urgencia].label,
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      ws['!cols'] = [
        { wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 11 },
        { wch: 13 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
        { wch: 14 }, { wch: 10 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Recomprar')
      XLSX.writeFile(wb, `recomprar-${slug(clienteNome)}-${slug(industriaNome)}.xlsx`)
    } else {
      const data = mixFiltered.map(it => ({
        'Código':              it.ite_produto,
        'Produto':             it.nome_produto,
        'Embalagem':           it.pro_embalagem ?? '',
        'Preço Tabela':        it.preco_tabela,
        'Clientes':            it.total_clientes,
        'Pedidos na Carteira': it.total_pedidos,
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      ws['!cols'] = [
        { wch: 14 }, { wch: 50 }, { wch: 14 },
        { wch: 14 }, { wch: 10 }, { wch: 20 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Expandir Mix')
      XLSX.writeFile(wb, `mix-${slug(clienteNome)}-${slug(industriaNome)}.xlsx`)
    }
  }

  const panel = (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
      background: G.card, borderLeft: `1px solid ${G.border}`,
      boxShadow: '-8px 0 32px rgba(0,0,0,.12)',
      display: 'flex', flexDirection: 'column', zIndex: 2000,
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px 0',
        background: 'linear-gradient(135deg, #1E2D3A 0%, #28374A 100%)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'linear-gradient(135deg, #1A2D42, #28374A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IrisAvatar size={26} animated />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E1D4', letterSpacing: 0.3 }}>IRIS</div>
                <div style={{ fontSize: 10, color: '#A8B8C4' }}>Assistente de Inteligência Comercial</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#A8B8C4', marginTop: 2 }}>
              <span style={{ color: '#E8E1D4', fontWeight: 700 }}>{clienteNome}</span>
              <span style={{ margin: '0 6px' }}>·</span>
              <span>{industriaNome}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#A8B8C4' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {([
            { key: 'recomprar', label: 'Recomprar',    icon: History,    count: items.length },
            { key: 'mix',       label: 'Expandir Mix', icon: TrendingUp, count: mixLoaded ? mixItems.length : null },
            { key: 'iris',      label: 'IRIS Analisa', icon: Sparkles,   count: null },
          ] as const).map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              background: tab === key ? G.card : 'transparent',
              color: tab === key ? G.text : '#A8B8C4',
              transition: 'all .15s',
            }}>
              <Icon size={13} />
              {label}
              {count !== null && count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, minWidth: 18, height: 18,
                  borderRadius: 9, background: tab === key ? G.text : '#A8B8C480',
                  color: tab === key ? G.card : G.text,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ─── Aba Recomprar ─── */}
        {tab === 'recomprar' && (
          <>
            {/* Summary strip */}
            {!loading && items.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
                {[
                  { label: 'CRÍTICOS',   value: criticas,    color: '#991B1B' },
                  { label: 'ATENÇÃO',    value: altas,       color: '#92400E' },
                  { label: 'EM RISCO',   value: emRisco > 0 ? emRisco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) : '—', color: '#16A34A' },
                  { label: 'PRODUTOS',   value: items.length, color: G.text },
                ].map(({ label, value, color }, idx) => (
                  <div key={label} style={{
                    padding: '10px 8px', textAlign: 'center',
                    borderRight: idx < 3 ? `1px solid ${G.border}` : 'none',
                  }}>
                    <div style={{ fontSize: label === 'EM RISCO' ? 13 : 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
                    <div style={{ fontSize: 9, color: G.muted, marginTop: 2, fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* IRIS Narrative Strip */}
            {!loading && items.length > 0 && (
              <IrisNarrativeStrip
                tipo="recomprar"
                clienteNome={clienteNome}
                industriaNome={industriaNome}
                summaryData={{
                  criticos: criticas,
                  emRisco,
                  topProdutoCodigo: items[0]?.ite_produto,
                  topProdutoNome:   items[0]?.nome_produto,
                  diasSemCompra:    items[0]?.dias_sem_compra,
                  frequenciaTotal:  totalPedidos,
                }}
              />
            )}

            {/* Data source info */}
            {!loading && items.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 14px', background: '#EFF6FF',
                borderBottom: `1px solid #BFDBFE`, flexShrink: 0,
              }}>
                <Info size={13} style={{ color: '#1D4ED8', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#1E40AF', lineHeight: 1.5 }}>
                  {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} (P/F) · produtos parados há 30+ dias
                </span>
              </div>
            )}

            {/* Search */}
            {!loading && items.length > 0 && (
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${G.border}`, flexShrink: 0, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: G.bg, borderRadius: 8, padding: '6px 10px' }}>
                  <Search size={13} color={G.muted} />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar produto..."
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: G.text }}
                  />
                  {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={12} /></button>}
                </div>
              </div>
            )}

            {/* List */}
            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.muted }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${G.border}`, borderTopColor: G.mustard, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Analisando histórico...</span>
              </div>
            ) : items.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: G.muted, padding: 32 }}>
                <Package size={40} style={{ opacity: 0.25 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 6 }}>Nenhuma recompra identificada</div>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    Todos os produtos foram comprados recentemente ou este cliente ainda não tem histórico com esta indústria.
                  </div>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.muted, fontSize: 13 }}>
                Nenhum produto encontrado.
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                {/* Selecionar todos / nenhum */}
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 12, background: G.bg }}>
                  <button onClick={() => setSelected(new Set(filtered.map(i => i.ite_produto)))}
                    style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Selecionar todos
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Limpar seleção
                  </button>
                  <button onClick={load}
                    style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RotateCcw size={10} /> Atualizar
                  </button>
                </div>
                {filtered.map(item => (
                  <SuggestionRow
                    key={item.ite_produto}
                    item={item}
                    selected={selected.has(item.ite_produto)}
                    onToggle={() => toggle(item.ite_produto)}
                    qty={qtys[item.ite_produto] ?? 1}
                    onQtyChange={v => setQtys(prev => ({ ...prev, [item.ite_produto]: v }))}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Aba Expandir Mix ─── */}
        {tab === 'mix' && (
          <>
            {/* Summary strip Mix */}
            {!mixLoading && mixItems.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
                {[
                  { label: 'DISPONÍVEIS', value: mixItems.length,                                            color: G.text },
                  { label: 'POPULARES',   value: mixItems.filter(i => i.total_clientes >= 20).length,        color: '#15803D' },
                  { label: 'EM ALTA',     value: mixItems.filter(i => i.total_clientes >= 5 && i.total_clientes < 20).length, color: '#0F766E' },
                  { label: 'SELECIONADOS',value: mixTotalSel,                                                color: G.text },
                ].map(({ label, value, color }, idx) => (
                  <div key={label} style={{ padding: '10px 8px', textAlign: 'center', borderRight: idx < 3 ? `1px solid ${G.border}` : 'none' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
                    <div style={{ fontSize: 9, color: G.muted, marginTop: 2, fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* IRIS Narrative Strip Mix */}
            {!mixLoading && mixItems.length > 0 && (
              <IrisNarrativeStrip
                tipo="mix"
                clienteNome={clienteNome}
                industriaNome={industriaNome}
                summaryData={{
                  totalDisponiveis:  mixItems.length,
                  topProdutosNomes:  mixItems.slice(0, 3).map(i => i.nome_produto),
                  penetracaoPct:     Math.round((mixItems[0]?.total_clientes ?? 0) / Math.max(...mixItems.map(i => i.total_clientes), 1) * 100),
                }}
              />
            )}

            {/* Info banner */}
            {!mixLoading && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 14px', background: '#F0FDF4',
                borderBottom: `1px solid #BBF7D0`, flexShrink: 0,
              }}>
                <TrendingUp size={13} style={{ color: '#15803D', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#166534', lineHeight: 1.5 }}>
                  Produtos nunca comprados, ordenados pelos mais vendidos na carteira.
                </span>
              </div>
            )}

            {/* Search */}
            {!mixLoading && mixItems.length > 0 && (
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${G.border}`, flexShrink: 0, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: G.bg, borderRadius: 8, padding: '6px 10px' }}>
                  <Search size={13} color={G.muted} />
                  <input
                    value={mixSearch} onChange={e => setMixSearch(e.target.value)}
                    placeholder="Buscar produto..."
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: G.text }}
                  />
                  {mixSearch && <button onClick={() => setMixSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={12} /></button>}
                </div>
              </div>
            )}

            {/* List */}
            {mixLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.muted }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${G.border}`, borderTopColor: '#15803D', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Mapeando portfólio...</span>
              </div>
            ) : mixItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: G.muted, padding: 32 }}>
                <Package size={40} style={{ opacity: 0.25 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 6 }}>Mix completo!</div>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    Este cliente já comprou todos os produtos disponíveis nesta tabela.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 12, alignItems: 'center', background: G.bg }}>
                  <button onClick={() => setMixSelected(new Set(mixFiltered.map(i => i.ite_produto)))}
                    style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Selecionar todos
                  </button>
                  <button onClick={() => setMixSelected(new Set())}
                    style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Limpar seleção
                  </button>
                  <button onClick={loadMix}
                    style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RotateCcw size={10} /> Atualizar
                  </button>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: G.muted }}>{mixFiltered.length} produtos</span>
                </div>
                {mixFiltered.map(item => (
                  <MixRow
                    key={item.ite_produto}
                    item={item}
                    selected={mixSelected.has(item.ite_produto)}
                    onToggle={() => toggleMix(item.ite_produto)}
                    qty={mixQtys[item.ite_produto] ?? 1}
                    onQtyChange={v => setMixQtys(prev => ({ ...prev, [item.ite_produto]: v }))}
                    maxClientes={Math.max(...mixItems.map(i => i.total_clientes), 1)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Aba IRIS Analisa ─── */}
        {tab === 'iris' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

            {/* Estado inicial — botão de análise */}
            {!irisResult && !irisLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 22,
                  background: 'linear-gradient(135deg, #FFD200 0%, #F59E0B 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 12px 32px #FFD20050',
                }}>
                  <Sparkles size={36} style={{ color: '#28374A' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: G.text, marginBottom: 6 }}>IRIS Analisa</div>
                  <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.7, maxWidth: 320 }}>
                    Análise estratégica com IA baseada no histórico real de pedidos: raio-x do cliente, alertas de mix, argumentos de venda e frase de abertura personalizada.
                  </div>
                </div>
                {irisError && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#991B1B', maxWidth: 320, textAlign: 'center' }}>
                    ⚠ {irisError}
                  </div>
                )}
                <button
                  onClick={runIrisAnalisa}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #FFD200, #F59E0B)',
                    fontSize: 13, fontWeight: 800, color: G.text,
                    boxShadow: '0 6px 20px #FFD20060',
                  }}
                >
                  <Zap size={15} />
                  Analisar com IRIS
                </button>
              </div>
            )}

            {/* Loading */}
            {irisLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 60, height: 60 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #FFD20030', borderTopColor: G.mustard, animation: 'spin 1s linear infinite' }} />
                  <div style={{
                    position: 'absolute', inset: 8, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFD200, #F59E0B)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={18} style={{ color: G.text }} />
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>IRIS está analisando...</div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>Cruzando histórico de pedidos e mix de produtos</div>
                </div>
              </div>
            )}

            {/* Resultado */}
            {irisResult && !irisLoading && (
              <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Raio-X */}
                <div style={{
                  background: 'linear-gradient(135deg, #1E2D3A 0%, #28374A 100%)',
                  borderRadius: 14, padding: '16px 18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <BarChart2 size={14} style={{ color: G.mustard }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.8 }}>Raio-X do Cliente</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#C8D8E4', lineHeight: 1.65, margin: 0 }}>
                    {irisResult.raio_x}
                  </p>
                </div>

                {/* Oportunidade principal */}
                <div style={{
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <Target size={15} style={{ color: '#15803D', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Oportunidade Principal</div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: 0, lineHeight: 1.5 }}>
                      {irisResult.oportunidade_principal}
                    </p>
                  </div>
                </div>

                {/* Alertas */}
                {irisResult.alertas?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Alertas</div>
                    {irisResult.alertas.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        background: '#FEF2F2', border: '1px solid #FECACA',
                        borderRadius: 9, padding: '9px 12px',
                      }}>
                        <AlertTriangle size={13} style={{ color: '#DC2626', marginTop: 1, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Produtos críticos e parados — usando dados já carregados da aba Recomprar */}
                {items.length > 0 && (() => {
                  const criticos = items.filter(i => i.urgencia === 'critica')
                  const parados  = items.filter(i => i.urgencia !== 'critica')
                  const fmtDate  = (d: string) => d?.slice(0, 10).split('-').reverse().join('/')
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Produtos Identificados
                      </div>

                      {/* Críticos */}
                      {criticos.length > 0 && (
                        <div style={{ border: '1px solid #FECACA', borderRadius: 10, overflow: 'hidden' }}>
                          <button
                            onClick={() => setShowCriticos(v => !v)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 12px', background: '#FEF2F2', border: 'none', cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <AlertTriangle size={13} style={{ color: '#DC2626' }} />
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#991B1B' }}>
                                {criticos.length} produto{criticos.length > 1 ? 's' : ''} CRÍTICOS — sem compra há 120+ dias
                              </span>
                            </div>
                            <ChevronDown size={13} style={{ color: '#DC2626', transform: showCriticos ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                          </button>
                          {showCriticos && (
                            <div style={{ background: '#fff' }}>
                              {criticos.map(it => (
                                <div key={it.ite_produto} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  gap: 8, padding: '8px 12px', borderTop: '1px solid #FEE2E2',
                                }}>
                                  <div style={{ minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: G.text, display: 'block' }}>{it.ite_produto}</span>
                                    <span style={{ fontSize: 10, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{it.nome_produto}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{it.dias_sem_compra}d · {fmtDate(it.ultima_compra)}</span>
                                </div>
                              ))}
                              <div style={{ padding: '8px 12px', borderTop: '1px solid #FEE2E2', textAlign: 'right' }}>
                                <button onClick={() => setTab('recomprar')} style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                  Ver na aba Recomprar →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parados (alta + atenção) */}
                      {parados.length > 0 && (
                        <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
                          <button
                            onClick={() => setShowParados(v => !v)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 12px', background: G.bg, border: 'none', cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Clock size={13} style={{ color: '#92400E' }} />
                              <span style={{ fontSize: 12, fontWeight: 800, color: G.text }}>
                                {parados.length} produto{parados.length > 1 ? 's' : ''} parados — sem recompra há 30+ dias
                              </span>
                            </div>
                            <ChevronDown size={13} style={{ color: G.muted, transform: showParados ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                          </button>
                          {showParados && (
                            <div style={{ background: '#fff' }}>
                              {parados.map(it => (
                                <div key={it.ite_produto} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  gap: 8, padding: '8px 12px', borderTop: `1px solid ${G.border}`,
                                }}>
                                  <div style={{ minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: G.text, display: 'block' }}>{it.ite_produto}</span>
                                    <span style={{ fontSize: 10, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{it.nome_produto}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: '#92400E', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{it.dias_sem_compra}d · {fmtDate(it.ultima_compra)}</span>
                                </div>
                              ))}
                              <div style={{ padding: '8px 12px', borderTop: `1px solid ${G.border}`, textAlign: 'right' }}>
                                <button onClick={() => setTab('recomprar')} style={{ fontSize: 11, color: G.text, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                  Ver na aba Recomprar →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Argumentos de venda */}
                {irisResult.argumentos?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Argumentos de Venda</div>
                    {irisResult.argumentos.map((arg, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: '#fff', border: `1px solid ${G.border}`,
                        borderRadius: 9, padding: '9px 12px',
                      }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          background: G.mustard, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 900, color: G.text,
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 12, color: G.text, lineHeight: 1.55 }}>{arg}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Frase de abertura */}
                {irisResult.frase_abertura && (
                  <div style={{
                    background: 'linear-gradient(135deg, #FFF7E0, #FFFBEB)',
                    border: `1px solid ${G.mustard}80`, borderRadius: 12, padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={13} style={{ color: '#92400E' }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.8 }}>Frase de Abertura</span>
                      </div>
                      <button
                        onClick={copyFrase}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 6, border: `1px solid ${G.mustard}`,
                          background: copiedFrase ? G.mustard : 'transparent',
                          fontSize: 10, fontWeight: 700, color: '#92400E', cursor: 'pointer',
                          transition: 'all .15s',
                        }}
                      >
                        {copiedFrase ? <Check size={11} /> : <Copy size={11} />}
                        {copiedFrase ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                      "{irisResult.frase_abertura}"
                    </p>
                  </div>
                )}

                {/* Refazer */}
                <button
                  onClick={runIrisAnalisa}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 0', borderRadius: 9, border: `1px solid ${G.border}`,
                    background: 'transparent', fontSize: 11, fontWeight: 700,
                    color: G.muted, cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={12} /> Gerar nova análise
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {(tab === 'recomprar' || tab === 'mix') && (() => {
        const isMix = tab === 'mix'
        const isLoadingFooter = isMix ? mixLoading : loading
        const sel  = isMix ? mixTotalSel   : totalSel
        const val  = isMix ? mixTotalValue : totalValue
        if (isLoadingFooter) return null
        return (
          <div style={{
            padding: '14px 20px', borderTop: `1px solid ${G.border}`,
            background: '#fff', flexShrink: 0,
          }}>
            {sel > 0 && val > 0 && (
              <div style={{ fontSize: 12, color: G.muted, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span>{sel} produto{sel > 1 ? 's' : ''} selecionado{sel > 1 ? 's' : ''}</span>
                <span style={{ fontWeight: 700, color: '#16A34A' }}>
                  Total estimado: {val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            <button
              onClick={exportExcel}
              disabled={isMix ? mixFiltered.length === 0 : filtered.length === 0}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0', borderRadius: 9, border: `1px solid ${G.border}`,
                background: 'transparent', fontSize: 12, fontWeight: 700,
                color: G.muted, cursor: 'pointer', marginBottom: 8,
              }}
            >
              <Download size={13} /> Exportar Excel
            </button>
            <button
              onClick={() => onNewOrder(clienteId, industriaId)}
              disabled={sel === 0}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0', borderRadius: 10, border: 'none', cursor: sel === 0 ? 'not-allowed' : 'pointer',
                background: sel === 0 ? G.border : isMix
                  ? 'linear-gradient(135deg, #15803D, #0F766E)'
                  : 'linear-gradient(135deg, #28374A, #1E2D3A)',
                color: sel === 0 ? G.muted : '#E8E1D4',
                fontSize: 13, fontWeight: 800, letterSpacing: 0.3,
                transition: 'opacity .15s',
              }}
            >
              <ShoppingCart size={15} />
              {sel === 0 ? 'Selecione produtos para criar pedido' : `Criar Pedido com ${sel} produto${sel > 1 ? 's' : ''}`}
              {sel > 0 && <ChevronRight size={15} />}
            </button>
          </div>
        )
      })()}
    </div>
  )

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 1999 }}
      />
      {panel}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  )
}
