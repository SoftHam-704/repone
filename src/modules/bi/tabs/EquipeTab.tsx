import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Users, AlertTriangle, TrendingUp, Calendar, ShoppingBag } from 'lucide-react';
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

interface CockpitRow {
  ven_codigo: number;
  ven_nome: string;
  fat_mes_atual: string;
  fat_meta: string;
  pct_meta: string | null;
  clientes_risco: number;
  visitas_semana: number;
  ultima_data: string | null;
  dias_sem_pedido: number | null;
}

// ─── Pódio Top 3 ─────────────────────────────────────────────────────────────
const PODIUM_ORDER   = [1, 0, 2];
const PODIUM_HEIGHTS = [130, 170, 100];
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

            <p style={{
              fontSize: isTop ? 12 : 11, fontWeight: 900,
              color: BI.text, textTransform: 'uppercase',
              letterSpacing: '0.05em', lineHeight: 1.2,
              textAlign: 'center', marginBottom: 4,
              maxWidth: 140,
            }}>
              {s.ven_nome}
            </p>

            <p style={{
              fontSize: isTop ? 13 : 11, fontWeight: 900,
              color, fontFamily: 'monospace', marginBottom: 3,
            }}>
              {fmtBRL(total)}
            </p>

            {mom !== null && (
              <p style={{
                fontSize: 10, fontWeight: 700, marginBottom: 10,
                color: mom >= 0 ? BI.success : BI.danger,
              }}>
                {fmtPct(mom)} YoY
              </p>
            )}

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

