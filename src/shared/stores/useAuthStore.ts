import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  codigo: number;
  empresa_id: number;
  nome: string;
  sobrenome: string;
  role: string;
  empresa: string;
  cnpj: string;
  ramoatv: string;
  biEnabled: boolean;
  whatsappEnabled: boolean;
  crmRepEnabled: boolean;
  portalLojistaEnabled: boolean;
  iaPlanLevel: string;
}

export interface TenantConfig {
  cnpj: string;
  schema: string;
  ramoatv: string;
}

interface AuthState {
  user: User | null;
  tenantConfig: TenantConfig | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: { user: User; token: string; tenantConfig: TenantConfig }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenantConfig: null,
      token: null,
      isAuthenticated: false,
      login: (data) => {
        localStorage.setItem('sm_token', data.token);
        set({
          user: data.user,
          tenantConfig: data.tenantConfig,
          token: data.token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        localStorage.removeItem('sm_token');
        set({
          user: null,
          tenantConfig: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'sm_auth_state',
    }
  )
);
