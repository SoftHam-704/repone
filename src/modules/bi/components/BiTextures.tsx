import { BI } from './biTokens';

const BASE: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  userSelect: 'none',
  overflow: 'hidden',
};

/** Padrão de engrenagem / mecânico — contexto autopeças — para cards hero */
export const GearTexture = () => (
  <svg
    style={{ ...BASE, right: 0, bottom: 0, opacity: 0.07, borderRadius: 'inherit' }}
    width="120" height="120" viewBox="0 0 130 130"
    fill="none" xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {/* Corpo da engrenagem */}
    <circle cx="65" cy="65" r="38" stroke={BI.teal} strokeWidth="3" />
    <circle cx="65" cy="65" r="22" stroke={BI.teal} strokeWidth="2" />
    <circle cx="65" cy="65" r="8"  stroke={BI.teal} strokeWidth="2" />

    {/* Dentes — 8 dentes radiais */}
    {Array.from({ length: 8 }, (_, i) => {
      const angle  = (i * 45 * Math.PI) / 180;
      const x1 = 65 + Math.cos(angle) * 38;
      const y1 = 65 + Math.sin(angle) * 38;
      const x2 = 65 + Math.cos(angle) * 52;
      const y2 = 65 + Math.sin(angle) * 52;
      const px = 4 * Math.cos(angle + Math.PI / 2);
      const py = 4 * Math.sin(angle + Math.PI / 2);
      return (
        <polygon key={i}
          points={`${x1 + px},${y1 + py} ${x1 - px},${y1 - py} ${x2 - px},${y2 - py} ${x2 + px},${y2 + py}`}
          stroke={BI.teal} strokeWidth="1.5" fill="none"
        />
      );
    })}

    {/* Linhas radiais internas */}
    {Array.from({ length: 8 }, (_, i) => {
      const angle = ((i * 45 + 22.5) * Math.PI) / 180;
      return (
        <line key={i}
          x1={65 + Math.cos(angle) * 22}
          y1={65 + Math.sin(angle) * 22}
          x2={65 + Math.cos(angle) * 38}
          y2={65 + Math.sin(angle) * 38}
          stroke={BI.teal} strokeWidth="1" opacity="0.5"
        />
      );
    })}
  </svg>
);

/** Radar rings — decoração discreta para cards de valor */
export const RadarTexture = ({ color = BI.teal }: { color?: string }) => (
  <svg
    style={{ ...BASE, right: 0, top: 0, opacity: 0.06, borderRadius: 'inherit' }}
    width="160" height="160" viewBox="0 0 180 180"
    fill="none" xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {[30, 55, 80, 105].map(r => (
      <circle key={r} cx="180" cy="0" r={r} stroke={color} strokeWidth="1" />
    ))}
  </svg>
);

/** Grade de pontos — textura sutil para cards de market share / distribuição */
export const DotGridTexture = ({ color = BI.teal }: { color?: string }) => (
  <svg
    style={{ ...BASE, inset: 0, width: '100%', height: '100%', opacity: 0.04 }}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <pattern id="bi-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.5" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bi-dots)" />
  </svg>
);

/** Ondas / waveform — Volume de itens */
export const WaveTexture = ({ color = BI.teal }: { color?: string }) => (
  <svg
    style={{ ...BASE, right: 0, bottom: 0, opacity: 0.07, borderRadius: 'inherit' }}
    width="140" height="100" viewBox="0 0 140 100"
    fill="none" xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {/* 4 ondas com amplitudes crescentes */}
    {[0, 14, 28, 42].map((yOff, i) => (
      <path key={i}
        d={`M0,${55 - yOff}
            C20,${35 - yOff} 30,${75 - yOff} 50,${55 - yOff}
            C70,${35 - yOff} 80,${75 - yOff} 100,${55 - yOff}
            C120,${35 - yOff} 130,${75 - yOff} 140,${55 - yOff}`}
        stroke={color} strokeWidth={1.5 - i * 0.25}
        opacity={1 - i * 0.2}
      />
    ))}
    {/* Linha central tracejada */}
    <line x1="0" y1="55" x2="140" y2="55" stroke={color} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
  </svg>
);

/** Rede de nós — Clientes ativos / conexões */
export const NetworkTexture = ({ color = BI.teal }: { color?: string }) => {
  const nodes: [number, number][] = [
    [105, 20], [130, 55], [115, 90], [80, 110],
    [50, 95],  [25, 65],  [45, 30],  [80, 15],
  ];
  const edges: [number, number][] = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,3],[1,4],[6,2],
  ];
  return (
    <svg
      style={{ ...BASE, right: 0, bottom: 0, opacity: 0.08, borderRadius: 'inherit' }}
      width="140" height="130" viewBox="0 0 150 130"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {edges.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a][0]} y1={nodes[a][1]}
          x2={nodes[b][0]} y2={nodes[b][1]}
          stroke={color} strokeWidth="1" opacity="0.5"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 5 : 3} stroke={color} strokeWidth="1.5" fill="none" />
      ))}
      {/* nó central maior */}
      <circle cx={nodes[0][0]} cy={nodes[0][1]} r={9} stroke={color} strokeWidth="1" opacity="0.3" fill="none" />
    </svg>
  );
};

