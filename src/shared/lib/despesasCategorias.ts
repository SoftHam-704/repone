// src/shared/lib/despesasCategorias.ts
// Categorias de despesa de viagem — fonte única para mobile e web (lista fixa).
export const DESPESA_CATEGORIAS = [
  'Café',
  'Uber/Taxi',
  'Almoço',
  'Cesta Básica',
  'Jantar',
  'Despesa com Hospedagem',
  'Happy Hour com Cliente/Fornecedor',
  'Estacionamento',
  'Pedágios',
  'Combustível',
  'Correios',
  'Presente para Clientes',
  'Amostras',
  'Materiais para Escritório',
  'Campanhas de Vendas',
  'Revisão Veículo',
  'Lavagem Veículo',
  'Aluguel Veículo',
] as const;

export type DespesaCategoria = typeof DESPESA_CATEGORIAS[number];
