import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart2, Download, Play, Factory, User, Briefcase, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; }
interface Cliente   { cli_codigo: number; cli_nomred: string; }
interface Vendedor  { ven_codigo: number; ven_nome: string; }
interface RawRow    { cliente_nome: string; industria_nome: string; mes: string; valor: number; qtd: number; vendedor_nome: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtR$ = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtN = (v: number) => v.toLocaleString('pt-BR');
const norm = (s: string) => (s || '').trim().toUpperCase();

// ─── Styles ──────────────────────────────────────────────────────────────────
const selStyle: React.CSSProperties = {
  height: 32, padding: '0 8px 0 26px', borderRadius: 7, fontSize: 11, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
  outline: 'none', cursor: 'pointer', minWidth: 160, maxWidth: 220,
};
const labelSt: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 3,
};
const chkLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  fontSize: 10, fontWeight: 700, color: G.textSec, userSelect: 'none',
};

type ViewMode = 'ambos' | 'valor' | 'qtd';

// ─── MapaVendas ───────────────────────────────────────────────────────────────
export default function MapaVendas({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  const [industria, setIndustria] = useState('ALL');
  const [cliente,   setCliente]   = useState('ALL');
  const [vendedor,  setVendedor]  = useState('ALL');
  const [grupo,     setGrupo]     = useState(false);
  const [compAnos,  setCompAnos]  = useState(false);
  const [viewMode,  setViewMode]  = useState<ViewMode>('ambos');

  const [rawData, setRawData]   = useState<RawRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loaded,  setLoaded]    = useState(false);

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || []));
    api.get('/clients?limit=2000').then(r => setClientes(r.data.data || []));
    api.get('/sellers').then(r       => setVendedores(r.data.data  || []));
  }, []);

  const processar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/estatisticas/mapa-vendas', {
        params: { dataInicial: dataInicio, dataFinal: dataFim, industria, cliente, vendedor, grupo },
      });
      setRawData(res.data.data || []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, vendedor, grupo]);

  // ─── Pivot ─────────────────────────────────────────────────────────────────
  const pivot = useMemo(() => {
    if (!rawData.length) return { cols: [], rows: [] };
    const MONTH_NAMES: Record<string, string> = {
      '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
      '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez',
    };

    if (compAnos) {
      // Comparative: cols = 12 months, rows = client + year
      const allMonths = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
      const cols = allMonths.map(m => `${m} - ${MONTH_NAMES[m]}`);

      const rowKeys = [...new Set(rawData.map(d => {
        const [, yr] = d.mes.split('/');
        return `${norm(d.cliente_nome)}|${yr}`;
      }))].sort();

      const rows = rowKeys.map(key => {
        const [cli, yr] = key.split('|');
        const display = rawData.find(d => norm(d.cliente_nome) === cli)?.cliente_nome || cli;
        const row: Record<string, any> = { _label: `${display} (${yr})`, totalValor: 0, totalQtd: 0 };
        allMonths.forEach(m => {
          const colLabel = `${m} - ${MONTH_NAMES[m]}`;
          const items = rawData.filter(d => norm(d.cliente_nome) === cli && d.mes === `${m}/${yr}`);
          const v = items.reduce((s, x) => s + x.valor, 0);
          const q = items.reduce((s, x) => s + x.qtd,   0);
          row[`${colLabel}_v`] = v; row[`${colLabel}_q`] = q;
          row.totalValor += v; row.totalQtd += q;
        });
        return row;
      });
      rows.sort((a, b) => b.totalValor - a.totalValor);
      return { cols, rows };
    }

    // Standard
    const colSet = new Set(rawData.map(d => d.mes));
    const cols = [...colSet].sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      return ya !== yb ? ya - yb : ma - mb;
    });

    const rowKeys = [...new Set(rawData.map(d => norm(d.cliente_nome)))].sort();
    const rows = rowKeys.map(key => {
      const display = rawData.find(d => norm(d.cliente_nome) === key)?.cliente_nome || key;
      const row: Record<string, any> = { _label: display, totalValor: 0, totalQtd: 0 };
      cols.forEach(col => {
        const items = rawData.filter(d => norm(d.cliente_nome) === key && d.mes === col);
        const v = items.reduce((s, x) => s + x.valor, 0);
        const q = items.reduce((s, x) => s + x.qtd,   0);
        row[`${col}_v`] = v; row[`${col}_q`] = q;
        row.totalValor += v; row.totalQtd += q;
      });
      return row;
    });
    rows.sort((a, b) => b.totalValor - a.totalValor);
    return { cols, rows };
  }, [rawData, compAnos]);

  const showV = viewMode === 'ambos' || viewMode === 'valor';
  const showQ = viewMode === 'ambos' || viewMode === 'qtd';
  const subCols = (showV ? 1 : 0) + (showQ ? 1 : 0);

  // ─── Export completo ───────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!pivot.rows.length) return;
    const header = ['CLIENTE'];
    pivot.cols.forEach(c => { header.push(c); if (subCols > 1) header.push(' '); });
    header.push('TOTAL'); if (subCols > 1) header.push(' ');
    const subH = subCols > 1 ? ['', ...pivot.cols.flatMap(() => [showV && 'Valor', showQ && 'Qtd'].filter(Boolean)),
      ...[showV && 'Val. Total', showQ && 'Qtd Total'].filter(Boolean)] : [];
    const dataRows = pivot.rows.map(r => [
      r._label,
      ...pivot.cols.flatMap(c => [showV && r[`${c}_v`], showQ && r[`${c}_q`]].filter(x => x !== false)),
      ...[showV && r.totalValor, showQ && r.totalQtd].filter(x => x !== false),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...(subCols > 1 ? [subH] : []), ...dataRows]);
    ws['!cols'] = [{ wch: 30 }, ...pivot.cols.flatMap(() => Array(subCols).fill({ wch: 16 })), ...Array(subCols).fill({ wch: 18 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa_Vendas');
    XLSX.writeFile(wb, `Mapa_Vendas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ─── Export simplificado (última compra por indústria) ─────────────────────
  const exportSimplificado = () => {
    if (!rawData.length) return;

    // agrupa por cliente: última data+valor por indústria
    const clientMap = new Map<string, { vendedor: string; industries: Map<string, { valor: number; mes: string }> }>();
    rawData.forEach(row => {
      const cli = row.cliente_nome;
      if (!clientMap.has(cli)) clientMap.set(cli, { vendedor: row.vendedor_nome || '', industries: new Map() });
      const node = clientMap.get(cli)!;
      const existing = node.industries.get(row.industria_nome);
      if (!existing || row.mes > existing.mes) {
        node.industries.set(row.industria_nome, { valor: row.valor, mes: row.mes });
      }
    });

    const allIndustries = [...new Set(rawData.map(r => r.industria_nome))].sort();
    const header = ['CLIENTE', 'VENDEDOR', 'OBSERVAÇÃO',
      ...allIndustries.flatMap(ind => [`${ind} - Últ. Valor`, `${ind} - Últ. Compra`])];

    const dataRows = [...clientMap.entries()].map(([cli, { vendedor, industries }]) => [
      cli, vendedor, '',
      ...allIndustries.flatMap(ind => {
        const info = industries.get(ind);
        return info ? [info.valor, info.mes] : ['', ''];
      }),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 20 }, ...allIndustries.flatMap(() => [{ wch: 16 }, { wch: 12 }])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa_Simplificado');
    XLSX.writeFile(wb, `Mapa_Simplificado_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ─── TH / cell styles ──────────────────────────────────────────────────────
  const thBase: React.CSSProperties = {
    padding: '6px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
    textTransform: 'uppercase', borderRight: `1px solid rgba(255,255,255,0.1)`,
    whiteSpace: 'nowrap',
  };
  const tdBase: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, borderRight: `1px solid ${G.border}`,
    borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Filtros ── */}
      <div style={{
        padding: '10px 18px', background: G.card, borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>

        {/* Indústria */}
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

        {/* Vendedor */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Vendedor</div>
          <div style={{ position: 'relative' }}>
            <Briefcase size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={vendedor} onChange={e => setVendedor(e.target.value)}>
              <option value="ALL">Todos</option>
              {vendedores.map(v => <option key={v.ven_codigo} value={String(v.ven_codigo)}>{v.ven_nome}</option>)}
            </select>
          </div>
        </div>

        {/* Cliente */}
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

        {/* Checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 2 }}>
          <label style={chkLabel}>
            <input type="checkbox" checked={grupo} onChange={e => setGrupo(e.target.checked)}
              style={{ accentColor: G.mustard, width: 13, height: 13, cursor: 'pointer' }} />
            <Users size={11} style={{ color: G.textMuted }} /> Considerar Rede
          </label>
          <label style={chkLabel}>
            <input type="checkbox" checked={compAnos} onChange={e => setCompAnos(e.target.checked)}
              style={{ accentColor: G.mustard, width: 13, height: 13, cursor: 'pointer' }} />
            Comparar Anos
          </label>
        </div>

        {/* Toggle AMBOS/VALOR/QTD */}
        <div style={{
          display: 'flex', background: G.bg, borderRadius: 7, padding: 3,
          border: `1px solid ${G.border}`, alignSelf: 'flex-end', gap: 1,
        }}>
          {(['ambos', 'valor', 'qtd'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 9, fontWeight: 800,
              letterSpacing: 0.5, textTransform: 'uppercase', border: 'none', cursor: 'pointer',
              background: viewMode === m ? G.text : 'transparent',
              color: viewMode === m ? G.mustard : G.textMuted,
              transition: 'all 0.12s',
            }}>
              {m === 'ambos' ? 'AMBOS' : m === 'valor' ? 'VALOR' : 'QTD'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Export simplificado */}
        <button
          style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: '#0891B2', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', opacity: rawData.length ? 1 : 0.4 }}
          onClick={exportSimplificado} disabled={!rawData.length} title="Exportar Excel Simplificado (Últ. compra por indústria)"
        >
          <Download size={12} /> Simplificado
        </button>

        {/* Export completo */}
        <button
          style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', opacity: pivot.rows.length ? 1 : 0.4 }}
          onClick={exportExcel} disabled={!pivot.rows.length} title="Exportar Excel Completo"
        >
          <Download size={12} /> Excel
        </button>

        {/* Processar */}
        <button
          onClick={processar} disabled={loading}
          style={{ height: 32, padding: '0 18px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: G.text, color: G.mustard, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', opacity: loading ? 0.6 : 1 }}
        >
          {loading
            ? <><span style={{ width: 11, height: 11, border: '2px solid rgba(255,210,0,0.3)', borderTopColor: G.mustard, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Processando...</>
            : <><Play size={12} /> Processar</>
          }
        </button>
      </div>

      {/* ── Tabela Pivot ── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {!loaded ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <BarChart2 size={40} style={{ color: G.border }} />
            <span style={{ fontSize: 12, color: G.textMuted }}>Configure os filtros e clique em Processar</span>
          </div>
        ) : pivot.rows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: G.textMuted }}>Nenhum registro encontrado para o período</span>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              {/* Row 1 — meses */}
              <tr style={{ background: G.text }}>
                <th rowSpan={subCols > 1 ? 2 : 1} style={{ ...thBase, color: G.mustard, minWidth: 180, textAlign: 'left', position: 'sticky', left: 0, background: G.text, zIndex: 3 }}>
                  CLIENTE
                </th>
                {pivot.cols.map(col => (
                  <th key={col} colSpan={subCols} style={{ ...thBase, color: '#E8E1D4', textAlign: 'center', minWidth: subCols > 1 ? 180 : 100 }}>
                    {col}
                  </th>
                ))}
                <th colSpan={subCols} style={{ ...thBase, color: G.mustard, textAlign: 'center', background: '#162436', borderLeft: `2px solid ${G.mustard}40` }}>
                  TOTAL
                </th>
              </tr>
              {/* Row 2 — Valor/Qtd sub-headers */}
              {subCols > 1 && (
                <tr style={{ background: '#1a2633' }}>
                  {[...pivot.cols, '__total'].map(col => (
                    <>
                      {showV && <th key={`${col}-v`} style={{ ...thBase, color: '#94A3B8', textAlign: 'right', minWidth: 95, fontWeight: 600 }}>Valor R$</th>}
                      {showQ && <th key={`${col}-q`} style={{ ...thBase, color: '#94A3B8', textAlign: 'right', minWidth: 70, fontWeight: 600 }}>Qtd</th>}
                    </>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {pivot.rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                  <td style={{ ...tdBase, fontWeight: 700, color: G.text, position: 'sticky', left: 0, background: i % 2 === 0 ? G.card : G.bg, zIndex: 1, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row._label}>
                    {row._label}
                  </td>
                  {pivot.cols.map(col => (
                    <>
                      {showV && <td key={`${col}-v`} style={{ ...tdBase, textAlign: 'right', color: G.text, fontVariantNumeric: 'tabular-nums' }}>{fmtR$(row[`${col}_v`] || 0)}</td>}
                      {showQ && <td key={`${col}-q`} style={{ ...tdBase, textAlign: 'right', color: G.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(row[`${col}_q`] || 0)}</td>}
                    </>
                  ))}
                  {showV && <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#1E2D3D', borderLeft: `2px solid ${G.mustard}30` }}>{fmtR$(row.totalValor)}</td>}
                  {showQ && <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#1E2D3D' }}>{fmtN(row.totalQtd)}</td>}
                </tr>
              ))}
            </tbody>
            {/* Totais gerais */}
            <tfoot>
              <tr style={{ background: G.text, position: 'sticky', bottom: 0, zIndex: 2, borderTop: `2px solid ${G.mustard}40` }}>
                <td style={{ ...tdBase, fontWeight: 900, color: G.mustard, position: 'sticky', left: 0, background: G.text, zIndex: 3, borderBottom: 'none' }}>
                  TOTAIS GERAIS
                </td>
                {pivot.cols.map(col => {
                  const tv = pivot.rows.reduce((s, r) => s + (r[`${col}_v`] || 0), 0);
                  const tq = pivot.rows.reduce((s, r) => s + (r[`${col}_q`] || 0), 0);
                  return (
                    <>
                      {showV && <td key={`${col}-v`} style={{ ...tdBase, textAlign: 'right', fontWeight: 800, color: '#E8E1D4', borderBottom: 'none' }}>{fmtR$(tv)}</td>}
                      {showQ && <td key={`${col}-q`} style={{ ...tdBase, textAlign: 'right', fontWeight: 800, color: '#E8E1D4', borderBottom: 'none' }}>{fmtN(tq)}</td>}
                    </>
                  );
                })}
                {showV && <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#162436', borderLeft: `2px solid ${G.mustard}40`, borderBottom: 'none' }}>{fmtR$(pivot.rows.reduce((s, r) => s + r.totalValor, 0))}</td>}
                {showQ && <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: G.mustard, background: '#162436', borderBottom: 'none' }}>{fmtN(pivot.rows.reduce((s, r) => s + r.totalQtd, 0))}</td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
