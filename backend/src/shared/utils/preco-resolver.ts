// ─────────────────────────────────────────────────────────────────────────────
// preco-resolver.ts — helper canônico de cálculo de preço final
//
// Política comercial vive em cli_ind (canal + descontos cascata + tabela).
// Este helper recebe a POLÍTICA já resolvida e os preços do produto, e retorna
// o preço final. NÃO sabe quem é Polo, Stahl ou qualquer indústria — só
// matemática. Qualquer regra nova de indústria deve virar coluna em cli_ind
// (ou política equivalente) que alimenta a estrutura passada aqui.
//
// REGRA NÃO-NEGOCIÁVEL: TODO endpoint, importador, exportador, portal, BI ou
// relatório que precise calcular o preço unitário aplicado deve chamar
// `resolverPrecoFinal()`. Nunca duplicar fórmula em outro arquivo.
// ─────────────────────────────────────────────────────────────────────────────

export type Canal = 'varejo' | 'distribuidor';

export interface PrecosProduto {
  precoBruto:     number;
  precoPromo:     number;
  precoEspecial:  number;
  /** Indústrias que cobram por peso (preço por kg × peso do produto). Opcional. */
  precoPeso?:     number;
  pesoProduto?:   number;
  /**
   * Desconto adicional da TABELA de preço (`cad_tabelaspre.itab_descontoadd`).
   * Algumas indústrias dão um % a mais numa tabela combo/pallet SEM mexer no bruto.
   * Entra na cascata como MAIS UM desconto, junto com os demais (multiplicativo).
   * Não se aplica sobre promo (promo é líquido absoluto, sem cascata). Opcional.
   */
  descontoAdd?:   number;
}

export interface PoliticaCliente {
  canal:      Canal;
  /** cli_desc1..cli_desc11 do cli_ind, na ordem. Valores em percentual (5 = 5%). */
  descontos:  number[];
  /**
   * Mapa de descontos por GRUPO DO PRODUTO (cad_prod.pro_grupo).
   * Origem: tabela `cli_descpro` (cli_codigo, cli_forcodigo, cli_grupo).
   * Quando o produto tem pro_grupo e há registro aqui, a cascata DESSE grupo
   * sobrescreve totalmente a cascata padrão de `descontos`. Prioridade #1.
   */
  descontosPorGrupoCliente?:  Record<number, number[]>;
  /**
   * Mapa de descontos por GRUPO DA TABELA DE PREÇOS (cad_tabelaspre.itab_grupodesconto).
   * Origem: tabela `grupo_desc` (gde_id).
   * Quando NÃO há match em `descontosPorGrupoCliente` mas o produto tem
   * itab_grupodesconto, esta cascata vira a aplicada. Prioridade #2.
   */
  descontosPorGrupoTabela?:   Record<number, number[]>;
}

export interface ProdutoContexto {
  /** `cad_prod.pro_grupo` — usado para Prio #1 (cli_descpro). */
  proGrupo?:             number | null;
  /** `cad_tabelaspre.itab_grupodesconto` — usado para Prio #2 (grupo_desc). */
  itabGrupoDesconto?:    number | null;
}

