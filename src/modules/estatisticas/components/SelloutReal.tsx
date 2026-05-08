import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingBag, Download, Play, Factory, User, DollarSign, Package, Users, UserCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; }
interface Cliente   { cli_codigo: number; cli_nomred: string; }
interface RawRow    { cliente_id: number; cliente_nome: string; industria_nome: string; ano: number; mes: number; valor: number; quantidade: number; }

const fmtR$ = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtN  = (v: number) => v.toLocaleString('pt-BR');
const pad   = (n: number) => String(n).padStart(2, '0');

const MONTH_NAMES: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
  '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez',
};

const selStyle: React.CSSProperties = {
  height: 32, padding: '0 8px 0 26px', borderRadius: 7, fontSize: 11, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
  outline: 'none', cursor: 'pointer', minWidth: 160, maxWidth: 220,
};
const labelSt: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 3,
};

export default function SelloutReal({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [industria,  setIndustria]  = useState('ALL');
  const [cliente,    setCliente]    = useState('ALL');

  const [viewBy,  setViewBy]  = useState<'cliente' | 'grupo'>('cliente');
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || []));
    api.get('/clients?limit=2000').then(r => setClientes(r.data.data || []));
  }, []);

  const processar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/estatisticas/sellout-real', {
        params: { dataInicial: dataInicio, dataFinal: dataFim, industria, cliente, viewBy },
      });
      setRawData(res.data.data || []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, viewBy]);

  const pivot = useMemo(() => {
    if (!rawData.length) return { cols: [], rows: [], grandValor: 0, grandQtd: 0 };

    const clientMap = new Map<string, { nome: string; months: Record<string, { valor: number; qtd: number }>; totalValor: number; totalQtd: number }>();
    const monthSet  = new Set<string>();
    let grandValor  = 0;
    let grandQtd    = 0;

    rawData.forEach(item => {
      const key = `${pad(item.mes)}/${item.ano}`;
      monthSet.add(key);
      const mapKey = item.cliente_nome;
      if (!clientMap.has(mapKey)) {
        clientMap.set(mapKey, { nome: item.cliente_nome, months: {}, totalValor: 0, totalQtd: 0 });
      }
      const node = clientMap.get(mapKey)!;
      if (!node.months[key]) node.months[key] = { valor: 0, qtd: 0 };
      node.months[key].valor += item.valor;
      node.months[key].qtd   += item.quantidade;
      node.totalValor += item.valor;
      node.totalQtd   += item.quantidade;
      grandValor += item.valor;
      grandQtd   += item.quantidade;
    });

    const cols = [...monthSet].sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      return ya !== yb ? ya - yb : ma - mb;
    });

    const rows = [...clientMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { cols, rows, grandValor, grandQtd };
  }, [rawData]);

  const exportExcel = () => {
    if (!pivot.rows.length) return;
    const header = ['CLIENTE', ...pivot.cols.flatMap(c => [`${c} - Valor`, `${c} - Qtd`]), 'Total Valor', 'Total Qtd'];
    const dataRows = pivot.rows.map(r => [
      r.nome,
      ...pivot.cols.flatMap(c => [r.months[c]?.valor || 0, r.months[c]?.qtd || 0]),
      r.totalValor, r.totalQtd,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = [{ wch: 35 }, ...pivot.cols.flatMap(() => [{ wch: 16 }, { wch: 10 }]), { wch: 16 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sellout_Real');
    XLSX.writeFile(wb, `Sellout_Real_${dataInicio}_a_${dataFim}.xlsx`);
  };

  const thBase: React.CSSProperties = {
    padding: '6px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
    textTransform: 'uppercase', borderRight: `1px solid rgba(255,255,255,0.1)`,
    whiteSpace: 'nowrap',
  };
  const tdBase: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, borderRight: `1px solid ${G.border}`,
    borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap', color: G.text,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Banner informativo */}
      <div style={{ padding: '8px 18px', background: '#16A34A15', borderBottom: `1px solid #16A34A30`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>
          Sellout Real — dados registrados manualmente via módulo Sellout (crm_sellout)
        </span>
      </div>

      {/* Filtros */}
      <div style={{
        padding: '10px 18px', background: G.card, borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Indústria</div>
          <div style={{ position: 'relative' }}>
            <Factory size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={industria} onChange={e => setIndustria(e.target.value)}>
              <option value="ALL">Todas</option>
              {industrias.map(i => <option key={i.for_codigo} value={String(i.for_codigo)}>{i.for_nomered}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Cliente</div>
          <div style={{ position: 'relative' }}>
            <User size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="ALL">Todos</option>
              {clientes.map(c => <option key={c.cli_codigo} value={String(c.cli_codigo)}>{c.cli_nomred}</option>)}
            </select>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Toggle Por Cliente / Por Grupo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-end' }}>
          <div style={labelSt}>Visualizar por</div>
          <div style={{ display: 'flex', gap: 2, background: G.cardHi, borderRadius: 7, padding: 2, border: `1px solid ${G.border}` }}>
            {([['cliente', UserCircle, 'Cliente'], ['grupo', Users, 'Grupo']] as const).map(([v, Icon, lbl]) => (
              <button
                key={v}
                onClick={() => setViewBy(v)}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 5, fontSize: 10, fontWeight: 800,
                  border: 'none', display: 'flex', alignItems: 'center', gap: 4,
                  background: viewBy === v ? G.text : 'transparent',
                  color: viewBy === v ? G.mustard : G.textSec,
                  cursor: 'pointer', transition: 'all .12s',
                }}
              >
                <Icon size={10} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        <button
          style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', opacity: pivot.rows.length ? 1 : 0.4 }}
          onClick={exportExcel} disabled={!pivot.rows.length}
        >
          <Download size={12} /> Excel
        </button>

        <button
          onClick={processar} disabled={loading}
          style={{ height: 32, padding: '0 18px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: G.text, color: G.mustard, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', opacity: loading ? 0.6 : 1 }}
        >
          {loading
            ? <><span style={{ width: 11, height: 11, border: `2px solid rgba(255,210,0,0.3)`, borderTopColor: G.mustard, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Processando...</>
            : <><Play size={12} /> Processar</>
          }
        </button>
      </div>

      {/* Totalizador */}
      {loaded && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexShrink: 0, background: G.card, borderBottom: `1px solid ${G.border}` }}>
          <div style={{ padding: '10px 20px', borderRight: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 3 }}>Totalizador Global — Sellout Real</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: G.textSec }}>Período selecionado</div>
          </div>
          <div style={{ padding: '10px 24px', borderRight: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#16A34A', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 3 }}>Valor Total</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: G.text }}>{fmtR$(pivot.grandValor)}</div>
          </div>
          <div style={{ padding: '10px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 3 }}>Qtd Peças</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: G.text }}>{fmtN(Math.round(pivot.grandQtd))}</div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {!loaded ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <ShoppingBag size={40} style={{ color: G.border }} />
            <span style={{ fontSize: 12, color: G.textMuted }}>Configure os filtros e clique em Processar</span>
          </div>
        ) : pivot.rows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: G.textMuted }}>Nenhum registro de Sellout encontrado para o período</span>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: G.text }}>
                <th rowSpan={2} style={{ ...thBase, color: G.mustard, minWidth: 220, textAlign: 'left', position: 'sticky', left: 0, background: G.text, zIndex: 3 }}>{viewBy === 'grupo' ? 'GRUPO / REDE' : 'CLIENTE'}</th>
                {pivot.cols.map(col => {
                  const [m] = col.split('/');
                  return (
                    <th key={col} colSpan={2} style={{ ...thBase, color: '#E8E1D4', textAlign: 'center', minWidth: 200 }}>
                      {MONTH_NAMES[m] ?? m}/{col.split('/')[1]}
                    </th>
                  );
                })}
                <th colSpan={2} style={{ ...thBase, color: G.mustard, textAlign: 'center', background: '#162436', borderLeft: `2px solid ${G.mustard}40` }}>TOTAL</th>
              </tr>
              <tr style={{ background: '#1a2633' }}>
                {[...pivot.cols, '__total'].map(col => (
                  <>
                    <th key={`${col}-v`} style={{ ...thBase, color: '#94A3B8', textAlign: 'right', minWidth: 110, fontWeight: 600 }}>
                      <DollarSign size={9} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} />Valor
                    </th>
                    <th key={`${col}-q`} style={{ ...thBase, color: '#94A3B8', textAlign: 'right', minWidth: 70, fontWeight: 600 }}>
                      <Package size={9} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} />Qtd
                    </th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                  <td style={{ ...tdBase, fontWeight: 700, position: 'sticky', left: 0, background: i % 2 === 0 ? G.card : G.bg, zIndex: 1, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.nome}>{row.nome}</td>
                  {pivot.cols.map(col => {
                    const cell = row.months[col];
                    return (
                      <>
                        <td key={`${col}-v`} style={{ ...tdBase, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {cell?.valor ? fmtR$(cell.valor) : <span style={{ color: G.border }}>—</span>}
                        </td>
                        <td key={`${col}-q`} style={{ ...tdBase, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {cell?.qtd ? fmtN(cell.qtd) : <span style={{ color: G.border }}>—</span>}
                        </td>
                      </>
                    );
                  })}
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#1E2D3D', borderLeft: `2px solid ${G.mustard}30` }}>{fmtR$(row.totalValor)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#1E2D3D' }}>{fmtN(row.totalQtd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: G.text, position: 'sticky', bottom: 0, zIndex: 2, borderTop: `2px solid ${G.mustard}40` }}>
                <td style={{ ...tdBase, fontWeight: 900, color: G.mustard, position: 'sticky', left: 0, background: G.text, zIndex: 3, borderBottom: 'none' }}>{viewBy === 'grupo' ? `TOTAL — ${pivot.rows.length} GRUPOS` : `TOTAL — ${pivot.rows.length} CLIENTES`}</td>
                {pivot.cols.map(col => {
                  const tv = pivot.rows.reduce((s, r) => s + (r.months[col]?.valor || 0), 0);
                  const tq = pivot.rows.reduce((s, r) => s + (r.months[col]?.qtd   || 0), 0);
                  return (
                    <>
                      <td key={`${col}-v`} style={{ ...tdBase, textAlign: 'right', fontWeight: 800, color: '#E8E1D4', borderBottom: 'none' }}>{fmtR$(tv)}</td>
                      <td key={`${col}-q`} style={{ ...tdBase, textAlign: 'right', fontWeight: 800, color: '#E8E1D4', borderBottom: 'none' }}>{fmtN(tq)}</td>
                    </>
                  );
                })}
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#162436', borderLeft: `2px solid ${G.mustard}40`, borderBottom: 'none' }}>{fmtR$(pivot.grandValor)}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#162436', borderBottom: 'none' }}>{fmtN(Math.round(pivot.grandQtd))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