/** Speedômetro / gauge — Ticket Médio */
export const SpeedometerTexture = ({ color = BI.teal }: { color?: string }) => {
  const cx = 80, cy = 90, r = 60;
  // marcações do velocímetro (arco superior de 210° a -30°)
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const angle = (-210 + i * 30) * (Math.PI / 180);
    const isMajor = i % 2 === 0;
    const r1 = r - (isMajor ? 10 : 6);
    const r2 = r;
    return {
      x1: cx + Math.cos(angle) * r1,
      y1: cy + Math.sin(angle) * r1,
      x2: cx + Math.cos(angle) * r2,
      y2: cy + Math.sin(angle) * r2,
      major: isMajor,
    };
  });
  // ponteiro a 40% do arco
  const needleAngle = (-210 + 0.4 * 240) * (Math.PI / 180);
  return (
    <svg
      style={{ ...BASE, right: -10, bottom: -10, opacity: 0.08, borderRadius: 'inherit' }}
      width="140" height="130" viewBox="0 0 150 120"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Arco do gauge */}
      <path
        d={`M${cx + Math.cos(-210 * Math.PI / 180) * r},${cy + Math.sin(-210 * Math.PI / 180) * r}
            A${r},${r} 0 1 1 ${cx + Math.cos(-30 * Math.PI / 180) * r},${cy + Math.sin(-30 * Math.PI / 180) * r}`}
        stroke={color} strokeWidth="2" fill="none"
      />
      {/* Arco interno */}
      <path
        d={`M${cx + Math.cos(-210 * Math.PI / 180) * (r-12)},${cy + Math.sin(-210 * Math.PI / 180) * (r-12)}
            A${r-12},${r-12} 0 1 1 ${cx + Math.cos(-30 * Math.PI / 180) * (r-12)},${cy + Math.sin(-30 * Math.PI / 180) * (r-12)}`}
        stroke={color} strokeWidth="0.8" fill="none" opacity="0.4"
      />
      {/* Marcações */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={color} strokeWidth={t.major ? 1.5 : 0.8} opacity={t.major ? 1 : 0.5}
        />
      ))}
      {/* Ponteiro */}
      <line
        x1={cx} y1={cy}
        x2={cx + Math.cos(needleAngle) * (r - 8)}
        y2={cy + Math.sin(needleAngle) * (r - 8)}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={4} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
};

/** Mapa simplificado do Brasil — silhueta vetorial para card de Market Share */
export const BrazilMapTexture = () => (
  <svg
    style={{ ...BASE, right: 8, bottom: 4, opacity: 0.06, width: 120, height: 130 }}
    viewBox="0 0 200 220"
    fill="none" xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {/*
      Silhueta simplificada do Brasil.
      Pontos de referência: Norte (Roraima/Amapá), Nordeste (Maranhão→Bahia),
      Sudeste (ES→SP→RJ), Sul (RS), Pantanal/Mato Grosso, Amazônia Ocidental.
    */}
    <path
      d={`
        M 90,8   L 105,5  L 118,10 L 128,8  L 140,14
        L 145,25 L 152,30 L 158,40 L 160,52
        L 155,58 L 162,65 L 168,75 L 170,88
        L 165,98 L 160,105 L 158,115
        L 162,125 L 158,135 L 150,142
        L 140,148 L 128,155 L 118,165
        L 108,175 L 100,185 L 92,195
        L 85,200 L 78,195 L 72,185
        L 68,175 L 60,165
        L 48,158 L 40,148 L 35,138
        L 30,125 L 28,112 L 32,100
        L 30,88  L 25,78  L 20,68
        L 18,55  L 22,45  L 28,38
        L 35,30  L 42,22  L 52,16
        L 62,10  L 75,6   L 90,8
      `}
      stroke={BI.teal}
      strokeWidth="2.5"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Sombra interior leve */}
    <path
      d={`
        M 90,8   L 105,5  L 118,10 L 128,8  L 140,14
        L 145,25 L 152,30 L 158,40 L 160,52
        L 155,58 L 162,65 L 168,75 L 170,88
        L 165,98 L 160,105 L 158,115
        L 162,125 L 158,135 L 150,142
        L 140,148 L 128,155 L 118,165
        L 108,175 L 100,185 L 92,195
        L 85,200 L 78,195 L 72,185
        L 68,175 L 60,165
        L 48,158 L 40,148 L 35,138
        L 30,125 L 28,112 L 32,100
        L 30,88  L 25,78  L 20,68
        L 18,55  L 22,45  L 28,38
        L 35,30  L 42,22  L 52,16
        L 62,10  L 75,6   L 90,8
      `}
      fill={BI.teal}
      opacity="0.08"
    />
  </svg>
);
