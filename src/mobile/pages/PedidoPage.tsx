import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, ChevronRight, Loader2,
  MessageCircle, Package, Wifi, WifiOff, Minus, AlertCircle, ShieldCheck, X, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/shared/lib/api';
import { db } from '../db/db';
import { useOffline } from '../hooks/useOffline';
import { useSync } from '../hooks/useSync';
import { HelpSheet } from '../components/HelpSheet';
import type { MobileProduct } from '../db/types';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface Industria      { for_codigo: number; for_nomered: string }
interface Tabela         { value: string; label: string }
interface Transportadora { value: number; label: string }
interface OrderItem {
  pro_codprod: string;
  pro_nome:    string;
  unidade:     string;
  preco:       number;
  qty:         number;
}
interface Suggestion {
  ite_produto:       string;
  nome_produto:      string;
  dias_sem_compra:   number;
  ultima_quantidade: number;
  urgencia:          'critica' | 'alta' | 'atencao';
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ─── Qty Stepper ────────────────────────────────────────────────────────────── */
function Stepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <button onClick={onDec}
        style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--sand-bg)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)' }}>
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)',
        minWidth: 30, textAlign: 'center', fontFamily: 'monospace' }}>
        {qty}
      </span>
      <button onClick={onInc}
        style={{ width: 36, height: 36, borderRadius: 10, border: 'none',
          background: 'var(--mustard)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Plus size={14} strokeWidth={3} color="var(--navy)" />
      </button>
    </div>
  );
}

