import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row {
  pedido: string; data: string; situacao: string;
  cliente_nome: string; industria_nome: string; vendedor_nome: string;
  total_bruto: number; total_liq: number; total_ipi: number; num_itens: number; total_quant: number;
}
interface IndOpt { id: number; nome: string; }
interface CliOpt { id: number; nome: string; }
interface VenOpt { id: number; nome: string; }

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

const IND_COLORS = ['#0891B2','#7C3AED','#16A34A','#D97706','#BE185D','#0F766E','#1D4ED8','#DC2626','#B45309','#059669'];

const fmt     = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => { if (!d) return '—'; const s = String(d).slice(0, 10); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };

function StatusBadge({ sit }: { sit: string }) {
  const isFat = sit === 'F';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: isFat ? '#DCFCE7' : '#FEF9C3',
      color: isFat ? '#16A34A' : '#A16207',
    }}>
      {isFat ? 'Faturado' : 'Pedido'}
    </span>
  );
}

function IndustriaSection({ nome, rows, color, defaultOpen }: {
  nome: string; rows: Row[]; color: string; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const subtLiq  = rows.reduce((s, r) => s + r.total_liq,  0);
  const subtBrut = rows.reduce((s, r) => s + r.total_bruto, 0);
  const subtIpi  = rows.reduce((s, r) => s + r.total_ipi,   0);
  const faturados = rows.filter(r => r.situacao === 'F').length;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', background: open ? `${color}12` : G.card,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        borderBottom: open ? `1px solid ${G.border}` : 'none', transition: 'background 0.15s',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Package size={14} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: open ? color : G.text, letterSpacing: -0.2 }}>{nome}</div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>
            {rows.length} pedido{rows.length !== 1 ? 's' : ''} · {faturados} faturado{faturados !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginRight: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>IPI</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: G.textMuted }}>{fmt(subtIpi)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Total Líq.</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#16A34A' }}>{fmt(subtLiq)}</div>
          </div>
        </div>
        {open ? <ChevronDown size={15} style={{ color, flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: G.textMuted, flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
              <thead>
                <tr style={{ background: G.cardHi }}>
                  {['Pedido','Data','Cliente','Vendedor','Status','Itens','Qtd','Total Bruto','Total IPI','Total Líq.'].map((h, i) => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: i >= 5 ? 'right' : 'left', color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.pedido} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: G.text, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{r.pedido}</td>
                    <td style={{ padding: '7px 12px', color: G.textMuted, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{fmtDate(r.data)}</td>
                    <td style={{ padding: '7px 12px', color: G.text, fontWeight: 500, borderBottom: `1px solid ${G.border}`, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente_nome}</td>
                    <td style={{ padding: '7px 12px', color: G.textMuted, borderBottom: `1px solid ${G.border}`, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.vendedor_nome}</td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${G.border}` }}><StatusBadge sit={r.situacao} /></td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.text, fontWeight: 600, borderBottom: `1px solid ${G.border}` }}>{r.num_itens}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#0891B2', fontWeight: 700, borderBottom: `1px solid ${G.border}` }}>{r.total_quant % 1 === 0 ? r.total_quant.toLocaleString('pt-BR') : r.total_quant.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.textMuted, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{fmt(r.total_bruto)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.textMuted, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{fmt(r.total_ipi)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: G.text, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{fmt(r.total_liq)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: `${color}10` }}>
                  <td colSpan={5} style={{ padding: '7px 14px', fontWeight: 800, fontSize: 11, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>Subtotal {nome}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: G.textMuted }}>{rows.reduce((s, r) => s + r.num_itens, 0)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#0891B2' }}>{rows.reduce((s, r) => s + r.total_quant, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: G.textMuted }}>{fmt(subtBrut)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: G.textMuted }}>{fmt(subtIpi)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#16A34A' }}>{fmt(subtLiq)}</td>
                </tr>
              </tfoot>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MapaPedidos({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [vendedores, setVendedores] = useState<VenOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [industria,  setIndustria]  = useState('ALL');
  const [cliente,    setCliente]    = useState('ALL');
  const [vendedor,   setVendedor]   = useState('ALL');

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))).catch(() => {});
    api.get('/clients?limit=2000').then(r => setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })))).catch(() => {});
    api.get('/aux/vendedores').then(r => setVendedores((r.data.data || []).map((v: any) => ({ id: v.ven_codigo, nome: v.ven_nome })))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ dataInicial: dataInicio, dataFinal: dataFim, industria, cliente, vendedor });
      const r = await api.get(`/estatisticas/mapa-pedidos?${params}`);
      setRows(r.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, vendedor]);

  const exportExcel = () => {
    if (!rows.length) return;

    const COL = ['Pedido', 'Data', 'Cliente', 'Vendedor', 'Status', 'Itens', 'Qtd', 'Total Bruto', 'Total IPI', 'Total Líq.'];
    const aoa: any[][] = [COL];

    for (const [ind, indRows] of grupos) {
      // Cabeçalho da indústria
      aoa.push([`${ind.toUpperCase()}  (${indRows.length} pedido${indRows.length !== 1 ? 's' : ''})`]);

      // Linhas de detalhe
      indRows.forEach(r => aoa.push([
        r.pedido,
        fmtDate(r.data),
        r.cliente_nome,
        r.vendedor_nome,
        r.situacao === 'F' ? 'Faturado' : 'Pedido',
        r.num_itens,
        r.total_quant,
        r.total_bruto,
        r.total_ipi,
        r.total_liq,
      ]));

      // Subtotal da indústria
      aoa.push([
        `SUBTOTAL ${ind}`, '', '', '', '',
        indRows.reduce((s, r) => s + r.num_itens,    0),
        indRows.reduce((s, r) => s + r.total_quant,  0),
        indRows.reduce((s, r) => s + r.total_bruto,  0),
        indRows.reduce((s, r) => s + r.total_ipi,    0),
        indRows.reduce((s, r) => s + r.total_liq,    0),
      ]);

      aoa.push([]); // linha em branco entre grupos
    }

    // Total geral
    aoa.push([
      'TOTAL GERAL', '', '', '', '',
      rows.reduce((s, r) => s + r.num_itens,   0),
      rows.reduce((s, r) => s + r.total_quant, 0),
      rows.reduce((s, r) => s + r.total_bruto, 0),
      rows.reduce((s, r) => s + r.total_ipi,   0),
      rows.reduce((s, r) => s + r.total_liq,   0),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [14, 12, 30, 22, 10, 6, 10, 16, 16, 16].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa de Pedidos');
    XLSX.writeFile(wb, `MapaPedidos_${dataInicio}_${dataFim}.xlsx`);
  };

  useEffect(() => { load(); }, [load]);

  const grupos = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      if (!map.has(r.industria_nome)) map.set(r.industria_nome, []);
      map.get(r.industria_nome)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const grandLiq  = rows.reduce((s, r) => s + r.total_liq,  0);
  const grandBrut = rows.reduce((s, r) => s + r.total_bruto, 0);
  const grandIpi  = rows.reduce((s, r) => s + r.total_ipi,   0);

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtros */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        {[
          { label: 'Indústria', val: industria, set: setIndustria, opts: industrias, all: 'Todas as Indústrias' },
          { label: 'Cliente',   val: cliente,   set: setCliente,   opts: clientes,   all: 'Todos os Clientes' },
          { label: 'Vendedor',  val: vendedor,  set: setVendedor,  opts: vendedores, all: 'Todos os Vendedores' },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{f.label}</label>
            <select value={f.val} onChange={e => f.set(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}>
              <option value="ALL">{f.all}</option>
              {f.opts.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        ))}
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

      {error && <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>{error}</div>}

      {/* KPIs */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Pedidos',       val: rows.length.toLocaleString('pt-BR'),   color: '#0891B2' },
            { label: 'Indústrias',    val: String(grupos.length),                  color: '#7C3AED' },
            { label: 'Total Bruto',   val: fmt(grandBrut),                         color: G.mustard },
            { label: 'Total IPI',     val: fmt(grandIpi),                          color: '#D97706' },
            { label: 'Total Líquido', val: fmt(grandLiq),                          color: '#16A34A' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k.label === 'Total Líquido' ? '#16A34A' : G.text }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acordeões por indústria */}
      {!loading && grupos.length > 0 && (
        <div style={{ flex: 1 }}>
          {grupos.map(([nome, grupoRows], idx) => (
            <IndustriaSection key={nome} nome={nome} rows={grupoRows} color={IND_COLORS[idx % IND_COLORS.length]} defaultOpen={idx === 0} />
          ))}

          {/* Grand total */}
          <div style={{ background: NAVY_DARK, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TOTAL GERAL — {rows.length} pedido{rows.length !== 1 ? 's' : ''} · {grupos.length} indústria{grupos.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Total Bruto</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8' }}>{fmt(grandBrut)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Total IPI</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8' }}>{fmt(grandIpi)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Total Líquido</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#4ADE80' }}>{fmt(grandLiq)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <Package size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nenhum pedido encontrado no período</span>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando mapa de pedidos...
        </div>
      )}
    </div>
  );
}
