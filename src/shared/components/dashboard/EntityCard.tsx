import { Factory, MapPin, DollarSign, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface EntityCardProps {
  title: string;
  subtitle: string;
  value: string;
  badge: string;
  icon: any;
  color?: string;
}

export default function EntityCard({ title, subtitle, value, badge, icon: Icon, color = 'bg-[#1A1A1A]' }: EntityCardProps) {
  return (
    <div className="flex flex-col gap-8 h-full min-h-[320px]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-7">
          <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center shadow-xl shadow-[#FFD200]/10 border-4 border-white ${color}`}>
            <Icon className="w-10 h-10 text-[#FFD200]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
               <h3 className="text-3xl font-black text-[#1A1A1A] tracking-tighter">{title}</h3>
               <CheckCircle2 className="w-6 h-6 text-[#FFD200]" strokeWidth={3} />
            </div>
            <p className="text-[11px] font-black text-[#A1A1A1] flex items-center gap-2 tracking-[0.2em] uppercase">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-[#FFD200]/10 border border-[#FFD200]/20 rounded-full text-[10px] font-black text-[#FFD200] uppercase tracking-widest shadow-sm">
           Vip Status
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 px-6 py-3 rounded-[24px] bg-white border border-[#F0E9E0] shadow-sm hover:border-[#FFD200] transition-colors cursor-pointer group">
           <MapPin className="w-4 h-4 text-[#A1A1A1] group-hover:text-[#FFD200] transition-colors" />
           <span className="text-[10px] font-black text-[#6B7281] uppercase tracking-wider">Sudeste / SP</span>
        </div>
        <div className="flex items-center gap-2.5 px-6 py-3 rounded-[24px] bg-[#1A1A1A] border border-[#1A1A1A] shadow-md hover:bg-[#FFD200]/10 hover:border-[#FFD200] transition-all cursor-pointer group">
           <DollarSign className="w-4 h-4 text-[#FFD200]" />
           <span className="text-[10px] font-black text-white group-hover:text-[#FFD200] uppercase tracking-wider">{badge}</span>
        </div>
        <div className="flex items-center gap-2.5 px-6 py-3 rounded-[24px] bg-white border border-[#F0E9E0] shadow-sm">
           <Clock className="w-4 h-4 text-[#A1A1A1]" />
           <span className="text-[10px] font-black text-[#6B7281] uppercase tracking-wider">Metas</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 py-4">
        <span className="text-5xl font-black text-[#1A1A1A] tracking-tighter">
          {value} <span className="text-sm font-bold text-[#A1A1A1]">/ Mês</span>
        </span>
        <div className="flex items-center gap-2 mt-2">
           <span className="text-[11px] font-bold text-[#A1A1A1]">Score: 98/100</span>
           <div className="w-1 h-1 rounded-full bg-[#FFD200]" />
           <span className="text-[11px] font-bold text-[#A1A1A1]">Atualizado Agora</span>
        </div>
      </div>

      <div className="flex gap-4 mt-auto pt-8 border-t border-[#F0E9E0] border-dashed">
        <button className="flex-1 bg-white border border-[#F0E9E0] text-[#1A1A1A] px-8 py-5 rounded-[28px] font-black uppercase tracking-widest text-[11px] hover:border-[#1A1A1A] transition-all active:scale-95 shadow-sm group flex items-center justify-center gap-2">
           Ver Portfolio
           <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
        </button>
        <button className="flex-[1.4] bg-gradient-to-br from-[#FFD200] to-[#FFAA00] text-[#1A1A1A] px-8 py-5 rounded-[28px] font-black uppercase tracking-widest text-[11px] hover:-translate-y-1 transition-all shadow-xl shadow-[#FFD200]/30 active:scale-95 flex items-center justify-center gap-2">
          Gerar Pedido Automático
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
