import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Printer, Loader2, AlertCircle, X } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface ClienteOpt { cli_codigo: number; cli_nomred: string; cli_nome: string }
interface Industria  { for_codigo: number; for_nomered: string }
interface Row {
  industria_nome:    string;
  industria_codigo:  number;
  ped_data:          string;
  cli_nomred:        string;
  ped_pedido:        string;
  ped_pedcli:        string;
  ped_pedindustria:  string;
  valor_pedido:      number;
  valor_faturado:    number;
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
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

export default function VendasClienteIndustriaReport() {
  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [dataInicio,   setDataInicio]   = useState(firstDay);
  const [dataFim,      setDataFim]      = useState(today);
  const [industrias,   setIndustrias]   = useState<Industria[]>([]);
  const [selIndustria, setSelIndustria] = useState('');

  // cliente search
  const [clienteSearch, setClienteSearch]   = useState('');
  const [clienteOpts,   setClienteOpts]     = useState<ClienteOpt[]>([]);
  const [clienteSel,    setClienteSel]      = useState<ClienteOpt | null>(null);
  const [searchOpen,    setSearchOpen]      = useState(false);
  const [searching,     setSearching]       = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [gerado,  setGerado]  = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/aux/industrias?all=true').then(r => { if (r.data.success) setIndustrias(r.data.data); });
  }, []);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscarClientes = useCallback((term: string) => {
    clearTimeout(debounceRef.current);
    if (term.length < 2) { setClienteOpts([]); setSearchOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/clientes?search=${encodeURIComponent(term)}&limit=20`);
        if (r.data.success) {
          setClienteOpts(r.data.data ?? []);
          setSearchOpen(true);
        }
      } finally { setSearching(false); }
    }, 300);
  }, []);

  const handleClienteInput = (v: string) => {
    setClienteSearch(v);
    setClienteSel(null);
    setGerado(false);
    buscarClientes(v);
  };

  const selectCliente = (c: ClienteOpt) => {
    setClienteSel(c);
    setClienteSearch(c.cli_nomred || c.cli_nome);
    setSearchOpen(false);
    setClienteOpts([]);
  };

  const clearCliente = () => {
    setClienteSel(null);
    setClienteSearch('');
    setClienteOpts([]);
    setGerado(false);
  };

  const visualizar = useCallback(async () => {
    if (!clienteSel) return;
    setLoading(true); setError(null); setGerado(false);
    try {
      const params = new URLSearchParams({ dataInicio, dataFim, cliente: String(clienteSel.cli_codigo) });
      if (selIndustria) params.set('industria', selIndustria);
      const r = await api.get(`/reports/vendas-cliente-industria?${params}`);
      if (r.data.success) { setRows(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação com o servidor.'); }
    finally { setLoading(false); }
  }, [dataInicio, dataFim, clienteSel, selIndustria]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=1100,height=750');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Vendas por Cliente/Indústria</title>
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
        tr.group-header td { background: #e8e1d4; font-weight: 900; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 8px; }
        tr.total-row td { background: #d3c7ad; font-weight: 900; font-size: 10px; text-align: right; }
        tr.total-row td:first-child { text-align: left; }
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

  const totalGeral = rows.reduce((s, r) => ({
    valor_pedido:   s.valor_pedido   + r.valor_pedido,
    valor_faturado: s.valor_faturado + r.valor_faturado,
  }), { valor_pedido: 0, valor_faturado: 0 });

  const indLabel = industrias.find(i => String(i.for_codigo) === selIndustria)?.for_nomered ?? 'Todas as indústrias';

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

        {/* cliente search */}
        <div style={{ minWidth: 260, position: 'relative' }} ref={searchRef}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, display: 'block', marginBottom: 4 }}>
            CLIENTE *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inp, paddingRight: 30 }}
              value={clienteSearch}
              onChange={e => handleClienteInput(e.target.value)}
              placeholder="Buscar por nome..."
              autoComplete="off"
            />
            {searching && (
              <Loader2 size={12} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, animation: 'spin 1s linear infinite' }} />
            )}
            {clienteSel && !searching && (
              <button onClick={clearCliente} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: G.textMuted, padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            )}
          </div>
          {searchOpen && clienteOpts.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: G.card, border: `1px solid ${G.border}`, borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.15)', maxHeight: 200, overflowY: 'auto', marginTop: 2,
            }}>
              {clienteOpts.map(c => (
                <button
                  key={c.cli_codigo}
                  onClick={() => selectCliente(c)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 11px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: G.text, borderBottom: `1px solid ${G.border}40`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontWeight: 700 }}>{c.cli_nomred || c.cli_nome}</span>
                  <span style={{ fontSize: 10, color: G.textMuted, marginLeft: 6 }}>#{c.cli_codigo}</span>
                </button>
              ))}
            </div>
          )}
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
          disabled={loading || !clienteSel}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 20px', borderRadius: 8, border: 'none',
            background: loading || !clienteSel ? G.border : G.mustard,
            color: G.text, fontSize: 12, fontWeight: 900,
            cursor: loading || !clienteSel ? 'default' : 'pointer', whiteSpace: 'nowrap',
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

      {!clienteSel && (
        <div style={{ fontSize: 11, color: G.textMuted, fontStyle: 'italic' }}>
          Digite o nome do cliente no campo acima para buscar.
        </div>
      )}

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
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 900, color: G.text }}>Vendas por Cliente / Indústria</h2>
            <p style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>
              {fmtDate(dataInicio)} a {fmtDate(dataFim)} · {clienteSel?.cli_nomred || clienteSel?.cli_nome} · {indLabel}
            </p>
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>
              Nenhum pedido encontrado no período.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 82 }}>Data</th>
                  <th style={th}>Nº Pedido</th>
                  <th style={th}>Nº Cliente</th>
                  <th style={th}>Nº Indústria</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor Ped.</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor Fat.</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([industria, linhas]) => {
                  const totInd = linhas.reduce((s, r) => ({
                    valor_pedido:   s.valor_pedido   + r.valor_pedido,
                    valor_faturado: s.valor_faturado + r.valor_faturado,
                  }), { valor_pedido: 0, valor_faturado: 0 });

                  return (
                    <>
                      <tr key={`hdr-${industria}`} style={{ background: G.cardHi }}>
                        <td colSpan={6} style={{
                          ...td, fontWeight: 900, fontSize: 11,
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          color: G.textSec, borderTop: `2px solid ${G.border}`,
                        }}>
                          {industria}
                        </td>
                      </tr>

                      {linhas.map((r, i) => (
                        <tr key={`${r.ped_pedido}-${i}`} style={{ background: i % 2 === 0 ? G.card : G.cardHi }}>
                          <td style={{ ...td, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtDate(r.ped_data)}</td>
                          <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.textSec }}>{r.ped_pedido}</td>
                          <td style={{ ...td, fontFamily: 'monospace', color: G.textMuted }}>{r.ped_pedcli || '—'}</td>
                          <td style={{ ...td, fontFamily: 'monospace', color: G.textMuted }}>{r.ped_pedindustria || '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(r.valor_pedido)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: r.valor_faturado > 0 ? G.success : G.textMuted }}>
                            {fmtBRL(r.valor_faturado)}
                          </td>
                        </tr>
                      ))}

                      <tr key={`tot-${industria}`} style={{ background: `${G.border}60` }}>
                        <td colSpan={4} style={{ ...td, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: G.textMuted }}>
                          Total da Indústria
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: G.text }}>{fmtBRL(totInd.valor_pedido)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: G.text }}>{fmtBRL(totInd.valor_faturado)}</td>
                      </tr>
                    </>
                  );
                })}

                <tr style={{ background: G.text }}>
                  <td colSpan={4} style={{ ...td, fontWeight: 900, fontSize: 11, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5, borderTop: `2px solid ${G.textSec}` }}>
                    Total Geral
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    {fmtBRL(totalGeral.valor_pedido)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: G.mustard, borderTop: `2px solid ${G.textSec}` }}>
                    {fmtBRL(totalGeral.valor_faturado)}
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
