import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

interface LoginBladeProps {
  onLogin: (e: React.FormEvent, data: { cnpj: string; nome: string; sobrenome: string; password: string }) => void;
  loading: boolean;
}

export const LoginBlade: React.FC<LoginBladeProps> = ({ onLogin, loading }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [cnpj, setCnpj] = useState(() => localStorage.getItem('sm_saved_cnpj') || '');
  const [nome, setNome] = useState(() => localStorage.getItem('sm_saved_nome') || '');
  const [sobrenome, setSobrenome] = useState(() => localStorage.getItem('sm_saved_sobrenome') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('sm_remember_me') === 'true');
  const cnpjInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on CNPJ field
  useEffect(() => {
    if (cnpjInputRef.current) {
      cnpjInputRef.current.focus();
    }
  }, []);

  // Automatic CNPJ Masking
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 14) value = value.substring(0, 14);

    if (value.length <= 14) {
      value = value.replace(/^(\d{2})(\d)/, "$1.$2");
      value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
      value = value.replace(/(\d{4})(\d)/, "$1-$2");
    }
    setCnpj(value);
  };

  // Enter as Tab Logic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (!form) return;
      
      const index = Array.from(form.elements).indexOf(e.currentTarget);
      const nextElement = form.elements[index + 1] as HTMLElement;
      
      if (nextElement && nextElement.nodeName === 'INPUT') {
        nextElement.focus();
      } else {
        triggerLogin(e as any);
      }
    }
  };

  const triggerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberMe) {
      localStorage.setItem('sm_saved_cnpj', cnpj);
      localStorage.setItem('sm_saved_nome', nome);
      localStorage.setItem('sm_saved_sobrenome', sobrenome);
      localStorage.setItem('sm_remember_me', 'true');
    } else {
      localStorage.removeItem('sm_saved_cnpj');
      localStorage.removeItem('sm_saved_nome');
      localStorage.removeItem('sm_saved_sobrenome');
      localStorage.removeItem('sm_remember_me');
    }
    onLogin(e, { cnpj, nome, sobrenome, password });
  };

  // Select all on focus
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="fixed right-0 top-0 h-screen w-full max-w-[450px] z-[60] flex flex-col justify-center px-12 lg:px-16 bg-white/[0.02] backdrop-blur-[100px] border-l border-white/5 shadow-[-40px_0_80px_rgba(0,0,0,0.5)]"
    >
      {/* Structural Accent Line */}
      <div className="absolute left-0 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-teal-500/20 to-transparent" />

      <div className="space-y-12">
        <header className="space-y-4">
          <motion.h2 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="text-4xl md:text-5xl font-black text-white tracking-tighter"
          >
            Acesso <span className="text-[#2D7A7B]">Restrito</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="text-white/30 text-base font-medium tracking-wide uppercase"
          >
            SalesMasters V2 Core Entry
          </motion.p>
        </header>

        <form onSubmit={triggerLogin} className="space-y-8">
          {/* CNPJ with AUTO MASK & FOCUS */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-3"
          >
            <label className="text-[10px] font-black text-[#2D7A7B] uppercase tracking-[0.3em] ml-1">Identificação Digital</label>
            <div className="group relative">
              <input 
                ref={cnpjInputRef}
                type="text" 
                value={cnpj}
                onChange={handleCnpjChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder="00.000.000/0000-00" 
                className="w-full bg-white/[0.03] border-b border-white/10 px-0 py-5 text-xl text-white placeholder:text-white/5 focus:border-[#2D7A7B] transition-all outline-none font-bold tracking-tight"
                required
              />
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#2D7A7B] group-focus-within:w-full transition-all duration-500" />
            </div>
          </motion.section>

          {/* Nome & Sobrenome */}
          <div className="grid grid-cols-2 gap-8">
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="space-y-3"
            >
              <label className="text-[10px] font-black text-[#2D7A7B] uppercase tracking-[0.3em] ml-1">Nome</label>
              <div className="group relative">
                <input 
                  type="text" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  placeholder="SEU NOME" 
                  className="w-full bg-white/[0.03] border-b border-white/10 px-0 py-3 text-lg text-white placeholder:text-white/5 focus:border-[#2D7A7B] transition-all outline-none font-bold tracking-tight"
                  required
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#2D7A7B] group-focus-within:w-full transition-all duration-500" />
              </div>
            </motion.section>
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="space-y-3"
            >
              <label className="text-[10px] font-black text-[#2D7A7B] uppercase tracking-[0.3em] ml-1">Sobrenome</label>
              <div className="group relative">
                <input 
                  type="text" 
                  value={sobrenome}
                  onChange={(e) => setSobrenome(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  placeholder="SEU SOBRENOME" 
                  className="w-full bg-white/[0.03] border-b border-white/10 px-0 py-3 text-lg text-white placeholder:text-white/5 focus:border-[#2D7A7B] transition-all outline-none font-bold tracking-tight"
                  required
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#2D7A7B] group-focus-within:w-full transition-all duration-500" />
              </div>
            </motion.section>
          </div>

          {/* Senha */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            className="space-y-3"
          >
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-[#2D7A7B] uppercase tracking-[0.3em]">Senha de Segurança</label>
              <button type="button" className="text-[9px] font-bold text-white/30 hover:text-[#2D7A7B] transition-colors uppercase tracking-[0.1em]">Redefinir</button>
            </div>
            <div className="group relative">
              <input 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••••••" 
                className="w-full bg-white/[0.03] border-b border-white/10 px-0 py-5 text-xl text-white placeholder:text-white/5 focus:border-[#2D7A7B] transition-all outline-none font-bold tracking-tight"
                required
              />
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#2D7A7B] group-focus-within:w-full transition-all duration-500" />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/10 hover:text-[#2D7A7B] transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex items-center gap-3 pt-2"
          >
            <div className="relative flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border border-white/20 rounded-sm bg-white/5 flex items-center justify-center peer-checked:bg-[#2D7A7B] peer-checked:border-[#2D7A7B] transition-all cursor-pointer shadow-sm ring-offset-[#0A1014] peer-focus-visible:ring-2 peer-focus-visible:ring-[#2D7A7B] peer-focus-visible:ring-offset-2">
                {rememberMe && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <label htmlFor="rememberMe" className="text-xs uppercase tracking-widest cursor-pointer text-white/50 select-none font-bold hover:text-[#2D7A7B] transition-colors">
              Lembrar meus acessos
            </label>
          </motion.div>

          <motion.button 
            type="submit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            disabled={loading} 
            className="group relative w-full py-7 bg-[#2D7A7B] hover:bg-[#1F5E5F] text-white font-black text-lg tracking-[0.2em] uppercase overflow-hidden shadow-[0_30px_60px_-15px_rgba(45,122,123,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-4"
          >
            {loading ? (
              <Loader2 className="animate-spin w-6 h-6" />
            ) : (
              <>
                Entrar no Portal
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </>
            )}
          </motion.button>
        </form>

        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="pt-12 text-center"
        >
          <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.3em]">
            SalesMasters Architecture — 2026 
          </p>
        </motion.footer>
      </div>
    </motion.aside>
  );
};
