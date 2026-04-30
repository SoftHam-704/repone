import { useEffect, useState, useRef } from 'react';
import { Search, Bell, MessageSquare, ChevronDown, User, LogOut, LayoutGrid, ShoppingBag, Users, Briefcase, BarChart3, Info, Plus, Activity, Calendar, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { api } from '@/shared/utils/api';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'cadastros', label: 'Cadastros', icon: Users },
  { id: 'movimentacoes', label: 'Movimentações', icon: ShoppingBag },
  { id: 'financeiro', label: 'Financeiro', icon: Briefcase },
  { id: 'crm', label: 'CRM / Pipeline', icon: Activity },
  { id: 'relatorios', label: 'Relatórios & BI', icon: BarChart3 },
  { id: 'utilitarios', label: 'Utilitários', icon: LayoutGrid },
];

export default function UnifiedNavbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cadastros');

  // Dynamic filter logic
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 4 + i).toString());
  const months = monthNames.slice(0, currentMonthIdx + 1);

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(monthNames[currentMonthIdx]);

  // Real Data State
  const [industries, setIndustries] = useState<any[]>([]);
  const [loadingIndustries, setLoadingIndustries] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<any>(null);
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');

  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchIndustries();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIndustries(industrySearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [industrySearch]);

  // Fetch Industries (from V1 /api/aux/industrias)
  const fetchIndustries = async (search = '') => {
    try {
      setLoadingIndustries(true);
      const data = await api(`/api/aux/industrias?search=${search}`);
      if (data.success) {
        setIndustries(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar indústrias:', error);
    } finally {
      setLoadingIndustries(false);
    }
  };

  // Search Clients (from V1 /api/clients)
  const searchClients = async (search: string) => {
    try {
      setLoadingClients(true);
      const data = await api(`/api/clients?search=${search}`);
      if (data.success) {
        setClients(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsIndustryOpen(false);
        setIsClientOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (clientSearch) searchClients(clientSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="sticky top-0 z-50 w-full px-12 pt-6 pointer-events-none">
      <div className="max-w-[1920px] mx-auto bg-white rounded-[48px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-white/50 pointer-events-auto">
        
        {/* Top Tier: Search & Profile */}
        <div className="flex items-center justify-between px-12 h-24 gap-10">
          {/* Logo */}
          <div className="flex items-center gap-3 min-w-[150px] cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-12 h-12 rounded-[18px] bg-teal-primary flex items-center justify-center shadow-lg shadow-teal-primary/20">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" />
                <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-black text-text-primary text-2xl tracking-tighter">Sales<span className="text-teal-primary">Masters</span></span>
          </div>

          {/* Filters Panel (SalesMasters V1 Style) */}
          <div ref={dropdownRef} className="flex-1 max-w-[1100px] flex items-center gap-10">
            
            {/* Ano Filter */}
            <div className="flex flex-col gap-2 flex-shrink-0">
               <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
                  <label className="text-[10px] font-black text-text-tertiary uppercase tracking-widest leading-none">Ano</label>
               </div>
               <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl p-1 gap-1 shadow-inner h-12">
                  {years.map(year => (
                    <button 
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                        year === selectedYear ? 'bg-white text-text-primary shadow-sm border border-slate-100' : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
               </div>
            </div>

            {/* Mês Filter */}
            <div className="flex flex-col gap-2 flex-shrink-0">
               <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
                  <label className="text-[10px] font-black text-text-tertiary uppercase tracking-widest leading-none">Mês <span className="opacity-40 font-bold">(Opcional)</span></label>
               </div>
               <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl p-1 gap-1 shadow-inner h-12">
                  {months.map((month, idx) => (
                    <button 
                      key={`${month}-${idx}`}
                      onClick={() => setSelectedMonth(month)}
                      className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                        month === selectedMonth ? 'bg-white text-text-primary shadow-sm border border-slate-100' : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      {month}
                    </button>
                  ))}
                  {/* Empty space to mimic original width if few months */}
                  {months.length < 5 && <div className="w-20 hidden lg:block" />}
               </div>
            </div>

            {/* Indústria Filter */}
            <div className="flex flex-col gap-2 flex-1 relative">
               <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-text-tertiary" />
                  <label className="text-[10px] font-black text-text-tertiary uppercase tracking-widest leading-none">Indústria</label>
               </div>
               <div 
                 onClick={() => setIsIndustryOpen(!isIndustryOpen)}
                 className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 h-12 shadow-sm cursor-pointer hover:bg-slate-50 transition-all group"
               >
                  <span className="text-[11px] font-black text-text-primary uppercase tracking-widest truncate max-w-[120px]">
                    {selectedIndustry ? selectedIndustry.label : 'Todas as Indústrias'}
                  </span>
                  {loadingIndustries ? <Loader2 className="w-4 h-4 text-teal-primary animate-spin" /> : <ChevronDown className="w-4 h-4 text-text-tertiary group-hover:text-text-primary transition-all" />}
               </div>
               
               {isIndustryOpen && (
                 <div className="absolute top-[72px] left-0 w-[240px] bg-white rounded-3xl border border-slate-100 shadow-2xl py-3 z-[60] animate-in fade-in slide-in-from-top-2">
                   <div className="px-4 mb-3">
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
                       <input 
                         type="text"
                         placeholder="PESQUISAR INDÚSTRIA..."
                         value={industrySearch}
                         onChange={(e) => setIndustrySearch(e.target.value)}
                         className="w-full bg-slate-50 border-none rounded-xl py-2 pl-9 pr-4 text-[10px] font-black uppercase tracking-widest placeholder:text-slate-300 focus:ring-1 focus:ring-teal-primary/20 outline-none"
                         autoFocus
                         onClick={(e) => e.stopPropagation()}
                       />
                     </div>
                   </div>
                   <div className="max-h-60 overflow-y-auto custom-scrollbar">
                     <div 
                       onClick={() => { setSelectedIndustry(null); setIsIndustryOpen(false); setIndustrySearch(''); }}
                       className="px-5 py-2.5 hover:bg-slate-50 cursor-pointer text-[10px] font-black text-text-tertiary uppercase tracking-widest transition-colors"
                     >
                       Todas as Indústrias
                     </div>
                      {industries.map((ind, idx) => (
                        <div 
                          key={ind.value || idx}
                          onClick={() => { setSelectedIndustry(ind); setIsIndustryOpen(false); setIndustrySearch(''); }}
                          className="px-5 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors border-t border-slate-50 flex flex-col gap-0.5"
                        >
                          <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">{ind.label}</span>
                          <span className="text-[9px] font-medium text-text-tertiary uppercase truncate">{ind.for_nome}</span>
                        </div>
                      ))}
                   </div>
                 </div>
               )}
            </div>

            {/* Cliente Filter */}
            <div className="flex flex-col gap-2 flex-1 relative">
               <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-text-tertiary" />
                  <label className="text-[10px] font-black text-text-tertiary uppercase tracking-widest leading-none">Cliente</label>
               </div>
               <div 
                 onClick={() => setIsClientOpen(!isClientOpen)}
                 className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 h-12 shadow-sm cursor-pointer hover:bg-slate-50 transition-all group"
               >
                  <span className="text-[11px] font-black text-text-primary uppercase tracking-widest truncate max-w-[140px]">
                    {selectedClient ? selectedClient.label : 'Todos os Clientes'}
                  </span>
                  {loadingClients ? <Loader2 className="w-4 h-4 text-teal-primary animate-spin" /> : <ChevronDown className="w-4 h-4 text-text-tertiary group-hover:text-text-primary transition-all" />}
               </div>
               
               {isClientOpen && (
                 <div className="absolute top-[72px] right-0 lg:left-0 w-[300px] bg-white rounded-3xl border border-slate-100 shadow-2xl py-3 z-[60] animate-in fade-in slide-in-from-top-2">
                   <div className="px-4 mb-3">
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
                       <input 
                         type="text"
                         placeholder="PESQUISAR CLIENTE (NOME/CNPJ/COD)..."
                         value={clientSearch}
                         onChange={(e) => setClientSearch(e.target.value)}
                         className="w-full bg-slate-50 border-none rounded-xl py-2 pl-9 pr-4 text-[10px] font-black uppercase tracking-widest placeholder:text-slate-300 focus:ring-1 focus:ring-teal-primary/20 outline-none"
                         autoFocus
                         onClick={(e) => e.stopPropagation()}
                       />
                     </div>
                   </div>
                   <div className="max-h-60 overflow-y-auto custom-scrollbar">
                     <div 
                       onClick={() => { setSelectedClient(null); setIsClientOpen(false); setClientSearch(''); }}
                       className="px-5 py-2.5 hover:bg-slate-50 cursor-pointer text-[10px] font-black text-text-tertiary uppercase tracking-widest transition-colors"
                     >
                       Todos os Clientes
                     </div>
                      {clients.map((client, idx) => (
                        <div 
                          key={client.value || idx}
                          onClick={() => { setSelectedClient(client); setIsClientOpen(false); setClientSearch(''); }}
                          className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-t border-slate-50 flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">{client.label}</span>
                            <span className="text-[9px] font-bold text-teal-primary bg-teal-50 px-1.5 py-0.5 rounded-md">#{client.cli_codigo}</span>
                          </div>
                          <span className="text-[9px] font-medium text-text-tertiary uppercase truncate">{client.cli_razao || client.cli_nome}</span>
                          <span className="text-[8px] font-mono text-slate-400">{client.cli_cnpj}</span>
                        </div>
                      ))}
                      {clients.length === 0 && !loadingClients && clientSearch && (
                        <div className="px-5 py-8 text-center">
                          <Info className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum cliente encontrado</p>
                        </div>
                      )}
                   </div>
                 </div>
               )}
            </div>
          </div> {/* Filters Panel (123) */}
 
          {/* Right Placeholder - Balanced UI */}
          <div className="min-w-[150px]" />
        </div> {/* Top Tier (110) */}

        {/* Bottom Tier: Tabs & Quick Action */}
        <div className="flex items-center justify-between px-12 h-20 border-t border-slate-50 bg-slate-50/20">
          <div className="flex items-center gap-10 h-full overflow-x-auto no-scrollbar">
             {TABS.map(tab => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 h-full px-1 border-b-[3px] transition-all whitespace-nowrap group relative ${
                    activeTab === tab.id ? 'border-teal-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }`}
               >
                  <tab.icon className={`w-5 h-5 transition-all ${activeTab === tab.id ? 'text-teal-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`} />
                  <span className={`text-sm font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                    {tab.label}
                  </span>
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTabUnderline"
                      className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-teal-primary"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
               </button>
             ))}
          </div>

          {/* Button removed as requested */}
        </div>

      </div>
    </div>
  );
}
