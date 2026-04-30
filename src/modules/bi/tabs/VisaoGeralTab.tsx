import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  DollarSign, Package, Users, ShoppingCart, Info,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams, isModoComparacao } from '../store/useBIStore';
import { BI, fmtK, fmtN, fmtNFull, fmtBRL, CHART_COLORS } from '../components/biTokens';
import { KPICard } from '../components/KPICard';
import { SkeletonCard } from '../components/SkeletonCard';
import { MetasMensalTable } from '../components/MetasMensalTable';
import { SellerPerformanceTable } from '../components/SellerPerformanceTable';
import { InsightNarrative } from '../components/InsightNarrative';
import { BrazilMapTexture, DotGridTexture } from '../components/BiTextures';

// ─── MESES NOME ───────────────────────────────────────────────────────────────
const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── SEÇÃO LABEL ─────────────────────────────────────────────────────────────
const SectionLabel = ({ label }: { label: string }) => (
  <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: BI.textMuted }}>{label}</p>
);

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const EmptyState = ({ msg = 'Sem dados para o período' }: { msg?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-2">
    <Info size={28} style={{ color: BI.textMuted }} />
    <p className="text-sm font-bold" style={{ color: BI.textMuted }}>{msg}</p>
  </div>
);

// ─── VISÃO GERAL TAB ─────────────────────────────────────────────────────────
const VisaoGeralTab = () => {
  const { filters, visao } = useBIStore();
  const modoComp = isModoComparacao(filters);
  const p = buildBIParams(filters);

  // Seletores de campo/formato por métrica (strings — safe como deps de useMemo)
  const valField = visao === 'volume' ? 'quantidade' : visao === 'skus' ? 'skus' : 'total';
  const valLabel = visao === 'financeiro' ? 'Faturamento' : visao === 'volume' ? 'Volume (un)' : 'SKUs';

  const [overview,   setOverview]   = useState<any>(null);
  const [monthly,    setMonthly]    = useState<any[]>([]);
  const [metasMensal, setMetasMensal] = useState<{ data: any[]; ano?: number }>({ data: [] });
  const [networkRank, setNetworkRank] = useState<any[]>([]);
  const [ranking,    setRanking]    = useState<any[]>([]);
  const [topItems,   setTopItems]   = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [categorias,  setCategorias]  = useState<any[]>([]);
  const [skusGrupo,   setSkusGrupo]   = useState<any[]>([]);

  const [loadOv,   setLoadOv]   = useState(true);
  const [loadMon,  setLoadMon]  = useState(true);
  const [loadMeta, setLoadMeta] = useState(true);
  const [loadNet,  setLoadNet]  = useState(true);
  const [loadMix,  setLoadMix]  = useState(true);
  const [loadRank, setLoadRank] = useState(true);
  const [loadItems, setLoadItems] = useState(true);
  const [loadClients, setLoadClients] = useState(true);
  const [loadCat,    setLoadCat]    = useState(true);
  const [loadGrupo,  setLoadGrupo]  = useState(true);
  const [rankHover, setRankHover] = useState<number | null>(null);

  // Fetch ao mudar filtros
  useEffect(() => {
    setLoadOv(true);
    api.get(`/bi/overview?${p}`)
      .then(r => r.data.success && setOverview(r.data.data))
      .catch(console.error)
      .finally(() => setLoadOv(false));
  }, [p]);

  useEffect(() => {
    setLoadMon(true);
    api.get(`/bi/monthly?${p}`)
      .then(r => r.data.success && setMonthly(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoadMon(false));
  }, [p]);

  useEffect(() => {
    setLoadMeta(true);
    api.get(`/bi/metas-mensal?${p}`)
      .then(r => r.data.success && setMetasMensal({ data: r.data.data || [], ano: r.data.meta?.ano }))
      .catch(console.error)
      .finally(() => setLoadMeta(false));
  }, [p]);

  useEffect(() => {
    setLoadNet(true);
    api.get(`/bi/clientes-ranking?agrupar_rede=true&${p}&metrica=${visao}`)
      .then(r => r.data.success && setNetworkRank(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoadNet(false));
  }, [p, visao]);

  useEffect(() => {
    setLoadRank(true);
    setLoadMix(true);
    api.get(`/bi/market-share?${p}&metrica=${visao}`)
      .then(r => r.data.success && setRanking(r.data.data || []))
      .catch(console.error)
      .finally(() => {
        setLoadRank(false);
        setLoadMix(false);
      });
  }, [p, visao]);

  useEffect(() => {
    setLoadItems(true);
    api.get(`/bi/ranking-produtos?${p}&metrica=${visao}`)
      .then(r => r.data.success && setTopItems(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoadItems(false));
  }, [p, visao]);

  useEffect(() => {
    setLoadClients(true);
    api.get(`/bi/clientes-ranking?agrupar_rede=false&${p}&metrica=${visao}`)
      .then(r => r.data.success && setTopClients(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoadClients(false));
  }, [p, visao]);

  // Fetch vendas por categoria (schema-aware — só retorna dados se cad_prod tiver flags)
  useEffect(() => {
    setLoadCat(true);
    api.get(`/bi/vendas-categorias?${p}`)
      .then(r => r.data.success && setCategorias(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoadCat(false));
  }, [p]);

  useEffect(() => {
    setLoadGrupo(true);
    api.get(`/bi/skus-por-grupo?${p}`)
      .then(r => r.data.success && setSkusGrupo(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoadGrupo(false));
  }, [p]);

  // ─── Sparklines (série do ano principal) ────────────────────────────────────
  const spark = useMemo(() => {
    if (!monthly.length) return [];
    const anoMax = Math.max(...filters.anos);
    const serie = monthly.find(m => m.ano === anoMax);
    if (!serie) return [];
    const arr = Array.from({ length: 12 }, (_, i) => {
      const found = serie.series.find((r: any) => r.mes === i + 1);
      return found ? parseFloat(found[valField] || found.total) : 0;
    });
    return arr;
  }, [monthly, filters.anos, valField]);

  // ─── Tooltip helpers — HTML estilizado com tema BI ─────────────────────────
  const ttSep = `<div style="height:1px;background:${BI.border};margin:8px 0;"></div>`;

  const ttRow = (label: string, value: string, valueColor: string = BI.text) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:4px;">
       <span style="color:${BI.textMuted};font-size:12px;">${label}</span>
       <span style="color:${valueColor};font-weight:700;font-size:13px;font-family:monospace;">${value}</span>
     </div>`;

  // ─── Gráfico mensal (área/linha) ────────────────────────────────────────────
  const monthlyOption = useMemo(() => {
    if (!monthly.length) return null;
    const anoMax = Math.max(...filters.anos);
    const anoMin = filters.anos.length === 2 ? Math.min(...filters.anos) : null;

    const serieA = monthly.find(m => m.ano === anoMax);
    const serieB = anoMin ? monthly.find(m => m.ano === anoMin) : null;

    const dataA = Array.from({ length: 12 }, (_, i) => {
      const f = serieA?.series.find((r: any) => r.mes === i + 1);
      return f ? parseFloat(f[valField] || f.total) : 0;
    });
    const dataB = serieB ? Array.from({ length: 12 }, (_, i) => {
      const f = serieB.series.find((r: any) => r.mes === i + 1);
      return f ? parseFloat(f[valField] || f.total) : 0;
    }) : null;

    const totalAnualA = dataA.reduce((s, v) => s + v, 0);

    const series: any[] = [{
      name: String(anoMax),
      type: 'line', data: dataA, smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { color: BI.teal, width: 2 },
      itemStyle: { color: BI.teal },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: `${BI.teal}40` }, { offset: 1, color: `${BI.teal}00` }] },
      },
    }];

    if (dataB) {
      series.push({
        name: String(anoMin),
        type: 'line', data: dataB, smooth: true, symbol: 'circle', symbolSize: 5,
        lineStyle: { color: BI.purple, width: 2, type: 'dashed' },
        itemStyle: { color: BI.purple },
      });
    }

    return {
      animation: true,
      backgroundColor: 'transparent',
      grid: { top: 20, bottom: 30, left: 60, right: 20 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: BI.panel,
        borderColor: BI.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: [12, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);min-width:180px;',
        textStyle: { color: BI.text, fontSize: 11, fontFamily: 'system-ui,sans-serif' },
        formatter: (params: any[]) => {
          const idx  = params[0].dataIndex;
          const mes  = MES[idx + 1];
          const valA = params[0]?.value ?? 0;
          const valB = params[1]?.value ?? 0;

          // Cabeçalho com mês
          let html = `<div style="font-size:14px;font-weight:800;color:${BI.text};margin-bottom:10px;">${mes}</div>`;

          // Linha por série
          params.forEach(p => {
            if (p.value === 0) return;
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:6px;">
              <div style="display:flex;align-items:center;gap:7px;">
                <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.color};flex-shrink:0;"></span>
                <span style="color:${BI.textSec};font-size:12px;">${p.seriesName}</span>
              </div>
              <span style="color:${BI.text};font-weight:700;font-size:13px;font-family:monospace;">${visao === 'financeiro' ? fmtBRL(p.value) : fmtN(p.value)}</span>
            </div>`;
          });

          html += ttSep;

          // YoY: dois anos selecionados
          if (dataB && valA > 0 && valB > 0) {
            const growth    = (valA - valB) / valB * 100;
            const growColor = growth >= 0 ? BI.success : BI.danger;
            const growIcon  = growth >= 0 ? '▲' : '▼';
            const fmtDiff   = visao === 'financeiro' ? fmtBRL(Math.abs(valA - valB)) : fmtN(Math.abs(valA - valB));
            html += ttRow('Variação YoY', `${growIcon} ${Math.abs(growth).toFixed(1)}%`, growColor);
            html += ttRow('Diferença', fmtDiff, growth >= 0 ? BI.success : BI.danger);
          }

          // % do acumulado anual (modo ano único)
          if (!dataB && valA > 0 && totalAnualA > 0) {
            const pct = (valA / totalAnualA * 100).toFixed(1);
            html += ttRow('% do acumulado anual', `${pct}%`, BI.teal);
          }

          return html;
        },
      },
      legend: { show: dataB !== null, textStyle: { color: BI.textSec, fontSize: 11 }, top: 0 },
      xAxis: {
        type: 'category', data: MES.slice(1),
        axisLine: { lineStyle: { color: BI.border } },
        axisLabel: { color: BI.textMuted, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } },
        axisLabel: { color: BI.textMuted, fontSize: 11, formatter: (v: number) => visao === 'financeiro' ? fmtK(v) : fmtN(v) },
      },
      series,
    };
  }, [monthly, filters.anos, visao, valField]);

  // ─── Ranking de Redes (Barras Horizontais) ──────────────────────────────────
  const netOption = useMemo(() => {
    if (!networkRank.length) return null;

    const dataRaw = networkRank.slice(0, 15);
    const totalVol = dataRaw.reduce((s, r) => s + parseFloat(r[valField] || r.total), 0);

    let runningSum = 0;
    const processedData = dataRaw.map(d => {
      const val = parseFloat(d[valField] || d.total);
      runningSum += val;
      const acum = (runningSum / totalVol) * 100;
      return { ...d, val, acum };
    });

    const dataArr = processedData.slice(0, 10).reverse(); // Top 10 invertido para barras horizontais

    return {
      animation: true,
      backgroundColor: 'transparent',
      grid: { top: 10, bottom: 20, left: 10, right: 60, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: BI.panel,
        borderColor: BI.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: [10, 12],
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (params: any[]) => {
          const d = params[0].data;
          return `
            <div style="font-weight:800;margin-bottom:8px;">${d.name}</div>
            ${ttSep}
            ${ttRow(valLabel, visao === 'financeiro' ? fmtBRL(d.value) : fmtN(d.value), BI.success)}
            ${ttRow('Participação', `${d.pct}%`, BI.textSec)}
            ${ttRow('Acumulado', `${d.acumulado.toFixed(1)}%`, d.acumulado <= 80 ? BI.teal : BI.warning)}
            ${ttRow('Pedidos', d.pedidos, BI.text)}
          `;
        }
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } },
        axisLabel: { show: false }
      },
      yAxis: {
        type: 'category',
        data: dataArr.map(d => d.nome.substring(0, 15) + (d.nome.length > 15 ? '...' : '')),
        axisLine: { lineStyle: { color: BI.border } },
        axisLabel: { color: BI.textMuted, fontSize: 11, fontWeight: 700 },
      },
      series: [{
        type: 'bar',
        data: dataArr.map((d, i) => {
          const isTop80 = d.acum <= 80;
          
          return {
            name: d.nome,
            value: d.val,
            pct: d.pct_total,
            acumulado: d.acum,
            pedidos: d.pedidos,
            itemStyle: {
               color: {
                 type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                 colorStops: [
                   { offset: 0, color: isTop80 ? `${BI.teal}bb` : `${BI.warning}40` },
                   { offset: 1, color: isTop80 ? BI.teal : BI.warning }
                 ]
               },
               borderRadius: [0, 4, 4, 0]
            }
          };
        }),
        barWidth: '60%',
        label: {
          show: true,
          position: 'right',
          color: BI.text,
          fontSize: 11,
          fontWeight: 'bold',
          formatter: (p: any) => visao === 'financeiro' ? fmtK(p.value) : fmtN(p.value)
        }
      }],
    };
  }, [networkRank, visao, valField, valLabel]);


  // ─── Sunburst (Explosão Solar): Mix de SKUs vs Portfólio ─────────────────
  const mixOption = useMemo(() => {
    if (!ranking.length) return null;

    // Top 8 para não ficar zoneado
    const dataArr = ranking.slice(0, 8);

    const sunData = dataArr.map((d, i) => {
      const cor = CHART_COLORS[i % CHART_COLORS.length];
      const sold = d.skus;
      const total = d.total_portfolio;
      const remaining = Math.max(0, total - sold);

      return {
        name: d.nome,
        itemStyle: { color: cor },
        children: [
          {
            name: 'Vendido',
            value: sold,
            cobertura: d.pct_cobertura,
            itemStyle: { color: cor }
          },
          {
            name: 'Ocioso',
            value: remaining,
            itemStyle: { color: `${cor}33` } // Mais transparente
          }
        ]
      };
    });

    return {
      animation: true,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: BI.panel,
        borderColor: BI.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: [10, 12],
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (p: any) => {
          const d = p.data;
          const parent = p.treePathInfo?.[1]?.name || p.name;
          if (p.name === 'Vendido') {
            return `
              <div style="font-weight:800;margin-bottom:8px;">${parent}</div>
              ${ttSep}
              ${ttRow('Mix Vendido', `${p.value} itens`, BI.blue)}
              ${ttRow('Status', 'Com Vendas', BI.success)}
              ${ttRow('Aproveitamento', `${d.cobertura}%`, BI.teal)}
            `;
          }
          if (p.name === 'Ocioso') {
             return `
              <div style="font-weight:800;margin-bottom:8px;">${parent}</div>
              ${ttSep}
              ${ttRow('Itens Ociosos', `${p.value} itens`, BI.textMuted)}
              ${ttRow('Status', 'Sem Movimentação', BI.danger)}
            `;
          }
          return `<b>${p.name}</b><br/>Total Portfólio: ${p.value} itens`;
        }
      },
      series: [{
        type: 'sunburst',
        data: sunData,
        radius: [0, '95%'],
        center: ['45%', '50%'],
        sort: undefined,
        emphasis: { focus: 'ancestor' },
        levels: [
          {},
          { 
            r0: '0%', r: '40%', 
            label: { rotate: 'tangential', fontSize: 11, fontWeight: 800, color: BI.text, formatter: '{b}' } 
          },
          { 
            r0: '45%', r: '85%', 
            label: { 
              position: 'outside', 
              padding: 5, 
              color: BI.text, 
              fontSize: 10,
              fontWeight: 700,
              formatter: (p: any) => p.name === 'Vendido' ? `${p.value} items (${p.data.cobertura}%)` : `${p.value} items`
            } 
          }
        ],
        itemStyle: { borderWidth: 2, borderColor: BI.panel }
      }]
    };
  }, [ranking]);


  // ─── Narrativas automáticas (storytelling) ──────────────────────────────────
  const narrativaKPIs = useMemo((): string[] => {
    if (!overview || loadOv) return [];
    const periodo = filters.meses.length
      ? `${filters.meses.length} mês(es) de ${Math.max(...filters.anos)}`
      : `ano de ${Math.max(...filters.anos)}`;
    const lines: string[] = [
      `Em ${periodo}, o faturamento total foi ${fmtBRL(overview.total_vendido || 0)} com ${fmtN(overview.clientes_ativos || 0)} clientes ativos.`,
    ];
    if (overview.delta_vendido !== null && overview.delta_vendido !== undefined) {
      const d = overview.delta_vendido;
      lines.push(`Faturamento ${d >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(d).toFixed(1)}% vs período anterior.`);
    }
    if (overview.ticket_medio > 0) {
      lines.push(`Ticket médio por pedido: ${fmtBRL(overview.ticket_medio)}.`);
    }
    return lines;
  }, [overview, loadOv, filters]);

  const narrativaMensal = useMemo((): string[] => {
    if (!monthly.length) return [];
    const anoMax = Math.max(...filters.anos);
    const serie  = monthly.find(m => m.ano === anoMax);
    if (!serie || !serie.series.length) return [];

    const totaisPorMes: { mes: number; total: number }[] = Array.from({ length: 12 }, (_, i) => {
      const found = serie.series.find((r: any) => r.mes === i + 1);
      return { mes: i + 1, total: found ? parseFloat(found.total) : 0 };
    });
    const melhor   = totaisPorMes.reduce((a, b) => b.total > a.total ? b : a);
    const comDados = totaisPorMes.filter(m => m.total > 0);
    if (!comDados.length) return [];

    const linhas: string[] = [
      `Melhor mês de ${anoMax}: ${MES[melhor.mes]} com ${fmtBRL(melhor.total)}.`,
    ];

    // Tendência: comparar última metade com primeira metade dos meses com dados
    if (comDados.length >= 4) {
      const meio    = Math.floor(comDados.length / 2);
      const media1  = comDados.slice(0, meio).reduce((s, m) => s + m.total, 0) / meio;
      const media2  = comDados.slice(meio).reduce((s, m) => s + m.total, 0) / (comDados.length - meio);
      const trend   = media2 > media1 * 1.05 ? 'crescente' : media2 < media1 * 0.95 ? 'em queda' : 'estável';
      linhas.push(`Tendência do período: ${trend}.`);
    }
    return linhas;
  }, [monthly, filters.anos]);

  const narrativaNet = useMemo((): string[] => {
    if (!networkRank.length) return [];
    const top = networkRank[0];
    return [
      `${top.nome} é a principal rede do período com ${fmtBRL(parseFloat(top.total))}.`,
      `Representa ${parseFloat(top.pct_total).toFixed(1)}% do faturamento global.`
    ];
  }, [networkRank]);

  const narrativaRanking = useMemo((): string[] => {
    if (!ranking.length) return [];
    const lider  = ranking[0];
    const total3 = ranking.slice(0, 3).reduce((s, r) => s + parseFloat(r.total), 0);
    const grand  = ranking.reduce((s, r) => s + parseFloat(r.total), 0);
    const pct3   = grand > 0 ? (total3 / grand * 100).toFixed(0) : '0';
    return [
      `${ranking.length} indústria(s) ativas no período. ${lider.nome} responde por ${parseFloat(lider.pct_total).toFixed(1)}%.`,
      `As 3 primeiras concentram ${pct3}% do volume total.`,
    ];
  }, [ranking]);

  // ─── ECharts: SKUs por Grupo de Produto ─────────────────────────────────────
  const skusGrupoOption = useMemo(() => {
    if (!skusGrupo.length) return null;
    const items = skusGrupo.slice(0, 15);
    const reversed = [...items].reverse();
    const maxVal = parseFloat(items[0]?.total_valor || '1');

    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 8, bottom: 8, left: 10, right: 90, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
        textStyle: { color: BI.text, fontSize: 12 },
        formatter: (params: any[]) => {
          const idx = items.length - 1 - params[0].dataIndex;
          const d = items[idx];
          return `<div style="font-weight:800;font-size:13px;margin-bottom:6px;">${d.gru_nome}</div>
            <div style="color:${BI.textSec};font-size:11px;">Faturamento: <b style="color:${BI.teal};font-family:monospace">${fmtBRL(parseFloat(d.total_valor))}</b></div>
            <div style="color:${BI.textSec};font-size:11px;">SKUs distintos: <b style="color:${BI.text}">${d.skus_distintos}</b></div>
            <div style="color:${BI.textSec};font-size:11px;">Quantidade: <b style="color:${BI.text}">${Number(d.quantidade_total).toLocaleString('pt-BR')}</b></div>
            <div style="color:${BI.textSec};font-size:11px;">Clientes: <b style="color:${BI.text}">${d.clientes_distintos}</b></div>`;
        },
      },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: reversed.map(d => d.gru_nome.length > 24 ? d.gru_nome.substring(0, 22) + '…' : d.gru_nome),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: BI.textSec, fontSize: 12, fontWeight: 600 },
      },
      series: [{
        type: 'bar',
        data: reversed.map((d, i) => ({
          value: parseFloat(d.total_valor),
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: `${CHART_COLORS[(items.length - 1 - i) % CHART_COLORS.length]}60` },
                { offset: 1, color: CHART_COLORS[(items.length - 1 - i) % CHART_COLORS.length] as string },
              ],
            },
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barMaxWidth: 10,
        label: {
          show: true, position: 'right',
          formatter: (p: any) => {
            const idx = items.length - 1 - p.dataIndex;
            return `${items[idx].skus_distintos} SKUs`;
          },
          color: BI.text, fontSize: 12, fontWeight: 800,
        },
      }],
    };
  }, [skusGrupo]);

  // ─── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: BI.text }}>
            INSIGHTS ESTRATÉGICOS SALESMASTERS
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3" style={{ color: BI.text }}>
            DADOS DE PERFORMANCE E RISCO EM TEMPO REAL
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="VENDAS TOTAIS" value={loadOv ? '...' : fmtBRL(overview?.total_vendido || 0)}
            hint="Valor líquido total dos pedidos com situação Pendente ou Faturado."
            delta={overview?.delta_vendido} deltaLabel="YOY"
            spark={spark} icon={DollarSign} color={BI.teal} loading={loadOv} highlight
          />
          <KPICard
            label="VOLUME DE ITENS" value={loadOv ? '...' : fmtNFull(overview?.quantidade || 0)}
            hint="Quantidade total de itens vendidos."
            delta={overview?.delta_quantidade} deltaLabel="YOY"
            spark={spark} icon={Package} color={BI.blue} texture="wave" loading={loadOv}
          />
          <KPICard
            label="CLIENTES ATIVOS" value={loadOv ? '...' : fmtN(overview?.clientes_ativos || 0)}
            hint="Clientes com pelo menos 1 pedido no período."
            subInfo={!loadOv && overview?.total_carteira ? `${overview.positivacao_pct}% de ${fmtN(overview.total_carteira)} da carteira` : undefined}
            delta={overview?.delta_clientes} deltaLabel="YOY"
            spark={spark} icon={Users} color={BI.success} texture="network" loading={loadOv}
          />
          <KPICard
            label="TICKET MÉDIO" value={loadOv ? '...' : fmtBRL(overview?.ticket_medio || 0)}
            hint="Valor médio por pedido."
            delta={overview?.delta_ticket} deltaLabel="YOY"
            spark={spark} icon={ShoppingCart} color={BI.purple} texture="speedometer" loading={loadOv}
          />
        </div>
      </section>

      {/* ── Evolução Mensal + Market Share ───────────────────────────────── */}
      <section className="grid grid-cols-3 gap-4">

        {/* Evolução Mensal — col 2 */}
        <div className="col-span-2 rounded-2xl p-5"
          style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
          <SectionLabel label={modoComp ? 'Evolução Mensal · Comparativo YoY' : 'Evolução Mensal'} />
          {loadMon
            ? <SkeletonCard height={220} />
            : !monthlyOption
              ? <EmptyState />
              : <ReactECharts option={monthlyOption} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
          }
        </div>

        {/* Ranking Redes (Pareto 80/20) — col 1 */}
        <div className="rounded-2xl p-5"
          style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel label="Análise 80/20: Redes de Lojas" />
            <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter"
                 style={{ background: `${BI.teal}20`, color: BI.teal, border: `1px solid ${BI.teal}40` }}>
              Pareto Ativo
            </div>
          </div>
          {loadNet
            ? <SkeletonCard height={280} />
            : !netOption
              ? <EmptyState />
              : (
                <div style={{ position: 'relative' }}>
                  <ReactECharts option={netOption} style={{ height: 280 }} opts={{ renderer: 'canvas' }} />
                  {networkRank.length > 0 && (
                     <p className="text-[10px] font-bold opacity-60 mt-2 text-center" style={{ color: BI.text }}>
                        Redes em <span style={{ color: BI.teal, fontWeight: 800 }}>verde</span> (80% faturamento) vs <span style={{ color: BI.warning, fontWeight: 800 }}>mostarda</span> (cauda 20%).
                     </p>
                  )}
                </div>
              )
          }
        </div>
      </section>

      {/* ── Mapa de Metas (Sozinho na Linha) ───────────────────────────── */}
      <section>
        <div className="rounded-2xl p-6"
          style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <SectionLabel label="Mapa de Metas Mensal" />
              <p className="text-xs font-bold -mt-2" style={{ color: BI.text }}>
                Realizado × Meta × Ano Anterior {metasMensal.ano ? `(${metasMensal.ano})` : ''}
              </p>
            </div>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
               <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: BI.success }} /> ≥100%</span>
               <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: BI.warning }} /> 80-99%</span>
               <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: BI.danger }} /> &lt;80%</span>
            </div>
          </div>
          
          {loadMeta
            ? <SkeletonCard height={300} />
            : !metasMensal.data.length
              ? <EmptyState msg="Nenhuma meta configurada para o período" />
              : <MetasMensalTable data={metasMensal.data} ano={metasMensal.ano || 0} />
          }
        </div>
      </section>

      {/* ── Composição de Mix (Explosão Solar) + TOP LISTS ─────────────────────────── */}
      <section>
        <div className="rounded-2xl p-6"
          style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
          
          <div className="grid grid-cols-12 gap-8">
            
            {/* Gráfico Sunburst — col-span 6 */}
            <div className="col-span-6 border-r pr-8" style={{ borderColor: `${BI.border}50` }}>
              <div className="mb-6">
                <SectionLabel label="Explosão Solar: Penetração de Mix" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: BI.text }}>
                   Visão de Portfólio Vendido vs Ocioso
                </p>
              </div>
              {loadMix
                ? <SkeletonCard height={380} />
                : !mixOption
                  ? <EmptyState />
                  : <ReactECharts option={mixOption} style={{ height: 380 }} opts={{ renderer: 'canvas' }} />
              }
              <div className="mt-4 flex items-center justify-center gap-6 opacity-40">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-500" /> <span className="text-[9px] font-black uppercase" style={{ color: BI.text }}>Vendido</span> </div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-900" /> <span className="text-[9px] font-black uppercase" style={{ color: BI.text }}>Ocioso</span> </div>
              </div>
            </div>

            {/* Top 10 Clientes — col-span 3 */}
            <div className="col-span-3">
              <SectionLabel label={`Top 10 Clientes · ${valLabel}`} />
              <div className="space-y-3">
                {loadClients ? <SkeletonCard height={350} /> : topClients.length === 0 ? <p className="text-[11px] opacity-40">Nenhum cliente no período</p> : topClients.slice(0, 10).map((c, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-black opacity-30 w-4 text-right" style={{ color: BI.text }}>{i+1}</span>
                      <span className="text-[12px] font-bold truncate max-w-[120px]" style={{ color: BI.textSec }}>{c.nome}</span>
                    </div>
                    <span className="text-[12px] font-black" style={{ color: BI.teal }}>{visao === 'financeiro' ? fmtK(parseFloat(c.total)) : fmtN(parseFloat(c[valField] || 0))}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 Itens — col-span 3 */}
            <div className="col-span-3">
              <SectionLabel label={`Top 10 Itens · ${valLabel}`} />
              <div className="space-y-3">
                {loadItems ? <SkeletonCard height={350} /> : topItems.length === 0 ? <p className="text-[11px] opacity-40">Nenhum item no período</p> : topItems.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-[11px] font-black opacity-30 w-4 flex-shrink-0 text-right" style={{ color: BI.text }}>{i+1}</span>
                      <div className="flex flex-col truncate">
                        <span className="truncate leading-none" style={{
                          fontSize: 13, fontWeight: 900, fontFamily: 'monospace',
                          color: BI.teal, letterSpacing: '0.04em',
                        }}>{item.produto}</span>
                        {item.nome && (
                          <span className="truncate leading-none mt-0.5" style={{
                            fontSize: 10, fontWeight: 500, color: BI.textMuted,
                          }}>{item.nome}</span>
                        )}
                        <span className="truncate leading-none mt-0.5" style={{ fontSize: 10, color: BI.textMuted, opacity: 0.6 }}>
                          {Number(item.quantidade || 0).toLocaleString('pt-BR')} un · {item.pedidos || 0} ped.
                        </span>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-[12px] font-black" style={{ color: BI.blue }}>{visao === 'financeiro' ? fmtK(parseFloat(item.total)) : fmtN(parseFloat(item[valField] || 0))}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Vendas por Categoria (condicional — só renderiza se há dados) ── */}
      {!loadCat && categorias.length > 0 && (() => {
        const grandTotal = categorias.reduce((s: number, c: any) => s + parseFloat(c[valField] || c.total), 0);
        const catColors = [BI.teal, BI.blue, BI.success, '#f59e0b', '#ef4444', '#a855f7'];
        return (
          <section className="rounded-2xl p-5" style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
            <SectionLabel label="Vendas por Categoria" />
            <div className="grid grid-cols-6 gap-4 mt-3">
              {categorias.map((cat: any, i: number) => {
                const pct = grandTotal > 0 ? (parseFloat(cat[valField] || cat.total) / grandTotal * 100) : 0;
                const color = catColors[i % catColors.length];
                return (
                  <div key={cat.categoria} className="rounded-xl p-4"
                    style={{ background: `${color}08`, border: `1px solid ${color}25` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{cat.categoria}</span>
                    </div>
                    <p className="text-xl font-black leading-none mb-1" style={{ color: BI.text }}>{visao === 'financeiro' ? fmtK(parseFloat(cat.total)) : fmtN(parseFloat(cat[valField] ?? cat.total))}</p>
                    <p className="text-[10px] font-medium" style={{ color: BI.textMuted }}>
                      {pct.toFixed(1)}% · {Number(cat.quantidade || 0).toLocaleString('pt-BR')} un · {cat.produtos} SKUs
                    </p>
                    {/* Barra de progresso */}
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ── SKUs vendidos por Grupo de Produto ───────────────────────────── */}
      <section className="rounded-2xl p-5" style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <SectionLabel label="SKUs Vendidos por Grupo de Produto" />
            <p className="text-xs -mt-2 mb-3" style={{ color: BI.textMuted }}>
              Faturamento por grupo · rótulo = quantidade de SKUs distintos comercializados
            </p>
          </div>
          {skusGrupo.length > 0 && (
            <div className="flex gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BI.textMuted }}>Grupos</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: BI.text, lineHeight: 1, fontFamily: 'monospace' }}>{skusGrupo.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BI.textMuted }}>Total SKUs</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: BI.teal, lineHeight: 1, fontFamily: 'monospace' }}>
                  {skusGrupo.reduce((s, d) => s + parseInt(d.skus_distintos || 0), 0)}
                </p>
              </div>
            </div>
          )}
        </div>
        {loadGrupo
          ? <SkeletonCard height={320} />
          : !skusGrupoOption
            ? <EmptyState msg="Sem dados de grupo para o período" />
            : <ReactECharts option={skusGrupoOption} style={{ height: 340 }} opts={{ renderer: 'canvas' }} />
        }
      </section>

      {/* ── Ranking Indústrias + Performance Vendedores ──────────────────── */}
      <section className="grid grid-cols-5 gap-4">

        {/* Ranking Indústrias — col 2 */}
        <div className="col-span-2 rounded-2xl p-5"
          style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
          <SectionLabel label="Ranking Indústrias" />
          {loadRank
            ? <SkeletonCard lines={6} />
            : !ranking.length
              ? <EmptyState />
              : (
                <div className="space-y-2">
                  {ranking.map((ind: any, i: number) => {
                    const grandTotal = ranking.reduce((s: number, r: any) => s + parseFloat(r.total), 0);
                    const maxTotal   = parseFloat(ranking[0]?.total || 1);
                    const barW       = Math.round(parseFloat(ind.total) / maxTotal * 100);
                    const pct        = parseFloat(ind.pct_total);
                    const acum       = ranking
                      .slice(0, i + 1)
                      .reduce((s: number, r: any) => s + parseFloat(r.pct_total), 0);
                    const medalIcon  = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

                    return (
                      <div key={ind.for_codigo} style={{ position: 'relative' }}
                        onMouseEnter={() => setRankHover(i)}
                        onMouseLeave={() => setRankHover(null)}>

                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black w-6 text-right" style={{ color: BI.textMuted }}>
                              {i + 1}
                            </span>
                            <span className="text-[13px] font-bold truncate max-w-[155px]" style={{ color: BI.text }}>
                              {ind.nome}
                            </span>
                          </div>
                          <div className="text-right">
                             <span className="text-[14px] font-black" style={{ color: BI.teal }}>
                               {fmtK(parseFloat(ind.total))}
                             </span>
                             <div className="flex items-center gap-1.5 ml-1.5 opacity-80">
                               <span className="text-[11px] font-bold" style={{ color: BI.textMuted }}>
                                 {ind.pct_total}%
                               </span>
                               <span className="text-[11px] font-black px-1.5 py-0.5 rounded-sm" style={{ background: `${BI.blue}20`, color: BI.blue }}>
                                 {ind.pct_cobertura}% Mix
                               </span>
                             </div>
                           </div>
                        </div>

                        <div className="ml-7 h-1 rounded-full" style={{ background: BI.border }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${barW}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>

                        {/* Tooltip hover */}
                        {rankHover === i && (
                          <div style={{
                            position: 'absolute', right: 0, top: '110%', zIndex: 50,
                            background: BI.panel, border: `1px solid ${BI.border}`,
                            borderRadius: 12, padding: '12px 16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 220,
                            pointerEvents: 'none',
                          }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              {medalIcon && <span style={{ fontSize: 20 }}>{medalIcon}</span>}
                              <div>
                                <p style={{ fontWeight: 800, color: BI.text, fontSize: 14 }}>{ind.nome}</p>
                                <p style={{ fontSize: 11, color: BI.textMuted, marginTop: 2 }}>
                                  {i === 0 ? 'Maior indústria do portfólio' : `${i + 1}º lugar no ranking`}
                                </p>
                              </div>
                            </div>
                            <div style={{ height: 1, background: BI.border, margin: '8px 0' }} />
                            {/* Dados */}
                            {[
                               ['Faturamento total', fmtBRL(parseFloat(ind.total)), BI.teal],
                               ['Market share',      `${pct.toFixed(1)}%`,           BI.text],
                               ['Cobertura Mix',     `${ind.pct_cobertura}% de ${ind.total_portfolio}`, BI.blue],
                               ['Top ' + (i+1) + ' acumulado', `${acum.toFixed(0)}%`, BI.textSec],
                               grandTotal > 0 ? ['% relativa ao #1', `${barW}%`, BI.textMuted] : null,
                            ].filter((r): r is string[] => Boolean(r)).map(([label, value, color]) => (
                              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ color: BI.textMuted, fontSize: 12 }}>{label as string}</span>
                                <span style={{ color: color as string, fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{value as string}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
          }
        </div>

        {/* Performance de Vendedores — col 3 */}
        <div className="col-span-3 rounded-2xl p-5"
          style={{ background: BI.panelGrad, border: `1px solid ${BI.border}` }}>
          <SellerPerformanceTable />
        </div>
      </section>

    </div>
  );
};

export default VisaoGeralTab;
