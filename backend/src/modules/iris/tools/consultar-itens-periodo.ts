import { resolverVendedorId } from './permissions';

/**
 * consultar_itens_periodo — quantidade de PEÇAS (e valor) vendidas num período.
 *
 * REGRA DE NEGÓCIO:
 *  - join CORRETO com ite_industria (senão item multiplica por pedido homônimo)
 *  - ped_situacao IN ('P','F') — pedido 'E'/'C' nunca conta
 *  - filtros por nome (ILIKE) de cliente/indústria; escopo de vendedor pela sessão
 *  - retorna números CRUS — formatação só no artifact builder
 */
export async function consultarItensPeriodo(db: any, input: any, user: any) {
  const dataInicio = String(input.data_inicio || '').slice(0, 10);
  const dataFim    = String(input.data_fim || '').slice(0, 10);
  const agruparPor = ['mes', 'produto', 'cliente', 'industria', 'nenhum'].includes(input.agrupar_por)
    ? input.agrupar_por : 'mes';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return { erro: 'datas inválidas', detalhe: 'use formato YYYY-MM-DD' };
  }

  const venId = await resolverVendedorId(db, user, input.vendedor_id);

  const params: any[] = [dataInicio, dataFim];
  let pc = 3;
  const conds = [
    `p.ped_data BETWEEN $1::date AND $2::date`,
    `p.ped_situacao IN ('P','F')`,
  ];
  if (input.cliente && String(input.cliente).trim()) {
    conds.push(`(c.cli_nomred ILIKE $${pc} OR c.cli_nome ILIKE $${pc})`);
    params.push(`%${String(input.cliente).trim()}%`); pc++;
  }
  if (input.industria && String(input.industria).trim()) {
    conds.push(`(f.for_nomered ILIKE $${pc} OR f.for_nome ILIKE $${pc})`);
    params.push(`%${String(input.industria).trim()}%`); pc++;
  }
  // Filtro por CÓDIGO do produto (compara normalizado: ignora máscara/caixa). Responde
  // "quais clientes compraram o item X" quando combinado com agrupar_por='cliente'.
  if (input.codigo && String(input.codigo).trim()) {
    conds.push(`regexp_replace(upper(trim(i.ite_produto)),'[^A-Z0-9]','','g') = regexp_replace(upper(trim($${pc})),'[^A-Z0-9]','','g')`);
    params.push(String(input.codigo).trim()); pc++;
  }
  if (venId !== null) { conds.push(`p.ped_vendedor = $${pc++}`); params.push(venId); }

  const JOIN = `
    FROM itens_ped i
    JOIN pedidos p ON TRIM(i.ite_pedido) = TRIM(p.ped_pedido) AND i.ite_industria = p.ped_industria
    LEFT JOIN clientes c     ON c.cli_codigo = p.ped_cliente
    LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria`;

  if (agruparPor === 'nenhum') {
    const r = await db.query(`
      SELECT COALESCE(SUM(i.ite_quant),0)::float8 AS pecas,
             COALESCE(SUM(i.ite_totliquido),0)::float8 AS valor
      ${JOIN} WHERE ${conds.join(' AND ')}`, params);
    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      total: { pecas: r.rows[0].pecas, valor: r.rows[0].valor },
      grupos: null,
    };
  }

  let groupCol = '';
  switch (agruparPor) {
    case 'mes':       groupCol = `TO_CHAR(p.ped_data, 'MM/YYYY')`; break;
    case 'produto':   groupCol = `TRIM(i.ite_produto)`;            break;
    case 'cliente':   groupCol = `c.cli_nomred`;                   break;
    case 'industria': groupCol = `f.for_nomered`;                  break;
  }
  const extraSel = agruparPor === 'produto' ? `, MAX(i.ite_nomeprod) AS nome` : '';

  const r = await db.query(`
    SELECT ${groupCol} AS rotulo${extraSel},
           COALESCE(SUM(i.ite_quant),0)::float8 AS pecas,
           COALESCE(SUM(i.ite_totliquido),0)::float8 AS valor
    ${JOIN} WHERE ${conds.join(' AND ')}
    GROUP BY ${groupCol}
    ORDER BY ${agruparPor === 'mes' ? 'MIN(p.ped_data)' : 'pecas DESC'}
    LIMIT 100`, params);

  const totalPecas = r.rows.reduce((s: number, x: any) => s + x.pecas, 0);
  const totalValor = r.rows.reduce((s: number, x: any) => s + x.valor, 0);

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    agrupado_por: agruparPor,
    total: { pecas: totalPecas, valor: totalValor },
    grupos: r.rows.map((x: any) => ({
      rotulo: x.rotulo || '(sem nome)',
      nome: x.nome || undefined,
      pecas: x.pecas,
      valor: x.valor,
      pct: totalPecas > 0 ? Number((x.pecas / totalPecas * 100).toFixed(1)) : 0,
    })),
  };
}