// ─── Rep Card — Cockpit do Gestor ─────────────────────────────────────────────
function RepCard({ rep }: { rep: CockpitRow }) {
  const color = avatarColor(rep.ven_nome);
  const ini   = initials(rep.ven_nome);
  const fatAtual = parseFloat(rep.fat_mes_atual);
  const fatMeta  = parseFloat(rep.fat_meta);
  const pct      = rep.pct_meta !== null ? parseFloat(rep.pct_meta) : null;
  const risco    = rep.clientes_risco;
  const visitas  = rep.visitas_semana;
  const dias     = rep.dias_sem_pedido;

  const barPct   = pct !== null ? Math.min(pct, 100) : 0;
  const barColor = pct === null ? BI.border
    : pct >= 100 ? BI.success
    : pct >= 70  ? BI.warning
    : BI.danger;

  const diasColor = dias === null ? BI.textMuted
    : dias <= 7   ? BI.success
    : dias <= 14  ? BI.warning
    : BI.danger;

  return (
    <div style={{
      background: BI.panel,
      border: `1px solid ${BI.border}`,
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: color,
      }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `${color}20`,
          border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color,
          fontFamily: 'monospace', flexShrink: 0,
        }}>
          {ini}
        </div>
        <p style={{
          fontSize: 12, fontWeight: 900, color: BI.text,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          lineHeight: 1.2,
        }}>
          {rep.ven_nome}
        </p>
      </div>

      {/* faturamento vs meta */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: BI.textMuted, letterSpacing: '0.06em', marginBottom: 2 }}>
              FAT. MÊS ATUAL
            </p>
            <p style={{ fontSize: 14, fontWeight: 900, color, fontFamily: 'monospace' }}>
              {fmtBRL(fatAtual)}
            </p>
          </div>
          {fatMeta > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: BI.textMuted, letterSpacing: '0.06em', marginBottom: 2 }}>
                META (MÊS ANT.)
              </p>
              <p style={{ fontSize: 12, fontWeight: 700, color: BI.textSec, fontFamily: 'monospace' }}>
                {fmtBRL(fatMeta)}
              </p>
            </div>
          )}
        </div>

        {/* progress bar */}
        {fatMeta > 0 && (
          <div>
            <div style={{
              height: 6, borderRadius: 3,
              background: `${BI.border}`,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${barPct}%`,
                background: barColor,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: barColor }}>
                {pct !== null ? `${pct.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* métricas operacionais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>

        <div style={{
          background: `${risco > 0 ? BI.danger : BI.border}18`,
          border: `1px solid ${risco > 0 ? BI.danger : BI.border}44`,
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
        }}>
          <AlertTriangle size={12} style={{ color: risco > 0 ? BI.danger : BI.textMuted, margin: '0 auto 4px' }} />
          <p style={{ fontSize: 16, fontWeight: 900, color: risco > 0 ? BI.danger : BI.textMuted, lineHeight: 1 }}>
            {risco}
          </p>
          <p style={{ fontSize: 8, fontWeight: 700, color: BI.textMuted, marginTop: 2, letterSpacing: '0.04em' }}>
            EM RISCO
          </p>
        </div>

        <div style={{
          background: `${BI.border}18`,
          border: `1px solid ${BI.border}44`,
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
        }}>
          <Calendar size={12} style={{ color: BI.textMuted, margin: '0 auto 4px' }} />
          <p style={{ fontSize: 16, fontWeight: 900, color: visitas > 0 ? BI.success : BI.textMuted, lineHeight: 1 }}>
            {visitas}
          </p>
          <p style={{ fontSize: 8, fontWeight: 700, color: BI.textMuted, marginTop: 2, letterSpacing: '0.04em' }}>
            VISITAS
          </p>
        </div>

        <div style={{
          background: `${BI.border}18`,
          border: `1px solid ${BI.border}44`,
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
        }}>
          <ShoppingBag size={12} style={{ color: BI.textMuted, margin: '0 auto 4px' }} />
          <p style={{ fontSize: 16, fontWeight: 900, color: diasColor, lineHeight: 1 }}>
            {dias !== null ? dias : '—'}
          </p>
          <p style={{ fontSize: 8, fontWeight: 700, color: BI.textMuted, marginTop: 2, letterSpacing: '0.04em' }}>
            D. S/PEDIDO
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Alertas strip ─────────────────────────────────────────────────────────────
function AlertasStrip({ cockpit }: { cockpit: CockpitRow[] }) {
  const alertas: string[] = [];

  for (const r of cockpit) {
    const nome = r.ven_nome.split(' ')[0];
    const risco = r.clientes_risco;
    const visitas = r.visitas_semana;
    const dias = r.dias_sem_pedido;
    const pct = r.pct_meta !== null ? parseFloat(r.pct_meta) : null;

    if (risco > 0 && visitas === 0) {
      alertas.push(`⚠️ ${nome} tem ${risco} cliente${risco > 1 ? 's' : ''} em risco e nenhuma visita registrada esta semana`);
    }
    if (dias !== null && dias > 14) {
      alertas.push(`🔴 ${nome} está há ${dias} dias sem fechar pedido`);
    }
    if (pct !== null && pct < 50) {
      alertas.push(`📉 ${nome} atingiu apenas ${pct.toFixed(0)}% da meta do mês anterior`);
    }
  }

  if (!alertas.length) return null;

  return (
    <div style={{
      background: `${BI.danger}12`,
      border: `1px solid ${BI.danger}30`,
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <p style={{ fontSize: 10, fontWeight: 900, color: BI.danger, letterSpacing: '0.08em', marginBottom: 4 }}>
        ALERTAS AUTOMÁTICOS
      </p>
      {alertas.map((a, i) => (
        <p key={i} style={{ fontSize: 12, color: BI.textSec, lineHeight: 1.5 }}>
          {a}
        </p>
      ))}
    </div>
  );
}

// ─── EquipeTab ────────────────────────────────────────────────────────────────
const EquipeTab = () => {
  const { filters } = useBIStore();
  const p = buildBIParams(filters);
  const anoAtual = Math.max(...filters.anos);

  const [sellers,  setSellers]  = useState<SellerRow[]>([]);
  const [crm,      setCrm]      = useState<any[]>([]);
  const [cockpit,  setCockpit]  = useState<CockpitRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/bi/sellers-performance?${p}`)
        .then(r => r.data.success ? r.data.data ?? [] : [])
        .catch(() => [] as SellerRow[]),
      api.get('/crm/interacoes?limit=500')
        .then(r => r.data.success ? r.data.data ?? [] : [])
        .catch(() => [] as any[]),
      api.get('/bi/equipe-cockpit')
        .then(r => r.data.success ? r.data.data ?? [] : [])
        .catch(() => [] as CockpitRow[]),
    ])
      .then(([s, c, ck]) => { setSellers(s); setCrm(c); setCockpit(ck); })
      .finally(() => setLoading(false));
  }, [p]);

  const crmBySeller = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>();
    for (const row of crm) {
      const nome = (row.ven_nome as string | undefined)?.trim() || 'Sem vendedor';
      const prev = map.get(nome) ?? { nome, count: 0 };
      map.set(nome, { ...prev, count: prev.count + 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [crm]);

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

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard height={300} />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard height={260} />
          <SkeletonCard height={260} />
        </div>
        <SkeletonCard height={240} />
        <SkeletonCard height={340} />
      </div>
    );
  }

  if (!sellers.length && !cockpit.length) {
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

      {/* ── Cockpit do Gestor ──────────────────────────────────────────────── */}
      {cockpit.length > 0 && (
        <div className="glass-card rounded-2xl p-5" style={{ borderTop: `3px solid ${BI.teal}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} style={{ color: BI.teal }} />
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: BI.textMuted }}>
              Cockpit do Gestor — Mês Atual
            </p>
          </div>

          <AlertasStrip cockpit={cockpit} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
            marginTop: cockpit.some(r =>
              (r.clientes_risco > 0 && r.visitas_semana === 0) ||
              (r.dias_sem_pedido !== null && r.dias_sem_pedido > 14) ||
              (r.pct_meta !== null && parseFloat(r.pct_meta) < 50)
            ) ? 16 : 0,
          }}>
            {cockpit.map(rep => (
              <RepCard key={rep.ven_codigo} rep={rep} />
            ))}
          </div>
        </div>
      )}

      {/* ── Pódio ──────────────────────────────────────────────────────────── */}
      {sellers.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden"
          style={{ borderTop: `3px solid ${BI.warning}` }}>
          <div className="px-6 pt-5">
            <SL label="Pódio — Top 3 Vendedores" />
          </div>
          <Podium sellers={sellers} />
          <div style={{
            height: 6,
            background: `linear-gradient(90deg, ${BI.border} 0%, ${BI.borderStrong} 50%, ${BI.border} 100%)`,
          }} />
        </div>
      )}

      {/* ── Faturamento + CRM ──────────────────────────────────────────────── */}
      {sellers.length > 0 && (
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
      )}

      {/* ── Tabela de Performance ──────────────────────────────────────────── */}
      {sellers.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <SellerPerformanceTable />
        </div>
      )}

    </div>
  );
};

export default EquipeTab;
