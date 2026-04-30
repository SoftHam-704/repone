import { useEffect, useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL, fmtN, CHART_COLORS } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';

const MES_LABEL: Record<number, string> = {
  1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',
  7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez',
};

const CURVA_COLORS: Record<string, string> = { A: BI.success, B: BI.warning, C: BI.danger };
const CURVA_ICONS: Record<string, React.ReactNode> = {
  A: <ArrowUp size={12} />,
  B: <Minus size={12} />,
  C: <ArrowDown size={12} />,
};

// ─── Shared ────────────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-2" style={{ padding: '32px 0' }}>
    <Info size={22} style={{ color: BI.textMuted }} />
    <p className="text-sm font-bold" style={{ color: BI.textMuted }}>Sem dados para o período</p>
  </div>
);

const SLabel = ({ label, accent, sub }: { label: string; accent?: string; sub?: string }) => (
  <div className="mb-3">
    <p className="text-xs font-black uppercase tracking-widest" style={{ color: accent ?? BI.textMuted }}>{label}</p>
    {sub && <p className="text-[10px] -mt-0.5" style={{ color: BI.textMuted }}>{sub}</p>}
  </div>
);

const CardWrap = ({ children, accent, style = {} }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) => (
  <div className="rounded-2xl" style={{
    padding: '20px 20px 16px', background: BI.panel, border: `1px solid ${BI.border}`,
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

// ─── Mini Sparkline (SVG inline) ──────────────────────────────────────────────
const MiniSparkline = ({ data, color, width = 120, height = 36 }: {
  data: number[]; color: string; width?: number; height?: number;
}) => {
  if (!data.length || data.every(d => d === 0)) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#sp-${color.replace('#', '')})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Mini Donut (SVG) ─────────────────────────────────────────────────────────
const MiniDonut = ({ value, total, color, size = 80 }: {
  value: number; total: number; color: string; size?: number;
}) => {
  const pct = total > 0 ? value / total : 0;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={`${BI.border}60`} strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
};

// ─── CurvaAbcTab ──────────────────────────────────────────────────────────────
const CurvaAbcTab = () => {
  const { filters, visao } = useBIStore();
  const p = buildBIParams(filters);

  // ── State ──────────────────────────────────────────────────────────────────
  const [overview,     setOverview]     = useState<any>(null);
  const [ticketMedio,  setTicketMedio]  = useState<any[]>([]);
  const [ranking,      setRanking]      = useState<any[]>([]);

  const [loadO, setLoadO] = useState(true);
  const [loadT, setLoadT] = useState(true);
  const [loadR, setLoadR] = useState(true);

  // ── Fetches ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadO(true);
    api.get(`/bi/abc-overview?${p}`)
      .then(r => r.data.success && setOverview(r.data))
      .catch(console.error).finally(() => setLoadO(false));
  }, [p]);

  useEffect(() => {
    setLoadT(true);
    api.get(`/bi/abc-ticket-medio?${p}&limit=30`)
      .then(r => r.data.success && setTicketMedio(r.data.data || []))
      .catch(console.error).finally(() => setLoadT(false));
  }, [p]);

  useEffect(() => {
    setLoadR(true);
    api.get(`/bi/abc-ranking?${p}&metrica=${visao}&limit=50`)
      .then(r => r.data.success && setRanking(r.data.data || []))
      .catch(console.error).finally(() => setLoadR(false));
  }, [p, visao]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const classes = useMemo(() => {
    if (!overview?.classes) return { A: null, B: null, C: null };
    const map: any = {};
    overview.classes.forEach((c: any) => { map[c.curva] = c; });
    return map;
  }, [overview]);

  const sparkData = useMemo(() => {
    if (!overview?.sparklines) return { A: [], B: [], C: [] };
    const result: Record<string, number[]> = { A: Array(12).fill(0), B: Array(12).fill(0), C: Array(12).fill(0) };
    overview.sparklines.forEach((s: any) => {
      if (result[s.curva]) result[s.curva][s.mes - 1] = parseFloat(s.qtd);
    });
    return result;
  }, [overview]);

  const totalFat = useMemo(() => {
    if (!overview?.classes) return 0;
    return overview.classes.reduce((s: number, c: any) => s + parseFloat(c.fat_total || 0), 0);
  }, [overview]);

  const totalVendidos = overview?.portfolio?.vendidos || 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ══ ROW 0: Left Cards (A/B/C qty) + 3 Donuts (faturamento) ═════════ */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '220px 1fr' }}>

        {/* Left column: 3 stacked cards */}
        <div className="flex flex-col gap-3">
          {(['A', 'B', 'C'] as const).map(curva => {
            const d = classes[curva];
            const color = CURVA_COLORS[curva];
            const qtd = d ? parseFloat(d.qtd_total) : 0;
            const sparkSeries = sparkData[curva] || [];

            return (
              <CardWrap key={curva} accent={color} style={{ padding: '14px 16px 10px' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: `${color}18`, border: `1px solid ${color}35`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color,
                    }}>
                      {curva}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BI.textMuted }}>
                      Classe {curva}
                    </span>
                  </div>
                  <p className="text-xl font-black" style={{ color: BI.text, fontFamily: 'monospace' }}>
                    {loadO ? '—' : fmtN(qtd)}
                  </p>
                </div>
                {/* Sparkline */}
                {!loadO && (
                  <div style={{ marginTop: 4 }}>
                    <MiniSparkline data={sparkSeries} color={color} width={180} height={32} />
                    <p className="text-[8px] text-right -mt-0.5" style={{ color: BI.textMuted }}>
                      qtd vendida / mês
                    </p>
                  </div>
                )}
              </CardWrap>
            );
          })}
        </div>

        {/* Right: 3 Donut cards row + Portfolio card */}
        <div className="flex flex-col gap-3">
          {/* 3 Donuts */}
          <div className="grid grid-cols-3 gap-3">
            {(['A', 'B', 'C'] as const).map(curva => {
              const d = classes[curva];
              const color = CURVA_COLORS[curva];
              const fat = d ? parseFloat(d.fat_total) : 0;
              const fmtFat = fat >= 1_000_000
                ? `${(fat / 1_000_000).toFixed(2)} Mi`
                : fat >= 1_000
                  ? `${(fat / 1_000).toFixed(0)} K`
                  : fmtBRL(fat);

              return (
                <CardWrap key={curva} style={{ padding: '16px', textAlign: 'center' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: BI.textMuted }}>
                    Produtos Classe {curva}
                  </p>
                  <div className="flex justify-center mb-1">
                    {loadO ? <SkeletonCard height={80} /> : (
                      <div style={{ position: 'relative' }}>
                        <MiniDonut value={fat} total={totalFat} color={color} size={80} />
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="text-xs font-black" style={{ color }}>
                            {fmtFat}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardWrap>
              );
            })}
          </div>

          {/* Portfolio Card */}
          <CardWrap accent={`linear-gradient(90deg, ${BI.teal}, ${BI.info})`}>
            <SLabel label="Distribuição do Portfólio" accent={BI.teal}
              sub="% de SKUs vendidos por classe e cobertura do catálogo" />
            {loadO ? <SkeletonCard lines={3} /> : (
              <div className="flex items-center gap-6">
                {/* Mini donut */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width={100} height={100} viewBox="0 0 100 100">
                    {(() => {
                      const r = 40; const circ = 2 * Math.PI * r;
                      let offset = -circ / 4;
                      return (['A', 'B', 'C'] as const).map(curva => {
                        const d = classes[curva];
                        const vendidos = d ? d.vendidos : 0;
                        const pct = totalVendidos > 0 ? vendidos / totalVendidos : 0;
                        const dash = circ * pct;
                        const el = (
                          <circle key={curva} cx={50} cy={50} r={r}
                            fill="none" stroke={CURVA_COLORS[curva]} strokeWidth={8}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset}
                            style={{ transition: 'all 0.6s ease' }}
                          />
                        );
                        offset += dash;
                        return el;
                      });
                    })()}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {(['A', 'B', 'C'] as const).map(curva => {
                    const d = classes[curva];
                    const vendidos = d ? d.vendidos : 0;
                    const pct = totalVendidos > 0 ? ((vendidos / totalVendidos) * 100).toFixed(2) : '0.00';
                    return (
                      <div key={curva} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: CURVA_COLORS[curva] }} />
                          <span className="text-[11px] font-semibold" style={{ color: BI.text }}>
                            Classe {curva}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold" style={{ color: CURVA_COLORS[curva] }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="flex flex-col gap-2 pl-4" style={{ borderLeft: `1px solid ${BI.border}` }}>
                  <div>
                    <p className="text-[9px] font-bold uppercase" style={{ color: BI.textMuted }}>Portfólio</p>
                    <p className="text-lg font-black" style={{ color: BI.text, fontFamily: 'monospace' }}>
                      {fmtN(overview?.portfolio?.total || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase" style={{ color: BI.textMuted }}>Inativos</p>
                    <p className="text-lg font-black" style={{ color: BI.danger, fontFamily: 'monospace' }}>
                      {fmtN(overview?.portfolio?.inativos || 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardWrap>
        </div>
      </div>

      {/* ══ ROW 1: Ticket Médio (left) + Ranking ABC (right) ═══════════════ */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Ticket Médio Curva A */}
        <CardWrap accent={BI.success} style={{ display: 'flex', flexDirection: 'column' }}>
          <SLabel label="Produtos Curva A — Ticket Médio" accent={BI.success}
            sub="Média de valor (R$) e quantidade por pedido" />
          {loadT ? <SkeletonCard lines={10} /> : !ticketMedio.length ? <EmptyState /> : (
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 500, paddingRight: 8 }}>
              <div className="grid gap-2 mb-1 pb-1 sticky top-0"
                style={{
                  gridTemplateColumns: '1fr 90px 70px 60px',
                  borderBottom: `1px solid ${BI.border}`, background: BI.panel, zIndex: 1,
                }}>
                <span className="text-[9px] font-bold uppercase" style={{ color: BI.textMuted }}>Produto</span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>Ticket R$</span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>Ticket Qtd</span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>Pedidos</span>
              </div>
              {ticketMedio.map((item, i) => (
                <div key={i} className="grid gap-2 py-1.5"
                  style={{
                    gridTemplateColumns: '1fr 90px 70px 60px',
                    borderBottom: `1px solid ${BI.border}18`,
                  }}>
                  <p className="text-[11px] font-semibold truncate" style={{ color: BI.text }}>{item.produto}</p>
                  <p className="text-[11px] text-right font-mono font-semibold" style={{ color: BI.teal }}>
                    {fmtBRL(parseFloat(item.ticket_rs))}
                  </p>
                  <p className="text-[11px] text-right font-mono font-semibold" style={{ color: BI.textSec }}>
                    {fmtN(parseFloat(item.ticket_qtd))}
                  </p>
                  <p className="text-[11px] text-right font-mono" style={{ color: BI.textMuted }}>
                    {fmtN(parseInt(item.num_pedidos))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardWrap>

        {/* Ranking ABC (métrica-aware) */}
        <CardWrap accent={`linear-gradient(90deg, ${BI.success}, ${BI.warning}, ${BI.danger})`}
          style={{ display: 'flex', flexDirection: 'column' }}>
          <SLabel
            label={`Curva ABC — ${visao === 'financeiro' ? 'Valores' : 'Quantidades'}`}
            accent={BI.info}
            sub="Ranking completo com % acumulado Pareto e classificação" />
          {loadR ? <SkeletonCard lines={12} /> : !ranking.length ? <EmptyState /> : (
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 500, paddingRight: 8 }}>
              <div className="grid gap-2 mb-1 pb-1 sticky top-0"
                style={{
                  gridTemplateColumns: '1fr 80px 55px 36px',
                  borderBottom: `1px solid ${BI.border}`, background: BI.panel, zIndex: 1,
                }}>
                <span className="text-[9px] font-bold uppercase" style={{ color: BI.textMuted }}>Produto</span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>
                  {visao === 'financeiro' ? 'Valor' : 'Qtd'}
                </span>
                <span className="text-[9px] font-bold uppercase text-right" style={{ color: BI.textMuted }}>%</span>
                <span className="text-[9px] font-bold uppercase text-center" style={{ color: BI.textMuted }}>ABC</span>
              </div>
              {ranking.map((item, i) => {
                const color = CURVA_COLORS[item.curva] || BI.textMuted;
                const val = visao === 'financeiro'
                  ? fmtBRL(parseFloat(item.valor))
                  : fmtN(parseFloat(item.quantidade));
                return (
                  <div key={i} className="grid gap-2 py-1"
                    style={{
                      gridTemplateColumns: '1fr 80px 55px 36px',
                      borderBottom: `1px solid ${BI.border}18`,
                    }}>
                    <p className="text-[11px] font-semibold truncate" style={{ color: BI.text }}>{item.produto}</p>
                    <p className="text-[11px] text-right font-mono font-semibold" style={{ color: BI.textSec }}>
                      {val}
                    </p>
                    <p className="text-[10px] text-right font-mono" style={{ color: BI.textMuted }}>
                      {parseFloat(item.pct_acumulado).toFixed(2)}%
                    </p>
                    <div className="flex items-center justify-center gap-0.5" style={{ color }}>
                      {CURVA_ICONS[item.curva]}
                      <span style={{ fontSize: 9, fontWeight: 900 }}>{item.curva}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardWrap>
      </div>

    </div>
  );
};

export default CurvaAbcTab;
