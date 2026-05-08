import { useEffect, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { ArrowLeftRight, TrendingUp, TrendingDown, ShoppingCart, Store } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN, ECHARTS_THEME } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Kpis {
  si_valor:         number;
  si_qtd:           number;
  si_clientes:      number;
  so_valor:         number;
  so_qtd:           number;
  so_clientes:      number;
  sell_through_pct: number;
  so_var_pct:       number;
  // novos
  si_faturado:      number;
  fulfillment_pct:  number | null;
  fulfillment_gap:  number;
  estoque_gap:      number;
  periodo_dias:     number;
  si_media_diaria:  number | null;
  so_media_diaria:  number | null;
}

interface RankingItem { nome: string; valor: number; qtd: number; }
interface Ranking     { sell_in: RankingItem[]; sell_out: RankingItem[]; }

interface CruzRow {
  tipo:            'grupo' | 'filial';
  nome:            string;
  uf:              string | null;
  grupo:           string | null;
  si_valor:        number;
  si_qtd:          number;
  so_valor:        number;
  so_qtd:          number;
  so_prev_valor:   number;
  so_prev_qtd:     number;
  sell_through_pct: number;
  so_var_pct:      number;
  so_var_qtd_pct:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SL = ({ label }: { label: string }) => (
  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BI.textMuted }}>
    {label}
  </p>
);

const VarChip = ({ val }: { val: number }) => {
  const up = val >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 800,
      color:      up ? BI.success    : BI.danger,
      background: up ? `${BI.success}18` : `${BI.danger}18`,
      borderRadius: 6, padding: '2px 7px',
    }}>
      {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(val).toFixed(1)}%
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) => (
  <div className="glass-card rounded-2xl p-5 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: BI.textMuted }}>
        {label}
      </span>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={accent} />
      </div>
    </div>
    <div style={{ fontSize: 22, fontWeight: 900, color: BI.text, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: BI.textMuted }}>{sub}</div>}
  </div>
);

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
const RankingChart = ({ title, data, color }: { title: string; data: RankingItem[]; color: string }) => {
  const option = {
    tooltip: {
      ...ECHARTS_THEME.tooltip,
      formatter: (p: any) => `<b>${p.name}</b><br/>R$ ${fmtBRL(p.value)}`,
    },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { ...ECHARTS_THEME.axisLabel, formatter: (v: number) => fmtBRL(v) },
      splitLine: ECHARTS_THEME.splitLine,
    },
    yAxis: {
      type: 'category',
      data: [...data].reverse().map(d => d.nome),
      axisLabel: { ...ECHARTS_THEME.axisLabel, width: 130, overflow: 'truncate' as const },
    },
    series: [{
      type: 'bar',
      data: [...data].reverse().map(d => d.valor),
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: `${color}80` },
            { offset: 1, color: color },
          ],
        },
      },
      barMaxWidth: 18,
    }],
  };

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <SL label={title} />
      {data.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: BI.textMuted, fontSize: 12 }}>Sem dados</div>
        : <ReactECharts option={option} style={{ height: 320 }} theme="dark" />
      }
    </div>
  );
};

