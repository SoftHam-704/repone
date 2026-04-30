import { create } from 'zustand';
import { api } from '@/shared/lib/api';

export interface Alerta {
  tipo: string;
  severidade: 'warning' | 'error';
  titulo: string;
  descricao: string;
}

interface AlertasStore {
  count:   number;
  items:   Alerta[];
  loading: boolean;
  fetch:   () => Promise<void>;
}

export const useAlertasStore = create<AlertasStore>((set) => ({
  count:   0,
  items:   [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/bi/alertas');
      if (res.data.success) {
        const items: Alerta[] = res.data.data?.items ?? [];
        set({ items, count: items.length });
      }
    } catch {
      // alertas são não-críticos — falha silenciosa
    } finally {
      set({ loading: false });
    }
  },
}));
