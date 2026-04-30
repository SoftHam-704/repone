import { 
  LayoutGrid, 
  Users, 
  Clock, 
  Briefcase, 
  UserCircle, 
  Star, 
  Search,
  ChevronRight,
  LogOut,
  Bell,
  Settings
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MENU_GRID = [
  { id: 'dashboard', icon: LayoutGrid, label: 'Painel' },
  { id: 'clients', icon: Users, label: 'Clientes' },
  { id: 'time', icon: Clock, label: 'Agenda' },
  { id: 'finance', icon: Briefcase, label: 'Finanças' },
  { id: 'payroll', icon: UserCircle, label: 'Pedidos' },
  { id: 'reviews', icon: Star, label: 'Metas' },
];

export default function Sidebar() {
  const [active, setActive] = useState('dashboard');
  const navigate = useNavigate();

  return (
    <aside className="w-[320px] h-screen fixed left-0 top-0 p-8 flex flex-col gap-10 bg-[#FFF9F2] z-50 overflow-y-auto no-scrollbar border-r border-[#F0E9E0]">
      {/* Branding */}
      <div className="flex items-center gap-4 px-2">
        <div className="w-14 h-14 rounded-[24px] bg-[#1A1A1A] flex items-center justify-center shadow-xl active:scale-95 transition-transform cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-8 h-8 rounded-full mustard-gradient border-4 border-[#1A1A1A]" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-charcoal text-2xl tracking-tighter leading-none">SalesMasters</span>
          <span className="text-[10px] font-bold text-mustard uppercase tracking-[0.3em] mt-1">SalesMasters V2</span>
        </div>
      </div>

      {/* Global Search */}
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary group-focus-within:text-mustard transition-colors" />
        <input
          type="text"
          placeholder="O que você procura?"
          className="w-full bg-white border border-[#F0E9E0] rounded-[2rem] py-5 pl-14 pr-4 text-xs font-bold text-charcoal outline-none focus:ring-8 focus:ring-mustard/5 transition-all placeholder:text-text-tertiary shadow-sm"
        />
      </div>

      {/* Modern Grid Menu */}
      <nav className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]">Dashboard Principal</h4>
          <LayoutGrid size={14} className="text-text-tertiary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {MENU_GRID.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex flex-col items-center justify-center p-6 rounded-[2.5rem] border transition-all gap-3 group relative overflow-hidden ${
                active === item.id
                  ? 'bg-charcoal border-charcoal shadow-2xl scale-[1.05] z-10'
                  : 'bg-white border-[#F0E9E0] hover:border-mustard/50 shadow-sm'
              }`}
            >
              <item.icon className={`w-7 h-7 transition-colors ${
                active === item.id ? 'text-mustard' : 'text-text-secondary group-hover:text-charcoal'
              }`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                active === item.id ? 'text-white' : 'text-text-tertiary group-hover:text-charcoal'
              }`}>
                {item.label}
              </span>
              {active === item.id && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-noise opacity-10 pointer-events-none"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Secondary Lists */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]">Acesso Rápido</h4>
          <Settings size={14} className="text-text-tertiary" />
        </div>
        <div className="grid gap-3">
           {['Bissirep', 'Borcato', 'RepOne Cloud'].map((fav) => (
             <div key={fav} className="flex items-center justify-between p-5 bg-white rounded-[1.8rem] border border-[#F0E9E0] hover:border-mustard transition-all cursor-pointer group shadow-sm">
                <div className="flex items-center gap-4">
                   <div className="w-2.5 h-2.5 rounded-full bg-mustard shadow-[0_0_12px_rgba(255,210,0,0.6)]" />
                   <span className="text-xs font-bold text-charcoal group-hover:translate-x-1 transition-transform tracking-tight">{fav}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
             </div>
           ))}
        </div>
      </div>

      {/* User / Logout */}
      <div className="mt-auto pt-6 border-t border-[#F0E9E0] flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border-2 border-white shadow-md flex items-center justify-center text-[#FFD200] font-black text-xs">
               JD
            </div>
            <div className="flex flex-col">
               <span className="text-sm font-black text-[#1A1A1A] leading-tight">John Doe</span>
               <span className="text-[10px] font-bold text-[#A1A1A1] uppercase tracking-widest">Admin Rep</span>
            </div>
         </div>
         <button className="p-3 rounded-full hover:bg-[#FFD200]/10 transition-colors group">
            <LogOut className="w-5 h-5 text-[#A1A1A1] group-hover:text-[#FFD200] transition-colors" />
         </button>
      </div>
    </aside>
  );
}