// ─── Cruzamento Table ─────────────────────────────────────────────────────────
const CruzamentoTable = ({ rows }: { rows: CruzRow[] }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((nome: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });
  }, []);

  if (rows.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: BI.textMuted, fontSize: 12 }}>Sem dados</div>
  );

  const th: React.CSSProperties = {
    padding: '8px 10px', fontSize: 9, fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    color: BI.textMuted, textAlign: 'right',
    borderBottom: `1px solid ${BI.border}`,
    whiteSpace: 'nowrap',
  };
  const thLeft: React.CSSProperties = { ...th, textAlign: 'left' };

  return (
    <div style={{ overflowX: 'auto' }} className="bi-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
            <th style={thLeft}>Cliente / Grupo</th>
            <th style={th}>UF</th>
            <th style={th}>SI R$</th>
            <th style={th}>SI Qtd</th>
            <th style={th}>SO R$</th>
            <th style={th}>SO Qtd</th>
            <th style={th}>S-Through</th>
            <th style={th}>Var SO%</th>
            <th style={th}>Var Qtd%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isGrupo = row.tipo === 'grupo';
            const isOpen  = isGrupo && expanded.has(row.nome);

            if (!isGrupo && !expanded.has(row.grupo ?? '')) return null;

            const tdBase: React.CSSProperties = {
              padding: isGrupo ? '10px 10px' : '7px 10px',
              borderBottom: `1px solid ${BI.border}`,
              textAlign: 'right',
              color: isGrupo ? BI.teal : BI.textSec,
              fontWeight: isGrupo ? 800 : 400,
              background: isGrupo ? 'rgba(0,229,209,0.04)' : 'transparent',
              fontSize: isGrupo ? 11 : 10,
            };
            const tdName: React.CSSProperties = {
              ...tdBase, textAlign: 'left',
              paddingLeft: isGrupo ? 12 : 24,
              cursor: isGrupo ? 'pointer' : 'default',
            };

            return (
              <tr key={i}
                onClick={isGrupo ? () => toggle(row.nome) : undefined}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isGrupo ? 'rgba(0,229,209,0.08)' : 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isGrupo ? 'rgba(0,229,209,0.04)' : 'transparent'; }}
                style={{ cursor: isGrupo ? 'pointer' : 'default' }}
              >
                <td style={tdName}>
                  <span style={{
                    marginRight: 7, fontSize: 9, color: BI.teal,
                    display: 'inline-block',
                    transition: 'transform 0.15s',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}>
                    {isGrupo ? '▶' : ''}
                  </span>
                  {row.nome}
                </td>
                <td style={tdBase}>{row.uf || '—'}</td>
                <td style={tdBase}>{fmtBRL(row.si_valor)}</td>
                <td style={tdBase}>{fmtN(row.si_qtd)}</td>
                <td style={tdBase}>{fmtBRL(row.so_valor)}</td>
                <td style={tdBase}>{fmtN(row.so_qtd)}</td>
                <td style={tdBase}>
                  {row.sell_through_pct > 0
                    ? <span style={{ color: row.sell_through_pct >= 80 ? BI.success : row.sell_through_pct >= 50 ? BI.warning : BI.danger }}>
                        {row.sell_through_pct.toFixed(1)}%
                      </span>
                    : '—'}
                </td>
                <td style={tdBase}>
                  {row.so_var_pct != null && row.so_var_pct !== 0 ? <VarChip val={row.so_var_pct} /> : '—'}
                </td>
                <td style={tdBase}>
                  {row.so_var_qtd_pct != null && row.so_var_qtd_pct !== 0 ? <VarChip val={row.so_var_qtd_pct} /> : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Triângulo: nó ────────────────────────────────────────────────────────────
const TriNode = ({ label, caption, value, color }: { label: string; caption: string; value: string; color: string }) => (
  <div style={{
    flex: '0 0 auto', width: 160,
    background: `${color}12`, border: `1px solid ${color}44`,
    borderRadius: 14, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center',
  }}>
    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>{label}</span>
    <span style={{ fontSize: 18, fontWeight: 900, color: BI.text, lineHeight: 1.1 }}>{value}</span>
    <span style={{ fontSize: 9, color: BI.textMuted }}>{caption}</span>
  </div>
);

// ─── Triângulo: seta com taxa e gap ───────────────────────────────────────────
const TriArrow = ({
  label, pct, gap, gapLabel = 'não faturado', good,
}: {
  label: string; pct: number | null; gap: number; gapLabel?: string; good: boolean;
}) => {
  const accent = good ? BI.success : (pct != null && pct > 0 ? BI.warning : BI.danger);
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 6, padding: '0 8px',
    }}>
      <span style={{ fontSize: 9, color: BI.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ height: 2, flex: 1, background: accent, borderRadius: 1 }} />
        <span style={{
          fontSize: 13, fontWeight: 900, color: accent,
          background: `${accent}18`, borderRadius: 8, padding: '3px 9px', whiteSpace: 'nowrap',
        }}>
          {pct != null ? `${pct.toFixed(1)}%` : '—'}
        </span>
        <div style={{ height: 2, flex: 1, background: accent, borderRadius: 1 }} />
        <span style={{ fontSize: 10, color: accent }}>▶</span>
      </div>
      {gap > 0 && (
        <span style={{ fontSize: 9, color: BI.textMuted, textAlign: 'center' }}>
          {fmtBRL(gap)} {gapLabel}
        </span>
      )}
    </div>
  );
};

