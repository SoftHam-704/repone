
import { motion } from 'framer-motion';
import { X, LayoutDashboard } from 'lucide-react';
import { useTabStore, Tab } from '@/shared/stores/useTabStore';
import { useNavigate } from 'react-router-dom';

const G = {
  bg:        '#E8E1D4',  // Sand main bg
  card:      '#F2ECE2',  // Sand light
  border:    '#D3C7AD',  // Sand border
  text:      '#28374A',  // Navy main
  textSec:   '#3D5265',  // Navy med
  mustard:   '#FFD200',  // Mustard accent
  teal:      '#2A7A6F',  // Teal from PortalHome
  navy:      '#1E2D3D',  // Navy from Sidebar
};

export function TabHeader() {
  const { tabs, activeTabId, removeTab, setActiveTab } = useTabStore();
  const navigate = useNavigate();

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeTab(id);
    const { activeTabId, tabs } = useTabStore.getState();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) navigate(activeTab.path);
  };

  return (
    <div className="flex items-end px-4 pt-1 gap-[1px] overflow-x-auto scrollbar-hide select-none relative z-10"
      style={{ backgroundColor: G.bg, borderBottom: `2px solid ${G.navy}` }}>
      {tabs.map((tab, idx) => {
        const isActive = activeTabId === tab.id;
        
        return (
          <motion.div
            key={tab.id}
            layoutId={tab.id}
            onClick={() => handleTabClick(tab)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative group cursor-pointer h-9 flex items-center px-10 transition-all duration-200`}
            style={{
              zIndex: isActive ? 50 : 10 - idx,
              marginLeft: idx === 0 ? 0 : '-15px', 
            }}
          >
            {/* Slanted Background */}
            <div 
              className={`absolute inset-0 transition-all duration-300`}
              style={{
                backgroundColor: isActive ? G.navy : G.card,
                clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
                border: !isActive ? `1px solid ${G.border}` : 'none',
                boxShadow: isActive ? '0 -4px 12px rgba(0,0,0,0.15)' : 'none',
              }}
            />

            {/* Hover State Slant (Subtle shift) */}
            {!isActive && (
              <div 
                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                style={{
                  backgroundColor: 'rgba(30, 45, 61, 0.05)',
                  clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
                }}
              />
            )}

            {/* Content */}
            <div className="relative flex items-center gap-2 z-20">
              {tab.id === '/dashboard' && <LayoutDashboard size={13} strokeWidth={3} style={{ color: isActive ? G.mustard : G.textSec }} />}
              <span 
                className={`text-[10px] font-black uppercase tracking-tighter whitespace-nowrap`}
                style={{ color: isActive ? '#fff' : G.textSec }}
              >
                {tab.label}
              </span>

              {tab.closable && (
                <button
                  onClick={(e) => handleClose(e, tab.id)}
                  className="p-0.5 rounded-full hover:bg-white/20 transition-colors ml-1"
                  style={{ color: isActive ? '#fff' : G.textSec }}
                >
                  <X size={11} strokeWidth={4} />
                </button>
              )}
            </div>

            {/* Active Indicator Line (Bottom) */}
            {isActive && (
              <motion.div 
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-[15%] right-[15%] h-1 rounded-t-full"
                style={{ backgroundColor: G.mustard }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
