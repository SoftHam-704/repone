import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface BIFilters {
  anos:         number[];      // 1 ou 2 anos selecionados
  meses:        number[];      // [] = ano todo; [1,2,3] = Jan/Fev/Mar
  for_codigo:  number | null; // indústria selecionada
  cli_codigo:  number | null; // cliente selecionado
  ven_codigo:  number | null; // vendedor selecionado
  agrupar_rede: boolean;      // agrupar resultados por rede de lojas
}

export type BIVisao = 'financeiro' | 'volume' | 'skus';

export type BITab =
  | 'visao-geral'
  | 'industrias'
  | 'clientes'
  | 'estatisticas'
  | 'curva-abc'
  | 'metas'
  | 'equipe'
  | 'produtos';

interface BIStore {
  activeTab:  BITab;
  filters:    BIFilters;
  visao:      BIVisao;
  setTab:     (tab: BITab) => void;
  setFilters: (partial: Partial<BIFilters>) => void;
  setVisao:   (v: BIVisao) => void;
  toggleAno:  (ano: number) => void;
  toggleMes:  (mes: number) => void;
  reset:      () => void;
  // URL sync
  syncFromURL: (search: string) => void;
  toURLParams: () => URLSearchParams;
}

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_FILTERS: BIFilters = {
  anos:         [CURRENT_YEAR],
  meses:        [],
  for_codigo:   null,
  cli_codigo:   null,
  ven_codigo:   null,
  agrupar_rede: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────
export const useBIStore = create<BIStore>((set, get) => ({
  activeTab: 'visao-geral',
  filters:   { ...DEFAULT_FILTERS },
  visao:     'financeiro',

  setTab: (tab) => set({ activeTab: tab }),

  setVisao: (v) => set({ visao: v }),

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),

  toggleAno: (ano) =>
    set((s) => {
      const { anos } = s.filters;
      if (anos.includes(ano)) {
        // Remove, mas mantém ao menos 1
        const next = anos.filter((a) => a !== ano);
        return { filters: { ...s.filters, anos: next.length ? next : anos } };
      }
      // Permite no máximo 2 anos (modo YoY)
      const next = anos.length >= 2 ? [anos[anos.length - 1], ano] : [...anos, ano];
      return { filters: { ...s.filters, anos: next.sort((a, b) => b - a) } };
    }),

  toggleMes: (mes) =>
    set((s) => {
      const { meses } = s.filters;
      const next = meses.includes(mes) ? meses.filter((m) => m !== mes) : [...meses, mes];
      return { filters: { ...s.filters, meses: next } };
    }),

  reset: () => set({ filters: { ...DEFAULT_FILTERS }, activeTab: 'visao-geral', visao: 'financeiro' }),

  // ─── URL sync ─────────────────────────────────────────────────────────────
  syncFromURL: (search) => {
    const p = new URLSearchParams(search);
    const anos = p.get('anos')?.split(',').map(Number).filter(Boolean) || [CURRENT_YEAR];
    const meses = p.get('meses')?.split(',').map(Number).filter(Boolean) || [];
    const for_codigo = p.get('ind') ? parseInt(p.get('ind')!) : null;
    const cli_codigo = p.get('cli') ? parseInt(p.get('cli')!) : null;
    const ven_codigo = p.get('ven') ? parseInt(p.get('ven')!) : null;
    const agrupar_rede = p.get('rede') === '1';
    const tab = (p.get('tab') as BITab) || 'visao-geral';
    set({ activeTab: tab, filters: { anos, meses, for_codigo, cli_codigo, ven_codigo, agrupar_rede } });
  },

  toURLParams: () => {
    const { activeTab, filters } = get();
    const p = new URLSearchParams();
    p.set('tab', activeTab);
    p.set('anos', filters.anos.join(','));
    if (filters.meses.length) p.set('meses', filters.meses.join(','));
    if (filters.for_codigo) p.set('ind', String(filters.for_codigo));
    if (filters.cli_codigo) p.set('cli', String(filters.cli_codigo));
    if (filters.ven_codigo) p.set('ven', String(filters.ven_codigo));
    if (filters.agrupar_rede) p.set('rede', '1');
    return p;
  },
}));

// ─── Selectors convenientes ──────────────────────────────────────────────────
export const isModoComparacao = (filters: BIFilters) => filters.anos.length === 2;

/** Query params para um endpoint BI */
export function buildBIParams(filters: BIFilters): string {
  const p = new URLSearchParams();
  p.set('anos', filters.anos.join(','));
  if (filters.meses.length) p.set('meses', filters.meses.join(','));
  if (filters.for_codigo)   p.set('for_codigo', String(filters.for_codigo));
  if (filters.cli_codigo)   p.set('cli_codigo', String(filters.cli_codigo));
  if (filters.ven_codigo)   p.set('ven_codigo', String(filters.ven_codigo));
  if (filters.agrupar_rede) p.set('agrupar_rede', 'true');
  return p.toString();
}
