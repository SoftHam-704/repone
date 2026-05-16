import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ShoppingBag, Building2, ChevronLeft, ChevronRight, AlertTriangle,
  Package, TrendingUp, Calendar, Hash, FileText, Send, RefreshCw,
  CheckCircle, Clock, Info, BarChart2, Star, Lightbulb,
} from 'lucide-react';
import QuickActionModal from './QuickActionModal';

const G = {
  bg: '#E8E1D4',
  card: '#FFFFFF',
  border: '#D6CDB8',
  text: '#28374A',
  muted: '#7A8899',
  mustard: '#FFD200',
  navy: '#1E2D3D',
  navyLight: '#28374A',
  surface: '#FDFBF7',
  green: '#059669',
  greenBg: '#D1FAE5',
  blue: '#1D4ED8',
  blueBg: '#DBEAFE',
  amber: '#92400E',
  amberBg: '#FEF3C7',
  purple: '#6D28D9',
  purpleBg: '#EDE9FE',
  red: '#DC2626',
  redBg: '#FEE2E2',
};

const MONO = '"SF Mono", ui-monospace, "Cascadia Mono", "Roboto Mono", Menlo, monospace';

const BASE = import.meta.env.VITE_API_URL || '';

const SIT: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  P: { label: 'Em Pedido', color: G.blue,   bg: G.blueBg,   dot: '#3B82F6' },
  F: { label: 'Faturado',  color: G.green,  bg: G.greenBg,  dot: '#10B981' },
  C: { label: 'Cotação',   color: G.amber,  bg: G.amberBg,  dot: '#F59E0B' },
  B: { label: 'Bloqueado', color: G.purple, bg: G.purpleBg, dot: '#8B5CF6' },
};

interface Pedido {
  ped_codigo: number;
  ped_pedido: string;
  ped_oc: string | null;
  ped_pedcli: string | null;
  ped_data: string;
  ped_situacao: string;
  ped_totalped: string;
  industria_nome: string;
}

interface ItensCotacao {
  ite_seq: number;
  ite_produto: string;
  ite_nomeprod: string;
  ite_embuch: string | null;
  ite_quant: number;
  ite_puni: number;
  ite_puniliq: number;
  ite_totliquido: number;
  found: boolean;
}

interface Policy {
  tabela: string | null;
  comprador: string | null;
  frete: string | null;
  prazo: string | null;
  transportadora: string | null;
  descontos: number[];
}

interface Cliente { codigo: number; nome: string; cidade: string; uf: string; }
interface Industria { id: number; nome: string; }

interface InsightProduto {
  codigo: string;
  nome: string;
  ultima_compra?: string;
  total_comprado?: string;
  num_clientes?: string;
}

interface InsightData {
  mensal: Array<{ mes: string; total: string }>;
  esquecidos: InsightProduto[];
  topProdutos: InsightProduto[];
  sugestoes: InsightProduto[];
  ultimoPedidoItens: Array<{ codigo: string; nome: string; quantidade: number }>;
  diasUltimoPedido: number | null;
}

function fmtDate(d: string) {
  if (!d) return '—';
  return d.slice(0, 10).split('-').reverse().join('/');
}

