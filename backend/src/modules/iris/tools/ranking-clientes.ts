import { resolverVendedorId } from './permissions';

/**
 * ranking_clientes — top N clientes por faturamento ou quantidade num período.
 *  - por: 'valor' (default) ou 'quantidade'
 *  - ped_situacao IN ('P','F'); valores crus. Escopo de vendedor pela sessão.
 */
export async function rankingClientes(db: any, input: any, user: any) {
  const dataInicio = String(input.data_inicio || '').slice(0, 10);
  const dataFim    = String(input.data_fim || '').slice(0, 10);
  const por        = ['valor', 'quantidade'].includes(input.por) ? input.por : 'valor';
  const limite     = Math.min(Math.max(Number(input.limite) || 20, 1), 100);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return { erro: 'datas inválidas', detalhe: 'use formato YYYY-MM-DD' };
  }

  const venId = await resolverVendedorId(db, user, input.vendedor_id);
  const params: any[] = [dataInicio, dataFim];
  let pc = 3;
  const conds = [`p.ped_data BETWEEN $1::date AND $2::date`, `p.ped_situacao IN ('P','F')`];
  if (input.industria_id) { conds.push(`p.ped_industria = $${pc++}`); params.push(Number(input.industria_id)); }
  if (venId !== null)     { conds.push(`p.ped_vendedor = $${pc++}`);  params.push(venId); }

  const orderCol = por === 'quantidade' ? 'quantidade' : 'valor';
  params.push(limite);

  const r = await db.query(`
    SELECT
      c.cli_nomred                                 AS rotulo,
      COALESCE(SUM(i.ite_totliquido), 0)::float8   AS valor,
      COALESCE(SUM(i.ite_quant), 0)::float8        AS quantidade,
      COUNT(DISTINCT p.ped_pedido)::int            AS pedidos,
      MAX(p.ped_data)::text                        AS ultima_compra
    FROM pedidos p
    JOIN itens_ped i ON TRIM(i.ite_pedido) = TRIM(p.ped_pedido)
    LEFT JOIN clientes c ON c.cli_codigo = p.ped_cliente
    WHERE ${conds.join(' AND ')}
    GROUP BY c.cli_nomred
    ORDER BY ${orderCol} DESC
    LIMIT $${pc}
  `, params);

  const totalValor = r.rows.reduce((s: number, x: any) => s + x.valor, 0);

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    por,
    clientes: r.rows.map((x: any, i: number) => ({
      posicao: i + 1,
      rotulo: x.rotulo || '(sem nome)',
      valor: x.valor,
      quantidade: x.quantidade,
      pedidos: x.pedidos,
      ultima_compra: x.ultima_compra,
      pct: totalValor > 0 ? Number((x.valor / totalValor * 100).toFixed(1)) : 0,
    })),
  };
}
