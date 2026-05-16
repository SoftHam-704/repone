import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8',
  text: '#28374A', muted: '#7A8899', mustard: '#FFD200',
  navy: '#1E2D3D', surface: '#FDFBF7',
};
const MONO = '"SF Mono", ui-monospace, "Cascadia Mono", "Roboto Mono", Menlo, monospace';
const BASE = (import.meta as any).env?.VITE_API_URL || '';

interface ModalItem {
  codigo: string;
  nome: string;
  quantidade: number;
  ultima_compra?: string;
  selected: boolean;
}

interface Props {
  mode: 'mix' | 'esquecidos' | 'catalogo';
  industria: string;
  token: string;
  schema: string;
  insightsMix: Array<{ codigo: string; nome: string; quantidade: number }>;
  insightsEsquecidos: Array<{ codigo: string; nome: string; ultima_compra?: string }>;
  onConfirm: (items: { codigo: string; quantidade: number }[]) => void;
  onClose: () => void;
}

export default function QuickActionModal({
  mode, industria, token, schema,
  insightsMix, insightsEsquecidos,
  onConfirm, onClose,
}: Props) {
  const [items, setItems]             = useState<ModalItem[]>([]);
  const [search, setSearch]           = useState('');
  const [categoria, setCategoria]     = useState('');
  const [categorias, setCategorias]   = useState<string[]>([]);
  const [catTotal, setCatTotal]       = useState(0);
  const [catOffset, setCatOffset]     = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inicializar itens para mix e esquecidos
  useEffect(() => {
    if (mode === 'mix') {
      setItems(insightsMix.map(i => ({ ...i, selected: true })));
    } else if (mode === 'esquecidos') {
      setItems(insightsEsquecidos.map(i => ({
        codigo: i.codigo, nome: i.nome, quantidade: 1,
        ultima_compra: i.ultima_compra, selected: false,
      })));
    }
  }, [mode]);

  // Catálogo: carga inicial
  useEffect(() => {
    if (mode !== 'catalogo') return;
    const controller = new AbortController();
    loadCatalog(0, '', '', controller.signal);
    return () => controller.abort();
  }, [mode]);

  async function loadCatalog(off: number, q: string, cat: string, signal?: AbortSignal) {
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ t: token, s: schema, industria, q, categoria: cat, limit: '20', offset: String(off) });
      const r  = await fetch(`${BASE}/api/portal-pub/produtos?${qs}`, { signal });
      if (signal?.aborted) return;
      const d  = await r.json();
      if (!d.success) return;
      setCatTotal(d.total);
      const novos: ModalItem[] = d.produtos.map((p: any) => ({
        codigo: p.codigo, nome: p.nome, quantidade: 1, selected: false,
      }));
      if (off === 0) {
        setCategorias(d.categorias || []);
        setItems(novos);
      } else {
        setItems(prev => [...prev, ...novos]);
      }
      setCatOffset(off + d.produtos.length);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }

  function handleSearch(q: string) {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadCatalog(0, q, categoria), 300);
  }

  function handleCategoria(cat: string) {
    setCategoria(cat);
    loadCatalog(0, search, cat);
  }

  function toggleItem(idx: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  }

  function setQtd(idx: number, v: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: Math.max(1, v || 1) } : it));
  }

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Limpar timer de busca no unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const selected = items.filter(i => i.selected);

  const titles = {
    mix:        '🔄 Repetir meu mix',
    esquecidos: '⚠️ Produtos esquecidos',
    catalogo:   '📋 Explorar catálogo',
  };
  const subtitles = {
    mix:        'Selecione os produtos do seu último pedido',
    esquecidos: 'Produtos comprados há mais de 90 dias',
    catalogo:   '',
  };

  return (
    <div
      onClick={e => { if ((e.target as HTMLElement).dataset.backdrop) onClose(); }}
      data-backdrop="1"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: G.surface, borderRadius: 16,
        width: '100%', maxWidth: 480, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>

        {/* Cabeçalho */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: G.text }}>{titles[mode]}</div>
            {subtitles[mode] && <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>{subtitles[mode]}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Busca + chips de categoria (catálogo) */}
        {mode === 'catalogo' && (
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${G.border}` }}>
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 13,
                padding: '8px 12px', borderRadius: 8,
                border: `1.5px solid ${G.border}`, background: G.card,
                color: G.text, outline: 'none',
              }}
            />
            {categorias.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {['', ...categorias].map(cat => (
                  <button key={cat} onClick={() => handleCategoria(cat)} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                    border: 'none', cursor: 'pointer',
                    background: categoria === cat ? G.navy : G.bg,
                    color: categoria === cat ? G.mustard : G.text,
                  }}>
                    {cat === '' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: G.muted, marginTop: 6 }}>{catTotal} produtos</div>
          </div>
        )}

        {/* Lista de itens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px' }}>
          {items.length === 0 && !loadingMore && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: G.muted, fontSize: 13 }}>
              {mode === 'catalogo' ? 'Nenhum produto encontrado.' : 'Nenhum item disponível.'}
            </div>
          )}
          {loadingMore && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: G.muted, fontSize: 13 }}>
              Buscando produtos...
            </div>
          )}
          {items.map((item, idx) => (
            <div key={item.codigo} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: `1px solid ${G.border}`,
            }}>
              <input
                type="checkbox"
                checked={item.selected}
                onChange={() => toggleItem(idx)}
                style={{ width: 16, height: 16, accentColor: '#2D4A3E', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: G.text, fontFamily: MONO }}>{item.codigo}</div>
                <div style={{ fontSize: 11, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</div>
                {item.ultima_compra && (
                  <div style={{ fontSize: 10, color: G.muted }}>
                    Última compra: {new Date(item.ultima_compra).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              <input
                type="number"
                min={1}
                value={item.quantidade}
                onChange={e => setQtd(idx, parseInt(e.target.value, 10))}
                style={{
                  width: 52, fontSize: 12, fontWeight: 700, padding: '4px 6px',
                  borderRadius: 6, border: `1px solid ${G.border}`,
                  textAlign: 'center', color: G.text, background: G.card,
                }}
              />
            </div>
          ))}

          {mode === 'catalogo' && items.length < catTotal && (
            <button
              onClick={() => loadCatalog(catOffset, search, categoria)}
              disabled={loadingMore}
              style={{
                width: '100%', margin: '12px 0 4px',
                background: G.bg, border: `1px solid ${G.border}`,
                borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700,
                color: G.text, cursor: loadingMore ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingMore ? 'Carregando...' : `Carregar mais (${catTotal - items.length} restantes)`}
            </button>
          )}
        </div>

        {/* Rodapé CTA */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${G.border}` }}>
          <button
            onClick={() => onConfirm(selected.map(i => ({ codigo: i.codigo, quantidade: i.quantidade })))}
            disabled={selected.length === 0}
            style={{
              width: '100%',
              background: selected.length > 0 ? G.navy : G.border,
              color: selected.length > 0 ? G.mustard : G.muted,
              border: 'none', borderRadius: 10, padding: '12px',
              fontSize: 13, fontWeight: 900,
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {selected.length > 0
              ? `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'} à cotação`
              : 'Selecione ao menos um item'}
          </button>
        </div>
      </div>
    </div>
  );
}
