import { useState } from 'react';
import { BI, fmtK, fmtN, CHART_COLORS } from './biTokens';

type Visao = 'financeiro' | 'volume' | 'skus';

interface IndustriaItem {
  for_codigo: number;
  nome:       string;
  total:      string;
  quantidade: string;
  skus:       string;
  pct_total:  string;
  pct_qtd:    string;
  pct_skus:   string;
}

interface Props {
  data:     IndustriaItem[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  compact?: boolean;
  visao?:   Visao;
}

// ─── SVG math ─────────────────────────────────────────────────────────────────
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: +(cx + r * Math.cos(rad)).toFixed(3), y: +(cy + r * Math.sin(rad)).toFixed(3) };
};

const donutPath = (
  cx: number, cy: number,
  rOut: number, rIn: number,
  a1: number, a2: number,
): string => {
  const s  = polar(cx, cy, rOut, a1);
  const e  = polar(cx, cy, rOut, a2);
  const si = polar(cx, cy, rIn, a2);
  const ei = polar(cx, cy, rIn, a1);
  const lg = a2 - a1 > 180 ? 1 : 0;
  return (
    `M${s.x},${s.y} A${rOut},${rOut} 0 ${lg} 1 ${e.x},${e.y}` +
    ` L${si.x},${si.y} A${rIn},${rIn} 0 ${lg} 0 ${ei.x},${ei.y} Z`
  );
};

// Donut segments: equal 60° each
// Left  cards 0,1,2 → top-left, mid-left, bot-left  → [300-360], [240-300], [180-240]
// Right cards 3,4,5 → top-right, mid-right, bot-right → [0-60], [60-120], [120-180]
const SEG: [number, number][] = [
  [300, 360], [240, 300], [180, 240],
  [0, 60],   [60, 120],  [120, 180],
];

