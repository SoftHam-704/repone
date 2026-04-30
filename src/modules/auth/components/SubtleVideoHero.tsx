import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import logoIcon from '@/assets/images/logo.png';

interface SubtleVideoHeroProps {
  videoSrc: string;
}

export const SubtleVideoHero: React.FC<SubtleVideoHeroProps> = ({ videoSrc }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#EFF1F4]">
      {/* Background Video (Subtle) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 2 }}
        className="w-full h-full grayscale opacity-20 contrast-[0.9]"
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      </motion.div>

      {/* Decorative Overlays */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#EFF1F4]/80 via-[#EFF1F4]/40 to-transparent" />
      
      {/* Hero Content (Clean & Elegant) */}
      <div className="absolute inset-0 flex flex-col justify-between p-12 lg:p-20 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-[#2D7A7B] flex items-center justify-center rounded-[8px] shadow-sm">
             <img src={logoIcon} alt="Logo" className="w-6 h-6 object-contain" />
          </div>
          <span className="text-[#1A2A2E] text-2xl font-bold tracking-tight">SalesMasters <span className="text-[#2D7A7B]">V2</span></span>
        </motion.div>

        <div className="max-w-xl pb-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2D7A7B]/10 border border-[#2D7A7B]/20 mb-10"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#2D7A7B]" />
            <span className="text-[11px] font-bold text-[#2D7A7B] uppercase tracking-widest">Plataforma Empresarial Segura</span>
          </motion.div>
          
          <div className="space-y-4">
            {['Venda Melhor.', 'Gerencie Rápido.', 'Cresça Sempre.'].map((line, i) => (
              <motion.h1 
                key={i}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + (i * 0.2), duration: 1 }}
                className={`text-5xl lg:text-7xl font-bold tracking-tighter leading-none
                  ${i === 2 ? 'text-[#2D7A7B]' : 'text-[#1A2A2E]'}`}
              >
                {line}
              </motion.h1>
            ))}
          </div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 1 }}
            className="text-[#6B7B8D] text-lg font-medium leading-relaxed max-w-sm mt-10 border-l-2 border-[#E8EAED] pl-6"
          >
            Inteligência de Rede & Gestão Neural transformadas em resultados.
          </motion.p>
        </div>
      </div>
    </div>
  );
};
