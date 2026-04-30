import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';

// ─── Constantes ───────────────────────────────────────────────────────────────
const MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function cor(pct: number): string {
  if (pct >= 100) return BI.success;
  if (pct >= 70)  return BI.warning;
  return BI.danger;
}

const SL = ({ label }: { label: string }) => (
  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BI.textMuted }}>
    {label}
  </p>
);

// Cartão KPI simples (sem spark, sem ícone — versão enxuta para esta aba)
const MiniKPI = ({
  topColor, label, value, sub, subColor, progress, progressColor,
}: {
  topColor: string; label: string; value: string;
  sub?: string; subColor?: string;
  progress?: number; progressColor?: string;
}) => (
  <div className="glass-card rounded-2xl p-5" style={{ borderTop: `3px solid ${topColor}` }}>
    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: topColor }}>
      {label}
    </p>
    <p className="text-2xl font-black leading-none" style={{ color: BI.text, fontFamily: 'monospace' }}>
      {value}
    </p>
    {progress !== undefined && progressColor && (
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `${progressColor}20` }}>
        <div className="h-full rounded-full"
          style={{ width: `${progress}%`, background: progressColor, transition: 'width 0.6s ease' }} />
      </div>
    )}
    {sub && (
      <p className="text-[10px] mt-2" style={{ color: subColor ?? BI.textMuted }}>
        {sub}
      </p>
    )}
  </div>
);

