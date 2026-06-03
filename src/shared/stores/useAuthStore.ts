import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  codigo: number;
  empresa_id: number;
  nome: string;
  sobrenome: string;
  iniciais?: string;
  role: string;
  empresa: string;
  cnpj: string;
  ramoatv: string;
  biEnabled: boolean;
  whatsappEnabled: boolean;
  crmRepEnabled: boolean;
  portalLojistaEnabled: boolean;
  iaPlanLevel: string;
  isPromotor?: boolean;
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

// ─── Helper: kill switch da IRIS ────────────────────────────────────────────
// Convenção: empresas.plano_ia_nivel = 'NONE' → IRIS DESLIGADA em TUDO
// (Magic Load/Import, InsightNarrative, IrisTerminal, IrisPanel, SmartInsights,
// RiskInsights, PortfolioIris, página nexus-ia, etc).
// Qualquer outro valor (ex.: 'ATIVO') = ligada.
//
// Uso:
//   const iaEnabled = useIaEnabled();
//   if (!iaEnabled) return null;
//   // ou: {iaEnabled && <IrisPanel ... />}
export function useIaEnabled(): boolean {
  const planLevel = useAuthStore(s => s.user?.iaPlanLevel);
  return String(planLevel || 'ATIVO').toUpperCase() !== 'NONE';
}
