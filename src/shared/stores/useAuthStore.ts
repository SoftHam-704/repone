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

// ─── Helper canônico: IA ligada? (kill switch + paywall da IRIS) ─────────────
// FONTE ÚNICA DA VERDADE pra "a IA está ligada?". Use SEMPRE este helper —
// não recrie a comparação inline (foi assim que 'NONE' e 'INATIVA' driftaram).
//
// empresas.plano_ia_nivel — gravado pelo toggle "Acesso à IRIS" do SoftHam-ADM:
//   DESLIGADO → 'INATIVA' (canônico)  ·  'NONE' = legado, também conta como off.
//   LIGADO    → 'ATIVA' (canônico)    ·  'ATIVO'/'BASIC'/qualquer outro = ligado.
export function iaLigada(planLevel?: string | null): boolean {
  return !['INATIVA', 'NONE', ''].includes(String(planLevel ?? 'ATIVA').toUpperCase());
}

// Hook pra componentes:
//   if (!useIaEnabled()) return null;   // ou: {useIaEnabled() && <IrisPanel/>}
export function useIaEnabled(): boolean {
  return iaLigada(useAuthStore(s => s.user?.iaPlanLevel));
}

// ─── Helper canônico: quem pode USAR a IRIS conversacional (Pergunte à IRIS) ──
// Gerência ou acima (manager/admin/superadmin). Operador (vendedor) NÃO.
// A Carta Confidencial (config WhatsApp) segue só-Master, à parte deste gate.
// Liberado pra Gerência em 2026-06-09 (Hamilton). Espelha o backend (levelOf >= GERENCIA).
export function podeUsarIris(role?: string | null): boolean {
  return ['manager', 'admin', 'superadmin'].includes(String(role || ''));
}