// ─── MetasTab ─────────────────────────────────────────────────────────────────
const MetasTab = () => {
  const { filters } = useBIStore();
  const p = buildBIParams(filters);
  const anoAtual = Math.max(...filters.anos);
  const now = new Date();
  const isCurrentYear = anoAtual === now.getFullYear();
  const mesAtual = isCurrentYear ? now.getMonth() + 1 : 12;

  const [mensal,     setMensal]     = useState<any[]>([]);
  const [industrias, setIndustrias] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);

  // ── Parallel fetch: ambos endpoints ao mesmo tempo ────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/bi/metas-mensal?${p}`)
        .then(r => (r.data.success ? r.data.data ?? [] : []))
        .catch(() => [] as any[]),
      api.get(`/bi/metas-industrias?${p}`)
        .then(r => (r.data.success ? r.data.data ?? [] : []))
        .catch(() => [] as any[]),
    ])
      .then(([m, i]) => { setMensal(m); setIndustrias(i); })
      .finally(() => setLoading(false));
  }, [p]);

  // ── Existem metas formais cadastradas? ────────────────────────────────────
  const hasMeta = useMemo(
    () => mensal.some((r: any) => parseFloat(r.meta_ano_corrente) > 0),
    [mensal],
  );

  // ── Agrega por mês somando todas as indústrias ────────────────────────────
  const byMes = useMemo(() => {
    const map = new Map<number, { meta: number; realizado: number; anoAnt: number }>();
    for (const row of mensal) {
      const mes  = row.mes as number;
      const prev = map.get(mes) ?? { meta: 0, realizado: 0, anoAnt: 0 };
      map.set(mes, {
        meta:      prev.meta      + (parseFloat(row.meta_ano_corrente)   || 0),
        realizado: prev.realizado + (parseFloat(row.vendas_ano_corrente) || 0),
        anoAnt:    prev.anoAnt    + (parseFloat(row.ano_anterior)        || 0),
      });
    }
    return map;
  }, [mensal]);

  // ── KPIs derivados ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!byMes.size) return null;

    let metaAnual = 0, metaYTD = 0, realizadoYTD = 0, anoAntYTD = 0, anoAntAnual = 0;
    byMes.forEach((v, mes) => {
      metaAnual   += v.meta;
      anoAntAnual += v.anoAnt;
      if (mes <= mesAtual) {
        realizadoYTD += v.realizado;
        metaYTD      += v.meta;
        anoAntYTD    += v.anoAnt;
      }
    });

    const metaRef    = hasMeta ? metaYTD    : anoAntYTD;
    const metaRefAno = hasMeta ? metaAnual  : anoAntAnual;
    const pctAtingido = metaRef > 0 ? (realizadoYTD / metaRef * 100) : null;
    const projecao    = mesAtual > 0 ? (realizadoYTD / mesAtual) * 12 : 0;

    return { metaRef, metaRefAno, realizadoYTD, pctAtingido, projecao };
  }, [byMes, hasMeta, mesAtual]);

  // ── Opção do gráfico mensal ────────────────────────────────────────────────
  const chartOption = useMemo(() => {
    if (!byMes.size) return null;

    const realArr = MES.map((_, i) => byMes.get(i + 1)?.realizado ?? 0);
    const metaArr = hasMeta ? MES.map((_, i) => byMes.get(i + 1)?.meta ?? 0) : null;
    const antArr  = MES.map((_, i) => byMes.get(i + 1)?.anoAnt ?? 0);
    const pctArr  = hasMeta
      ? MES.map((_, i) => {
          const v = byMes.get(i + 1);
          return v && v.meta > 0 ? +(v.realizado / v.meta * 100).toFixed(1) : null;
        })
      : null;

    const series: any[] = [];

    // Meta (barras fantasma cinza)
    if (metaArr) {
      series.push({
        name: 'Meta', type: 'bar', data: metaArr, barWidth: '28%', z: 1,
        itemStyle: {
          color: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1,
          borderRadius: [4, 4, 0, 0],
        },
        label: { show: false },
      });
    }

    // Realizado (color-coded por % vs meta/anoAnt)
    series.push({
      name: 'Realizado', type: 'bar',
      barWidth: hasMeta ? '28%' : '40%', z: 2,
      data: realArr.map((v, i) => {
        const mes  = i + 1;
        const mv   = byMes.get(mes);
        const base = hasMeta ? mv?.meta : mv?.anoAnt;
        const pct  = base && base > 0 ? v / base * 100 : null;
        const c    = pct !== null ? cor(pct) : BI.teal;
        return {
          value: v,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: `${c}dd` }, { offset: 1, color: `${c}44` }] },
          },
        };
      }),
    });

    // Ano anterior (linha tracejada)
    series.push({
      name: `${anoAtual - 1}`, type: 'line', data: antArr, z: 3,
      lineStyle: { color: BI.purple, width: 1.5, type: 'dashed' },
      itemStyle: { color: BI.purple }, symbol: 'circle', symbolSize: 3,
    });

    // % de atingimento (eixo secundário, só quando há metas)
    if (pctArr) {
      series.push({
        name: '% Meta', type: 'line', yAxisIndex: 1, data: pctArr, z: 4,
        lineStyle: { color: BI.warning, width: 2 },
        itemStyle: { color: BI.warning }, symbol: 'circle', symbolSize: 5,
        markLine: {
          silent: true, symbol: 'none',
          data: [{ yAxis: 100 }],
          lineStyle: { color: `${BI.success}55`, type: 'dashed', width: 1 },
          label: { show: true, position: 'end', color: BI.success, fontSize: 9, formatter: '100%' },
        },
      });
    }

    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 40, bottom: 30, left: 0, right: hasMeta ? 55 : 20, containLabel: true },
      legend: {
        top: 6, icon: 'roundRect', itemWidth: 12, itemHeight: 8,
        textStyle: { color: BI.textSec, fontSize: 10 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 12, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.55);min-width:200px;',
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (params: any[]) => {
          let html = `<div style="font-weight:800;font-size:13px;color:${BI.text};margin-bottom:8px;">${params[0]?.name}</div>`;
          for (const pp of params) {
            if (pp.value == null) continue;
            const isPct  = pp.seriesName === '% Meta';
            const isLine = pp.seriesType === 'line';
            const val    = isPct ? `${pp.value.toFixed(1)}%` : fmtBRL(pp.value);
            const c      = isPct
              ? (pp.value >= 100 ? BI.success : pp.value >= 70 ? BI.warning : BI.danger)
              : isLine ? BI.purple : BI.teal;
            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px;">
              <span style="color:${BI.textMuted};font-size:11px;">${pp.seriesName}</span>
              <span style="color:${c};font-weight:700;font-size:12px;font-family:monospace;">${val}</span>
            </div>`;
          }
          return html;
        },
      },
      xAxis: {
        type: 'category', data: MES,
        axisLabel: { color: BI.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: BI.border } }, splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { color: BI.textMuted, fontSize: 10, formatter: (v: number) => fmtBRL(v) },
          splitLine: { lineStyle: { color: BI.border, type: 'dashed' } },
          axisLine: { show: false },
        },
        ...(hasMeta ? [{
          type: 'value', min: 0, max: 160, position: 'right',
          axisLabel: { color: `${BI.warning}aa`, fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
        }] : []),
      ],
      series,
    };
  }, [byMes, hasMeta, anoAtual]);

  // ── Status por mês ────────────────────────────────────────────────────────
  const mesesStatus = useMemo(() => {
    const all = MES.map((nome, i) => {
      const mes = i + 1;
      const v   = byMes.get(mes);
      if (!v || (v.realizado === 0 && v.anoAnt === 0 && v.meta === 0)) {
        return { mes, nome, status: 'empty' as const, pct: undefined as number | undefined };
      }
      const base = hasMeta && v.meta > 0 ? v.meta : v.anoAnt;
      if (!base) return { mes, nome, status: 'empty' as const, pct: undefined };
      const pct    = +(v.realizado / base * 100).toFixed(1);
      const status = pct >= 100 ? 'ok' : pct >= 70 ? 'risco' : 'critico';
      return { mes, nome, status: status as 'ok' | 'risco' | 'critico', pct };
    });
    return isCurrentYear ? all.slice(0, mesAtual) : all;
  }, [byMes, hasMeta, mesAtual, isCurrentYear]);

  const futureMeses = useMemo(
    () => (isCurrentYear ? MES.slice(mesAtual).map((nome, i) => ({ mes: mesAtual + i + 1, nome })) : []),
    [mesAtual, isCurrentYear],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={110} />)}
        </div>
        <SkeletonCard height={280} />
        <div className="grid grid-cols-3 gap-4">
          <SkeletonCard height={340} className="col-span-2" />
          <SkeletonCard height={340} />
        </div>
      </div>
    );
  }

  const pctAtingido = kpis?.pctAtingido ?? null;
  const pctColor    = pctAtingido !== null ? cor(pctAtingido) : BI.textMuted;
  const isAlerta    = isCurrentYear
    && pctAtingido !== null
    && pctAtingido < 80
    && (kpis?.metaRef ?? 0) > 0;

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: BI.text }}>
          METAS & PERFORMANCE
        </h2>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: BI.text }}>
          {hasMeta ? 'METAS FORMAIS ATIVAS' : `BASE COMPARATIVA: ${anoAtual - 1}`} · {anoAtual}
        </p>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <MiniKPI
          topColor={BI.textMuted}
          label={`${hasMeta ? 'Meta' : 'Ano Anterior'} · até ${MES[mesAtual - 1]}`}
          value={kpis ? fmtBRL(kpis.metaRef) : '—'}
          sub={kpis ? `Ref. anual: ${fmtBRL(kpis.metaRefAno)}` : undefined}
        />
        <MiniKPI
          topColor={BI.teal}
          label="Realizado YTD"
          value={kpis ? fmtBRL(kpis.realizadoYTD) : '—'}
          sub={`Acumulado até ${MES[mesAtual - 1]} / ${anoAtual}`}
        />
        <MiniKPI
          topColor={pctColor}
          label="% Atingido"
          value={pctAtingido !== null ? `${pctAtingido.toFixed(1)}%` : '—'}
          progress={pctAtingido !== null ? Math.min(pctAtingido, 100) : 0}
          progressColor={pctColor}
        />
        {kpis ? (() => {
          const ok   = kpis.projecao >= kpis.metaRefAno;
          const diff = Math.abs(kpis.projecao - kpis.metaRefAno);
          return (
            <MiniKPI
              topColor={ok ? BI.success : BI.warning}
              label="Projeção Final"
              value={fmtBRL(kpis.projecao)}
              sub={`${ok ? '+' : '-'}${fmtBRL(diff)} ${ok ? 'acima' : 'abaixo'} da ref.`}
              subColor={ok ? BI.success : BI.danger}
            />
          );
        })() : <SkeletonCard height={110} />}
      </div>

      {/* ── Alerta de Lacuna ───────────────────────────────────────────────── */}
      {isAlerta && kpis && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{ background: `${BI.danger}10`, border: `1px solid ${BI.danger}35` }}>
          <AlertTriangle size={18} style={{ color: BI.danger, flexShrink: 0 }} />
          <div>
            <p className="text-sm font-black" style={{ color: BI.danger }}>
              Lacuna: {fmtBRL(kpis.metaRef - kpis.realizadoYTD)} abaixo do esperado até {MES[mesAtual - 1]}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: BI.textMuted }}>
              Projeção de {fmtBRL(kpis.projecao)} ficará abaixo da referência anual de {fmtBRL(kpis.metaRefAno)} se o ritmo atual se mantiver.
            </p>
          </div>
        </div>
      )}

      {/* ── Gráfico Mensal ─────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <SL label={hasMeta
              ? 'Realizado × Meta × Ano Anterior'
              : `${anoAtual} vs ${anoAtual - 1} · Evolução Mensal`}
            />
            <p className="text-xs -mt-2" style={{ color: BI.textMuted }}>
              {hasMeta
                ? 'Verde ≥100% · Mostarda 70–99% · Coral <70% · Linha tracejada = ano anterior'
                : 'Barras = ano atual · Linha tracejada = ano anterior'}
            </p>
          </div>
          {hasMeta && (
            <div className="flex gap-3 text-[10px] font-black uppercase tracking-wide opacity-70">
              {([BI.success, BI.warning, BI.danger] as const).map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                  {i === 0 ? '≥100%' : i === 1 ? '70–99%' : '<70%'}
                </span>
              ))}
            </div>
          )}
        </div>
        {chartOption
          ? <ReactECharts option={chartOption} style={{ height: 265 }} opts={{ renderer: 'canvas' }} />
          : <p className="text-center py-16 text-sm font-bold" style={{ color: BI.textMuted }}>Sem dados mensais</p>
        }
      </div>

      {/* ── Ranking Indústrias + Status Mensal ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Ranking — col 2 */}
        <div className="col-span-2 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <SL label="Ranking de Indústrias" />
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full -mt-3"
              style={{ background: `${BI.accentSoft}`, color: BI.textMuted, border: `1px solid ${BI.border}` }}>
              {hasMeta ? 'vs meta' : `vs ${anoAtual - 1}`}
            </span>
          </div>
          {!industrias.length ? (
            <p className="text-sm font-bold text-center py-10" style={{ color: BI.textMuted }}>Sem dados</p>
          ) : (
            <div className="space-y-3">
              {industrias.map((ind: any, i: number) => {
                const pct   = ind.pct_meta  ? parseFloat(ind.pct_meta)  : null;
                const delta = ind.delta_pct ? parseFloat(ind.delta_pct) : null;
                const c     = pct !== null ? cor(pct) : BI.teal;
                const maxT  = parseFloat(industrias[0]?.total_atual || '1');
                const barW  = Math.round(parseFloat(ind.total_atual) / maxT * 100);

                return (
                  <div key={ind.for_codigo}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black w-5 text-right opacity-30"
                          style={{ color: BI.text }}>{i + 1}</span>
                        <span className="text-[13px] font-bold truncate max-w-[200px]"
                          style={{ color: BI.text }}>{ind.nome}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {pct !== null && (
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: `${c}18`, color: c, border: `1px solid ${c}35` }}>
                            {pct.toFixed(1)}%
                          </span>
                        )}
                        {delta !== null && (
                          <span className="text-[11px] font-bold"
                            style={{ color: delta >= 0 ? BI.success : BI.danger }}>
                            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                          </span>
                        )}
                        <span className="text-[13px] font-black"
                          style={{ color: BI.teal, fontFamily: 'monospace' }}>
                          {fmtBRL(parseFloat(ind.total_atual))}
                        </span>
                      </div>
                    </div>
                    <div className="ml-7 h-1.5 rounded-full" style={{ background: BI.border }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${barW}%`, background: c, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Mensal — col 1 */}
        <div className="glass-card rounded-2xl p-5">
          <SL label={hasMeta ? 'Status por Mês' : 'YoY por Mês'} />
          <div className="grid grid-cols-3 gap-2">
            {mesesStatus.map(m => {
              const c = m.status === 'ok'
                ? BI.success : m.status === 'risco'
                ? BI.warning  : m.status === 'critico'
                ? BI.danger   : BI.textMuted;
              return (
                <div key={m.mes} className="rounded-xl p-2 text-center"
                  style={{ background: `${c}12`, border: `1px solid ${c}28` }}>
                  <p className="text-[10px] font-black" style={{ color: BI.textMuted }}>{m.nome}</p>
                  <p className="text-[13px] font-black leading-none mt-0.5"
                    style={{ color: c, fontFamily: 'monospace' }}>
                    {m.pct !== undefined ? `${m.pct.toFixed(0)}%` : '—'}
                  </p>
                </div>
              );
            })}
            {futureMeses.map(m => (
              <div key={m.mes} className="rounded-xl p-2 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BI.border}` }}>
                <p className="text-[10px] font-black opacity-25" style={{ color: BI.textMuted }}>{m.nome}</p>
                <p className="text-[11px] opacity-20 leading-none mt-0.5" style={{ color: BI.textMuted }}>—</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${BI.border}` }}>
            {([
              [BI.success, 'Meta atingida (≥100%)'],
              [BI.warning, 'Em risco (70–99%)'],
              [BI.danger,  'Crítico (<70%)'],
            ] as const).map(([c, l]) => (
              <div key={l} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: BI.textMuted }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetasTab;
