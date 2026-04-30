// ─── Design System TelaBI — Teal Navy Executive Edition ──────────────────────
// Fonte: E:\Sistemas_ia\Design BI\colors_and_type.css
// Paleta: Hero dark teal-navy · Body mid-teal · Accent cyan #00e5d1

export const BI = {
  // ── Fundos ────────────────────────────────────────────────────────────────
  pageBg:      '#163242',                                            // body mid-teal (entre body e hero)
  panel:       '#0e333d',                                            // header / nav — hero region
  panelGrad:   'linear-gradient(160deg, #11434f 0%, #0e333d 50%, #0b2229 100%)',
  panelHi:     '#104351',                                            // KPI card surface
  panelHiGrad: 'linear-gradient(135deg, #104351 0%, #0e3a47 100%)', // card hover

  // ── Bordas ────────────────────────────────────────────────────────────────
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  // ── Texto ─────────────────────────────────────────────────────────────────
  text:        '#ffffff',    // primary
  textSec:     '#d8ecef',    // secondary — labels on dark
  textMuted:   '#9fc1c9',    // tertiary — axes, captions
  textDisabled:'#5f8088',    // quaternary — muted

  // ── Acento principal — cyan TelaBI ────────────────────────────────────────
  teal:        '#00e5d1',
  tealGlow:    'rgba(0,229,209,0.40)',
  accentSoft:  'rgba(0,229,209,0.06)',
  accentDim:   '#0b7789',    // selected button on dark
  accentDeep:  '#0e7689',    // sparkline fill, progress bar

  // ── Suporte ───────────────────────────────────────────────────────────────
  blue:        '#00B2FF',
  info:        '#00B2FF',   // alias para BI.blue — cor informacional
  purple:      '#BC66FF',

  // ── Estados semânticos ────────────────────────────────────────────────────
  success:     '#b4ff9d',    // up-delta chip, gain
  successInk:  '#1d4a14',    // text on positive chip
  danger:      '#ff8a7a',    // down-delta chip, loss
  dangerInk:   '#4a1410',    // text on negative chip
  warning:     '#ffd166',

  // ── Sombras ───────────────────────────────────────────────────────────────
  shadowCard:  '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 24px -14px rgba(0,0,0,0.55)',
  shadowHover: '0 0 0 1px rgba(0,229,209,0.2), 0 12px 32px rgba(0,0,0,0.5)',
  shadowGlow:  '0 0 0 1px rgba(0,229,209,0.4), 0 0 24px -4px rgba(0,229,209,0.45)',
} as const;

// ─── Formatadores ─────────────────────────────────────────────────────────────
export const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const fmtK    = (v: number) => fmtBRL(v);
export const fmtN    = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
export const fmtNFull = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
export const fmtPct  = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%`;

// ─── Paleta de séries para gráficos ──────────────────────────────────────────
export const CHART_COLORS = [
  '#00e5d1', // Cyan TelaBI — primário
  '#d8ecef', // Branco suave — secundário
  '#ffd166', // Âmbar — warning/destaque
  '#b4ff9d', // Verde chip
  '#BC66FF', // Roxo
  '#00B2FF', // Azul elétrico
  '#ff8a7a', // Coral
] as const;

// ─── Tema ECharts — TelaBI ────────────────────────────────────────────────────
export const ECHARTS_THEME = {
  tooltip: {
    backgroundColor: 'rgba(11,34,41,0.95)',
    borderColor:     'rgba(0,229,209,0.3)',
    borderWidth:     1,
    borderRadius:    12,
    padding:         [12, 16],
    extraCssText:    'box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(12px);',
    textStyle:       { color: '#d8ecef', fontSize: 12, fontWeight: 600 },
  },
  axisLabel: {
    color:      '#9fc1c9',
    fontSize:   10,
    fontWeight: 600,
  },
  splitLine: {
    lineStyle: { color: 'rgba(159,193,201,0.12)', type: 'dashed' as const },
  },
  areaGradient: (color: string) => ({
    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0,   color: `${color}40` },
      { offset: 0.5, color: `${color}10` },
      { offset: 1,   color: `${color}00` },
    ],
  }),
};