/* ─── PedidoPage ─────────────────────────────────────────────────────────────── */
export default function PedidoPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { isOnline }          = useOffline();
  const { refreshQueueCount } = useSync();

  const clienteId    = params.get('cliente');
  const clienteNome  = params.get('nome')   || '';
  const clienteCidade= params.get('cidade') || '';

  useEffect(() => {
    if (!clienteId) navigate('/mobile/clientes?for=pedido', { replace: true });
  }, [clienteId, navigate]);

  /* ─ state ─ */
  const [industrias,  setIndustrias]  = useState<Industria[]>([]);
  const [selectedInd, setSelectedInd] = useState<number | null>(null);
  const [tabelas,     setTabelas]     = useState<Tabela[]>([]);
  const [selTabela,   setSelTabela]   = useState('');
  const [transps,     setTransps]     = useState<Transportadora[]>([]);
  const [selTransp,   setSelTransp]   = useState<number>(0);
  const [search,      setSearch]      = useState('');
  const [allProds,    setAllProds]    = useState<MobileProduct[]>([]);
  const [priceMap,    setPriceMap]    = useState<Record<string, number>>({});
  const [politica,    setPolitica]    = useState<{ tem: boolean; tabelaExclusiva: boolean; descontos: number[] } | null>(null);
  const [items,       setItems]       = useState<OrderItem[]>([]);
  const [suggestions,  setSuggestions]  = useState<Suggestion[]>([]);
  const [showHelp,     setShowHelp]     = useState(false);
  const [showReview,   setShowReview]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [loadingInds,  setLoadingInds]  = useState(true);
  const [loadingCat,   setLoadingCat]   = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const total    = items.reduce((s, i) => s + i.preco * i.qty, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  /* ─ load industrias + transportadoras ─ */
  useEffect(() => {
    setLoadingInds(true);
    api.get('/aux/industrias')
      .then(r => {
        const inds: Industria[] = (r.data.data || []).map((f: any) => ({
          for_codigo:  Number(f.for_codigo),
          for_nomered: f.for_nomered || f.for_nome || '',
        }));
        setIndustrias(inds);
        if (inds.length > 0) setSelectedInd(inds[0].for_codigo);
      })
      .catch(() => {})
      .finally(() => setLoadingInds(false));

    api.get('/aux/transportadoras')
      .then(r => {
        const ts: Transportadora[] = (r.data.data || []).map((t: any) => ({
          value: Number(t.value), label: String(t.label),
        }));
        setTransps(ts);
        if (ts.length > 0) setSelTransp(ts[0].value);
      })
      .catch(() => {});
  }, []);

  /* ─ load tabelas when industry changes ─ */
  useEffect(() => {
    if (!selectedInd) return;
    setTabelas([]);
    setSelTabela('');
    setAllProds([]);
    setPriceMap({});
    setSearch('');
    const qs = clienteId ? `?cliente=${clienteId}` : '';
    api.get(`/aux/price-tables/${selectedInd}${qs}`)
      .then(r => {
        const ts: Tabela[] = r.data.data || [];
        setTabelas(ts);
        if (ts.length > 0) setSelTabela(ts[0].value);
      })
      .catch(() => {});
  }, [selectedInd, clienteId]);

  /* ─ load catalog ─ */
  useEffect(() => {
    if (!selectedInd) return;
    setLoadingCat(true);
    if (isOnline) {
      api.get(`/products/catalog/${selectedInd}`)
        .then(r => setAllProds((r.data.data || []).map((p: any) => ({
          pro_codprod:   String(p.pro_codprod),
          pro_nome:      p.pro_nome || '',
          pro_industria: Number(selectedInd),
          unidade:       p.pro_undven || p.unidade || 'UN',
        }))))
        .catch(() => {})
        .finally(() => setLoadingCat(false));
    } else {
      db.products.where('pro_industria').equals(selectedInd).toArray()
        .then(setAllProds)
        .finally(() => setLoadingCat(false));
    }
  }, [selectedInd, isOnline]);

  /* ─ build price map for current industry + tabela (with cli_ind policy) ─ */
  useEffect(() => {
    if (!selectedInd || !selTabela) return;
    setPolitica(null);
    if (isOnline) {
      const qs = new URLSearchParams({ industria: String(selectedInd), tabela: selTabela });
      if (clienteId) qs.set('cliente', clienteId);
      api.get(`/products/prices-for-order?${qs}`)
        .then(r => {
          const map: Record<string, number> = {};
          for (const item of (r.data.data || [])) {
            map[String(item.pro_codprod)] = item.preco;
          }
          setPriceMap(map);
          const meta = r.data.meta;
          if (meta?.tem_politica) {
            setPolitica({
              tem: true,
              tabelaExclusiva: !!meta.tabela_exclusiva,
              descontos: meta.descontos_aplicados || [],
            });
          }
        })
        .catch(() => {});
    } else {
      db.prices.where('industria_id').equals(selectedInd).toArray().then(prices => {
        const map: Record<string, number> = {};
        for (const p of prices) {
          if (!map[p.pro_codprod]) map[p.pro_codprod] = p.preco;
        }
        for (const p of prices) {
          if (String(p.tabela_id) === selTabela) map[p.pro_codprod] = p.preco;
        }
        setPriceMap(map);
      }).catch(() => {});
    }
  }, [selectedInd, selTabela, clienteId, isOnline]);

  /* ─ sugestões de recompra ─ */
  useEffect(() => {
    if (!selectedInd || !clienteId || !isOnline) { setSuggestions([]); return; }
    const qs = new URLSearchParams({
      clienteId:   clienteId,
      industriaId: String(selectedInd),
      ...(selTabela ? { tabelaId: selTabela } : {}),
    });
    api.get(`/orders/smart-suggestions?${qs}`)
      .then(r => setSuggestions((r.data.data || []).slice(0, 12)))
      .catch(() => setSuggestions([]));
  }, [selectedInd, clienteId, selTabela, isOnline]);

  /* ─ search results ─ */
  const searchResults = useCallback((): MobileProduct[] => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allProds.filter(p =>
      p.pro_codprod.toLowerCase().includes(q) ||
      p.pro_nome.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [allProds, search]);

  /* ─ add / increment product ─ */
  const addOrIncrement = useCallback((product: MobileProduct) => {
    const preco = priceMap[product.pro_codprod] ?? 0;
    setItems(prev => {
      const exists = prev.find(i => i.pro_codprod === product.pro_codprod);
      if (exists) {
        return prev.map(i =>
          i.pro_codprod === product.pro_codprod ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, {
        pro_codprod: product.pro_codprod,
        pro_nome:    product.pro_nome,
        unidade:     product.unidade,
        preco,
        qty: 1,
      }];
    });
  }, [priceMap]);

  /* ─ update qty (delta can be negative → removes when reaches 0) ─ */
  const updateQty = useCallback((codprod: string, delta: number) => {
    setItems(prev => {
      const item = prev.find(i => i.pro_codprod === codprod);
      if (!item) return prev;
      const next = item.qty + delta;
      if (next <= 0) return prev.filter(i => i.pro_codprod !== codprod);
      return prev.map(i => i.pro_codprod === codprod ? { ...i, qty: next } : i);
    });
  }, []);

  /* ─ save order ─ */
  const handleSave = async () => {
    if (!selectedInd || !clienteId || items.length === 0) return;
    if (!selTransp) { toast.error('Selecione a transportadora'); return; }
    setSaving(true);
    const payload = {
      ped_cliente:   Number(clienteId),
      ped_industria: selectedInd,
      ped_transp:    selTransp,
      tabela:        selTabela || undefined,
      itens: items.map(i => ({ pro_codprod: i.pro_codprod, qtd: i.qty, preco: i.preco })),
    };
    try {
      if (isOnline) {
        await api.post('/orders/mobile', payload);
        toast.success('Pedido enviado com sucesso!');
      } else {
        await db.queue.add({ payload, createdAt: new Date().toISOString(), status: 'pendente' });
        await refreshQueueCount();
        toast.success('Pedido salvo — será enviado ao reconectar');
      }
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar pedido');
    } finally {
      setSaving(false);
    }
  };

  if (!clienteId) return null;

  const results     = searchResults();
  const isSearching = search.trim().length > 0;
  const catalogReady = !loadingCat && allProds.length > 0;
  const indNome      = industrias.find(i => i.for_codigo === selectedInd)?.for_nomered || '';

  /* ─── shared input style ─── */
  const sel: React.CSSProperties = {
    width: '100%', padding: '9px 10px', borderRadius: 10, fontSize: 13,
    border: '1px solid var(--border)', background: '#fff',
    color: 'var(--navy)', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box' as const, appearance: 'none' as const,
  };

  /* ════════════════════════════════════════════════════════════════════════════
     REVIEW SCREEN
  ═══════════════════════════════════════════════════════════════════════════ */
  if (showReview) {
    const waMsg = encodeURIComponent(
      `*Cotação — ${clienteNome}*\n` +
      `_${indNome}${selTabela ? ` · ${selTabela}` : ''}_\n\n` +
      items.map(i =>
        `• *${i.pro_codprod}* ${i.pro_nome.slice(0, 28)}\n` +
        `  ${i.qty} ${i.unidade} × ${fmtBRL(i.preco)} = *${fmtBRL(i.preco * i.qty)}*`
      ).join('\n') +
      `\n\n*Total: ${fmtBRL(total)}* (${totalQty} un)`
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>

        {/* header */}
        <div style={{ background: 'var(--navy)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setShowReview(false)}
            style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 10,
              height: 36, padding: '0 12px', display: 'flex', alignItems: 'center',
              gap: 6, cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={15} color="rgba(255,255,255,.8)" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>Editar</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Revisão · {indNome}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clienteNome}
            </div>
          </div>
          <button onClick={() => navigate('/mobile/home')}
            style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 10,
              height: 36, padding: '0 12px', display: 'flex', alignItems: 'center',
              gap: 6, cursor: 'pointer', flexShrink: 0 }}>
            <X size={15} color="rgba(255,255,255,.6)" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>Fechar</span>
          </button>
        </div>

        <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 160px' }}>

          {/* context chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { label: 'Tabela', val: selTabela || 'Padrão' },
              { label: 'Itens', val: `${totalQty} un` },
              { label: 'Produtos', val: `${items.length}` },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', border: '1px solid var(--border)',
                borderRadius: 8, padding: '5px 11px', fontSize: 11 }}>
                <span style={{ color: 'var(--navy-muted)', fontWeight: 700 }}>{c.label}: </span>
                <span style={{ color: 'var(--navy)', fontWeight: 800 }}>{c.val}</span>
              </div>
            ))}
          </div>

          {/* transportadora */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Transportadora <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select value={selTransp} onChange={e => setSelTransp(Number(e.target.value))}
              style={{ ...sel, padding: '12px 14px', borderRadius: 12, fontSize: 14,
                border: `2px solid ${!selTransp ? '#DC2626' : 'var(--border)'}` }}>
              <option value={0}>— Selecione a transportadora —</option>
              {transps.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {!selTransp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5,
                fontSize: 11, color: '#DC2626', fontWeight: 700 }}>
                <AlertCircle size={11} /> Obrigatória para confirmar o pedido
              </div>
            )}
          </div>

          {/* items */}
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {items.length} produto{items.length !== 1 ? 's' : ''}
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
            overflow: 'hidden', marginBottom: 16 }}>
            {items.map((item, i) => (
              <div key={item.pro_codprod} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12,
                    color: 'var(--navy)', marginBottom: 3 }}>
                    {item.pro_codprod}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.pro_nome}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 1 }}>
                    {item.qty}× {fmtBRL(item.preco)} / {item.unidade}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: 'var(--navy)' }}>
                    {fmtBRL(item.preco * item.qty)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* total */}
          <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)',
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
            <span style={{ fontFamily: 'monospace', fontSize: 30, fontWeight: 900,
              color: '#fff', letterSpacing: '-0.02em' }}>
              {fmtBRL(total)}
            </span>
          </div>
        </div>

        {/* action buttons */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: '12px 16px 28px', background: 'var(--sand-bg)',
          borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleSave} disabled={saving || !selTransp}
            style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none',
              background: !selTransp ? '#94A3B8' : 'var(--mustard)',
              color: 'var(--navy)', fontSize: 15, fontWeight: 800,
              cursor: !selTransp ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? 'Enviando...' : `Confirmar pedido · ${fmtBRL(total)}`}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowReview(false)}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--navy)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ← Editar itens
            </button>
            <a href={`https://wa.me/?text=${waMsg}`} target="_blank" rel="noreferrer"
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid #16A34A',
                background: 'transparent', color: '#16A34A', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                textDecoration: 'none' }}>
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════════
     MAIN ORDER ENTRY
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>

      {/* ── Header ── */}
      <div style={{ background: 'var(--navy)', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/mobile/home')}
            style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 10,
              height: 36, padding: '0 12px', display: 'flex', alignItems: 'center',
              gap: 6, cursor: 'pointer', flexShrink: 0 }}>
            <X size={15} color="rgba(255,255,255,.8)" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>Fechar</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {clienteCidade && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.55)',
                textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                {clienteCidade}
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
              {clienteNome}
            </div>
          </div>
          {/* online / offline badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px',
            borderRadius: 8, background: isOnline ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)',
            flexShrink: 0 }}>
            {isOnline
              ? <Wifi size={11} color="#34D399" />
              : <WifiOff size={11} color="#FCA5A5" />
            }
            <span style={{ fontSize: 9, fontWeight: 800,
              color: isOnline ? '#34D399' : '#FCA5A5', letterSpacing: '0.05em' }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* help */}
          <button onClick={() => setShowHelp(true)}
            style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,210,0,0.18)', border: '1.5px solid rgba(255,210,0,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FFD200', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>?</span>
          </button>
        </div>
      </div>

      <HelpSheet open={showHelp} onClose={() => setShowHelp(false)} items={[
        { icon: '1️⃣', title: 'Selecione a indústria e a tabela', text: 'Escolha a indústria do fornecedor e a tabela de preços no topo da tela. A tabela certa garante os preços corretos.' },
        { icon: '2️⃣', title: 'Busque o produto',                text: 'Digite o código ou parte do nome na barra de busca. Os resultados aparecem na hora.' },
        { icon: '➕', title: 'Adicione e ajuste quantidades',    text: 'Toque no botão amarelo para adicionar. Use os botões − e + para ajustar a quantidade.' },
        { icon: '🕐', title: 'Comprou antes',                    text: 'Os cards horizontais mostram produtos que o cliente costuma pedir e parou de comprar. O botão já sugere a última quantidade pedida.' },
        { icon: '🛡️', title: 'Política comercial',               text: 'Se aparecer o aviso amarelo, os preços já incluem os descontos do cliente. Não aplique desconto adicional.' },
        { icon: '✅', title: 'Revisar e confirmar',              text: 'Toque em "Revisar" para conferir os itens, escolher a transportadora e confirmar a cotação.' },
        { icon: '💬', title: 'Enviar pelo WhatsApp',             text: 'Na tela de revisão, toque em "WhatsApp" para enviar a cotação ao cliente. A IRIS envia um e-mail automaticamente.' },
      ]} />

      {/* ── Indústria + Tabela de preços ── */}
      <div style={{ padding: '10px 16px 4px', background: 'var(--sand-bg)', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
              Indústria
            </label>
            {loadingInds ? (
              <div style={{ ...sel, background: '#E2E8F0', color: '#94A3B8', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6, height: 37 }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Carregando...
              </div>
            ) : (
              <select value={selectedInd ?? ''} style={sel}
                onChange={e => { setSelectedInd(Number(e.target.value)); setItems([]); }}>
                {industrias.map(i => (
                  <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
              Tabela de Preços
            </label>
            {tabelas.length === 0 ? (
              <div style={{ ...sel, background: '#E2E8F0', color: '#94A3B8', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6, height: 37 }}>
                {selectedInd && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                {selectedInd ? 'Carregando...' : '—'}
              </div>
            ) : (
              <select value={selTabela} style={sel} onChange={e => setSelTabela(e.target.value)}>
                {tabelas.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── Aviso política comercial ── */}
      {politica?.tem && (
        <div style={{
          margin: '0 16px 4px', borderRadius: 10, padding: '8px 12px',
          background: '#FFFBEB', border: '1px solid #FCD34D',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <ShieldCheck size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.45 }}>
            <strong>Preços já com política comercial aplicada.</strong>
            {' '}
            {politica.tabelaExclusiva
              ? 'Tabela exclusiva deste cliente.'
              : `Descontos em cascata: ${politica.descontos.map(d => `${d}%`).join(' + ')}.`
            }
            {' '}Não aplique desconto adicional.
          </div>
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{ padding: '8px 16px 8px', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
          background: '#fff', border: '2px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {loadingCat ? (
            <Loader2 size={16} style={{ position: 'absolute', left: 14, color: 'var(--navy-muted)',
              pointerEvents: 'none', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Search size={16} style={{ position: 'absolute', left: 14,
              color: 'var(--navy-muted)', pointerEvents: 'none' }} />
          )}
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={loadingCat ? 'Carregando catálogo...' : 'Código ou nome do produto...'}
            disabled={loadingCat}
            style={{ flex: 1, padding: '13px 14px 13px 42px', fontSize: 15,
              border: 'none', background: 'transparent', color: 'var(--navy)',
              outline: 'none', fontFamily: 'inherit' }}
          />
          {search.length > 0 && (
            <button onClick={() => { setSearch(''); searchRef.current?.focus(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 14px',
                color: 'var(--navy-muted)', fontSize: 20, lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="screen-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 110 }}>

        {/* ─ Searching: show results ─ */}
        {isSearching && (
          <>
            {results.length === 0 && !loadingCat && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Package size={32} color="#CBD5E1" style={{ display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
                  Nenhum produto encontrado
                </div>
                <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 4 }}>
                  Tente o código exato ou parte do nome
                </div>
              </div>
            )}
            {results.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14,
                border: '1px solid var(--border)', overflow: 'hidden' }}>
                {results.map((p, i) => {
                  const inOrder = items.find(it => it.pro_codprod === p.pro_codprod);
                  const price   = priceMap[p.pro_codprod];
                  return (
                    <div key={p.pro_codprod} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                      borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                      background: inOrder ? 'rgba(255,210,0,.08)' : 'transparent',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12,
                          color: 'var(--navy)', marginBottom: 2 }}>
                          {p.pro_codprod}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.pro_nome}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 10, color: 'var(--navy-muted)', fontWeight: 600 }}>{p.unidade}</span>
                          {price != null && price > 0 ? (
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                              {fmtBRL(price)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>sem preço</span>
                          )}
                        </div>
                      </div>
                      {inOrder ? (
                        <Stepper
                          qty={inOrder.qty}
                          onDec={() => updateQty(p.pro_codprod, -1)}
                          onInc={() => updateQty(p.pro_codprod, +1)}
                        />
                      ) : (
                        <button onClick={() => addOrIncrement(p)}
                          style={{ width: 38, height: 38, borderRadius: 10, border: 'none',
                            background: 'var(--mustard)', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={17} strokeWidth={3} color="var(--navy)" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─ Sugestões de recompra ─ */}
        {!isSearching && suggestions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 2px 8px' }}>
              <History size={13} color="var(--navy-muted)" />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Comprou antes
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto',
              paddingBottom: 4, scrollbarWidth: 'none' }}>
              {suggestions.map(s => {
                const inOrder = items.find(i => i.pro_codprod === s.ite_produto);
                const price   = priceMap[s.ite_produto] ?? 0;
                const urgColor = s.urgencia === 'critica' ? '#DC2626'
                               : s.urgencia === 'alta'    ? '#D97706' : '#2563EB';
                return (
                  <div key={s.ite_produto} style={{
                    flexShrink: 0, width: 148,
                    background: inOrder ? 'rgba(255,210,0,.12)' : '#fff',
                    border: `1px solid ${inOrder ? 'var(--mustard)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '10px 10px 8px',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900,
                      fontSize: 12, color: 'var(--navy)', letterSpacing: '-0.01em' }}>
                      {s.ite_produto}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600,
                      lineHeight: 1.3, height: 28, overflow: 'hidden',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as any }}>
                      {s.nome_produto}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700,
                        color: urgColor, background: `${urgColor}18`,
                        padding: '2px 6px', borderRadius: 5 }}>
                        {s.dias_sem_compra}d atrás
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800,
                        color: price > 0 ? '#059669' : '#94A3B8',
                        fontFamily: 'monospace' }}>
                        {price > 0 ? fmtBRL(price) : '—'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const prod: MobileProduct = {
                          pro_codprod:   s.ite_produto,
                          pro_nome:      s.nome_produto,
                          pro_industria: selectedInd!,
                          unidade:       'UN',
                        };
                        for (let n = 0; n < (s.ultima_quantidade || 1); n++) {
                          addOrIncrement(prod);
                        }
                      }}
                      style={{ marginTop: 2, width: '100%', padding: '6px 0',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: inOrder ? 'var(--mustard)' : 'var(--navy)',
                        color: inOrder ? 'var(--navy)' : '#fff',
                        fontSize: 11, fontWeight: 800,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 4 }}>
                      <Plus size={11} strokeWidth={3} />
                      {inOrder ? `${inOrder.qty} un` : `${s.ultima_quantidade || 1} un`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─ Not searching + empty items: guide ─ */}
        {!isSearching && items.length === 0 && (
          <div style={{ padding: '20px 4px' }}>
            {(loadingInds || loadingCat) ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: 40, color: 'var(--navy-muted)' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Carregando catálogo...</span>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 44, marginBottom: 10, lineHeight: 1 }}>🛒</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
                    Pedido em aberto
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--navy-muted)', lineHeight: 1.5 }}>
                    {catalogReady
                      ? `${allProds.length.toLocaleString('pt-BR')} produtos disponíveis`
                      : 'Catálogo não carregado — verifique a conexão'
                    }
                  </div>
                </div>

                {/* step guide */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { n: 1, text: 'Confirme a indústria e a tabela de preços acima' },
                    { n: 2, text: 'Digite o código ou nome do produto na busca' },
                    { n: 3, text: 'Toque + para adicionar · ajuste as quantidades' },
                    { n: 4, text: 'Toque Revisar e confirme o pedido' },
                  ].map(step => (
                    <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 16px', background: '#fff', borderRadius: 12,
                      border: '1px solid var(--border)' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%',
                        background: 'var(--navy)', color: '#fff', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 900 }}>
                        {step.n}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600,
                        lineHeight: 1.4 }}>
                        {step.text}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─ Not searching + has items: item list ─ */}
        {!isSearching && items.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 2px 10px' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {items.length} produto{items.length !== 1 ? 's' : ''} no pedido
              </span>
              <button
                onClick={() => { setSearch(''); setTimeout(() => searchRef.current?.focus(), 50); }}
                style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)',
                  background: 'var(--mustard)', border: 'none', borderRadius: 8,
                  padding: '5px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5 }}>
                <Plus size={12} strokeWidth={3} /> Produto
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 14,
              border: '1px solid var(--border)', overflow: 'hidden' }}>
              {items.map((item, i) => (
                <div key={item.pro_codprod} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12,
                      color: 'var(--navy)', marginBottom: 3 }}>
                      {item.pro_codprod}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.pro_nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 1,
                      display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{item.preco > 0 ? fmtBRL(item.preco) : '—'} / {item.unidade}</span>
                      <span style={{ fontWeight: 800, color: 'var(--navy)', fontFamily: 'monospace' }}>
                        = {fmtBRL(item.preco * item.qty)}
                      </span>
                    </div>
                  </div>
                  <Stepper
                    qty={item.qty}
                    onDec={() => updateQty(item.pro_codprod, -1)}
                    onInc={() => updateQty(item.pro_codprod, +1)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Summary footer ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: items.length > 0 ? 'var(--navy)' : 'var(--sand-bg)',
        borderTop: `1px solid ${items.length > 0 ? 'transparent' : 'var(--border)'}`,
        padding: '10px 16px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: items.length > 0 ? '0 -6px 28px rgba(40,55,74,.22)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}>
        {items.length > 0 ? (
          <>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {totalQty} iten{totalQty !== 1 ? 's' : ''}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 900,
                color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {fmtBRL(total)}
              </div>
            </div>
            <button onClick={() => setShowReview(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '13px 22px', borderRadius: 14, border: 'none',
                background: 'var(--mustard)', color: 'var(--navy)',
                fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Revisar <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <div style={{ width: '100%', textAlign: 'center', fontSize: 12,
            color: 'var(--navy-muted)', fontWeight: 600 }}>
            Adicione produtos para começar o pedido
          </div>
        )}
      </div>
    </div>
  );
}
