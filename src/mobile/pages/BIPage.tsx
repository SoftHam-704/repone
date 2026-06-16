import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, ShoppingCart,
  BarChart2, ChevronRight, Home, ZoomIn, AlertTriangle, Building2,
} from 'lucide-react';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';

const MES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtBRL    = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN      = (v: number) => Number(v).toLocaleString('pt-BR');
const now       = new Date();
const YEARS     = [now.getFullYear() - 1, now.getFullYear()];

// ─── Drill-down metadata ──────────────────────────────────────────────────────
const NIVEL_META = [
  { label: 'Indústrias', hint: 'Toque para ver os meses',    color: '#0D9488' },
  { label: 'Meses',      hint: 'Toque para ver os clientes', color: '#7C3AED' },
  { label: 'Clientes',   hint: 'Toque para ver as famílias', color: '#D97706' },
  { label: 'Famílias',   hint: 'Toque para ver os produtos', color: '#2563EB' },
  { label: 'Produtos',   hint: 'Nível mais profundo',        color: '#16A34A' },
];

interface DrillItem {
  label: string; tipo: 'root'|'industria'|'mes'|'cliente'|'grupo';
  for_codigo?: number; mes?: number; cli_codigo?: number; grupo?: number;
}
interface DrillRow {
  codigo: number|string; nome: string; produto_nome?: string;
  total: string; clientes?: number; pedidos?: number; quantidade?: string; mes?: number;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function DeltaBadge({ delta }: { delta?: number | null }) {
  if (delta == null) return null;
  const up = delta >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700,
      color: up ? '#16A34A' : '#DC2626', background: up ? '#16A34A1A' : '#DC26261A',
      padding: '2px 7px', borderRadius: 6, flexShrink: 0,
    }}>
      {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function KPICard({ label, value, sub, delta, icon: Icon, color, loading }: {
  label: string; value: string; sub?: string; delta?: number|null;
  icon: React.ElementType; color: string; loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <DeltaBadge delta={loading ? null : delta} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
          {label}
        </div>
        {loading
          ? <div style={{ height: 26, width: '70%', borderRadius: 6, background: 'var(--border)' }} />
          : <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>{value}</div>
        }
        {!loading && sub && (
          <div style={{ fontSize: 10, color: 'var(--navy-muted)', marginTop: 4 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function MonthlyBars({ data }: { data: { mes: number; total: number }[] }) {
  const maxVal = useMemo(() => Math.max(...data.map(d => d.total), 1), [data]);
  const curMes = now.getMonth() + 1;
  const [active, setActive] = useState<number | null>(null);
  const activeItem = active != null ? data.find(d => d.mes === active) : null;

  return (
    <div>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
        {activeItem
          ? <div style={{ background: 'var(--navy)', color: '#FFF', borderRadius: 8,
              padding: '4px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>
              {MES_SHORT[activeItem.mes - 1]} · {fmtBRL(activeItem.total)}
            </div>
          : <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>Toque em uma barra para ver o valor</span>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
        {MES_SHORT.map((label, i) => {
          const mes  = i + 1;
          const val  = data.find(d => d.mes === mes)?.total ?? 0;
          const pct  = val > 0 ? Math.max((val / maxVal) * 100, 3) : 0;
          const isAct = active === mes;
          const isCur = mes === curMes;
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
              onClick={() => val > 0 && setActive(prev => prev === mes ? null : mes)}>
              <div style={{ width: '100%', height: 72, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '100%', height: `${pct}%`,
                  background: isAct ? '#0D9488' : isCur ? '#FFD200' : '#28374A',
                  borderRadius: '3px 3px 0 0', opacity: val === 0 ? 0.12 : 1,
                  minHeight: val > 0 ? 3 : 0, transition: 'height 0.4s ease, background 0.2s',
                  cursor: val > 0 ? 'pointer' : 'default',
                }} />
              </div>
              <span style={{ fontSize: 8, fontWeight: 700,
                color: isAct ? '#0D9488' : isCur ? 'var(--navy)' : 'var(--navy-muted)' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressRow({ label, pct, rightLabel, color }: {
  label: string; pct: number; rightLabel?: string; color: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
          maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'monospace' }}>{rightLabel}</span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%`,
          background: color, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function RankedRow({ rank, name, value, sub, code }: {
  rank: number; name: string; value: string; sub?: string; code?: string;
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 8,
      borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: rank <= 3 ? 14 : 11, fontWeight: 900, color: 'var(--navy-muted)',
        width: 20, textAlign: 'right' as const, flexShrink: 0 }}>
        {medal ?? `#${rank}`}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {code && <div style={{ fontSize: 12, fontWeight: 900, color: '#0D9488',
          fontFamily: 'monospace', letterSpacing: '0.03em', lineHeight: 1 }}>{code}</div>}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
          lineHeight: code ? 1.3 : undefined }}>{name}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--navy-muted)', lineHeight: 1.2 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 900, color: '#28374A',
        fontFamily: 'monospace', flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function Section({ title, children, loading, emptyMsg = 'Sem dados para o período' }: {
  title: string; children?: React.ReactNode; loading?: boolean; emptyMsg?: string;
}) {
  return (
    <div className="card">
      <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--navy-muted)',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
        {title}
      </div>
      {loading
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[60,80,50,70].map(w => (
              <div key={w} style={{ height: 14, width: `${w}%`, borderRadius: 4, background: 'var(--border)' }} />
            ))}
          </div>
        : children ?? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 12, padding: '16px 0' }}>
            {emptyMsg}
          </div>
        )
      }
    </div>
  );
}

// ─── Drill-Down Section ───────────────────────────────────────────────────────
function DrillDownSection({ globalParams }: { globalParams: string }) {
  const [nivel,   setNivel]   = useState(0);
  const [stack,   setStack]   = useState<DrillItem[]>([{ label: 'Todas as Indústrias', tipo: 'root' }]);
  const [data,    setData]    = useState<DrillRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLevel = useCallback(async (lvl: number, stk: DrillItem[]) => {
    setLoading(true); setData([]);
    try {
      const extra = new URLSearchParams({ nivel: String(lvl) });
      for (const item of stk) {
        if (item.for_codigo !== undefined) extra.set('for_codigo', String(item.for_codigo));
        if (item.mes        !== undefined) extra.set('mes',        String(item.mes));
        if (item.cli_codigo !== undefined) extra.set('cli_codigo', String(item.cli_codigo));
        if (item.grupo      !== undefined) extra.set('grupo',      String(item.grupo));
      }
      const res = await api.get(`/bi/drilldown?${globalParams}&${extra.toString()}`);
      if (res.data.success) setData(res.data.data ?? []);
    } catch { setData([]); }
    finally  { setLoading(false); }
  }, [globalParams]);

  useEffect(() => {
    setNivel(0);
    const root = [{ label: 'Todas as Indústrias', tipo: 'root' as const }];
    setStack(root);
    fetchLevel(0, root);
  }, [globalParams]);

  const handleTap = (row: DrillRow) => {
    if (nivel >= 4) return;
    const nextNivel = nivel + 1;
    const codigoNum = Number(row.codigo);
    let newItem: DrillItem;
    if      (nivel === 0) newItem = { label: row.nome, tipo: 'industria', for_codigo: codigoNum };
    else if (nivel === 1) { const m = row.mes ?? codigoNum; newItem = { label: MES_SHORT[m-1] ?? String(m), tipo: 'mes', mes: m }; }
    else if (nivel === 2) newItem = { label: row.nome, tipo: 'cliente', cli_codigo: codigoNum };
    else                  newItem = { label: row.nome, tipo: 'grupo',   grupo: codigoNum };
    const next = [...stack, newItem];
    setStack(next); setNivel(nextNivel); fetchLevel(nextNivel, next);
  };

  const jumpTo = (idx: number) => {
    const next = stack.slice(0, idx + 1);
    setStack(next); setNivel(idx); fetchLevel(idx, next);
  };

  const meta     = NIVEL_META[nivel];
  const canDrill = nivel < 4;
  const maxVal   = data.length ? Math.max(...data.map(r => parseFloat(r.total)), 1) : 1;
  const total    = data.reduce((s, r) => s + parseFloat(r.total), 0);
  const labelOf  = (row: DrillRow) =>
    nivel === 1 ? MES_SHORT[(row.mes ?? Number(row.codigo)) - 1] ?? String(row.codigo) : row.nome ?? String(row.codigo);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `3px solid ${meta.color}` }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ZoomIn size={13} color={meta.color} />
            <span style={{ fontSize: 10, fontWeight: 900, color: meta.color,
              textTransform: 'uppercase', letterSpacing: 1 }}>
              Drill-down · {meta.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {NIVEL_META.map((m, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%',
                background: i === nivel ? m.color : 'var(--border)', transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const }}>
          {stack.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <ChevronRight size={10} color="var(--navy-muted)" />}
              <button onClick={() => i < nivel ? jumpTo(i) : undefined} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: i === nivel ? 800 : 500,
                color: i === nivel ? meta.color : 'var(--navy-muted)',
                background: i === nivel ? `${meta.color}15` : 'transparent',
                border: `1px solid ${i === nivel ? meta.color+'40' : 'transparent'}`,
                borderRadius: 6, padding: '2px 8px',
                cursor: i < nivel ? 'pointer' : 'default',
              }}>
                {i === 0 && <Home size={9} />}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 16px 14px' }}>
        {loading
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[70,90,55,80,65].map(w => (
                <div key={w} style={{ height: 36, width: `${w}%`, borderRadius: 6, background: 'var(--border)' }} />
              ))}
            </div>
          : !data.length
          ? <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 12, padding: '20px 0' }}>
              Sem dados para o período
            </div>
          : <>
              {data.map((row, i) => {
                const val   = parseFloat(row.total);
                const pct   = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const label = labelOf(row);
                return (
                  <div key={String(row.codigo)+i} onClick={() => canDrill && handleTap(row)}
                    style={{ marginBottom: 10, cursor: canDrill ? 'pointer' : 'default',
                      borderRadius: 8, padding: '6px 8px', transition: 'background 0.15s',
                      WebkitTapHighlightColor: 'transparent' }}
                    onTouchStart={e => { if (canDrill) (e.currentTarget as HTMLElement).style.background = `${meta.color}10`; }}
                    onTouchEnd={e   => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        {nivel === 4 && row.produto_nome
                          ? <>
                              <div style={{ fontSize: 12, fontWeight: 900, color: meta.color,
                                fontFamily: 'monospace', lineHeight: 1 }}>{label}</div>
                              <div style={{ fontSize: 10, color: 'var(--navy-muted)', lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {row.produto_nome}
                              </div>
                            </>
                          : <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                              {label}
                            </div>
                        }
                        {row.clientes != null && (
                          <div style={{ fontSize: 10, color: 'var(--navy-muted)' }}>
                            {row.clientes} cliente{row.clientes !== 1 ? 's' : ''}
                            {row.pedidos != null ? ` · ${row.pedidos} ped.` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy)', fontFamily: 'monospace' }}>
                          {fmtBRL(val)}
                        </span>
                        {canDrill && <ChevronRight size={12} color={meta.color} />}
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%`,
                        background: meta.color, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>
                  {data.length} {meta.label.toLowerCase()}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)', fontFamily: 'monospace' }}>
                  Total: {fmtBRL(total)}
                </span>
              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Carteira Section ─────────────────────────────────────────────────────────
const ABC_STYLE = {
  A: { bg: '#0D948820', border: '#0D948860', color: '#0D9488' },
  B: { bg: '#7C3AED20', border: '#7C3AED60', color: '#7C3AED' },
  C: { bg: '#94A3B820', border: '#94A3B860', color: '#94A3B8' },
};

function CarteiraSection({ globalParams }: { globalParams: string }) {
  const [agrupar,  setAgrupar]  = useState(false);
  const [abcFilt,  setAbcFilt]  = useState<'A'|'B'|'C'|null>(null);
  const [ranking,  setRanking]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true); setRanking([]);
    api.get(`/bi/clientes-ranking?${globalParams}&agrupar_rede=${agrupar}`)
      .then(r => setRanking(r.data.success ? (r.data.data || []) : []))
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, [globalParams, agrupar]);

  const kpis = useMemo(() => {
    if (!ranking.length) return null;
    const emRisco   = ranking.filter(c => parseInt(c.dias_sem_comprar) > 30).length;
    const totalFat  = ranking.reduce((s, c) => s + parseFloat(c.total), 0);
    const totalPed  = ranking.reduce((s, c) => s + parseInt(c.pedidos), 0);
    const ticket    = totalPed > 0 ? totalFat / totalPed : 0;
    const penMedia  = ranking.reduce((s, c) => s + parseInt(c.num_industrias || '0'), 0) / ranking.length;
    const clientesA = ranking.filter(c => c.curva_abc === 'A').length;
    return { total: ranking.length, emRisco, ticket, penMedia: penMedia.toFixed(1), clientesA };
  }, [ranking]);

  const rows = useMemo(() =>
    abcFilt ? ranking.filter(c => c.curva_abc === abcFilt) : ranking
  , [ranking, abcFilt]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: '3px solid #0D9488' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={13} color="#0D9488" />
            <span style={{ fontSize: 10, fontWeight: 900, color: '#0D9488',
              textTransform: 'uppercase', letterSpacing: 1 }}>
              Análise de Carteira
            </span>
          </div>
          {/* Toggle individual / grupos */}
          <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 8, padding: 2, gap: 2 }}>
            {[
              { label: 'Individual', icon: Users,     val: false },
              { label: 'Grupos',     icon: Building2, val: true  },
            ].map(opt => (
              <button key={String(opt.val)} onClick={() => setAgrupar(opt.val)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                background: agrupar === opt.val ? 'var(--sand-card)' : 'transparent',
                color:      agrupar === opt.val ? 'var(--navy)'      : 'var(--navy-muted)',
                boxShadow:  agrupar === opt.val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}>
                <opt.icon size={10} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 14px' }}>
        {/* KPI strip */}
        {kpis && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Ativos',       value: fmtN(kpis.total),    color: '#0D9488', sub: `${kpis.clientesA} na Curva A` },
              { label: 'Em Risco +30d', value: fmtN(kpis.emRisco), color: '#DC2626', icon: AlertTriangle },
              { label: 'Ticket Médio', value: fmtBRL(kpis.ticket), color: '#7C3AED' },
              { label: 'Penetração',   value: `${kpis.penMedia} ind.`, color: '#D97706', sub: 'por cliente' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: k.color, lineHeight: 1 }}>
                  {k.value}
                </div>
                {k.sub && <div style={{ fontSize: 9, color: 'var(--navy-muted)', marginTop: 2 }}>{k.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ABC filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['A','B','C'] as const).map(abc => {
            const s   = ABC_STYLE[abc];
            const sel = abcFilt === abc;
            return (
              <button key={abc} onClick={() => setAbcFilt(sel ? null : abc)} style={{
                fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 6,
                background: sel ? s.bg    : 'var(--border)',
                border:     `1px solid ${sel ? s.border : 'transparent'}`,
                color:      sel ? s.color : 'var(--navy-muted)',
                transition: 'all 0.2s',
              }}>
                Curva {abc}
              </button>
            );
          })}
          {abcFilt && (
            <button onClick={() => setAbcFilt(null)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              background: 'transparent', color: 'var(--navy-muted)', marginLeft: 'auto',
            }}>
              ✕ Todos
            </button>
          )}
        </div>

        {/* List */}
        {loading
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80,65,75,55,70].map(w => (
                <div key={w} style={{ height: 42, width: `${w}%`, borderRadius: 6, background: 'var(--border)' }} />
              ))}
            </div>
          : !rows.length
          ? <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 12, padding: '16px 0' }}>
              Sem clientes para o período
            </div>
          : <>
              {rows.slice(0, 20).map((c: any, i: number) => {
                const abc   = (c.curva_abc as 'A'|'B'|'C') ?? 'C';
                const s     = ABC_STYLE[abc] ?? ABC_STYLE['C'];
                const dias  = parseInt(c.dias_sem_comprar ?? '0');
                const risco = dias > 30;
                return (
                  <div key={c.cli_codigo ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)',
                      width: 22, textAlign: 'right' as const, flexShrink: 0 }}>
                      #{i+1}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                      background: s.bg, border: `1px solid ${s.border}`, color: s.color, flexShrink: 0 }}>
                      {abc}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {c.nome}
                      </div>
                      <div style={{ fontSize: 10, color: risco ? '#DC2626' : 'var(--navy-muted)' }}>
                        {dias}d sem pedido · {c.pedidos ?? 0} ped. · {c.num_industrias ?? 0} ind.
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--navy)',
                      fontFamily: 'monospace', flexShrink: 0 }}>
                      {fmtBRL(parseFloat(c.total || '0'))}
                    </span>
                  </div>
                );
              })}
              <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>
                  {rows.length} cliente{rows.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)', fontFamily: 'monospace' }}>
                  Total: {fmtBRL(rows.reduce((s, c) => s + parseFloat(c.total||'0'), 0))}
                </span>
              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BIPage() {
  const { isOnline } = useOffline();

  const [ano,        setAno]        = useState(now.getFullYear());
  const [mes,        setMes]        = useState<number | null>(null);
  const [forCodigo,  setForCodigo]  = useState<number | null>(null);
  const [industrias, setIndustrias] = useState<{ for_codigo: number; nome: string }[]>([]);

  const [overview, setOverview] = useState<any>(null);
  const [monthly,  setMonthly]  = useState<{ mes: number; total: number }[]>([]);
  const [metas,    setMetas]    = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [loadOv,   setLoadOv]   = useState(false);
  const [loadMon,  setLoadMon]  = useState(false);
  const [loadMeta, setLoadMeta] = useState(false);
  const [loadProd, setLoadProd] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams({ anos: String(ano) });
    if (mes)       p.set('meses',     String(mes));
    if (forCodigo) p.set('for_codigo', String(forCodigo));
    return p.toString();
  }, [ano, mes, forCodigo]);

  // Fetch industry list when year changes
  useEffect(() => {
    api.get(`/bi/market-share?anos=${ano}`)
      .then(r => setIndustrias(r.data.success
        ? (r.data.data || []).map((d: any) => ({ for_codigo: d.for_codigo, nome: d.nome }))
        : []))
      .catch(() => setIndustrias([]));
    setForCodigo(null); // reset filter when year changes
  }, [ano]);

  const fetch = useCallback(() => {
    if (!isOnline) return;
    setOverview(null); setMonthly([]); setMetas([]); setProducts([]);

    setLoadOv(true);
    api.get(`/bi/overview?${params}`)
      .then(r => setOverview(r.data.success ? r.data.data : null))
      .catch(() => setOverview(null)).finally(() => setLoadOv(false));

    setLoadMon(true);
    api.get(`/bi/monthly?${params}`)
      .then(r => {
        const rows: any[] = r.data.success ? (r.data.data || []) : [];
        const serie = rows.find((s: any) => s.ano === ano);
        setMonthly(serie ? serie.series.map((s: any) => ({ mes: s.mes, total: parseFloat(s.total || '0') })) : []);
      })
      .catch(() => setMonthly([])).finally(() => setLoadMon(false));

    setLoadMeta(true);
    api.get(`/bi/metas-mensal?${params}`)
      .then(r => setMetas(r.data.success ? (r.data.data || []) : []))
      .catch(() => setMetas([])).finally(() => setLoadMeta(false));

    setLoadProd(true);
    api.get(`/bi/ranking-produtos?${params}`)
      .then(r => setProducts(r.data.success ? (r.data.data || []) : []))
      .catch(() => setProducts([])).finally(() => setLoadProd(false));
  }, [isOnline, params, ano]);

  useEffect(() => { fetch(); }, [fetch]);

  const metasByMonth = useMemo(() => {
    if (!metas.length) return [];
    const map: Record<number, { realizado: number; meta: number }> = {};
    metas.forEach((m: any) => {
      const n = m.mes ?? m.month ?? 0;
      if (!map[n]) map[n] = { realizado: 0, meta: 0 };
      map[n].realizado += parseFloat(m.realizado || '0');
      map[n].meta      += parseFloat(m.meta      || '0');
    });
    return Object.entries(map).map(([m, v]) => ({ mes: Number(m), ...v }))
      .filter(m => m.meta > 0).sort((a, b) => a.mes - b.mes);
  }, [metas]);

  // Giro de produtos: o REP precisa achar o giro de QUALQUER item, não só do top 10.
  // Mantém o ranking absoluto e filtra por código/nome.
  const [prodSearch, setProdSearch] = useState('');
  const rankedProds = useMemo(
    () => products.map((p: any, i: number) => ({ ...p, _rank: i + 1 })),
    [products],
  );
  const filteredProds = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return rankedProds;
    return rankedProds.filter((p: any) =>
      String(p.produto ?? '').toLowerCase().includes(q) ||
      String(p.nome ?? '').toLowerCase().includes(q));
  }, [rankedProds, prodSearch]);

  if (!isOnline) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MobileHeader title="BI Intelligence" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <BarChart2 size={48} color="var(--navy-muted)" />
          <div style={{ fontSize: 14, color: 'var(--navy-muted)', textAlign: 'center' }}>
            BI Intelligence requer conexão com a internet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="BI Intelligence" />

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px 8px', background: 'var(--sand-bg)', flexShrink: 0 }}>

        {/* Year pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {YEARS.map(y => (
            <button key={y} className="pill" onClick={() => setAno(y)} style={{
              background: ano === y ? 'var(--navy)' : 'var(--sand-card)',
              color:      ano === y ? '#FFF'        : 'var(--navy)',
              fontWeight: 900, fontSize: 13,
            }}>
              {y}
            </button>
          ))}
          {mes !== null && (
            <button className="pill" onClick={() => setMes(null)} style={{
              background: 'var(--sand-card)', color: 'var(--navy-muted)', fontSize: 12,
            }}>
              ✕ {MES_SHORT[(mes ?? 1) - 1]}
            </button>
          )}
          {forCodigo !== null && (
            <button className="pill" onClick={() => setForCodigo(null)} style={{
              background: '#0D948820', color: '#0D9488', fontSize: 11,
              border: '1px solid #0D948840',
            }}>
              ✕ {industrias.find(i => i.for_codigo === forCodigo)?.nome ?? 'Ind.'}
            </button>
          )}
        </div>

        {/* Month grid 2×6 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 8 }}>
          {MES_SHORT.map((label, i) => {
            const m   = i + 1;
            const sel = mes === m;
            return (
              <button key={label} onClick={() => setMes(mes === m ? null : m)} style={{
                textAlign: 'center', padding: '5px 0', borderRadius: 8, fontSize: 11,
                fontWeight: sel ? 900 : 600,
                background: sel ? '#FFD200' : 'var(--sand-card)',
                color:      sel ? '#28374A' : 'var(--navy-muted)',
                border:     sel ? '1px solid #E6BD00' : '1px solid transparent',
                transition: 'all 0.15s',
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Industry filter */}
        {industrias.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8,
            scrollbarWidth: 'none' as any }}>
            <button onClick={() => setForCodigo(null)} style={{
              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, flexShrink: 0,
              background: forCodigo === null ? 'var(--navy)' : 'var(--sand-card)',
              color:      forCodigo === null ? '#FFF'        : 'var(--navy-muted)',
              border:     '1px solid transparent',
            }}>
              Todas Ind.
            </button>
            {industrias.map(ind => {
              const sel = forCodigo === ind.for_codigo;
              return (
                <button key={ind.for_codigo} onClick={() => setForCodigo(sel ? null : ind.for_codigo)} style={{
                  fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, flexShrink: 0,
                  background: sel ? '#0D948820' : 'var(--sand-card)',
                  color:      sel ? '#0D9488'   : 'var(--navy-muted)',
                  border:     `1px solid ${sel ? '#0D948850' : 'transparent'}`,
                  maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                }}>
                  {ind.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 80px' }}>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <KPICard label="Faturamento"    value={fmtBRL(overview?.total_vendido ?? 0)}
            delta={overview?.delta_vendido}    icon={DollarSign}   color="#0D9488" loading={loadOv} />
          <KPICard label="Volume de Itens" value={fmtN(overview?.quantidade ?? 0)}
            delta={overview?.delta_quantidade} icon={Package}      color="#2563EB" loading={loadOv} />
          <KPICard label="Clientes Ativos" value={fmtN(overview?.clientes_ativos ?? 0)}
            sub={overview?.total_carteira
              ? `${overview.positivacao_pct}% de ${fmtN(overview.total_carteira)} da carteira`
              : undefined}
            delta={overview?.delta_clientes}   icon={Users}        color="#16A34A" loading={loadOv} />
          <KPICard label="Ticket Médio"   value={fmtBRL(overview?.ticket_medio ?? 0)}
            delta={overview?.delta_ticket}     icon={ShoppingCart} color="#7C3AED" loading={loadOv} />
        </div>

        {/* Evolução Mensal */}
        <Section title={`Evolução Mensal · ${ano}`} loading={loadMon && !monthly.length}>
          {monthly.length > 0
            ? <>
                <MonthlyBars data={monthly} />
                {(() => {
                  const best = [...monthly].sort((a, b) => b.total - a.total)[0];
                  return (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--navy-muted)', textAlign: 'center' }}>
                      Melhor mês: <strong style={{ color: 'var(--navy)' }}>{MES_SHORT[best.mes-1]}</strong> — {fmtBRL(best.total)}
                    </div>
                  );
                })()}
              </>
            : !loadMon
            ? <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 12, padding: '16px 0' }}>
                Sem dados para o período
              </div>
            : null
          }
        </Section>

        {/* Metas */}
        {(loadMeta || metasByMonth.length > 0) && (
          <Section title="Mapa de Metas" loading={loadMeta && !metasByMonth.length}>
            {metasByMonth.map(m => {
              const pct   = m.meta > 0 ? (m.realizado / m.meta) * 100 : 0;
              const color = pct >= 100 ? '#16A34A' : pct >= 80 ? '#D97706' : '#DC2626';
              return (
                <ProgressRow key={m.mes} label={MES_SHORT[m.mes-1]} pct={pct} color={color}
                  rightLabel={`${pct.toFixed(0)}%  ${fmtBRL(m.realizado)}`} />
              );
            })}
          </Section>
        )}

        {/* Drill-down */}
        <DrillDownSection globalParams={params} />

        {/* Análise de Carteira */}
        <CarteiraSection globalParams={params} />

        {/* Giro de Produtos — todos os vendidos no período, com busca por item */}
        <Section title="Giro de Produtos" loading={loadProd && !products.length}>
          {products.length > 0 ? (
            <>
              <input
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                placeholder="Buscar produto por código ou nome…"
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, marginBottom: 10,
                  border: '1px solid var(--border)', borderRadius: 10, background: '#fff',
                  color: 'var(--navy)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
              />
              {filteredProds.length > 0
                ? filteredProds.map((p: any) => (
                    <RankedRow key={p.produto} rank={p._rank} code={p.produto} name={p.nome ?? ''}
                      value={fmtBRL(parseFloat(p.total || '0'))}
                      sub={`${fmtN(Number(p.quantidade || 0))} un · ${p.pedidos ?? 0} ped.`} />
                  ))
                : <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 12, padding: '14px 0' }}>
                    Nenhum produto encontrado para “{prodSearch}”.
                  </div>}
              <div style={{ fontSize: 10, color: 'var(--navy-muted)', textAlign: 'center', marginTop: 10 }}>
                {prodSearch.trim()
                  ? `${filteredProds.length} de ${products.length} produtos`
                  : `${products.length} produtos com venda no período`}
              </div>
            </>
          ) : undefined}
        </Section>

      </div>
    </div>
  );
}
