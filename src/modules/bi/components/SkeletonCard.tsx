import { BI } from './biTokens';

interface SkeletonCardProps {
  height?: number | string;
  className?: string;
  lines?: number;
}

export const SkeletonCard = ({ height = 120, className = '', lines = 0 }: SkeletonCardProps) => (
  <div
    className={`rounded-2xl overflow-hidden ${className}`}
    style={{ background: BI.panelHi, border: `1px solid ${BI.border}` }}
  >
    {lines > 0 ? (
      <div className="p-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg animate-pulse"
            style={{
              height: i === 0 ? 14 : 10,
              width: i === 0 ? '60%' : `${40 + Math.random() * 40}%`,
              background: BI.panelHi,
            }}
          />
        ))}
      </div>
    ) : (
      <div className="animate-pulse" style={{ height, background: BI.panelHi }} />
    )}
  </div>
);

export const SkeletonKPI = () => (
  <div
    className="rounded-2xl p-5"
    style={{ background: BI.panelHi, border: `1px solid ${BI.border}` }}
  >
    <div className="animate-pulse space-y-3">
      <div className="h-3 rounded" style={{ width: '40%', background: BI.panelHi }} />
      <div className="h-8 rounded" style={{ width: '65%', background: BI.panelHi }} />
      <div className="h-2.5 rounded" style={{ width: '30%', background: BI.panelHi }} />
      <div className="h-10 rounded-xl mt-2" style={{ background: BI.panelHi }} />
    </div>
  </div>
);
