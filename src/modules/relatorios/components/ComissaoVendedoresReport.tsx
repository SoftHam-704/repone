import { useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { Search, Printer, Loader2, AlertCircle } from 'lucide-react';
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
interface Empresa { emp_nome: string; emp_cnpj: string; emp_endereco: string; emp_cidade: string; emp_uf: string; emp_fones: string; }

const COLOR = '#D97706';
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none' };
const th: React.CSSProperties = { padding: '7px 8px', fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${G.border}`, background: G.cardHi, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 11, borderBottom: `1px solid ${G.border}40`, color: G.text };
const fmtBRL = (v: number) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => { if (!d) return '—'; const s = String(d).slice(0, 10); const [y, m, day] = s.split('-'); return `${day}/${m}/${y}`; };

function groupBy(rows: Row[]): Record<string, Row[]> {
  return rows.reduce<Record<string, Row[]>>((acc, r) => {
    if (!acc[r.industria_nome]) acc[r.industria_nome] = [];
    acc[r.industria_nome].push(r);
    return acc;
  }, {});
}

export default function ComissaoVendedoresReport() {
  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim,    setDataFim]    = useState(today);
  const [vendedor,   setVendedor]   = useState('');
  const [industria,  setIndustria]  = useState('');
  const [rows,       setRows]       = useState<Row[]>([]);
  const [empresa,    setEmpresa]    = useState<Empresa | null>(null);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [industrias, setIndustrias] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [gerado,     setGerado]     = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
      if (r.data.success) { setRows(r.data.data); setEmpresa(r.data.empresa ?? null); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação com o servidor.'); }
    finally { setLoading(false); }
  }, [dataInicio, dataFim, vendedor, industria]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comissão de Vendedores</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 16px; }
      .company-box { border: 1px solid #ccc; border-radius: 6px; padding: 12px 16px; text-align: center; margin-bottom: 18px; }
      .company-name { font-size: 15px; font-weight: 900; margin-bottom: 4px; }
      .company-meta { font-size: 10px; color: #c00; margin-bottom: 2px; }
      .company-info { font-size: 10px; color: #444; }
      h2 { font-size: 13px; font-weight: 900; text-align: center; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      thead th { background: #28374A; color: #fff; padding: 5px 7px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
      thead th.r { text-align: right; }
      .group-hdr td { font-weight: 900; font-size: 12px; background: #f0ede8; padding: 7px 8px; border-top: 2px solid #D97706; }
      tbody tr:nth-child(even):not(.group-hdr):not(.subtotal):not(.total) { background: #f7f5f0; }
      td { padding: 4px 7px; border-bottom: 1px solid #e5e0d5; font-size: 11px; }
      td.r { text-align: right; font-family: monospace; }
      .subtotal td { background: #fff3cd; font-weight: 800; }
      .subtotal td.r { font-family: monospace; }
      .total td { background: #28374A; color: #FFD200; font-weight: 900; font-size: 12px; }
      .total td.r { font-family: monospace; text-align: right; }
      @media print { body { padding: 8mm; } }
    </style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const grupos = groupBy(rows);
  const totalGeral = rows.reduce((a, r) => ({ fat: a.fat + (r.fat_valorfat || 0), com: a.com + (r.comissao || 0) }), { fat: 0, com: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>DATA INICIAL *</label>
          <input type="date" style={inp} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>DATA FINAL *</label>
          <input type="date" style={inp} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>VENDEDOR</label>
          <select style={inp} value={vendedor} onChange={e => setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {vendedores.map((v: any) => <option key={v.ven_codigo} value={v.ven_codigo}>{v.ven_nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>INDÚSTRIA</label>
          <select style={inp} value={industria} onChange={e => setIndustria(e.target.value)}>
            <option value="">Todas</option>
            {industrias.map((i: any) => <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>)}
          </select>
        </div>
        <button
          onClick={visualizar}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 20px', borderRadius: 8, border: 'none', background: loading ? G.border : G.mustard, color: G.text, fontSize: 12, fontWeight: 900, cursor: loading ? 'default' : 'pointer' }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {loading ? 'Buscando...' : 'Visualizar'}
        </button>
        {gerado && (
          <button
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, color: G.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <Printer size={13} /> Imprimir
          </button>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {gerado && (
        <div ref={printRef}>
          {empresa && (
            <div className="company-box" style={{ border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 18px', textAlign: 'center', marginBottom: 16 }}>
              <div className="company-name" style={{ fontSize: 15, fontWeight: 900, color: G.text }}>{empresa.emp_nome}</div>
              {empresa.emp_cnpj && <div className="company-meta" style={{ fontSize: 11, color: '#c00' }}>CNPJ: {empresa.emp_cnpj}</div>}
              {empresa.emp_endereco && <div className="company-info" style={{ fontSize: 11, color: G.textMuted }}>End: {empresa.emp_endereco}{empresa.emp_cidade ? ` — ${empresa.emp_cidade}/${empresa.emp_uf}` : ''}</div>}
              {empresa.emp_fones && <div className="company-info" style={{ fontSize: 11, color: G.textMuted }}>Fones: {empresa.emp_fones}</div>}
              <div style={{ fontSize: 11, color: G.textMuted, marginTop: 6 }}>Período: {fmtDate(dataInicio)} até {fmtDate(dataFim)}</div>
            </div>
          )}
          <h2 style={{ fontSize: 14, fontWeight: 900, color: G.text, textAlign: 'center', marginBottom: 14 }}>Comissão de Vendedores</h2>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>Nenhum registro encontrado no período.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    ['Cliente', 'left'], ['Pedido', 'left'], ['Dt. Pedido', 'right'],
                    ['Nota', 'left'], ['Data Fat.', 'right'], ['Valor Ped.', 'right'],
                    ['Valor Fat.', 'right'], ['%', 'right'], ['Comissão', 'right']
                  ].map(([h, a]) => (
                    <th key={h} style={{ ...th, textAlign: a as any }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grupos).map(([nome, linhas]) => {
                  const sub = linhas.reduce((a, r) => ({ fat: a.fat + (r.fat_valorfat || 0), com: a.com + (r.comissao || 0) }), { fat: 0, com: 0 });
                  return (
                    <Fragment key={`group-${nome}`}>
                      <tr style={{ background: `${COLOR}10`, borderTop: `2px solid ${COLOR}` }}>
                        <td colSpan={9} style={{ ...td, fontWeight: 900, fontSize: 12, color: G.text, padding: '8px 8px' }}>{nome}</td>
                      </tr>
                      {linhas.map((r, i) => (
                        <tr key={`${nome}-${r.ped_pedido}-${r.fat_datafat}-${i}`} style={{ background: i % 2 === 0 ? 'transparent' : `${G.cardHi}50` }}>
                          <td style={td}>{r.cliente}</td>
                          <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{r.ped_pedido}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmtDate(r.ped_data)}</td>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{r.fat_nf}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmtDate(r.fat_datafat)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmtBRL(r.valor_pedido)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(r.fat_valorfat)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmtBRL(r.percent_display)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: COLOR }}>{fmtBRL(r.comissao)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: `${COLOR}12`, borderTop: `1px solid ${COLOR}40` }}>
                        <td colSpan={6} style={{ ...td, textAlign: 'right', fontWeight: 800, fontSize: 11, color: G.textSec }}>Sub-total:</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 900 }}>{fmtBRL(sub.fat)}</td>
                        <td />
                        <td style={{ ...td, textAlign: 'right', fontWeight: 900, color: COLOR }}>{fmtBRL(sub.com)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
                <tr style={{ background: G.text }}>
                  <td colSpan={6} style={{ ...td, color: G.mustard, fontWeight: 900, fontSize: 11, textAlign: 'right' }}>TOTAL GERAL</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 900, fontSize: 13, color: G.mustard }}>{fmtBRL(totalGeral.fat)}</td>
                  <td />
                  <td style={{ ...td, textAlign: 'right', fontWeight: 900, fontSize: 13, color: G.mustard }}>{fmtBRL(totalGeral.com)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
