import { useState } from 'react';
import { ShoppingBag, LayoutGrid, Users, BarChart3, Plus, Briefcase, Info } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'vendas', label: 'Dashboard de Vendas', icon: LayoutGrid, active: true },
  { id: 'pedidos', label: 'Meus Pedidos', icon: ShoppingBag, active: false },
  { id: 'clientes', label: 'Carteira de Clientes', icon: Users, active: false },
  { id: 'representadas', label: 'Representadas', icon: Briefcase, active: false },
  { id: 'relatorios', label: 'Análises & BI', icon: BarChart3, active: false },
  { id: 'ajuda', label: 'Suporte & Ajuda', icon: Info, active: false },
];

export default function ModernSubNav() {
  const [activeTab, setActiveTab] = useState('vendas');

  return (
    <nav className="h-20 bg-[#F8FAFC]/50 backdrop-blur-md border-b border-grid px-10 flex items-center justify-between sticky top-20 z-40 gap-10">
      <div className="flex items-center h-full gap-4 lg:gap-8 overflow-x-auto no-scrollbar scroll-smooth">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2.5 h-full px-1 border-b-2 transition-all whitespace-nowrap group relative ${
              activeTab === tab.id 
                ? 'border-teal-primary text-text-primary' 
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <tab.icon className={`w-5 h-5 transition-colors ${
              activeTab === tab.id ? 'text-teal-primary' : 'text-text-tertiary group-hover:text-text-secondary'
            }`} />
            <span className={`text-sm font-semibold tracking-tight transition-all ${
               activeTab === tab.id ? 'text-text-primary' : ''
            }`}>
              {tab.label}
            </span>
            
            {/* Animated Indicator */}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTabUnderline"
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-teal-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <button className="flex items-center gap-2 bg-[#1A2A2E] hover:bg-black text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 group flex-shrink-0">
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
        Novo Pedido
      </button>
    </nav>
  );
}
