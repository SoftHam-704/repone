import { useEffect, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { ChevronRight, Home, ZoomIn } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN } from './biTokens';
import { SkeletonCard } from './SkeletonCard';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const NIVEL_META = [
  { label: 'Indústrias', hint: 'Clique numa barra para ver os meses',         color: '#00e5d1' },
  { label: 'Meses',      hint: 'Clique num mês para ver os clientes',          color: '#BC66FF' },
  { label: 'Clientes',   hint: 'Clique num cliente para ver as famílias',      color: '#ffd166' },
  { label: 'Famílias',   hint: 'Clique numa família para ver os SKUs',         color: '#4ade80' },
  { label: 'Produtos',   hint: 'Nível mais profundo',                          color: '#b4ff9d' },
];

interface DrillItem {
  label:       string;
  tipo:        'root' | 'industria' | 'mes' | 'cliente' | 'grupo';
  for_codigo?: number;
  mes?:        number;
  cli_codigo?: number;
  grupo?:      number;
}

interface Row {
  codigo:        number | string;
  nome:          string;
  produto_nome?: string;   // nivel 3 — nome da categoria (tooltip only)
  total:         string;
  clientes?:     number;
  pedidos?:      number;
  quantidade?:   string;
  mes?:          number;
}

// ─── DrillDownChart ───────────────────────────────────────────────────────────
export const DrillDownChart = () => {
  const { filters } = useBIStore();
  const globalP = buildBIParams(filters);

  const [nivel,   setNivel]   = useState(0);
  const [stack,   setStack]   = useState<DrillItem[]>([{ label: 'Todas as Indústrias', tipo: 'root' }]);
  const [data,    setData]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLevel = useCallback(async (lvl: number, stk: DrillItem[]) => {
    setLoading(true);
    try {
      const extra = new URLSearchParams();
      extra.set('nivel', String(lvl));

      // Acumula filtros da pilha
      for (const item of stk) {
        if (item.for_codigo !== undefined) extra.set('for_codigo', String(item.for_codigo));
        if (item.mes        !== undefined) extra.set('mes',        String(item.mes));
        if (item.cli_codigo !== undefined) extra.set('cli_codigo', String(item.cli_codigo));
        if (item.grupo      !== undefined) extra.set('grupo',      String(item.grupo));
      }

      const res = await api.get(`/bi/drilldown?${globalP}&${extra.toString()}`);
      if (res.data.success) setData(res.data.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [globalP]);

  // Refetch quando filtros globais mudam (reset ao nivel 0)
  useEffect(() => {
    setNivel(0);
    setStack([{ label: 'Todas as Indústrias', tipo: 'root' }]);
    fetchLevel(0, [{ label: 'Todas as Indústrias', tipo: 'root' }]);
  }, [globalP]);

  // ── Drill down ao clicar numa barra ───────────────────────────────────────
  const handleBarClick = useCallback((params: any) => {
    if (nivel >= 4) return;

    const idx  = data.length - 1 - params.dataIndex; // barras estão invertidas (ASC visual)
    const row  = data[idx];
    if (!row) return;

    const nextNivel = nivel + 1;
    let newItem: DrillItem;

    const codigoNum = Number(row.codigo);
    if (nivel === 0) {
      newItem = { label: row.nome, tipo: 'industria', for_codigo: codigoNum };
    } else if (nivel === 1) {
      const mesNum = row.mes ?? codigoNum;
      newItem = { label: MES[mesNum] ?? String(mesNum), tipo: 'mes', mes: mesNum };
    } else if (nivel === 2) {
      newItem = { label: row.nome, tipo: 'cliente', cli_codigo: codigoNum };
    } else {
      // nivel 3 → famílias — codigo é gru_codigo
      newItem = { label: row.nome, tipo: 'grupo', grupo: codigoNum };
    }

    const nextStack = [...stack, newItem];
    setStack(nextStack);
    setNivel(nextNivel);
    fetchLevel(nextNivel, nextStack);
  }, [nivel, data, stack, fetchLevel]);

  // ── Navegar pelo breadcrumb ───────────────────────────────────────────────
  const jumpTo = (idx: number) => {
    const nextStack = stack.slice(0, idx + 1);
    setStack(nextStack);
    setNivel(idx);
    fetchLevel(idx, nextStack);
  };

  // ── ECharts option ────────────────────────────────────────────────────────
  const currentColor = NIVEL_META[nivel].color;
  const canDrillMore = nivel < 4;

  const rows   = [...data].reverse(); // ECharts category axis: último é o de cima
  const labels = rows.map(r => {
    if (nivel === 1) return MES[r.mes ?? Number(r.codigo)] ?? String(r.codigo);
    // nivel 4: código do produto já é curto e único — sem truncar
    if (nivel === 4) return String(r.nome ?? r.codigo);
    const n = r.nome ?? String(r.codigo);
    return n.length > 28 ? n.substring(0, 26) + '…' : n;
  });
  const values = rows.map(r => parseFloat(r.total));
  const maxVal = Math.max(...values, 1);

  const chartOption = {
    animation: true,
    animationDuration: 400,
    animationEasing: 'cubicOut' as const,
    backgroundColor: 'transparent',
    grid: { top: 8, bottom: 8, left: 8, right: 90, containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'none' as const },
      backgroundColor: BI.panel,
      borderColor: currentColor + '60',
      borderWidth: 1,
      borderRadius: 10,
      padding: [10, 14],
      extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);',
      textStyle: { color: BI.text, fontSize: 12 },
      formatter: (params: any[]) => {
        const i = params[0].dataIndex;
        const r = rows[i];
        // nivel 4: linha de título = CÓDIGO + nome da categoria abaixo
        const titleLine = nivel === 4
          ? `<b style="font-family:monospace;letter-spacing:0.05em">${labels[i]}</b>`
            + (r.produto_nome ? `<br/><span style="color:${BI.textMuted};font-size:10px">${r.produto_nome}</span>` : '')
          : `<b>${labels[i]}</b>`;
        const sub = r.clientes !== undefined
          ? `<br/><span style="color:${BI.textMuted};font-size:10px">${r.clientes} cliente${r.clientes !== 1 ? 's' : ''}</span>`
          : r.quantidade !== undefined
            ? `<br/><span style="color:${BI.textMuted};font-size:10px">${fmtN(parseFloat(r.quantidade))} un.</span>`
            : '';
        return `${titleLine}<br/>${fmtBRL(parseFloat(r.total))}${sub}`;
      },
    },
    xAxis: {
      type: 'value' as const,
      axisLabel: {
        color: BI.textMuted, fontSize: 10,
        formatter: (v: number) => {
          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
          if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
          return String(v);
        },
      },
      splitLine: { lineStyle: { color: BI.border, type: 'dashed' as const } },
    },
    yAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: {
        color: BI.text,
        fontSize: nivel === 4 ? 13 : 12,
        fontWeight: 700,
        fontFamily: nivel === 4 ? 'monospace' : 'inherit',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar' as const,
      data: values.map((v, i) => ({
        value: v,
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0,   color: currentColor + 'CC' },
              { offset: 1,   color: currentColor + '55' },
            ],
          },
          borderRadius: [0, 6, 6, 0],
          opacity: canDrillMore ? 1 : 0.75,
        },
        emphasis: canDrillMore ? {
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: currentColor },
                { offset: 1, color: currentColor + '88' },
              ],
            },
            shadowBlur: 12,
            shadowColor: currentColor + '60',
          },
        } : {},
      })),
      barMaxWidth: nivel === 4 ? 22 : 28,
      barMinHeight: 4,
      cursor: canDrillMore ? 'pointer' : 'default',
      label: {
        show: true,
        position: 'right' as const,
        formatter: (p: any) => fmtBRL(p.value),
        color: BI.textMuted,
        fontSize: 11,
        fontWeight: 600,
      },
    }],
  };

  // nivel 4 (SKUs) tem barras mais finas → precisa de menos altura por item
  const rowHeight  = nivel === 4 ? 32 : 38;
  const chartHeight = Math.max(220, data.length * rowHeight + 32);

  return (
    <div className="glass-card rounded-[20px]" style={{
      padding: '20px 24px',
      position: 'relative', overflow: 'hidden',
      borderTop: `3px solid ${currentColor}`,
    }}>
      {/* Glow top-left */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        background: `radial-gradient(circle at 0% 0%, ${currentColor}08 0%, transparent 50%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ZoomIn size={14} style={{ color: currentColor }} />
            <span className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: currentColor }}>
              Drill-down · {NIVEL_META[nivel].label}
            </span>
          </div>
          {canDrillMore && (
            <p className="text-[10px]" style={{ color: BI.textMuted }}>
              {NIVEL_META[nivel].hint}
            </p>
          )}
        </div>

        {/* Indicador de nível */}
        <div className="flex items-center gap-1">
          {NIVEL_META.map((m, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 999,
              background: i === nivel ? m.color : BI.border,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap mb-4">
        {stack.map((item, i) => {
          const tipoLabel: Record<string, string> = {
            industria: 'Indústria',
            mes:       'Mês',
            cliente:   'Cliente',
            grupo:     'Família',
          };
          const tag = i > 0 ? tipoLabel[item.tipo] : null;
          return (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} style={{ color: BI.textMuted }} />}
              <button
                onClick={() => jumpTo(i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                  background: i === nivel ? `${currentColor}20` : 'transparent',
                  border: `1px solid ${i === nivel ? currentColor + '50' : 'transparent'}`,
                  borderRadius: 8, padding: '3px 10px',
                  cursor: i < nivel ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}>
                {tag && (
                  <span style={{
                    fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: i === nivel ? currentColor + 'AA' : BI.textMuted + '80',
                    lineHeight: 1,
                  }}>
                    {tag}
                  </span>
                )}
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: i === nivel ? 800 : 500,
                  color: i === nivel ? currentColor : BI.textMuted,
                  lineHeight: 1.3,
                }}>
                  {i === 0 && <Home size={10} />}
                  {item.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonCard lines={6} />
      ) : !data.length ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm font-bold" style={{ color: BI.textMuted }}>Sem dados para o período</p>
        </div>
      ) : (
        <ReactECharts
          option={chartOption}
          style={{ height: chartHeight, width: '100%' }}
          onEvents={{ click: handleBarClick }}
        />
      )}

      {/* ── Rodapé: resumo do nível ──────────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${BI.border}` }}>
          <span style={{ fontSize: 10, color: BI.textMuted }}>
            {data.length} {NIVEL_META[nivel].label.toLowerCase()}
          </span>
          <span style={{ fontSize: 10, color: BI.textMuted }}>
            Total: <b style={{ color: BI.text }}>{fmtBRL(data.reduce((s, r) => s + parseFloat(r.total), 0))}</b>
          </span>
          {nivel < 3 && (
            <span style={{ fontSize: 10, color: currentColor + 'AA', marginLeft: 'auto' }}>
              ↙ clique numa barra para aprofundar
            </span>
          )}
        </div>
      )}
    </div>
  );
};
