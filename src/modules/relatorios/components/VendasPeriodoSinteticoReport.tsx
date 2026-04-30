import { useState, useCallback, useRef } from 'react';
import { Search, Printer, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Row {
  industria_nome: string;
  valor_bruto:    number;
  valor_liquido:  number;
}
interface Empresa {
  emp_nome:      string;
  emp_cnpj:      string;
  emp_endereco:  string;
  emp_cidade:    string;
  emp_uf:        string;
  emp_fones:     string;
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
  padding: '7px 10px', fontSize: 12, borderBottom: `1px solid ${G.border}40`, color: G.text,
};
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function VendasPeriodoSinteticoReport() {
  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim,    setDataFim]    = useState(today);
  const [rows,       setRows]       = useState<Row[]>([]);
  const [empresa,    setEmpresa]    = useState<Empresa | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [gerado,     setGerado]     = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const visualizar = useCallback(async () => {
    setLoading(true); setError(null); setGerado(false);
    try {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const r = await api.get(`/reports/vendas-periodo-sintetico?${params}`);
      if (r.data.success) {
        setRows(r.data.data);
        setEmpresa(r.data.empresa ?? null);
        setGerado(true);
      } else { setError(r.data.message); }
    } catch { setError('Falha na comunicação com o servidor.'); }
    finally { setLoading(false); }
  }, [dataInicio, dataFim]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Vendas no Período (Sintético)</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 16px; }
        .company-box { border: 1px solid #ccc; border-radius: 6px; padding: 12px 16px;
          text-align: center; margin-bottom: 18px; }
        .company-name { font-size: 15px; font-weight: 900; margin-bottom: 4px; }
        .company-meta { font-size: 10px; color: #c00; margin-bottom: 2px; }
        .company-info { font-size: 10px; color: #444; }
        h2 { font-size: 13px; font-weight: 900; text-align: center; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #28374A; color: #fff; padding: 6px 8px; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        thead th.r { text-align: right; }
        tbody tr:nth-child(even) { background: #f7f5f0; }
        td { padding: 5px 8px; border-bottom: 1px solid #e5e0d5; font-size: 11px; }
        td.r { text-align: right; font-family: monospace; }
        tr.total-row td { background: #28374A; color: #FFD200; font-weight: 900;
          font-size: 12px; text-align: right; font-family: monospace; }
        tr.total-row td:first-child { text-align: left; letter-spacing: 0.5px; }
        @media print { body { padding: 8mm; } }
      </style></head><body>
      ${content.innerHTML}
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  const totalBruto   = rows.reduce((s, r) => s + r.valor_bruto, 0);
  const totalLiquido = rows.reduce((s, r) => s + r.valor_liquido, 0);

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

      {/* ── Resultado ── */}
      {gerado && (
        <div ref={printRef}>

          {/* Cabeçalho empresa */}
          {empresa && (
            <div style={{
              border: `1px solid ${G.border}`, borderRadius: 10,
              padding: '12px 18px', textAlign: 'center', marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: G.text, marginBottom: 4 }}>
                {empresa.emp_nome}
              </div>
              {empresa.emp_cnpj && (
                <div style={{ fontSize: 11, color: '#c00', marginBottom: 2 }}>
                  CNPJ: {empresa.emp_cnpj}
                </div>
              )}
              {empresa.emp_endereco && (
                <div style={{ fontSize: 11, color: G.textMuted }}>
                  End: {empresa.emp_endereco}{empresa.emp_cidade ? ` — ${empresa.emp_cidade}/${empresa.emp_uf}` : ''}
                </div>
              )}
              {empresa.emp_fones && (
                <div style={{ fontSize: 11, color: G.textMuted }}>
                  Fones: {empresa.emp_fones}
                </div>
              )}
            </div>
          )}

          {/* Título */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 900, color: G.text }}>
              Vendas no Período (Sintético)
            </h2>
            <p style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>
              {fmtDate(dataInicio)} a {fmtDate(dataFim)}
            </p>
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>
              Nenhum pedido encontrado no período.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Indústria</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor Bruto</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor Líquido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? G.card : G.cardHi }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.industria_nome}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {fmtBRL(r.valor_bruto)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: r.valor_liquido > 0 ? G.success : G.textMuted }}>
                      {fmtBRL(r.valor_liquido)}
                    </td>
                  </tr>
                ))}

                {/* Total geral */}
                <tr style={{ background: G.text }}>
                  <td style={{ ...td, fontWeight: 900, fontSize: 11, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5, borderTop: `2px solid ${G.textSec}` }}>
                    Total Geral
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    {fmtBRL(totalBruto)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    {fmtBRL(totalLiquido)}
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
