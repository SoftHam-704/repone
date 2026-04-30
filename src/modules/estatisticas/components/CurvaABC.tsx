import { useState, useEffect, useCallback } from 'react';
import { Download, Play } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row {
  ranking:        number;
  codigo:         string;
  nome:           string;
  qtd:            string;
  valor:          string;
  pct_individual: string;
  pct_acumulado:  string;
  curva:          'A' | 'B' | 'C';
  valor_total:    string;
}
interface IndOpt { id: number; nome: string; }
interface VenOpt { id: number; nome: string; }
interface CliOpt { value: number; label: string; }
interface RedeOpt { value: string; label: string; }

const fmtVal = (v: any) =>
  parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v: any) =>
  parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtPct = (v: any) => `${parseFloat(v || 0).toFixed(2).replace('.', ',')}%`;

const CURVA_CONFIG = {
  A: { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0', label: 'A — 80% do faturamento' },
  B: { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE', label: 'B — 15% do faturamento' },
  C: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A', label: 'C — 5% do faturamento' },
};

function CurvaChip({ curva }: { curva: 'A' | 'B' | 'C' }) {
  const c = CURVA_CONFIG[curva];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: 7,
      background: c.bg, border: `1px solid ${c.border}`,
      fontSize: 11, fontWeight: 900, color: c.text,
    }}>
      {curva}
    </span>
  );
}

const sel: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
  outline: 'none', cursor: 'pointer',
};

