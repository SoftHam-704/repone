
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tab {
  id: string;
  label: string;
  path: string;
  closable: boolean;
  icon?: string; // Lucide icon name as string
}

interface TabState {
  tabs: Tab[];
  activeTabId: string;
  addTab: (tab: Omit<Tab, 'closable'> & { closable?: boolean }) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  getTabByPath: (path: string) => Tab | undefined;
}

const DASHBOARD_TAB: Tab = {
  id: '/dashboard',
  label: 'Dashboard',
  path: '/dashboard',
  closable: false,
};

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [DASHBOARD_TAB],
      activeTabId: '/dashboard',

      addTab: (tab) => {
        const { tabs } = get();
        const exists = tabs.find((t) => t.id === tab.id || t.path === tab.path);
        
        if (exists) {
          set({ activeTabId: exists.id });
          return;
        }

        const newTab: Tab = {
          ...tab,
          closable: tab.closable ?? true,
        };

        set({
          tabs: [...tabs, newTab],
          activeTabId: newTab.id,
        });
      },

      removeTab: (id) => {
        const { tabs, activeTabId } = get();
        if (id === '/dashboard') return; // Cannot close dashboard

        const filteredTabs = tabs.filter((t) => t.id !== id);
        let newActiveId = activeTabId;

        if (activeTabId === id) {
          // If we closed the active tab, pick the previous one
          const currentIndex = tabs.findIndex((t) => t.id === id);
          const nextTab = filteredTabs[currentIndex] || filteredTabs[currentIndex - 1];
          newActiveId = nextTab ? nextTab.id : 'dashboard';
        }

        set({
          tabs: filteredTabs,
          activeTabId: newActiveId,
        });
      },

      setActiveTab: (id) => {
        set({ activeTabId: id });
      },

      getTabByPath: (path) => {
        return get().tabs.find(t => t.path === path);
      }
    }),
    {
      name: 'sm_tab_state',
    }
  )
);
