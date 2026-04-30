import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Target, Download, AlertTriangle, CheckCircle2, TrendingUp, Percent } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import SearchCombobox from '@/shared/components/ui/SearchCombobox';

interface Props { dataInicio: string; dataFim: string; }

interface Row {
  codigo:       string;
  descricao:    string;
  familia:      string;
  aplicacao:    string;
  freq_mercado: number;
  freq_cliente: number;
  gap_freq:     number;
  qtd_mercado:   number;
  qtd_cliente:   number;
  pontos_venda:  number;
  valor_cliente: number | null;
  pct_captacao:  number;
}

interface Kpis {
  total:        number;
  criticos:     number;
  taxaCaptacao: number;
  qtdGapTotal:  number;
}

interface IndOpt { id: number; nome: string; }
interface CliOpt { id: number; nome: string; }

// Threshold dinâmico baseado no número de meses do período
function calcPeriodoMeses(dataInicio: string, dataFim: string): number {
  const ini = new Date(dataInicio);
  const fim = new Date(dataFim);
  return Math.max(1, Math.round((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24 * 30)));
}

function nivelOportunidade(freq_m: number, freq_c: number, periodoMeses: number): 'critico' | 'atencao' | 'bom' | 'baixo' {
  if (freq_m === 0) return 'baixo';
  const threshold = Math.max(1, Math.ceil(periodoMeses * 0.5));
  if (freq_m >= threshold && freq_c === 0) return 'critico';
  if (freq_m >= Math.max(1, Math.ceil(periodoMeses * 0.3)) && freq_c < freq_m / 2) return 'atencao';
  if (freq_c >= freq_m * 0.7) return 'bom';
  return 'atencao';
}

const NIVEL_COLORS = {
  critico: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', label: 'Crítico' },
  atencao: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', label: 'Atenção' },
  bom:     { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', label: 'Bom' },
  baixo:   { bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280', label: 'Baixo' },
};

function FreqBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 64, height: 6, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 14 }}>{value}</span>
    </div>
  );
}



