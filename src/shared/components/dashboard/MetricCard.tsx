import { TrendingUp, TrendingDown, Target, Zap, Activity, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: string;
  trend: string;
  isPositive?: boolean;
  icon: any;
  color?: string;
}

export default function MetricCard({ label, value, trend, isPositive = true, icon: Icon, color = 'bg-[#1A1A1A]' }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-6 h-full min-h-[220px]">
      <div className="flex items-center justify-between">
        <div className={`w-14 h-14 rounded-[22px] flex items-center justify-center shadow-lg border-2 border-white ${color}`}>
          <Icon className="w-8 h-8 text-[#FFD200]" />
        </div>
        <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[10px] font-black leading-none uppercase tracking-widest ${
          isPositive ? 'bg-[#FFD200]/10 text-[#FFD200] border border-[#FFD200]/20' : 'bg-red-50 text-red-500 border border-red-100'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
           <h4 className="text-[10px] font-black text-[#A1A1A1] uppercase tracking-[0.25em] leading-none pl-1">{label}</h4>
           <div className="w-1.5 h-1.5 rounded-full bg-[#FFD200]" />
        </div>
        <div className="flex items-baseline gap-1">
           <span className="text-4xl font-black text-[#1A1A1A] tracking-tighter">
             {value}
           </span>
           {isPositive && <ArrowUpRight className="w-4 h-4 text-[#FFD200] mb-2" />}
        </div>
      </div>

      {/* Progress Indicator (Mustard Precision Style) */}
      <div className="mt-auto pt-4 border-t border-[#F0E9E0] border-dashed">
         <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black text-[#6B7281] uppercase tracking-widest">Performance Q1</span>
            <span className="text-[9px] font-black text-[#1A1A1A] uppercase">82%</span>
         </div>
         <div className="h-2 w-full bg-[#FFF9F2] rounded-full overflow-hidden border border-[#F0E9E0] p-0.5">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: "82%" }}
               transition={{ duration: 1.5, ease: "circOut" }}
               className="h-full bg-gradient-to-r from-[#FFD200] to-[#FFAA00] rounded-full shadow-[0_0_10px_rgba(255,210,0,0.4)]"
            />
         </div>
      </div>
    </div>
  );
}
