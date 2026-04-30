import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Info } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtK, fmtN, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';
import { InsightNarrative } from '../components/InsightNarrative';
import { TopIndustriasWheel } from '../components/TopIndustriasWheel';
import { MetasMensalTable } from '../components/MetasMensalTable';
import { SparkLine } from '../components/SparkLine';
import { DrillDownChart } from '../components/DrillDownChart';

const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const SLabel = ({ label, accent }: { label: string; accent?: string }) => (
  <p className="text-xs font-black uppercase tracking-widest mb-3"
    style={{ color: accent ?? BI.textMuted }}>{label}</p>
);

const CardWrap = ({
  children, accent, style = {},
}: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) => (
  <div className="rounded-2xl"
    style={{
      padding: '20px 20px 16px',
      background: BI.panel, border: `1px solid ${BI.border}`,
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

const EmptyState = ({ small }: { small?: boolean }) => (
  <div className="flex flex-col items-center justify-center gap-2"
    style={{ padding: small ? '16px 0' : '32px 0' }}>
    <Info size={small ? 18 : 22} style={{ color: BI.textMuted }} />
    <p className="text-sm font-bold" style={{ color: BI.textMuted }}>
      Sem dados para o período
    </p>
  </div>
);

// ─── IndustriasTab ─────────────────────────────────────────────────────────────
const IndustriasTab = () => {
  const { filters, setFilters, visao } = useBIStore();
  const p = buildBIParams(filters);

  // Alias: selectedFor = filtro global de indústria
  const selectedFor = filters.for_codigo;
  const setSelectedFor = (v: number | null | ((prev: number | null) => number | null)) => {
    if (typeof v === 'function') {
      setFilters({ for_codigo: v(filters.for_codigo) });
    } else {
      setFilters({ for_codigo: v });
    }
  };

  // ── Data state ────────────────────────────────────────────────────────────
  const [mktShare,     setMktShare]     = useState<any[]>([]);
  const [metasMensal,  setMetasMensal]  = useState<{ data: any[]; ano?: number }>({ data: [] });
  const [positivacao,  setPositivacao]  = useState<any[]>([]);
  const [ticketMedio,  setTicketMedio]  = useState<any[]>([]);
  const [mixCat,       setMixCat]       = useState<any[]>([]);
  const [monthly,      setMonthly]      = useState<any[]>([]);
  const [ativacao,     setAtivacao]     = useState<any[]>([]);

  const [loadMkt,  setLoadMkt]  = useState(true);
  const [loadMeta, setLoadMeta] = useState(true);
  const [loadPos,  setLoadPos]  = useState(true);
  const [loadTkt,  setLoadTkt]  = useState(true);
  const [loadMix,  setLoadMix]  = useState(true);
  const [loadMon,  setLoadMon]  = useState(true);
  const [loadAtv,  setLoadAtv]  = useState(true);
  useEffect(() => {
    setLoadMkt(true);
    api.get(`/bi/market-share?${p}&metrica=${visao}`)
      .then(r => r.data.success && setMktShare(r.data.data || []))
      .catch(console.error).finally(() => setLoadMkt(false));
  }, [p, visao]);

  useEffect(() => {
    setLoadMeta(true);
    api.get(`/bi/metas-mensal?${p}`)
      .then(r => r.data.success && setMetasMensal({ data: r.data.data || [], ano: r.data.meta?.ano }))
      .catch(console.error).finally(() => setLoadMeta(false));
  }, [p]);

  useEffect(() => {
    setLoadPos(true);
    api.get(`/bi/positivacao?${p}`)
      .then(r => r.data.success && setPositivacao(r.data.data || []))
      .catch(console.error).finally(() => setLoadPos(false));
  }, [p]);

  useEffect(() => {
    setLoadTkt(true);
    api.get(`/bi/ticket-medio-industrias?${p}`)
      .then(r => r.data.success && setTicketMedio(r.data.data || []))
      .catch(console.error).finally(() => setLoadTkt(false));
  }, [p]);

  useEffect(() => {
    setLoadMix(true);
    api.get(`/bi/mix-categorias?${p}`)
      .then(r => r.data.success && setMixCat(r.data.data || []))
      .catch(console.error).finally(() => setLoadMix(false));
  }, [p]);

  useEffect(() => {
    setLoadMon(true);
    api.get(`/bi/monthly?${p}`)
      .then(r => r.data.success && setMonthly(r.data.data || []))
      .catch(console.error).finally(() => setLoadMon(false));
  }, [p]);

  useEffect(() => {
    setLoadAtv(true);
    api.get(`/bi/ativacao-clientes?${p}`)
      .then(r => r.data.success && setAtivacao(r.data.data || []))
      .catch(console.error).finally(() => setLoadAtv(false));
  }, [p]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selIndNome = selectedFor
    ? mktShare.find(d => d.for_codigo === selectedFor)?.nome ?? null
    : null;

  // Série mensal do ano principal — usada nas sparklines dos KPI cards
  const sparkSeries = useMemo(() => {
    if (!monthly.length) return Array(12).fill(0);
    const anoMax = Math.max(...filters.anos);
    const serie  = monthly.find((m: any) => m.ano === anoMax);
    return Array.from({ length: 12 }, (_, i) => {
      const f = serie?.series?.find((r: any) => r.mes === i + 1);
      return f ? parseFloat(f.total) : 0;
    });
  }, [monthly, filters.anos]);

  const kpiCards = useMemo(() => {
    if (!mktShare.length) return null;
    const top6 = mktShare.slice(0, 6);
    const ldr  = mktShare[0];

    let gt: number, conc: number, ldrPct: number, kpiLabel: string, kpiValue: string;
    if (visao === 'volume') {
      gt       = top6.reduce((s, d) => s + (parseFloat(d.quantidade) || 0), 0);
      conc     = top6.reduce((s, d) => s + (parseFloat(d.pct_qtd)    || 0), 0);
      ldrPct   = parseFloat(ldr.pct_qtd) || 0;
      kpiLabel = 'Vol. Top 6';
      kpiValue = fmtN(gt);
    } else if (visao === 'skus') {
      gt       = top6.reduce((s, d) => s + (parseInt(d.skus)         || 0), 0);
      conc     = top6.reduce((s, d) => s + (parseFloat(d.pct_skus)   || 0), 0);
      ldrPct   = parseFloat(ldr.pct_skus) || 0;
      kpiLabel = 'SKUs Top 6';
      kpiValue = fmtN(gt);
    } else {
      gt       = top6.reduce((s, d) => s + parseFloat(d.total), 0);
      conc     = top6.reduce((s, d) => s + parseFloat(d.pct_total),  0);
      ldrPct   = parseFloat(ldr.pct_total);
      kpiLabel = 'Fat. Top 6';
      kpiValue = fmtK(gt);
    }

    return [
      { label: kpiLabel,        value: kpiValue,                                 sub: `${conc.toFixed(0)}% do total`,  color: BI.teal                   },
      { label: 'Concentração',  value: `${conc.toFixed(0)}%`,                   sub: 'top 6 dominam',                 color: BI.blue                   },
      { label: 'Líder',         value: ldr.nome.split(' ').slice(0, 2).join(' '), sub: `${ldrPct.toFixed(1)}%`,         color: CHART_COLORS[0] as string },
    ];
  }, [mktShare, visao]);

  // metasMensal — used directly in render (no chart option needed)

  // ── ECharts: Positivação horizontal bars ──────────────────────────────────
  const positivacaoOption = useMemo(() => {
    if (!positivacao.length) return null;
    const items = positivacao.slice(0, 12);
    const nomes = items.map(d => d.nome.length > 22 ? d.nome.substring(0, 20) + '…' : d.nome);
    const vals  = items.map(d => parseFloat(d.positivacao_pct));

    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 8, bottom: 8, left: 8, right: 70, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any[]) => {
          const i = params[0].dataIndex;
          const d = positivacao[items.length - 1 - i];
          return `<div style="font-weight:800;font-size:13px;margin-bottom:6px;">${d.nome}</div>
            <div style="color:${BI.textSec};font-size:11px;">Positivação: <b style="color:${BI.teal}">${parseFloat(d.positivacao_pct).toFixed(1)}%</b></div>
            <div style="color:${BI.textSec};font-size:11px;">Clientes: <b style="color:${BI.text}">${d.clientes} / ${d.total_clientes}</b></div>
            <div style="color:${BI.textSec};font-size:11px;">Faturamento: <b style="color:${BI.text};font-family:monospace">${fmtBRL(parseFloat(d.total))}</b></div>`;
        },
      },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: {
        type: 'category', data: [...nomes].reverse(),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: BI.textSec, fontSize: 10 },
      },
      series: [{
        type: 'bar',
        data: [...vals].reverse().map((v, i) => ({
          value: v,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: `${CHART_COLORS[(items.length - 1 - i) % CHART_COLORS.length]}80` },
                { offset: 1, color: CHART_COLORS[(items.length - 1 - i) % CHART_COLORS.length] as string },
              ] },
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barMaxWidth: 18,
        label: { show: true, position: 'right', formatter: '{c}%', color: BI.textSec, fontSize: 10, fontWeight: 700 },
      }],
    };
  }, [positivacao]);

  // ── ECharts: Tendência Mensal YoY ─────────────────────────────────────────
  const monthlyOption = useMemo(() => {
    if (!monthly.length) return null;
    const anoMax = Math.max(...filters.anos);
    const anoMin = filters.anos.length === 2 ? Math.min(...filters.anos) : null;
    const serieA = monthly.find((m: any) => m.ano === anoMax);
    const serieB = anoMin ? monthly.find((m: any) => m.ano === anoMin) : null;

    const dataA = Array.from({ length: 12 }, (_, i) => {
      const f = serieA?.series?.find((r: any) => r.mes === i + 1);
      return f ? parseFloat(f.total) : 0;
    });
    const dataB = serieB ? Array.from({ length: 12 }, (_, i) => {
      const f = serieB.series?.find((r: any) => r.mes === i + 1);
      return f ? parseFloat(f.total) : 0;
    }) : null;

    const selColor = selectedFor
      ? CHART_COLORS[mktShare.findIndex(d => d.for_codigo === selectedFor) % CHART_COLORS.length] as string
      : BI.teal;

    const series: any[] = [{
      name: String(anoMax), type: 'line', data: dataA, smooth: true, symbol: 'circle', symbolSize: 6,
      lineStyle: { color: selColor, width: 2.5 }, itemStyle: { color: selColor },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: `${selColor}35` }, { offset: 1, color: `${selColor}00` }] } },
    }];
    if (dataB) series.push({
      name: String(anoMin), type: 'line', data: dataB, smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { color: BI.purple, width: 2, type: 'dashed' }, itemStyle: { color: BI.purple },
    });

    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 18, bottom: 28, left: 58, right: 12 },
      tooltip: {
        trigger: 'axis', backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 13],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any[]) => {
          const mes = MES[params[0].dataIndex + 1];
          let html = `<b style="font-size:13px;">${mes}</b><br/>`;
          params.forEach(pp => {
            if (!pp.value) return;
            html += `<div style="display:flex;justify-content:space-between;gap:14px;margin-top:4px;">
              <span style="color:${BI.textSec};font-size:11px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${pp.color};margin-right:5px;"></span>${pp.seriesName}</span>
              <span style="color:${BI.text};font-weight:700;font-size:12px;font-family:monospace;">${fmtBRL(pp.value)}</span>
            </div>`;
          });
          return html;
        },
      },
      legend: { show: !!dataB, textStyle: { color: BI.textSec, fontSize: 11 }, top: 0 },
      xAxis: { type: 'category', data: MES.slice(1),
        axisLine: { lineStyle: { color: BI.border } },
        axisLabel: { color: BI.textMuted, fontSize: 10 }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLine: { show: false },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } },
        axisLabel: { color: BI.textMuted, fontSize: 10, formatter: (v: number) => fmtK(v) } },
      series,
    };
  }, [monthly, filters.anos, selectedFor, mktShare]);

  // ── ECharts: Mix Grupos Heatmap ──────────────────────────────────────────
  const heatmapOption = useMemo(() => {
    if (!mixCat.length) return null;
    const clientesSet = new Set<string>();
    const gruposSet   = new Set<string>();
    mixCat.forEach(d => { clientesSet.add(d.cliente); gruposSet.add(d.grupo); });
    const clientes = Array.from(clientesSet);
    const grupos   = Array.from(gruposSet);
    const maxVal   = Math.max(...mixCat.map(d => parseFloat(d.total)));

    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 12, bottom: 60, left: 12, right: 12, containLabel: true },
      tooltip: {
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any) => {
          const [gi, ci, v] = params.data as number[];
          return `<div style="font-weight:800;margin-bottom:5px;">${clientes[ci]}</div>
            <div style="color:${BI.textSec};font-size:11px;">Grupo: <b style="color:${BI.text}">${grupos[gi]}</b></div>
            <div style="color:${BI.textSec};font-size:11px;font-family:monospace;margin-top:3px;">${fmtBRL(v)}</div>`;
        },
      },
      xAxis: { type: 'category', data: grupos,
        axisLabel: { color: BI.textSec, fontSize: 9, rotate: 28, interval: 0 },
        axisLine: { lineStyle: { color: BI.border } }, splitLine: { show: false } },
      yAxis: { type: 'category',
        data: clientes.map(c => c.length > 18 ? c.substring(0, 16) + '…' : c),
        axisLabel: { color: BI.textSec, fontSize: 9 },
        axisLine: { show: false }, axisTick: { show: false } },
      visualMap: { min: 0, max: maxVal, show: false,
        inRange: { color: [`${BI.teal}14`, `${BI.teal}70`, BI.teal] } },
      series: [{ type: 'heatmap', data: mixCat.map(d => [
        grupos.indexOf(d.grupo), clientes.indexOf(d.cliente), parseFloat(d.total),
      ]),
        itemStyle: { borderColor: BI.panel, borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: `${BI.teal}60` } } }],
    };
  }, [mixCat]);

  // ── ECharts: Ticket Médio × Volume (Bubble) ───────────────────────────────
  const bubbleOption = useMemo(() => {
    if (!ticketMedio.length) return null;
    const maxTotal = Math.max(...ticketMedio.map(d => parseFloat(d.total)));
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 20, bottom: 42, left: 70, right: 20 },
      tooltip: {
        trigger: 'item', backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any) => {
          const d = params.data;
          return `<div style="font-weight:800;font-size:13px;margin-bottom:6px;">${d.name}</div>
            <div style="color:${BI.textSec};font-size:11px;">Ticket médio: <b style="color:${BI.text};font-family:monospace">${fmtBRL(d.value[1])}</b></div>
            <div style="color:${BI.textSec};font-size:11px;">Pedidos: <b style="color:${BI.text}">${d.value[0]}</b></div>
            <div style="color:${BI.textSec};font-size:11px;">Faturamento: <b style="color:${BI.text};font-family:monospace">${fmtK(d.value[2])}</b></div>`;
        },
      },
      xAxis: { name: 'Nº de Pedidos', nameTextStyle: { color: BI.textMuted, fontSize: 10 },
        nameLocation: 'middle', nameGap: 28, type: 'value',
        axisLabel: { color: BI.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: BI.border } },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } } },
      yAxis: { name: 'Ticket Médio', nameTextStyle: { color: BI.textMuted, fontSize: 10 },
        nameLocation: 'middle', nameGap: 58, type: 'value',
        axisLabel: { color: BI.textMuted, fontSize: 10, formatter: (v: number) => fmtK(v) },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } } },
      series: [{
        type: 'scatter',
        data: ticketMedio.map((d, i) => ({
          name: d.nome,
          value: [parseInt(d.pedidos), parseFloat(d.ticket_medio), parseFloat(d.total)],
          symbolSize: Math.max(14, Math.round(Math.sqrt(parseFloat(d.total) / maxTotal) * 64)),
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] as string, opacity: 0.78 },
          label: {
            show: true,
            formatter: (pp: any) => pp.data.name.split(' ').slice(0, 2).join(' '),
            position: 'top', fontSize: 9, color: BI.textSec,
          },
        })),
        emphasis: { scale: true },
      }],
    };
  }, [ticketMedio]);


  // ── ECharts: Ativação Heatmap ─────────────────────────────────────────────
  const atividadeOption = useMemo(() => {
    if (!ativacao.length) return null;

    // Build ordered unique lists from data (clients already sorted by revenue)
    const seenCli = new Set<string>();
    const seenInd = new Map<number, string>();
    ativacao.forEach(d => {
      seenCli.add(d.cliente);
      seenInd.set(d.industria_codigo, d.industria);
    });
    const clientes  = Array.from(seenCli);
    const industrias = Array.from(seenInd.entries()).map(([codigo, nome]) => ({ codigo, nome }));

    // Build activation set for O(1) lookup
    const bought = new Set(ativacao.map(d => `${d.cliente}|${d.industria_codigo}`));

    // Build full matrix — 1 = comprou, 0 = não comprou
    const heatData: [number, number, number][] = [];
    clientes.forEach((cli, ci) => {
      industrias.forEach((ind, ii) => {
        heatData.push([ii, ci, bought.has(`${cli}|${ind.codigo}`) ? 1 : 0]);
      });
    });

    const cliLabels = clientes.map(c => c.length > 22 ? c.substring(0, 20) + '…' : c);

    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 12, bottom: 60, left: 12, right: 12, containLabel: true },
      tooltip: {
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any) => {
          const [ii, ci, v] = params.data as number[];
          const status = v ? `<b style="color:${BI.success}">Comprou</b>` : `<span style="color:${BI.textMuted}">Não comprou</span>`;
          return `<div style="font-weight:800;margin-bottom:4px;">${clientes[ci]}</div>
            <div style="font-size:11px;color:${BI.textSec}">${industrias[ii].nome}</div>
            <div style="margin-top:6px;font-size:12px;">${status}</div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: industrias.map(i => i.nome.length > 14 ? i.nome.substring(0, 12) + '…' : i.nome),
        axisLabel: { color: BI.textSec, fontSize: 9, rotate: 32, interval: 0 },
        axisLine: { lineStyle: { color: BI.border } }, splitLine: { show: false },
      },
      yAxis: {
        type: 'category', data: cliLabels,
        axisLabel: { color: BI.textSec, fontSize: 9 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      visualMap: {
        min: 0, max: 1, show: false,
        inRange: { color: [`${BI.border}`, `${BI.success}`] },
      },
      series: [{
        type: 'heatmap', data: heatData,
        itemStyle: { borderColor: BI.pageBg, borderWidth: 2, borderRadius: 4 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: `${BI.success}50` } },
      }],
    };
  }, [ativacao]);


  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">



      {/* ══ DRILL-DOWN ══════════════════════════════════════════════════════ */}
      <DrillDownChart />

      {/* ══ HERO — dark dramatic banner ══════════════════════════════════════ */}
      <div style={{
        borderRadius: 20,
        padding: '26px 28px 28px',
        background: `linear-gradient(160deg, ${BI.pageBg} 0%, ${BI.panel} 60%, ${BI.panelHi} 100%)`,
        border: `1px solid ${BI.borderStrong}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid texture */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.032 }}>
          <defs>
            <pattern id="itGrid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0L0 0 0 48" fill="none" stroke="#AAB7B7" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#itGrid)" />
        </svg>
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: -80, left: -80, width: 280, height: 280, borderRadius: '50%',
          background: `radial-gradient(circle, ${BI.tealGlow} 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 220, height: 220, borderRadius: '50%',
          background: `radial-gradient(circle, ${BI.accentSoft} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        {/* Hero headline */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: BI.teal, letterSpacing: '0.18em',
            textTransform: 'uppercase', marginBottom: 3 }}>Análise de Desempenho</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: BI.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Top 6 Indústrias
            {selIndNome && <span style={{ fontSize: 13, fontWeight: 600, color: BI.textSec, marginLeft: 10 }}>· {selIndNome}</span>}
            <span style={{ fontSize: 11, fontWeight: 600, color: BI.textMuted, marginLeft: 10 }}>
              {visao === 'financeiro' ? '· Faturamento' : visao === 'volume' ? '· Volume (Qtd)' : '· Unidades (SKU)'}
            </span>
          </p>
        </div>

        {/* ── 2-col: Wheel (left) | KPI cards (right) ── */}
        <div style={{ display: 'flex', gap: 24, position: 'relative', zIndex: 1, alignItems: 'flex-start' }}>

          {/* LEFT COLUMN: Wheel */}
          <div style={{ flexShrink: 0 }}>
            {loadMkt
              ? <div style={{ width: 512 }}><SkeletonCard height={320} /></div>
              : !mktShare.length
                ? <EmptyState />
                : (
                  <TopIndustriasWheel
                    data={mktShare}
                    selected={selectedFor}
                    onSelect={setSelectedFor}
                    compact
                    visao={visao}
                  />
                )
            }
          </div>

          {/* RIGHT COLUMN: 3 KPI cards */}
          {kpiCards && (
            <div style={{
              flex: 1, minWidth: 0,
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
              alignContent: 'start',
            }}>
              {kpiCards.map((kpi, i) => (
                <div key={i} style={{
                  borderRadius: 12,
                  padding: '12px 14px 0',
                  background: BI.panelHi,
                  border: `1px solid ${BI.border}`,
                  borderTop: `2px solid ${kpi.color}`,
                  boxShadow: BI.shadowCard,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: BI.textMuted,
                    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {kpi.label}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: BI.text,
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", lineHeight: 1, marginBottom: 2 }}>
                    {kpi.value}
                  </p>
                  <p style={{ fontSize: 11, color: kpi.color, fontWeight: 500, marginBottom: 6 }}>
                    {kpi.sub}
                  </p>
                  <div style={{ marginLeft: -14, marginRight: -14 }}>
                    <SparkLine data={sparkSeries} color={kpi.color} height={52} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 1: Positivação + Tendência YoY ═══════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4">
        <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.blue})`}>
          <SLabel label="Índice de Positivação por Indústria" accent={BI.teal} />
          <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
            % da base de clientes ativos que comprou cada indústria no período
          </p>
          {loadPos
            ? <SkeletonCard height={280} />
            : !positivacaoOption
              ? <EmptyState />
              : <ReactECharts option={positivacaoOption} style={{ height: 280 }} opts={{ renderer: 'canvas' }} />
          }
        </CardWrap>

        <CardWrap accent={`linear-gradient(90deg, ${BI.blue}, ${BI.purple})`}>
          <SLabel label={selIndNome ? `Tendência Mensal · ${selIndNome}` : 'Tendência de Faturamento (YoY)'} accent={BI.blue} />
          <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
            Faturamento mês a mês · selecione 2 anos no filtro para comparação YoY
          </p>
          {loadMon
            ? <SkeletonCard height={280} />
            : !monthlyOption
              ? <EmptyState />
              : <ReactECharts option={monthlyOption} style={{ height: 280 }} opts={{ renderer: 'canvas' }} />
          }
        </CardWrap>
      </div>

      {/* ══ Mix de Grupos — linha completa ═══════════════════════════════════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.purple}, ${BI.teal})`}>
        <SLabel label="Mix de Grupos por Cliente" accent={BI.purple} />
        <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
          Top 10 clientes × top grupos de produto — identifique lacunas no pedido
        </p>
        {loadMix
          ? <SkeletonCard height={300} />
          : !heatmapOption
            ? <EmptyState />
            : <ReactECharts option={heatmapOption} style={{ height: 300 }} opts={{ renderer: 'canvas' }} />
        }
      </CardWrap>

      {/* ══ Ativação Clientes × Indústrias — linha completa ══════════════════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.success}, ${BI.teal})`} style={{ display: 'flex', flexDirection: 'column' }}>
        <SLabel label="Ativação Clientes × Indústrias" accent={BI.success} />
        <p className="text-xs mb-2.5 -mt-1.5" style={{ color: BI.textMuted }}>
          Verde = comprou · cinza = oportunidade
        </p>
        {loadAtv
          ? <SkeletonCard height={300} />
          : !atividadeOption
            ? <EmptyState />
            : <ReactECharts option={atividadeOption} style={{ height: 300 }} opts={{ renderer: 'canvas' }} />
        }
      </CardWrap>

      {/* ══ ROW 3: Ticket Médio × Volume (Bubble) ════════════════════════════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.warning}, #F97316)`}>
        <SLabel label="Ticket Médio por Indústria × Volume de Pedidos" accent={BI.warning} />
        <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
          Bolha = faturamento total · eixo X = nº de pedidos · eixo Y = ticket médio por pedido
        </p>
        {loadTkt
          ? <SkeletonCard height={280} />
          : !bubbleOption
            ? <EmptyState />
            : <ReactECharts option={bubbleOption} style={{ height: 280 }} opts={{ renderer: 'canvas' }} />
        }
      </CardWrap>

      {/* ══ MAPA DE METAS — linha completa · ao final ════════════════════════ */}
      <div style={{
        borderRadius: 14, padding: '16px 16px 12px',
        background: BI.panel,
        border: `1px solid ${BI.border}`,
        borderTop: `2px solid ${BI.success}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: BI.success,
              letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 3 }}>
              Mapa de Metas
            </p>
            <p style={{ fontSize: 13, fontWeight: 800, color: BI.text, lineHeight: 1.2 }}>
              Realizado × Meta × Ano Ant.
              {metasMensal.ano && (
                <span style={{ fontSize: 10, fontWeight: 600, color: BI.textMuted, marginLeft: 6 }}>
                  {metasMensal.ano}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            {[
              { color: BI.success, label: '≥100%' },
              { color: BI.warning, label: '80–99%' },
              { color: BI.danger,  label: '<80%'  },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 9, color: BI.textMuted }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {loadMeta
          ? <SkeletonCard lines={10} />
          : !metasMensal.data.length
            ? <EmptyState small />
            : (
              <MetasMensalTable
                data={selectedFor
                  ? metasMensal.data.filter((r: any) => r.industria_codigo === selectedFor)
                  : metasMensal.data}
                ano={metasMensal.ano ?? new Date().getFullYear()}
              />
            )
        }
      </div>

    </div>
  );
};

export default IndustriasTab;