export default function CurvaABC({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [vendedores, setVendedores] = useState<VenOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [redes,      setRedes]      = useState<RedeOpt[]>([]);
  const [industria,  setIndustria]  = useState('ALL');
  const [vendedor,   setVendedor]   = useState('ALL');
  const [cliente,    setCliente]    = useState('ALL');
  const [redeloja,   setRedeloja]   = useState('ALL');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [processed,  setProcessed]  = useState(false);

  useEffect(() => {
    api.get('/aux/industrias').then(r =>
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))
    ).catch(() => {});
    api.get('/sellers').then(r =>
      setVendedores((r.data.data || []).map((v: any) => ({ id: v.ven_codigo, nome: v.ven_nome })))
    ).catch(() => {});
    api.get('/aux/clientes').then(r =>
      setClientes(r.data.data || [])
    ).catch(() => {});
    api.get('/aux/redes-loja').then(r =>
      setRedes(r.data.data || [])
    ).catch(() => {});
  }, []);

  const processar = useCallback(async () => {
    setLoading(true);
    setError('');
    setProcessed(false);
    try {
      const params = new URLSearchParams({
        dataInicial: dataInicio,
        dataFinal:   dataFim,
        industria,
        vendedor,
        cliente,
        redeloja,
      });
      const r = await api.get(`/estatisticas/curva-abc-produtos?${params}`);
      setRows(r.data.data || []);
      setProcessed(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, vendedor, cliente, redeloja]);

  const exportExcel = () => {
    const data = rows.map(r => ({
      'Ranking':       r.ranking,
      'Código':        r.codigo,
      'Produto':       r.nome,
      'Qtd. Vendida':  parseFloat(r.qtd),
      'Faturamento':   parseFloat(r.valor),
      '% Individual':  parseFloat(r.pct_individual),
      '% Acumulado':   parseFloat(r.pct_acumulado),
      'Curva':         r.curva,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 9 }, { wch: 14 }, { wch: 50 }, { wch: 13 },
      { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 8 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Curva ABC Produtos');
    XLSX.writeFile(wb, `curva-abc-produtos-${dataInicio}-${dataFim}.xlsx`);
  };

  // Sumarizar por classe
  const summary = (['A', 'B', 'C'] as const).map(cls => {
    const subset = rows.filter(r => r.curva === cls);
    return {
      cls,
      count: subset.length,
      valor: subset.reduce((s, r) => s + parseFloat(r.valor || '0'), 0),
    };
  });
  const valorTotal = rows.length > 0 ? parseFloat(rows[0].valor_total || '0') : 0;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: G.card, border: `1px solid ${G.border}`,
        borderRadius: 12, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Indústria</span>
          <select style={{ ...sel, minWidth: 180 }} value={industria} onChange={e => setIndustria(e.target.value)}>
            <option value="ALL">Todas</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Vendedor</span>
          <select style={{ ...sel, minWidth: 180 }} value={vendedor} onChange={e => setVendedor(e.target.value)}>
            <option value="ALL">Todos</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Rede / Grupo</span>
          <select style={{ ...sel, minWidth: 160 }} value={redeloja} onChange={e => { setRedeloja(e.target.value); setCliente('ALL'); }}>
            <option value="ALL">Todas</option>
            {redes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Cliente</span>
          <select style={{ ...sel, minWidth: 200 }} value={cliente} onChange={e => { setCliente(e.target.value); setRedeloja('ALL'); }}>
            <option value="ALL">Todos</option>
            {clientes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <button
          onClick={processar}
          disabled={loading}
          style={{
            marginTop: 18,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 20px', borderRadius: 10, border: 'none',
            background: loading ? G.border : G.text, color: G.bg,
            fontSize: 13, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <Play size={13} />
          {loading ? 'Processando...' : 'Processar'}
        </button>

        {processed && rows.length > 0 && (
          <button
            onClick={exportExcel}
            style={{
              marginTop: 18,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${G.border}`, background: 'transparent',
              fontSize: 12, fontWeight: 700, color: G.textSec,
            }}
          >
            <Download size={13} /> Exportar Excel
          </button>
        )}

        {processed && (
          <span style={{ marginTop: 18, fontSize: 11, color: G.textMuted, fontWeight: 600 }}>
            {rows.length.toLocaleString('pt-BR')} SKUs · {fmtVal(valorTotal)}
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEE2E2', color: '#B91C1C', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ── Cards de resumo A/B/C ─────────────────────────────────────── */}
      {processed && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {summary.map(s => {
            const c = CURVA_CONFIG[s.cls];
            const pct = valorTotal > 0 ? ((s.valor / valorTotal) * 100).toFixed(1) : '0';
            return (
              <div key={s.cls} style={{
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 14, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: c.text }}>Curva {s.cls}</span>
                </div>
                <div style={{ fontSize: 11, color: c.text, opacity: 0.8, marginBottom: 10 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: c.text }}>{fmtVal(s.valor)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{s.count} SKUs</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{pct}% do total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tabela ──────────────────────────────────────────────────────── */}
      {processed && rows.length > 0 && (
        <div style={{
          flex: 1, background: G.card, border: `1px solid ${G.border}`,
          borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Código', 'Produto', 'Qtd.', 'Faturamento', '% Indiv.', '% Acum.', 'Curva'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: h === 'Faturamento' || h === '% Indiv.' || h === '% Acum.' || h === 'Qtd.' ? 'right' : 'left',
                      fontSize: 10, fontWeight: 800, color: G.textMuted,
                      textTransform: 'uppercase', letterSpacing: 0.9,
                      borderBottom: `1px solid ${G.border}`, background: G.cardHi,
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const c = CURVA_CONFIG[r.curva];
                  return (
                    <tr key={r.codigo + idx} style={{
                      borderBottom: `1px solid ${G.border}40`,
                      background: idx % 2 === 0 ? 'transparent' : G.cardHi,
                    }}>
                      <td style={{ padding: '8px 14px', fontSize: 11, color: G.textMuted, fontWeight: 700 }}>
                        {r.ranking}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#1D4ED8' }}>
                        {r.codigo}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: G.text, maxWidth: 340 }}>
                        {r.nome}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: G.textSec, textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtQtd(r.qtd)}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: G.text, textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtVal(r.valor)}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 11, color: G.textMuted, textAlign: 'right' }}>
                        {fmtPct(r.pct_individual)}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 11, textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: c.text }}>{fmtPct(r.pct_acumulado)}</span>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'left' }}>
                        <CurvaChip curva={r.curva} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {processed && rows.length === 0 && !loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13 }}>
          Nenhum produto encontrado para o período selecionado.
        </div>
      )}

      {!processed && !loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: G.textMuted }}>
          <Play size={36} strokeWidth={1.2} />
          <span style={{ fontSize: 13 }}>Configure os filtros e clique em Processar</span>
        </div>
      )}
    </div>
  );
}
