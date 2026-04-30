import { User, Mail, Plus, Send, X, ArrowRight, DollarSign } from 'lucide-react';

export default function FormCard() {
  return (
    <div className="flex flex-col gap-10 h-full p-2">
      {/* Header Info */}
      <div className="flex items-center gap-6 bg-[#1A1A1A] p-7 rounded-[32px] shadow-2xl shadow-[#1A1A1A]/20">
        <div className="w-16 h-16 rounded-[24px] bg-[#FFD200] flex items-center justify-center shadow-lg border-4 border-[#1A1A1A] overflow-hidden">
          <DollarSign className="text-[#1A1A1A] w-8 h-8" strokeWidth={3} />
        </div>
        <div className="flex flex-col">
          <h4 className="text-xl font-black text-white tracking-tighter leading-none mb-1">Rápido</h4>
          <p className="text-[10px] font-black text-[#FFD200] uppercase tracking-[0.2em] leading-none">Novo Ciclo de Venda</p>
        </div>
      </div>

      {/* Main Inputs */}
      <div className="flex flex-col gap-8 px-2">
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-[#A1A1A1] uppercase tracking-[0.25em] pl-1 flex items-center gap-2">
             Nome / CNPJ Cliente
             <div className="w-1.5 h-1.5 rounded-full bg-[#FFD200] shadow-[0_0_8px_rgba(255,210,0,0.6)]" />
          </label>
          <div className="relative group transition-all">
            <input 
              type="text" 
              placeholder="PESQUISAR CLIENTE..." 
              className="w-full bg-[#FDFBF7] border-2 border-[#F0E9E0] rounded-[24px] px-6 py-6 text-sm font-black outline-none focus:ring-4 ring-[#FFD200]/10 focus:border-[#FFD200] transition-all placeholder:text-[#A1A1A1] shadow-sm uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-[#A1A1A1] uppercase tracking-[0.25em] pl-1">Valor Previsto (R$)</label>
          <div className="relative group transition-all">
            <input 
              type="text" 
              placeholder="R$ 0,00" 
              className="w-full bg-[#1A1A1A] text-[#FFD200] border-none rounded-[24px] px-8 py-6 text-2xl font-black outline-none focus:ring-4 ring-[#FFD200]/20 transition-all placeholder:text-[#6B7281] shadow-2xl"
            />
          </div>
        </div>

        <button className="w-full bg-white border-2 border-dashed border-[#F0E9E0] text-[#A1A1A1] px-10 py-7 rounded-[32px] font-black uppercase tracking-[0.15em] text-[10px] hover:bg-white hover:border-[#FFD200] hover:text-[#1A1A1A] transition-all flex items-center justify-center gap-3 group active:scale-95 shadow-sm">
          <Plus className="w-6 h-6 text-[#FFD200] transition-transform group-hover:rotate-90 group-hover:scale-110" />
          Adicionar Itens ao Carrinho
        </button>
      </div>

      {/* Action Buttons with Gradients */}
      <div className="flex gap-4 mt-auto">
        <button className="flex-[1.8] bg-gradient-to-br from-[#FFD200] to-[#FFAA00] text-[#1A1A1A] py-6 rounded-[28px] font-black uppercase tracking-widest text-[11px] hover:translate-x-1 hover:shadow-2xl hover:shadow-[#FFD200]/30 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-[#FFD200]/20">
          Gerar Novo Pedido
          <ArrowRight className="w-5 h-5" />
        </button>
        <button className="flex-1 bg-white border border-[#F0E9E0] text-[#A1A1A1] py-6 rounded-[28px] font-black uppercase tracking-widest text-[11px] hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all active:scale-95 shadow-sm">
           Sair
        </button>
      </div>
    </div>
  );
}
