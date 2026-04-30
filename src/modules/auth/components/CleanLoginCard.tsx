import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, User, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

interface CleanLoginCardProps {
  onLogin: (e: React.FormEvent) => void;
  loading: boolean;
}

export const CleanLoginCard: React.FC<CleanLoginCardProps> = ({ onLogin, loading }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[440px] bg-white rounded-[12px] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] p-8 md:p-12 border border-white"
    >
      <header className="mb-10 text-center md:text-left">
        <h2 className="text-[28px] font-bold text-[#1A2A2E] tracking-tight mb-2">Acesse sua Conta</h2>
        <p className="text-sm text-[#6B7B8D] font-medium leading-relaxed">Bem-vindo ao SalesMasters V2. Entre com seus dados.</p>
      </header>

      <form onSubmit={onLogin} className="space-y-6">
        {/* CNPJ */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-[#A0ADB8] uppercase tracking-[0.05em]">Identificação (CNPJ)</label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0ADB8] group-focus-within:text-[#2D7A7B] transition-colors">
              <Building2 size={18} />
            </div>
            <input 
              type="text" 
              placeholder="00.000.000/0000-00" 
              className="w-full pl-12 pr-4 py-3.5 rounded-[8px] bg-transparent border border-[#E8EAED] text-[#1A2A2E] placeholder:text-[#A0ADB8] focus:border-[#2D7A7B] focus:ring-4 focus:ring-[#2D7A7B]/10 transition-all outline-none text-sm font-medium"
              required
            />
          </div>
        </div>

        {/* Nome & Sobrenome */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#A0ADB8] uppercase tracking-[0.05em]">Nome</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0ADB8] group-focus-within:text-[#2D7A7B] transition-colors">
                <User size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Seu Nome" 
                className="w-full pl-12 pr-4 py-3.5 rounded-[8px] bg-transparent border border-[#E8EAED] text-[#1A2A2E] placeholder:text-[#A0ADB8] focus:border-[#2D7A7B] focus:ring-4 focus:ring-[#2D7A7B]/10 transition-all outline-none text-sm font-medium"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#A0ADB8] uppercase tracking-[0.05em]">Sobrenome</label>
            <input 
              type="text" 
              placeholder="Seu Sobrenome" 
              className="w-full px-4 py-3.5 rounded-[8px] bg-transparent border border-[#E8EAED] text-[#1A2A2E] placeholder:text-[#A0ADB8] focus:border-[#2D7A7B] focus:ring-4 focus:ring-[#2D7A7B]/10 transition-all outline-none text-sm font-medium"
              required
            />
          </div>
        </div>

        {/* Senha */}
        <div className="space-y-2">
          <div className="flex justify-between items-center pr-1">
            <label className="text-[11px] font-bold text-[#A0ADB8] uppercase tracking-[0.05em]">Senha de Acesso</label>
            <button type="button" className="text-[11px] font-bold text-[#2D7A7B] hover:text-[#1F5E5F] transition-colors">Esqueceu?</button>
          </div>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0ADB8] group-focus-within:text-[#2D7A7B] transition-colors">
              <Lock size={18} />
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="••••••••••••" 
              className="w-full pl-12 pr-12 py-3.5 rounded-[8px] bg-transparent border border-[#E8EAED] text-[#1A2A2E] placeholder:text-[#A0ADB8] focus:border-[#2D7A7B] focus:ring-4 focus:ring-[#2D7A7B]/10 transition-all outline-none text-sm font-medium"
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A0ADB8] hover:text-[#2D7A7B] transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={loading} 
            className="group relative w-full py-4 bg-[#2D7A7B] hover:bg-[#1F5E5F] text-white rounded-[8px] font-bold text-sm shadow-[0_8px_16px_-4px_rgba(45,122,123,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin w-5 h-5 text-white/80" />
            ) : (
              <>
                Entrar no Portal
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        <footer className="text-center pt-6">
          <p className="text-xs text-[#A0ADB8] font-medium">Contatar suporte: <span className="text-[#2D7A7B] font-bold">0800 123 4567</span></p>
        </footer>
      </form>
    </motion.div>
  );
};