export default function MapaOportunidades({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [kpis,       setKpis]       = useState<Kpis | null>(null);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [error,      setError]      = useState('');
  const [industria,  setIndustria]  = useState('');
  const [cliente,    setCliente]    = useState('');
  const [somenteGap, setSomenteGap] = useState(true);
  // Default: todas as famílias colapsadas
  const [collapsed,  setCollapsed]  = useState<Set<string>>(new Set());

  const periodoMeses = calcPeriodoMeses(dataInicio, dataFim);

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
      const params = new URLSearchParams({
        industria, cliente,
        dataInicial: dataInicio, dataFinal: dataFim,
        somenteGap: String(somenteGap),
      });
      const r = await api.get(`/estatisticas/mapa-oportunidades?${params}`);
      const data: Row[] = r.data.data || [];
      setRows(data);
      setKpis(r.data.kpis || null);
      setLoaded(true);
      // Iniciar todas as famílias colapsadas
      const fams = [...new Set(data.map(row => row.familia))];
      setCollapsed(new Set(fams));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [industria, cliente, dataInicio, dataFim, somenteGap, canLoad]);

  // Agrupar por família, ordenar linhas por qtd_mercado DESC
  const porFamilia = rows.reduce<Record<string, Row[]>>((acc, r) => {
    if (!acc[r.familia]) acc[r.familia] = [];
    acc[r.familia].push(r);
    return acc;
  }, {});

  Object.values(porFamilia).forEach(famRows =>
    famRows.sort((a, b) => b.qtd_mercado - a.qtd_mercado)
  );

  // Ordenar famílias por qtd_mercado total DESC
  const familias = Object.keys(porFamilia).sort((a, b) => {
    const totalA = porFamilia[a].reduce((s, r) => s + r.qtd_mercado, 0);
    const totalB = porFamilia[b].reduce((s, r) => s + r.qtd_mercado, 0);
    return totalB - totalA;
  });

  const toggleFamilia = (fam: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(fam)) next.delete(fam); else next.add(fam);
      return next;
    });
  };

  const expandAll  = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(familias));

  const exportXlsx = () => {
    const clienteNome = clientes.find(c => String(c.id) === cliente)?.nome || '';
    const indNome     = industrias.find(i => String(i.id) === industria)?.nome || '';
    const sheet_data  = [...rows].sort((a, b) => b.qtd_mercado - a.qtd_mercado).map(r => ({
      'Família':         r.familia,
      'Código':          r.codigo,
      'Aplicação':       r.aplicacao,
      'Freq. Mercado':   r.freq_mercado,
      'Freq. Cliente':   r.freq_cliente,
      'Gap Frequência':  r.gap_freq,
      'Qtd Mercado':     r.qtd_mercado,
      'PDVs':            r.pontos_venda,
      'Preço':           r.valor_cliente !== null ? r.valor_cliente : '',
      'Qtd Cliente':     r.qtd_cliente,
      '% Captação':      r.pct_captacao,
      'Nível':           NIVEL_COLORS[nivelOportunidade(r.freq_mercado, r.freq_cliente, periodoMeses)].label,
    }));
    const ws = XLSX.utils.json_to_sheet(sheet_data);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 60 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa Oportunidades');
    XLSX.writeFile(wb, `mapa-oportunidades-${clienteNome}-${indNome}-${dataInicio}-${dataFim}.xlsx`);
  };

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
    outline: 'none', cursor: 'pointer',
  };

  const thStyle: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    background: '#1E2D3D', color: '#FFD200',
    padding: '9px 12px', textAlign: 'left', fontWeight: 700,
    borderRight: '1px solid #162436', whiteSpace: 'nowrap', fontSize: 11,
  };

  // KPIs recalculados com threshold dinâmico
  const criticosDinamicos = rows.filter(r =>
    nivelOportunidade(r.freq_mercado, r.freq_cliente, periodoMeses) === 'critico'
  ).length;

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtros */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={industria} onChange={e => setIndustria(e.target.value)}
            style={{ ...selectStyle, borderColor: !industria ? '#EF4444' : G.border }}>
            <option value="">Selecione...</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Cliente <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <SearchCombobox
            options={clientes}
            value={cliente}
            onChange={setCliente}
            placeholder="Buscar cliente..."
            required
          />
        </div>

        {/* Toggle somente gap */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={() => setSomenteGap(v => !v)} style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
            background: somenteGap ? G.mustard : G.border,
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', background: '#FFF',
              position: 'absolute', top: 3, left: somenteGap ? 19 : 3,
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: G.text }}>Somente com gap</span>
        </label>

        <button onClick={load} disabled={!canLoad || loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: canLoad ? G.mustard : G.border,
          color: canLoad ? G.text : G.textMuted,
          border: 'none', cursor: canLoad && !loading ? 'pointer' : 'not-allowed',
        }}>
          {loading ? 'Carregando...' : 'Buscar'}
        </button>

        {loaded && rows.length > 0 && (
          <button onClick={exportXlsx} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: '#16A34A', color: '#FFF', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {/* KPIs */}
      {kpis && loaded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {([
            { icon: Target,        label: 'Produtos no Portfólio',    value: kpis.total.toLocaleString('pt-BR'),                   color: '#3B82F6' },
            { icon: AlertTriangle, label: `Críticos (≥${Math.ceil(periodoMeses*0.5)}m, zero)`, value: criticosDinamicos.toLocaleString('pt-BR'), color: '#DC2626' },
            { icon: Percent,       label: 'Taxa de Captação',          value: `${kpis.taxaCaptacao}%`,                              color: '#16A34A' },
            { icon: TrendingUp,    label: 'Gap Total (unidades)',      value: Math.round(kpis.qtdGapTotal).toLocaleString('pt-BR'), color: '#D97706' },
          ] as const).map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{
              background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${color}15`, border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: G.text, letterSpacing: -0.5 }}>{value}</div>
                <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginTop: 1 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controles expandir/colapsar */}
      {loaded && rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: G.text, fontWeight: 600 }}>
              {familias.length} famílias · {rows.length} produtos · clique no cabeçalho para expandir
            </span>
            <span style={{ fontSize: 10, color: G.textMuted, lineHeight: 1.5 }}>
              <strong style={{ color: G.text }}>Gap</strong>{' '}= meses em que o mercado comprou e o cliente não comprou{' · '}
              <strong style={{ color: G.text }}>Captação</strong>{' '}= % do volume de mercado que o cliente já adquiriu{' · '}
              <strong style={{ color: G.text }}>PDVs</strong>{' '}= nº de outros clientes que compram o produto
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
            <button onClick={expandAll} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1px solid ${G.border}`, background: 'transparent', color: G.textMuted, cursor: 'pointer',
            }}>Expandir tudo</button>
            <button onClick={collapseAll} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1px solid ${G.border}`, background: 'transparent', color: G.textMuted, cursor: 'pointer',
            }}>Colapsar tudo</button>
          </div>
        </div>
      )}

      {/* Empty / error states */}
      {!canLoad && !loaded && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <Target size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione indústria, cliente e período para ver as oportunidades</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {!loading && loaded && rows.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <CheckCircle2 size={40} style={{ color: '#16A34A' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: G.text, marginBottom: 4 }}>Nenhum gap encontrado!</div>
            <div style={{ fontSize: 12, color: G.textMuted }}>O cliente está comprando todos os produtos ativos desta indústria no período.</div>
          </div>
        </div>
      )}

      {/* Tabela agrupada por família */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {familias.map(fam => {
            const famRows     = porFamilia[fam];
            const isCollapsed = collapsed.has(fam);
            const criticos    = famRows.filter(r => nivelOportunidade(r.freq_mercado, r.freq_cliente, periodoMeses) === 'critico').length;
            const totalMG     = famRows.reduce((s, r) => s + r.qtd_mercado, 0);
            const totalCli    = famRows.reduce((s, r) => s + r.qtd_cliente, 0);
            const captFam     = totalMG > 0 ? Math.round((totalCli / totalMG) * 100) : 0;
            const maxFreqFam  = Math.max(...famRows.map(r => r.freq_mercado), 1);

            return (
              <div key={fam} style={{ border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>

                {/* Header família */}
                <div
                  onClick={() => toggleFamilia(fam)}
                  style={{
                    background: G.card, padding: '10px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: isCollapsed ? 'none' : `1px solid ${G.border}`,
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: G.text }}>{fam}</span>
                    <span style={{ fontSize: 10, color: G.textMuted }}>{famRows.length} produto{famRows.length !== 1 ? 's' : ''}</span>
                    {criticos > 0 && (
                      <span style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                        {criticos} crítico{criticos !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 10, color: G.textMuted }}>
                      Mercado: <strong style={{ color: G.text }}>{Math.round(totalMG).toLocaleString('pt-BR')}</strong>
                    </span>
                    <span style={{ fontSize: 10, color: G.textMuted }}>
                      Captação: <strong style={{ color: captFam < 20 ? '#DC2626' : captFam < 50 ? '#D97706' : '#16A34A' }}>{captFam}%</strong>
                    </span>
                    <span style={{ fontSize: 12, color: G.textMuted, fontWeight: 700 }}>{isCollapsed ? '▸' : '▾'}</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, minWidth: 100 }}>Código</th>
                          <th style={{ ...thStyle, minWidth: 300 }}>Aplicação</th>
                          <th style={{ ...thStyle, minWidth: 130, textAlign: 'center' }}>Freq. Mercado</th>
                          <th style={{ ...thStyle, minWidth: 130, textAlign: 'center' }}>Freq. Cliente</th>
                          <th style={{ ...thStyle, minWidth: 90, textAlign: 'center' }}>Gap</th>
                          <th style={{ ...thStyle, minWidth: 110, textAlign: 'right' }}>Qtd Mercado ↓</th>
                          <th style={{ ...thStyle, minWidth: 70, textAlign: 'right' }} title="Clientes que compram este produto (exceto o cliente em análise)">PDVs</th>
                          <th style={{ ...thStyle, minWidth: 100, textAlign: 'right' }} title="Preço líquido do cliente conforme tabela e descontos cadastrados">Preço</th>
                          <th style={{ ...thStyle, minWidth: 100, textAlign: 'right' }}>Qtd Cliente</th>
                          <th style={{ ...thStyle, minWidth: 80, textAlign: 'right', borderRight: 'none' }}>Captação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {famRows.map((row, idx) => {
                          const nivel = nivelOportunidade(row.freq_mercado, row.freq_cliente, periodoMeses);
                          const nc = NIVEL_COLORS[nivel];
                          return (
                            <tr key={row.codigo} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                              <td style={{
                                padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700,
                                fontSize: 12, color: G.text, letterSpacing: 0.3,
                                borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                              }}>{row.codigo}</td>
                              <td style={{
                                padding: '7px 12px', color: row.aplicacao ? G.text : G.textMuted,
                                fontStyle: row.aplicacao ? 'normal' : 'italic',
                                borderRight: `1px solid ${G.border}`, fontSize: 11,
                                maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }} title={row.aplicacao || '—'}>
                                {row.aplicacao || '—'}
                              </td>
                              <td style={{ padding: '7px 12px', borderRight: `1px solid ${G.border}`, textAlign: 'center' }}>
                                <FreqBar value={row.freq_mercado} max={maxFreqFam} color="#28374A" />
                              </td>
                              <td style={{ padding: '7px 12px', borderRight: `1px solid ${G.border}`, textAlign: 'center' }}>
                                <FreqBar value={row.freq_cliente} max={maxFreqFam} color={row.freq_cliente === 0 ? '#8A9480' : '#8B6914'} />
                              </td>
                              <td style={{ padding: '7px 12px', borderRight: `1px solid ${G.border}`, textAlign: 'center' }}>
                                {row.gap_freq > 0 ? (
                                  <span style={{
                                    background: nc.bg, border: `1px solid ${nc.border}`,
                                    color: nc.text, borderRadius: 6,
                                    padding: '2px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                                  }}>
                                    {row.gap_freq} {nc.label}
                                  </span>
                                ) : (
                                  <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 13 }}>✓</span>
                                )}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', borderRight: `1px solid ${G.border}`, color: G.textMuted, fontWeight: 600 }}>
                                {Math.round(row.qtd_mercado).toLocaleString('pt-BR')}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', borderRight: `1px solid ${G.border}`, fontWeight: 700, color: row.pontos_venda === 0 ? G.textMuted : '#2563EB' }}>
                                {row.pontos_venda}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', borderRight: `1px solid ${G.border}`, fontWeight: 600, color: row.valor_cliente !== null ? G.text : G.textMuted, fontFamily: row.valor_cliente !== null ? 'inherit' : 'inherit' }}>
                                {row.valor_cliente !== null
                                  ? row.valor_cliente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                  : '—'}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', borderRight: `1px solid ${G.border}`, color: G.text, fontWeight: 700 }}>
                                {Math.round(row.qtd_cliente).toLocaleString('pt-BR')}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                                <span style={{
                                  color: row.pct_captacao === 0 ? '#DC2626' : row.pct_captacao < 30 ? '#D97706' : '#16A34A',
                                  fontWeight: 700,
                                }}>
                                  {row.pct_captacao.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Consultando oportunidades...
        </div>
      )}
    </div>
  );
}
