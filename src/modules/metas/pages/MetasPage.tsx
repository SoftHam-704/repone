import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, ChevronDown, ArrowUpRight, ArrowDownRight, Maximize2 } from 'lucide-react';
import { AppSidebar } from '@/shared/components/layout/AppSidebar';
import { api } from '@/shared/lib/api';

// ─── Mustard Precision tokens ─────────────────────────────────────────────────
const G = {
  bg:        '#E8E1D4',  // Areia — fundo
  card:      '#F2ECE2',  // Areia clara — cards
  cardHi:    '#F8F4EE',  // Areia muito clara
  border:    '#D3C7AD',  // Areia pura — bordas
  text:      '#28374A',  // Azul navy
  textSec:   '#3D5265',  // Navy médio
  textMuted: '#2D3D4D',  // Navy escuro (mais legibilidade que o anterior #5E7282)
  mustard:   '#EAB308',  // Ocre/Mustard mais escuro para texto
  mustardHi: '#FFD200',  // Mustard original para acentos
  success:   '#16A34A',
  danger:    '#C0392B',
  warning:   '#D97706',
  blue:      '#2563EB',
} as const;

const MESES_LABEL = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v === 0 ? '0,00' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface PorMesRow {
  industria_codigo: number;
  industria_nome: string;
  mes: number;
  mes_nome: string;
  ano_anterior: number;
  meta_ano_corrente: number;
  vendas_ano_corrente: number;
  perc_atingimento: number;
  perc_relacao_ano_ant: number;
}

interface StatusRow {
  industria_codigo: number;
  industria_nome: string;
  meta_total: number;
  atual: number;
  percentual_meta: number;
  saldo: number;
  status: string;
  tendencia: string;
}

