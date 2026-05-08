import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertCircle, ChevronDown, ChevronRight, Package, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Row { industria_nome: string; ped_pedido: string; ped_data: string; cliente: string; codigo: string; produto: string; qtd_vendida: number; qtd_faturada: number; saldo: number; }

const IND_COLORS = ['#0891B2','#7C3AED','#16A34A','#D97706','#BE185D','#0F766E','#1D4ED8','#DC2626','#B45309','#059669'];
const NAVY_DRK = '#162436';
const n = (v: any) => +(v) || 0;
const fmtDate = (d: string) => { if (!d) return '—'; const s = String(d).slice(0, 10); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' };
const CELL = { padding: '6px 12px', borderBottom: `1px solid ${G.border}`, fontSize: 12, whiteSpace: 'nowrap' as const };

function Section({ nome, rows, color }: { nome: string; rows: Row[]; color: string }) {
  const [open, setOpen] = useState(false);
  const subtSaldo = rows.reduce((s, r) => s + n(r.saldo), 0);
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: open ? `${color}12` : G.card, border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: open ? `1px solid ${G.border}` : 'none', transition: 'background 0.15s' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={14} style={{ color }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: open ? color : G.text }}>{nome}</div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>{rows.length} item{rows.length !== 1 ? 'ns' : ''} pendente{rows.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 28, marginRight: 8 }}>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Saldo (qtd)</div><div style={{ fontSize: 13, fontWeight: 800, color: '#B45309' }}>{subtSaldo.toLocaleString('pt-BR')}</div></div>
        </div>
        {open ? <ChevronDown size={15} style={{ color, flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: G.textMuted, flexShrink: 0 }} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr style={{ background: G.cardHi }}>
                {['Pedido','Dt. Pedido','Cliente','Código','Produto','Qtd. Vend.','Qtd. Fat.','Saldo'].map((h, i) => (
                  <th key={h} style={{ ...CELL, textAlign: i >= 5 ? 'right' : 'left', color: G.textMuted, fontWeight: 700, borderBottom: `2px solid ${G.border}`, fontSize: 12 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.ped_pedido}-${r.codigo}-${i}`} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ ...CELL, fontFamily: 'monospace', fontWeight: 700, color: G.text }}>{r.ped_pedido}</td>
                    <td style={{ ...CELL, color: G.textMuted }}>{fmtDate(r.ped_data)}</td>
                    <td style={{ ...CELL, color: G.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cliente}</td>
                    <td style={{ ...CELL, fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.text }}>{r.codigo}</td>
                    <td style={{ ...CELL, color: G.textSec, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.produto}</td>
                    <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', color: G.textSec }}>{n(r.qtd_vendida).toLocaleString('pt-BR')}</td>
                    <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', color: n(r.qtd_faturada) > 0 ? '#16A34A' : G.textMuted }}>{n(r.qtd_faturada).toLocaleString('pt-BR')}</td>
                    <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#B45309' }}>{n(r.saldo).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ background: `${color}10` }}>
                <td colSpan={7} style={{ ...CELL, fontWeight: 800, fontSize: 12, color, textTransform: 'uppercase' }}>Subtotal {nome}</td>
                <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#B45309' }}>{subtSaldo.toLocaleString('pt-BR')}</td>
              </tr></tfoot>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProdutosNaoFaturadosReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim, setDataFim] = useState(today);
  const [industria, setIndustria] = useState('');
  const [industrias, setIndustrias] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gerado, setGerado] = useState(false);

  useEffect(() => { api.get('/suppliers').then(r => setIndustrias(r.data.data || [])); }, []);

  const visualizar = useCallback(async () => {
    setLoading(true); setError(null); setGerado(false);
    try {
      const p = new URLSearchParams({ dataInicio, dataFim });
      if (industria) p.set('industria', industria);
      const r = await api.get(`/reports/faturamento/produtos-nao-faturados?${p}`);
      if (r.data.success) { setRows(r.data.data); setGerado(true); } else setError(r.data.message);
    } catch { setError('Falha na comunicação com o servidor.'); } finally { setLoading(false); }
  }, [dataInicio, dataFim, industria]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const nomes = [...new Set(rows.map(r => r.industria_nome))].sort();
    for (const nome of nomes) {
      const linhas = rows.filter(r => r.industria_nome === nome);
      const ws = XLSX.utils.aoa_to_sheet([
        ['Pedido','Dt. Pedido','Cliente','Código','Produto','Qtd. Vend.','Qtd. Fat.','Saldo'],
        ...linhas.map(r => [r.ped_pedido, fmtDate(r.ped_data), r.cliente, r.codigo, r.produto, n(r.qtd_vendida), n(r.qtd_faturada), n(r.saldo)]),
        ['','','','','SUBTOTAL','',linhas.reduce((s,r)=>s+n(r.qtd_faturada),0), linhas.reduce((s,r)=>s+n(r.saldo),0)],
      ]);
      ws['!cols'] = [14,12,28,14,30,10,10,10].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome.substring(0, 31));
    }
    XLSX.writeFile(wb, `produtos_nao_faturados_${dataInicio}_${dataFim}.xlsx`);
  };

  const grupos = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) { if (!map.has(r.industria_nome)) map.set(r.industria_nome, []); map.get(r.industria_nome)!.push(r); }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const grandItens = rows.length;
  const grandSaldo = rows.reduce((s, r) => s + n(r.saldo), 0);

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        {[['Data Pedido Inicial', dataInicio, setDataInicio], ['Data Pedido Final', dataFim, setDataFim]].map(([lbl, val, set]) => (
          <div key={lbl as string} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase' }}>{lbl as string}</label>
            <input type="date" style={inp} value={val as string} onChange={e => (set as any)(e.target.value)} />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase' }}>Indústria</label>
          <select style={inp} value={industria} onChange={e => setIndustria(e.target.value)}>
            <option value="">Todas</option>
            {industrias.map((i: any) => <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>)}
          </select>
        </div>
        <button onClick={visualizar} disabled={loading} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: G.mustard, color: G.text, border: 'none', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {loading ? 'Buscando...' : 'Visualizar'}
        </button>
        {gerado && <button onClick={handleExport} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: G.card, color: G.textSec, border: `1px solid ${G.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Download size={13} /> Exportar Excel</button>}
      </div>
      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}><AlertCircle size={14} /> {error}</div>}
      {gerado && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[{ label: 'Itens', val: grandItens.toLocaleString('pt-BR'), color: '#0891B2' }, { label: 'Indústrias', val: String(grupos.length), color: '#7C3AED' }, { label: 'Saldo Total (qtd)', val: grandSaldo.toLocaleString('pt-BR'), color: '#B45309' }].map(k => (
            <div key={k.label} style={{ flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: G.text }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}
      {gerado && grupos.length > 0 && (
        <div style={{ flex: 1 }}>
          {grupos.map(([nome, grupoRows], idx) => <Section key={nome} nome={nome} rows={grupoRows} color={IND_COLORS[idx % IND_COLORS.length]} />)}
          <div style={{ background: NAVY_DRK, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5 }}>TOTAL GERAL — {grandItens} item{grandItens !== 1 ? 'ns' : ''} · {grupos.length} indústria{grupos.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Saldo Pendente (qtd)</div><div style={{ fontSize: 15, fontWeight: 800, color: '#FCD34D', fontFamily: 'monospace' }}>{grandSaldo.toLocaleString('pt-BR')}</div></div>
            </div>
          </div>
        </div>
      )}
      {gerado && rows.length === 0 && !error && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}><Package size={40} style={{ opacity: 0.3 }} /><span style={{ fontSize: 13, fontWeight: 600 }}>Nenhum produto pendente de faturamento</span></div>}
      {loading && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>Carregando...</div>}
    </div>
  );
}
