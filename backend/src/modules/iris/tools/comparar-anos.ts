import { resolverVendedorId } from './permissions';

/**
 * comparar_anos — compara dois anos (YoY) em faturamento e quantidade.
 *  - agrupar_por: 'mes' (default) · 'industria' · 'nenhum' (só os totais)
 *  - ped_situacao IN ('P','F'); valores crus. Escopo de vendedor pela sessão.
 */
export async function compararAnos(db: any, input: any, user: any) {
  const anoA = Number(input.ano_a);
  const anoB = Number(input.ano_b);
  const agruparPor = ['mes', 'industria', 'nenhum'].includes(input.agrupar_por) ? input.agrupar_por : 'mes';

  if (!(anoA >= 2000 && anoA <= 2100) || !(anoB >= 2000 && anoB <= 2100)) {
    return { erro: 'anos inválidos', detalhe: 'informe ano_a e ano_b (ex: 2025 e 2026)' };
  }

  const venId = await resolverVendedorId(db, user, input.vendedor_id);
  const params: any[] = [anoA, anoB];
  let pc = 3;
  const conds = [
    `EXTRACT(YEAR FROM p.ped_data)::int IN ($1, $2)`,
    `p.ped_situacao IN ('P','F')`,
  ];
  if (input.industria_id) { conds.push(`p.ped_industria = $${pc++}`); params.push(Number(input.industria_id)); }
  if (venId !== null)     { conds.push(`p.ped_vendedor = $${pc++}`);  params.push(venId); }

  const groupCol = agruparPor === 'industria' ? 'f.for_nomered'
                 : agruparPor === 'mes'       ? `LPAD(EXTRACT(MONTH FROM p.ped_data)::int::text, 2, '0')`
                 : `'total'`;
  // 'nenhum' agrupa só por ano (constante string não pode entrar no GROUP BY)
  const groupBy = agruparPor === 'nenhum' ? 'ano' : `${groupCol}, ano`;
  const orderBy = agruparPor === 'nenhum' ? 'ano' : 'rotulo';

  const r = await db.query(`
    SELECT
      ${groupCol}                                  AS rotulo,
      EXTRACT(YEAR FROM p.ped_data)::int           AS ano,
      COALESCE(SUM(i.ite_totliquido), 0)::float8   AS valor,
      COALESCE(SUM(i.ite_quant), 0)::float8        AS quantidade
    FROM pedidos p
    JOIN itens_ped i ON TRIM(i.ite_pedido) = TRIM(p.ped_pedido)
    LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
    WHERE ${conds.join(' AND ')}
    GROUP BY ${groupBy}
    ORDER BY ${orderBy}
  `, params);

  // Pivot: rotulo -> { a, b }
  const mapa = new Map<string, { rotulo: string; valor_a: number; valor_b: number; qtd_a: number; qtd_b: number }>();
  for (const x of r.rows) {
    const k = String(x.rotulo);
    if (!mapa.has(k)) mapa.set(k, { rotulo: k, valor_a: 0, valor_b: 0, qtd_a: 0, qtd_b: 0 });
    const e = mapa.get(k)!;
    if (x.ano === anoA) { e.valor_a = x.valor; e.qtd_a = x.quantidade; }
    else                { e.valor_b = x.valor; e.qtd_b = x.quantidade; }
  }

  const linhas = [...mapa.values()].map(e => ({
    ...e,
    variacao_pct: e.valor_a > 0 ? Number(((e.valor_b - e.valor_a) / e.valor_a * 100).toFixed(1)) : null,
  }));

  const totalA = linhas.reduce((s, x) => s + x.valor_a, 0);
  const totalB = linhas.reduce((s, x) => s + x.valor_b, 0);

  return {
    ano_a: anoA,
    ano_b: anoB,
    agrupado_por: agruparPor,
    total: {
      valor_a: totalA,
      valor_b: totalB,
      variacao_pct: totalA > 0 ? Number(((totalB - totalA) / totalA * 100).toFixed(1)) : null,
    },
    linhas: agruparPor === 'nenhum' ? null : linhas,
  };
}