// ─── Premium card ─────────────────────────────────────────────────────────────
const IndustriaCard = ({
  ind, index, color, selected, onSelect, grandTotal, cw, ch, visao = 'financeiro',
}: {
  ind: IndustriaItem; index: number; color: string;
  selected: number | null; onSelect: (id: number | null) => void;
  grandTotal: number; cw: number; ch: number; visao?: Visao;
}) => {
  const [hover, setHover] = useState(false);
  const isSelected    = selected === ind.for_codigo;
  const otherSelected = selected !== null && !isSelected;

  // Valores e % conforme a métrica activa
  const val = visao === 'volume' ? (parseFloat(ind.quantidade) || 0)
            : visao === 'skus'   ? (parseFloat(ind.skus)       || 0)
            : parseFloat(ind.total);
  const pct = visao === 'volume' ? (parseFloat(ind.pct_qtd)   || 0)
            : visao === 'skus'   ? (parseFloat(ind.pct_skus)   || 0)
            : parseFloat(ind.pct_total);
  const fmtVal = visao === 'financeiro' ? fmtK : fmtN;

  const barW  = grandTotal > 0 ? (val / grandTotal) * 100 : 0;
  const rank  = String(index + 1).padStart(2, '0');
  const fontSize = ch < 110 ? { val: 17, name: 10, badge: 9, pct: 11 } : { val: 20, name: 11, badge: 10, pct: 12 };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(isSelected ? null : ind.for_codigo)}
      style={{
        width: cw, height: ch,
        borderRadius: 12,
        padding: ch < 110 ? '9px 11px 8px' : '12px 14px 10px',
        background: isSelected
          ? `linear-gradient(145deg, ${color}28 0%, ${BI.panelHi} 100%)`
          : hover
          ? `linear-gradient(145deg, ${color}18 0%, ${BI.panelHi} 100%)`
          : `linear-gradient(145deg, ${color}0C 0%, ${BI.panel} 100%)`,
        border: `1px solid ${isSelected ? color : hover ? `${color}55` : BI.border}`,
        borderLeft: `4px solid ${color}`,
        boxShadow: isSelected ? `0 0 0 1px ${color}38, 0 6px 24px ${color}25` : hover ? `0 4px 16px ${color}18` : 'none',
        opacity:    otherSelected ? 0.28 : 1,
        cursor:     'pointer',
        transition: 'all 0.22s ease',
        userSelect: 'none',
        position:   'relative',
        overflow:   'hidden',
        boxSizing:  'border-box',
      }}
    >
      {/* Shimmer */}
      <div style={{
        position: 'absolute', top: 0, left: 4, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}${isSelected ? '55' : hover ? '28' : '00'}, transparent)`,
        transition: 'all 0.22s', pointerEvents: 'none',
      }} />

      {/* Rank + pct */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{
          fontSize: fontSize.badge, fontWeight: 900, fontFamily: 'monospace',
          color: isSelected ? color : BI.textMuted, letterSpacing: '0.06em',
          background: `${color}${isSelected ? '22' : '10'}`,
          border: `1px solid ${color}${isSelected ? '45' : '22'}`,
          padding: '1px 5px', borderRadius: 4, transition: 'all 0.22s',
        }}>
          #{rank}
        </span>
        <span style={{ fontSize: fontSize.pct, fontWeight: 800, color: isSelected ? color : BI.textSec, transition: 'color 0.22s' }}>
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Name */}
      <p style={{
        fontSize: fontSize.name, fontWeight: 700,
        color: isSelected ? BI.text : BI.textSec,
        margin: '0 0 5px', lineHeight: 1.25,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        minHeight: ch < 110 ? 24 : 28,
        transition: 'color 0.22s',
      }}>
        {ind.nome}
      </p>

      {/* Value */}
      <p style={{
        fontSize: fontSize.val, fontWeight: 900,
        color: isSelected ? color : `${color}CC`,
        fontFamily: 'monospace', letterSpacing: '-0.03em', lineHeight: 1,
        margin: '0 0 7px',
        textShadow: isSelected ? `0 0 20px ${color}50` : 'none',
        transition: 'all 0.22s',
      }}>
        {fmtVal(val)}
      </p>

      {/* Progress bar */}
      <div style={{ height: 2.5, background: BI.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${barW}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: 2,
          boxShadow: isSelected ? `0 0 6px ${color}70` : 'none',
          transition: 'width 0.55s ease, box-shadow 0.22s',
        }} />
      </div>
    </div>
  );
};

// ─── Wheel ────────────────────────────────────────────────────────────────────
export const TopIndustriasWheel = ({ data, selected, onSelect, compact = false, visao = 'financeiro' }: Props) => {
  const top6 = data.slice(0, 6);
  const left  = top6.slice(0, 3);
  const right = top6.slice(3, 6);

  const grandTotal = top6.reduce((s, d) => {
    const v = visao === 'volume' ? (parseFloat(d.quantidade) || 0)
            : visao === 'skus'   ? (parseFloat(d.skus)       || 0)
            : parseFloat(d.total);
    return s + v;
  }, 0);
  const fmtGrand = visao === 'financeiro' ? fmtK : fmtN;

  // Dimensions — compact mode shrinks everything proportionally
  const CW  = compact ? 154 : 196;
  const CH  = compact ? 100 : 120;
  const CG  = compact ? 10  : 12;
  const GAP = compact ? 36  : 52;
  const RO  = compact ? 66  : 84;
  const RI  = compact ? 42  : 54;

  const COL_H   = CH * 3 + CG * 2;
  const TOTAL_W = CW + GAP + RO * 2 + GAP + CW;
  const TOTAL_H = COL_H;
  const CX = CW + GAP + RO;
  const CY = TOTAL_H / 2;

  const cardCY = (i: number) => i * (CH + CG) + CH / 2;

  const selIdx   = selected != null ? top6.findIndex(d => d.for_codigo === selected) : -1;
  const selColor = selIdx >= 0 ? (CHART_COLORS[selIdx] as string) : BI.teal;
  const selInd   = selIdx >= 0 ? top6[selIdx] : null;
  const rightCardX = CW + GAP + RO * 2 + GAP;

  // Bezier path from donut edge midpoint → card edge
  const connPath = (segIdx: number, side: 'L' | 'R', row: number): string => {
    const [a1, a2] = SEG[segIdx];
    const mid = (a1 + a2) / 2;
    const p   = polar(CX, CY, RO + 2, mid);
    const cy2 = cardCY(row);
    if (side === 'L') {
      const ex = CW;
      const dx = Math.abs(p.x - ex);
      return `M${p.x},${p.y} C${p.x - dx * 0.48},${p.y} ${ex + dx * 0.22},${cy2} ${ex},${cy2}`;
    } else {
      const ex = rightCardX;
      const dx = Math.abs(ex - p.x);
      return `M${p.x},${p.y} C${p.x + dx * 0.48},${p.y} ${ex - dx * 0.22},${cy2} ${ex},${cy2}`;
    }
  };

  return (
    <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H, margin: '0 auto' }}>

      {/* ── SVG: donut + bezier lines ────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <defs>
          <filter id="iwGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="iwInner" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor={BI.panelHi} />
            <stop offset="100%" stopColor={BI.panel} />
          </radialGradient>
        </defs>

        {/* Bezier lines */}
        {left.map((ind, i) => {
          const active = selected == null || selected === ind.for_codigo;
          return (
            <path key={`lc${i}`} d={connPath(i, 'L', i)}
              fill="none" stroke={CHART_COLORS[i] as string}
              strokeWidth="1.5" strokeOpacity={active ? 0.5 : 0.06}
              style={{ transition: 'stroke-opacity 0.25s' }} />
          );
        })}
        {right.map((ind, i) => {
          const active = selected == null || selected === ind.for_codigo;
          return (
            <path key={`rc${i}`} d={connPath(i + 3, 'R', i)}
              fill="none" stroke={CHART_COLORS[i + 3] as string}
              strokeWidth="1.5" strokeOpacity={active ? 0.5 : 0.06}
              style={{ transition: 'stroke-opacity 0.25s' }} />
          );
        })}

        {/* Donut segments */}
        {top6.map((ind, i) => {
          const [a1, a2] = SEG[i];
          const isSel  = selected === ind.for_codigo;
          const active = selected == null || isSel;
          const c      = CHART_COLORS[i] as string;
          const rOut   = isSel ? RO + 7 : RO;
          return (
            <path key={`seg${i}`}
              d={donutPath(CX, CY, rOut, RI, a1, a2)}
              fill={c} fillOpacity={isSel ? 0.92 : active ? 0.52 : 0.16}
              stroke={BI.panel} strokeWidth="2.5"
              filter={isSel ? 'url(#iwGlow)' : undefined}
              style={{ transition: 'fill-opacity 0.25s ease' }} />
          );
        })}

        {/* Inner circle */}
        <circle cx={CX} cy={CY} r={RI - 1} fill="url(#iwInner)" />
        <circle cx={CX} cy={CY} r={RI - 1} fill="none"
          stroke={selColor} strokeWidth="1.5" strokeOpacity="0.28"
          style={{ transition: 'stroke 0.25s' }} />

        {/* Subtle grid lines */}
        {[0.38, 0.68].map(f => (
          <circle key={f} cx={CX} cy={CY} r={(RI - 1) * f}
            fill="none" stroke={BI.teal} strokeWidth="0.5" strokeOpacity="0.07" />
        ))}
        <line x1={CX - (RI - 4)} y1={CY} x2={CX + (RI - 4)} y2={CY}
          stroke={BI.teal} strokeWidth="0.5" strokeOpacity="0.07" />
        <line x1={CX} y1={CY - (RI - 4)} x2={CX} y2={CY + (RI - 4)}
          stroke={BI.teal} strokeWidth="0.5" strokeOpacity="0.07" />

        {/* Center text — no selection */}
        {!selInd && (
          <>
            <text x={CX} y={CY - 10} textAnchor="middle"
              fontSize={compact ? 20 : 25} fontWeight="900" fill={BI.teal}
              fontFamily="monospace" letterSpacing="-0.8">Top 6</text>
            <text x={CX} y={CY + (compact ? 5 : 7)} textAnchor="middle"
              fontSize={compact ? 7 : 8} fontWeight="700" fill={BI.textMuted}
              letterSpacing="2">INDÚSTRIAS</text>
            <text x={CX} y={CY + (compact ? 20 : 24)} textAnchor="middle"
              fontSize={compact ? 10 : 12} fontWeight="800" fill={BI.textSec}
              fontFamily="monospace">{fmtGrand(grandTotal)}</text>
          </>
        )}

        {/* Center text — selected */}
        {selInd && (
          <>
            <text x={CX} y={CY - 13} textAnchor="middle"
              fontSize="8" fontWeight="900" fill={selColor} letterSpacing="1.8">FILTRADO</text>
            <text x={CX} y={CY + (compact ? 5 : 7)} textAnchor="middle"
              fontSize={compact ? 16 : 19} fontWeight="900" fill={selColor}
              fontFamily="monospace" letterSpacing="-0.5">
              {fmtGrand(
                visao === 'volume' ? (parseFloat(selInd.quantidade) || 0)
                : visao === 'skus' ? (parseFloat(selInd.skus)       || 0)
                : parseFloat(selInd.total)
              )}
            </text>
            <text x={CX} y={CY + (compact ? 20 : 26)} textAnchor="middle"
              fontSize="7.5" fontWeight="700" fill={BI.textMuted} letterSpacing="0.5">
              clique p/ limpar
            </text>
          </>
        )}

        {/* Endpoint dots */}
        {left.map((ind, i) => {
          const active = selected == null || selected === ind.for_codigo;
          return (
            <circle key={`ld${i}`} cx={CW} cy={cardCY(i)} r="3"
              fill={CHART_COLORS[i] as string}
              fillOpacity={active ? 0.75 : 0.08}
              style={{ transition: 'fill-opacity 0.25s' }} />
          );
        })}
        {right.map((ind, i) => {
          const active = selected == null || selected === ind.for_codigo;
          return (
            <circle key={`rd${i}`} cx={rightCardX} cy={cardCY(i)} r="3"
              fill={CHART_COLORS[i + 3] as string}
              fillOpacity={active ? 0.75 : 0.08}
              style={{ transition: 'fill-opacity 0.25s' }} />
          );
        })}
      </svg>

      {/* ── Clickable inner circle ──────────────────────────────────────── */}
      {selected != null && (
        <div
          onClick={() => onSelect(null)}
          title="Limpar filtro"
          style={{
            position: 'absolute',
            left: CX - RI + 1, top: CY - RI + 1,
            width: (RI - 1) * 2, height: (RI - 1) * 2,
            borderRadius: '50%', cursor: 'pointer', zIndex: 2,
          }}
        />
      )}

      {/* ── Card columns ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', height: TOTAL_H }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: CG, width: CW, flexShrink: 0 }}>
          {left.map((ind, i) => (
            <IndustriaCard key={ind.for_codigo} ind={ind} index={i}
              color={CHART_COLORS[i] as string}
              selected={selected} onSelect={onSelect}
              grandTotal={grandTotal} cw={CW} ch={CH} visao={visao} />
          ))}
        </div>
        <div style={{ width: GAP + RO * 2 + GAP, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: CG, width: CW, flexShrink: 0 }}>
          {right.map((ind, i) => (
            <IndustriaCard key={ind.for_codigo} ind={ind} index={i + 3}
              color={CHART_COLORS[i + 3] as string}
              selected={selected} onSelect={onSelect}
              grandTotal={grandTotal} cw={CW} ch={CH} visao={visao} />
          ))}
        </div>
      </div>
    </div>
  );
};