// ─── MAPA PIVOT ───────────────────────────────────────────────────────────────
// Transforma array flat em: { [industria]: { [mes]: PorMesRow } }
function buildPivot(rows: PorMesRow[]) {
  const map = new Map<number, { nome: string; meses: Map<number, PorMesRow> }>();
  for (const r of rows) {
    if (!map.has(r.industria_codigo)) {
      map.set(r.industria_codigo, { nome: r.industria_nome, meses: new Map() });
    }
    map.get(r.industria_codigo)!.meses.set(r.mes, r);
  }
  return map;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function MetasPage() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [year,       setYear]       = useState(currentYear);
  const [industryId, setIndustryId] = useState<number | null>(null);
  const [industries, setIndustries] = useState<{ for_codigo: number; for_nomered: string }[]>([]);
  const [porMes,     setPorMes]     = useState<PorMesRow[]>([]);
  const [status,     setStatus]     = useState<StatusRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set());

  const YEARS = [2022, 2023, 2024, 2025, 2026];

  // Carregar lista de indústrias
  useEffect(() => {
    api.get('/dashboard/industries-list')
      .then(r => r.data.success && setIndustries(r.data.data))
      .catch(console.error);
  }, []);

  // Carregar dados de metas
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ ano: String(year) });
    if (industryId) params.append('for_codigo', String(industryId));

    api.get(`/dashboard/metas-industrias?${params}`)
      .then(r => {
        if (r.data.success) {
          setPorMes(r.data.data.por_mes || []);
          setStatus(r.data.data.status || []);
          // Expande todas as indústrias por padrão
          const ids = new Set<number>((r.data.data.por_mes || []).map((row: PorMesRow) => row.industria_codigo));
          setExpanded(ids);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, industryId]);

  const pivot = useMemo(() => buildPivot(porMes), [porMes]);

  // Meses com pelo menos um valor não-zero
  const activeMeses = useMemo(() => {
    const set = new Set<number>();
    for (const row of porMes) {
      if (row.ano_anterior || row.meta_ano_corrente || row.vendas_ano_corrente) {
        set.add(row.mes);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [porMes]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusColor = (s: string) =>
    s === 'Atingida' ? G.success : s === 'Em Risco' ? G.warning : s === 'Abaixo' ? G.danger : G.textMuted;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: G.bg }}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <main className="flex-1 overflow-y-auto">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-50 px-8 pt-6 pb-4"
          style={{ background: `${G.bg}ec`, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${G.border}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${G.mustardHi}20`, border: `1px solid ${G.mustardHi}40` }}>
                <Target size={16} style={{ color: G.mustardHi }} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight" style={{ color: G.text }}>
                  Metas por Indústria
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: G.textMuted }}>
                  Acompanhamento mensal · {year}
                </p>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2">
              {/* Ano */}
              <div className="flex p-0.5 rounded-xl h-9 items-center gap-0.5"
                style={{ background: G.card, border: `1px solid ${G.border}` }}>
                {YEARS.map(y => (
                  <button key={y} onClick={() => setYear(y)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={year === y ? { background: G.text, color: G.bg } : { color: G.textSec }}>
                    {y}
                  </button>
                ))}
              </div>
              {/* Indústria */}
              <div className="relative">
                <select
                  value={industryId ?? ''}
                  onChange={e => setIndustryId(e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9 rounded-xl px-3 pr-8 text-xs font-bold outline-none cursor-pointer appearance-none"
                  style={{ background: G.card, border: `1px solid ${G.border}`, color: G.text, minWidth: 200 }}>
                  <option value="">Todas as indústrias</option>
                  {industries.map(i => (
                    <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: G.textMuted }} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5 pb-24">

          {/* ── HERO EXPLICATIVO ─────────────────────────────────────────── */}
          <div className="rounded-2xl px-6 py-4 flex items-start gap-4"
            style={{ background: `${G.mustardHi}12`, border: `1px solid ${G.mustardHi}30` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${G.mustardHi}25` }}>
              <Target size={15} style={{ color: G.mustard }} />
            </div>
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: G.text }}>
                Como interpretar este painel
              </p>
              <p className="text-xs leading-relaxed" style={{ color: G.textSec }}>
                Os cards acima mostram o <b>atingimento acumulado</b> de cada indústria no ano — soma das vendas de Jan até o mês atual, dividida pela soma das metas do mesmo período.
                A cor indica o status: <span style={{ color: G.success, fontWeight: 700 }}>verde = meta atingida (≥ 100%)</span>,{' '}
                <span style={{ color: G.warning, fontWeight: 700 }}>laranja = em risco (80–99%)</span>,{' '}
                <span style={{ color: G.danger, fontWeight: 700 }}>vermelho = abaixo (&lt; 80%)</span>.
                A tabela detalha mês a mês: <b>ano anterior</b>, <b>meta do ano corrente</b>, <b>vendas realizadas</b> e os percentuais de atingimento e variação.
              </p>
            </div>
          </div>

          {/* ── STATUS CARDS ─────────────────────────────────────────────── */}
          {status.filter(s => s.status !== 'Sem Meta').length > 0 && (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {status.filter(s => s.status !== 'Sem Meta').map((s, i) => {
                const color = statusColor(s.status);
                const pct = Number(s.percentual_meta);
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ background: G.card, border: `1px solid ${G.border}`, minWidth: 160 }}
                    className="rounded-2xl px-4 py-3 flex-shrink-0 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[100px]"
                        style={{ color: G.textMuted }}>{s.industria_nome}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                        style={{ background: `${color}15`, color }}>
                        {s.status} {s.tendencia}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-black leading-none" style={{ color }}>
                        {pct.toFixed(0)}%
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: G.textMuted }}>
                        meta
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: G.border }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.7, delay: i * 0.04 }}
                        className="h-full rounded-full" style={{ background: color }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── TABELA MAPA DE METAS ─────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: `${G.mustard}40`, borderTopColor: G.mustard }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: G.textMuted }}>
                  Carregando metas...
                </span>
              </div>
            </div>
          ) : pivot.size === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <Target size={32} style={{ color: G.border }} className="mx-auto mb-3" />
                <p className="text-sm font-bold" style={{ color: G.textMuted }}>
                  Nenhuma meta cadastrada para {year}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ background: G.card, border: `1px solid ${G.border}` }} className="rounded-2xl overflow-hidden">

              {/* Cabeçalho da tabela */}
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: G.text }}>
                      <th className="text-left px-4 py-4 font-black uppercase tracking-wider w-[220px]"
                        style={{ color: G.bg, position: 'sticky', left: 0, background: G.text, zIndex: 2, fontSize: '12px' }}>
                        INDÚSTRIA
                      </th>
                      {activeMeses.map(m => (
                        <th key={m} className="text-right px-3 py-4 font-black uppercase tracking-wider"
                          style={{ color: G.bg, minWidth: 100, fontSize: '12px' }}>
                          {MESES_LABEL[m - 1]}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {Array.from(pivot.entries()).map(([indId, { nome, meses }], indIdx) => {
                      const isExpanded = expanded.has(indId);
                      const statusRow = status.find(s => s.industria_codigo === indId);
                      const color = statusRow ? statusColor(statusRow.status) : G.textMuted;

                      return (
                        <>
                          {/* Linha cabeçalho da indústria */}
                          <tr key={`h-${indId}`}
                            onClick={() => toggleExpand(indId)}
                            style={{
                              background: indIdx % 2 === 0 ? '#F5F0EA' : '#EDE8E2',
                              cursor: 'pointer',
                            }}>
                            <td className="px-4 py-3 font-black"
                              style={{ color: G.text, position: 'sticky', left: 0, background: 'inherit', zIndex: 1 }}>
                              <div className="flex items-center gap-2">
                                <ChevronDown size={12} style={{
                                  color: G.textMuted,
                                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                  transition: 'transform .2s',
                                }} />
                                <span className="uppercase tracking-wider text-[13px]">{nome}</span>
                                {statusRow && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm"
                                    style={{ background: `${color}20`, color }}>
                                    {statusRow.status}
                                  </span>
                                )}
                              </div>
                            </td>
                            {activeMeses.map(m => {
                              const r = meses.get(m);
                              return (
                                <td key={m} className="text-right px-3 py-2.5 font-black"
                                  style={{ color: G.text, fontSize: 11 }}>
                                  {r ? fmtBRL(Number(r.vendas_ano_corrente)) : '—'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Linhas de detalhe */}
                          {isExpanded && (
                            <>
                              {/* Ano anterior */}
                              <tr key={`ant-${indId}`} style={{ background: G.cardHi }}>
                                <td className="px-4 py-2.5 text-[13px] font-bold"
                                  style={{ color: G.textSec, paddingLeft: 40, position: 'sticky', left: 0, background: G.cardHi, zIndex: 1 }}>
                                  Ano anterior
                                </td>
                                {activeMeses.map(m => {
                                  const r = meses.get(m);
                                  return (
                                    <td key={m} className="text-right px-3 py-2.5 text-[13px] font-medium"
                                      style={{ color: G.textSec }}>
                                      {r ? fmtBRL(Number(r.ano_anterior)) : '—'}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* Meta ano corrente */}
                              <tr key={`meta-${indId}`} style={{ background: G.cardHi }}>
                                <td className="px-4 py-2.5 text-[13px] font-black"
                                  style={{ color: G.mustard, paddingLeft: 40, position: 'sticky', left: 0, background: G.cardHi, zIndex: 1 }}>
                                  Meta ano corrente
                                </td>
                                {activeMeses.map(m => {
                                  const r = meses.get(m);
                                  const val = r ? Number(r.meta_ano_corrente) : 0;
                                  return (
                                    <td key={m} className="text-right px-3 py-2.5 text-[13px] font-black"
                                      style={{ color: val > 0 ? G.mustard : G.textMuted }}>
                                      {val > 0 ? fmtBRL(val) : '—'}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* Vendas ano corrente */}
                              <tr key={`vend-${indId}`} style={{ background: G.cardHi }}>
                                <td className="px-4 py-2.5 text-[13px] font-bold"
                                  style={{ color: G.text, paddingLeft: 40, position: 'sticky', left: 0, background: G.cardHi, zIndex: 1 }}>
                                  Vendas ano corrente
                                </td>
                                {activeMeses.map(m => {
                                  const r = meses.get(m);
                                  return (
                                    <td key={m} className="text-right px-3 py-2.5 text-[13px] font-bold"
                                      style={{ color: G.text }}>
                                      {r ? fmtBRL(Number(r.vendas_ano_corrente)) : '—'}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* % Atingido da meta */}
                              <tr key={`pct-${indId}`} style={{ background: G.cardHi }}>
                                <td className="px-4 py-2.5 text-[13px] font-bold"
                                  style={{ color: G.textMuted, paddingLeft: 40, position: 'sticky', left: 0, background: G.cardHi, zIndex: 1 }}>
                                  % Atingido da meta
                                </td>
                                {activeMeses.map(m => {
                                  const r = meses.get(m);
                                  const pct = r ? Number(r.perc_atingimento) : 0;
                                  const c = pct >= 100 ? G.success : pct >= 60 ? G.warning : G.danger;
                                  return (
                                    <td key={m} className="text-right px-3 py-2.5 text-[13px] font-black"
                                      style={{ color: r && Number(r.meta_ano_corrente) > 0 ? c : G.textMuted }}>
                                      {r && Number(r.meta_ano_corrente) > 0 ? fmtPct(pct) : '—'}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* % Em relação ao ano anterior */}
                              <tr key={`yoy-${indId}`}
                                style={{ background: G.cardHi, borderBottom: `2px solid ${G.border}` }}>
                                <td className="px-4 py-2.5 text-[13px] font-bold"
                                  style={{ color: G.textMuted, paddingLeft: 40, position: 'sticky', left: 0, background: G.cardHi, zIndex: 1 }}>
                                  % Em relação ao ano ant.
                                </td>
                                {activeMeses.map(m => {
                                  const r = meses.get(m);
                                  const pct = r ? Number(r.perc_relacao_ano_ant) : 0;
                                  const up = pct >= 0;
                                  return (
                                    <td key={m} className="text-right px-3 py-2.5" style={{ color: up ? G.success : G.danger }}>
                                      <div className="flex items-center justify-end gap-0.5 text-[13px] font-black">
                                        {r && Number(r.ano_anterior) > 0
                                          ? <>{up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmtPct(Math.abs(pct))}</>
                                          : <span style={{ color: G.textMuted }}>—</span>
                                        }
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            </>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rodapé */}
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: `1px solid ${G.border}`, background: G.cardHi }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: G.textMuted }}>
                  {pivot.size} {pivot.size === 1 ? 'indústria' : 'indústrias'} · {activeMeses.length} meses com dados
                </span>
                <button
                  onClick={() => setExpanded(prev =>
                    prev.size > 0 ? new Set() : new Set(Array.from(pivot.keys()))
                  )}
                  className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  style={{ color: G.textMuted }}>
                  <Maximize2 size={10} />
                  {expanded.size > 0 ? 'Recolher todas' : 'Expandir todas'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
