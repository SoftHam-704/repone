import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Users } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';
import { SellerPerformanceTable } from '../components/SellerPerformanceTable';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#00e5d1', '#BC66FF', '#ffd166', '#b4ff9d', '#00B2FF', '#ff8a7a'] as const;

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const SL = ({ label }: { label: string }) => (
  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BI.textMuted }}>
    {label}
  </p>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface SellerRow {
  ven_codigo: number;
  ven_nome: string;
  total_value_current: string;
  total_value_previous: string;
  mom_value_percent: string | null;
  clients_previous: string;
  new_clients: string;
  reactivated_clients: string;
  new_skus_count: string;
  new_skus_value: string;
}

// ─── Pódio Top 3 ─────────────────────────────────────────────────────────────
// Ordem clássica: 2º à esquerda, 1º no centro, 3º à direita
const PODIUM_ORDER   = [1, 0, 2];       // índices do array sellers[]
const PODIUM_HEIGHTS = [130, 170, 100]; // altura do bloco (esq, centro, dir)
const PODIUM_MEDALS  = ['🥈', '🏆', '🥉'];
const PODIUM_BG      = [
  'rgba(192,192,192,0.12)',
  'rgba(255,215,0,0.15)',
  'rgba(205,127,50,0.12)',
];
const PODIUM_BORDER = [
  'rgba(192,192,192,0.30)',
  'rgba(255,215,0,0.40)',
  'rgba(205,127,50,0.30)',
];

