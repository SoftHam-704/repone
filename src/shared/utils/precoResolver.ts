// ─────────────────────────────────────────────────────────────────────────────
// precoResolver.ts — espelho frontend do helper canônico de preço.
// Lógica matemática IDÊNTICA a backend/src/shared/utils/preco-resolver.ts.
//
// REGRA NÃO-NEGOCIÁVEL: TODA tela/componente que precisa escolher entre
// preco_bruto / preco_promo / preco_especial / preco_peso para apresentar
// ou gravar `puni` deve chamar `resolverPrecoFinal()`. Não duplicar fórmula.
//
// Quando o backend retornar o preço já resolvido (ex: getPricesForOrderHandler),
// use o preço dele direto. Esse helper é pro cenário em que o frontend recebe
// os 3 preços crus e ainda precisa escolher (ImportModals, ConferenciaSection,
// ItemsSection no fluxo de selecionar produto do catálogo).
// ─────────────────────────────────────────────────────────────────────────────

export type Canal = 'varejo' | 'distribuidor';

export interface PrecosProduto {
  precoBruto:     number;
  precoPromo:     number;
  precoEspecial:  number;
  precoPeso?:     number;
  pesoProduto?:   number;
  /** Desconto adicional da TABELA (itab_descontoadd) — entra na cascata como +1 %. */
  descontoAdd?:   number;
}

export interface PoliticaCliente {
  canal:     Canal;
  /** cli_desc1..cli_desc11, percentuais (5 = 5%). */
  descontos: number[];
}

export interface PrecoResolvido {
  preco:               number;
  precoBase:           number;
  isPromo:             boolean;
  descontosAplicados:  number[];
  motivo:              string;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function resolverPrecoFinal(
  precos:   PrecosProduto,
  politica: PoliticaCliente,
): PrecoResolvido {
  const bruto       = Number(precos.precoBruto)    || 0;
  const promo       = Number(precos.precoPromo)    || 0;
  const especial    = Number(precos.precoEspecial) || 0;
  const precoPeso   = Number(precos.precoPeso)     || 0;
  const pesoProduto = Number(precos.pesoProduto)   || 0;
  const descontoAdd = Number(precos.descontoAdd)   || 0;

  const canal     = politica.canal === 'distribuidor' ? 'distribuidor' : 'varejo';
  const descontos = (politica.descontos || []).map(d => Number(d) || 0);

  if (promo > 0) {
    return {
      preco:              round2(promo),
      precoBase:          promo,
      isPromo:            true,
      descontosAplicados: [],
      motivo:             'promo (líquido)',
    };
  }

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
    precoBase  = bruto;
    baseMotivo = 'bruto (varejo)';
  }

  if (precoPeso > 0 && pesoProduto > 0) {
    precoBase  = precoPeso * pesoProduto;
    baseMotivo = `${baseMotivo} → peso (${precoPeso} × ${pesoProduto})`;
  }

  // cascata cli_ind/grupo + desconto adicional da tabela (itab_descontoadd) por cima
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
                          ? ` × descontos ${aplicados.map(d => `${d}%`).join('+')}`
                          : ''),
  };
}

/** Monta PoliticaCliente a partir de uma linha cli_ind do frontend. */
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
