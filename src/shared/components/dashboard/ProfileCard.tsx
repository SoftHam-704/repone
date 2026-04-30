import { User, ShieldCheck, PieChart, RefreshCw, XCircle, CheckCircle, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/shared/stores/useAuthStore';

export default function ProfileCard() {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col gap-10 h-full p-10 bg-[#1A1A1A] text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[32px] bg-[#FFD200] flex items-center justify-center shadow-2xl shadow-[#FFD200]/20 border-4 border-[#1A1A1A] overflow-hidden">
             <User className="text-[#1A1A1A] w-10 h-10" />
          </div>
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                <h3 className="text-3xl font-black text-white tracking-tighter leading-none capitalize">{user?.nome || 'Admin'}</h3>
                <ShieldCheck className="w-6 h-6 text-[#FFD200] fill-[#FFD200]/10" />
             </div>
             <p className="text-[11px] font-black text-[#A1A1A1] uppercase tracking-[0.2em] leading-none mt-1">
                {user?.role || 'Representante'} / Master Level
             </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 pt-10 border-t border-white/5 border-dashed">
         <div className="flex items-center justify-between group cursor-pointer transition-all bg-white/5 p-5 rounded-[28px] border border-white/5 hover:border-[#FFD200]/30 hover:bg-white/10">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-[#FFD200]/10 flex items-center justify-center group-hover:bg-[#FFD200] group-hover:text-[#1A1A1A] text-[#FFD200] transition-all border border-[#FFD200]/10">
                  <PieChart className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-[#6B7281] uppercase tracking-widest leading-none mb-1">BI Analytics</p>
                  <span className="text-lg font-black text-white tracking-tight leading-none">ATIVO</span>
               </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#FFD200] shadow-[0_0_10px_rgba(255,210,0,0.8)]" />
         </div>
         
         <div className="flex items-center justify-between group cursor-pointer transition-all bg-white/5 p-5 rounded-[28px] border border-white/5 hover:border-[#FFD200]/30 hover:bg-white/10">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#FFD200] group-hover:text-[#1A1A1A] text-[#A1A1A1] transition-all border border-white/10">
                  <RefreshCw className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-[#6B7281] uppercase tracking-widest leading-none mb-1">WhatsApp CRM</p>
                  <span className="text-lg font-black text-white tracking-tight leading-none">ONLINE</span>
               </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
         </div>
      </div>

      <div className="flex gap-4 mt-auto">
        <button className="flex-1 bg-white/5 border border-white/10 text-[#A1A1A1] py-5 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-[#1A1A1A] transition-all active:scale-95 flex items-center justify-center gap-2">
           <Settings className="w-4 h-4" />
           Ajustes
        </button>
        <button className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 py-5 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2">
           <LogOut className="w-4 h-4" />
           Sair
        </button>
      </div>
    </div>
  );
}
