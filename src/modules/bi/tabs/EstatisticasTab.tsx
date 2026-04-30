import { useEffect, useState, useMemo } from 'react';
import { Info, TrendingDown, TrendingUp, Minus, UserPlus, UserMinus, RefreshCw, Shield, X, Filter } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';

const MES_LABEL: Record<number, string> = {
  1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',
  7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez',
};

// ─── Shared UI ─────────────────────────────────────────────────────────────────
const SLabel = ({ label, accent, sub }: { label: string; accent?: string; sub?: string }) => (
  <div className="mb-3">
    <p className="text-xs font-black uppercase tracking-widest"
      style={{ color: accent ?? BI.textMuted }}>{label}</p>
    {sub && <p className="text-[10px] -mt-0.5" style={{ color: BI.textMuted }}>{sub}</p>}
  </div>
);

const CardWrap = ({
  children, accent, style = {},
}: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) => (
  <div className="glass-card rounded-[20px]"
    style={{
      padding: '24px 24px 20px',
      position: 'relative', overflow: 'hidden', ...style,
    }}>
    {accent && (
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent, borderRadius: '16px 16px 0 0', pointerEvents: 'none',
      }} />
    )}
    {children}
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-2" style={{ padding: '32px 0' }}>
    <Info size={22} style={{ color: BI.textMuted }} />
    <p className="text-sm font-bold" style={{ color: BI.textMuted }}>Sem dados para o período</p>
  </div>
);

// ─── Curva ABC colors ──────────────────────────────────────────────────────────
const CURVA_COLORS: Record<string, string> = {
  A: BI.success,
  B: BI.warning,
  C: BI.danger,
};

