import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'white' | 'mustard' | 'charcoal' | 'glass';
  delay?: number;
}

export default function BentoCard({ 
  children, 
  className, 
  variant = 'white',
  delay = 0 
}: BentoCardProps) {
  const variants = {
    white: 'bg-white border-white border shadow-premium text-charcoal',
    mustard: 'mustard-gradient text-charcoal shadow-mustard border-none',
    charcoal: 'bg-charcoal text-white border-none shadow-premium',
    glass: 'glass-card border-none shadow-premium'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        delay, 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      whileHover={{ scale: 1.01, y: -5 }}
      className={cn(
        "relative overflow-hidden rounded-[3.5rem] p-10 flex flex-col justify-between transition-all duration-300",
        variants[variant],
        className
      )}
    >
      {/* Subtle Grain Overlay for texture */}
      <div className="absolute inset-0 bg-noise pointer-events-none mix-blend-overlay opacity-20" />
      
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}
