import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, CheckCircle2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row { codigo: string; descricao: string; aplicacao: string; }
interface IndOpt { id: number; nome: string; }
interface CliOpt { id: number; nome: string; }

export default function ItensNuncaComprados(_: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [error,      setError]      = useState('');

  const [industria,  setIndustria]  = useState('');
  const [cliente,    setCliente]    = useState('');

  useEffect(() => {
    api.get('/aux/industrias').then(r =>
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))
    ).catch(() => {});
    api.get('/clients?limit=2000').then(r =>
      setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })))
    ).catch(() => {});
  }, []);

  const canLoad = !!(industria && cliente);

  const load = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true); setError(''); setLoaded(false);
    try {
      const params = new URLSearchParams({ industria, cliente });
      const r = await api.get(`/estatisticas/itens-nunca-comprados?${params}`);
      setRows(r.data.data || []);
      setLoaded(true);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [industria, cliente, canLoad]);

  useEffect(() => { if (canLoad) load(); }, [load]);

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
    outline: 'none', cursor: 'pointer',
  } as React.CSSProperties;

  const clienteNome = clientes.find(c => String(c.id) === cliente)?.nome || '';
  const indNome     = industrias.find(i => String(i.id) === industria)?.nome || '';

  const exportExcel = () => {
    const slug = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').trim();
    const data = rows.map(r => ({ 'Código': r.codigo, 'Descrição': r.descricao, 'Aplicação': r.aplicacao || '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 16 }, { wch: 55 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nunca Comprados');
    XLSX.writeFile(wb, `nunca-comprados-${slug(clienteNome)}-${slug(indNome)}.xlsx`);
  };

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtros */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={industria} onChange={e => setIndustria(e.target.value)}
            style={{ ...selectStyle, borderColor: !industria ? '#EF4444' : G.border }}>
            <option value="">Selecione...</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Cliente <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={cliente} onChange={e => setCliente(e.target.value)}
            style={{ ...selectStyle, borderColor: !cliente ? '#EF4444' : G.border }}>
            <option value="">Selecione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <button onClick={load} disabled={!canLoad || loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: canLoad ? G.mustard : G.border,
          color: canLoad ? G.text : G.textMuted,
          border: 'none', cursor: canLoad ? 'pointer' : 'not-allowed',
        }}>
          {loading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {/* Empty state inicial */}
      {!canLoad && !loaded && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <ShoppingCart size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione indústria e cliente para ver os produtos nunca comprados</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Sucesso sem resultados */}
      {!loading && loaded && rows.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <CheckCircle2 size={40} style={{ color: '#16A34A' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: G.text, marginBottom: 4 }}>
              Catálogo 100% comprado!
            </div>
            <div style={{ fontSize: 12, color: G.textMuted }}>
              <strong>{clienteNome}</strong> já comprou todos os produtos ativos de <strong>{indNome}</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Counter + Export */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <ShoppingCart size={14} style={{ color: '#DC2626' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
              {rows.length} produto{rows.length !== 1 ? 's' : ''} nunca comprado{rows.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span style={{ fontSize: 11, color: G.textMuted }}>
            por <strong style={{ color: G.text }}>{clienteNome}</strong> na indústria <strong style={{ color: G.text }}>{indNome}</strong>
          </span>
          <button onClick={exportExcel} style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 8, border: `1px solid ${G.border}`,
            background: G.card, color: G.text, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      )}

      {/* Tabela */}
      {!loading && rows.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: '#1E2D3D', color: '#FFD200',
                  padding: '10px 12px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid #162436`, whiteSpace: 'nowrap', minWidth: 110,
                }}>Código</th>
                <th style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: '#1E2D3D', color: '#FFD200',
                  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid #162436`, minWidth: 260,
                }}>Descrição</th>
                <th style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: '#1E2D3D', color: '#FFD200',
                  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                  minWidth: 200,
                }}>Aplicação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.codigo} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                  <td style={{
                    padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700,
                    fontSize: 12, color: G.text, letterSpacing: 0.3,
                    borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                  }}>{row.codigo}</td>
                  <td style={{
                    padding: '7px 14px', color: G.text, fontWeight: 500,
                    borderRight: `1px solid ${G.border}`,
                  }}>{row.descricao}</td>
                  <td style={{
                    padding: '7px 14px', color: G.textMuted, fontStyle: row.aplicacao ? 'normal' : 'italic',
                  }}>{row.aplicacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Consultando catálogo...
        </div>
      )}
    </div>
  );
}
