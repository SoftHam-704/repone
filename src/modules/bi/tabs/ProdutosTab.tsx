import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Package } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Overview {
  total_faturado: string;
  skus_distintos: number;
  grupos_ativos: number;
  cobertura_pct: string;
}
interface GrupoRow {
  gru_codigo: number;
  gru_nome: string;
  total_current: number;
  total_previous: number;
  yoy_pct: number | null;
  quantidade_current: number;
  skus_count: number;
  clientes_count: number;
}
interface SkuRow {
  ite_produto: string;
  pro_nome: string;
  gru_nome: string;
  total: string;
  quantidade: string;
  pedidos: number;
  pct_total: string;
}
interface CategoriaRow {
  categoria: string;
  total: string;
  quantidade: string;
  pedidos: number;
  produtos: number;
}

// ─── SLabel ───────────────────────────────────────────────────────────────────
const SL = ({ label }: { label: string }) => (
  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BI.textMuted }}>
    {label}
  </p>
);

// ─── ProdutosTab ──────────────────────────────────────────────────────────────
const ProdutosTab = () => {
  const { filters, visao } = useBIStore();
  const p = buildBIParams(filters);
  const anoAtual = Math.max(...filters.anos);

  const [overview,   setOverview]   = useState<Overview | null>(null);
  const [grupos,     setGrupos]     = useState<GrupoRow[]>([]);
  const [skus,       setSkus]       = useState<SkuRow[]>([]);
  const [categorias, setCategorias] = useState<CategoriaRow[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/bi/produtos-overview?${p}`)
        .then(r => r.data.success ? r.data.data : null).catch(() => null),
      api.get(`/bi/produtos-por-grupo?${p}&metrica=${visao}`)
        .then(r => r.data.success ? r.data.data ?? [] : []).catch(() => []),
      api.get(`/bi/top-skus?${p}&metrica=${visao}`)
        .then(r => r.data.success ? r.data.data ?? [] : []).catch(() => []),
      api.get(`/bi/vendas-categorias?${p}`)
        .then(r => r.data.success ? r.data.data ?? [] : []).catch(() => []),
    ]).then(([ov, gr, sk, cat]) => {
      setOverview(ov);
      setGrupos(gr);
      setSkus(sk);
      setCategorias(cat);
    }).finally(() => setLoading(false));
  }, [p, visao]);

  // ── Gráfico: categorias de linha ──────────────────────────────────────────
  const categoriasOption = useMemo(() => {
    const getVal = (r: CategoriaRow): number => {
      if (visao === 'volume') return parseFloat(r.quantidade);
      if (visao === 'skus')   return r.produtos;
      return parseFloat(r.total);
    };
    const fmtVal = (v: number) => visao === 'financeiro' ? fmtBRL(v) : fmtN(v);
    const unitSuffix = visao === 'volume' ? ' un.' : visao === 'skus' ? ' SKUs' : '';

    const rows = categorias.filter(c => getVal(c) > 0);
    if (!rows.length) return null;
    const totalGeral = rows.reduce((s, r) => s + getVal(r), 0);
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 8, bottom: 8, left: 8, right: 130, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (params: any[]) => {
          const r = rows[params[0].dataIndex];
          const v = getVal(r);
          const pct = totalGeral > 0 ? ((v / totalGeral) * 100).toFixed(1) : '0';
          const c = CHART_COLORS[params[0].dataIndex % CHART_COLORS.length];
          const extra = visao === 'financeiro'
            ? `<br/><span style="font-size:10px;color:${BI.textMuted}">${pct}% do total · ${fmtN(parseFloat(r.quantidade))} unid.</span>`
            : `<br/><span style="font-size:10px;color:${BI.textMuted}">${pct}% do total</span>`;
          return `<b>${r.categoria}</b><br/>
            <span style="font-family:monospace;font-weight:700;color:${c}">${fmtVal(v)}${unitSuffix}</span>${extra}`;
        },
      },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: BI.border, type: 'dashed' } } },
      yAxis: {
        type: 'category',
        data: rows.map(r => r.categoria),
        axisLabel: { color: BI.textSec, fontSize: 11, fontWeight: 700 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'bar', barMaxWidth: 28,
        data: rows.map((r, i) => {
          const c = CHART_COLORS[i % CHART_COLORS.length];
          const v = getVal(r);
          const pct = totalGeral > 0 ? ((v / totalGeral) * 100).toFixed(1) : '0';
          return {
            value: v,
            itemStyle: { borderRadius: [0, 6, 6, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: `${c}cc` }, { offset: 1, color: `${c}44` }] } },
            label: { show: true, position: 'right', formatter: () => `${fmtVal(v)}  ${pct}%`, color: BI.textMuted, fontSize: 9, fontWeight: 700 },
          };
        }),
      }],
    };
  }, [categorias, visao]);

  // ── Gráfico: top grupos ───────────────────────────────────────────────────
  const gruposOption = useMemo(() => {
    if (!grupos.length) return null;
    const rows = [...grupos].reverse();
    const getGrupoVal = (r: GrupoRow): number => {
      if (visao === 'volume') return r.quantidade_current ?? 0;
      if (visao === 'skus')   return r.skus_count;
      return r.total_current;
    };
    const fmtGrupoVal = (v: number) => visao === 'financeiro' ? fmtBRL(v) : fmtN(v);
    const unitSuffix = visao === 'volume' ? ' un.' : visao === 'skus' ? ' SKUs' : '';
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 8, bottom: 8, left: 8, right: 140, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (params: any[]) => {
          const r = rows[params[0].dataIndex];
          const c = CHART_COLORS[params[0].dataIndex % CHART_COLORS.length];
          const yoy = r.yoy_pct;
          return `<b>${r.gru_nome}</b><br/>
            <span style="font-family:monospace;font-weight:700;color:${c}">${fmtGrupoVal(getGrupoVal(r))}${unitSuffix}</span>
            ${yoy !== null && visao === 'financeiro' ? `<br/><span style="color:${yoy >= 0 ? BI.success : BI.danger};font-size:10px;">${yoy >= 0 ? '▲' : '▼'} ${Math.abs(yoy).toFixed(1)}% YoY</span>` : ''}
            <br/><span style="font-size:10px;color:${BI.textMuted}">${r.skus_count} SKUs · ${r.clientes_count} clientes</span>`;
        },
      },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: BI.border, type: 'dashed' } } },
      yAxis: {
        type: 'category',
        data: rows.map(r => r.gru_nome.length > 22 ? r.gru_nome.substring(0, 20) + '…' : r.gru_nome),
        axisLabel: { color: BI.textSec, fontSize: 10, fontWeight: 700 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'bar', barMaxWidth: 22,
        data: rows.map((r, i) => {
          const c = CHART_COLORS[i % CHART_COLORS.length];
          return {
            value: getGrupoVal(r),
            itemStyle: { borderRadius: [0, 6, 6, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: `${c}cc` }, { offset: 1, color: `${c}44` }] } },
          };
        }),
        label: { show: true, position: 'right', formatter: (pp: any) => fmtGrupoVal(pp.value), color: BI.textMuted, fontSize: 9, fontWeight: 700 },
      }],
    };
  }, [grupos, visao]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <SkeletonCard key={i} height={100} />)}</div>
        <div className="grid grid-cols-2 gap-4"><SkeletonCard height={260} /><SkeletonCard height={260} /></div>
        <SkeletonCard height={360} />
      </div>
    );
  }

  if (!overview && !skus.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <Package size={40} style={{ color: BI.textMuted }} />
        <p className="text-base font-black" style={{ color: BI.textMuted }}>Sem dados de produtos para o período</p>
      </div>
    );
  }

  const cobPct   = overview ? parseFloat(overview.cobertura_pct) : 0;
  const maxTotal = skus.length ? parseFloat(skus[0].total) : 1;

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: BI.text }}>PRODUTOS</h2>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: BI.text }}>
          PORTFÓLIO & PERFORMANCE · {anoAtual}
        </p>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">

        <div className="glass-card rounded-2xl p-4" style={{ borderTop: `2px solid ${BI.teal}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: BI.textMuted }}>Total Faturado</p>
          <p className="text-xl font-black" style={{ color: BI.teal, fontFamily: 'monospace' }}>
            {overview ? fmtBRL(parseFloat(overview.total_faturado)) : '—'}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4" style={{ borderTop: `2px solid ${CHART_COLORS[1]}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: BI.textMuted }}>SKUs Vendidos</p>
          <p className="text-xl font-black" style={{ color: CHART_COLORS[1], fontFamily: 'monospace' }}>
            {overview ? fmtN(overview.skus_distintos) : '—'}
          </p>
          <p className="text-[10px] mt-1" style={{ color: BI.textMuted }}>produtos distintos no período</p>
        </div>

        <div className="glass-card rounded-2xl p-4" style={{ borderTop: `2px solid ${CHART_COLORS[4]}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: BI.textMuted }}>Grupos Ativos</p>
          <p className="text-xl font-black" style={{ color: CHART_COLORS[4], fontFamily: 'monospace' }}>
            {overview ? fmtN(overview.grupos_ativos) : '—'}
          </p>
          <p className="text-[10px] mt-1" style={{ color: BI.textMuted }}>grupos com pelo menos 1 venda</p>
        </div>

        <div className="glass-card rounded-2xl p-4" style={{ borderTop: `2px solid ${cobPct >= 60 ? BI.success : BI.warning}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: BI.textMuted }}>Cobertura do Portfólio</p>
          <p className="text-xl font-black" style={{ color: cobPct >= 60 ? BI.success : BI.warning, fontFamily: 'monospace' }}>
            {overview ? `${cobPct.toFixed(1)}%` : '—'}
          </p>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: BI.border }}>
            <div style={{ width: `${Math.min(cobPct, 100)}%`, height: '100%', borderRadius: 2, background: cobPct >= 60 ? BI.success : BI.warning, transition: 'width 0.8s ease' }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: BI.textMuted }}>SKUs vendidos ÷ total no catálogo</p>
        </div>

      </div>

      {/* ── Grid: Categorias + Grupos ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        <div className="glass-card rounded-2xl p-5">
          <SL label="Vendas por Categoria de Linha" />
          <p className="text-xs -mt-2 mb-4" style={{ color: BI.textMuted }}>
            Valor faturado · % do total do período
          </p>
          {categoriasOption
            ? <ReactECharts option={categoriasOption} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
            : <p className="text-center py-10 text-sm font-bold" style={{ color: BI.textMuted }}>Sem categorias cadastradas</p>
          }
        </div>

        <div className="glass-card rounded-2xl p-5">
          <SL label={visao === 'financeiro' ? 'Faturamento por Grupo de Produto' : visao === 'volume' ? 'Volume por Grupo de Produto' : 'SKUs por Grupo de Produto'} />
          <p className="text-xs -mt-2 mb-4" style={{ color: BI.textMuted }}>
            Top 12 grupos · tooltip com YoY, SKUs e clientes
          </p>
          {gruposOption
            ? <ReactECharts option={gruposOption} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
            : <p className="text-center py-10 text-sm font-bold" style={{ color: BI.textMuted }}>Sem grupos cadastrados</p>
          }
        </div>

      </div>

      {/* ── Top SKUs ───────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5">
        <SL label={`Top ${skus.length} SKUs — Ranking do Período`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['#', 'Código', 'Produto', 'Grupo', 'Faturamento', 'Qtd', '% Portfólio', 'Pedidos'].map(h => (
                  <th key={h} style={{
                    padding: '6px 10px',
                    textAlign: ['#', 'Qtd', 'Pedidos'].includes(h) ? 'center' : 'left',
                    fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: BI.textMuted,
                    borderBottom: `1px solid ${BI.border}`, whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skus.map((row, i) => {
                const pct  = parseFloat(row.pct_total);
                const barW = maxTotal > 0 ? (parseFloat(row.total) / maxTotal) * 100 : 0;
                return (
                  <tr key={row.ite_produto}
                    style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: BI.textMuted, fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: BI.teal, letterSpacing: '0.02em' }}>
                        {row.ite_produto}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: BI.textSec, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.pro_nome || '—'}
                    </td>
                    <td style={{ padding: '7px 10px', color: BI.textMuted, fontSize: 11 }}>{row.gru_nome || '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: BI.text, whiteSpace: 'nowrap' }}>
                      {fmtBRL(parseFloat(row.total))}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: BI.textSec }}>
                      {fmtN(parseFloat(row.quantidade))}
                    </td>
                    <td style={{ padding: '7px 10px', minWidth: 110 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: BI.border }}>
                          <div style={{ width: `${barW}%`, height: '100%', borderRadius: 2, background: BI.teal }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: BI.textMuted, minWidth: 36, textAlign: 'right' }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: BI.textMuted }}>{row.pedidos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ProdutosTab;
