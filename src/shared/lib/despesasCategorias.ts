// src/shared/lib/despesasCategorias.ts
// Categorias de despesa de viagem — fonte única para mobile e web.
export const DESPESA_CATEGORIAS = [
  'Combustível',
  'Alimentação',
  'Manutenção',
  'Pedágio',
  'Hospedagem',
  'Outros',
] as const;

export type DespesaCategoria = typeof DESPESA_CATEGORIAS[number];
