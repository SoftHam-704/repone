import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; for_nome: string }
interface Tabela    { value: string; label: string }
interface Produto   { codigo: string; preco_bruto: number }

const EMPTY_DESCONTOS = ['', '', '', '', '', '', '', '', ''];

function calcPrecoLiquido(bruto: number, descontos: string[]): number {
  let preco = bruto;
  for (const d of descontos) {
    const v = parseFloat(d);
    if (!isNaN(v) && v > 0) preco *= (1 - v / 100);
  }
  return preco;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inp: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none', width: '100%',
};

export default function TabelaPrecosReduzidaReport() {
  const [industrias,    setIndustrias]    = useState<Industria[]>([]);
  const [tabelas,       setTabelas]       = useState<Tabela[]>([]);
  const [selInd,        setSelInd]        = useState('');
  const [selTab,        setSelTab]        = useState('');
  const [impDescontos,  setImpDescontos]  = useState(true);
  const [descontos,     setDescontos]     = useState<string[]>(EMPTY_DESCONTOS);

  const [produtos,   setProdutos]   = useState<Produto[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loadingInd, setLoadingInd] = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [gerado,     setGerado]     = useState(false);

  useEffect(() => {
    api.get('/aux/industrias')
      .then(r => r.data.success && setIndustrias(r.data.data))
      .finally(() => setLoadingInd(false));
  }, []);

  useEffect(() => {
    setSelTab(''); setTabelas([]);
    if (!selInd) return;
    api.get(`/aux/price-tables/${selInd}`)
      .then(r => r.data.success && setTabelas(r.data.data));
  }, [selInd]);

  const indObj = industrias.find(i => String(i.for_codigo) === selInd);

  const descStr = descontos
    .map(d => (parseFloat(d) || 0).toFixed(2).replace('.', ','))
    .join('+');

  const visualizar = useCallback(async () => {
    if (!selInd || !selTab) return;
    setLoading(true); setError(null); setGerado(false);
    try {
      const r = await api.get(`/reports/tabela-precos-desconto?industria=${selInd}&tabela=${encodeURIComponent(selTab)}`);
      if (r.data.success) { setProdutos(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selInd, selTab]);

  const setDesc = (i: number, v: string) =>
    setDescontos(prev => prev.map((d, idx) => idx === i ? v : d));

  // Agrupar em chunks de 3 para o layout 3-colunas
  const chunks: Produto[][] = [];
  for (let i = 0; i < produtos.length; i += 3) chunks.push(produtos.slice(i, i + 3));

  // Estilos da tabela reduzida
  const thStyle: React.CSSProperties = {
    padding: '7px 10px', fontSize: 10, fontWeight: 800,
    color: '#C00000', textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottom: `2px solid ${G.border}`, borderRight: `1px solid ${G.border}`,
  };
  const tdCode: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
    color: G.text, borderBottom: `1px dashed ${G.border}`, borderRight: `1px dashed ${G.border}`,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  const tdPrice: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, fontFamily: 'monospace', fontWeight: 800,
    color: G.text, textAlign: 'right',
    borderBottom: `1px dashed ${G.border}`, borderRight: `1px solid ${G.border}`,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Parâmetros ── */}
      <div style={{
        padding: '16px 20px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
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

          <div style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>TABELA</label>
            <select style={inp} value={selTab} onChange={e => setSelTab(e.target.value)} disabled={!selInd || tabelas.length === 0}>
              <option value="">Selecione...</option>
              {tabelas.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ flexShrink: 0 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>IMP. DESCONTOS?</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 32 }}>
              <input type="checkbox" checked={impDescontos} onChange={e => setImpDescontos(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: G.mustard, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>Sim</span>
            </label>
          </div>
        </div>

        {/* Descontos */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, marginBottom: 6 }}>DESCONTOS (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6, maxWidth: 640 }}>
            {descontos.map((d, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textAlign: 'center', marginBottom: 2 }}>{i + 1}º</div>
                <input type="number" min="0" max="100" step="0.01"
                  style={{ ...inp, textAlign: 'right', padding: '5px 6px' }}
                  value={d} onChange={e => setDesc(i, e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button onClick={visualizar} disabled={loading || !selInd || !selTab} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 800,
            border: 'none', background: G.mustard, color: G.text,
            cursor: !selInd || !selTab ? 'not-allowed' : 'pointer',
            opacity: !selInd || !selTab ? 0.5 : 1,
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Gerando...</>
              : <><Search size={14} />Visualizar</>}
          </button>
          {gerado && (
            <button onClick={() => window.print()} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700,
              border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer',
            }}>
              <Printer size={14} />Imprimir
            </button>
          )}
        </div>
      </div>

      {/* ── Relatório ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {error && (
          <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {!gerado && !error && !loading && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Selecione a indústria, tabela e clique em Visualizar
          </div>
        )}

        {gerado && (
          <>
            {/* Cabeçalho */}
            <div style={{
              padding: '10px 20px 8px', borderBottom: `2px solid ${G.border}`,
              background: G.card, flexShrink: 0,
            }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>
                {indObj?.for_nome || indObj?.for_nomered}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Tabela: <strong style={{ color: G.text }}>{selTab}</strong>
                </span>
                {impDescontos && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#C00000' }}>
                    Descontos: {descStr}
                  </span>
                )}
                <span style={{ fontSize: 11, color: G.textMuted }}>{produtos.length} produtos</span>
              </div>
            </div>

            {produtos.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum produto encontrado para esta tabela
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '18%' }} /><col style={{ width: '15%' }} />
                  <col style={{ width: '18%' }} /><col style={{ width: '15%' }} />
                  <col style={{ width: '18%' }} /><col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thStyle}>Código</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Preço</th>
                    <th style={thStyle}>Código</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Preço</th>
                    <th style={thStyle}>Código</th>
                    <th style={{ ...thStyle, textAlign: 'right', borderRight: 'none' }}>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {chunks.map((chunk, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : `${G.border}25` }}>
                      {[0, 1, 2].map(ci => {
                        const p = chunk[ci];
                        if (!p) return (
                          <td key={ci} colSpan={2}
                            style={{ ...tdCode, borderRight: ci < 2 ? `1px solid ${G.border}` : 'none' }} />
                        );
                        const preco = impDescontos
                          ? calcPrecoLiquido(p.preco_bruto, descontos)
                          : p.preco_bruto;
                        return (
                          <>
                            <td key={`c${ci}`} style={{ ...tdCode, borderRight: `1px dashed ${G.border}` }}>
                              {p.codigo}
                            </td>
                            <td key={`p${ci}`} style={{
                              ...tdPrice,
                              borderRight: ci < 2 ? `1px solid ${G.border}` : 'none',
                            }}>
                              {fmtBRL(preco)}
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
