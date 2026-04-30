import { useMemo } from 'react';

interface Props {
  data: number[];
  color: string;
  height?: number;
  strokeWidth?: number;
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cpx = (x0 + x1) / 2;
    d += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  return d;
}

export const SparkLine = ({ data, color, height = 56, strokeWidth = 1.8 }: Props) => {
  const W = 200;
  const H = height;
  const PAD = { top: 8, bottom: 4, left: 2, right: 8 };

  const points = useMemo((): [number, number][] => {
    if (data.filter(v => v > 0).length < 2) return [];
    const min    = Math.min(...data);
    const max    = Math.max(...data);
    const range  = max - min || 1;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    return data.map((v, i) => [
      PAD.left + (i / (data.length - 1)) * innerW,
      PAD.top + innerH - ((v - min) / range) * innerH,
    ]);
  }, [data, H]);

  if (points.length < 2) return null;

  const linePath = smoothPath(points);
  const last     = points[points.length - 1];
  const areaPath = linePath + ` L${last[0]},${H} L${points[0][0]},${H} Z`;
  const uid      = color.replace(/[^a-z0-9]/gi, '').slice(0, 12);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%" height={H}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0.00" />
        </linearGradient>
        <filter id={`sf-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Área */}
      <path d={areaPath} fill={`url(#sg-${uid})`} />

      {/* Linha principal */}
      <path d={linePath} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />

      {/* Linha tracejada horizontal no nível do último ponto */}
      <line
        x1={points[0][0]} y1={last[1]}
        x2={last[0]}       y2={last[1]}
        stroke={color} strokeWidth={0.6}
        strokeDasharray="3 3" opacity={0.30}
      />

      {/* Dot final com glow */}
      <circle cx={last[0]} cy={last[1]} r={3.5}
        fill={color} filter={`url(#sf-${uid})`} />

      {/* Anel externo */}
      <circle cx={last[0]} cy={last[1]} r={6.5}
        fill="none" stroke={color} strokeWidth={1} opacity={0.25} />
    </svg>
  );
};
