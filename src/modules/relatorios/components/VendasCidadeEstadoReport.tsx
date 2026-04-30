import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Printer, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string }
interface Row {
  cidade:         string;
  ped_data:       string;
  ped_pedido:     string;
  cli_nomred:     string;
  industria_nome: string;
  valor_bruto:    number;
  valor_liquido:  number;
}
interface Empresa {
  emp_nome:     string;
  emp_cnpj:     string;
  emp_endereco: string;
  emp_cidade:   string;
  emp_uf:       string;
  emp_fones:    string;
}

const ESTADOS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

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
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

export default function VendasCidadeEstadoReport() {
  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [dataInicio,   setDataInicio]   = useState(firstDay);
  const [dataFim,      setDataFim]      = useState(today);
  const [selEstado,    setSelEstado]    = useState('');
  const [industrias,   setIndustrias]   = useState<Industria[]>([]);
  const [selIndustria, setSelIndustria] = useState('');
  const [rows,         setRows]         = useState<Row[]>([]);
  const [empresa,      setEmpresa]      = useState<Empresa | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [gerado,       setGerado]       = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/aux/industrias?all=true').then(r => { if (r.data.success) setIndustrias(r.data.data); });
  }, []);

  const visualizar = useCallback(async () => {
    if (!selEstado) return;
    setLoading(true); setError(null); setGerado(false);
    try {
      const params = new URLSearchParams({ dataInicio, dataFim, estado: selEstado });
      if (selIndustria) params.set('industria', selIndustria);
      const r = await api.get(`/reports/vendas-cidade-estado?${params}`);
      if (r.data.success) {
        setRows(r.data.data);
        setEmpresa(r.data.empresa ?? null);
        setGerado(true);
      } else { setError(r.data.message); }
    } catch { setError('Falha na comunicação com o servidor.'); }
    finally { setLoading(false); }
  }, [dataInicio, dataFim, selEstado, selIndustria]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Vendas por Cidade/Estado</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; padding: 16px; }
        .company-box { border: 1px solid #ccc; border-radius: 6px; padding: 10px 16px;
          text-align: center; margin-bottom: 14px; }
        .company-name { font-size: 14px; font-weight: 900; margin-bottom: 4px; }
        .company-meta { font-size: 10px; color: #c00; margin-bottom: 2px; }
        .company-info { font-size: 10px; color: #444; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #28374A; color: #fff; padding: 5px 7px; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        thead th.r { text-align: right; }
        td { padding: 3px 7px; border-bottom: 1px solid #e5e0d5; font-size: 10px; }
        td.r { text-align: right; font-family: monospace; }
        tr.city-header td { background: #e8e1d4; font-weight: 900; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.4px; padding: 4px 7px; }
        tr.city-total td { background: #d3c7ad; font-size: 10px; font-weight: 900; }
        tr.city-total td.r { text-align: right; font-family: monospace; }
        tr.grand-total td { background: #28374A; color: #FFD200; font-weight: 900;
          font-size: 11px; text-align: right; font-family: monospace; }
        tr.grand-total td:first-child { text-align: left; letter-spacing: 0.5px; }
        tbody tr:not(.city-header):not(.city-total):not(.grand-total):nth-child(even) { background: #f7f5f0; }
        @media print { body { padding: 8mm; } }
      </style></head><body>
      ${content.innerHTML}
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  // Agrupar por cidade
  const grupos = gerado ? Object.entries(
    rows.reduce<Record<string, Row[]>>((acc, r) => {
      const k = r.cidade || '(sem cidade)';
      if (!acc[k]) acc[k] = [];
      acc[k].push(r);
      return acc;
    }, {})
  ) : [];

  const totalGeral = rows.reduce((s, r) => ({
    valor_bruto:   s.valor_bruto   + r.valor_bruto,
    valor_liquido: s.valor_liquido + r.valor_liquido,
  }), { valor_bruto: 0, valor_liquido: 0 });

  const indLabel = industrias.find(i => String(i.for_codigo) === selIndustria)?.for_nomered ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>DATA INICIAL *</label>
          <input type="date" style={inp} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div style={{ minWidth: 140 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>DATA FINAL *</label>
          <input type="date" style={inp} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div style={{ minWidth: 110 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>ESTADO *</label>
          <select style={inp} value={selEstado} onChange={e => setSelEstado(e.target.value)}>
            <option value="">— Selecione —</option>
            {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 200 }}>
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
          disabled={loading || !selEstado}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 20px', borderRadius: 8, border: 'none',
            background: loading || !selEstado ? G.border : G.mustard,
            color: G.text, fontSize: 12, fontWeight: 900,
            cursor: loading || !selEstado ? 'default' : 'pointer', whiteSpace: 'nowrap',
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

      {/* ── Resultado ── */}
      {gerado && (
        <div ref={printRef}>

          {/* Cabeçalho empresa */}
          {empresa && (
            <div style={{
              border: `1px solid ${G.border}`, borderRadius: 10,
              padding: '10px 18px', textAlign: 'center', marginBottom: 14,
            }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: G.text, marginBottom: 4 }}>
                {empresa.emp_nome}
              </div>
              {empresa.emp_cnpj && (
                <div style={{ fontSize: 11, color: '#c00', marginBottom: 2 }}>CNPJ: {empresa.emp_cnpj}</div>
              )}
              {empresa.emp_endereco && (
                <div style={{ fontSize: 11, color: G.textMuted }}>
                  End: {empresa.emp_endereco}{empresa.emp_cidade ? ` — ${empresa.emp_cidade}/${empresa.emp_uf}` : ''}
                </div>
              )}
              {empresa.emp_fones && (
                <div style={{ fontSize: 11, color: G.textMuted }}>Fones: {empresa.emp_fones}</div>
              )}
            </div>
          )}

          {/* Título + industria (se filtrada) */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            {indLabel && (
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                {indLabel}
              </div>
            )}
            <p style={{ fontSize: 11, color: G.textMuted }}>
              {fmtDate(dataInicio)} a {fmtDate(dataFim)} · Estado: {selEstado}
              {!indLabel ? ' · Todas as indústrias' : ''}
            </p>
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>
              Nenhum pedido encontrado.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 82 }}>Data</th>
                  <th style={th}>Pedido</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Indústria</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor Bruto</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor Líquido</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([cidade, linhas]) => {
                  const totCid = linhas.reduce((s, r) => ({
                    valor_bruto:   s.valor_bruto   + r.valor_bruto,
                    valor_liquido: s.valor_liquido + r.valor_liquido,
                  }), { valor_bruto: 0, valor_liquido: 0 });

                  return (
                    <>
                      {/* Header da cidade */}
                      <tr key={`hdr-${cidade}`} style={{ background: G.cardHi }}>
                        <td colSpan={6} style={{
                          ...td, fontWeight: 900, fontSize: 11,
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          color: G.textSec, borderTop: `2px solid ${G.border}`,
                        }}>
                          {cidade}
                        </td>
                      </tr>

                      {/* Linhas */}
                      {linhas.map((r, i) => (
                        <tr key={`${r.ped_pedido}-${i}`} style={{ background: i % 2 === 0 ? G.card : G.cardHi }}>
                          <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtDate(r.ped_data)}</td>
                          <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.textSec }}>{r.ped_pedido}</td>
                          <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cli_nomred}</td>
                          <td style={{ ...td, color: G.textMuted }}>{r.industria_nome}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(r.valor_bruto)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: r.valor_liquido > 0 ? G.success : G.textMuted }}>
                            {fmtBRL(r.valor_liquido)}
                          </td>
                        </tr>
                      ))}

                      {/* Total da cidade */}
                      <tr key={`tot-${cidade}`} style={{ background: `${G.border}60` }}>
                        <td colSpan={4} style={{ ...td, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: G.textMuted }}>
                          Total de {cidade}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: G.text }}>{fmtBRL(totCid.valor_bruto)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: G.text }}>{fmtBRL(totCid.valor_liquido)}</td>
                      </tr>
                    </>
                  );
                })}

                {/* Total geral */}
                <tr style={{ background: G.text }}>
                  <td colSpan={4} style={{ ...td, fontWeight: 900, fontSize: 11, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5, borderTop: `2px solid ${G.textSec}` }}>
                    Total Geral — {selEstado}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    {fmtBRL(totalGeral.valor_bruto)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    {fmtBRL(totalGeral.valor_liquido)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
