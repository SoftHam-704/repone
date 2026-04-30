import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Search, PackageSearch, Trash2, Plus,
  AlertCircle, CheckCircle2, Building2, ArrowUpRight, Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { toast } from 'sonner';
import { G } from '@/shared/components/layout/CadastroShell';
import { BatchImportTab } from '../components/BatchImportTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  cli_codigo: number;
  cli_nome: string;
  cli_nomred: string;
  cli_cnpj: string;
}

interface BucketItem {
  pro_id: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  preco_bruto: number;
  preco_unitario: number;
  total: number;
  industria_id: number;
  industria_nome: string;
  is_promo: boolean;
  tabela: string;
  descontos: Record<string, number>;
}

interface Bucket {
  id?: number;
  industria_id: number;
  industria_nome: string;
  items: BucketItem[];
  total: number;
  client: Client;
}

// ─── Client search input ──────────────────────────────────────────────────────

function ClientSearch({ value, onChange }: { value: Client | null; onChange: (c: Client | null) => void }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!q || q.length < 2) { setOptions([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/clients?search=${encodeURIComponent(q)}&limit=20`);
        setOptions(res.data.data || []);
        setOpen(true);
      } catch { setOptions([]); }
      finally { setLoading(false); }
    }, 300);
  }, [q]);

  const select = (c: Client) => {
    onChange(c);
    setQ('');
    setOpen(false);
    setOptions([]);
  };

  const clear = () => { onChange(null); setQ(''); };

  if (value) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderRadius: 8,
        border: `1px solid #10B981`, background: '#F0FDF4',
      }}>
        <CheckCircle2 size={14} color="#10B981" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#065F46' }}>
          {value.cli_nomred || value.cli_nome}
        </span>
        <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input
          type="text"
          placeholder="Comece a digitar o nome..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => options.length > 0 && setOpen(true)}
          style={{
            width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8,
            border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
            boxSizing: 'border-box', background: '#F8FAFC',
          }}
        />
        {loading && <Loader2 size={12} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', animation: 'spin 1s linear infinite' }} />}
      </div>
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto',
        }}>
          {options.map(c => (
            <div
              key={c.cli_codigo}
              onClick={() => select(c)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ fontWeight: 700, color: '#1E293B' }}>{c.cli_nomred || c.cli_nome}</div>
              <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>{c.cli_cnpj}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bucket Card ──────────────────────────────────────────────────────────────

function BucketCard({ bucket, onRemove }: { bucket: Bucket; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? bucket.items : bucket.items.slice(0, 3);
  const hiddenCount  = bucket.items.length - 3;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: 20,
      border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, background: '#F1F5F9',
            border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#64748B',
          }}>
            {(bucket.client?.cli_nomred || bucket.client?.cli_nome || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {bucket.industria_nome}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {bucket.client?.cli_nomred || bucket.client?.cli_nome}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 4, background: '#FFFBEB', color: '#92400E', border: '1px solid #FEF3C7', textTransform: 'uppercase' }}>
            Aguardando
          </span>
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Fábrica badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', width: 'fit-content' }}>
        <Building2 size={9} color="#10B981" />
        <span style={{ fontSize: 9, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Fábrica: {bucket.industria_id}
        </span>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleItems.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, background: '#fff',
                border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#1E293B', flexShrink: 0,
              }}>
                {item.quantidade}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.codigo}</div>
                <div style={{ fontSize: 9, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.descricao}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#1E293B', flexShrink: 0, marginLeft: 8 }}>
              {fmt(item.preco_unitario)}
            </div>
          </div>
        ))}
        {!expanded && hiddenCount > 0 && (
          <button onClick={() => setExpanded(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 9,
            fontWeight: 900, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4,
          }}>
            + {hiddenCount} itens ocultos <ArrowUpRight size={9} />
          </button>
        )}
      </div>

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: '#F1F5F9', borderRadius: 10, padding: '8px 10px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Tabela</div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#1E293B' }}>{bucket.items[0]?.tabela || '—'}</div>
        </div>
        <div style={{ background: '#EEFDF6', borderRadius: 10, padding: '8px 10px', border: '1px solid #D1FAE5', textAlign: 'right' }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: '#065F46', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#065F46' }}>{fmt(bucket.total)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SmartImporterPage() {
  const user = useAuthStore(s => s.user);

  const [activeTab,      setActiveTab]      = useState<'rapido' | 'lote'>('rapido');
  const [pasteArea,      setPasteArea]      = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [buckets,        setBuckets]        = useState<Bucket[]>([]);
  const [notFound,       setNotFound]       = useState<{ codigo: string; quantidade: number; motivo: string }[]>([]);

  // Iniciais do usuário
  const userInitials = user
    ? ((user.nome?.charAt(0) || '') + (user.sobrenome?.charAt(0) || user.nome?.charAt(1) || '')).toUpperCase()
    : 'SI';

  // Carregar rascunhos ao montar
  useEffect(() => {
    api.get('/smart-importer/drafts')
      .then(res => { if (res.data.success) setBuckets(res.data.data || []); })
      .catch(() => {});
  }, []);

  const syncDraft = useCallback(async (bucket: Bucket) => {
    try {
      await api.post('/smart-importer/drafts', {
        cli_codigo:     bucket.client.cli_codigo,
        industria_id:   bucket.industria_id,
        industria_nome: bucket.industria_nome,
        items:          bucket.items,
        total:          bucket.total,
      });
    } catch { /* não crítico */ }
  }, []);

  const handleAnalyze = async () => {
    if (!pasteArea.trim()) { toast.error('Cole os códigos e quantidades primeiro.'); return; }
    if (!selectedClient)   { toast.error('Selecione um cliente.'); return; }

    setIsProcessing(true);
    try {
      const lines = pasteArea.split('\n').filter(l => l.trim().length > 0);
      const items = lines.map(line => {
        const parts = line.split(/[\s\t;]+/).filter(p => p.trim().length > 0);
        const codigo     = parts[0];
        const quantidade = parts.length > 1 ? parseFloat(parts[1].replace(',', '.')) : 1;
        return { codigo, quantidade: isNaN(quantidade) ? 1 : quantidade };
      });

      const res = await api.post('/smart-importer/analyze', {
        cli_codigo: selectedClient.cli_codigo,
        items,
      });

      if (res.data.success) {
        const updatedBuckets = [...buckets];

        for (const group of res.data.grouped) {
          const existingIdx = updatedBuckets.findIndex(b =>
            b.industria_id === group.industria_id &&
            b.client?.cli_codigo === selectedClient.cli_codigo
          );

          let entry: Bucket;
          if (existingIdx >= 0) {
            group.items.forEach((newItem: BucketItem) => {
              const itemIdx = updatedBuckets[existingIdx].items.findIndex(i => i.codigo === newItem.codigo);
              if (itemIdx >= 0) {
                updatedBuckets[existingIdx].items[itemIdx].quantidade += newItem.quantidade;
                updatedBuckets[existingIdx].items[itemIdx].total      += newItem.total;
              } else {
                updatedBuckets[existingIdx].items.push(newItem);
              }
              updatedBuckets[existingIdx].total += newItem.total;
            });
            entry = updatedBuckets[existingIdx];
          } else {
            entry = { ...group, client: selectedClient };
            updatedBuckets.unshift(entry);
          }

          await syncDraft(entry);
        }

        setBuckets(updatedBuckets);
        setNotFound(res.data.notFound || []);
        setPasteArea('');
        setSelectedClient(null);
        toast.success('Análise concluída! Rascunhos salvos.');
      } else {
        toast.error(res.data.message || 'Erro ao analisar.');
      }
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveBucket = async (idx: number) => {
    const bucket = buckets[idx];
    if (bucket.id) {
      try { await api.delete(`/smart-importer/drafts/${bucket.id}`); } catch { /* ok */ }
    }
    setBuckets(prev => prev.filter((_, i) => i !== idx));
  };

  const handleClearAll = async () => {
    try { await api.delete('/smart-importer/drafts/all'); } catch { /* ok */ }
    setBuckets([]);
    setNotFound([]);
    setPasteArea('');
    setSelectedClient(null);
  };

  const handleCheckout = async () => {
    if (buckets.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await api.post('/smart-importer/checkout', {
        buckets,
        user_initials: userInitials,
      });

      if (res.data.success) {
        toast.success(res.data.message);
        setBuckets([]);
        setNotFound([]);
      } else {
        toast.error(res.data.message || 'Erro ao faturar pedidos.');
      }
    } catch {
      toast.error('Erro de conexão ao tentar faturar.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 900, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8FAFC', fontFamily: 'IBM Plex Sans, sans-serif', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, background: '#F1F5F9', borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <ShoppingCart size={18} color="#10B981" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1E293B' }}>Carrinho em Lote</div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 1 }}>Prepare cotações o dia todo sem usar Excel.</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4 }}>
          {([
            { key: 'rapido', label: 'Rascunho Rápido',    Icon: ShoppingCart },
            { key: 'lote',   label: 'Importar por Arquivo', Icon: FileSpreadsheet },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 7, border: 'none',
                background: activeTab === key ? '#fff' : 'transparent',
                color: activeTab === key ? '#1E293B' : '#64748B',
                fontWeight: activeTab === key ? 800 : 600,
                fontSize: 12, cursor: 'pointer',
                boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {buckets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleClearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={14} /> Limpar Tudo
            </button>
            <button
              onClick={handleCheckout}
              disabled={isProcessing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#10B981', color: '#fff', padding: '8px 18px',
                borderRadius: 8, border: 'none', fontWeight: 900, fontSize: 13,
                cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1,
              }}
            >
              {isProcessing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
              Faturar {buckets.length} {buckets.length === 1 ? 'Carrinho' : 'Carrinhos'}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 20, padding: 20 }}>

        {/* ── TAB: Importar por Arquivo ─────────────────────────────────────── */}
        {activeTab === 'lote' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <BatchImportTab />
          </div>
        )}

        {activeTab === 'rapido' && <>

        {/* Esquerda — Input */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column',
            flex: 1, position: 'relative', overflow: 'hidden',
          }}>
            {/* Gradiente decorativo */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to right, #60A5FA, #10B981)' }} />

            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 14, color: '#1E293B' }}>
                  <Plus size={16} color="#60A5FA" /> Capturar Novos Itens
                </div>
                <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Rascunho Rápido
                </span>
              </div>

              {/* Cliente */}
              <div>
                <span style={labelStyle}>1. Destinatário (Cliente)</span>
                <ClientSearch value={selectedClient} onChange={setSelectedClient} />
              </div>

              {/* Paste area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={labelStyle}>2. Códigos e Quantidades</span>
                <textarea
                  value={pasteArea}
                  onChange={e => setPasteArea(e.target.value)}
                  placeholder={'Cole aqui direto do Excel ou TXT:\n\n4PK1038\t30\n6001DDUC3\t15\nAKX35181\t8'}
                  style={{
                    flex: 1, minHeight: 220, resize: 'none', padding: 14,
                    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                    fontFamily: 'monospace', fontSize: 12, color: '#1E293B',
                    outline: 'none', lineHeight: 1.6,
                  }}
                />
                <div style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic', marginTop: 6 }}>
                  * O sistema descobrirá a fábrica e aplicará a tabela do cliente automaticamente.
                </div>
              </div>

              {/* Button */}
              <button
                onClick={handleAnalyze}
                disabled={!pasteArea.trim() || !selectedClient || isProcessing}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: (!pasteArea.trim() || !selectedClient || isProcessing) ? '#F1F5F9' : '#1E293B',
                  color: (!pasteArea.trim() || !selectedClient || isProcessing) ? '#94A3B8' : '#fff',
                  padding: '12px 0', borderRadius: 10, border: 'none',
                  fontWeight: 900, fontSize: 13, cursor: (!pasteArea.trim() || !selectedClient || isProcessing) ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processando...</>
                  : <><PackageSearch size={16} /> Distribuir itens no carrinho</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Direita — Carrinhos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Carrinhos header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 14, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              <ShoppingCart size={20} color="#FB923C" />
              Carrinhos de Faturamento do Dia
            </div>
            {buckets.length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 999, background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EAB308' }} />
                {buckets.length} {buckets.length === 1 ? 'CARRINHO AGUARDANDO' : 'CARRINHOS AGUARDANDO'}
              </div>
            )}
          </div>

          {/* Not found alert */}
          {notFound.length > 0 && (
            <div style={{ marginBottom: 12, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12, display: 'flex', gap: 12 }}>
              <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 12, color: '#991B1B' }}>Itens não identificados ({notFound.length})</div>
                <div style={{ fontSize: 11, color: '#991B1B', opacity: 0.8, marginTop: 2 }}>Alguns códigos não foram encontrados ou não possuem preço cadastrado.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {notFound.slice(0, 8).map((nf, i) => (
                    <span key={i} style={{ padding: '2px 7px', borderRadius: 4, background: '#fff', border: '1px solid #FEE2E2', fontSize: 9, fontWeight: 900, color: '#DC2626', fontFamily: 'monospace' }}>
                      {nf.codigo}
                    </span>
                  ))}
                  {notFound.length > 8 && <span style={{ fontSize: 9, fontWeight: 900, color: '#DC2626' }}>+{notFound.length - 8}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Grid de carrinhos */}
          {buckets.length === 0 ? (

            <div style={{
              flex: 1, background: '#F1F5F9', border: '2px dashed #E2E8F0', borderRadius: 16,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <div style={{ width: 72, height: 72, background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={36} color="#94A3B8" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B' }}>Seu carrinho está vazio</div>
              <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                Use o campo à esquerda para selecionar um cliente e colar uma lista de produtos. Eu vou separar tudo automaticamente por fábrica.
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {buckets.map((bucket, idx) => (
                  <BucketCard
                    key={`${bucket.industria_id}-${bucket.client?.cli_codigo}-${idx}`}
                    bucket={bucket}
                    onRemove={() => handleRemoveBucket(idx)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        </>}

      </div>
    </div>
  );
}
