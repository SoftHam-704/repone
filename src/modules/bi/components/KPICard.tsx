import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BI, fmtPct } from './biTokens';
import { SparkLine } from './SparkLine';
import { SkeletonKPI } from './SkeletonCard';
import { GearTexture, RadarTexture, WaveTexture, NetworkTexture, SpeedometerTexture } from './BiTextures';

interface KPICardProps {
  label:       string;
  value:       string;
  hint?:       string;          // explicação do que é a métrica (ícone ⓘ com tooltip)
  delta?:      number | null;   // % MoM ou YoY
  deltaLabel?: string;          // ex: "MoM" | "YoY"
  spark?:      number[];        // série para sparkline
  color?:      string;
  icon?:       React.ElementType;
  loading?:    boolean;
  highlight?:  boolean;         // teal border + textura de fundo
  texture?:    'gear' | 'radar' | 'wave' | 'network' | 'speedometer' | false;
  subInfo?:    string;          // informação adicional abaixo do valor
}

export const KPICard = ({
  label, value, hint, delta, deltaLabel = 'MoM', spark,
  color, icon: Icon, loading, highlight,
  texture, subInfo,
}: KPICardProps) => {
  const [hintVisible, setHintVisible] = useState(false);

  if (loading) return <SkeletonKPI />;

  const isPos  = delta !== null && delta !== undefined && delta >= 0;
  const isNeg  = delta !== null && delta !== undefined && delta < 0;
  const accent = color || BI.teal;

  // Textura automática para cards highlight
  const resolvedTexture = texture !== undefined ? texture : (highlight ? 'gear' : false);

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 card-bi glass-card"
      style={{
        background:  BI.panelHi,
        border:      highlight ? `1px solid ${BI.teal}50` : `1px solid ${BI.border}`,
        boxShadow:   highlight ? BI.shadowGlow : BI.shadowCard,
        position:    'relative',
      }}
    >
      {/* Texturas de fundo decorativas */}
      {resolvedTexture === 'gear'        && <GearTexture />}
      {resolvedTexture === 'radar'       && <RadarTexture color={accent} />}
      {resolvedTexture === 'wave'        && <WaveTexture color={accent} />}
      {resolvedTexture === 'network'     && <NetworkTexture color={accent} />}
      {resolvedTexture === 'speedometer' && <SpeedometerTexture color={accent} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Label + hint icon */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: BI.textMuted }}>
            {label}
          </span>
          {hint && (
            <div style={{ position: 'relative' }}>
              <span
                onMouseEnter={() => setHintVisible(true)}
                onMouseLeave={() => setHintVisible(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  cursor: 'default', userSelect: 'none',
                  background: `${BI.textMuted}22`,
                  color: BI.textMuted,
                  border: `1px solid ${BI.textMuted}40`,
                  lineHeight: 1,
                }}
              >
                i
              </span>
              {hintVisible && (
                <div style={{
                  position: 'absolute', bottom: '120%', left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 100, pointerEvents: 'none',
                  background: BI.panelHi,
                  border: `1px solid ${BI.border}`,
                  borderRadius: 10,
                  padding: '8px 12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  minWidth: 200, maxWidth: 260,
                  whiteSpace: 'normal',
                }}>
                  <p style={{ color: BI.textSec, fontSize: 12, lineHeight: 1.5, fontWeight: 500 }}>
                    {hint}
                  </p>
                  {/* Seta apontando para baixo */}
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: `6px solid ${BI.border}`,
                  }} />
                </div>
              )}
            </div>
          )}
        </div>

        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
            <Icon size={13} style={{ color: accent }} />
          </div>
        )}
      </div>

      {/* Value */}
      <div>
        <p className="text-3xl font-black leading-none" style={{ color: BI.text }}>{value}</p>
        {subInfo && (
          <p className="text-[11px] font-medium mt-1" style={{ color: BI.textMuted }}>{subInfo}</p>
        )}
        {delta !== null && delta !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            <div
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: isPos ? BI.success : isNeg ? BI.danger : `${BI.textMuted}30`,
                color:      isPos ? BI.successInk : isNeg ? BI.dangerInk : BI.textMuted,
              }}
            >
              {isPos && <ArrowUpRight size={11} />}
              {isNeg && <ArrowDownRight size={11} />}
              {fmtPct(delta)}
            </div>
            <span className="text-xs" style={{ color: BI.textMuted }}>{deltaLabel}</span>
          </div>
        )}
      </div>

      {/* SparkLine */}
      {spark && spark.length >= 2 && (
        <div style={{ marginTop: -4 }}>
          <SparkLine data={spark} color={accent} height={36} />
        </div>
      )}
    </div>
  );
};
