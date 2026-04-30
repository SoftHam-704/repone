import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast }        from 'sonner';
import { api }          from '@/shared/lib/api';
import { db }           from '../db/db';
import { useOffline }   from '../hooks/useOffline';
import { useSync }      from '../hooks/useSync';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileProduct, MobilePrice } from '../db/types';

interface LineItem {
  product: MobileProduct;
  price:   MobilePrice | null;
  qty:     number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PedidoPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { isOnline }          = useOffline();
  const { refreshQueueCount } = useSync();

  const clienteId = params.get('cliente');

  const [industrias,   setIndustrias]   = useState<{ id: number; nome: string }[]>([]);
  const [selectedInd,  setSelectedInd]  = useState<number | null>(null);
  const [search,       setSearch]       = useState('');
  const [products,     setProducts]     = useState<MobileProduct[]>([]);
  const [items,        setItems]        = useState<LineItem[]>([]);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    api.get('/aux/industrias')
      .then(r => {
        const inds = (r.data.data || []).map((f: any) => ({
          id:   Number(f.for_codigo),
          nome: f.for_nomered || f.for_nome,
        }));
        setIndustrias(inds);
        if (inds.length > 0) setSelectedInd(inds[0].id);
      })
      .catch(() => {});
  }, []);

  const searchProducts = useCallback(async () => {
    if (!selectedInd || !search.trim()) { setProducts([]); return; }
    if (isOnline) {
      try {
        const r = await api.get(
          `/products/catalog/${selectedInd}?search=${encodeURIComponent(search)}`
        );
        setProducts((r.data.data || []).map((p: any) => ({
          pro_codprod:   String(p.pro_codprod),
          pro_nome:      p.pro_nome || '',
          pro_industria: Number(selectedInd),
          unidade:       p.pro_undven || p.unidade || 'UN',
        })));
        return;
      } catch { /* fall through to offline */ }
    }
    const q = search.toLowerCase();
    const found = await db.products
      .where('pro_industria').equals(selectedInd)
      .filter(p =>
        p.pro_codprod.toLowerCase().includes(q) ||
        p.pro_nome.toLowerCase().includes(q)
      )
      .limit(50)
      .toArray();
    setProducts(found);
  }, [selectedInd, search, isOnline]);

  useEffect(() => { searchProducts(); }, [searchProducts]);

  const addItem = async (product: MobileProduct) => {
    const existing = items.find(i => i.product.pro_codprod === product.pro_codprod);
    if (existing) {
      setItems(prev =>
        prev.map(i =>
          i.product.pro_codprod === product.pro_codprod
            ? { ...i, qty: i.qty + 1 } : i
        )
      );
      return;
    }
    const price = await db.prices.where('pro_codprod').equals(product.pro_codprod).first() ?? null;
    setItems(prev => [...prev, { product, price, qty: 1 }]);
  };

  const updateQty = (codprod: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.product.pro_codprod !== codprod));
    } else {
      setItems(prev =>
        prev.map(i => i.product.pro_codprod === codprod ? { ...i, qty } : i)
      );
    }
  };

  const total = items.reduce((s, i) => s + (i.price?.preco ?? 0) * i.qty, 0);

  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    const payload = {
      ped_cliente:   clienteId ? Number(clienteId) : null,
      ped_industria: selectedInd,
      itens: items.map(i => ({
        pro_codprod: i.product.pro_codprod,
        qtd:         i.qty,
        preco:       i.price?.preco ?? 0,
      })),
    };
    try {
      if (isOnline) {
        await api.post('/orders', payload);
        toast.success('Pedido enviado com sucesso');
      } else {
        await db.queue.add({
          payload,
          createdAt: new Date().toISOString(),
          status:    'pendente',
        });
        await refreshQueueCount();
        toast.success('Pedido salvo — será enviado ao reconectar');
      }
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar pedido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="Novo Pedido" showBack />

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto',
        padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
        paddingBottom: items.length > 0 ? 90 : 16 }}>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {industrias.map(ind => (
            <button key={ind.id}
              onClick={() => { setSelectedInd(ind.id); setSearch(''); setProducts([]); }}
              className="pill"
              style={{ background: selectedInd === ind.id ? 'var(--navy)' : 'var(--sand-card)',
                color: selectedInd === ind.id ? '#FFF' : 'var(--navy)', flexShrink: 0 }}>
              {ind.nome}
            </button>
          ))}
        </div>

        <input
          placeholder="Buscar produto por código ou nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' as const }}
        />

        {products.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {products.slice(0, 30).map(p => {
              const inCart = !!items.find(i => i.product.pro_codprod === p.pro_codprod);
              return (
                <div key={p.pro_codprod} className="prod-row"
                  onClick={() => addItem(p)} style={{ opacity: inCart ? 0.5 : 1 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                    color: '#1D4ED8', minWidth: 72 }}>{p.pro_codprod}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>{p.pro_nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--navy-muted)' }}>{p.unidade}</span>
                  {inCart && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mustard)' }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy-muted)',
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              Itens do pedido
            </div>
            {items.map((item, idx) => (
              <div key={item.product.pro_codprod} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingBottom: 10, marginBottom: 10,
                borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700,
                    fontSize: 11, color: '#1D4ED8' }}>{item.product.pro_codprod}</div>
                  <div style={{ fontSize: 12, color: 'var(--navy)', marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.product.pro_nome}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 1 }}>
                    {item.price ? fmtBRL(item.price.preco) : '—'} / {item.product.unidade}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => updateQty(item.product.pro_codprod, item.qty - 1)}
                    style={{ width: 28, height: 28, borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--sand-bg)',
                      cursor: 'pointer', color: 'var(--navy)', fontWeight: 700, fontSize: 16 }}>
                    −
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)',
                    minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.product.pro_codprod, item.qty + 1)}
                    style={{ width: 28, height: 28, borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--sand-bg)',
                      cursor: 'pointer', color: 'var(--navy)', fontWeight: 700, fontSize: 16 }}>
                    +
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between',
              paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-muted)' }}>
                Total
              </span>
              <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--navy)' }}>
                {fmtBRL(total)}
              </span>
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0,
          padding: '10px 16px', background: 'var(--sand-bg)',
          borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none',
              background: 'var(--mustard)', color: 'var(--navy)',
              fontSize: 15, fontWeight: 800,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : isOnline
              ? `Enviar Pedido — ${fmtBRL(total)}`
              : `Salvar Offline — ${fmtBRL(total)}`}
          </button>
        </div>
      )}
    </div>
  );
}