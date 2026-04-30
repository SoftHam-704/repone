import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart2 } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }
interface RawRow { industria_nome: string; mes: string; valor: number; qtd: number; }
interface IndOpt  { id: number; nome: string; }
interface CliOpt  { id: number; nome: string; }
interface VenOpt  { id: number; nome: string; }

type ViewMode = 'ambos' | 'valor' | 'qtd';

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

function parseMonthKey(mes: string) {
  const [mm, yyyy] = mes.split('/');
  return Number(yyyy) * 100 + Number(mm);
}

const fmtVal = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (n: number) => n === 0 ? '—' : n.toLocaleString('pt-BR');

export default function VendaMensalIndustria({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<RawRow[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [vendedores, setVendedores] = useState<VenOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const [industria,  setIndustria]  = useState('ALL');
  const [cliente,    setCliente]    = useState('ALL');
  const [vendedor,   setVendedor]   = useState('ALL');
  const [grupo,      setGrupo]      = useState(false);
  const [viewMode,   setViewMode]   = useState<ViewMode>('ambos');

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))).catch(() => {});
    api.get('/clients?limit=2000').then(r => setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })))).catch(() => {});
    api.get('/sellers').then(r => setVendedores((r.data.data || []).map((v: any) => ({ id: v.ven_codigo, nome: v.ven_nome })))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ dataInicial: dataInicio, dataFinal: dataFim, industria, cliente, vendedor, grupo: String(grupo) });
      const r = await api.get(`/estatisticas/venda-mensal-industria?${params}`);
      setRows(r.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, vendedor, grupo]);

  useEffect(() => { load(); }, [load]);

  const { meses, indNomes, pivot, totalPorMes, totalPorInd, grandVal, grandQtd } = useMemo(() => {
    const mesSet = new Set<string>();
    const indSet = new Set<string>();
    for (const r of rows) { mesSet.add(r.mes); indSet.add(r.industria_nome); }

    const meses    = [...mesSet].sort((a, b) => parseMonthKey(a) - parseMonthKey(b));
    const indNomes = [...indSet].sort();

    const pivotV: Record<string, Record<string, number>> = {};
    const pivotQ: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!pivotV[r.industria_nome]) { pivotV[r.industria_nome] = {}; pivotQ[r.industria_nome] = {}; }
      pivotV[r.industria_nome][r.mes] = r.valor;
      pivotQ[r.industria_nome][r.mes] = r.qtd;
    }

    const totalPorMes: Record<string, { v: number; q: number }> = {};
    const totalPorInd: Record<string, { v: number; q: number }> = {};
    let grandVal = 0, grandQtd = 0;

    for (const m of meses) {
      totalPorMes[m] = { v: 0, q: 0 };
      for (const ind of indNomes) {
        const v = pivotV[ind]?.[m] || 0, q = pivotQ[ind]?.[m] || 0;
        totalPorMes[m].v += v; totalPorMes[m].q += q;
        if (!totalPorInd[ind]) totalPorInd[ind] = { v: 0, q: 0 };
        totalPorInd[ind].v += v; totalPorInd[ind].q += q;
        grandVal += v; grandQtd += q;
      }
    }

    return { meses, indNomes, pivot: { v: pivotV, q: pivotQ }, totalPorMes, totalPorInd, grandVal, grandQtd };
  }, [rows]);

  const showV = viewMode === 'ambos' || viewMode === 'valor';
  const showQ = viewMode === 'ambos' || viewMode === 'qtd';

  const toggleBtn = (active: boolean) => ({
    padding: '5px 14px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? NAVY : G.cardHi, color: active ? G.mustard : G.textMuted,
    transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtros */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        {[
          { label: 'Indústria', val: industria, set: setIndustria, opts: industrias, all: 'Todas' },
          { label: 'Vendedor',  val: vendedor,  set: setVendedor,  opts: vendedores, all: 'Todos' },
          { label: 'Cliente',   val: cliente,   set: setCliente,   opts: clientes,   all: 'Todos' },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{f.label}</label>
            <select value={f.val} onChange={e => f.set(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}>
              <option value="ALL">{f.all}</option>
              {f.opts.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        ))}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Exibir</label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${G.border}` }}>
            {(['ambos','valor','qtd'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={toggleBtn(viewMode === m)}>
                {m === 'ambos' ? 'AMBOS' : m === 'valor' ? 'VALOR' : 'QTD'}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: G.text, paddingBottom: 2 }}>
          <input type="checkbox" checked={grupo} onChange={e => setGrupo(e.target.checked)} style={{ accentColor: G.mustard, width: 14, height: 14 }} />
          Rede de Lojas
        </label>

        <button onClick={load} disabled={loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: G.mustard, color: G.text, border: 'none', cursor: 'pointer',
          marginLeft: 'auto', alignSelf: 'flex-end',
        }}>
          {loading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>{error}</div>}

      {!loading && indNomes.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <BarChart2 size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nenhum dado encontrado para o período</span>
        </div>
      )}

      {!loading && indNomes.length > 0 && (
        <div style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>
          {indNomes.length} indústria{indNomes.length !== 1 ? 's' : ''} · {meses.length} meses · Total: <strong style={{ color: G.text }}>{fmtVal(grandVal)}</strong>
        </div>
      )}

      {!loading && indNomes.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 3, background: NAVY_DARK, color: G.mustard, padding: '10px 14px', textAlign: 'left', fontWeight: 700, borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap', minWidth: 180 }}>
                  Indústria
                </th>
                {meses.map(m => (
                  <th key={m} colSpan={showV && showQ ? 2 : 1} style={{ background: NAVY_DARK, color: G.mustard, padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap', minWidth: showV && showQ ? 160 : 110 }}>
                    {m}
                  </th>
                ))}
                <th colSpan={showV && showQ ? 2 : 1} style={{ position: 'sticky', right: 0, zIndex: 3, background: NAVY_DARK, color: G.mustard, padding: '10px 14px', textAlign: 'center', fontWeight: 700, borderLeft: `2px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap' }}>
                  TOTAL
                </th>
              </tr>
              {showV && showQ && (
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 3, background: NAVY_DARK, borderRight: `1px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}` }} />
                  {meses.map(m => [
                    <th key={`${m}-v`} style={{ background: `${NAVY_DARK}CC`, color: '#94A3B8', padding: '4px 10px', textAlign: 'right', fontWeight: 600, fontSize: 9, borderRight: `1px solid ${NAVY}55`, borderBottom: `2px solid ${NAVY}`, whiteSpace: 'nowrap' }}>R$</th>,
                    <th key={`${m}-q`} style={{ background: `${NAVY_DARK}CC`, color: '#94A3B8', padding: '4px 10px', textAlign: 'right', fontWeight: 600, fontSize: 9, borderRight: `1px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`, whiteSpace: 'nowrap' }}>Qtd</th>,
                  ])}
                  <th style={{ position: 'sticky', right: 0, zIndex: 3, background: `${NAVY_DARK}CC`, color: '#94A3B8', padding: '4px 10px', textAlign: 'right', fontWeight: 600, fontSize: 9, borderLeft: `2px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`, whiteSpace: 'nowrap' }}>R$ / Qtd</th>
                </tr>
              )}
            </thead>
            <tbody>
              {indNomes.map((ind, idx) => (
                <tr key={ind} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 2, background: idx % 2 === 0 ? G.card : G.bg, padding: '7px 14px', fontWeight: 700, color: G.text, borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                    {ind}
                  </td>
                  {meses.map(m => {
                    const v = pivot.v[ind]?.[m] || 0;
                    const q = pivot.q[ind]?.[m] || 0;
                    return [
                      showV && <td key={`${m}-v`} style={{ padding: '7px 10px', textAlign: 'right', color: v === 0 ? G.textMuted : G.text, fontWeight: v === 0 ? 400 : 600, borderRight: showQ ? `1px solid ${G.border}55` : `1px solid ${G.border}` }}>{v === 0 ? '—' : fmtVal(v)}</td>,
                      showQ && <td key={`${m}-q`} style={{ padding: '7px 10px', textAlign: 'right', color: q === 0 ? G.textMuted : G.text, fontWeight: q === 0 ? 400 : 500, borderRight: `1px solid ${G.border}` }}>{fmtQtd(q)}</td>,
                    ];
                  })}
                  <td style={{ position: 'sticky', right: 0, zIndex: 2, background: NAVY, color: G.mustard, padding: '7px 14px', textAlign: 'right', fontWeight: 700, borderLeft: `2px solid ${NAVY_DARK}` }}>
                    {showV && fmtVal(totalPorInd[ind]?.v || 0)}
                    {showV && showQ && <br />}
                    {showQ && <span style={{ fontSize: 10, opacity: 0.8 }}>{fmtQtd(totalPorInd[ind]?.q || 0)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ position: 'sticky', left: 0, zIndex: 3, background: NAVY_DARK, color: G.mustard, padding: '9px 14px', fontWeight: 800, fontSize: 11, borderTop: `2px solid ${NAVY}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>TOTAL</td>
                {meses.map(m => [
                  showV && <td key={`${m}-v`} style={{ background: NAVY, color: G.mustard, padding: '9px 10px', textAlign: 'right', fontWeight: 700, borderTop: `2px solid ${NAVY}`, borderRight: showQ ? `1px solid ${NAVY_DARK}` : `1px solid ${NAVY}` }}>{fmtVal(totalPorMes[m]?.v || 0)}</td>,
                  showQ && <td key={`${m}-q`} style={{ background: NAVY, color: '#94A3B8', padding: '9px 10px', textAlign: 'right', fontWeight: 600, borderTop: `2px solid ${NAVY}`, borderRight: `1px solid ${NAVY}` }}>{fmtQtd(totalPorMes[m]?.q || 0)}</td>,
                ])}
                <td style={{ position: 'sticky', right: 0, zIndex: 3, background: NAVY_DARK, color: G.mustard, padding: '9px 14px', textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${NAVY}`, borderLeft: `2px solid ${NAVY}` }}>
                  {showV && fmtVal(grandVal)}
                  {showV && showQ && <br />}
                  {showQ && <span style={{ fontSize: 10 }}>{fmtQtd(grandQtd)}</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando venda mensal por indústria...
        </div>
      )}
    </div>
  );
}
