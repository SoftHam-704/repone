import { useEffect, useState, useMemo } from 'react';
import { Info, TrendingDown, TrendingUp, Minus, X, Filter } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';
import ComparativoAnual from '../components/ComparativoAnual';
import MatrizClientesAnual from '../components/MatrizClientesAnual';

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
  const [ultimaCompra, setUltimaCompra] = useState<any[]>([]);
  const [classProd,    setClassProd]    = useState<any[]>([]);
  const [fatMensal,    setFatMensal]    = useState<any[]>([]);
  const [tresAnos,     setTresAnos]     = useState<{ data: any[]; anos: number[] }>({ data: [], anos: [] });
  const [crossSell,    setCrossSell]    = useState<any[]>([]);
  const [yoy,          setYoy]          = useState<{ data: any[]; anoCurr: number; anoPrev: number; resumo: any }>({ data: [], anoCurr: 0, anoPrev: 0, resumo: { novo: 0, perdido: 0, crescendo: 0, em_queda: 0, estavel: 0 } });

  const [loadR, setLoadR] = useState(true);
  const [loadU, setLoadU] = useState(true);
  const [loadC, setLoadC] = useState(true);
  const [loadF, setLoadF] = useState(true);
  const [load3, setLoad3] = useState(true);
  const [loadX, setLoadX] = useState(true);
  const [loadY, setLoadY] = useState(true);

  // Filtro de status do card YoY (chip toggle)
  const [yoyFilter, setYoyFilter] = useState<'todos' | 'novo' | 'crescendo' | 'em_queda' | 'perdido' | 'estavel'>('todos');

  // ── Fetches ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadR(true);
    api.get(`/bi/stats-resumo?${p}`)
      .then(r => r.data.success && setResumo(r.data.data))
      .catch(console.error).finally(() => setLoadR(false));
  }, [p]);

  useEffect(() => {
    setLoadU(true);
    api.get(`/bi/stats-ultima-compra?${p}&limit=15`)
      .then(r => r.data.success && setUltimaCompra(r.data.data || []))
      .catch(console.error).finally(() => setLoadU(false));
  }, [p]);

  useEffect(() => {
    setLoadC(true);
    api.get(`/bi/stats-classificacao-produtos?${p}&limit=30`)
      .then(r => r.data.success && setClassProd(r.data.data || []))
      .catch(console.error).finally(() => setLoadC(false));
  }, [p]);

  useEffect(() => {
    setLoadF(true);
    api.get(`/bi/stats-fat-industria-mensal?${p}`)
      .then(r => r.data.success && setFatMensal(r.data.data || []))
      .catch(console.error).finally(() => setLoadF(false));
  }, [p]);

  useEffect(() => {
    setLoad3(true);
    api.get(`/bi/stats-3anos-industria?${p}`)
      .then(r => { if (r.data.success) setTresAnos({ data: r.data.data || [], anos: r.data.anos || [] }); })
      .catch(console.error).finally(() => setLoad3(false));
  }, [p]);

  useEffect(() => {
    setLoadX(true);
    api.get(`/bi/stats-cross-sell?${p}`)
      .then(r => r.data.success && setCrossSell(r.data.data || []))
      .catch(console.error).finally(() => setLoadX(false));
  }, [p]);

  useEffect(() => {
    setLoadY(true);
    api.get(`/bi/stats-clientes-yoy?${p}`)
      .then(r => {
        if (r.data.success) setYoy({
          data:    r.data.data || [],
          anoCurr: r.data.anoCurr,
          anoPrev: r.data.anoPrev,
          resumo:  r.data.resumo || { novo: 0, perdido: 0, crescendo: 0, em_queda: 0, estavel: 0 },
        });
      })
      .catch(console.error).finally(() => setLoadY(false));
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
    if (!fatMensal.length) return { industries: [], meses: [], matrix: new Map(), rowTotals: new Map(), colTotals: new Map(), grandTotal: { total: 0, quantidade: 0, clientes: 0 }, maxCell: 0 };

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
    const rowTotals = new Map<number, { total: number; quantidade: number; clientes: number }>();
    const colTotals = new Map<number, { total: number; quantidade: number; clientes: number }>();
    let grandTotal = { total: 0, quantidade: 0, clientes: 0 };
    let maxCell = 0;

    fatMensal.forEach(d => {
      const key = `${d.industria_codigo}-${d.mes}`;
      const total = parseFloat(d.total);
      const quantidade = parseFloat(d.quantidade);
      const clientes = d.clientes;
      matrix.set(key, { total, quantidade, clientes });
      maxCell = Math.max(maxCell, total);

      const r = rowTotals.get(d.industria_codigo) ?? { total: 0, quantidade: 0, clientes: 0 };
      rowTotals.set(d.industria_codigo, { total: r.total + total, quantidade: r.quantidade + quantidade, clientes: Math.max(r.clientes, clientes) });

      const c = colTotals.get(d.mes) ?? { total: 0, quantidade: 0, clientes: 0 };
      colTotals.set(d.mes, { total: c.total + total, quantidade: c.quantidade + quantidade, clientes: c.clientes + clientes });

      grandTotal = { total: grandTotal.total + total, quantidade: grandTotal.quantidade + quantidade, clientes: grandTotal.clientes + clientes };
    });

    return { industries, meses, matrix, rowTotals, colTotals, grandTotal, maxCell };
  }, [fatMensal]);

  // ── Derived: Pivot 3 Anos (linha = indústria, coluna = ano) ───────────────
  const treAnosPivot = useMemo(() => {
    if (!tresAnos.data.length || !tresAnos.anos.length) {
      return { industries: [], anos: [], matrix: new Map(), rowTotal: new Map(), colTotal: new Map(), grandTotal: 0, maxCell: 0 };
    }
    const anosOrd = [...tresAnos.anos].sort((a, b) => a - b);
    type Cell = { total: number; quantidade: number; clientes: number; pedidos: number };
    const indMap = new Map<number, { nome: string; baseTotal: number }>();
    const matrix = new Map<string, Cell>();
    const rowTotal = new Map<number, number>(); // soma 3 anos por indústria
    const colTotal = new Map<number, number>(); // soma todas indústrias por ano
    let grandTotal = 0;
    let maxCell = 0;

    const baseAno = anosOrd[anosOrd.length - 1];

    tresAnos.data.forEach((d: any) => {
      const total = parseFloat(d.total) || 0;
      const ano   = Number(d.ano);
      const codigo = d.industria_codigo;
      const key = `${codigo}-${ano}`;
      matrix.set(key, {
        total,
        quantidade: parseFloat(d.quantidade) || 0,
        clientes:   d.clientes || 0,
        pedidos:    d.pedidos || 0,
      });
      maxCell = Math.max(maxCell, total);
      grandTotal += total;
      rowTotal.set(codigo, (rowTotal.get(codigo) ?? 0) + total);
      colTotal.set(ano,    (colTotal.get(ano) ?? 0) + total);

      const existing = indMap.get(codigo);
      const baseT = ano === baseAno ? total : (existing?.baseTotal ?? 0);
      if (!existing) {
        indMap.set(codigo, { nome: d.industria, baseTotal: baseT });
      } else if (ano === baseAno) {
        existing.baseTotal = total;
      }
    });

    // Ordena por faturamento do ano base (descrescente)
    const industries = Array.from(indMap.entries())
      .sort((a, b) => b[1].baseTotal - a[1].baseTotal)
      .map(([codigo, { nome }]) => ({ codigo, nome }));

    return { industries, anos: anosOrd, matrix, rowTotal, colTotal, grandTotal, maxCell };
  }, [tresAnos]);

  // ── Derived: Cross-Sell matrix (Cliente × Indústria) ──────────────────────
  const crossPivot = useMemo(() => {
    if (!crossSell.length) {
      return { clientes: [], industrias: [], matrix: new Map(), maxCell: 0 };
    }
    const cliMap = new Map<number, { nome: string; total: number }>();
    const indMap = new Map<number, { nome: string; total: number }>();
    const matrix = new Map<string, number>(); // cli-ind → valor
    let maxCell = 0;

    crossSell.forEach((r: any) => {
      const cli = r.cli_codigo as number;
      const ind = r.for_codigo as number;
      const val = parseFloat(r.celula_total) || 0;
      if (!cliMap.has(cli)) cliMap.set(cli, { nome: r.cli_nome, total: parseFloat(r.cli_total) || 0 });
      if (!indMap.has(ind)) indMap.set(ind, { nome: r.for_nome, total: parseFloat(r.for_total) || 0 });
      matrix.set(`${cli}-${ind}`, val);
      if (val > maxCell) maxCell = val;
    });

    const clientes = Array.from(cliMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([codigo, { nome, total }]) => ({ codigo, nome, total }));
    const industrias = Array.from(indMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([codigo, { nome, total }]) => ({ codigo, nome, total }));

    return { clientes, industrias, matrix, maxCell };
  }, [crossSell]);

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

      {/* ══ Comparativo Anual (ano vs ano, mês a mês — valor/qtd) ═══════════════ */}
      <ComparativoAnual />

      {/* ══ Matriz por Cliente · Anual (modelo Target/VIEMAR — lado a lado) ═════ */}
      <MatrizClientesAnual />

      {/* ══ ROW 1: Data Última Compra (left) + Classificação Produtos (right)
            (Curva ABC dedicada na aba "Curva ABC" — removida daqui) ═════════ */}
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

        <CardWrap accent={`linear-gradient(90deg, ${BI.purple}, ${BI.info})`}
          style={{ display: 'flex', flexDirection: 'column' }}>
          <SLabel label="Classificação de Produtos" accent={BI.purple}
            sub="Ranking dinâmico com curva ABC e quantidade vendida" />
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

      {/* ══ ROW 3: Comparativo 3 Anos por Indústria ════════════════════════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.info})`}>
        <SLabel
          label="Comparativo 3 Anos por Indústria"
          accent={BI.teal}
          sub={treAnosPivot.anos.length
            ? `Faturamento ${treAnosPivot.anos[0]} → ${treAnosPivot.anos[treAnosPivot.anos.length - 1]} · ordenado pelo ano mais recente${filters.meses?.length ? ` · recorte ${filters.meses.map(m => MES_LABEL[m]).join(', ')}` : ''}`
            : 'Carregando...'} />
        {load3 ? <SkeletonCard lines={8} /> : !treAnosPivot.industries.length ? <EmptyState /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BI.border}` }}>
                  <th style={{
                    textAlign: 'left', padding: '8px 10px', position: 'sticky', left: 0,
                    background: BI.panel, zIndex: 2, minWidth: 160,
                    color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  }}>Indústria</th>
                  {treAnosPivot.anos.map((ano, idx) => (
                    <>
                      <th key={`y-${ano}`} style={{
                        textAlign: 'right', padding: '8px 10px', minWidth: 100,
                        color: idx === treAnosPivot.anos.length - 1 ? BI.teal : BI.textMuted,
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        background: idx === treAnosPivot.anos.length - 1 ? `${BI.teal}10` : 'transparent',
                      }}>{ano}</th>
                      {idx < treAnosPivot.anos.length - 1 && (
                        <th key={`d-${ano}`} style={{
                          textAlign: 'center', padding: '8px 4px', minWidth: 60,
                          color: BI.textMuted, fontSize: 9, fontWeight: 700,
                        }}>Δ {treAnosPivot.anos[idx + 1] - ano}a</th>
                      )}
                    </>
                  ))}
                  <th style={{
                    textAlign: 'right', padding: '8px 10px', minWidth: 100,
                    color: BI.text, fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                    background: `${BI.teal}18`, borderLeft: `2px solid ${BI.teal}55`,
                  }}>Total 3 anos</th>
                </tr>
              </thead>
              <tbody>
                {treAnosPivot.industries.map(ind => {
                  const cellOf = (ano: number) => treAnosPivot.matrix.get(`${ind.codigo}-${ano}`)?.total ?? 0;
                  return (
                    <tr key={ind.codigo} style={{ borderBottom: `1px solid ${BI.border}30` }}>
                      <td style={{
                        padding: '6px 10px', fontWeight: 700, color: BI.text,
                        position: 'sticky', left: 0, background: BI.panel, zIndex: 1,
                        fontSize: 12,
                      }}>{ind.nome}</td>
                      {treAnosPivot.anos.map((ano, idx) => {
                        const val = cellOf(ano);
                        const heat = val > 0 && treAnosPivot.maxCell > 0
                          ? Math.min(0.95, Math.pow(val / treAnosPivot.maxCell, 0.55)) : 0;
                        const heatAlpha = Math.round(heat * 50).toString(16).padStart(2, '0');
                        const bg = val > 0 ? `${BI.teal}${heatAlpha}` : 'transparent';
                        return (
                          <>
                            <td key={`v-${ano}`} style={{
                              padding: '6px 10px', textAlign: 'right',
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
                              color: val > 0 ? BI.text : BI.textMuted,
                              background: bg,
                              transition: 'background 0.15s',
                            }}>{val > 0 ? fmtBRL(val) : '—'}</td>
                            {idx < treAnosPivot.anos.length - 1 && (() => {
                              const next = cellOf(treAnosPivot.anos[idx + 1]);
                              if (val === 0 && next === 0) return <td key={`d-${ano}`} style={{ padding: '6px 4px', textAlign: 'center', color: BI.textMuted, fontSize: 9 }}>—</td>;
                              if (val === 0)                 return <td key={`d-${ano}`} style={{ padding: '6px 4px', textAlign: 'center', color: BI.success, fontSize: 10, fontWeight: 800 }}>novo</td>;
                              const pct = ((next - val) / val) * 100;
                              const Up = pct > 0;
                              const cor = pct > 0 ? BI.success : pct < 0 ? BI.danger : BI.textMuted;
                              return (
                                <td key={`d-${ano}`} style={{
                                  padding: '6px 4px', textAlign: 'center', color: cor,
                                  fontSize: 10, fontWeight: 800,
                                }}>{Up ? '▲' : pct < 0 ? '▼' : '−'} {Math.abs(pct).toFixed(1)}%</td>
                              );
                            })()}
                          </>
                        );
                      })}
                      <td style={{
                        padding: '6px 10px', textAlign: 'right',
                        fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                        color: BI.teal,
                        background: `${BI.teal}10`,
                        borderLeft: `2px solid ${BI.teal}55`,
                      }}>{fmtBRL(treAnosPivot.rowTotal.get(ind.codigo) ?? 0)}</td>
                    </tr>
                  );
                })}
                {/* Totais */}
                <tr style={{ borderTop: `2px solid ${BI.teal}55`, background: `${BI.teal}10` }}>
                  <td style={{
                    padding: '8px 10px', fontWeight: 900, fontSize: 11,
                    color: BI.teal, textTransform: 'uppercase', letterSpacing: 0.5,
                    position: 'sticky', left: 0, background: `${BI.teal}18`, zIndex: 1,
                  }}>Total / ano</td>
                  {treAnosPivot.anos.map((ano, idx) => (
                    <>
                      <td key={`tv-${ano}`} style={{
                        padding: '8px 10px', textAlign: 'right',
                        fontFamily: 'monospace', fontSize: 12, fontWeight: 900, color: BI.teal,
                      }}>{fmtBRL(treAnosPivot.colTotal.get(ano) ?? 0)}</td>
                      {idx < treAnosPivot.anos.length - 1 && (() => {
                        const cur = treAnosPivot.colTotal.get(ano) ?? 0;
                        const nxt = treAnosPivot.colTotal.get(treAnosPivot.anos[idx + 1]) ?? 0;
                        if (cur === 0) return <td key={`td-${ano}`} style={{ padding: '8px 4px', textAlign: 'center', color: BI.textMuted, fontSize: 9 }}>—</td>;
                        const pct = ((nxt - cur) / cur) * 100;
                        const cor = pct > 0 ? BI.success : pct < 0 ? BI.danger : BI.textMuted;
                        return (
                          <td key={`td-${ano}`} style={{
                            padding: '8px 4px', textAlign: 'center', color: cor,
                            fontSize: 11, fontWeight: 900,
                          }}>{pct > 0 ? '▲' : pct < 0 ? '▼' : '−'} {Math.abs(pct).toFixed(1)}%</td>
                        );
                      })()}
                    </>
                  ))}
                  <td style={{
                    padding: '8px 10px', textAlign: 'right',
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 900,
                    color: BI.teal,
                    background: `${BI.teal}22`,
                    borderLeft: `2px solid ${BI.teal}80`,
                  }}>{fmtBRL(treAnosPivot.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardWrap>

      {/* ══ ROW 4: Cross-Sell — Matriz Cliente × Indústria (oportunidades) ═ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.warning}, ${BI.success})`}>
        <SLabel
          label="Oportunidades de Cross-Sell · Cliente × Indústria"
          accent={BI.warning}
          sub="Linhas com mais lacunas (—) são oportunidades óbvias: cliente compra de várias indústrias mas falta UMA. Top 25 clientes × Top 12 indústrias do recorte." />
        {loadX ? <SkeletonCard lines={10} /> : !crossPivot.clientes.length ? <EmptyState /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BI.border}` }}>
                  <th style={{
                    textAlign: 'left', padding: '8px 10px',
                    position: 'sticky', left: 0, background: BI.panel, zIndex: 2, minWidth: 170,
                    color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  }}>Cliente</th>
                  {crossPivot.industrias.map(ind => (
                    <th key={ind.codigo} style={{
                      textAlign: 'right', padding: '8px 6px', minWidth: 90,
                      color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                    }}>{ind.nome}</th>
                  ))}
                  <th style={{
                    textAlign: 'center', padding: '8px 10px', minWidth: 90,
                    color: BI.warning, fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                    background: `${BI.warning}12`, borderLeft: `2px solid ${BI.warning}55`,
                  }}>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {crossPivot.clientes.map(cli => {
                  const compradas = crossPivot.industrias.filter(ind =>
                    (crossPivot.matrix.get(`${cli.codigo}-${ind.codigo}`) ?? 0) > 0
                  ).length;
                  const totalCols = crossPivot.industrias.length;
                  const pct = totalCols > 0 ? (compradas / totalCols) * 100 : 0;
                  // Cor de cobertura: <50% crítico, <75% atenção, >=75% bom
                  const covColor = pct >= 75 ? BI.success : pct >= 50 ? BI.warning : BI.danger;
                  return (
                    <tr key={cli.codigo} style={{ borderBottom: `1px solid ${BI.border}30` }}>
                      <td style={{
                        padding: '6px 10px', fontWeight: 700, color: BI.text,
                        position: 'sticky', left: 0, background: BI.panel, zIndex: 1,
                        fontSize: 12, whiteSpace: 'nowrap',
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                      }} title={`${cli.nome} · ${fmtBRL(cli.total)} no recorte`}>
                        {cli.nome}
                      </td>
                      {crossPivot.industrias.map(ind => {
                        const val = crossPivot.matrix.get(`${cli.codigo}-${ind.codigo}`) ?? 0;
                        const heat = val > 0 && crossPivot.maxCell > 0
                          ? Math.min(0.85, Math.pow(val / crossPivot.maxCell, 0.55)) : 0;
                        const heatAlpha = Math.round(heat * 50).toString(16).padStart(2, '0');
                        const bg = val > 0 ? `${BI.success}${heatAlpha}` : `${BI.danger}10`;
                        const txtColor = val > 0 ? BI.text : `${BI.danger}99`;
                        return (
                          <td key={ind.codigo} style={{
                            padding: '6px 6px', textAlign: 'right',
                            fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
                            color: txtColor, background: bg,
                            transition: 'background 0.15s',
                          }} title={val > 0 ? `${cli.nome} compra de ${ind.nome}: ${fmtBRL(val)}` : `${cli.nome} NÃO compra de ${ind.nome} — oportunidade`}>
                            {val > 0 ? fmtBRL(val) : '—'}
                          </td>
                        );
                      })}
                      <td style={{
                        padding: '6px 10px', textAlign: 'center',
                        background: `${BI.warning}08`, borderLeft: `2px solid ${BI.warning}40`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <span style={{
                            fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: covColor,
                          }}>{compradas}/{totalCols}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: covColor,
                            padding: '2px 6px', borderRadius: 4,
                            background: `${covColor}18`, border: `1px solid ${covColor}33`,
                          }}>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Legenda */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: BI.textMuted }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: `${BI.success}30`, marginRight: 4, verticalAlign: 'middle' }} /> Compra (com heatmap por valor)</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: `${BI.danger}10`, marginRight: 4, verticalAlign: 'middle' }} /> Lacuna — oportunidade</span>
              <span style={{ color: BI.warning }}>● Cobertura ≥ 75% bom · 50–74% atenção · &lt; 50% crítico</span>
            </div>
          </div>
        )}
      </CardWrap>

      {/* ══ ROW 5: Clientes YoY — ganhos / crescendo / queda / perdidos ════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.success}, ${BI.danger})`}>
        <SLabel
          label={`Movimentação de Clientes · ${yoy.anoPrev || '?'} vs ${yoy.anoCurr || '?'}`}
          accent={BI.success}
          sub={`Cliente classificado pela variação de faturamento ano-a-ano${filters.meses?.length ? ` · recorte ${filters.meses.map(m => MES_LABEL[m]).join(', ')}` : ''}`} />
        {loadY ? <SkeletonCard lines={8} /> : !yoy.data.length ? <EmptyState /> : (
          <>
            {/* KPIs por status — clicáveis pra filtrar a tabela */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" style={{ marginBottom: 14 }}>
              {([
                { key: 'todos',    label: 'Todos',     count: yoy.data.length,        color: BI.textMuted, desc: 'Top 100 maiores variações' },
                { key: 'novo',     label: 'Novos',     count: yoy.resumo.novo,        color: BI.success,   desc: `Só comprou em ${yoy.anoCurr}` },
                { key: 'crescendo',label: 'Crescendo', count: yoy.resumo.crescendo,   color: BI.teal,      desc: '+5% vs ano anterior' },
                { key: 'em_queda', label: 'Em Queda',  count: yoy.resumo.em_queda,    color: BI.warning,   desc: '−5% vs ano anterior' },
                { key: 'perdido',  label: 'Perdidos',  count: yoy.resumo.perdido,     color: BI.danger,    desc: `Só comprou em ${yoy.anoPrev}` },
              ] as const).map(s => {
                const active = yoyFilter === s.key;
                return (
                  <button key={s.key}
                    onClick={() => setYoyFilter(s.key)}
                    style={{
                      borderRadius: 12, padding: '12px 14px',
                      background: active ? `${s.color}22` : `${s.color}08`,
                      border: `1px solid ${active ? `${s.color}80` : `${s.color}22`}`,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                      transform: active ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: active ? `0 4px 16px ${s.color}28` : 'none',
                    }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: BI.text, fontFamily: 'monospace', lineHeight: 1 }}>
                      {s.count}
                    </div>
                    <div style={{ fontSize: 9, color: BI.textMuted, marginTop: 4 }}>
                      {s.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tabela detalhada (filtrada pelo chip ativo) */}
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, background: BI.panel, zIndex: 1 }}>
                  <tr style={{ borderBottom: `1px solid ${BI.border}` }}>
                    <th style={{ textAlign: 'left',  padding: '8px 10px', color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Cliente</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>{yoy.anoPrev}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>{yoy.anoCurr}</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Δ Valor</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: BI.textMuted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {yoy.data
                    .filter((row: any) => yoyFilter === 'todos' || row.status === yoyFilter)
                    .map((row: any) => {
                      const statusMap: any = {
                        novo:      { color: BI.success,   label: 'Novo' },
                        crescendo: { color: BI.teal,      label: 'Crescendo' },
                        em_queda:  { color: BI.warning,   label: 'Em Queda' },
                        perdido:   { color: BI.danger,    label: 'Perdido' },
                        estavel:   { color: BI.textMuted, label: 'Estável' },
                      };
                      const st = statusMap[row.status] ?? statusMap.estavel;
                      const valPrev = parseFloat(row.valor_prev);
                      const valCurr = parseFloat(row.valor_curr);
                      const delta   = valCurr - valPrev;
                      const pct     = row.variacao_pct !== null ? parseFloat(row.variacao_pct) : null;
                      const deltaColor = delta > 0 ? BI.success : delta < 0 ? BI.danger : BI.textMuted;
                      return (
                        <tr key={row.cli_codigo} style={{ borderBottom: `1px solid ${BI.border}25` }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: BI.text, fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.nome}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 9, fontWeight: 800, color: st.color,
                              padding: '2px 8px', borderRadius: 5,
                              background: `${st.color}15`, border: `1px solid ${st.color}30`,
                              textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
                            }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: BI.textSec }}>
                            {valPrev > 0 ? fmtBRL(valPrev) : '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: BI.text, fontWeight: 600 }}>
                            {valCurr > 0 ? fmtBRL(valCurr) : '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: deltaColor, fontWeight: 700 }}>
                            {delta > 0 ? '+' : ''}{fmtBRL(delta)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: deltaColor, fontWeight: 800 }}>
                            {pct === null
                              ? <span style={{ color: BI.success }}>novo</span>
                              : valCurr === 0
                                ? <span style={{ color: BI.danger }}>−100%</span>
                                : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardWrap>

      {/* ══ ROW 6: Faturamento e Clientes por Indústria (matrix mensal) ═════ */}
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
                  <th style={{
                    textAlign: 'right', padding: '6px 10px', minWidth: 90,
                    color: BI.teal, fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                    background: `${BI.teal}15`, borderRadius: 6,
                    borderLeft: `2px solid ${BI.teal}40`,
                  }}>Total</th>
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
                          // Heatmap: intensidade do fundo proporcional ao valor da célula vs maior valor da matrix
                          const heat = val > 0 && fatPivot.maxCell > 0
                            ? Math.min(0.95, Math.pow(val / fatPivot.maxCell, 0.55)) // gamma 0.55 dá realce para valores baixos
                            : 0;
                          const heatAlpha = Math.round(heat * 40).toString(16).padStart(2, '0'); // 0..40 em hex (0..64 alpha)
                          const cellBg = mesActive
                            ? `${BI.info}12`
                            : val > 0 ? `${BI.teal}${heatAlpha}` : rowBg;
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
                                background: cellBg,
                                cursor: val > 0 ? 'pointer' : 'default',
                                transition: 'background 0.15s',
                              }}>
                              {val > 0 ? fmtCell(val) : '—'}
                            </td>
                          );
                        })}
                        {/* Total da linha (valor/qtd/skus conforme visão) */}
                        <td style={{
                          padding: '4px 10px', textAlign: 'right',
                          fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                          color: BI.teal,
                          background: `${BI.teal}12`,
                          borderLeft: `2px solid ${BI.teal}40`,
                        }}>
                          {(() => {
                            const rt = fatPivot.rowTotals.get(ind.codigo);
                            const v  = rt ? (rt as any)[valField] : 0;
                            return v > 0 ? fmtCell(v) : '—';
                          })()}
                        </td>
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
                        {/* Total clientes (máx — clientes únicos) */}
                        <td style={{
                          padding: '4px 10px', textAlign: 'right',
                          fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                          color: BI.info,
                          background: `${BI.teal}12`,
                          borderLeft: `2px solid ${BI.teal}40`,
                        }}>
                          {fatPivot.rowTotals.get(ind.codigo)?.clientes ?? 0}
                        </td>
                      </tr>
                    </>
                  );
                })}
                {/* Total por mês (rodapé) */}
                <tr style={{ borderTop: `2px solid ${BI.teal}55`, background: `${BI.teal}10` }}>
                  <td style={{
                    padding: '8px', fontWeight: 900, fontSize: 11,
                    color: BI.teal, textTransform: 'uppercase', letterSpacing: 0.6,
                    position: 'sticky', left: 0, background: `${BI.teal}18`,
                    zIndex: 1,
                  }}>Total / mês</td>
                  <td style={{ padding: '4px 8px', fontSize: 9, fontWeight: 700, color: BI.teal, textTransform: 'uppercase' }}>
                    {visao === 'financeiro' ? 'Faturamento' : visao === 'volume' ? 'Quantidade' : 'SKUs'}
                  </td>
                  {fatPivot.meses.map(m => {
                    const ct = fatPivot.colTotals.get(m);
                    const v  = ct ? (ct as any)[(visao === 'financeiro' ? 'total' : visao === 'volume' ? 'quantidade' : 'clientes')] : 0;
                    return (
                      <td key={m} style={{
                        padding: '8px', textAlign: 'right',
                        fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: BI.teal,
                      }}>
                        {v > 0 ? (visao === 'financeiro' ? fmtBRL(v) : fmtN(v)) : '—'}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '8px 10px', textAlign: 'right',
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 900, color: BI.teal,
                    background: `${BI.teal}25`,
                    borderLeft: `2px solid ${BI.teal}80`,
                  }}>
                    {visao === 'financeiro'
                      ? fmtBRL(fatPivot.grandTotal.total)
                      : visao === 'volume' ? fmtN(fatPivot.grandTotal.quantidade) : fmtN(fatPivot.grandTotal.clientes)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardWrap>

    </div>
  );
};

export default EstatisticasTab;
