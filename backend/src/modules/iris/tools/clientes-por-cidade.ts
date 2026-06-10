import { resolverVendedorId } from './permissions';
import { excluiInativoSQL } from '../../../shared/utils/cliente-ativo';

/**
 * clientes_por_cidade — lista os clientes da carteira numa cidade (ou UF).
 *
 * Responde "quais são nossos clientes de SETE LAGOAS?". Casa por cidade (nome da
 * tabela global OU o texto livre cli_cidade) e opcionalmente UF. Escopo do REP
 * pela sessão (cli_vendedor = titular da carteira). Exclui inativos/filiais.
 */
export async function clientesPorCidade(db: any, input: any, user: any) {
  const cidade = String(input.cidade || '').trim();
  const uf     = String(input.uf || '').trim().toUpperCase();
  const limite = Math.max(1, Math.min(500, Number(input.limite) || 200));

  if (!cidade && !uf) {
    return { erro: 'sem_cidade', detalhe: 'De qual cidade (ou ao menos a UF) você quer a lista de clientes?' };
  }

  const venId = await resolverVendedorId(db, user, input.vendedor_id);

  const params: any[] = [];
  let pc = 1;
  const conds = [excluiInativoSQL('c')];

  if (cidade) {
    conds.push(`(cid.cid_nome ILIKE $${pc} OR c.cli_cidade ILIKE $${pc})`);
    params.push(`%${cidade}%`); pc++;
  }
  if (uf) {
    conds.push(`(upper(cid.cid_uf) = $${pc} OR upper(c.cli_uf) = $${pc})`);
    params.push(uf); pc++;
  }
  if (venId !== null) { conds.push(`c.cli_vendedor = $${pc++}`); params.push(venId); }

  const r = await db.query(`
    SELECT
      c.cli_codigo                         AS cliente_id,
      COALESCE(c.cli_nomred, c.cli_nome)   AS cliente,
      COALESCE(cid.cid_nome, c.cli_cidade) AS cidade,
      COALESCE(cid.cid_uf, c.cli_uf)       AS uf,
      c.cli_fone1                          AS fone
    FROM clientes c
    LEFT JOIN public.cidades cid ON cid.cid_codigo = c.cli_idcidade
    WHERE ${conds.join(' AND ')}
    ORDER BY cliente
    LIMIT ${limite}
  `, params);

  return {
    filtro: { cidade: cidade || null, uf: uf || null },
    total: r.rows.length,
    clientes: r.rows.map((x: any) => ({
      cliente_id: x.cliente_id,
      cliente: x.cliente,
      cidade: x.cidade || '',
      uf: x.uf || '',
      fone: x.fone || '',
    })),
  };
}