// ─── EstatisticasTab ───────────────────────────────────────────────────────────
const EstatisticasTab = () => {
  const { filters, visao, setFilters, toggleMes } = useBIStore();
  const p = buildBIParams(filters);

  // ── Data State ──────────────────────────────────────────────────────────────
  const [resumo,       setResumo]       = useState<any>(null);
  const [curvaAbc,     setCurvaAbc]     = useState<{ data: any[]; total_skus: number }>({ data: [], total_skus: 0 });
  const [ultimaCompra, setUltimaCompra] = useState<any[]>([]);
  const [classProd,    setClassProd]    = useState<any[]>([]);
  const [fatMensal,    setFatMensal]    = useState<any[]>([]);
  const [statusCli,    setStatusCli]    = useState<any>(null);

  const [loadR, setLoadR] = useState(true);
  const [loadA, setLoadA] = useState(true);
  const [loadU, setLoadU] = useState(true);
  const [loadC, setLoadC] = useState(true);
  const [loadF, setLoadF] = useState(true);
  const [loadS, setLoadS] = useState(true);

  // Curva ABC → Classificação de Produtos link
  const [selectedCurva, setSelectedCurva] = useState<'A' | 'B' | 'C' | null>(null);

  // ── Fetches ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadR(true);
    api.get(`/bi/stats-resumo?${p}`)
      .then(r => r.data.success && setResumo(r.data.data))
      .catch(console.error).finally(() => setLoadR(false));
  }, [p]);

  useEffect(() => {
    setLoadA(true);
    api.get(`/bi/stats-curva-abc?${p}`)
      .then(r => { if (r.data.success) setCurvaAbc({ data: r.data.data || [], total_skus: r.data.total_skus || 0 }); })
      .catch(console.error).finally(() => setLoadA(false));
  }, [p]);

  useEffect(() => {
    setLoadU(true);
    api.get(`/bi/stats-ultima-compra?${p}&limit=15`)
      .then(r => r.data.success && setUltimaCompra(r.data.data || []))
      .catch(console.error).finally(() => setLoadU(false));
  }, [p]);

  useEffect(() => {
    setLoadC(true);
    const curvaParam = selectedCurva ? `&curva=${selectedCurva}` : '';
    api.get(`/bi/stats-classificacao-produtos?${p}&limit=30${curvaParam}`)
      .then(r => r.data.success && setClassProd(r.data.data || []))
      .catch(console.error).finally(() => setLoadC(false));
  }, [p, selectedCurva]);

  useEffect(() => {
    setLoadF(true);
    api.get(`/bi/stats-fat-industria-mensal?${p}`)
      .then(r => r.data.success && setFatMensal(r.data.data || []))
      .catch(console.error).finally(() => setLoadF(false));
  }, [p]);

  useEffect(() => {
    setLoadS(true);
    api.get(`/bi/stats-status-clientes?${p}`)
      .then(r => r.data.success && setStatusCli(r.data.data || null))
      .catch(console.error).finally(() => setLoadS(false));
  }, [p]);

  // ── Derived: métrica-aware KPIs ────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!resumo) return null;
    return [
      {
        label: 'Valor Vendido',
        value: fmtBRL(resumo.valor_vendido ?? 0),
        delta: resumo.delta_valor,
        icon: '💰', color: BI.teal,
      },
      {
        label: 'Qtd Total Vendida',
        value: fmtN(resumo.qtd_total ?? 0),
        delta: resumo.delta_qtd,
        icon: '📦', color: BI.info,
      },
      {
        label: 'Nº Pedidos',
        value: fmtN(resumo.num_pedidos ?? 0),
        delta: resumo.delta_pedidos,
        icon: '📋', color: BI.warning,
      },
      {
        label: 'IDs Vendidos',
        value: fmtN(resumo.ids_vendidos ?? 0),
        delta: resumo.delta_ids,
        icon: '🏷️', color: BI.purple,
      },
    ];
  }, [resumo]);

  // ── Derived: Fat. Indústria Mensal pivot ───────────────────────────────────
  const fatPivot = useMemo(() => {
    if (!fatMensal.length) return { industries: [], meses: [], matrix: new Map() };

    const indMap = new Map<number, { nome: string; total: number }>();
    const mesesSet = new Set<number>();

    fatMensal.forEach(d => {
      mesesSet.add(d.mes);
      const ex = indMap.get(d.industria_codigo);
      if (ex) {
        ex.total += parseFloat(d.total);
      } else {
        indMap.set(d.industria_codigo, { nome: d.industria, total: parseFloat(d.total) });
      }
    });

    const industries = Array.from(indMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([codigo, { nome }]) => ({ codigo, nome }));

    const meses = Array.from(mesesSet).sort((a, b) => a - b);

    const matrix = new Map<string, { total: number; quantidade: number; clientes: number }>();
    fatMensal.forEach(d => {
      const key = `${d.industria_codigo}-${d.mes}`;
      matrix.set(key, {
        total: parseFloat(d.total),
        quantidade: parseFloat(d.quantidade),
        clientes: d.clientes,
      });
    });

    return { industries, meses, matrix };
  }, [fatMensal]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ══ ROW 0: KPI Cards ═════════════════════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-4">
        {loadR
          ? [1,2,3,4].map(i => <SkeletonCard key={i} height={110} />)
          : kpis?.map((kpi, i) => {
            const d = kpi.delta;
            const isUp   = d !== null && d !== undefined && d > 0;
            const isDown = d !== null && d !== undefined && d < 0;
            const deltaColor = isUp ? BI.success : isDown ? BI.danger : BI.textMuted;
            const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
            return (
              <div key={i} className="glass-card" style={{
                borderRadius: 20, padding: '24px 24px 20px',
                borderTop: `4px solid ${kpi.color}`,
                boxShadow: BI.shadowCard,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: `radial-gradient(circle at 0% 0%, ${kpi.color}10 0%, transparent 50%)`,
                  pointerEvents: 'none'
                }} />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{kpi.icon}</span>
                  <p className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: BI.textMuted }}>{kpi.label}</p>
                </div>
                <p className="text-2xl font-black" style={{
                  color: BI.text, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  lineHeight: 1, letterSpacing: '-0.02em',
                }}>{kpi.value}</p>
                {d !== null && d !== undefined && (
                  <div className="flex items-center gap-1 mt-2" style={{ color: deltaColor }}>
                    <DeltaIcon size={11} strokeWidth={2.5} />
                    <span style={{ fontSize: 10, fontWeight: 700 }}>
                      {isUp ? '+' : ''}{d.toFixed(1)}% vs {resumo?.ano_comp}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        }
      </div>

      {/* ══ ROW 1: Curva ABC (left) + Status Clientes (right) ══════════════ */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Curva ABC */}
        <CardWrap accent={`linear-gradient(90deg, ${BI.success}, ${BI.warning})`}>
          <SLabel label="Curva ABC de Produtos" accent={BI.success}
            sub="Classificação dinâmica Pareto: A=80% · B=80-95% · C=95-100%" />
          {loadA ? <SkeletonCard lines={4} /> : !curvaAbc.data.length ? <EmptyState /> : (
            <div className="space-y-4">
              {(['A', 'B', 'C'] as const).map(curva => {
                const d = curvaAbc.data.find(r => r.curva === curva);
                const vendidos = d ? d.vendidos : 0;
                const total = d ? parseFloat(d.total) : 0;
                const totalSkus = curvaAbc.total_skus || 1;
                const pct = totalSkus > 0 ? ((vendidos / totalSkus) * 100).toFixed(0) : '0';
                const color = CURVA_COLORS[curva];
                const isSelected = selectedCurva === curva;

                return (
                  <div key={curva}
                    onClick={() => setSelectedCurva(isSelected ? null : curva)}
                    style={{
                      borderRadius: 14, padding: '14px 16px',
                      background: isSelected ? `${color}18` : `${color}08`,
                      border: `1px solid ${isSelected ? `${color}60` : `${color}22`}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 16px ${color}25` : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: 40, height: 40, borderRadius: 12,
                          background: isSelected ? `${color}30` : `${color}18`,
                          border: `1px solid ${isSelected ? `${color}60` : `${color}35`}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 900, color,
                        }}>
                          {curva}
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: BI.text }}>
                            Produtos Classe {curva}
                          </p>
                          <p className="text-[10px]" style={{ color: BI.textMuted }}>
                            {fmtBRL(total)} em faturamento
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black" style={{ color, fontFamily: 'monospace' }}>
                          {fmtN(vendidos)}
                        </p>
                        <p className="text-[10px]" style={{ color: BI.textMuted }}>
                          de {fmtN(totalSkus)} · {pct}%
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{
                      height: 5, borderRadius: 999,
                      background: `${color}15`,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${Math.min(parseFloat(pct), 100)}%`,
                        background: color,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardWrap>

        {/* Status dos Clientes no Trimestre */}
        <CardWrap accent={`linear-gradient(90deg, ${BI.info}, ${BI.teal})`}>
          <SLabel label="Status dos Clientes no Trimestre" accent={BI.info}
            sub={statusCli ? `${statusCli.trimestre} vs ${statusCli.trimestre_anterior}` : 'Carregando...'} />
          {loadS ? <SkeletonCard lines={5} /> : !statusCli ? <EmptyState /> : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Clientes Novos',       value: statusCli.novos,       color: BI.success, icon: <UserPlus size={18} />,   desc: 'Primeira compra — nunca compraram antes' },
                { label: 'Clientes Perdidos',     value: statusCli.perdidos,    color: BI.danger,  icon: <UserMinus size={18} />,  desc: 'Compraram no trimestre anterior, não neste' },
                { label: 'Clientes Reativados',   value: statusCli.reativados,  color: BI.warning, icon: <RefreshCw size={18} />,  desc: 'Voltaram a comprar após ausência' },
                { label: 'Clientes Retidos',      value: statusCli.retidos,     color: BI.teal,    icon: <Shield size={18} />,     desc: 'Compraram neste e no trimestre anterior' },
              ].map((card, i) => (
                <div key={i} style={{
                  borderRadius: 14, padding: '16px',
                  background: `${card.color}08`, border: `1px solid ${card.color}22`,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div className="flex items-center gap-2" style={{ color: card.color }}>
                    {card.icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{card.label}</span>
                  </div>
                  <p className="text-3xl font-black" style={{
                    color: BI.text, fontFamily: 'monospace', lineHeight: 1,
                  }}>
                    {fmtN(card.value)}
                  </p>
                  <p className="text-[9px] leading-tight" style={{ color: BI.textMuted }}>
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardWrap>
      </div>

      {/* ══ ROW 2: Data Última Compra (left) + Classificação Produtos (right) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Data da última compra */}
        <CardWrap accent={`linear-gradient(90deg, ${BI.danger}, #E8813A)`}
          style={{ display: 'flex', flexDirection: 'column' }}>
          <SLabel label="Data da Última Compra" accent={BI.danger}
            sub="Clientes ativos ordenados por dias sem comprar" />
          {loadU ? <SkeletonCard lines={8} /> : !ultimaCompra.length ? <EmptyState /> : (
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420, paddingRight: 8 }}>
              {/* Header */}
              <div className="grid gap-2 mb-1 pb-1 sticky top-0"
                style={{
                  gridTemplateColumns: '1fr 90px 60px',
                  borderBottom: `1px solid ${BI.border}`, background: BI.panel, zIndex: 1,
                }}>
                <span className="text-[9px] font-bold uppercase" style={{ color: BI.textMuted }}>Cliente</span>
                <span className="text-[9px] font-bold uppercase text-center" style={{ color: BI.textMuted }}>Data</span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>Dias</span>
              </div>
              {ultimaCompra.map((c, i) => {
                const urgency = c.dias >= 300 ? BI.danger : c.dias >= 180 ? BI.warning : BI.textSec;
                return (
                  <div key={i} className="grid gap-2 py-1.5"
                    style={{
                      gridTemplateColumns: '1fr 90px 60px',
                      borderBottom: `1px solid ${BI.border}18`,
                    }}>
                    <p className="text-[11px] font-semibold truncate" style={{ color: BI.text }}>{c.nome}</p>
                    <p className="text-[11px] text-center font-mono" style={{ color: BI.textSec }}>
                      {new Date(c.ultima_compra).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-[11px] text-right font-black font-mono" style={{ color: urgency }}>
                      {c.dias}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardWrap>

        <CardWrap accent={selectedCurva ? CURVA_COLORS[selectedCurva] : `linear-gradient(90deg, ${BI.purple}, ${BI.info})`}
          style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between mb-3">
            <SLabel label={selectedCurva ? `Produtos Curva ${selectedCurva}` : 'Classificação de Produtos'}
              accent={selectedCurva ? CURVA_COLORS[selectedCurva] : BI.purple}
              sub="Ranking dinâmico com curva ABC e quantidade vendida" />
            {selectedCurva && (
              <button
                onClick={() => setSelectedCurva(null)}
                style={{
                  fontSize: 10, fontWeight: 700, color: BI.textMuted,
                  background: `${BI.border}60`, border: `1px solid ${BI.border}`,
                  borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                  whiteSpace: 'nowrap', marginBottom: 12,
                }}>
                × limpar filtro
              </button>
            )}
          </div>
          {loadC ? <SkeletonCard lines={8} /> : !classProd.length ? <EmptyState /> : (
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420, paddingRight: 8 }}>
              {/* Header */}
              <div className="grid gap-2 mb-1 pb-1 sticky top-0"
                style={{
                  gridTemplateColumns: '1fr 50px 70px',
                  borderBottom: `1px solid ${BI.border}`, background: BI.panel, zIndex: 1,
                }}>
                <span className="text-[9px] font-bold uppercase" style={{ color: BI.textMuted }}>Produto</span>
                <span className="text-[9px] font-bold uppercase text-center" style={{ color: BI.textMuted }}>Curva</span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>Qtd</span>
              </div>
              {classProd.map((p, i) => {
                const curvaColor = CURVA_COLORS[p.curva] || BI.textMuted;
                return (
                  <div key={i} className="grid gap-2 py-1.5"
                    style={{
                      gridTemplateColumns: '1fr 50px 70px',
                      borderBottom: `1px solid ${BI.border}18`,
                    }}>
                    <p className="text-[11px] font-semibold truncate" style={{ color: BI.text }}>
                      {p.produto}
                    </p>
                    <div className="flex justify-center">
                      <span style={{
                        fontSize: 9, fontWeight: 900, color: curvaColor,
                        background: `${curvaColor}15`, border: `1px solid ${curvaColor}30`,
                        borderRadius: 6, padding: '1px 8px',
                      }}>
                        {p.curva}
                      </span>
                    </div>
                    <p className="text-[11px] text-right font-mono font-semibold" style={{ color: BI.textSec }}>
                      {fmtN(parseFloat(p.quantidade))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardWrap>
      </div>

      {/* ══ ROW 3: Faturamento e Clientes por Indústria (matrix mensal) ═════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.info})`}>
        <div className="flex items-start justify-between mb-3">
          <SLabel label="Faturamento e Quantidade de Clientes Atendidos" accent={BI.teal}
            sub="Clique numa indústria para filtrar todos os cards · Clique num mês para recortar o período" />
          {(filters.for_codigo || filters.meses.length > 0) && (
            <div className="flex items-center gap-2 flex-shrink-0" style={{ marginBottom: 12 }}>
              {filters.for_codigo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${BI.teal}20`, border: `1px solid ${BI.teal}50`,
                  borderRadius: 8, padding: '3px 10px', fontSize: 10, fontWeight: 700,
                  color: BI.teal,
                }}>
                  <Filter size={10} />
                  {fatPivot.industries.find(i => i.codigo === filters.for_codigo)?.nome ?? `#${filters.for_codigo}`}
                  <button onClick={() => setFilters({ for_codigo: null })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: BI.teal, lineHeight: 1, padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              )}
              {filters.meses.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${BI.info}20`, border: `1px solid ${BI.info}50`,
                  borderRadius: 8, padding: '3px 10px', fontSize: 10, fontWeight: 700,
                  color: BI.info,
                }}>
                  {filters.meses.map(m => MES_LABEL[m]).join(', ')}
                  <button onClick={() => setFilters({ meses: [] })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: BI.info, lineHeight: 1, padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {loadF ? <SkeletonCard lines={10} /> : !fatPivot.industries.length ? <EmptyState /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BI.border}` }}>
                  <th style={{
                    textAlign: 'left', padding: '6px 8px', position: 'sticky', left: 0,
                    background: BI.panel, zIndex: 2, minWidth: 140,
                    color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  }}>Indústria</th>
                  <th style={{
                    textAlign: 'left', padding: '6px 8px', minWidth: 80,
                    color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  }}>Métrica</th>
                  {fatPivot.meses.map(m => {
                    const mesActive = filters.meses.includes(m);
                    return (
                      <th key={m}
                        onClick={() => toggleMes(m)}
                        style={{
                          textAlign: 'right', padding: '6px 8px', minWidth: 70,
                          color: mesActive ? BI.info : BI.textMuted,
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                          cursor: 'pointer', userSelect: 'none',
                          background: mesActive ? `${BI.info}15` : 'transparent',
                          borderRadius: 6, transition: 'all 0.15s',
                        }}
                        title={`Filtrar por ${MES_LABEL[m]}`}>
                        {MES_LABEL[m]}{mesActive ? ' ●' : ''}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {fatPivot.industries.map((ind) => {
                  const isSelected = filters.for_codigo === ind.codigo;
                  const fmtCell = (val: number) => {
                    if (visao === 'financeiro') return fmtBRL(val);
                    return fmtN(val);
                  };
                  const valField = visao === 'financeiro' ? 'total' : visao === 'volume' ? 'quantidade' : 'clientes';
                  const rowBg = isSelected ? `${BI.teal}12` : 'transparent';
                  const nameBg = isSelected ? `${BI.teal}18` : BI.panel;

                  return (
                    <>
                      {/* Valores (faturamento ou volume) */}
                      <tr key={`${ind.codigo}-val`}
                        style={{ borderBottom: `1px solid ${BI.border}18`, background: rowBg }}>
                        <td rowSpan={2}
                          onClick={() => setFilters({ for_codigo: isSelected ? null : ind.codigo })}
                          style={{
                            padding: '6px 8px', fontWeight: 700,
                            color: isSelected ? BI.teal : BI.text,
                            position: 'sticky', left: 0,
                            background: nameBg,
                            zIndex: 1,
                            borderBottom: `1px solid ${BI.border}40`,
                            borderLeft: isSelected ? `3px solid ${BI.teal}` : '3px solid transparent',
                            fontSize: 11,
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s',
                          }}>
                          {ind.nome}
                        </td>
                        <td style={{
                          padding: '4px 8px', fontSize: 9, fontWeight: 600,
                          color: BI.teal, textTransform: 'uppercase',
                          background: rowBg,
                        }}>
                          {visao === 'financeiro' ? 'Faturamento' : visao === 'volume' ? 'Quantidades' : 'SKUs'}
                        </td>
                        {fatPivot.meses.map(m => {
                          const cell = fatPivot.matrix.get(`${ind.codigo}-${m}`);
                          const val = cell ? (cell as any)[valField] : 0;
                          const mesActive = filters.meses.includes(m);
                          return (
                            <td key={m}
                              onClick={() => {
                                setFilters({ for_codigo: isSelected ? null : ind.codigo });
                                if (!isSelected) toggleMes(m);
                              }}
                              style={{
                                padding: '4px 8px', textAlign: 'right',
                                fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
                                color: val > 0 ? BI.text : BI.textMuted,
                                background: mesActive ? `${BI.info}12` : rowBg,
                                cursor: val > 0 ? 'pointer' : 'default',
                                transition: 'background 0.15s',
                              }}>
                              {val > 0 ? fmtCell(val) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                      {/* Clientes atendidos */}
                      <tr key={`${ind.codigo}-cli`}
                        style={{ borderBottom: `1px solid ${BI.border}40`, background: rowBg }}>
                        <td style={{
                          padding: '4px 8px', fontSize: 9, fontWeight: 600,
                          color: BI.textMuted, textTransform: 'uppercase',
                          background: rowBg,
                        }}>Clientes</td>
                        {fatPivot.meses.map(m => {
                          const cell = fatPivot.matrix.get(`${ind.codigo}-${m}`);
                          const cli = cell ? cell.clientes : 0;
                          const mesActive = filters.meses.includes(m);
                          return (
                            <td key={m} style={{
                              padding: '4px 8px', textAlign: 'right',
                              fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
                              color: cli > 0 ? BI.info : BI.textMuted,
                              background: mesActive ? `${BI.info}12` : rowBg,
                            }}>
                              {cli > 0 ? cli : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardWrap>

    </div>
  );
};

export default EstatisticasTab;
