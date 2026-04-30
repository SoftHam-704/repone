import { BI } from './biTokens';

interface InsightNarrativeProps {
  lines:   string[];
  type?:   'info' | 'success' | 'alert';
  loading?: boolean;
}

/**
 * Bloco de narrativa automática para cada seção do BI.
 * Transforma dados em texto legível para usuários não técnicos.
 *
 * Princípio: nem todos conseguem "ler" um gráfico e extrair insight.
 * O BI conta a história dos dados em linguagem natural de negócios.
 */
export const InsightNarrative = ({ lines, type = 'info', loading }: InsightNarrativeProps) => {
  if (loading || !lines.length) return null;

  const accent =
    type === 'success' ? BI.success :
    type === 'alert'   ? BI.warning :
    BI.teal;

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4"
      style={{
        background:  `${accent}09`,
        border:      `1px solid ${accent}22`,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* ✦ ícone decorativo */}
      <span
        aria-hidden
        style={{
          color: accent, fontSize: 12, flexShrink: 0,
          marginTop: 2, opacity: 0.8,
          fontFamily: 'monospace',
        }}
      >
        ✦
      </span>

      <div>
        {lines.map((line, i) => (
          <p
            key={i}
            className="text-xs leading-relaxed"
            style={{
              color: i === 0 ? BI.textSec : BI.textMuted,
              fontWeight: i === 0 ? 600 : 400,
              marginTop: i > 0 ? 2 : 0,
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};