const Podium = ({ sellers }: { sellers: SellerRow[] }) => {
  const top3 = sellers.slice(0, 3);
  if (!top3.length) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      gap: 8, padding: '20px 24px 0',
    }}>
      {PODIUM_ORDER.map((rank, posIdx) => {
        const s     = top3[rank];
        const isTop = rank === 0;
        const blockH = PODIUM_HEIGHTS[posIdx];

        if (!s) return <div key={posIdx} style={{ flex: 1 }} />;

        const color = avatarColor(s.ven_nome);
        const ini   = initials(s.ven_nome);
        const mom   = s.mom_value_percent !== null ? parseFloat(s.mom_value_percent) : null;
        const total = parseFloat(s.total_value_current);

        return (
          <div key={s.ven_codigo}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* Avatar */}
            <div style={{
              width: isTop ? 72 : 56, height: isTop ? 72 : 56,
              borderRadius: '50%',
              background: `${color}25`,
              border: `${isTop ? 3 : 2}px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 8,
              boxShadow: isTop ? `0 0 28px ${color}55` : 'none',
              fontSize: isTop ? 22 : 17, fontWeight: 900, color,
              fontFamily: 'monospace', letterSpacing: '-0.02em',
            }}>
              {ini}
            </div>

            {/* Nome */}
            <p style={{
              fontSize: isTop ? 12 : 11, fontWeight: 900,
              color: BI.text, textTransform: 'uppercase',
              letterSpacing: '0.05em', lineHeight: 1.2,
              textAlign: 'center', marginBottom: 4,
              maxWidth: 140,
            }}>
              {s.ven_nome}
            </p>

            {/* Valor */}
            <p style={{
              fontSize: isTop ? 13 : 11, fontWeight: 900,
              color, fontFamily: 'monospace', marginBottom: 3,
            }}>
              {fmtBRL(total)}
            </p>

            {/* YoY */}
            {mom !== null && (
              <p style={{
                fontSize: 10, fontWeight: 700, marginBottom: 10,
                color: mom >= 0 ? BI.success : BI.danger,
              }}>
                {fmtPct(mom)} YoY
              </p>
            )}

            {/* Bloco do pódio */}
            <div style={{
              width: '100%', height: blockH,
              background: PODIUM_BG[posIdx],
              border: `1px solid ${PODIUM_BORDER[posIdx]}`,
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              display: 'flex', alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: 10,
              fontSize: isTop ? 28 : 22,
            }}>
              {PODIUM_MEDALS[posIdx]}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── EquipeTab ────────────────────────────────────────────────────────────────
const EquipeTab = () => {
  const { filters } = useBIStore();
  const p = buildBIParams(filters);
  const anoAtual = Math.max(...filters.anos);

  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [crm,     setCrm]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Parallel fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/bi/sellers-performance?${p}`)
        .then(r => r.data.success ? r.data.data ?? [] : [])
        .catch(() => [] as SellerRow[]),
      api.get('/crm/interacoes?limit=500')
        .then(r => r.data.success ? r.data.data ?? [] : [])
        .catch(() => [] as any[]),
    ])
      .then(([s, c]) => { setSellers(s); setCrm(c); })
      .finally(() => setLoading(false));
  }, [p]);

  // ── CRM agregado por vendedor ──────────────────────────────────────────────
  const crmBySeller = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>();
    for (const row of crm) {
      const nome = (row.ven_nome as string | undefined)?.trim() || 'Sem vendedor';
      const prev = map.get(nome) ?? { nome, count: 0 };
      map.set(nome, { ...prev, count: prev.count + 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [crm]);

  // ── Gráfico: faturamento por vendedor ──────────────────────────────────────
  const perfOption = useMemo(() => {
    if (!sellers.length) return null;
    const rows = [...sellers].slice(0, 8).reverse();
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 8, bottom: 8, left: 8, right: 100, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [10, 14],
        extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,0.5);',
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (params: any[]) => {
          const idx = rows.length - 1 - params[0].dataIndex;
          const s   = rows[idx];
          const mom = s.mom_value_percent !== null ? parseFloat(s.mom_value_percent) : null;
          return `<b style="font-size:12px;">${s.ven_nome}</b><br/>
            <span style="color:${avatarColor(s.ven_nome)};font-family:monospace;font-weight:700;">
              ${fmtBRL(parseFloat(s.total_value_current))}
            </span>
            ${mom !== null
              ? `<br/><span style="color:${mom >= 0 ? BI.success : BI.danger};font-size:10px;">${fmtPct(mom)} YoY</span>`
              : ''}`;
        },
      },
      xAxis: {
        type: 'value', axisLabel: { show: false },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map(s => s.ven_nome.length > 16 ? s.ven_nome.substring(0, 14) + '…' : s.ven_nome),
        axisLabel: { color: BI.textSec, fontSize: 11, fontWeight: 700 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: rows.map(s => {
          const c = avatarColor(s.ven_nome);
          return {
            value: parseFloat(s.total_value_current),
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: `${c}cc` }, { offset: 1, color: `${c}44` }] },
            },
          };
        }),
        barMaxWidth: 26,
        label: {
          show: true, position: 'right',
          formatter: (pp: any) => fmtBRL(pp.value),
          color: BI.textMuted, fontSize: 9, fontWeight: 700,
        },
      }],
    };
  }, [sellers]);

  // ── Gráfico: interações CRM ────────────────────────────────────────────────
  const crmOption = useMemo(() => {
    if (!crmBySeller.length) return null;
    const rows = [...crmBySeller].reverse();
    return {
      animation: true, backgroundColor: 'transparent',
      grid: { top: 8, bottom: 8, left: 8, right: 45, containLabel: true },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'none' },
        backgroundColor: BI.panel, borderColor: BI.border,
        borderWidth: 1, borderRadius: 10, padding: [8, 12],
        textStyle: { color: BI.text, fontSize: 11 },
        formatter: (params: any[]) =>
          `<b>${rows[params[0].dataIndex].nome}</b><br/>${rows[params[0].dataIndex].count} interações`,
      },
      xAxis: {
        type: 'value', axisLabel: { show: false },
        splitLine: { lineStyle: { color: BI.border, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map(r => r.nome.length > 14 ? r.nome.substring(0, 12) + '…' : r.nome),
        axisLabel: { color: BI.textSec, fontSize: 10, fontWeight: 600 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: rows.map(r => ({
          value: r.count,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [{ offset: 0, color: `${BI.purple}cc` }, { offset: 1, color: `${BI.purple}44` }] },
          },
        })),
        barMaxWidth: 22,
        label: {
          show: true, position: 'right',
          color: BI.textMuted, fontSize: 10, fontWeight: 700,
          formatter: (pp: any) => String(pp.value),
        },
      }],
    };
  }, [crmBySeller]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard height={300} />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard height={260} />
          <SkeletonCard height={260} />
        </div>
        <SkeletonCard height={340} />
      </div>
    );
  }

  if (!sellers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <Users size={40} style={{ color: BI.textMuted }} />
        <p className="text-base font-black" style={{ color: BI.textMuted }}>
          Sem dados de equipe para o período
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: BI.text }}>
          EQUIPE
        </h2>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: BI.text }}>
          PERFORMANCE & RANKING · {anoAtual}
        </p>
      </div>

      {/* ── Pódio ──────────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl overflow-hidden"
        style={{ borderTop: `3px solid ${BI.warning}` }}>
        <div className="px-6 pt-5">
          <SL label="Pódio — Top 3 Vendedores" />
        </div>
        <Podium sellers={sellers} />
        {/* base do pódio */}
        <div style={{
          height: 6,
          background: `linear-gradient(90deg, ${BI.border} 0%, ${BI.borderStrong} 50%, ${BI.border} 100%)`,
        }} />
      </div>

      {/* ── Faturamento + CRM ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        <div className="glass-card rounded-2xl p-5">
          <SL label="Faturamento por Vendedor" />
          <p className="text-xs -mt-2 mb-4" style={{ color: BI.textMuted }}>
            Cor individual · rótulo = total do período
          </p>
          {perfOption
            ? <ReactECharts option={perfOption} style={{ height: 240 }} opts={{ renderer: 'canvas' }} />
            : <p className="text-center py-10 text-sm font-bold" style={{ color: BI.textMuted }}>Sem dados</p>
          }
        </div>

        <div className="glass-card rounded-2xl p-5">
          <SL label="Interações no CRM" />
          <p className="text-xs -mt-2 mb-4" style={{ color: BI.textMuted }}>
            Total de contatos registrados por vendedor
          </p>
          {crmOption
            ? <ReactECharts option={crmOption} style={{ height: 240 }} opts={{ renderer: 'canvas' }} />
            : <p className="text-center py-10 text-sm font-bold" style={{ color: BI.textMuted }}>
                Nenhuma interação registrada
              </p>
          }
        </div>

      </div>

      {/* ── Tabela de Performance ──────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5">
        <SellerPerformanceTable />
      </div>

    </div>
  );
};

export default EquipeTab;
