export function SatisfactionGauge() {
  const percentage = 80;
  const radius = 52;
  const cx = 60;
  const cy = 62;
  const startAngle = 135;
  const endAngle = 405;
  const sweepAngle = endAngle - startAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (start: number, end: number, r: number) => {
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const progressEnd = startAngle + (percentage / 100) * sweepAngle;

  const ticks = [0, 20, 40, 60, 80, 100];
  const tickElements = ticks.map((val) => {
    const angle = startAngle + (val / 100) * sweepAngle;
    const innerR = radius + 6;
    const outerR = radius + 10;
    const x1 = cx + innerR * Math.cos(toRad(angle));
    const y1 = cy + innerR * Math.sin(toRad(angle));
    const x2 = cx + outerR * Math.cos(toRad(angle));
    const y2 = cy + outerR * Math.sin(toRad(angle));
    const labelR = radius + 17;
    const lx = cx + labelR * Math.cos(toRad(angle));
    const ly = cy + labelR * Math.sin(toRad(angle));
    return { val, x1, y1, x2, y2, lx, ly };
  });

  const dotX = cx + radius * Math.cos(toRad(progressEnd));
  const dotY = cy + radius * Math.sin(toRad(progressEnd));

  return (
    <div className="rounded-2xl p-4">
      <div className="flex flex-col items-center">
        <div className="relative w-[160px] h-[120px]">
          <svg viewBox="0 0 120 100" className="w-full h-full overflow-visible">
            <path
              d={arcPath(startAngle, endAngle, radius)}
              fill="none"
              stroke="hsl(45 10% 92%)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d={arcPath(startAngle, progressEnd, radius)}
              fill="none"
              stroke="hsl(45 80% 55%)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {tickElements.map((t) => (
              <g key={t.val}>
                <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="hsl(30 8% 70%)" strokeWidth="0.5" />
                <text x={t.lx} y={t.ly} textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="hsl(30 8% 55%)">
                  {t.val === 0 ? "00" : t.val}
                </text>
              </g>
            ))}
            <circle cx={dotX} cy={dotY} r="4.5" fill="hsl(45 80% 55%)" />
            <circle cx={dotX} cy={dotY} r="2" fill="white" />
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="16" fontWeight="700" fill="hsl(30 10% 15%)">
              {percentage}%
            </text>
            <text x={cx} y={cy + 9} textAnchor="middle" fontSize="4.5" fill="hsl(30 8% 50%)">
              Employee Satisfactory
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
