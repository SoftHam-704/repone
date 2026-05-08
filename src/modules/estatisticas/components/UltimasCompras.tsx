import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row {
  cliente: string; estado: string; industria: string; vendedor_nome: string;
  valor: number;   qtd: number;    data_ultima: string; dias: number;
}
interface IndOpt { id: number; nome: string; }
interface CliOpt { id: number; nome: string; }
interface VenOpt { id: number; nome: string; }

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

function diasColor(dias: number) {
  if (dias <= 30)  return { bg: '#DCFCE7', text: '#16A34A', dot: '#16A34A' };
  if (dias <= 60)  return { bg: '#DBEAFE', text: '#1D4ED8', dot: '#0891B2' };
  if (dias <= 90)  return { bg: '#FEF9C3', text: '#A16207', dot: '#D97706' };
  return               { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' };
}

function DiasChip({ dias }: { dias: number }) {
  const c = diasColor(dias);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: c.bg, color: c.text,
      padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {dias}d
    </span>
  );
}

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtVal  = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function UltimasCompras({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [vendedores, setVendedores] = useState<VenOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const [industria,  setIndustria]  = useState('ALL');
  const [cliente,    setCliente]    = useState('ALL');
  const [vendedor,   setVendedor]   = useState('ALL');
  const [grupo,      setGrupo]      = useState(false);
  const [modo,       setModo]       = useState<'acumulado' | 'ultima'>('acumulado');

  useEffect(() => {
    api.get('/aux/industrias').then(r =>
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))
    ).catch(() => {});
    api.get('/clients?limit=2000').then(r =>
      setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })))
    ).catch(() => {});
    api.get('/sellers').then(r =>
      setVendedores((r.data.data || []).map((v: any) => ({ id: v.ven_codigo, nome: v.ven_nome })))
    ).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        dataInicial: dataInicio, dataFinal: dataFim,
        industria, cliente, vendedor, grupo: String(grupo), modo,
      });
      const r = await api.get(`/estatisticas/ultimas-compras?${params}`);
      setRows(r.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, vendedor, grupo, modo]);

  useEffect(() => { load(); }, [load]);

  // ── Pivot: clientes × indústrias ────────────────────────────────────────
  const { pivotClientes, colIndustrias, pivot, minDias } = useMemo(() => {
    const indSet = new Set<string>();
    const cliMap = new Map<string, { estado: string; vendedor: string }>();

    for (const r of rows) {
      indSet.add(r.industria);
      if (!cliMap.has(r.cliente)) cliMap.set(r.cliente, { estado: r.estado, vendedor: r.vendedor_nome || '—' });
      else if (r.vendedor_nome && r.vendedor_nome !== '—') {
        cliMap.get(r.cliente)!.vendedor = r.vendedor_nome;
      }
    }

    const colIndustrias = [...indSet].sort();

    const pivot = new Map<string, Row>();
    for (const r of rows) pivot.set(`${r.cliente}||${r.industria}`, r);

    const pivotClientes = [...cliMap.entries()].sort((a, b) => {
      const minA = Math.min(...colIndustrias.map(ind => pivot.get(`${a[0]}||${ind}`)?.dias ?? 9999));
      const minB = Math.min(...colIndustrias.map(ind => pivot.get(`${b[0]}||${ind}`)?.dias ?? 9999));
      return minA - minB;
    });

    const allDias = rows.map(r => r.dias).filter(d => d < 9999);
    const minDias = allDias.length ? Math.min(...allDias) : 0;

    return { pivotClientes, colIndustrias, pivot, minDias };
  }, [rows]);

  const exportExcel = () => {
    if (!rows.length) return;
    const header = ['Cliente', 'UF', 'Vendedor', ...colIndustrias.flatMap(ind => [`${ind} — Dias`, `${ind} — Data`, `${ind} — Valor`])];
    const data = pivotClientes.map(([cliNome, info]) => [
      cliNome,
      info.estado,
      info.vendedor,
      ...colIndustrias.flatMap(ind => {
        const cell = pivot.get(`${cliNome}||${ind}`);
        if (!cell || cell.dias === 9999) return ['', '', ''];
        return [cell.dias, fmtDate(cell.data_ultima), cell.valor];
      }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Últimas Compras');
    XLSX.writeFile(wb, `UltimasCompras_${dataInicio}_${dataFim}.xlsx`);
  };

  const toggleBtn = (active: boolean) => ({
    padding: '5px 14px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? NAVY : G.cardHi, color: active ? G.mustard : G.textMuted,
    transition: 'all 0.15s',
  } as React.CSSProperties);

  // Legenda
  const legenda = [
    { label: '≤ 30 dias', ...diasColor(10) },
    { label: '31–60 dias', ...diasColor(45) },
    { label: '61–90 dias', ...diasColor(75) },
    { label: '> 90 dias',  ...diasColor(120) },
  ];

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>

        {[
          { label: 'Indústria', val: industria, set: setIndustria, opts: industrias, all: 'Todas as Indústrias' },
          { label: 'Vendedor',  val: vendedor,  set: setVendedor,  opts: vendedores, all: 'Todos os Vendedores' },
          { label: 'Cliente',   val: cliente,   set: setCliente,   opts: clientes,   all: 'Todos os Clientes' },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 170 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{f.label}</label>
            <select value={f.val} onChange={e => f.set(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}>
              <option value="ALL">{f.all}</option>
              {f.opts.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        ))}

        {/* Modo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Modo</label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${G.border}` }}>
            <button onClick={() => setModo('acumulado')} style={toggleBtn(modo === 'acumulado')}>Acumulado</button>
            <button onClick={() => setModo('ultima')}    style={toggleBtn(modo === 'ultima')}>Última</button>
          </div>
        </div>

        {/* Rede */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: G.text, paddingBottom: 2 }}>
          <input type="checkbox" checked={grupo} onChange={e => setGrupo(e.target.checked)}
            style={{ accentColor: G.mustard, width: 14, height: 14 }} />
          Rede de Lojas
        </label>

        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
          {rows.length > 0 && (
            <button onClick={exportExcel} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <FileDown size={14} /> Excel
            </button>
          )}
          <button onClick={load} disabled={loading} style={{
            padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: G.mustard, color: G.text, border: 'none', cursor: 'pointer',
          }}>
            {loading ? 'Carregando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Legenda + info */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>
            {pivotClientes.length} clientes · {colIndustrias.length} indústria{colIndustrias.length !== 1 ? 's' : ''}
            {minDias > 0 && <> · mais recente: <DiasChip dias={minDias} /></>}
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {legenda.map(l => (
              <span key={l.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: l.bg, color: l.text,
                padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: l.dot }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ── Pivot Grid ── */}
      {!loading && pivotClientes.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', left: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', minWidth: 200,
                }}>Cliente</th>
                <th style={{
                  position: 'sticky', left: 200, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', minWidth: 130,
                }}>Vendedor</th>

                {/* Indústria cols */}
                {colIndustrias.map(ind => (
                  <th key={ind} style={{
                    background: NAVY_DARK, color: G.mustard,
                    padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                    borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                    whiteSpace: 'nowrap', minWidth: 160,
                  }}>{ind}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivotClientes.map(([cliNome, info], idx) => {
                const bg = idx % 2 === 0 ? G.card : G.bg;
                return (
                <tr key={cliNome} style={{ background: bg }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: bg,
                    padding: '8px 14px', borderRight: `1px solid ${G.border}`,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: G.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                      {cliNome}
                    </div>
                    {info.estado && <div style={{ fontSize: 9, color: G.textMuted, fontWeight: 600, marginTop: 1 }}>{info.estado}</div>}
                  </td>
                  <td style={{
                    position: 'sticky', left: 200, zIndex: 2, background: bg,
                    padding: '8px 14px', borderRight: `1px solid ${G.border}`,
                    fontSize: 11, color: G.textSec, fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
                  }}>
                    {info.vendedor}
                  </td>

                  {/* Células por indústria */}
                  {colIndustrias.map(ind => {
                    const cell = pivot.get(`${cliNome}||${ind}`);
                    if (!cell) {
                      return (
                        <td key={ind} style={{ padding: '8px 12px', textAlign: 'center', color: G.textMuted, borderRight: `1px solid ${G.border}` }}>
                          <span style={{ fontSize: 16 }}>·</span>
                        </td>
                      );
                    }
                    const c = diasColor(cell.dias);
                    return (
                      <td key={ind} style={{
                        padding: '6px 10px', textAlign: 'center',
                        borderRight: `1px solid ${G.border}`,
                        background: `${c.bg}55`,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <DiasChip dias={cell.dias} />
                          <div style={{ fontSize: 10, color: G.textMuted }}>{fmtDate(cell.data_ultima)}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: G.text }}>{fmtVal(cell.valor)}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty */}
      {!loading && rows.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <Clock size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nenhuma compra encontrada no período</span>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando últimas compras...
        </div>
      )}
    </div>
  );
}
