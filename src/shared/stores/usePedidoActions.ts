import { create } from 'zustand';

interface PedidoActionsState {
  pendingOpen: string | null; // ped_pedido to open in edit mode after navigation
  setPendingOpen: (ped: string | null) => void;
}

export const usePedidoActions = create<PedidoActionsState>((set) => ({
  pendingOpen: null,
  setPendingOpen: (ped) => set({ pendingOpen: ped }),
}));
