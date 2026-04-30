import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Printer, Loader2, AlertCircle, Clock, Phone } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Vendedor  { ven_codigo: number; ven_nome: string }
interface Industria { for_codigo: number; for_nomered: string }
interface Row {
  ped_pedido:       string;
  ped_data:         string;
  ped_numero:       number;
  cliente_nome:     string;
  cliente_fone:     string;
  industria_nome:   string;
  industria_codigo: number;
  vendedor_nome:    string;
  valor_total:      number;
  valor_bruto:      number;
  ped_obs:          string;
  dias_em_aberto:   number;
  qtd_itens:        number;
}

const inp: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text,
  outline: 'none', width: '100%',
};
const th: React.CSSProperties = {
  padding: '8px 10px', fontSize: 10, fontWeight: 800, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: 0.6,
  borderBottom: `2px solid ${G.border}`, background: G.cardHi, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '6px 10px', fontSize: 11, borderBottom: `1px solid ${G.border}40`, color: G.text,
};

const fmtBRL  = (v: number | string) => (parseFloat(String(v)) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

function diasColor(dias: number) {
  if (dias > 30) return '#DC2626';
  if (dias > 15) return '#D97706';
  return '#16A34A';
}
function diasLabel(dias: number) {
  if (dias === 0) return 'Hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

export default function CotacoesPendentesReport() {
  const [vendedores,   setVendedores]   = useState<Vendedor[]>([]);
  const [industrias,   setIndustrias]   = useState<Industria[]>([]);
  const [selVendedor,  setSelVendedor]  = useState('');
  const [selIndustria, setSelIndustria] = useState('');
  const [rows,         setRows]         = useState<Row[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [gerado,       setGerado]       = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/aux/vendedores').then(r => { if (r.data.success) setVendedores(r.data.data); });
    api.get('/aux/industrias?all=true').then(r => { if (r.data.success) setIndustrias(r.data.data); });
  }, []);

  const visualizar = useCallback(async () => {
    setLoading(true); setError(null); setGerado(false);
    try {
      const params = new URLSearchParams();
      if (selVendedor)  params.set('vendedor',  selVendedor);
      if (selIndustria) params.set('industria', selIndustria);
      const r = await api.get(`/reports/cotacoes-pendentes?${params}`);
      if (r.data.success) { setRows(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação com o servidor.'); }
    finally { setLoading(false); }
  }, [selVendedor, selIndustria]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=1100,height=750');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Cotações Pendentes</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 16px; }
        h2 { font-size: 14px; font-weight: 900; text-align: center; margin-bottom: 2px; }
        .sub { text-align: center; font-size: 10px; color: #666; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #28374A; color: #fff; padding: 6px 8px; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        thead th.r { text-align: right; }
        tbody tr:nth-child(even) { background: #f7f5f0; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e0d5; font-size: 10px; }
        td.r { text-align: right; font-family: monospace; }
        td.c { text-align: center; }
        tr.group-header td { background: #e8e1d4; font-weight: 900; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 8px; }
        tr.total-row td { background: #d3c7ad; font-weight: 900; }
        .dias-alert { color: #DC2626; font-weight: 900; }
        .dias-warn  { color: #D97706; font-weight: 700; }
        .dias-ok    { color: #16A34A; }
        @media print { body { padding: 8mm; } }
      </style></head><body>
      ${content.innerHTML}
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  const grupos = gerado ? Object.entries(
    rows.reduce<Record<string, Row[]>>((acc, r) => {
      const k = r.industria_nome;
      if (!acc[k]) acc[k] = [];
      acc[k].push(r);
      return acc;
    }, {})
  ) : [];

  const totalGeral = rows.reduce((s, r) => s + (parseFloat(String(r.valor_total)) || 0), 0);
  const totalItens = rows.reduce((s, r) => s + (Number(r.qtd_itens) || 0), 0);

  const indLabel = industrias.find(i => String(i.for_codigo) === selIndustria)?.for_nomered ?? 'Todas as indústrias';
  const venLabel = vendedores.find(v => String(v.ven_codigo) === selVendedor)?.ven_nome ?? 'Todos os vendedores';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>VENDEDOR (opcional)</label>
          <select style={inp} value={selVendedor} onChange={e => setSelVendedor(e.target.value)}>
            <option value="">— Todos —</option>
            {vendedores.map(v => (
              <option key={v.ven_codigo} value={v.ven_codigo}>{v.ven_nome}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 220 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>INDÚSTRIA (opcional)</label>
          <select style={inp} value={selIndustria} onChange={e => setSelIndustria(e.target.value)}>
            <option value="">— Todas —</option>
            {industrias.map(i => (
              <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>
            ))}
          </select>
        </div>
        <button
          onClick={visualizar}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 20px', borderRadius: 8, border: 'none',
            background: loading ? G.border : G.mustard,
            color: G.text, fontSize: 12, fontWeight: 900,
            cursor: loading ? 'default' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {loading ? 'Buscando...' : 'Visualizar'}
        </button>
        {gerado && (
          <button
            onClick={handlePrint}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8,
              border: `1px solid ${G.border}`, background: G.card,
              color: G.textSec, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Printer size={13} /> Imprimir
          </button>
        )}
      </div>

      {/* ── Erro ── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── KPI strip ── */}
      {gerado && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Cotações em aberto', value: rows.length, mono: false },
            { label: 'Total de itens',     value: totalItens,   mono: false },
            { label: 'Valor total (R$)',   value: `R$ ${fmtBRL(totalGeral)}`, mono: true },
            { label: 'Mais antiga',        value: `${Math.max(...rows.map(r => Number(r.dias_em_aberto)))} dias`, mono: false },
          ].map(kpi => (
            <div key={kpi.label} style={{
              flex: 1, background: G.card, borderRadius: 12, border: `1px solid ${G.border}`,
              padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: G.text, fontFamily: kpi.mono ? 'monospace' : undefined }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Resultado ── */}
      {gerado && (
        <div ref={printRef}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 900, color: G.text }}>Cotações Pendentes</h2>
            <p style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>
              {venLabel} · {indLabel} · Gerado em {fmtDate(new Date().toISOString())}
            </p>
          </div>

          {rows.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 48, color: G.textMuted,
              fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <Clock size={32} style={{ opacity: 0.3 }} />
              Nenhuma cotação pendente encontrada.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...th, minWidth: 90 }}>Data</th>
                  <th style={{ ...th, minWidth: 110 }}>Nº Cotação</th>
                  <th style={{ ...th, minWidth: 180 }}>Cliente</th>
                  <th style={{ ...th, minWidth: 120 }}>Telefone</th>
                  <th style={{ ...th, minWidth: 60, textAlign: 'center' }}>Itens</th>
                  <th style={{ ...th, minWidth: 130, textAlign: 'right' }}>Valor Total</th>
                  <th style={{ ...th, minWidth: 100, textAlign: 'center' }}>Em aberto</th>
                  <th style={{ ...th, minWidth: 120 }}>Obs</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([industria, linhas]) => {
                  const totInd = linhas.reduce((s, r) => s + r.valor_total, 0);
                  return (
                    <>
                      <tr key={`hdr-${industria}`} style={{ background: G.cardHi }}>
                        <td colSpan={8} style={{
                          ...td, fontWeight: 900, fontSize: 11,
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          color: G.textSec, borderTop: `2px solid ${G.border}`,
                        }}>
                          {industria}
                        </td>
                      </tr>

                      {linhas.map((r, i) => {
                        const dias = Number(r.dias_em_aberto);
                        return (
                          <tr key={`${r.ped_pedido}-${i}`} style={{ background: i % 2 === 0 ? G.card : G.cardHi }}>
                            <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtDate(r.ped_data)}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.textSec }}>{r.ped_pedido}</td>
                            <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente_nome}</td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                              {r.cliente_fone ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Phone size={10} style={{ color: G.textMuted, flexShrink: 0 }} />
                                  {r.cliente_fone}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{r.qtd_itens}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>R$ {fmtBRL(r.valor_total)}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                                background: `${diasColor(dias)}18`,
                                color: diasColor(dias),
                                border: `1px solid ${diasColor(dias)}40`,
                              }}>
                                {diasLabel(dias)}
                              </span>
                            </td>
                            <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: G.textMuted }}>
                              {r.ped_obs || '—'}
                            </td>
                          </tr>
                        );
                      })}

                      <tr key={`tot-${industria}`} style={{ background: `${G.border}60` }}>
                        <td colSpan={5} style={{ ...td, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: G.textMuted }}>
                          Total {industria} ({linhas.length} cotações)
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: G.text }}>R$ {fmtBRL(totInd)}</td>
                        <td colSpan={2} />
                      </tr>
                    </>
                  );
                })}

                <tr style={{ background: G.text }}>
                  <td colSpan={5} style={{ ...td, fontWeight: 900, fontSize: 11, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5, borderTop: `2px solid ${G.textSec}` }}>
                    Total Geral ({rows.length} cotações · {totalItens} itens)
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    R$ {fmtBRL(totalGeral)}
                  </td>
                  <td colSpan={2} style={{ borderTop: `2px solid ${G.textSec}` }} />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
