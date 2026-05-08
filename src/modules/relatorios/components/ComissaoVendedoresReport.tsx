import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertCircle, ChevronDown, ChevronRight, DollarSign, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Row {
  industria_nome: string;
  cliente: string;
  ped_pedido: string;
  ped_data: string;
  fat_nf: string;
  fat_datafat: string;
  valor_pedido: number;
  fat_valorfat: number;
  percent_display: number;
  comissao: number;
}

const COLOR    = '#D97706';
const NAVY_DRK = '#162436';
const IND_COLORS = ['#0891B2','#7C3AED','#16A34A','#D97706','#BE185D','#0F766E','#1D4ED8','#DC2626','#B45309','#059669'];

const n      = (v: any) => +(v) || 0;
const fmtBRL = (v: any) => n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: any) => `${n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmtDate = (d: string) => { if (!d) return '—'; const s = String(d).slice(0, 10); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' };
const CELL = { padding: '6px 12px', borderBottom: `1px solid ${G.border}`, fontSize: 12, whiteSpace: 'nowrap' as const };

function IndustriaSection({ nome, rows, color, defaultOpen }: {
  nome: string; rows: Row[]; color: string; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const subtFat = rows.reduce((s, r) => s + n(r.fat_valorfat), 0);
  const subtCom = rows.reduce((s, r) => s + n(r.comissao),    0);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', background: open ? `${color}12` : G.card,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        borderBottom: open ? `1px solid ${G.border}` : 'none', transition: 'background 0.15s',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DollarSign size={14} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: open ? color : G.text }}>{nome}</div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>{rows.length} fatura{rows.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 28, marginRight: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Vlr. Faturado</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: G.textSec }}>{fmtBRL(subtFat)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Comissão</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLOR }}>{fmtBRL(subtCom)}</div>
          </div>
        </div>
        {open ? <ChevronDown size={15} style={{ color, flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: G.textMuted, flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: G.cardHi }}>
                  {['Pedido','Data Fat.','NF','Cliente','Vlr. Pedido','Vlr. Faturado','%','Comissão'].map((h, i) => (
                    <th key={h} style={{ ...CELL, textAlign: i >= 4 ? 'right' : 'left', color: G.textMuted, fontWeight: 700, borderBottom: `2px solid ${G.border}`, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.ped_pedido}-${r.fat_nf}-${i}`} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ ...CELL, fontFamily: 'monospace', fontWeight: 700, color: G.text }}>{r.ped_pedido}</td>
                    <td style={{ ...CELL, color: G.textMuted }}>{fmtDate(r.fat_datafat)}</td>
                    <td style={{ ...CELL, fontFamily: 'monospace', color: G.textMuted }}>{r.fat_nf}</td>
                    <td style={{ ...CELL, color: G.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cliente}</td>
                    <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', color: G.textMuted }}>{fmtBRL(r.valor_pedido)}</td>
                    <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', color: G.textSec, fontWeight: 600 }}>{fmtBRL(r.fat_valorfat)}</td>
                    <td style={{ ...CELL, textAlign: 'right', color: G.textMuted }}>{fmtPct(r.percent_display)}</td>
                    <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: COLOR }}>{fmtBRL(r.comissao)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: `${color}10` }}>
                  <td colSpan={5} style={{ ...CELL, fontWeight: 800, fontSize: 12, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>Subtotal {nome}</td>
                  <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: G.textSec }}>{fmtBRL(subtFat)}</td>
                  <td />
                  <td style={{ ...CELL, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: COLOR }}>{fmtBRL(subtCom)}</td>
                </tr>
              </tfoot>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ComissaoVendedoresReport() {
  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim,    setDataFim]    = useState(today);
  const [vendedor,   setVendedor]   = useState('');
  const [industria,  setIndustria]  = useState('');
  const [rows,       setRows]       = useState<Row[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [industrias, setIndustrias] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [gerado,     setGerado]     = useState(false);

  useEffect(() => {
    api.get('/sellers').then(r => setVendedores(r.data.data || []));
    api.get('/suppliers').then(r => setIndustrias(r.data.data || []));
  }, []);

  const visualizar = useCallback(async () => {
    setLoading(true); setError(null); setGerado(false);
    try {
      const params = new URLSearchParams({ dataInicio, dataFim });
      if (vendedor) params.set('vendedor', vendedor);
      if (industria) params.set('industria', industria);
      const r = await api.get(`/reports/faturamento/comissao?${params}`);
      if (r.data.success) { setRows(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação com o servidor.'); }
    finally { setLoading(false); }
  }, [dataInicio, dataFim, vendedor, industria]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const grupos = [...new Set(rows.map(r => r.industria_nome))].sort();

    for (const nome of grupos) {
      const linhas = rows.filter(r => r.industria_nome === nome);
      const header = ['Pedido','Data Fat.','NF','Cliente','Vlr. Pedido','Vlr. Faturado','%','Comissão'];
      const data = linhas.map(r => [
        r.ped_pedido,
        fmtDate(r.fat_datafat),
        r.fat_nf,
        r.cliente,
        n(r.valor_pedido),
        n(r.fat_valorfat),
        n(r.percent_display),
        n(r.comissao),
      ]);
      const subtFat = linhas.reduce((s, r) => s + n(r.fat_valorfat), 0);
      const subtCom = linhas.reduce((s, r) => s + n(r.comissao), 0);
      data.push(['','','','SUBTOTAL','', subtFat, '', subtCom]);

      const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
      ws['!cols'] = [14,12,10,28,14,14,8,14].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nome.substring(0, 31));
    }

    // Aba resumo
    const resumoHeader = ['Indústria','Faturas','Vlr. Faturado','Comissão'];
    const resumoData = grupos.map(nome => {
      const linhas = rows.filter(r => r.industria_nome === nome);
      return [nome, linhas.length, linhas.reduce((s, r) => s + n(r.fat_valorfat), 0), linhas.reduce((s, r) => s + n(r.comissao), 0)];
    });
    resumoData.push(['TOTAL GERAL', rows.length, rows.reduce((s, r) => s + n(r.fat_valorfat), 0), rows.reduce((s, r) => s + n(r.comissao), 0)]);
    const wsRes = XLSX.utils.aoa_to_sheet([resumoHeader, ...resumoData]);
    wsRes['!cols'] = [32, 10, 16, 16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo');

    XLSX.writeFile(wb, `comissao_${dataInicio}_${dataFim}.xlsx`);
  };

  const grupos = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      if (!map.has(r.industria_nome)) map.set(r.industria_nome, []);
      map.get(r.industria_nome)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const grandFat = rows.reduce((s, r) => s + n(r.fat_valorfat), 0);
  const grandCom = rows.reduce((s, r) => s + n(r.comissao),    0);

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtros — mesma linha, sem card */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Data Inicial</label>
          <input type="date" style={inp} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Data Final</label>
          <input type="date" style={inp} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Vendedor</label>
          <select style={inp} value={vendedor} onChange={e => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {vendedores.map((v: any) => <option key={v.ven_codigo} value={v.ven_codigo}>{v.ven_nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Indústria</label>
          <select style={inp} value={industria} onChange={e => setIndustria(e.target.value)}>
            <option value="">Todas</option>
            {industrias.map((i: any) => <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>)}
          </select>
        </div>
        <button onClick={visualizar} disabled={loading} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: G.mustard, color: G.text, border: 'none', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {loading ? 'Buscando...' : 'Visualizar'}
        </button>
        {gerado && (
          <button onClick={handleExport} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: G.card, color: G.textSec, border: `1px solid ${G.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* KPIs */}
      {gerado && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Faturas',        val: rows.length.toLocaleString('pt-BR'), color: '#0891B2' },
            { label: 'Indústrias',     val: String(grupos.length),               color: '#7C3AED' },
            { label: 'Vlr. Faturado',  val: fmtBRL(grandFat),                   color: G.mustard },
            { label: 'Total Comissão', val: fmtBRL(grandCom),                   color: COLOR },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k.label === 'Total Comissão' ? COLOR : G.text }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acordeões */}
      {gerado && grupos.length > 0 && (
        <div style={{ flex: 1 }}>
          {grupos.map(([nome, grupoRows], idx) => (
            <IndustriaSection key={nome} nome={nome} rows={grupoRows} color={IND_COLORS[idx % IND_COLORS.length]} defaultOpen={idx === 0} />
          ))}
          <div style={{ background: NAVY_DRK, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TOTAL GERAL — {rows.length} fatura{rows.length !== 1 ? 's' : ''} · {grupos.length} indústria{grupos.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Vlr. Faturado</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>{fmtBRL(grandFat)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Total Comissão</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#FCD34D', fontFamily: 'monospace' }}>{fmtBRL(grandCom)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {gerado && rows.length === 0 && !error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <DollarSign size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nenhum registro encontrado no período</span>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando comissões...
        </div>
      )}
    </div>
  );
}
