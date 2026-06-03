import { useEffect, useState, useMemo } from 'react';
import { useNavigate }  from 'react-router-dom';
import { Plus, Send, Clock, CheckCircle2, UploadCloud, FileText, MessageCircle, Sparkles, X } from 'lucide-react';
import { db }           from '../db/db';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { useSync }      from '../hooks/useSync';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileOrder, QueuedOrder } from '../db/types';

interface ApiOrder {
  ped_numero:      number;
  ped_pedido:      string;
  ped_data:        string;
  ped_situacao:    string;
  ped_tabela:      string;
  ped_totliq:      number;
  ped_total_quant: number;
  cli_nomred:      string;
  cli_nome:        string;
  for_nomered:     string;
}

type Filter = 'Todos' | 'Cotação' | 'Faturado' | 'Offline';

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s: string) => {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const SIT_LABEL: Record<string, string> = {
  P: 'Pedido', F: 'Faturado', C: 'Cotação', E: 'Excluído',
};
const SIT_COLOR: Record<string, string> = {
  P: '#2563EB', F: '#16A34A', C: '#D97706', E: '#DC2626',
};
const SIT_ICON: Record<string, any> = {
  P: Send, F: CheckCircle2, C: FileText,
};

export default function PedidosPage() {
  const navigate = useNavigate();
  const { isOnline }          = useOffline();
  const { queueCount, upload } = useSync();

  const [apiOrders,  setApiOrders]  = useState<ApiOrder[]>([]);
  const [offlineOrders, setOfflineOrders] = useState<MobileOrder[]>([]);
  const [queued,     setQueued]     = useState<QueuedOrder[]>([]);
  const [filter,     setFilter]     = useState<Filter>('Todos');
  const [search,     setSearch]     = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [sharing,    setSharing]    = useState<number | null>(null);
  const [irisHint,   setIrisHint]   = useState(() => localStorage.getItem('iris_wa_hint_dismissed') !== '1');

  const loadLocal = () => {
    db.orders.orderBy('data_pedido').reverse().toArray()
      .then(rows => setOfflineOrders(rows.filter(o => o.situacao !== 'E')));
    db.queue.where('status').anyOf('pendente', 'erro').toArray().then(setQueued);
  };

  const loadOnline = () => {
    setLoading(true);
    api.get('/orders?limit=100')
      .then(r => setApiOrders((r.data.pedidos || []).filter((o: ApiOrder) => o.ped_situacao !== 'E')))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLocal();
    if (isOnline) loadOnline();
  }, [isOnline]);

  const orders = isOnline ? apiOrders : offlineOrders;

  const shown = useMemo(() => {
    let list = orders as any[];
    if (filter === 'Cotação')  list = list.filter((o: any) => (o.ped_situacao || o.situacao) === 'C');
    if (filter === 'Faturado') list = list.filter((o: any) => (o.ped_situacao || o.situacao) === 'F');
    if (filter === 'Offline')  return [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o: any) =>
        (o.cli_nomred || o.cliente_nome || '').toLowerCase().includes(q) ||
        (o.for_nomered || o.industria_nome || '').toLowerCase().includes(q) ||
        String(o.ped_numero).includes(q)
      );
    }
    return list;
  }, [orders, filter, search]);

  const handleUpload = async () => {
    if (!isOnline || uploading) return;
    setUploading(true);
    try {
      await upload();
      loadLocal();
      loadOnline();
    } finally {
      setUploading(false);
    }
  };

  const FILTERS: Filter[] = ['Todos', 'Cotação', 'Faturado', 'Offline'];

  const shareWhatsApp = async (o: any) => {
    const num = getNum(o);
    setSharing(num);
    try {
      const pedido = o.ped_pedido || String(num);
      const r = await api.get(`/orders/${encodeURIComponent(pedido)}`, { params: { industria: o.ped_industria } });
      const itens: any[] = r.data.itens || r.data.items || [];
      const totalQtd = itens.reduce((s: number, i: any) => s + Number(i.ite_quant ?? i.ite_quantidade ?? 0), 0);
      const totalVal = Number(o.ped_totliq ?? o.valor_total ?? 0);
      const msg = encodeURIComponent(
        `*Cotação — ${getNome(o)}*\n` +
        `_${getInd(o)}${getTabela(o) ? ` · ${getTabela(o)}` : ''}_\n\n` +
        itens.map((i: any) => {
          const cod  = String(i.ite_produto || '').trim();
          const nome = String(i.ite_nomeprod || i.ite_descricao || '').slice(0, 28);
          const qty  = Number(i.ite_quant ?? i.ite_quantidade ?? 0);
          const uni  = Number(i.ite_puni ?? i.ite_preco ?? 0);
          const tot  = Number(i.ite_totbruto ?? i.ite_total ?? uni * qty);
          return `• *${cod}* ${nome}\n  ${qty} un × ${fmtBRL(uni)} = *${fmtBRL(tot)}*`;
        }).join('\n') +
        `\n\n*Total: ${fmtBRL(totalVal)}* (${totalQtd} un)`
      );
      window.open(`https://wa.me/?text=${msg}`, '_blank');
      // Marca cotação como enviada → IRIS detecta ped_enviado='S' AND ped_dataenvio IS NULL
      api.patch(`/orders/${pedido}/status-envio`, { enviado: 'S' }).catch(() => {});
    } catch {
      // fallback sem itens
      const totalVal = Number(o.ped_totliq ?? o.valor_total ?? 0);
      const msg = encodeURIComponent(
        `*Cotação — ${getNome(o)}*\n_${getInd(o)}_\n\n*Total: ${fmtBRL(totalVal)}*`
      );
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    } finally {
      setSharing(null);
    }
  };

  const getSit    = (o: any) => o.ped_situacao || o.situacao || 'C';
  const getNome   = (o: any) => o.cli_nomred || o.cliente_nome || '—';
  const getInd    = (o: any) => o.for_nomered || o.industria_nome || '—';
  const getTabela = (o: any) => o.ped_tabela || '';
  const getTotal  = (o: any) => Number(o.ped_totliq ?? o.valor_total ?? 0);
  const getQtd    = (o: any) => Number(o.ped_total_quant ?? 0);
  const getData   = (o: any) => o.ped_data || o.data_pedido || '';
  const getNum    = (o: any) => o.ped_numero;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="Pedidos" helpItems={[
        { icon: '📋', title: 'Cotações e pedidos',      text: 'Aqui aparecem todas as cotações digitadas no celular e os pedidos confirmados no computador.' },
        { icon: '💬', title: 'Compartilhar pelo WhatsApp', text: 'Toque no ícone verde em qualquer cotação para enviar os itens e o total ao cliente pelo WhatsApp.' },
        { icon: '🤖', title: 'IRIS envia e-mail',       text: 'Ao compartilhar pelo WhatsApp, a IRIS envia automaticamente um e-mail com a cotação para o e-mail do lojista.' },
        { icon: '📤', title: 'Pedidos offline',         text: 'Cotações digitadas sem internet ficam na aba "Offline". Quando reconectar, toque em "Enviar" para subir tudo de uma vez.' },
        { icon: '🔍', title: 'Busca rápida',            text: 'Use a barra de busca para encontrar por nome do cliente, indústria ou número do pedido.' },
      ]} />

      {/* ── Filters + search ───────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>
        <input
          placeholder="Buscar por cliente, indústria ou nº..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' as const,
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {FILTERS.map(f => {
            const count = f === 'Offline' ? queued.length : undefined;
            return (
              <button key={f} onClick={() => setFilter(f)} className="pill" style={{
                background: filter === f ? 'var(--navy)' : 'var(--sand-card)',
                color:      filter === f ? '#FFF'        : 'var(--navy)',
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {f}
                {count !== undefined && count > 0 && (
                  <span style={{
                    background: '#DC2626', color: '#FFF',
                    borderRadius: 8, fontSize: 9, fontWeight: 900,
                    padding: '1px 5px', lineHeight: 1.5,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Aviso IRIS WhatsApp ─────────────────────────────────────────────── */}
      {irisHint && (
        <div style={{
          margin: '8px 16px 0', borderRadius: 12, padding: '10px 12px 10px 14px',
          background: 'linear-gradient(135deg, #1E3A5F 0%, #28374A 100%)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <Sparkles size={15} color="#FFD200" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,.85)', lineHeight: 1.55 }}>
            <span style={{ fontWeight: 800, color: '#FFD200' }}>IRIS ativada:</span>
            {' '}ao compartilhar uma cotação pelo{' '}
            <MessageCircle size={11} color="#4ADE80" style={{ verticalAlign: 'middle' }} />{' '}
            <span style={{ color: '#4ADE80', fontWeight: 700 }}>WhatsApp</span>,
            a IRIS envia automaticamente um e-mail com a cotação ao lojista.
          </div>
          <button
            onClick={() => { setIrisHint(false); localStorage.setItem('iris_wa_hint_dismissed', '1'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              padding: 2, flexShrink: 0, marginTop: 1, opacity: 0.5 }}>
            <X size={13} color="#fff" />
          </button>
        </div>
      )}

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 80px' }}>

        {/* Offline queue */}
        {filter === 'Offline' && (
          <>
            {queued.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
                Nenhum pedido pendente de envio.
              </div>
            ) : (
              <>
                {isOnline && (
                  <button onClick={handleUpload} disabled={uploading} style={{
                    width: '100%', padding: 13, borderRadius: 14, border: 'none',
                    background: 'var(--navy)', color: '#FFF',
                    fontSize: 14, fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer',
                    marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: uploading ? 0.7 : 1,
                  }}>
                    <UploadCloud size={16} />
                    {uploading ? 'Enviando...' : `Enviar ${queued.length} pedido${queued.length > 1 ? 's' : ''}`}
                  </button>
                )}
                {queued.map(q => (
                  <div key={q.id} className="card" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                          {(q.payload as any).ped_cliente
                            ? `Cliente #${(q.payload as any).ped_cliente}`
                            : 'Pedido avulso'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 2 }}>
                          {((q.payload as any).itens as any[])?.length ?? 0} item(s) · {fmtDate(q.createdAt)}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: q.status === 'erro' ? '#DC26261A' : '#D974061A',
                        color:      q.status === 'erro' ? '#DC2626'   : '#D97706',
                      }}>
                        {q.status === 'erro' ? 'Erro' : 'Aguardando'}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* Regular orders */}
        {filter !== 'Offline' && (
          <>
            {loading && (
              <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
                Carregando...
              </div>
            )}
            {!loading && shown.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
                {orders.length === 0
                  ? 'Nenhum pedido encontrado.'
                  : 'Nenhum resultado encontrado.'}
              </div>
            )}
            {!loading && shown.map((o: any) => {
              const sit   = getSit(o);
              const color = SIT_COLOR[sit] ?? '#9CA3AF';
              const label = SIT_LABEL[sit] ?? sit;
              const Icon  = SIT_ICON[sit]  ?? Clock;
              const qtd   = getQtd(o);
              const tab   = getTabela(o);
              return (
                <div key={`${getNum(o)}-${getData(o)}`} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getNome(o)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getInd(o)}
                      </div>
                      {tab && (
                        <div style={{ fontSize: 10, color: 'var(--navy-muted)', marginTop: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontStyle: 'italic' }}>
                          {tab}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--navy)',
                          fontFamily: 'monospace' }}>
                          #{getNum(o)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--navy-muted)' }}>
                          {fmtDate(getData(o))}
                        </span>
                        {qtd > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--navy-muted)' }}>
                            · {qtd} un
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)',
                        fontFamily: 'monospace' }}>
                        {fmtBRL(getTotal(o))}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700,
                          color, background: `${color}1A`,
                          padding: '3px 8px', borderRadius: 6,
                        }}>
                          <Icon size={10} />
                          {label}
                        </span>
                        <button
                          onClick={() => shareWhatsApp(o)}
                          disabled={sharing === getNum(o)}
                          style={{
                            width: 28, height: 28, borderRadius: 8, border: '1px solid #16A34A',
                            background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: sharing === getNum(o) ? 0.5 : 1,
                          }}>
                          <MessageCircle size={13} color="#16A34A" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── FAB Novo Pedido ─────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/mobile/clientes?for=pedido')}
        style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 90,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'var(--mustard)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(40,55,74,0.25)',
        }}
      >
        <Plus size={24} color="var(--navy)" strokeWidth={3} />
      </button>
    </div>
  );
}