function fmtMoney(v: string | number) {
  return (parseFloat(String(v)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function oc(p: Pedido) { return p.ped_oc || p.ped_pedcli || null; }

function getLast6Months(): Array<{ key: string; label: string }> {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    months.push({ key, label });
  }
  return months;
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function PortalLojista() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('t') || '';
  const schema = params.get('s') || '';

  const [status, setStatus]         = useState<'loading' | 'ok' | 'error'>('loading');
  const [errMsg, setErrMsg]         = useState('');
  const [cliente, setCliente]       = useState<Cliente | null>(null);
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [industria, setIndustria]   = useState('0');
  const [activeTab, setActiveTab]   = useState<'pedidos' | 'cotar' | 'insights'>('insights');
  const [globalStats, setGlobalStats] = useState<{ total_pedidos: number; total_faturado: number } | null>(null);

  // Pedidos
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [loadingPed, setLoadingPed] = useState(false);

  // Cotação
  const [policy, setPolicy]               = useState<Policy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [rawCodes, setRawCodes]           = useState('');
  const [sending, setSending]             = useState(false);
  const [cotacaoId, setCotacaoId]         = useState<number | null>(null);
  const [cotacaoStatus, setCotacaoStatus] = useState<'pendente' | 'pronta' | 'confirmada' | null>(null);
  const [cotacaoItens, setCotacaoItens]   = useState<ItensCotacao[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [sendError, setSendError]         = useState('');
  const [adicionando, setAdicionando]     = useState(false);
  const [moreRawCodes, setMoreRawCodes]   = useState('');
  const [addSending, setAddSending]       = useState(false);
  const [addError, setAddError]           = useState('');
  const [confirming, setConfirming]       = useState(false);

  // Insights
  const [insights, setInsights]             = useState<InsightData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Quick actions modal
  const [quickModal, setQuickModal]           = useState<null | 'mix' | 'esquecidos' | 'catalogo'>(null);
  const insightsIndustriaRef                  = useRef<string>('0');

  const LIMIT      = 50;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Validação do token
  useEffect(() => {
    if (!token || !schema) { setStatus('error'); setErrMsg('Link inválido ou incompleto.'); return; }
    fetch(`${BASE}/api/portal-pub/validate?t=${encodeURIComponent(token)}&s=${encodeURIComponent(schema)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setStatus('error'); setErrMsg(d.message || 'Acesso negado.'); return; }
        setCliente(d.cliente);
        setGlobalStats(d.stats || null);
        const inds = d.industrias || [];
        setIndustrias(inds);
        if (inds.length === 1) setIndustria(String(inds[0].id));
        setStatus('ok');
      })
      .catch(() => { setStatus('error'); setErrMsg('Erro ao conectar. Tente novamente.'); });
  }, [token, schema]);

  // Carrega pedidos
  const loadPedidos = useCallback(async () => {
    if (!token || !schema || industria === '0') return;
    setLoadingPed(true);
    try {
      const qs = new URLSearchParams({ t: token, s: schema, industria, page: String(page) });
      const r  = await fetch(`${BASE}/api/portal-pub/orders?${qs}`);
      const d  = await r.json();
      if (d.success) { setPedidos(d.data || []); setTotal(d.pagination?.total || 0); }
    } catch { /* silent */ }
    finally { setLoadingPed(false); }
  }, [token, schema, industria, page]);

  useEffect(() => {
    if (status === 'ok' && industria !== '0') loadPedidos();
  }, [status, industria, page]);

  // Carrega política ao selecionar indústria na aba Cotar
  useEffect(() => {
    if (status !== 'ok' || industria === '0' || activeTab !== 'cotar') return;
    setLoadingPolicy(true);
    setPolicy(null);
    fetch(`${BASE}/api/portal-pub/policy?t=${encodeURIComponent(token)}&s=${encodeURIComponent(schema)}&industria=${industria}`)
      .then(r => r.json())
      .then(d => { if (d.success) setPolicy(d.policy); })
      .catch(() => {})
      .finally(() => setLoadingPolicy(false));
  }, [status, industria, activeTab]);

  // Carrega insights ao entrar na aba Painel
  const loadInsights = useCallback(async () => {
    if (!token || !schema || industria === '0') return;
    setLoadingInsights(true);
    setInsights(null);
    try {
      const qs = new URLSearchParams({ t: token, s: schema, industria });
      const r = await fetch(`${BASE}/api/portal-pub/insights?${qs}`);
      const d = await r.json();
      if (d.success) setInsights({
        mensal: d.mensal,
        esquecidos: d.esquecidos,
        topProdutos: d.topProdutos,
        sugestoes: d.sugestoes,
        ultimoPedidoItens: d.ultimoPedidoItens || [],
        diasUltimoPedido: d.diasUltimoPedido ?? null,
      });
    } catch { /* silent */ }
    finally { setLoadingInsights(false); }
  }, [token, schema, industria]);

  useEffect(() => {
    if (status === 'ok' && (activeTab === 'insights' || activeTab === 'cotar') && industria !== '0') {
      if (insightsIndustriaRef.current !== industria) {
        insightsIndustriaRef.current = industria;
        loadInsights();
      }
    }
  }, [status, activeTab, industria]);

  // Troca de indústria: reset tudo
  const handleIndustriaChange = (val: string) => {
    setIndustria(val);
    setPage(1);
    setCotacaoId(null);
    setCotacaoStatus(null);
    setCotacaoItens([]);
    setRawCodes('');
    setPolicy(null);
    setSendError('');
    setAdicionando(false);
    setMoreRawCodes('');
    setAddError('');
    setInsights(null);
  };

  // Pré-popula cotação a partir dos insights
  const adicionarAoCotacao = (codigo: string) => {
    setActiveTab('cotar');
    if (!cotacaoId) {
      setRawCodes(prev => prev ? `${prev}\n${codigo}` : codigo);
    } else {
      setAdicionando(true);
      setMoreRawCodes(prev => prev ? `${prev}\n${codigo}` : codigo);
    }
  };

  // Adicionar mais itens à cotação existente
  const adicionarItens = async () => {
    if (!moreRawCodes.trim() || !cotacaoId) return;
    setAddSending(true);
    setAddError('');
    try {
      const r = await fetch(`${BASE}/api/portal-pub/cotacao/${cotacaoId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, s: schema, rawCodes: moreRawCodes }),
      });
      const d = await r.json();
      if (d.success) {
        setCotacaoItens(prev => [...prev, ...(d.itens || [])]);
        setMoreRawCodes('');
        setAdicionando(false);
      } else {
        setAddError(d.message || 'Erro ao adicionar itens.');
      }
    } catch {
      setAddError('Erro de conexão. Tente novamente.');
    } finally {
      setAddSending(false);
    }
  };

  // Confirmar cotação
  const confirmarCotacao = async () => {
    if (!cotacaoId) return;
    setConfirming(true);
    try {
      const r = await fetch(`${BASE}/api/portal-pub/cotacao/${cotacaoId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, s: schema }),
      });
      const d = await r.json();
      if (d.success) setCotacaoStatus('confirmada');
    } catch { /* silent */ }
    finally { setConfirming(false); }
  };

  function handleQuickConfirm(items: { codigo: string; quantidade: number }[]) {
    const linhas = items.map(i => `${i.codigo} x${i.quantidade}`).join('\n');
    setRawCodes(prev => prev.trim() ? prev.trim() + '\n' + linhas : linhas);
    setQuickModal(null);
  }

  // Enviar cotação
  const enviarCotacao = async () => {
    if (!rawCodes.trim() || industria === '0') return;
    setSending(true);
    setSendError('');
    try {
      const r = await fetch(`${BASE}/api/portal-pub/cotacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, s: schema, industria, rawCodes }),
      });
      const d = await r.json();
      if (d.success) {
        setCotacaoId(d.ped_numero);
        setCotacaoStatus('pronta');
        setCotacaoItens(d.itens || []);
      } else {
        setSendError(d.message || 'Erro ao enviar cotação.');
      }
    } catch {
      setSendError('Erro de conexão. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  // Refresh do status da cotação
  const refreshCotacao = async () => {
    if (!cotacaoId) return;
    setRefreshing(true);
    try {
      const r = await fetch(`${BASE}/api/portal-pub/cotacao/${cotacaoId}?t=${encodeURIComponent(token)}&s=${encodeURIComponent(schema)}`);
      const d = await r.json();
      if (d.success) {
        setCotacaoStatus(d.status);
        setCotacaoItens(d.itens || []);
      }
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  };

  // Nova cotação
  const novaCotacao = () => {
    setCotacaoId(null);
    setCotacaoStatus(null);
    setCotacaoItens([]);
    setRawCodes('');
    setAdicionando(false);
    setMoreRawCodes('');
    setAddError('');
    setSendError('');
  };

  // ── Loading inicial ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: G.navy, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingBag size={24} color={G.mustard} />
        </div>
        <div style={{ fontSize: 13, color: G.muted, fontWeight: 600 }}>Validando acesso...</div>
      </div>
    );
  }

  // ── Erro ────────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', padding: '40px 32px', background: G.card, borderRadius: 20, border: `1px solid ${G.border}`, maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 56, height: 56, background: '#FEF2F2', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertTriangle size={28} color="#EF4444" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: G.text, marginBottom: 8 }}>Acesso não autorizado</div>
          <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.6 }}>{errMsg}</div>
        </div>
      </div>
    );
  }

  const totalFaturado = pedidos
    .filter(p => p.ped_situacao === 'F')
    .reduce((s, p) => s + (parseFloat(String(p.ped_totalped)) || 0), 0);

  const totalCotacaoLiq = cotacaoItens.reduce((s, i) => s + (i.ite_totliquido || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: G.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: G.navy, paddingBottom: 0, position: 'relative', overflow: 'hidden' }}>
        {/* grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at top right, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top right, black 20%, transparent 70%)',
        }} />
        {/* mustard glow */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,210,0,0.1), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{ width: 28, height: 28, background: G.mustard, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: G.navy, flexShrink: 0 }}>R</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portal do Lojista · <span style={{ color: 'white' }}>RepOne</span></div>
          </div>
        </div>

        <div style={{ padding: '20px 20px 0', position: 'relative' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Olá,</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 1.1 }}>{cliente?.nome}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="10" height="12" viewBox="0 0 12 14" fill="none"><path d="M6 1C3.5 1 1.5 3 1.5 5.5C1.5 9 6 13 6 13S10.5 9 10.5 5.5C10.5 3 8.5 1 6 1Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="6" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.3"/></svg>
            {cliente?.cidade} · {cliente?.uf}
          </div>
        </div>

        {/* KPI strip flutuante */}
        <div style={{ margin: '16px 16px 0', background: G.card, borderRadius: 14, padding: '14px 8px', display: 'grid', gridTemplateColumns: '1fr 1px 1fr', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: `1px solid ${G.border}`, position: 'relative', zIndex: 2 }}>
          <div style={{ padding: '0 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted, marginBottom: 4 }}>Pedidos no período</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: G.text, fontFamily: MONO, letterSpacing: -1 }}>
              {globalStats ? String(globalStats.total_pedidos).padStart(2, '0') : '—'}
            </div>
            <div style={{ fontSize: 10, color: G.muted, marginTop: 2 }}>histórico total</div>
          </div>
          <div style={{ background: G.border }} />
          <div style={{ padding: '0 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted, marginBottom: 4 }}>Faturado total</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: G.navy, fontFamily: MONO, letterSpacing: -0.5 }}>
              {globalStats ? fmtMoney(globalStats.total_faturado) : '—'}
            </div>
            <div style={{ fontSize: 10, color: G.muted, marginTop: 2 }}>acumulado</div>
          </div>
        </div>

        {/* Barra de volta (só nas sub-páginas) */}
        {activeTab !== 'insights' && (
          <div style={{ display: 'flex', padding: '12px 16px 0' }}>
            <button
              onClick={() => setActiveTab('insights')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '7px 12px', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <svg width="11" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5l4 4M1 5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Painel
            </button>
          </div>
        )}
        <div style={{ height: 14 }} />
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px', maxWidth: 680, margin: '0 auto' }}>

        {/* Filtro de indústria */}
        {industrias.length > 0 && (
          <div style={{ background: G.card, borderRadius: 14, border: `1px solid ${G.border}`, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Building2 size={14} color={G.muted} strokeWidth={2} style={{ flexShrink: 0 }} />
            <select
              value={industria}
              onChange={e => handleIndustriaChange(e.target.value)}
              style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '6px 8px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.surface, color: G.text, outline: 'none' }}
            >
              <option value="0">— Selecione a indústria —</option>
              {industrias.map(i => (
                <option key={i.id} value={String(i.id)}>{i.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── ABA: MEUS PEDIDOS ─────────────────────────────────────────────── */}
        {activeTab === 'pedidos' && (
          <>
            {industria === '0' ? (
              <EmptyState icon={<Building2 size={24} color={G.muted} />} title="Selecione uma indústria" sub="Escolha a indústria acima para visualizar seus pedidos." />
            ) : loadingPed ? (
              <Spinner />
            ) : pedidos.length === 0 ? (
              <EmptyState icon={<Package size={24} color={G.muted} />} title="Nenhum pedido encontrado" sub="Tente selecionar outra indústria." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pedidos.map(p => {
                  const sit   = SIT[p.ped_situacao] || { label: p.ped_situacao, color: G.muted, bg: G.bg, dot: G.muted };
                  const ocVal = oc(p);
                  return (
                    <div key={p.ped_codigo} style={{ background: G.card, borderRadius: 16, borderLeft: `4px solid ${sit.dot}`, padding: '14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 20, color: sit.color, background: sit.bg }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sit.dot }} />
                          {sit.label}
                        </span>
                        <span style={{ fontSize: 11, color: G.muted, fontWeight: 600 }}>{p.industria_nome}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                            <Hash size={11} color={G.muted} />
                            <span style={{ fontSize: 16, fontWeight: 900, color: G.text, fontFamily: MONO }}>
                              {String(p.ped_pedido || p.ped_codigo).padStart(6, '0')}
                            </span>
                          </div>
                          {ocVal && <div style={{ fontSize: 11, color: G.muted }}>OC: <strong style={{ color: G.text }}>{ocVal}</strong></div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: G.navy, fontFamily: MONO }}>{fmtMoney(p.ped_totalped)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                            <Calendar size={10} color={G.muted} />
                            <span style={{ fontSize: 11, color: G.muted }}>{fmtDate(p.ped_data)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(page === 1)}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 12, color: G.muted, fontWeight: 700 }}>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)}><ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}

        {/* ── ABA: SOLICITAR COTAÇÃO ────────────────────────────────────────── */}
        {activeTab === 'cotar' && (
          <>
            {industria === '0' ? (
              <EmptyState icon={<Building2 size={24} color={G.muted} />} title="Selecione uma indústria" sub="Escolha a indústria acima para solicitar uma cotação." />
            ) : (
              <>
                {/* Política comercial */}
                {loadingPolicy ? (
                  <Spinner />
                ) : policy ? (
                  <div style={{ background: G.navy, borderRadius: 16, padding: '16px', marginBottom: 16, color: '#fff' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={11} /> Sua condição exclusiva
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
                      {policy.tabela && <PolicyItem label="Tabela" value={policy.tabela} />}
                      {policy.comprador && <PolicyItem label="Comprador" value={policy.comprador} />}
                      {policy.transportadora && <PolicyItem label="Transportadora" value={policy.transportadora} />}
                      {policy.frete && <PolicyItem label="Frete" value={policy.frete === 'C' ? 'CIF' : policy.frete === 'F' ? 'FOB' : policy.frete} />}
                      {policy.prazo && <PolicyItem label="Prazo" value={policy.prazo} />}
                      {policy.descontos.length > 0 && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Descontos</span>
                          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {policy.descontos.map((d, i) => (
                              <span key={i} style={{ background: 'rgba(255,210,0,0.15)', color: G.mustard, fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(255,210,0,0.2)' }}>
                                {d}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Formulário ou resultado */}
                {!cotacaoId ? (
                  <div style={{ background: G.card, borderRadius: 16, border: `1px solid ${G.border}`, padding: '20px' }}>
                    <div style={{ fontSize: 19, fontWeight: 900, color: G.text, marginBottom: 6, letterSpacing: -0.5 }}>Cole os códigos que precisa</div>
                    <div style={{ fontSize: 12, color: G.muted, marginBottom: 10, lineHeight: 1.4 }}>Código, código original, conversão ou nome. Nós encontramos.</div>

                    {/* B2 — Atalhos de cotação */}
                    {loadingInsights ? (
                      <div style={{ fontSize: 11, color: G.muted, textAlign: 'center', padding: '10px 0', marginBottom: 8 }}>Carregando atalhos...</div>
                    ) : insights ? (
                      <div style={{ marginBottom: 14 }}>
                        <button
                          onClick={() => setQuickModal('mix')}
                          disabled={!insights.ultimoPedidoItens.length}
                          style={{
                            width: '100%', marginBottom: 8, textAlign: 'left',
                            background: insights.ultimoPedidoItens.length ? G.mustard : G.border,
                            border: 'none', borderRadius: 10, padding: '12px 14px',
                            cursor: insights.ultimoPedidoItens.length ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>🔄 Repetir meu mix</div>
                          <div style={{ fontSize: 11, color: insights.ultimoPedidoItens.length ? '#5a4a00' : G.muted, marginTop: 2 }}>
                            {insights.ultimoPedidoItens.length
                              ? `${insights.ultimoPedidoItens.length} produtos · último pedido há ${insights.diasUltimoPedido} dias`
                              : 'Nenhum pedido anterior nesta indústria'}
                          </div>
                        </button>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button
                            onClick={() => setQuickModal('esquecidos')}
                            disabled={!insights.esquecidos.length}
                            style={{
                              textAlign: 'left', border: 'none', borderRadius: 8, padding: '10px 12px',
                              background: insights.esquecidos.length ? '#2D4A3E' : G.border,
                              cursor: insights.esquecidos.length ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 800, color: insights.esquecidos.length ? '#A3D9A5' : G.muted }}>⚠️ Esquecidos</div>
                            <div style={{ fontSize: 9, color: insights.esquecidos.length ? '#6EBF8B' : G.muted, marginTop: 2 }}>
                              {insights.esquecidos.length} {insights.esquecidos.length === 1 ? 'item' : 'itens'} · +90 dias
                            </div>
                          </button>
                          <button
                            onClick={() => setQuickModal('catalogo')}
                            style={{
                              textAlign: 'left', borderRadius: 8, padding: '10px 12px',
                              background: '#283748', border: '1px solid #4A6080', cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#E8E1D4' }}>📋 Catálogo</div>
                            <div style={{ fontSize: 9, color: '#A8B8C4', marginTop: 2 }}>Ver todos os produtos</div>
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 6px' }}>
                          <div style={{ flex: 1, height: 1, background: G.border }} />
                          <div style={{ fontSize: 10, color: G.muted, fontWeight: 600 }}>ou cole os códigos</div>
                          <div style={{ flex: 1, height: 1, background: G.border }} />
                        </div>
                      </div>
                    ) : null}
                    <textarea
                      value={rawCodes}
                      onChange={e => setRawCodes(e.target.value)}
                      placeholder={'Ex:\n123456\nABC-789\nFILTRO DE ÓLEO'}
                      rows={8}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        fontSize: 13, fontFamily: MONO,
                        padding: '12px 14px', borderRadius: 12,
                        border: `1.5px solid ${G.border}`, background: `${G.bg}50`,
                        color: G.text, outline: 'none', resize: 'vertical', lineHeight: 1.6,
                      }}
                      onFocus={e => { e.target.style.borderColor = G.navy; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = G.border; e.target.style.background = `${G.bg}50`; }}
                    />
                    <button
                      onClick={enviarCotacao}
                      disabled={sending || !rawCodes.trim()}
                      style={{
                        marginTop: 14, width: '100%', padding: '14px',
                        background: sending || !rawCodes.trim() ? G.border : G.mustard,
                        color: G.navy, border: 'none', borderRadius: 14,
                        fontSize: 15, fontWeight: 900, cursor: sending || !rawCodes.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: sending || !rawCodes.trim() ? 'none' : '0 4px 16px rgba(255,210,0,0.35)',
                      }}
                    >
                      {sending ? <><div style={{ width: 16, height: 16, border: `2px solid ${G.navy}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Processando…</> : <><Send size={15} /> Solicitar Cotação</>}
                    </button>
                    <div style={{ fontSize: 11, color: G.muted, textAlign: 'center', marginTop: 10, fontWeight: 600 }}>Resposta em segundos · Seus preços com desconto</div>
                    {sendError && (
                      <div style={{ marginTop: 8, padding: '10px 14px', background: G.redBg, border: `1px solid #FECACA`, borderRadius: 10, fontSize: 12, color: G.red, fontWeight: 600 }}>
                        ⚠ {sendError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {cotacaoStatus === 'confirmada' ? (
                      <div style={{ background: G.greenBg, borderRadius: 16, border: '1px solid #6EE7B7', padding: '28px 20px', textAlign: 'center' }}>
                        <CheckCircle size={36} color={G.green} style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: 22, fontWeight: 900, color: G.green, letterSpacing: -0.5 }}>Cotação enviada com sucesso!</div>
                        <div style={{ fontSize: 13, color: '#065F46', marginTop: 8, lineHeight: 1.45 }}>Nossa equipe já recebeu. Entraremos em contato em breve.</div>
                        <button onClick={novaCotacao} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 12, border: `1px solid ${G.border}`, background: 'transparent', color: G.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          Fazer nova cotação
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: G.greenBg, borderRadius: 16, border: '1px solid #6EE7B7', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CheckCircle size={18} color={G.green} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: G.green }}>Cotação processada!</div>
                              <div style={{ fontSize: 11, color: '#065F46', marginTop: 1 }}>
                                {cotacaoItens.filter(i => i.found).length} encontrado(s){cotacaoItens.filter(i => !i.found).length > 0 ? ` · ${cotacaoItens.filter(i => !i.found).length} não encontrado(s)` : ''}
                              </div>
                            </div>
                          </div>
                          <button onClick={novaCotacao} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Nova
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Itens */}
                    {cotacaoStatus !== 'confirmada' && cotacaoItens.length > 0 && (
                      <div style={{ background: G.card, borderRadius: 16, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 12, fontWeight: 800, color: G.text }}>
                          Itens da cotação
                        </div>
                        {cotacaoItens.map((item, i) => {
                          const nao = !item.found;
                          return (
                            <div key={i} style={{ padding: '14px 16px', borderBottom: i < cotacaoItens.length - 1 ? `1px solid ${G.border}` : 'none', background: nao ? G.redBg : 'transparent' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 14, fontWeight: 900, color: nao ? G.red : G.text, fontFamily: MONO }}>{item.ite_produto}</div>
                                  <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>{item.ite_nomeprod}</div>
                                  {item.ite_embuch && <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>Emb: {item.ite_embuch}</div>}
                                </div>
                                {!nao && (
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    {item.ite_puni !== item.ite_puniliq && (
                                      <div style={{ fontSize: 11, color: G.muted, textDecoration: 'line-through', fontFamily: MONO }}>{fmtMoney(item.ite_puni)}</div>
                                    )}
                                    <div style={{ fontSize: 16, fontWeight: 900, color: G.navy, fontFamily: MONO }}>{fmtMoney(item.ite_puniliq)}</div>
                                    <div style={{ fontSize: 10, color: G.muted, fontFamily: MONO }}>× {item.ite_quant} = {fmtMoney(item.ite_totliquido)}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {totalCotacaoLiq > 0 && (
                          <div style={{ padding: '14px 16px', background: G.surface, borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: G.muted }}>Total estimado</span>
                            <span style={{ fontSize: 20, fontWeight: 900, color: G.navy, fontFamily: MONO }}>{fmtMoney(totalCotacaoLiq)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Adicionar mais itens */}
                    {cotacaoStatus !== 'confirmada' && adicionando && (
                      <div style={{ background: G.card, borderRadius: 16, border: `1px solid ${G.border}`, padding: '16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: G.text, marginBottom: 8 }}>Adicionar mais códigos</div>
                        <textarea
                          value={moreRawCodes}
                          onChange={e => setMoreRawCodes(e.target.value)}
                          placeholder={'Ex:\n123456  5\nABC-789'}
                          rows={5}
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontFamily: MONO, padding: '10px 12px', borderRadius: 10, border: `1px solid ${G.border}`, background: G.surface, color: G.text, outline: 'none', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={adicionarItens}
                            disabled={addSending || !moreRawCodes.trim()}
                            style={{ flex: 1, padding: '10px', background: addSending || !moreRawCodes.trim() ? G.border : G.navy, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: addSending || !moreRawCodes.trim() ? 'not-allowed' : 'pointer' }}
                          >
                            {addSending ? 'Adicionando...' : 'Adicionar itens'}
                          </button>
                          <button onClick={() => { setAdicionando(false); setMoreRawCodes(''); setAddError(''); }} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${G.border}`, background: 'transparent', color: G.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                        {addError && <div style={{ marginTop: 8, padding: '8px 12px', background: G.redBg, borderRadius: 8, fontSize: 12, color: G.red, fontWeight: 600 }}>⚠ {addError}</div>}
                      </div>
                    )}

                    {/* Botões de ação */}
                    {cotacaoStatus !== 'confirmada' && !adicionando && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setAdicionando(true)}
                          style={{ flex: 1, padding: '12px', background: G.card, color: G.navy, border: `2px solid ${G.navy}`, borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                        >
                          + Adicionar itens
                        </button>
                        <button
                          onClick={confirmarCotacao}
                          disabled={confirming || cotacaoItens.filter(i => i.found).length === 0}
                          style={{ flex: 1, padding: '12px', background: confirming ? G.border : G.mustard, color: G.navy, border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: confirming ? 'not-allowed' : 'pointer', boxShadow: confirming ? 'none' : '0 4px 12px rgba(255,210,0,0.3)' }}
                        >
                          {confirming ? 'Confirmando...' : '✓ Confirmar cotação'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── ABA: MEU PAINEL (INSIGHTS) ────────────────────────────────────── */}
        {activeTab === 'insights' && (
          <>
            {/* Cards de navegação */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => setActiveTab('pedidos')}
                style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 120ms' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{ width: 32, height: 32, background: G.navy, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Package size={16} color={G.mustard} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: G.text, marginBottom: 2 }}>Meus Pedidos</div>
                {globalStats && <div style={{ fontSize: 11, color: G.muted, fontWeight: 600 }}>{globalStats.total_pedidos} registros</div>}
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 800, color: G.navy, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ver histórico →</div>
              </button>
              <button
                onClick={() => setActiveTab('cotar')}
                style={{ background: G.mustard, border: 'none', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 16px rgba(255,210,0,0.35)', transition: 'transform 120ms' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{ width: 32, height: 32, background: G.navy, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <FileText size={16} color={G.mustard} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: G.navy, marginBottom: 2 }}>Solicitar Cotação</div>
                <div style={{ fontSize: 11, color: 'rgba(30,45,61,0.6)', fontWeight: 600 }}>Cole os códigos</div>
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 800, color: G.navy, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Abrir →</div>
              </button>
            </div>

            {industria === '0' ? (
              <EmptyState icon={<Building2 size={24} color={G.muted} />} title="Selecione uma indústria" sub="Escolha a indústria acima para ver seu painel." />
            ) : loadingInsights ? (
              <Spinner />
            ) : !insights ? null : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ── Gráfico de evolução ──────────────────────────────────── */}
                {(() => {
                  const months6 = getLast6Months();
                  const mensalMap = new Map(insights.mensal.map(m => [m.mes, parseFloat(m.total) || 0]));
                  const values = months6.map(m => ({ ...m, value: mensalMap.get(m.key) || 0 }));
                  const maxVal = Math.max(...values.map(v => v.value), 1);
                  const bestIdx = values.reduce((bi, v, i) => v.value > values[bi].value ? i : bi, 0);
                  const totalPeriodo = values.reduce((s, v) => s + v.value, 0);
                  const mediaMensal = totalPeriodo / 6;
                  const barW = 36, gap = 8;
                  const svgW = values.length * barW + (values.length - 1) * gap;

                  return (
                    <div style={{ background: G.card, borderRadius: 14, padding: 18, borderLeft: `4px solid ${G.mustard}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted, marginBottom: 6 }}>Sua evolução</div>
                      {totalPeriodo > 0 ? (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 900, color: G.text, letterSpacing: -0.3 }}>
                            Seu melhor mês foi <span style={{ color: G.navy }}>{values[bestIdx].label}</span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: G.green, marginTop: 2, fontFamily: MONO }}>
                            {fmtMoney(values[bestIdx].value)}
                          </div>
                          <div style={{ marginTop: 16, marginBottom: 6, overflow: 'visible' }}>
                            <svg width="100%" viewBox={`0 0 ${svgW} 114`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
                              {values.map((d, i) => {
                                const h = Math.max(6, (d.value / maxVal) * 86);
                                const x = i * (barW + gap);
                                const y = 86 - h;
                                const active = i === bestIdx;
                                return (
                                  <g key={i}>
                                    <rect x={x} y={y} width={barW} height={h} rx={4}
                                      fill={active ? G.mustard : G.navy}
                                      opacity={active ? 1 : 0.18} />
                                    <text x={x + barW / 2} y={100} textAnchor="middle"
                                      style={{ fontFamily: "'Segoe UI',sans-serif", fontSize: 9, fontWeight: 700, fill: active ? G.navy : G.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                      {d.label.toUpperCase()}
                                    </text>
                                    <text x={x + barW / 2} y={112} textAnchor="middle"
                                      style={{ fontFamily: MONO, fontSize: 8, fontWeight: 800, fill: active ? G.navy : G.muted }}>
                                      {d.value > 0 ? (d.value / 1000).toFixed(1).replace('.', ',') + 'k' : '—'}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                          <div style={{ marginTop: 4, paddingTop: 12, borderTop: `1px dashed ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 11, color: G.muted, fontWeight: 600 }}>Média mensal</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: G.text, fontFamily: MONO }}>{fmtMoney(mediaMensal)}</div>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: G.muted, marginTop: 8 }}>Sem compras nos últimos 6 meses nesta indústria.</div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Produtos esquecidos ──────────────────────────────────── */}
                {insights.esquecidos.length > 0 && (
                  <div style={{ background: G.card, borderRadius: 14, padding: 18, borderLeft: `4px solid ${G.red}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: G.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⏰</div>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.red }}>Produtos esquecidos</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: G.text, letterSpacing: -0.3, lineHeight: 1.2 }}>
                      Você não pede isso há mais de 90 dias
                    </div>
                    <div style={{ fontSize: 12, color: G.muted, fontStyle: 'italic', marginTop: 4, marginBottom: 14, lineHeight: 1.4 }}>
                      Seus clientes ainda pedem. Você perdeu alguma venda?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {insights.esquecidos.map((p, i) => (
                        <div key={i} style={{ background: '#FEF2F2', border: `1px solid #FEE2E2`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 900, color: G.text }}>{p.codigo}</div>
                            <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{p.nome}</div>
                            <div style={{ fontSize: 10, color: G.red, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                              Último: {fmtDate(p.ultima_compra || '')}
                            </div>
                          </div>
                          <button
                            onClick={() => adicionarAoCotacao(p.codigo)}
                            style={{ flexShrink: 0, background: G.navy, color: 'white', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Cotar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Top 5 produtos (Curva A) ─────────────────────────────── */}
                {insights.topProdutos.length > 0 && (
                  <div style={{ background: G.navy, borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden', boxShadow: '0 6px 18px rgba(30,45,61,0.18)' }}>
                    <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,210,0,0.14), transparent 65%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Star size={16} color={G.mustard} fill={G.mustard} />
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.mustard }}>Curva A</div>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: -0.4, marginBottom: 16 }}>Seu top 5 desta indústria</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {insights.topProdutos.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < insights.topProdutos.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                            <div style={{ fontFamily: MONO, fontWeight: 900, fontSize: 15, color: i === 0 ? G.mustard : 'rgba(255,255,255,0.35)', width: 24, flexShrink: 0 }}>
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 900, color: 'white' }}>{p.codigo}</div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{p.nome}</div>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 900, color: G.mustard, flexShrink: 0 }}>
                              {fmtMoney(p.total_comprado || '0')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Mix sugerido ─────────────────────────────────────────── */}
                {insights.sugestoes.length > 0 && (
                  <div style={{ background: G.card, borderRadius: 14, padding: 18, borderLeft: `4px solid ${G.mustard}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF9CC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💡</div>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.amber }}>Oportunidade</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: G.text, letterSpacing: -0.3, lineHeight: 1.2 }}>
                      Você ainda não pediu isso
                    </div>
                    <div style={{ fontSize: 12, color: G.muted, fontStyle: 'italic', marginTop: 4, marginBottom: 14, lineHeight: 1.4 }}>
                      Outros lojistas estão pedindo
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {insights.sugestoes.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => adicionarAoCotacao(p.codigo)}
                          style={{ background: '#FFFBEA', border: `1px solid ${G.mustard}80`, borderRadius: 10, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 150ms ease' }}
                        >
                          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 900, color: G.text }}>{p.codigo}</span>
                          <span style={{ fontSize: 11, color: G.muted, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                          {p.num_clientes && parseInt(p.num_clientes) > 1 && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: G.amber, background: G.amberBg, padding: '2px 5px', borderRadius: 5, whiteSpace: 'nowrap' }}>{p.num_clientes}×</span>
                          )}
                          <span style={{ width: 20, height: 20, borderRadius: 6, background: G.navy, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, lineHeight: 1, flexShrink: 0 }}>+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {insights.esquecidos.length === 0 && insights.topProdutos.length === 0 && insights.sugestoes.length === 0 && (
                  <EmptyState icon={<BarChart2 size={24} color={G.muted} />} title="Ainda sem dados suficientes" sub="Faça alguns pedidos para começar a ver insights personalizados." />
                )}

              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '32px 0 20px', borderTop: `1px solid ${G.border}`, marginTop: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <TrendingUp size={12} color={G.muted} />
          <span style={{ fontSize: 11, color: G.muted, fontWeight: 700 }}>Portal do Lojista · RepOne</span>
        </div>
        <div style={{ fontSize: 10, color: G.muted, opacity: 0.6 }}>Acesso exclusivo e seguro</div>
      </div>

      {quickModal && insights && (
        <QuickActionModal
          mode={quickModal}
          industria={industria}
          token={token}
          schema={schema}
          insightsMix={insights.ultimoPedidoItens}
          insightsEsquecidos={insights.esquecidos}
          onConfirm={handleQuickConfirm}
          onClose={() => setQuickModal(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>{label}</span>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 20px', background: G.card, borderRadius: 16, border: `1px solid ${G.border}` }}>
      <div style={{ width: 52, height: 52, background: G.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: G.muted }}>{sub}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${G.border}`, borderTopColor: G.navy, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ fontSize: 13, color: G.muted }}>Carregando...</div>
    </div>
  );
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 10,
    background: disabled ? 'transparent' : G.card,
    border: `1px solid ${G.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? G.muted : G.text,
    opacity: disabled ? 0.35 : 1,
  };
}
