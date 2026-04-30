import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string }
interface Cliente {
  cli_codigo: number; cli_nomred: string; cli_nome: string;
  cli_cidade: string; cli_uf: string; cli_fone1: string; cli_email: string;
  ultima_compra: string; total_pedidos: number; total_valor: number;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const inp: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none', width: '100%',
};
const th: React.CSSProperties = {
  padding: '9px 12px', fontSize: 10, fontWeight: 800, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: 0.7,
  borderBottom: `2px solid ${G.border}`, background: G.cardHi, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '7px 12px', fontSize: 11, borderBottom: `1px solid ${G.border}`, color: G.text,
};

export default function ClientesIndustriaReport() {
  const [industrias,  setIndustrias]  = useState<Industria[]>([]);
  const [selInd,      setSelInd]      = useState('');
  const [clientes,    setClientes]    = useState<Cliente[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingInd,  setLoadingInd]  = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [gerado,      setGerado]      = useState(false);

  useEffect(() => {
    api.get('/aux/industrias')
      .then(r => r.data.success && setIndustrias(r.data.data))
      .finally(() => setLoadingInd(false));
  }, []);

  const visualizar = useCallback(async () => {
    if (!selInd) return;
    setLoading(true); setError(null); setGerado(false);
    try {
      const r = await api.get(`/reports/clientes-por-industria?industria=${selInd}`);
      if (r.data.success) { setClientes(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selInd]);

  const indObj = industrias.find(i => String(i.for_codigo) === selInd);
  const totalValor = clientes.reduce((s, c) => s + Number(c.total_valor), 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Parâmetros */}
      <div style={{
        padding: '16px 20px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
      }}>
        <div style={{ flex: '1 1 300px', minWidth: 220 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            INDÚSTRIA
          </label>
          <select style={inp} value={selInd} onChange={e => setSelInd(e.target.value)} disabled={loadingInd}>
            <option value="">Selecione a indústria...</option>
            {industrias.map(i => (
              <option key={i.for_codigo} value={i.for_codigo}>
                {String(i.for_codigo).padStart(4, '0')} — {i.for_nomered}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={visualizar} disabled={loading || !selInd} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 800,
            border: 'none', background: G.mustard, color: G.text,
            cursor: !selInd ? 'not-allowed' : 'pointer', opacity: !selInd ? 0.5 : 1,
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Buscando...</>
              : <><Search size={14} />Visualizar</>}
          </button>
          {gerado && (
            <button onClick={() => window.print()} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
              border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer',
            }}>
              <Printer size={13} />Imprimir
            </button>
          )}
        </div>
      </div>

      {/* Resultado */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {error && (
          <div style={{ padding: 20, display: 'flex', gap: 8 }}>
            <AlertCircle size={16} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</span>
          </div>
        )}
        {!gerado && !error && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Selecione a indústria e clique em Visualizar
          </div>
        )}
        {gerado && (
          <>
            {/* Cabeçalho */}
            <div style={{ padding: '10px 20px', borderBottom: `2px solid ${G.border}`, background: G.card }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>{indObj?.for_nomered}</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  <strong style={{ color: G.text }}>{clientes.length}</strong> clientes atendidos
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Total faturado: <strong style={{ color: G.mustard }}>R$ {fmtBRL(totalValor)}</strong>
                </span>
              </div>
            </div>

            {clientes.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum cliente com pedidos para esta indústria
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '7%' }} /><col style={{ width: '22%' }} /><col style={{ width: '20%' }} />
                  <col style={{ width: '16%' }} /><col style={{ width: '5%' }} /><col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} /><col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>Cód.</th>
                    <th style={th}>Nome Fantasia</th>
                    <th style={th}>Razão Social</th>
                    <th style={th}>Cidade</th>
                    <th style={th}>UF</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ped.</th>
                    <th style={{ ...th, textAlign: 'right' }}>Últ. Compra</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={c.cli_codigo} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.mustard }}>{c.cli_codigo}</td>
                      <td style={{ ...td, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cli_nomred || '—'}</td>
                      <td style={{ ...td, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cli_nome}</td>
                      <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cli_cidade || '—'}</td>
                      <td style={td}>
                        <span style={{ padding: '1px 5px', borderRadius: 4, background: `${G.border}60`, fontSize: 10, fontWeight: 800 }}>{c.cli_uf || '—'}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{c.total_pedidos}</td>
                      <td style={{ ...td, textAlign: 'right', fontSize: 10 }}>{fmtDate(c.ultima_compra)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(Number(c.total_valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
