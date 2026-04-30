import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer, Calculator, ChevronLeft } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Industria { for_codigo: number; for_nomered: string; for_nome: string }
interface Tabela    { value: string; label: string }
interface Produto {
  codigo: string; conversao: string; nome: string;
  preco_normal: number; preco_promocao: number;
}

const EMPTY_DESCONTOS = ['', '', '', '', '', '', '', '', ''];

function calcEscolhido(bruto: number, descontos: string[]): number {
  let preco = bruto;
  for (const d of descontos) {
    const v = parseFloat(d);
    if (!isNaN(v) && v > 0) preco *= (1 - v / 100);
  }
  return preco;
}

const fmtBRL = (v: number) =>
  v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

// ─── Estilos base ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none', width: '100%',
};
const th: React.CSSProperties = {
  padding: '8px 10px', fontSize: 10, fontWeight: 800, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: 0.7,
  borderBottom: `2px solid ${G.border}`, background: G.cardHi,
  whiteSpace: 'nowrap', textAlign: 'left',
};
const td: React.CSSProperties = {
  padding: '6px 10px', fontSize: 11, borderBottom: `1px solid ${G.border}`,
  color: G.text,
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PromocaoProdutosReport() {
  const [industrias,    setIndustrias]    = useState<Industria[]>([]);
  const [tabelas,       setTabelas]       = useState<Tabela[]>([]);
  const [selInd,        setSelInd]        = useState('');
  const [selTab,        setSelTab]        = useState('');
  const [somentePromo,  setSomentePromo]  = useState(false);
  const [descontos,     setDescontos]     = useState<string[]>(EMPTY_DESCONTOS);

  const [produtos,     setProdutos]     = useState<Produto[]>([]);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [calculados,   setCalculados]   = useState<Map<string, number>>(new Map());
  const [loading,      setLoading]      = useState(false);
  const [loadingInd,   setLoadingInd]   = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [view,         setView]         = useState<'params' | 'report'>('params');

  const indObj = industrias.find(i => String(i.for_codigo) === selInd);

  useEffect(() => {
    api.get('/aux/industrias')
      .then(r => r.data.success && setIndustrias(r.data.data))
      .finally(() => setLoadingInd(false));
  }, []);

  useEffect(() => {
    setSelTab(''); setTabelas([]); setProdutos([]); setSelectedIds(new Set()); setCalculados(new Map());
    if (!selInd) return;
    api.get(`/aux/price-tables/${selInd}`)
      .then(r => r.data.success && setTabelas(r.data.data));
  }, [selInd]);

  // Carrega produtos automaticamente ao selecionar tabela
  useEffect(() => {
    setProdutos([]); setSelectedIds(new Set()); setCalculados(new Map());
    if (!selInd || !selTab) return;
    setLoading(true);
    api.get(`/reports/tabela-precos-promocao?industria=${selInd}&tabela=${encodeURIComponent(selTab)}&somente_promo=${somentePromo}`)
      .then(r => {
        if (r.data.success) {
          setProdutos(r.data.data);
          setSelectedIds(new Set(r.data.data.map((p: Produto) => p.codigo)));
        } else setError(r.data.message);
      })
      .catch(() => setError('Falha na comunicação'))
      .finally(() => setLoading(false));
  }, [selInd, selTab, somentePromo]);

  const toggleAll = () => {
    if (selectedIds.size === produtos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(produtos.map(p => p.codigo)));
  };

  const toggleOne = (codigo: string) => {
    const next = new Set(selectedIds);
    next.has(codigo) ? next.delete(codigo) : next.add(codigo);
    setSelectedIds(next);
  };

  const calcularMarcados = useCallback(() => {
    const map = new Map<string, number>();
    for (const p of produtos) {
      if (selectedIds.has(p.codigo)) {
        map.set(p.codigo, calcEscolhido(p.preco_normal, descontos));
      }
    }
    setCalculados(map);
  }, [produtos, selectedIds, descontos]);

  const selecionados = produtos.filter(p => selectedIds.has(p.codigo) && calculados.has(p.codigo));

  const setDesc = (i: number, v: string) =>
    setDescontos(prev => prev.map((d, idx) => idx === i ? v : d));

  // ── VIEW: RELATÓRIO FINAL ────────────────────────────────────────────────────
  if (view === 'report') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 20px', borderBottom: `1px solid ${G.border}`,
          background: G.cardHi, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <button onClick={() => setView('params')} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer',
          }}>
            <ChevronLeft size={13} />Voltar
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>
            {indObj?.for_nome} — Tabela {selTab}
          </span>
          <span style={{ fontSize: 11, color: G.textMuted }}>{selecionados.length} produtos</span>
          <button onClick={() => window.print()} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec,
            cursor: 'pointer', marginLeft: 'auto',
          }}>
            <Printer size={13} />Imprimir
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '10px 20px 8px', borderBottom: `2px solid ${G.border}`, background: G.card }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>{indObj?.for_nome}</div>
            <div style={{ fontSize: 11, color: G.textMuted, marginTop: 3 }}>
              Tabela: <strong style={{ color: G.text }}>{selTab}</strong>
              {descontos.some(d => parseFloat(d) > 0) && (
                <span style={{ marginLeft: 16, color: '#C00000', fontWeight: 700 }}>
                  Descontos: {descontos.map(d => `${parseFloat(d) || 0}%`).filter((_, i) => i < 9).join(' + ')}
                </span>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '13%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '42%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                {['Código','Conversão','Nome do produto','Preço normal','Preço escolhido'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selecionados.map((p, i) => (
                <tr key={p.codigo} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 800, color: G.mustard }}>{p.codigo}</td>
                  <td style={{ ...td, color: G.textSec }}>{p.conversao || '—'}</td>
                  <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBRL(p.preco_normal)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#16A34A' }}>
                    {fmtBRL(calculados.get(p.codigo) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── VIEW: SELEÇÃO ─────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Parâmetros */}
      <div style={{ padding: '14px 20px', borderBottom: `2px solid ${G.border}`, background: G.card, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: '1 1 260px', minWidth: 200 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>INDÚSTRIA</label>
            <select style={inp} value={selInd} onChange={e => setSelInd(e.target.value)} disabled={loadingInd}>
              <option value="">Selecione a indústria...</option>
              {industrias.map(i => (
                <option key={i.for_codigo} value={i.for_codigo}>
                  {String(i.for_codigo).padStart(4, '0')} — {i.for_nomered}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 130 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>TABELA</label>
            <select style={inp} value={selTab} onChange={e => setSelTab(e.target.value)} disabled={!selInd || tabelas.length === 0}>
              <option value="">Selecione...</option>
              {tabelas.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', paddingBottom: 4 }}>
            <input type="checkbox" checked={somentePromo} onChange={e => setSomentePromo(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: G.mustard, cursor: 'pointer' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: G.text, whiteSpace: 'nowrap' }}>Somente itens em promoção</span>
          </label>
        </div>

        {/* Descontos */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, marginBottom: 5 }}>DESCONTOS (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 5, maxWidth: 620 }}>
            {descontos.map((d, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textAlign: 'center', marginBottom: 2 }}>{i + 1}º Desc</div>
                <input type="number" min="0" max="100" step="0.01"
                  style={{ ...inp, textAlign: 'right', padding: '4px 6px' }}
                  value={d} onChange={e => setDesc(i, e.target.value)} placeholder="0,00" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de seleção */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {error && (
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Loader2 size={20} style={{ color: G.mustard, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: G.textMuted, fontWeight: 600 }}>Carregando produtos...</span>
          </div>
        )}

        {!loading && produtos.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13 }}>
            {selTab ? 'Nenhum produto encontrado' : 'Selecione a indústria e tabela'}
          </div>
        )}

        {!loading && produtos.length > 0 && (
          <>
            {/* Toolbar da grid */}
            <div style={{
              padding: '8px 14px', borderBottom: `1px solid ${G.border}`,
              display: 'flex', alignItems: 'center', gap: 12, background: G.cardHi, flexShrink: 0,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={selectedIds.size === produtos.length && produtos.length > 0}
                  onChange={toggleAll}
                  style={{ width: 14, height: 14, accentColor: G.mustard, cursor: 'pointer' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: G.textSec }}>Marcar/Desmarcar todos</span>
              </label>
              <span style={{ fontSize: 11, color: G.textMuted }}>{selectedIds.size} de {produtos.length} selecionados</span>
              {calculados.size > 0 && (
                <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>
                  ✓ {calculados.size} preços calculados
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '36px' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} />
                  <col style={{ width: '37%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'center', width: 36 }}>Sel</th>
                    <th style={th}>Código</th>
                    <th style={th}>Conversão</th>
                    <th style={th}>Nome</th>
                    <th style={{ ...th, textAlign: 'right' }}>Normal</th>
                    <th style={{ ...th, textAlign: 'right' }}>Promoção</th>
                    <th style={{ ...th, textAlign: 'right' }}>Escolhido</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p, i) => {
                    const sel = selectedIds.has(p.codigo);
                    const esc = calculados.get(p.codigo);
                    return (
                      <tr key={p.codigo} onClick={() => toggleOne(p.codigo)}
                        style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}25`, cursor: 'pointer' }}>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input type="checkbox" checked={sel} onChange={() => toggleOne(p.codigo)}
                            style={{ accentColor: G.mustard, cursor: 'pointer' }} onClick={e => e.stopPropagation()} />
                        </td>
                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: 800, color: sel ? G.mustard : G.textSec }}>
                          {p.codigo}
                        </td>
                        <td style={{ ...td, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.conversao || '—'}
                        </td>
                        <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.nome}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBRL(p.preco_normal)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: p.preco_promocao > 0 ? G.text : G.textMuted }}>
                          {fmtBRL(p.preco_promocao)}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#16A34A' }}>
                          {esc !== undefined ? fmtBRL(esc) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Footer com botões de ação */}
      {produtos.length > 0 && (
        <div style={{
          padding: '10px 20px', borderTop: `2px solid ${G.border}`,
          background: G.card, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <button onClick={calcularMarcados} disabled={selectedIds.size === 0} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 800,
            border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
            cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
            opacity: selectedIds.size === 0 ? 0.5 : 1,
          }}>
            <Calculator size={14} />
            Calcular os produtos marcados
          </button>

          <span style={{ fontSize: 10, color: G.textMuted, fontStyle: 'italic' }}>
            Selecione os itens antes de calcular
          </span>

          <button
            onClick={() => setView('report')}
            disabled={calculados.size === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 800,
              border: 'none', background: G.mustard, color: G.text, marginLeft: 'auto',
              cursor: calculados.size === 0 ? 'not-allowed' : 'pointer',
              opacity: calculados.size === 0 ? 0.5 : 1,
            }}
          >
            <Search size={14} />Visualizar
          </button>
        </div>
      )}
    </div>
  );
}