export interface PrecoResolvido {
  /** Preço unitário final, já com descontos aplicados. Arredondado a 2 casas. */
  preco:               number;
  /** Base usada (bruto, especial ou promo) antes da cascata. */
  precoBase:           number;
  /** TRUE se preço promocional foi usado — promo é líquido absoluto, sem cascata. */
  isPromo:             boolean;
  /** Descontos efetivamente aplicados na cascata (filtrados > 0). */
  descontosAplicados:  number[];
  /** Texto humano explicando como o preço foi montado (útil pra log/debug/UI). */
  motivo:              string;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

/**
 * Resolve o preço final de um produto para um cliente, dada sua política.
 *
 * Regras (validadas por Hamilton em 2026-05-22):
 *   1. `precoPromo > 0` SEMPRE vence — é líquido absoluto, ignora descontos.
 *   2. Senão, base depende do canal:
 *      - `distribuidor` → usa `precoEspecial` se > 0, senão `precoBruto`
 *      - `varejo`       → SEMPRE `precoBruto` (IGNORA `precoEspecial`)
 *   3. Se a indústria usa preço por peso (`precoPeso > 0 && pesoProduto > 0`),
 *      substitui a base por `precoPeso × pesoProduto`.
 *   4. Aplica cascata de descontos (multiplicativa) sobre a base.
 */
export function resolverPrecoFinal(
  precos: PrecosProduto,
  politica: PoliticaCliente,
  produto?: ProdutoContexto,
): PrecoResolvido {
  const bruto       = Number(precos.precoBruto)    || 0;
  const promo       = Number(precos.precoPromo)    || 0;
  const especial    = Number(precos.precoEspecial) || 0;
  const precoPeso   = Number(precos.precoPeso)     || 0;
  const pesoProduto = Number(precos.pesoProduto)   || 0;
  const descontoAdd = Number(precos.descontoAdd)   || 0;

  const canal = politica.canal === 'distribuidor' ? 'distribuidor' : 'varejo';

  // ── Resolver cascata de descontos com hierarquia (Prio 1 > Prio 2 > Prio 3) ─
  //
  // Prio 1 (CLIENT_GROUP): cli_descpro indexado por pro_grupo do produto.
  //   "Esse cliente tem desconto especial pra esse grupo de produto" — sobrescreve
  //   a cascata default da cli_ind. Origem: V1 (order_items_endpoints.js).
  //
  // Prio 2 (TABLE_GROUP): grupo_desc indexado por itab_grupodesconto da tabela.
  //   "Esta linha da tabela de preço tem desconto especial associado" — fallback
  //   quando o cliente não tem regra própria pra esse grupo.
  //
  // Prio 3 (CLI_IND): cli_desc1..cli_desc11 — fallback final, política padrão.
  let descontos: number[];
  let cascataMotivo: string;

  const proGrupo  = produto?.proGrupo  != null ? Number(produto.proGrupo)  : null;
  const itabGrupo = produto?.itabGrupoDesconto != null ? Number(produto.itabGrupoDesconto) : null;

  const matchCli = (proGrupo != null && politica.descontosPorGrupoCliente)
    ? politica.descontosPorGrupoCliente[proGrupo]
    : undefined;
  const matchTab = (itabGrupo != null && politica.descontosPorGrupoTabela)
    ? politica.descontosPorGrupoTabela[itabGrupo]
    : undefined;

  if (matchCli && matchCli.some(d => d > 0)) {
    descontos = matchCli.map(d => Number(d) || 0);
    cascataMotivo = `cli_descpro[grupo=${proGrupo}]`;
  } else if (matchTab && matchTab.some(d => d > 0)) {
    descontos = matchTab.map(d => Number(d) || 0);
    cascataMotivo = `grupo_desc[id=${itabGrupo}]`;
  } else {
    descontos = (politica.descontos || []).map(d => Number(d) || 0);
    cascataMotivo = 'cli_ind padrão';
  }

  // 1. Promo é líquido absoluto
  if (promo > 0) {
    return {
      preco:              round2(promo),
      precoBase:          promo,
      isPromo:            true,
      descontosAplicados: [],
      motivo:             'promo (líquido)',
    };
  }

  // 2. Base por canal
  let precoBase: number;
  let baseMotivo: string;
  if (canal === 'distribuidor') {
    if (especial > 0) {
      precoBase  = especial;
      baseMotivo = 'especial (distribuidor)';
    } else {
      precoBase  = bruto;
      baseMotivo = 'bruto (distribuidor s/ especial)';
    }
  } else {
    // varejo IGNORA especial sempre
    precoBase  = bruto;
    baseMotivo = 'bruto (varejo)';
  }

  // 3. Preço por peso sobrescreve base, se aplicável
  if (precoPeso > 0 && pesoProduto > 0) {
    precoBase  = precoPeso * pesoProduto;
    baseMotivo = `${baseMotivo} → peso (${precoPeso} × ${pesoProduto})`;
  }

  // 4. Cascata de descontos (cli_ind/grupo) + desconto adicional da TABELA.
  //    O descontoAdd (itab_descontoadd) entra como MAIS UM % na sequência — sempre
  //    sobre o bruto, junto com os demais (era o "desc11" do Delphi).
  const cascata = descontoAdd > 0 ? [...descontos, descontoAdd] : descontos;
  let preco = precoBase;
  const aplicados: number[] = [];
  for (const d of cascata) {
    if (d > 0) {
      preco = preco * (1 - d / 100);
      aplicados.push(d);
    }
  }

  return {
    preco:              round2(preco),
    precoBase:          round2(precoBase),
    isPromo:            false,
    descontosAplicados: aplicados,
    motivo:             baseMotivo + (aplicados.length
                          ? ` × ${cascataMotivo}${descontoAdd > 0 ? '+add' : ''} ${aplicados.map(d => `${d}%`).join('+')}`
                          : ''),
  };
}

/**
 * Carrega os 2 mapas de desconto por grupo a partir do banco do tenant.
 *
 *   `descontosPorGrupoCliente` — `cli_descpro` filtrado pela carteira do cliente
 *                                naquela indústria (Prio 1).
 *   `descontosPorGrupoTabela`  — `grupo_desc` global do tenant (Prio 2).
 *
 * Chame uma vez por carrinho/pedido e passe o resultado dentro da `PoliticaCliente`
 * para o `resolverPrecoFinal`.
 */
export async function carregarDescontosPorGrupo(
  db: any,
  cliCodigo: number,
  forCodigo: number,
): Promise<{
  descontosPorGrupoCliente: Record<number, number[]>;
  descontosPorGrupoTabela:  Record<number, number[]>;
}> {
  // Prio 1: cli_descpro indexado pelo grupo do produto
  const cliRes = await db.query(
    `SELECT cli_grupo,
            COALESCE(cli_desc1,0) AS d1, COALESCE(cli_desc2,0) AS d2,
            COALESCE(cli_desc3,0) AS d3, COALESCE(cli_desc4,0) AS d4,
            COALESCE(cli_desc5,0) AS d5, COALESCE(cli_desc6,0) AS d6,
            COALESCE(cli_desc7,0) AS d7, COALESCE(cli_desc8,0) AS d8,
            COALESCE(cli_desc9,0) AS d9
     FROM cli_descpro
     WHERE cli_codigo = $1 AND cli_forcodigo = $2`,
    [cliCodigo, forCodigo],
  );
  const descontosPorGrupoCliente: Record<number, number[]> = {};
  for (const r of cliRes.rows) {
    descontosPorGrupoCliente[r.cli_grupo] = [
      r.d1, r.d2, r.d3, r.d4, r.d5, r.d6, r.d7, r.d8, r.d9,
    ].map((d: any) => Number(d) || 0);
  }

  // Prio 2: grupo_desc global do tenant
  const tabRes = await db.query(
    `SELECT gde_id,
            COALESCE(gde_desc1,0) AS d1, COALESCE(gde_desc2,0) AS d2,
            COALESCE(gde_desc3,0) AS d3, COALESCE(gde_desc4,0) AS d4,
            COALESCE(gde_desc5,0) AS d5, COALESCE(gde_desc6,0) AS d6,
            COALESCE(gde_desc7,0) AS d7, COALESCE(gde_desc8,0) AS d8,
            COALESCE(gde_desc9,0) AS d9
     FROM grupo_desc`,
  );
  const descontosPorGrupoTabela: Record<number, number[]> = {};
  for (const r of tabRes.rows) {
    descontosPorGrupoTabela[r.gde_id] = [
      r.d1, r.d2, r.d3, r.d4, r.d5, r.d6, r.d7, r.d8, r.d9,
    ].map((d: any) => Number(d) || 0);
  }

  return { descontosPorGrupoCliente, descontosPorGrupoTabela };
}

/**
 * Monta a estrutura `PoliticaCliente` a partir de uma linha do `cli_ind`.
 * Use quando você tem a row do banco e precisa passar pro `resolverPrecoFinal`.
 */
export function montarPoliticaDeCliInd(row: any): PoliticaCliente {
  const descontos: number[] = [];
  for (let i = 1; i <= 11; i++) {
    descontos.push(Number(row?.[`cli_desc${i}`] || 0) || 0);
  }
  return {
    canal: String(row?.cli_canal || 'varejo') === 'distribuidor' ? 'distribuidor' : 'varejo',
    descontos,
  };
}
