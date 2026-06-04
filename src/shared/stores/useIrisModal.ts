import { create } from 'zustand';

/**
 * Estado global do modal da IRIS Dev.
 * Fonte única de verdade — o orbe do sidebar, o atalho Ctrl+K e qualquer card
 * chamam o MESMO modal. Vive no MainLayout (shell do sistema) → nunca no portal.
 */
interface IrisModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useIrisModal = create<IrisModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
