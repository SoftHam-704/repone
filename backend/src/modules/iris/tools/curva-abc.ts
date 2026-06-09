import { resolverVendedorId } from './permissions';

/**
 * curva_abc — classificação de Pareto (A/B/C) por faturamento num período.
 *  - dimensao: 'cliente' (default) ou 'produto'
 *  - A = até 80% acumulado · B = 80–95% · C = o resto
 *  - ped_situacao IN ('P','F'); valores crus. Escopo de vendedor pela sessão.
 */
export async function curvaAbc(db: any, input: any, user: any) {
  const dataInicio = String(input.data_inicio || '').slice(0, 10);
  const dataFim    = String(input.data_fim || '').slice(0, 10);
  const dimensao   = ['cliente', 'produto'].includes(input.dimensao) ? input.dimensao : 'cliente';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return { erro: 'datas inválidas', detalhe: 'use formato YYYY-MM-DD' };
  }

  const venId = await resolverVendedorId(db, user, input.vendedor_id);
  const params: any[] = [dataInicio, dataFim];
  let pc = 3;
  const conds = [`p.ped_data BETWEEN $1::date AND $2::date`, `p.ped_situacao IN ('P','F')`];
  if (input.industria_id) { conds.push(`p.ped_industria = $${pc++}`); params.push(Number(input.industria_id)); }
  if (venId !== null)     { conds.push(`p.ped_vendedor = $${pc++}`);  params.push(venId); }

  const groupCol = dimensao === 'produto' ? `COALESCE(NULLIF(TRIM(i.ite_produto), ''), '(sem código)')` : `c.cli_nomred`;

  const r = await db.query(`
    SELECT ${groupCol} AS rotulo, COALESCE(SUM(i.ite_totliquido), 0)::float8 AS valor
    FROM pedidos p
    JOIN itens_ped i ON TRIM(i.ite_pedido) = TRIM(p.ped_pedido)
    LEFT JOIN clientes c ON c.cli_codigo = p.ped_cliente
    WHERE ${conds.join(' AND ')}
    GROUP BY ${groupCol}
    HAVING SUM(i.ite_totliquido) > 0
    ORDER BY valor DESC
  `, params);

  const total = r.rows.reduce((s: number, x: any) => s + x.valor, 0);
  let acc = 0;
  const itens = r.rows.map((x: any) => {
    acc += x.valor;
    const pctAcc = total > 0 ? (acc / total) * 100 : 0;
    const curva = pctAcc <= 80 ? 'A' : pctAcc <= 95 ? 'B' : 'C';
    return {
      rotulo: x.rotulo || '(sem nome)',
      valor: x.valor,
      pct: total > 0 ? Number((x.valor / total * 100).toFixed(1)) : 0,
      pct_acumulado: Number(pctAcc.toFixed(1)),
      curva,
    };
  });

  const resumo: any = { A: { qtd: 0, valor: 0 }, B: { qtd: 0, valor: 0 }, C: { qtd: 0, valor: 0 } };
  for (const it of itens) { resumo[it.curva].qtd++; resumo[it.curva].valor += it.valor; }

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    dimensao,
    total,
    resumo,
    itens: itens.slice(0, 100),
  };
}
