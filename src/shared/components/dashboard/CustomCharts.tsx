import React from 'react';
import { motion } from 'framer-motion';

/**
 * GaugeChart - Inspirado no design circular da Homies Lab (80% Satisfaction)
 */
export const GaugeChart: React.FC<{ value: number; size?: number; label?: string }> = ({ 
  value, 
  size = 220,
  label = 'Satisfação do Representante'
}) => {
  const radius = size * 0.4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * (circumference * 0.75); // 0.75 para arco parcial
  const strokeWidth = size * 0.12;
  const center = size / 2;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-[225deg]" width={size} height={size}>
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 210, 0, 0.1)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        {/* Progress Fill */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#mustardGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference * 0.75 }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: "circOut" }}
        />
        <defs>
          <linearGradient id="mustardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD200" />
            <stop offset="100%" stopColor="#FFAA00" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Value Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span className="text-6xl font-black text-charcoal tracking-tighter">{value}%</span>
        <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest text-center px-8 leading-tight">
          {label}
        </span>
      </div>

      {/* Ticks/Markers */}
      <div className="absolute bottom-6 w-full flex justify-between px-6 text-[10px] font-bold text-text-tertiary opacity-40">
        <span>00</span>
        <span>100</span>
      </div>
    </div>
  );
};

/**
 * MustardLineChart - Um gráfico de linha simples e elegante em SVG
 */
export const MustardLineChart: React.FC<{ data: number[] }> = ({ data }) => {
  const width = 400;
  const height = 150;
  const padding = 20;

  const points = data.map((d, i) => ({
    x: padding + (i * (width - 2 * padding)) / (data.length - 1),
    y: (height - padding) - (d * (height - 2 * padding)) / 100
  }));

  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaData = `${pathData} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  return (
    <div className="w-full relative py-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFD200" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFD200" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Fill Area */}
        <motion.path
          d={areaData}
          fill="url(#chartGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        
        {/* Stroke Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="#FFD200"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Highlight Dots */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="white"
            stroke="#FFD200"
            strokeWidth="3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1 + i * 0.1 }}
          />
        ))}
      </svg>
    </div>
  );
};

/**
 * MustardBarChart - Gráfico de barras verticais com realce
 */
export const MustardBarChart: React.FC<{ data: { label: string; value: number; active?: boolean }[] }> = ({ data }) => {
  return (
    <div className="flex items-end justify-between h-[180px] w-full gap-4 pt-10">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-3">
          <div className="relative w-full group">
            <motion.div
              className={`w-full rounded-xl transition-all duration-500 ${item.active ? 'mustard-gradient shadow-mustard' : 'bg-charcoal'}`}
              initial={{ height: 0 }}
              animate={{ height: `${item.value}%` }}
              transition={{ delay: i * 0.1, duration: 1, ease: "backOut" }}
            >
              {item.active && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-mustard text-charcoal text-[10px] font-black px-2 py-1 rounded-md">
                  {item.value}%
                </div>
              )}
            </motion.div>
          </div>
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
