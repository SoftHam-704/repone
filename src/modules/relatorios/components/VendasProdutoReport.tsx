import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, AlertCircle, Printer, X } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria  { for_codigo: number; for_nomered: string }
interface ProdResult { id: string; nome: string; referencia: string }
interface Row {
  cli_nomred: string;
  data_compra: string;
  dias_sem_compra: number;
  ped_numero: number;
  ite_quantidade: number;
  ite_valorunit: number;
}

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const inp: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none', width: '100%',
};
const th: React.CSSProperties = {
  padding: '9px 12px', fontSize: 10, fontWeight: 800, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: 0.7,
  borderBottom: `2px solid ${G.border}`, background: G.cardHi, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '7px 12px', fontSize: 11, borderBottom: `1px solid ${G.border}`, color: G.text,
};

export default function VendasProdutoReport() {
  const [industrias, setIndustrias]   = useState<Industria[]>([]);
  const [selInd,     setSelInd]       = useState('');
  const [query,      setQuery]        = useState('');
  const [suggestions, setSuggestions] = useState<ProdResult[]>([]);
  const [selProd,    setSelProd]      = useState<ProdResult | null>(null);
  const [showDrop,   setShowDrop]     = useState(false);
  const [searching,  setSearching]    = useState(false);
  const [rows,       setRows]         = useState<Row[]>([]);
  const [loading,    setLoading]      = useState(false);
  const [error,      setError]        = useState<string | null>(null);
  const [gerado,     setGerado]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/aux/industrias').then(r => {
      if (r.data.success) setIndustrias(r.data.data);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2 || !selInd) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/reports/vendas-produto/search?q=${encodeURIComponent(query)}&industria=${selInd}`);
        if (r.data.success) { setSuggestions(r.data.data); setShowDrop(true); }
      } finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selInd]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectProduct = useCallback(async (prod: ProdResult) => {
    setSelProd(prod); setQuery(prod.nome); setShowDrop(false);
    setSuggestions([]);
    setLoading(true); setError(null); setGerado(false);
    try {
      const r = await api.get(`/reports/vendas-produto?productCode=${encodeURIComponent(prod.id)}&industria=${selInd}`);
      if (r.data.success) { setRows(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selInd]);

  const clearProduct = () => {
    setSelProd(null); setQuery(''); setRows([]); setGerado(false); setError(null);
  };

  const indObj = industrias.find(i => String(i.for_codigo) === selInd);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Parâmetros */}
      <div style={{
        padding: '16px 20px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        {/* Indústria */}
        <div style={{ flex: '1 1 260px', minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            INDÚSTRIA
          </label>
          <select style={inp} value={selInd} onChange={e => { setSelInd(e.target.value); clearProduct(); }}>
            <option value="">Selecione a indústria...</option>
            {industrias.map(i => (
              <option key={i.for_codigo} value={i.for_codigo}>
                {String(i.for_codigo).padStart(4, '0')} — {i.for_nomered}
              </option>
            ))}
          </select>
        </div>

        {/* Produto search */}
        <div style={{ flex: '1 1 300px', minWidth: 240, position: 'relative' }} ref={dropRef}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            PRODUTO (código ou nome)
          </label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inp, paddingRight: 32 }}
              placeholder={selInd ? 'Digite código ou nome...' : 'Selecione a indústria primeiro'}
              disabled={!selInd}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelProd(null); }}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
              {searching ? (
                <Loader2 size={13} style={{ color: G.mustard, animation: 'spin 1s linear infinite' }} />
              ) : selProd ? (
                <button onClick={clearProduct} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={13} style={{ color: G.textMuted }} />
                </button>
              ) : (
                <Search size={13} style={{ color: G.textMuted }} />
              )}
            </div>
          </div>

          {showDrop && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
              background: G.card, border: `1px solid ${G.border}`,
              borderRadius: 9, boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
              maxHeight: 260, overflowY: 'auto', marginTop: 3,
            }}>
              {suggestions.map(s => (
                <button key={s.id} onMouseDown={() => selectProduct(s)} style={{
                  width: '100%', textAlign: 'left', border: 'none', background: 'none',
                  padding: '9px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                  borderBottom: `1px solid ${G.border}`,
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${G.mustard}15`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: G.mustard, flexShrink: 0 }}>
                    {s.referencia}
                  </span>
                  <span style={{ fontSize: 11, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.nome}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {gerado && (
          <button onClick={() => window.print()} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
            border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer',
          }}>
            <Printer size={13} />Imprimir
          </button>
        )}
      </div>

      {/* Resultado */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 48, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Loader2 size={18} style={{ color: G.mustard, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: G.textMuted }}>Buscando vendas...</span>
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: 20, display: 'flex', gap: 8 }}>
            <AlertCircle size={16} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</span>
          </div>
        )}
        {!gerado && !error && !loading && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Selecione a indústria e busque um produto para visualizar as vendas
          </div>
        )}
        {gerado && !loading && (
          <>
            <div style={{ padding: '10px 20px', borderBottom: `2px solid ${G.border}`, background: G.card }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>
                Vendas do Produto
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Produto: <strong style={{ color: G.mustard, fontFamily: 'monospace' }}>{selProd?.referencia}</strong>
                  {' '}<strong style={{ color: G.text }}>{selProd?.nome}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Indústria: <strong style={{ color: G.text }}>{indObj?.for_nomered}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  <strong style={{ color: G.mustard }}>{rows.length}</strong> registros
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhuma venda encontrada para este produto
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>Cliente</th>
                    <th style={th}>Data Compra</th>
                    <th style={th}>Dias Sem Compra</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedido</th>
                    <th style={{ ...th, textAlign: 'right' }}>Qtd.</th>
                    <th style={{ ...th, textAlign: 'right' }}>Valor Unit. (R$)</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const diasAlerta = row.dias_sem_compra > 180;
                    const total = Number(row.ite_quantidade) * Number(row.ite_valorunit);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                        <td style={{ ...td, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.cli_nomred || '—'}</td>
                        <td style={td}>{fmtDate(row.data_compra)}</td>
                        <td style={td}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 800,
                            background: diasAlerta ? '#FEE2E2' : `${G.border}50`,
                            color: diasAlerta ? '#DC2626' : G.textSec,
                          }}>
                            {row.dias_sem_compra} dias
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{row.ped_numero}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{Number(row.ite_quantidade).toLocaleString('pt-BR')}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBRL(Number(row.ite_valorunit))}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
