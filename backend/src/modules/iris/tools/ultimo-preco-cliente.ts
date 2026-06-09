/**
 * ultimo_preco_cliente — último preço que um cliente pagou num produto + histórico.
 *  - resolve o cliente pelo nome (reduzido ou completo); produto pelo código.
 *  - retorna as últimas 10 compras (P/F), bruto e líquido. Números crus.
 *  - ponto de lookup (igual ao histórico de preço do pedido); não escopa por vendedor.
 */
export async function ultimoPrecoCliente(db: any, input: any, _user: any) {
  const produto      = String(input.produto || '').trim();
  const clienteNome  = String(input.cliente || '').trim();

  if (!produto || !clienteNome) {
    return { erro: 'informe o cliente e o produto (código)' };
  }

  const cli = await db.query(
    `SELECT cli_codigo, cli_nomred, cli_nome
       FROM clientes
      WHERE cli_nomred ILIKE $1 OR cli_nome ILIKE $1
      ORDER BY cli_codigo
      LIMIT 1`,
    [`%${clienteNome}%`]
  );
  if (!cli.rows.length) {
    return { erro: 'cliente não encontrado', termo: clienteNome };
  }
  const cliId = cli.rows[0].cli_codigo;
  const cliNome = cli.rows[0].cli_nomred || cli.rows[0].cli_nome;

  const r = await db.query(
    `SELECT
        p.ped_data::text                 AS data,
        TRIM(p.ped_pedido)               AS pedido,
        i.ite_quant::float8              AS quantidade,
        i.ite_puni::float8               AS preco_bruto,
        i.ite_puniliq::float8            AS preco_liquido,
        f.for_nomered                    AS industria
       FROM itens_ped i
       JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
       LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
      WHERE TRIM(i.ite_produto) = TRIM($1)
        AND p.ped_cliente = $2
        AND p.ped_situacao IN ('P','F')
      ORDER BY p.ped_data DESC, p.ped_pedido DESC
      LIMIT 10`,
    [produto, cliId]
  );

  if (!r.rows.length) {
    return { cliente: cliNome, produto, historico: [], aviso: 'esse cliente não tem compras registradas desse produto' };
  }

  return {
    cliente: cliNome,
    produto,
    ultimo: r.rows[0],
    historico: r.rows,
  };
}
