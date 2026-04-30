import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Industria { for_codigo: number; for_nomered: string; for_nome: string }
interface Tabela    { value: string; label: string }
interface Produto   { codigo: string; conversao: string; original: string; nome: string; preco_bruto: number }

const EMPTY_DESCONTOS = ['', '', '', '', '', '', '', '', ''];

// ─── Cálculo de desconto cascata ──────────────────────────────────────────────
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

// ─── Componente ───────────────────────────────────────────────────────────────
export default function TabelaPrecosDescontoReport() {
  const [industrias,   setIndustrias]   = useState<Industria[]>([]);
  const [tabelas,      setTabelas]      = useState<Tabela[]>([]);
  const [selInd,       setSelInd]       = useState('');
  const [selTab,       setSelTab]       = useState('');
  const [impDescontos, setImpDescontos] = useState(true);
  const [descontos,    setDescontos]    = useState<string[]>(EMPTY_DESCONTOS);

  const [produtos,   setProdutos]   = useState<Produto[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loadingInd, setLoadingInd] = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [gerado,     setGerado]     = useState(false);

  // Carrega indústrias
  useEffect(() => {
    api.get('/aux/industrias')
      .then(r => r.data.success && setIndustrias(r.data.data))
      .finally(() => setLoadingInd(false));
  }, []);

  // Carrega tabelas ao trocar indústria
  useEffect(() => {
    setSelTab('');
    setTabelas([]);
    if (!selInd) return;
    api.get(`/aux/price-tables/${selInd}`)
      .then(r => r.data.success && setTabelas(r.data.data));
  }, [selInd]);

  const indObj = industrias.find(i => String(i.for_codigo) === selInd);

  const visualizar = useCallback(async () => {
    if (!selInd || !selTab) return;
    setLoading(true);
    setError(null);
    setGerado(false);
    try {
      const r = await api.get(`/reports/tabela-precos-desconto?industria=${selInd}&tabela=${encodeURIComponent(selTab)}`);
      if (r.data.success) { setProdutos(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selInd, selTab]);

  const setDesc = (i: number, v: string) =>
    setDescontos(prev => prev.map((d, idx) => idx === i ? v : d));

  const inp: React.CSSProperties = {
    padding: '6px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none', width: '100%',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Painel de parâmetros ── */}
      <div style={{
        padding: '16px 20px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>

          {/* Indústria */}
          <div style={{ flex: '1 1 260px', minWidth: 200 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
              INDÚSTRIA
            </label>
            <select style={inp} value={selInd} onChange={e => setSelInd(e.target.value)} disabled={loadingInd}>
              <option value="">Selecione a indústria...</option>
              {industrias.map(i => (
                <option key={i.for_codigo} value={i.for_codigo}>
                  {String(i.for_codigo).padStart(4, '0')} — {i.for_nomered}
                </option>
              ))}
            </select>
          </div>

          {/* Tabela */}
          <div style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
              TABELA
            </label>
            <select style={inp} value={selTab} onChange={e => setSelTab(e.target.value)} disabled={!selInd || tabelas.length === 0}>
              <option value="">Selecione...</option>
              {tabelas.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Checkbox imprimir descontos */}
          <div style={{ flexShrink: 0 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
              IMP. DESCONTOS?
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 32 }}>
              <input
                type="checkbox"
                checked={impDescontos}
                onChange={e => setImpDescontos(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: G.mustard, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>Sim</span>
            </label>
          </div>
        </div>

        {/* Grid de descontos */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, marginBottom: 6 }}>
            DESCONTOS (%)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6, maxWidth: 640 }}>
            {descontos.map((d, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, textAlign: 'center', marginBottom: 2 }}>
                  {i + 1}º
                </div>
                <input
                  type="number"
                  min="0" max="100" step="0.01"
                  style={{ ...inp, textAlign: 'right', padding: '5px 6px' }}
                  value={d}
                  onChange={e => setDesc(i, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Botão visualizar */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button
            onClick={visualizar}
            disabled={loading || !selInd || !selTab}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 800,
              border: 'none', background: G.mustard, color: G.text,
              cursor: !selInd || !selTab ? 'not-allowed' : 'pointer',
              opacity: !selInd || !selTab ? 0.5 : 1,
            }}
          >
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Gerando...</>
              : <><Search size={14} />Visualizar</>
            }
          </button>
          {gerado && (
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer',
              }}
            >
              <Printer size={14} />Imprimir
            </button>
          )}
        </div>
      </div>

      {/* ── Área do relatório ── */}
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

        {gerado && produtos.length > 0 && (
          <>
            {/* Cabeçalho do relatório */}
            <div style={{
              padding: '12px 20px 10px', borderBottom: `2px solid ${G.border}`,
              background: G.card, flexShrink: 0,
            }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>
                {indObj?.for_nome || indObj?.for_nomered}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Tabela: <strong style={{ color: G.text }}>{selTab}</strong>
                </span>
                {impDescontos && descontos.some(d => parseFloat(d) > 0) && (
                  <span style={{ fontSize: 11, color: G.textMuted }}>
                    Descontos aplicados: <strong style={{ color: G.mustard }}>
                      {descontos.filter(d => parseFloat(d) > 0).map(d => `${d}%`).join(' + ')}
                    </strong>
                  </span>
                )}
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  {produtos.length} produtos
                </span>
              </div>
            </div>

            {/* Tabela */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '49%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: G.cardHi }}>
                  {['Código', 'Conversão', 'Original', 'Nome do produto', 'Preço líquido'].map(h => (
                    <th key={h} style={{
                      padding: '9px 12px', fontSize: 10, fontWeight: 800,
                      color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.7,
                      borderBottom: `2px solid ${G.border}`, textAlign: h === 'Preço líquido' ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produtos.map((p, i) => {
                  const liquido = impDescontos
                    ? calcPrecoLiquido(p.preco_bruto, descontos)
                    : p.preco_bruto;
                  return (
                    <tr key={p.codigo + i} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                      <td style={{
                        padding: '7px 12px', fontSize: 11, fontFamily: 'monospace',
                        fontWeight: 800, color: G.mustard,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.codigo}
                      </td>
                      <td style={{
                        padding: '7px 12px', fontSize: 11, color: G.textSec,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.conversao || '—'}
                      </td>
                      <td style={{
                        padding: '7px 12px', fontSize: 11, color: G.textSec,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.original || '—'}
                      </td>
                      <td style={{
                        padding: '7px 12px', fontSize: 12, fontWeight: 600, color: G.text,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.nome}
                      </td>
                      <td style={{
                        padding: '7px 12px', fontSize: 12, fontWeight: 800,
                        color: G.text, textAlign: 'right',
                        borderBottom: `1px solid ${G.border}`,
                        fontFamily: 'monospace',
                      }}>
                        {fmtBRL(liquido)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {gerado && produtos.length === 0 && !loading && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Nenhum produto encontrado para esta tabela
          </div>
        )}
      </div>
    </div>
  );
}
