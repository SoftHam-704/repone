interface IrisAvatarProps {
  size?: number;
  animated?: boolean;
  style?: React.CSSProperties;
}

const EYE_PATH = 'M 4,25 C 4,7 76,7 76,25 C 76,43 4,43 4,25 Z';

export function IrisAvatar({ size = 40, animated = true, style }: IrisAvatarProps) {
  const h = Math.round(size * 50 / 80);
  const id = 'iris-av';

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 80 50"
      fill="none"
      style={style}
    >
      <defs>
        <radialGradient id={`${id}-iris`} cx="50%" cy="42%" r="55%">
          <stop offset="0%"   stopColor="#FFE566" />
          <stop offset="55%"  stopColor="#FFD200" />
          <stop offset="100%" stopColor="#C49A00" />
        </radialGradient>

        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFD200" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFD200" stopOpacity="0"    />
        </radialGradient>

        <filter id={`${id}-blur`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* ambient glow behind eye */}
      <ellipse cx="40" cy="25" rx="38" ry="23" fill={`url(#${id}-glow)`} />

      {/* eyelid shape — subtle fill */}
      <path d={EYE_PATH} fill="rgba(255,210,0,0.04)" />

      {/* iris glow (blurred circle under iris) */}
      <circle cx="40" cy="25" r="15"
        fill="#FFD200" opacity="0.18"
        filter={`url(#${id}-blur)`}
      />

      {/* iris disc */}
      <circle cx="40" cy="25" r="14" fill={`url(#${id}-iris)`} />

      {/* iris texture — outer ring */}
      <circle cx="40" cy="25" r="11.5"
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7"
      />

      {/* iris texture — inner ring */}
      <circle cx="40" cy="25" r="8.5"
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"
      />

      {/* iris radial lines — 12 spokes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30) * Math.PI / 180;
        return (
          <line
            key={i}
            x1={40 + 8.8 * Math.cos(a)} y1={25 + 8.8 * Math.sin(a)}
            x2={40 + 13 * Math.cos(a)}  y2={25 + 13 * Math.sin(a)}
            stroke="rgba(160,110,0,0.35)"
            strokeWidth="0.6"
          />
        );
      })}

      {/* pupil */}
      <circle cx="40" cy="25" r="5.5" fill="#1A2D42" />

      {/* pupil micro-shine */}
      <circle cx="40" cy="25" r="3" fill="#162338" />

      {/* eye outline */}
      <path
        d={EYE_PATH}
        stroke="#FFD200"
        strokeWidth={animated ? '1.2' : '1.4'}
        opacity="0.7"
      />

      {/* upper lash shadow */}
      <path
        d="M 4,25 C 4,7 76,7 76,25"
        stroke="rgba(255,210,0,0.3)"
        strokeWidth="0.6"
        fill="none"
      />

      {/* highlight — main */}
      <circle cx="44" cy="21" r="2.4" fill="rgba(255,255,255,0.88)" />

      {/* highlight — secondary */}
      <circle cx="37" cy="28" r="1.1" fill="rgba(255,255,255,0.35)" />

      {/* animated pulse ring */}
      {animated && (
        <circle cx="40" cy="25" r="14"
          fill="none"
          stroke="#FFD200"
          strokeWidth="1"
          opacity="0"
          style={{ transformOrigin: '40px 25px' }}
        >
          <animate attributeName="r"       values="14;20;14"   dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4"  dur="3s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
