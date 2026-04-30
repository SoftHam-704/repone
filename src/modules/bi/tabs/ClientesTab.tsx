import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Search, Users, TrendingDown, Award, AlertTriangle,
  ChevronDown, ChevronRight, Store,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';
import { InsightNarrative } from '../components/InsightNarrative';

// ─── UI Helpers ───────────────────────────────────────────────────────────────
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

const ABCBadge = ({ curva }: { curva: 'A' | 'B' | 'C' }) => {
  const map = {
    A: { bg: `${BI.teal}20`,      border: `${BI.teal}50`,    color: BI.teal      },
    B: { bg: `${BI.blue}20`,      border: `${BI.blue}50`,    color: BI.blue      },
    C: { bg: `${BI.textMuted}15`, border: `${BI.border}`,    color: BI.textMuted },
  };
  const s = map[curva];
  return (
    <span style={{
      fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
      padding: '2px 6px', borderRadius: 4,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>{curva}</span>
  );
};

const RecenciaDot = ({ dias }: { dias: number }) => {
  const color = dias <= 30 ? BI.success : dias <= 60 ? BI.warning : BI.danger;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace' }}>{dias}d</span>
    </div>
  );
};

// ─── Grupo de Lojas Row (expandable) ─────────────────────────────────────────
interface GrupoLoja {
  rede: string;
  total: string;
  pedidos: number;
  clientes: number;
  industrias: { industria: string; total: string; pedidos: number }[];
}

function GrupoRow({ grupo, maxTotal, rank }: { grupo: GrupoLoja; maxTotal: number; rank: number }) {
  const [open, setOpen] = useState(false);
  const pct = maxTotal > 0 ? (parseFloat(grupo.total) / maxTotal) * 100 : 0;
  const barColor = rank === 0 ? BI.teal : rank === 1 ? BI.blue : rank === 2 ? BI.purple : CHART_COLORS[rank % CHART_COLORS.length];

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ borderBottom: `1px solid ${BI.border}20`, cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = `${BI.teal}06`)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <td style={{ padding: '8px 10px', width: 32, color: BI.textMuted, fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>
          {String(rank + 1).padStart(2, '0')}
        </td>
        <td style={{ padding: '8px 6px', width: 20 }}>
          {open
            ? <ChevronDown size={13} style={{ color: BI.teal }} />
            : <ChevronRight size={13} style={{ color: BI.textMuted }} />}
        </td>
        <td style={{ padding: '8px 10px', color: BI.text, fontWeight: 600, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Store size={12} style={{ color: barColor, flexShrink: 0 }} />
            {grupo.rede}
          </div>
          <div style={{ height: 2, background: `${BI.border}60`, borderRadius: 1, marginTop: 4, width: 160 }}>
            <div style={{ height: '100%', borderRadius: 1, width: `${Math.min(pct, 100)}%`, background: barColor }} />
          </div>
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: BI.text, fontSize: 13, whiteSpace: 'nowrap' }}>
          {fmtBRL(parseFloat(grupo.total))}
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right', color: BI.textSec, fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
          {fmtN(grupo.pedidos)}
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right', color: BI.textSec, fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
          {fmtN(grupo.clientes)}
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right', color: BI.textMuted, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
          {grupo.industrias.length}
        </td>
      </tr>
      {open && grupo.industrias.map((ind, idx) => (
        <tr key={idx} style={{ background: `${BI.panelHi}80`, borderBottom: `1px solid ${BI.border}15` }}>
          <td /><td />
          <td style={{ padding: '5px 10px 5px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: BI.teal, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: BI.textSec }}>{ind.industria}</span>
            </div>
          </td>
          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: BI.teal, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {fmtBRL(parseFloat(ind.total))}
          </td>
          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: BI.textMuted, fontWeight: 600 }}>
            {ind.pedidos}
          </td>
          <td colSpan={2} />
        </tr>
      ))}
    </>
  );
}

// ─── ClientesTab ──────────────────────────────────────────────────────────────
const ClientesTab = () => {
  const { filters, visao } = useBIStore();
  const p = buildBIParams(filters);

  // ── State ─────────────────────────────────────────────────────────────────
  const [ranking,     setRanking]     = useState<any[]>([]);
  const [quedaMom,    setQuedaMom]    = useState<any[]>([]);
  const [gruposLojas, setGruposLojas] = useState<GrupoLoja[]>([]);
  const [cicloData,   setCicloData]   = useState<{ serie: any[]; media_global: number } | null>(null);
  const [recompra,    setRecompra]    = useState<any | null>(null);

  const [loadRank,   setLoadRank]   = useState(true);
  const [loadQueda,  setLoadQueda]  = useState(true);
  const [loadGrupos, setLoadGrupos] = useState(true);
  const [loadCiclo,  setLoadCiclo]  = useState(true);
  const [loadRecomp, setLoadRecomp] = useState(true);

  const [search,  setSearch]  = useState('');
  const [abcFilt, setAbcFilt] = useState<'A' | 'B' | 'C' | null>(null);

  useEffect(() => { setSearch(''); setAbcFilt(null); }, [p, visao]);

  useEffect(() => {
    setLoadRank(true);
    api.get(`/bi/clientes-ranking?${p}&metrica=${visao}`)
      .then(r => r.data.success && setRanking(r.data.data || []))
      .catch(console.error).finally(() => setLoadRank(false));
  }, [p, visao]);

  useEffect(() => {
    setLoadQueda(true);
    api.get(`/bi/clientes-queda-mom?${p}`)
      .then(r => r.data.success && setQuedaMom(r.data.data || []))
      .catch(console.error).finally(() => setLoadQueda(false));
  }, [p]);

  useEffect(() => {
    setLoadGrupos(true);
    api.get(`/bi/grupos-lojas?${p}`)
      .then(r => r.data.success && setGruposLojas(r.data.data || []))
      .catch(console.error).finally(() => setLoadGrupos(false));
  }, [p]);

  useEffect(() => {
    setLoadCiclo(true);
    api.get(`/bi/ciclo-compras?${p}`)
      .then(r => r.data.success && setCicloData(r.data.data))
      .catch(console.error).finally(() => setLoadCiclo(false));
  }, [p]);

  useEffect(() => {
    setLoadRecomp(true);
    api.get(`/bi/media-recompra?${p}`)
      .then(r => r.data.success && setRecompra(r.data.data))
      .catch(console.error).finally(() => setLoadRecomp(false));
  }, [p]);

  // ── KPIs derivados ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!ranking.length) return null;
    const totalClientes   = ranking.length;
    const emRisco         = ranking.filter(c => parseInt(c.dias_sem_comprar) > 30).length;
    const ticketGlobal    = ranking.reduce((s, c) => s + parseFloat(c.total), 0) /
                            Math.max(ranking.reduce((s, c) => s + parseInt(c.pedidos), 0), 1);
    const penetracaoMedia = ranking.reduce((s, c) => s + parseInt(c.num_industrias), 0) / totalClientes;
    const clientesA       = ranking.filter(c => c.curva_abc === 'A').length;
    return { totalClientes, emRisco, ticketGlobal, penetracaoMedia: penetracaoMedia.toFixed(1), clientesA };
  }, [ranking]);

  const filteredRanking = useMemo(() => {
    let rows = ranking;
    if (abcFilt) rows = rows.filter(c => c.curva_abc === abcFilt);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(c => c.nome?.toLowerCase().includes(q));
    }
    return rows;
  }, [ranking, abcFilt, search]);

  // ── ECharts: Curva ABC Donut ──────────────────────────────────────────────
  const abcOption = useMemo(() => {
    if (!ranking.length) return null;
    const groups = { A: 0, B: 0, C: 0 } as Record<string, number>;
    ranking.forEach(c => { groups[c.curva_abc] = (groups[c.curva_abc] || 0) + parseFloat(c.total); });
    const total = Object.values(groups).reduce((s, v) => s + v, 0);
    return {
      animation: true, backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: BI.panel, borderColor: BI.border, borderWidth: 1, borderRadius: 10,
        padding: [10, 14], extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any) => {
          const pct  = ((params.value / total) * 100).toFixed(1);
          const nCli = ranking.filter(c => c.curva_abc === params.name).length;
          const pctCli = ranking.length > 0 ? ((nCli / ranking.length) * 100).toFixed(0) : '0';
          const desc: Record<string, string> = {
            A: 'Top clientes · concentram 70% do faturamento',
            B: 'Clientes médios · entre 70% e 90% acumulado',
            C: 'Demais clientes · abaixo dos 90% acumulados',
          };
          return `<div style="min-width:200px">
            <b style="font-size:13px;color:${params.color}">Curva ${params.name}</b>
            <div style="font-size:10px;color:${BI.textMuted};margin-bottom:8px">${desc[params.name] ?? ''}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="color:${BI.textSec};font-size:11px">Faturamento</span>
              <b style="font-family:monospace;font-size:12px">${fmtBRL(params.value)}</b>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="color:${BI.textSec};font-size:11px">% do total</span>
              <b style="color:${params.color};font-size:12px">${pct}%</b>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:${BI.textSec};font-size:11px">Clientes</span>
              <b style="font-size:12px">${nCli} <span style="color:${BI.textMuted};font-weight:400">(${pctCli}% da base)</span></b>
            </div>
          </div>`;
        },
      },
      legend: {
        orient: 'vertical', right: 0, top: 'center',
        textStyle: { color: BI.textSec, fontSize: 11 },
        formatter: (name: string) => {
          const v = groups[name] || 0;
          const pct = total > 0 ? ((v / total) * 100).toFixed(0) : '0';
          return `${name}  ${pct}%`;
        },
      },
      series: [{
        type: 'pie', radius: ['52%', '80%'], center: ['38%', '50%'],
        avoidLabelOverlap: false, label: { show: false }, emphasis: { label: { show: false } },
        data: [
          { name: 'A', value: groups.A, itemStyle: { color: BI.teal } },
          { name: 'B', value: groups.B, itemStyle: { color: BI.blue } },
          { name: 'C', value: groups.C, itemStyle: { color: BI.textMuted } },
        ],
      }],
    };
  }, [ranking]);

  // ── ECharts: Ciclo Médio de Compras ──────────────────────────────────────
  const cicloOption = useMemo(() => {
    if (!cicloData?.serie?.length) return null;
    const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const labels = cicloData.serie.map((d: any) => `${MES[d.mes]}/${String(d.ano).slice(2)}`);
    const vals   = cicloData.serie.map((d: any) => parseFloat(d.media_ciclo));
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 16, bottom: 36, left: 12, right: 24, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: BI.teal, type: 'dashed' } },
        backgroundColor: BI.panel, borderColor: BI.border, borderWidth: 1, borderRadius: 10,
        padding: [10, 14], extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any[]) => {
          const d    = params[0];
          const diff = cicloData ? +(parseFloat(d.value) - cicloData.media_global).toFixed(1) : 0;
          const vs   = diff === 0 ? 'igual à média' : diff > 0
            ? `<span style="color:${BI.danger}">+${diff}d acima da média</span>`
            : `<span style="color:${BI.success}">${diff}d abaixo da média</span>`;
          const idx  = cicloData?.serie.findIndex((s: any) => `${['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][s.mes]}/${String(s.ano).slice(2)}` === d.name) ?? -1;
          const nTrans = idx >= 0 ? cicloData?.serie[idx]?.n_transicoes ?? '' : '';
          return `<div style="min-width:180px">
            <b style="font-size:13px">${d.name}</b>
            <div style="display:flex;justify-content:space-between;margin:6px 0 3px">
              <span style="color:${BI.textSec};font-size:11px">Ciclo médio</span>
              <b style="color:${BI.teal};font-family:monospace;font-size:13px">${d.value}d</b>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="color:${BI.textSec};font-size:11px">vs. média global (${cicloData?.media_global}d)</span>
              <span style="font-size:11px">${vs}</span>
            </div>
            ${nTrans ? `<div style="color:${BI.textMuted};font-size:10px;margin-top:4px">${nTrans} transições de pedido neste mês</div>` : ''}
          </div>`;
        },
      },
      xAxis: {
        type: 'category', data: labels,
        axisLine: { lineStyle: { color: BI.border } },
        axisLabel: { color: BI.textMuted, fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: BI.textMuted, fontSize: 10, formatter: (v: number) => `${v}d` },
        splitLine: { lineStyle: { color: `${BI.border}50`, type: 'dashed' } },
      },
      series: [{
        type: 'line', data: vals, smooth: true, symbol: 'circle', symbolSize: 6,
        itemStyle: { color: BI.teal }, lineStyle: { color: BI.teal, width: 2.5 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: `${BI.teal}30` }, { offset: 1, color: `${BI.teal}04` }] },
        },
        markLine: {
          silent: true,
          lineStyle: { color: BI.teal, type: 'dashed', width: 1.5, opacity: 0.6 },
          data: [{ yAxis: cicloData.media_global }],
          label: { formatter: `Média: ${cicloData.media_global}d`, color: BI.teal, fontSize: 10, fontWeight: 700 },
        },
      }],
    };
  }, [cicloData]);

  // ── ECharts: Distribuição de Recompra ─────────────────────────────────────
  const recompraOption = useMemo(() => {
    if (!recompra) return null;
    const buckets = [
      { label: '1 pedido', value: recompra.bucket_1,      color: BI.textMuted },
      { label: '2–3',      value: recompra.bucket_2_3,    color: BI.blue      },
      { label: '4–6',      value: recompra.bucket_4_6,    color: BI.purple    },
      { label: '7–12',     value: recompra.bucket_7_12,   color: BI.teal      },
      { label: '12+',      value: recompra.bucket_12plus, color: BI.warning   },
    ];
    const total = buckets.reduce((s, b) => s + (b.value ?? 0), 0);
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 12, bottom: 36, left: 12, right: 12, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border, borderWidth: 1, borderRadius: 10,
        padding: [10, 14], extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any[]) => {
          const i    = params[0].dataIndex;
          const b    = buckets[i];
          const pct  = total > 0 ? ((b.value / total) * 100).toFixed(1) : '0';
          const classif = i === 0
            ? 'Clientes esporádicos — alta prioridade de reativação'
            : i === 1 ? 'Compradores ocasionais'
            : i === 2 ? 'Compradores regulares'
            : i === 3 ? 'Clientes frequentes'
            : 'Clientes altamente fidelizados';
          return `<div style="min-width:200px">
            <b style="font-size:13px;color:${b.color}">${b.label}</b>
            <div style="font-size:10px;color:${BI.textMuted};margin-bottom:8px">${classif}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="color:${BI.textSec};font-size:11px">Clientes</span>
              <b style="font-family:monospace;font-size:12px">${b.value}</b>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:${BI.textSec};font-size:11px">% da base</span>
              <b style="color:${b.color};font-size:12px">${pct}%</b>
            </div>
          </div>`;
        },
      },
      xAxis: {
        type: 'category', data: buckets.map(b => b.label),
        axisLine: { lineStyle: { color: BI.border } },
        axisLabel: { color: BI.textMuted, fontSize: 10 }, axisTick: { show: false },
      },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'bar', barMaxWidth: 48,
        data: buckets.map(b => ({
          value: b.value ?? 0,
          itemStyle: { color: b.color, borderRadius: [6, 6, 0, 0] },
          label: { show: true, position: 'top', color: b.color, fontSize: 11, fontWeight: 700, formatter: `${b.value ?? 0}` },
        })),
      }],
    };
  }, [recompra]);

  // ── Grupos: max para barra de progresso ──────────────────────────────────
  const maxGrupoTotal = useMemo(
    () => gruposLojas.length ? Math.max(...gruposLojas.map(g => parseFloat(g.total))) : 0,
    [gruposLojas],
  );

  // ── Narrativas automáticas ────────────────────────────────────────────────

  const narrativaCarteira = useMemo((): string[] => {
    if (!kpis || loadRank) return [];
    const pctRisco = kpis.totalClientes > 0
      ? ((kpis.emRisco / kpis.totalClientes) * 100).toFixed(0) : '0';
    const lines: string[] = [
      `Carteira ativa: ${fmtN(kpis.totalClientes)} clientes · ${kpis.clientesA} na Curva A (top 70% do faturamento).`,
    ];
    if (kpis.emRisco > 0)
      lines.push(`${fmtN(kpis.emRisco)} clientes (${pctRisco}%) sem pedido há mais de 30 dias — atenção ao risco de churn.`);
    lines.push(`Ticket médio global: ${fmtBRL(kpis.ticketGlobal)} · Penetração média: ${kpis.penetracaoMedia} indústrias/cliente.`);
    return lines;
  }, [kpis, loadRank]);

  const narrativaABC = useMemo((): string[] => {
    if (!ranking.length || loadRank) return [];
    const groups = { A: 0, B: 0, C: 0 } as Record<string, number>;
    ranking.forEach(c => { groups[c.curva_abc] = (groups[c.curva_abc] || 0) + parseFloat(c.total); });
    const grand = Object.values(groups).reduce((s, v) => s + v, 0);
    const nA = ranking.filter(c => c.curva_abc === 'A').length;
    const pctA = grand > 0 ? ((groups.A / grand) * 100).toFixed(0) : '0';
    const lines: string[] = [
      `${nA} cliente(s) na Curva A respondem por ${pctA}% do faturamento total.`,
    ];
    if (nA <= 5)
      lines.push(`Concentração elevada — dependência de poucos clientes é um risco estratégico a monitorar.`);
    else
      lines.push(`Distribuição saudável: a curva A está pulverizada entre ${nA} clientes.`);
    return lines;
  }, [ranking, loadRank]);

  const narrativaQueda = useMemo((): string[] => {
    if (loadQueda) return [];
    if (!quedaMom.length)
      return ['Nenhum cliente com queda de volume no período — carteira estável em relação à média dos últimos 3 meses.'];
    const pior = quedaMom[0];
    const nCriticos = quedaMom.filter(c => parseFloat(c.variacao_pct) <= -40).length;
    const lines: string[] = [
      `${quedaMom.length} cliente(s) com queda de volume versus a média dos 3 meses anteriores.`,
      `Maior queda: ${pior.nome} com ${parseFloat(pior.variacao_pct).toFixed(1)}% — atual ${fmtBRL(parseFloat(pior.total_atual))} vs. média ${fmtBRL(parseFloat(pior.media_3m))}.`,
    ];
    if (nCriticos > 0)
      lines.push(`${nCriticos} cliente(s) com queda acima de 40% — priorizar contato imediato.`);
    return lines;
  }, [quedaMom, loadQueda]);

  const narrativaGrupos = useMemo((): string[] => {
    if (!gruposLojas.length || loadGrupos) return [];
    const top = gruposLojas[0];
    const grand = gruposLojas.reduce((s, g) => s + parseFloat(g.total), 0);
    const pctTop = grand > 0 ? ((parseFloat(top.total) / grand) * 100).toFixed(0) : '0';
    const top3Pct = grand > 0
      ? (gruposLojas.slice(0, 3).reduce((s, g) => s + parseFloat(g.total), 0) / grand * 100).toFixed(0) : '0';
    const maxInd = [...gruposLojas].sort((a, b) => b.industrias.length - a.industrias.length)[0];
    const lines: string[] = [
      `Maior grupo: ${top.rede} com ${fmtBRL(parseFloat(top.total))} (${pctTop}% do faturamento) em ${top.pedidos} pedidos.`,
      `Top 3 grupos concentram ${top3Pct}% do faturamento total da carteira.`,
    ];
    if (maxInd)
      lines.push(`Grupo com maior mix de indústrias: ${maxInd.rede} (${maxInd.industrias.length} indústrias distintas).`);
    return lines;
  }, [gruposLojas, loadGrupos]);

  const narrativaCiclo = useMemo((): string[] => {
    if (!cicloData || loadCiclo) return [];
    const { serie, media_global } = cicloData;
    if (!serie.length) return [];
    const lines: string[] = [
      `Ciclo médio global: ${media_global} dias entre pedidos consecutivos no período.`,
    ];
    if (serie.length >= 2) {
      const ultimo = parseFloat(serie[serie.length - 1].media_ciclo);
      const penultimo = parseFloat(serie[serie.length - 2].media_ciclo);
      const diff = +(ultimo - penultimo).toFixed(1);
      if (Math.abs(diff) >= 2) {
        const tendencia = diff > 0 ? `aumentou ${diff}d (clientes comprando menos frequentemente)` : `reduziu ${Math.abs(diff)}d (frequência aumentando)`;
        lines.push(`Último mês: ${ultimo}d — ciclo ${tendencia} em relação ao mês anterior.`);
      } else {
        lines.push(`Ciclo estável: variação de apenas ${Math.abs(diff)}d no último mês.`);
      }
    }
    if (media_global <= 30)
      lines.push('Frequência alta — clientes com ritmo de compra mensal ou superior.');
    else if (media_global >= 60)
      lines.push('Frequência baixa — oportunidade de ações para aumentar a recorrência.');
    return lines;
  }, [cicloData, loadCiclo]);

  const narrativaRecompra = useMemo((): string[] => {
    if (!recompra || loadRecomp) return [];
    const media = parseFloat(recompra.media);
    const pct1 = recompra.total_clientes > 0
      ? ((recompra.bucket_1 / recompra.total_clientes) * 100).toFixed(0) : '0';
    const pctPlus7 = recompra.total_clientes > 0
      ? (((recompra.bucket_7_12 + recompra.bucket_12plus) / recompra.total_clientes) * 100).toFixed(0) : '0';
    const lines: string[] = [
      `Média de ${media.toFixed(1)} pedidos/cliente no período · mediana ${recompra.mediana} pedido(s).`,
    ];
    if (parseInt(pct1) >= 40)
      lines.push(`${pct1}% dos clientes fizeram apenas 1 pedido — alto potencial de fidelização a explorar.`);
    if (parseInt(pctPlus7) > 0)
      lines.push(`${pctPlus7}% dos clientes fizeram 7 ou mais pedidos — núcleo fiel e recorrente da carteira.`);
    return lines;
  }, [recompra, loadRecomp]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div style={{
        borderRadius: 20, padding: '26px 28px 24px',
        background: `linear-gradient(160deg, ${BI.pageBg} 0%, ${BI.panel} 60%, ${BI.panelHi} 100%)`,
        border: `1px solid ${BI.borderStrong}`, position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.03 }}>
          <defs>
            <pattern id="ctGrid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0L0 0 0 48" fill="none" stroke="#AAB7B7" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ctGrid)" />
        </svg>
        <div style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%',
          background: `radial-gradient(circle, ${BI.tealGlow} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: BI.teal, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>
            Análise de Carteira
          </p>
          <p style={{ fontSize: 20, fontWeight: 900, color: BI.text, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Clientes — Comportamento & Saúde
          </p>
          <InsightNarrative lines={narrativaCarteira} loading={loadRank} type="info" />
        </div>

        <div style={{ display: 'flex', gap: 24, position: 'relative', zIndex: 1, alignItems: 'flex-start' }}>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0, width: 320 }}>
            {[
              { label: 'Clientes Ativos',   value: kpis ? fmtN(kpis.totalClientes) : '—', sub: `${kpis?.clientesA ?? 0} na curva A`,     color: BI.teal,    icon: Users        },
              { label: 'Em Risco (>30d)',    value: kpis ? fmtN(kpis.emRisco) : '—',       sub: 'sem pedido há +30 dias',                  color: BI.danger,  icon: AlertTriangle },
              { label: 'Ticket Médio',       value: kpis ? fmtBRL(kpis.ticketGlobal) : '—', sub: 'por pedido / carteira',                  color: BI.warning, icon: Award         },
              { label: 'Penetração Média',   value: kpis ? `${kpis.penetracaoMedia} ind.` : '—', sub: 'indústrias por cliente',            color: BI.blue,    icon: TrendingDown  },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} style={{
                  borderRadius: 12, padding: '12px 14px 10px',
                  background: BI.panelHi, border: `1px solid ${BI.border}`,
                  borderTop: `2px solid ${k.color}`, boxShadow: BI.shadowCard,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: BI.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k.label}</p>
                    <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${k.color}18`, border: `1px solid ${k.color}30` }}>
                      <Icon size={11} style={{ color: k.color }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: BI.text, fontFamily: 'monospace', lineHeight: 1, marginBottom: 3 }}>{k.value}</p>
                  <p style={{ fontSize: 10, color: k.color, fontWeight: 600 }}>{k.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Ranking table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: BI.textMuted, pointerEvents: 'none' }} />
                <input type="text" placeholder="Buscar cliente…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                    background: BI.panelHi, border: `1px solid ${BI.border}`, borderRadius: 8,
                    color: BI.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {(['A', 'B', 'C', null] as const).map(v => {
                const colors = { A: BI.teal, B: BI.blue, C: BI.textMuted, null: BI.textMuted };
                const isActive = abcFilt === v;
                const color = colors[v ?? 'null'];
                return (
                  <button key={String(v)} onClick={() => setAbcFilt(v)} style={{
                    fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 8,
                    border: `1px solid ${isActive ? color : BI.border}`,
                    background: isActive ? `${color}18` : BI.panelHi,
                    color: isActive ? color : BI.textMuted, cursor: 'pointer',
                  }}>{v ?? 'Todos'}</button>
                );
              })}
            </div>
            {loadRank
              ? <SkeletonCard lines={8} />
              : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }} className="bi-scrollbar">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BI.border}` }}>
                        {['#', 'Cliente', 'ABC', 'Faturamento', 'Pedidos', 'Ticket', 'Recência', 'Ind.'].map(h => {
                          const rightCols = ['Faturamento', 'Pedidos', 'Ticket', 'Recência', 'Ind.'];
                          return (
                            <th key={h} style={{
                              padding: '5px 8px', textAlign: rightCols.includes(h) ? 'right' : 'left',
                              fontSize: 9, fontWeight: 900, color: BI.textMuted, textTransform: 'uppercase',
                              letterSpacing: '0.08em', position: 'sticky', top: 0, background: BI.panel, zIndex: 1,
                            }}>{h}</th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRanking.map((c, i) => (
                        <tr key={c.cli_codigo}
                          style={{ borderBottom: `1px solid ${BI.border}20`, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${BI.teal}06`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {/* # */}
                          <td style={{ padding: '6px 8px', color: BI.textMuted, fontWeight: 700, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {String(i + 1).padStart(2, '0')}
                          </td>
                          {/* Nome */}
                          <td style={{ padding: '6px 8px', maxWidth: 180, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: BI.text, fontWeight: 600, fontSize: 12 }}>
                            {c.nome}
                          </td>
                          {/* ABC */}
                          <td style={{ padding: '6px 8px' }}><ABCBadge curva={c.curva_abc} /></td>
                          {/* Faturamento */}
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: BI.text, fontSize: 13, whiteSpace: 'nowrap' }}>
                            {fmtBRL(parseFloat(c.total))}
                          </td>
                          {/* Pedidos */}
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: BI.textSec, fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                            {c.pedidos}
                          </td>
                          {/* Ticket */}
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: BI.textSec, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {fmtBRL(parseFloat(c.ticket_medio))}
                          </td>
                          {/* Recência */}
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <RecenciaDot dias={parseInt(c.dias_sem_comprar)} />
                          </td>
                          {/* Indústrias */}
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <div style={{ height: 4, width: 40, background: BI.border, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 2,
                                  width: `${Math.min((parseInt(c.num_industrias) / 15) * 100, 100)}%`,
                                  background: parseInt(c.num_industrias) >= 8 ? BI.teal : parseInt(c.num_industrias) >= 4 ? BI.blue : BI.textMuted,
                                }} />
                              </div>
                              <span style={{ fontSize: 13, color: BI.textSec, fontWeight: 700, fontFamily: 'monospace', minWidth: 16 }}>
                                {c.num_industrias}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredRanking.length && (
                    <p style={{ textAlign: 'center', padding: '24px 0', color: BI.textMuted, fontSize: 12 }}>Nenhum cliente encontrado</p>
                  )}
                </div>
              )
            }
          </div>
        </div>
      </div>

      {/* ══ ROW 1: Curva ABC (mantida) + Queda MoM (mantida) ═════════════════ */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>

        {/* Curva ABC — mantida */}
        <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.blue})`}>
          <SLabel label="Curva ABC de Clientes" accent={BI.teal} />
          <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
            Concentração de faturamento — A=top 70%, B=80–90%, C=demais
          </p>
          <InsightNarrative lines={narrativaABC} loading={loadRank} type="info" />
          {loadRank
            ? <SkeletonCard height={180} />
            : !abcOption
              ? <p style={{ color: BI.textMuted, fontSize: 12, padding: '24px 0' }}>Sem dados</p>
              : <ReactECharts option={abcOption} style={{ height: 180 }} opts={{ renderer: 'canvas' }} />
          }
          {!loadRank && kpis && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {(['A', 'B', 'C'] as const).map(abc => {
                const n = ranking.filter(c => c.curva_abc === abc).length;
                const colors = { A: BI.teal, B: BI.blue, C: BI.textMuted };
                return (
                  <div key={abc} style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center',
                    background: `${colors[abc]}10`, border: `1px solid ${colors[abc]}30`,
                  }}>
                    <p style={{ fontSize: 16, fontWeight: 900, color: colors[abc], fontFamily: 'monospace' }}>{n}</p>
                    <p style={{ fontSize: 9, color: BI.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Curva {abc}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardWrap>

        {/* Queda MoM — mantida */}
        <CardWrap accent={`linear-gradient(90deg, ${BI.danger}, #F97316)`}>
          <SLabel label="Queda MoM — Alertas de Volume" accent={BI.danger} />
          <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
            Mês atual vs. média dos 3 meses anteriores
          </p>
          <InsightNarrative
            lines={narrativaQueda} loading={loadQueda}
            type={quedaMom.length === 0 ? 'success' : quedaMom.some(c => parseFloat(c.variacao_pct) <= -40) ? 'alert' : 'info'}
          />
          {loadQueda
            ? <SkeletonCard lines={8} />
            : !quedaMom.length
              ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${BI.success}15`, border: `1px solid ${BI.success}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 18 }}>✓</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: BI.success }}>Sem quedas detectadas</p>
                  <p style={{ fontSize: 10, color: BI.textMuted, textAlign: 'center' }}>
                    Todos os clientes estão com volume igual ou superior
                  </p>
                </div>
              )
              : (
                <div style={{ overflowY: 'auto', maxHeight: 280 }} className="bi-scrollbar">
                  {quedaMom.map((c: any, i: number) => {
                    const vPct = parseFloat(c.variacao_pct);
                    const urgency = vPct <= -40 ? BI.danger : vPct <= -20 ? BI.warning : `${BI.warning}AA`;
                    return (
                      <div key={i} style={{ padding: '8px 10px', borderRadius: 9, marginBottom: 5, background: `${urgency}08`, border: `1px solid ${urgency}20` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: BI.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 2 }}>
                              {c.nome}
                            </p>
                            <p style={{ fontSize: 11, color: BI.textMuted, fontFamily: 'monospace' }}>
                              Atual: <span style={{ color: BI.textSec, fontWeight: 600 }}>{fmtBRL(parseFloat(c.total_atual))}</span>
                              {' · '}
                              Média: <span style={{ color: BI.textSec, fontWeight: 600 }}>{fmtBRL(parseFloat(c.media_3m))}</span>
                            </p>
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 900, color: urgency, fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
                            {vPct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ height: 2, background: BI.border, borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 1, width: `${Math.min(Math.abs(vPct), 100)}%`, background: urgency }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          }
        </CardWrap>
      </div>

      {/* ══ ROW 2: Grupos de Lojas — novo (full width, expandable) ═══════════ */}
      <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.blue})`}>
        <SLabel label="Análise por Grupo de Lojas" accent={BI.teal} />
        <p className="text-xs mb-3 -mt-1.5" style={{ color: BI.textMuted }}>
          Faturamento por rede/grupo — clique para expandir e ver as indústrias compradas
        </p>
        <InsightNarrative lines={narrativaGrupos} loading={loadGrupos} type="info" />
        {loadGrupos
          ? <SkeletonCard lines={8} />
          : !gruposLojas.length
            ? <p style={{ color: BI.textMuted, fontSize: 12, padding: '24px 0' }}>Sem dados no período</p>
            : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }} className="bi-scrollbar">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BI.border}` }}>
                      {['#', '', 'Rede / Grupo', 'Faturamento', 'Pedidos', 'Clientes', 'Ind.'].map(h => (
                        <th key={h} style={{
                          padding: '5px 10px',
                          textAlign: ['Faturamento', 'Pedidos', 'Clientes', 'Ind.'].includes(h) ? 'right' : 'left',
                          fontSize: 9, fontWeight: 900, color: BI.textMuted,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          position: 'sticky', top: 0, background: BI.panel, zIndex: 1,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gruposLojas.map((grupo, i) => (
                      <GrupoRow key={grupo.rede} grupo={grupo} maxTotal={maxGrupoTotal} rank={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </CardWrap>

      {/* ══ ROW 3: Ciclo Médio + Média Recompra — novos ══════════════════════ */}
      <div className="grid grid-cols-2 gap-4">

        <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.purple})`}>
          <SLabel label="Ciclo Médio de Compras" accent={BI.teal} />
          <p className="text-xs mb-2 -mt-1.5" style={{ color: BI.textMuted }}>
            Média de dias entre pedidos consecutivos por mês
          </p>
          <InsightNarrative
            lines={narrativaCiclo} loading={loadCiclo}
            type={cicloData && cicloData.media_global >= 60 ? 'alert' : cicloData && cicloData.media_global <= 30 ? 'success' : 'info'}
          />
          {cicloData?.media_global != null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: BI.teal, fontFamily: 'monospace' }}>
                {cicloData.media_global}
              </span>
              <span style={{ fontSize: 12, color: BI.textMuted }}>dias em média</span>
            </div>
          )}
          {loadCiclo
            ? <SkeletonCard height={200} />
            : !cicloOption
              ? <p style={{ color: BI.textMuted, fontSize: 12, padding: '24px 0' }}>Sem dados suficientes</p>
              : <ReactECharts option={cicloOption} style={{ height: 200 }} opts={{ renderer: 'canvas' }} />
          }
        </CardWrap>

        <CardWrap accent={`linear-gradient(90deg, ${BI.warning}, ${BI.blue})`}>
          <SLabel label="Média de Recompra dos Clientes" accent={BI.warning} />
          <p className="text-xs mb-2 -mt-1.5" style={{ color: BI.textMuted }}>
            Distribuição de frequência de pedidos por cliente no período
          </p>
          <InsightNarrative
            lines={narrativaRecompra} loading={loadRecomp}
            type={recompra && recompra.bucket_1 / recompra.total_clientes >= 0.4 ? 'alert' : 'info'}
          />
          {recompra != null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: BI.warning, fontFamily: 'monospace' }}>
                {parseFloat(recompra.media).toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: BI.textMuted }}>pedidos/cliente · mediana {recompra.mediana}</span>
            </div>
          )}
          {loadRecomp
            ? <SkeletonCard height={200} />
            : !recompraOption
              ? <p style={{ color: BI.textMuted, fontSize: 12, padding: '24px 0' }}>Sem dados</p>
              : <ReactECharts option={recompraOption} style={{ height: 200 }} opts={{ renderer: 'canvas' }} />
          }
          {!loadRecomp && recompra && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { label: '1×',   v: recompra.bucket_1,      color: BI.textMuted },
                { label: '2–3',  v: recompra.bucket_2_3,    color: BI.blue      },
                { label: '4–6',  v: recompra.bucket_4_6,    color: BI.purple    },
                { label: '7–12', v: recompra.bucket_7_12,   color: BI.teal      },
                { label: '12+',  v: recompra.bucket_12plus, color: BI.warning   },
              ].map(b => (
                <div key={b.label} style={{
                  flex: 1, minWidth: 48, padding: '5px 6px', borderRadius: 6, textAlign: 'center',
                  background: `${b.color}12`, border: `1px solid ${b.color}30`,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 900, color: b.color, fontFamily: 'monospace' }}>{b.v ?? 0}</p>
                  <p style={{ fontSize: 9, color: BI.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{b.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardWrap>

      </div>
    </div>
  );
};

export default ClientesTab;
