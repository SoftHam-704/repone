import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Grupo { value: number; label: string }
interface Row {
  cli_codigo: number;
  cli_nomred: string;
  cli_fone1: string;
  ultima_compra: string;
  dias_sem_compra: number;
}

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

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export default function VendasFamiliaReport() {
  const [grupos,    setGrupos]   = useState<Grupo[]>([]);
  const [selGrupo,  setSelGrupo] = useState('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setMonth(0, 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows,     setRows]    = useState<Row[]>([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState<string | null>(null);
  const [gerado,   setGerado]  = useState(false);

  useEffect(() => {
    api.get('/aux/grupos/0').then(r => {
      if (r.data.success) setGrupos(r.data.data);
    });
  }, []);

  const visualizar = useCallback(async () => {
    if (!selGrupo) return;
    setLoading(true); setError(null); setGerado(false);
    try {
      const r = await api.get(`/reports/vendas-familia?grupoId=${selGrupo}&dataInicio=${dataInicio}&dataFim=${dataFim}`);
      if (r.data.success) { setRows(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selGrupo, dataInicio, dataFim]);

  const grupoLabel = grupos.find(g => String(g.value) === selGrupo)?.label ?? '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Parâmetros */}
      <div style={{
        padding: '16px 20px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        <div style={{ flex: '1 1 260px', minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            FAMÍLIA / GRUPO
          </label>
          <select style={inp} value={selGrupo} onChange={e => setSelGrupo(e.target.value)}>
            <option value="">Selecione o grupo...</option>
            {grupos.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>

        <div style={{ flex: '0 1 150px' }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            DATA INÍCIO
          </label>
          <input type="date" style={inp} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>

        <div style={{ flex: '0 1 150px' }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, display: 'block', marginBottom: 4 }}>
            DATA FIM
          </label>
          <input type="date" style={inp} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={visualizar} disabled={loading || !selGrupo} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 800,
            border: 'none', background: G.mustard, color: G.text,
            cursor: !selGrupo ? 'not-allowed' : 'pointer', opacity: !selGrupo ? 0.5 : 1,
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
            Selecione o grupo e o período, depois clique em Visualizar
          </div>
        )}
        {gerado && (
          <>
            <div style={{ padding: '10px 20px', borderBottom: `2px solid ${G.border}`, background: G.card }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>
                Venda por Família de Produto
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Grupo: <strong style={{ color: G.text }}>{grupoLabel}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Período: <strong style={{ color: G.text }}>{fmtDate(dataInicio)} — {fmtDate(dataFim)}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  <strong style={{ color: G.mustard }}>{rows.length}</strong> clientes
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum cliente com compras neste grupo no período
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>Cód.</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Telefone</th>
                    <th style={th}>Última Compra</th>
                    <th style={th}>Dias Sem Compra</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const diasAlerta = row.dias_sem_compra > 90;
                    return (
                      <tr key={row.cli_codigo} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.mustard }}>{row.cli_codigo}</td>
                        <td style={{ ...td, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.cli_nomred || '—'}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: G.textSec }}>{row.cli_fone1 || '—'}</td>
                        <td style={td}>{fmtDate(row.ultima_compra)}</td>
                        <td style={td}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 800,
                            background: diasAlerta ? '#FEE2E2' : `${G.border}50`,
                            color: diasAlerta ? '#DC2626' : G.textSec,
                          }}>
                            {row.dias_sem_compra} dias
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
