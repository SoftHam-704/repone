import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; for_nome: string }
interface Tabela    { value: string; label: string }
interface Produto {
  codigo: string; descricao: string;
  preco_bruto: number; preco_liquido: number; especial: number;
  cod_original: string; conversao: string;
}

const fmtBRL = (v: number) =>
  v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

const inp: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none', width: '100%',
};

const COLS = ['Código', 'Descrição', 'Preço bruto', 'Preço líquido', 'Especial', 'Cód. original', 'Conversão'];
const RIGHT_COLS = new Set(['Preço bruto', 'Preço líquido', 'Especial']);

export default function TabelaPrecosCompletaReport() {
  const [industrias,   setIndustrias]   = useState<Industria[]>([]);
  const [tabelas,      setTabelas]      = useState<Tabela[]>([]);
  const [selInd,       setSelInd]       = useState('');
  const [selTab,       setSelTab]       = useState('');

  const [produtos,  setProdutos]  = useState<Produto[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loadingInd,setLoadingInd]= useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [gerado,    setGerado]    = useState(false);

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

  const visualizar = useCallback(async () => {
    if (!selInd || !selTab) return;
    setLoading(true); setError(null); setGerado(false);
    try {
      const r = await api.get(`/reports/tabela-precos-completa?industria=${selInd}&tabela=${encodeURIComponent(selTab)}`);
      if (r.data.success) { setProdutos(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selInd, selTab]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Parâmetros ── */}
      <div style={{
        padding: '16px 20px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
      }}>
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

        <div style={{ flex: '1 1 180px', minWidth: 140 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            TABELA
          </label>
          <select style={inp} value={selTab} onChange={e => setSelTab(e.target.value)} disabled={!selInd || tabelas.length === 0}>
            <option value="">Selecione...</option>
            {tabelas.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
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
            Selecione a indústria e tabela, depois clique em Visualizar
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
              <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Tabela: <strong style={{ color: G.text }}>{selTab}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  {produtos.length} produtos
                </span>
              </div>
            </div>

            {produtos.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum produto encontrado para esta tabela
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: G.cardHi }}>
                    {COLS.map(h => (
                      <th key={h} style={{
                        padding: '9px 10px', fontSize: 10, fontWeight: 800,
                        color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
                        borderBottom: `2px solid ${G.border}`,
                        textAlign: RIGHT_COLS.has(h) ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p, i) => (
                    <tr key={p.codigo + i} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                      <td style={{
                        padding: '6px 10px', fontSize: 11, fontFamily: 'monospace',
                        fontWeight: 800, color: G.mustard, borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.codigo}
                      </td>
                      <td style={{
                        padding: '6px 10px', fontSize: 12, fontWeight: 600, color: G.text,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.descricao}
                      </td>
                      <td style={{
                        padding: '6px 10px', fontSize: 11, fontFamily: 'monospace',
                        fontWeight: 700, color: G.text, textAlign: 'right',
                        borderBottom: `1px solid ${G.border}`,
                      }}>
                        {fmtBRL(p.preco_bruto)}
                      </td>
                      <td style={{
                        padding: '6px 10px', fontSize: 11, fontFamily: 'monospace',
                        fontWeight: 700, color: p.preco_liquido > 0 ? G.text : G.textMuted,
                        textAlign: 'right', borderBottom: `1px solid ${G.border}`,
                      }}>
                        {fmtBRL(p.preco_liquido)}
                      </td>
                      <td style={{
                        padding: '6px 10px', fontSize: 11, fontFamily: 'monospace',
                        color: p.especial > 0 ? G.text : G.textMuted,
                        textAlign: 'right', borderBottom: `1px solid ${G.border}`,
                      }}>
                        {fmtBRL(p.especial)}
                      </td>
                      <td style={{
                        padding: '6px 10px', fontSize: 11, color: G.textSec,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.cod_original || '—'}
                      </td>
                      <td style={{
                        padding: '6px 10px', fontSize: 11, color: G.textSec,
                        borderBottom: `1px solid ${G.border}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.conversao || '—'}
                      </td>
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
