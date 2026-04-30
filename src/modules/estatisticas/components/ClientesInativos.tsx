import { useState, useEffect, useCallback } from 'react';
import { UserX, TrendingDown, DollarSign, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import * as XLSX from 'xlsx';

interface Props { dataInicio: string; dataFim: string; }

interface Industria { codigo: number; nome: string; }
interface Vendedor  { codigo: number; nome: string; }

interface Row {
  codigo: number; cnpj: string; nome: string;
  cidade: string; uf: string;   vendedor: string;
  ultima_compra: string | null; dias_inativo: number | null;
  ticket_medio: number; freq_dias: number;
  total_pedidos: number; receita_potencial: number;
}

interface Kpis {
  totalReceita: number; totalInativos: number;
  ticketMedio: number;  maiorPotencial: number;
}

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

const PERIODOS = [
  { val: '-1', label: 'Todos Ativos' },
  { val: '3',  label: 'Último Trimestre (90d)' },
  { val: '6',  label: 'Último Semestre (180d)' },
  { val: '12', label: 'Último Ano (365d)' },
  { val: '0',  label: 'Nunca Compraram' },
];

const fmt    = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function diasColor(dias: number | null) {
  if (dias === null) return { text: G.textMuted, bg: 'transparent' };
  if (dias <= 30)   return { text: '#16A34A', bg: '#DCFCE7' };
  if (dias <= 60)   return { text: '#1D4ED8', bg: '#DBEAFE' };
  if (dias <= 90)   return { text: '#A16207', bg: '#FEF9C3' };
  return               { text: '#B91C1C', bg: '#FEE2E2' };
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{
      flex: 1, background: G.card, border: `1px solid ${G.border}`,
      borderRadius: 12, padding: '14px 16px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: G.text, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: G.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ClientesInativos(_: Props) {
  const [rows,        setRows]        = useState<Row[]>([]);
  const [kpis,        setKpis]        = useState<Kpis | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [error,       setError]       = useState('');
  const [periodo,     setPeriodo]     = useState('3');
  const [industrias,  setIndustrias]  = useState<Industria[]>([]);
  const [vendedores,  setVendedores]  = useState<Vendedor[]>([]);
  const [forCodigo,   setForCodigo]   = useState('');
  const [venCodigo,   setVenCodigo]   = useState('');

  useEffect(() => {
    api.get('/suppliers?limit=200').then(r => {
      const list = (r.data.data || []).map((s: any) => ({
        codigo: s.for_codigo ?? s.codigo,
        nome:   s.for_nomred ?? s.for_nome ?? s.nome,
      }));
      setIndustrias(list);
    }).catch(() => {});
    api.get('/aux/vendedores').then(r => {
      const list = (r.data.data || []).map((v: any) => ({
        codigo: v.ven_codigo ?? v.value,
        nome:   v.ven_nome   ?? v.label,
      }));
      setVendedores(list);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ periodo });
      if (forCodigo) qs.set('for_codigo', forCodigo);
      if (venCodigo) qs.set('ven_codigo',  venCodigo);
      const r = await api.get(`/estatisticas/clientes-inativos?${qs}`);
      setRows(r.data.data || []);
      setKpis(r.data.kpis || null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [periodo, forCodigo, venCodigo]);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const periodoLabel = PERIODOS.find(p => p.val === periodo)?.label || periodo;
      const fmtNum = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const cols = ['Cód.','Cliente','CNPJ','Cidade','UF','Vendedor','Últ. Compra','Inatividade (d)','Freq. (d)','Ticket Médio','Ped. Perdidos','Receita Pot.'];

      const buildRows = (data: Row[]) => data.map(row => {
        const pedPerdidos = row.freq_dias > 0 && row.dias_inativo
          ? Math.max(0, Math.floor(row.dias_inativo / row.freq_dias)) : 0;
        return [
          row.codigo, row.nome, row.cnpj,
          row.cidade, row.uf, row.vendedor,
          row.ultima_compra ? new Date(row.ultima_compra).toLocaleDateString('pt-BR') : '—',
          row.dias_inativo ?? '—',
          row.freq_dias > 0 ? Math.round(row.freq_dias) : '—',
          row.ticket_medio > 0 ? fmtNum(row.ticket_medio) : '—',
          pedPerdidos > 0 ? pedPerdidos : '—',
          row.receita_potencial > 0 ? fmtNum(row.receita_potencial) : '—',
        ];
      });

      if (forCodigo) {
        // Indústria específica — uma aba
        const ws = XLSX.utils.aoa_to_sheet([cols, ...buildRows(rows)]);
        const indNome = industrias.find(i => String(i.codigo) === forCodigo)?.nome || 'Indústria';
        XLSX.utils.book_append_sheet(wb, ws, indNome.substring(0, 31));
      } else {
        // Todas indústrias — uma aba por indústria
        for (const ind of industrias) {
          const qs = new URLSearchParams({ periodo });
          qs.set('for_codigo', String(ind.codigo));
          if (venCodigo) qs.set('ven_codigo', venCodigo);
          const r = await api.get(`/estatisticas/clientes-inativos?${qs}`);
          const data: Row[] = r.data.data || [];
          if (data.length === 0) continue;
          const ws = XLSX.utils.aoa_to_sheet([cols, ...buildRows(data)]);
          XLSX.utils.book_append_sheet(wb, ws, ind.nome.substring(0, 31));
        }
        // Aba consolidada
        const wsAll = XLSX.utils.aoa_to_sheet([cols, ...buildRows(rows)]);
        XLSX.utils.book_append_sheet(wb, wsAll, 'Consolidado');
      }

      XLSX.writeFile(wb, `clientes-inativos-${periodoLabel.replace(/[^\w]/g,'_')}.xlsx`);
    } catch (e: any) {
      setError('Erro ao gerar Excel: ' + (e.message || ''));
    } finally {
      setExporting(false);
    }
  }, [rows, industrias, periodo, forCodigo, venCodigo]);

  useEffect(() => { load(); }, [load]);

  const periodoLabel = PERIODOS.find(p => p.val === periodo)?.label || '';

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Período de Inatividade</label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${G.border}` }}>
            {PERIODOS.map(p => (
              <button key={p.val} onClick={() => setPeriodo(p.val)} style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                borderRight: `1px solid ${G.border}`,
                background: periodo === p.val ? NAVY : G.cardHi,
                color: periodo === p.val ? G.mustard : G.textMuted,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {industrias.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Indústria</label>
            <select
              value={forCodigo}
              onChange={e => setForCodigo(e.target.value)}
              style={{
                background: G.cardHi, color: G.text, border: `1px solid ${G.border}`,
                borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', minWidth: 200,
              }}
            >
              <option value="">Todas as Indústrias</option>
              {industrias.map(i => (
                <option key={i.codigo} value={String(i.codigo)}>{i.nome}</option>
              ))}
            </select>
          </div>
        )}

        {vendedores.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Vendedor</label>
            <select
              value={venCodigo}
              onChange={e => setVenCodigo(e.target.value)}
              style={{
                background: G.cardHi, color: G.text, border: `1px solid ${G.border}`,
                borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', minWidth: 180,
              }}
            >
              <option value="">Todos os Vendedores</option>
              {vendedores.map(v => (
                <option key={v.codigo} value={String(v.codigo)}>{v.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button onClick={load} disabled={loading} style={{
            padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: G.mustard, color: G.text, border: 'none', cursor: 'pointer',
          }}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          {rows.length > 0 && (
            <button onClick={exportExcel} disabled={exporting} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              <FileSpreadsheet size={14} />
              {exporting ? 'Gerando...' : 'Excel'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ── KPIs ── */}
      {kpis && !loading && (
        <div style={{ display: 'flex', gap: 12 }}>
          <KpiCard icon={DollarSign}    label="Receita a Recuperar"  value={fmt(kpis.totalReceita)}    color="#DC2626"   sub="soma do potencial estimado" />
          <KpiCard icon={UserX}         label="Clientes no Limbo"    value={String(kpis.totalInativos)} color="#7C3AED"   sub={periodoLabel} />
          <KpiCard icon={TrendingDown}  label="Ticket Médio Recup."  value={fmt(kpis.ticketMedio)}     color="#D97706"   sub="média por cliente" />
          <KpiCard icon={AlertTriangle} label="Maior Potencial"      value={fmt(kpis.maiorPotencial)}  color="#0891B2"   sub="cliente com maior perda" />
        </div>
      )}

      {/* ── Tabela ── */}
      {!loading && rows.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                {[
                  { label: 'Cód.',         w: 60,  right: false },
                  { label: 'Cliente',      w: 220, right: false },
                  { label: 'Cidade/UF',    w: 140, right: false },
                  { label: 'Vendedor',     w: 140, right: false },
                  { label: 'Ú. Compra',    w: 100, right: true  },
                  { label: 'Inatividade',  w: 90,  right: true  },
                  { label: 'Freq. (dias)', w: 90,  right: true  },
                  { label: 'Ticket Médio', w: 120, right: true  },
                  { label: 'Ped. Perdidos',w: 90,  right: true  },
                  { label: 'Receita Pot.', w: 130, right: true  },
                ].map(h => (
                  <th key={h.label} style={{
                    position: 'sticky', top: 0, zIndex: 2,
                    background: NAVY_DARK, color: G.mustard,
                    padding: '10px 12px', textAlign: h.right ? 'right' : 'left',
                    fontWeight: 700, borderRight: `1px solid ${NAVY}`,
                    borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap', minWidth: h.w,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const dc = diasColor(row.dias_inativo);
                const pedPerdidos = row.freq_dias > 0 && row.dias_inativo
                  ? Math.max(0, Math.floor(row.dias_inativo / row.freq_dias))
                  : 0;
                return (
                  <tr key={row.codigo} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ padding: '7px 12px', color: G.textMuted, fontFamily: 'monospace', fontSize: 11, borderRight: `1px solid ${G.border}` }}>
                      {row.codigo}
                    </td>
                    <td style={{ padding: '7px 12px', borderRight: `1px solid ${G.border}` }}>
                      <div style={{ fontWeight: 700, color: G.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>{row.nome}</div>
                    </td>
                    <td style={{ padding: '7px 12px', color: G.textMuted, borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>
                      {row.cidade}{row.uf ? ` — ${row.uf}` : ''}
                    </td>
                    <td style={{ padding: '7px 12px', color: G.textMuted, borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                      {row.vendedor}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.textMuted, borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>
                      {fmtDate(row.ultima_compra)}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', borderRight: `1px solid ${G.border}` }}>
                      {row.dias_inativo !== null ? (
                        <span style={{ background: dc.bg, color: dc.text, padding: '2px 8px', borderRadius: 20, fontWeight: 700, fontSize: 10 }}>
                          {row.dias_inativo}d
                        </span>
                      ) : <span style={{ color: G.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.textMuted, borderRight: `1px solid ${G.border}` }}>
                      {row.freq_dias > 0 ? `${Math.round(row.freq_dias)}d` : '—'}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.text, fontWeight: 600, borderRight: `1px solid ${G.border}` }}>
                      {row.ticket_medio > 0 ? fmt(row.ticket_medio) : '—'}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', borderRight: `1px solid ${G.border}` }}>
                      {pedPerdidos > 0 ? (
                        <span style={{ color: '#DC2626', fontWeight: 700 }}>{pedPerdidos}</span>
                      ) : <span style={{ color: G.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', background: row.receita_potencial > 0 ? '#FEF2F2' : 'transparent' }}>
                      {row.receita_potencial > 0 ? (
                        <span style={{ color: '#DC2626', fontWeight: 800 }}>{fmt(row.receita_potencial)}</span>
                      ) : <span style={{ color: G.textMuted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9} style={{
                  background: NAVY_DARK, color: G.mustard,
                  padding: '9px 14px', fontWeight: 800, fontSize: 11,
                  borderTop: `2px solid ${NAVY}`, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  TOTAL — {rows.length} cliente{rows.length !== 1 ? 's' : ''}
                </td>
                <td style={{
                  background: '#DC2626', color: '#fff',
                  padding: '9px 14px', textAlign: 'right', fontWeight: 800,
                  borderTop: `2px solid ${NAVY}`, whiteSpace: 'nowrap',
                }}>
                  {fmt(rows.reduce((s, r) => s + r.receita_potencial, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <UserX size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nenhum cliente encontrado para o período selecionado</span>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Analisando clientes inativos...
        </div>
      )}
    </div>
  );
}