// ─── SellInOutTab ─────────────────────────────────────────────────────────────
const SellInOutTab = () => {
  const { filters } = useBIStore();
  const p = buildBIParams(filters);

  const [kpis,     setKpis]     = useState<Kpis | null>(null);
  const [ranking,  setRanking]  = useState<Ranking | null>(null);
  const [cruzRows, setCruzRows] = useState<CruzRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/bi/sell-in-out/kpis?${p}`)
        .then(r => r.data.success ? r.data.data : null).catch(() => null),
      api.get(`/bi/sell-in-out/ranking?${p}`)
        .then(r => r.data.success ? r.data.data : null).catch(() => null),
      api.get(`/bi/sell-in-out/cruzamento?${p}`)
        .then(r => r.data.success ? r.data.data ?? [] : []).catch(() => []),
    ]).then(([k, rk, crz]) => {
      setKpis(k);
      setRanking(rk);
      setCruzRows(crz);
    }).finally(() => setLoading(false));
  }, [p]);

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} height={110} />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard height={370} />
        <SkeletonCard height={370} />
      </div>
      <SkeletonCard height={420} />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${BI.teal}22`, border: `1px solid ${BI.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeftRight size={16} color={BI.teal} />
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: BI.text, margin: 0 }}>Sell In / Sell Out</h2>
          <p style={{ fontSize: 10, color: BI.textMuted, margin: 0 }}>Cruzamento entre o que foi comprado da indústria e o que foi vendido ao mercado</p>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Sell In (Compras)"
          value={kpis ? fmtBRL(kpis.si_valor) : '—'}
          sub={kpis
            ? `${fmtN(kpis.si_qtd)} un · ${kpis.si_clientes} clientes${kpis.si_media_diaria ? ` · ${fmtBRL(kpis.si_media_diaria)}/dia` : ''}`
            : undefined}
          icon={ShoppingCart}
          accent={BI.blue}
        />
        <KpiCard
          label="Sell Out (Vendas)"
          value={kpis ? fmtBRL(kpis.so_valor) : '—'}
          sub={kpis
            ? `${fmtN(kpis.so_qtd)} un · ${kpis.so_clientes} clientes${kpis.so_media_diaria ? ` · ${fmtBRL(kpis.so_media_diaria)}/dia` : ''}`
            : undefined}
          icon={Store}
          accent={BI.teal}
        />
        <KpiCard
          label="Sell-Through"
          value={kpis && kpis.sell_through_pct > 0 ? `${kpis.sell_through_pct.toFixed(1)}%` : '—'}
          sub="Sell Out ÷ Sell In"
          icon={ArrowLeftRight}
          accent={kpis && kpis.sell_through_pct >= 80 ? BI.success : kpis && kpis.sell_through_pct >= 50 ? BI.warning : BI.danger}
        />
        <KpiCard
          label="Var. Sell Out"
          value={kpis && kpis.so_var_pct != null && kpis.so_var_pct !== 0 ? `${kpis.so_var_pct >= 0 ? '+' : ''}${kpis.so_var_pct.toFixed(1)}%` : '—'}
          sub="vs período anterior"
          icon={kpis && kpis.so_var_pct >= 0 ? TrendingUp : TrendingDown}
          accent={kpis && kpis.so_var_pct >= 0 ? BI.success : BI.danger}
        />
      </div>

      {/* ── Triângulo Pedido → Faturado → Sell Out ─────────────────────────── */}
      {kpis && (kpis.si_valor > 0 || kpis.so_valor > 0) && (
        <div className="glass-card rounded-2xl p-6">
          <SL label="Fluxo — Pedido › Faturado › Venda ao Mercado" />
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>

            {/* Nó 1: Pedidos Totais */}
            <TriNode
              label="Pedidos Totais"
              caption="P + F"
              value={fmtBRL(kpis.si_valor)}
              color={BI.blue}
            />

            {/* Seta 1: fulfillment */}
            <TriArrow
              label="Taxa de Faturamento"
              pct={kpis.fulfillment_pct}
              gap={kpis.fulfillment_gap}
              good={kpis.fulfillment_pct != null && kpis.fulfillment_pct >= 85}
            />

            {/* Nó 2: Faturado */}
            <TriNode
              label="Faturado (SI)"
              caption="Status F"
              value={fmtBRL(kpis.si_faturado)}
              color={BI.purple}
            />

            {/* Seta 2: sell-through */}
            <TriArrow
              label="Sell-Through"
              pct={kpis.sell_through_pct}
              gap={kpis.estoque_gap}
              gapLabel="estoque est."
              good={kpis.sell_through_pct != null && kpis.sell_through_pct >= 70}
            />

            {/* Nó 3: Sell Out */}
            <TriNode
              label="Sell Out"
              caption="Mercado"
              value={fmtBRL(kpis.so_valor)}
              color={BI.teal}
            />
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: BI.textMuted }}>
            Período: {kpis.periodo_dias} dias corridos · Média diária SI: {fmtBRL(kpis.si_media_diaria ?? 0)} · SO: {fmtBRL(kpis.so_media_diaria ?? 0)}
          </div>
        </div>
      )}

      {/* ── Rankings ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <RankingChart
          title="Top Clientes — Sell In (Compras da Ind.)"
          data={ranking?.sell_in ?? []}
          color={BI.blue}
        />
        <RankingChart
          title="Top Clientes — Sell Out (Vendas Realizadas)"
          data={ranking?.sell_out ?? []}
          color={BI.teal}
        />
      </div>

      {/* ── Cruzamento ─────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5">
        <SL label="Cruzamento Sell In × Sell Out por Cliente / Grupo" />
        <CruzamentoTable rows={cruzRows} />
        {cruzRows.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 10, color: BI.textMuted, textAlign: 'right' }}>
            {cruzRows.filter(r => r.tipo === 'grupo').length} grupos ·{' '}
            {cruzRows.filter(r => r.tipo === 'filial').length} filiais
          </div>
        )}
      </div>

    </div>
  );
};

export default SellInOutTab;
