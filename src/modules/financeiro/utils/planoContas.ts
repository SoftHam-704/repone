// Helper canônico do Plano de Contas: separa contas SINTÉTICAS (grupos/totalizadoras)
// de ANALÍTICAS (folhas, onde se lança/classifica movimento).
//
// Regra contábil: uma conta é ANALÍTICA quando é folha — nenhuma outra conta a tem
// como filha. NUNCA se lança movimento em conta sintética.
//
// Detecção de "tem filha" por DOIS sinais (robusto a dados incompletos):
//   1) id_pai — alguma conta aponta esta como pai;
//   2) codigo hierárquico — alguma conta tem código começando com "<codigo>." (ex.:
//      "1.1.01" é filha de "1.1"). O ponto evita falso-positivo ("1.10" não é filha de "1.1").

type PlanoLike = { id: number; codigo?: string; id_pai?: number | null }

/** Só as contas analíticas (folhas). Exclui as sintéticas (que têm filhas). */
export function apenasAnaliticas<T extends PlanoLike>(planos: T[]): T[] {
  const comFilhos = new Set<number>()
  for (const p of planos) if (p.id_pai != null) comFilhos.add(Number(p.id_pai))
  const codigos = planos.map(p => p.codigo).filter((c): c is string => !!c)
  return planos.filter(p => {
    if (comFilhos.has(p.id)) return false
    if (p.codigo && codigos.some(c => c !== p.codigo && c.startsWith(p.codigo + '.'))) return false
    return true
  })
}

/** Analíticas de um tipo ('R' receita / 'D' despesa). Folha calculada sobre a lista cheia. */
export function analiticasPorTipo<T extends PlanoLike & { tipo: string }>(planos: T[], tipo: 'R' | 'D'): T[] {
  return apenasAnaliticas(planos).filter(p => p.tipo === tipo)
}
