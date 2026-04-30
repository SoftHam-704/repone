import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Area   { atu_id: number; atu_descricao: string }
interface Regiao { reg_codigo: number; reg_nome: string }
interface Cliente {
  cli_codigo: number; cli_nomred: string; cli_nome: string;
  cli_cidade: string; cli_uf: string; cli_fone1: string; cli_email: string;
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

export default function ClientesAreaAtuacaoReport() {
  const [areas,      setAreas]      = useState<Area[]>([]);
  const [regioes,    setRegioes]    = useState<Regiao[]>([]);
  const [selArea,    setSelArea]    = useState('all');
  const [selRegiao,  setSelRegiao]  = useState('all');
  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [gerado,     setGerado]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/area-atuacao'),
      api.get('/aux/regioes'),
    ]).then(([a, r]) => {
      if (a.data.success) setAreas(a.data.data);
      if (r.data.success) setRegioes(r.data.data);
    });
  }, []);

  const visualizar = useCallback(async () => {
    setLoading(true); setError(null); setGerado(false);
    const params = new URLSearchParams();
    if (selArea   !== 'all') params.set('area',   selArea);
    if (selRegiao !== 'all') params.set('regiao', selRegiao);
    try {
      const r = await api.get(`/reports/clientes-area-atuacao?${params}`);
      if (r.data.success) { setClientes(r.data.data); setGerado(true); }
      else setError(r.data.message);
    } catch { setError('Falha na comunicação'); }
    finally { setLoading(false); }
  }, [selArea, selRegiao]);

  const areaLabel  = areas.find(a => String(a.atu_id)    === selArea)?.atu_descricao  ?? 'Todas as áreas';
  const regiaoLabel= regioes.find(r => String(r.reg_codigo) === selRegiao)?.reg_nome  ?? 'Todas as regiões';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Parâmetros — igual ao Delphi: Área + Região + Visualizar */}
      <div style={{
        padding: '20px 24px', borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0, maxWidth: 520,
      }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: G.text, display: 'block', marginBottom: 6 }}>
            Área de atuação
          </label>
          <select style={inp} value={selArea} onChange={e => setSelArea(e.target.value)}>
            <option value="all">— Todas —</option>
            {areas.map(a => <option key={a.atu_id} value={a.atu_id}>{a.atu_descricao}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: G.text, display: 'block', marginBottom: 6 }}>
            Região
          </label>
          <select style={inp} value={selRegiao} onChange={e => setSelRegiao(e.target.value)}>
            <option value="all">— Todas —</option>
            {regioes.map(r => <option key={r.reg_codigo} value={r.reg_codigo}>{r.reg_nome}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={visualizar} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 800,
            border: 'none', background: G.mustard, color: G.text, cursor: 'pointer',
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
            Selecione os filtros e clique em Visualizar
          </div>
        )}
        {gerado && (
          <>
            <div style={{ padding: '10px 20px', borderBottom: `2px solid ${G.border}`, background: G.card }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>
                Clientes por Área de Atuação
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Área: <strong style={{ color: G.text }}>{areaLabel}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  Região: <strong style={{ color: G.text }}>{regiaoLabel}</strong>
                </span>
                <span style={{ fontSize: 11, color: G.textMuted }}>
                  <strong style={{ color: G.mustard }}>{clientes.length}</strong> clientes
                </span>
              </div>
            </div>

            {clientes.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum cliente encontrado com os filtros selecionados
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '7%' }} /><col style={{ width: '25%' }} /><col style={{ width: '25%' }} />
                  <col style={{ width: '20%' }} /><col style={{ width: '6%' }} /><col style={{ width: '17%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>Cód.</th>
                    <th style={th}>Nome Fantasia</th>
                    <th style={th}>Razão Social</th>
                    <th style={th}>Cidade</th>
                    <th style={th}>UF</th>
                    <th style={th}>Telefone</th>
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
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: G.textSec }}>{c.cli_fone1 || '—'}</td>
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
