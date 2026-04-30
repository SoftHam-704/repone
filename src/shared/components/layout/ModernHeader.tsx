import { Search, Bell, MessageSquare, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function ModernHeader() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-24 bg-white/70 backdrop-blur-2xl sticky top-0 z-50 flex items-center justify-between px-12 shadow-[0_4px_30px_rgba(0,0,0,0.03)] gap-10 transition-all border-b border-white/50">
      {/* Logo Section */}
      <div className="flex items-center gap-2 min-w-[150px] cursor-pointer" onClick={() => navigate('/dashboard')}>
        <div className="w-10 h-10 rounded-full bg-teal-primary flex items-center justify-center shadow-lg shadow-teal-primary/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" />
            <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="font-bold text-text-primary text-xl tracking-tight">Sales<span className="text-teal-primary">Masters</span></span>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-[800px] flex items-center gap-2 bg-[#F8FAFC] border border-grid rounded-xl px-4 py-2 hover:border-teal-primary/30 transition-colors">
        <div className="flex items-center gap-3 flex-1 border-r border-grid pr-4">
          <Search className="w-5 h-5 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Pesquisar Clientes, Pedidos..." 
            className="bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary w-full font-medium"
          />
        </div>
        
        <div className="hidden lg:flex items-center gap-4 px-4 border-r border-grid">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover px-3 py-1.5 rounded-lg transition-colors group">
            <span className="text-sm font-semibold text-text-secondary group-hover:text-text-primary">{user?.empresa || 'Faturamento'}</span>
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          </div>
        </div>

        <button className="bg-teal-primary hover:bg-teal-dark text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ml-2">
          Buscar
        </button>
      </div>

      {/* Profile & Notifications */}
      <div className="flex items-center gap-6 min-w-[220px] justify-end">
        <div className="flex gap-4">
          <div className="relative cursor-pointer hover:scale-110 transition-transform group">
            <Bell className="w-6 h-6 text-text-secondary group-hover:text-teal-primary" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-coral text-white text-[10px] flex items-center justify-center rounded-full font-bold border-2 border-white">3</span>
          </div>
          <div className="relative cursor-pointer hover:scale-110 transition-transform group">
            <MessageSquare className="w-6 h-6 text-text-secondary group-hover:text-teal-primary" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-primary text-white text-[10px] flex items-center justify-center rounded-full font-bold border-2 border-white">2</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 pl-4 border-l border-grid relative group">
          <div className="text-right flex flex-col justify-center">
             <p className="text-xs font-black text-text-primary uppercase leading-none mb-1">{user?.nome}</p>
             <p className="text-[10px] font-bold text-text-tertiary uppercase leading-none tracking-widest">{user?.role || 'User'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#1A2A2E] flex items-center justify-center overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:ring-2 ring-teal-primary transition-all relative">
             <User className="text-white w-6 h-6" />
             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={handleLogout}>
                <LogOut className="text-white w-5 h-5" />
             </div>
          </div>
        </div>
      </div>
    </header>
  );
}
