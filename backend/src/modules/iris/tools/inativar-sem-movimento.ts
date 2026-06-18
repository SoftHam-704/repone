import { levelOf, LEVEL } from '../../../shared/roles';

// ESCRITA — inativa clientes/indústrias sem pedido (P/F) há mais de N anos.
// Critério: data do último pedido. Cliente nunca-comprou cai pela data de cadastro
// (cli_datacad); indústria nunca-vendeu entra direto (fornecedores não têm data de
// cadastro). Reversível (flip do flag A/I). Prévia→confirma, igual remover_itens.

type Alvo = 'clientes' | 'industrias';

export async function inativarSemMovimento(db: any, input: any, user: any) {
  const alvo: Alvo | null =
    input?.alvo === 'industrias' ? 'industrias' : input?.alvo === 'clientes' ? 'clientes' : null;
  if (!alvo) return { precisa: 'alvo', mensagem: 'Inativar o quê — clientes ou indústrias? Me diz o alvo.' };

  const anos = Number(input?.anos);
  if (!Number.isFinite(anos) || anos <= 0) {
    return { precisa: 'anos', mensagem: 'Há quantos anos sem pedido? Me diz o tempo de inatividade (ex.: 2, 3). Sem isso eu não inativo nada.' };
  }

  const confirmar = input?.confirmar === true;
  if (confirmar && levelOf(user?.role) < LEVEL.GERENCIA) {
    return { erro: 'permissao', mensagem: 'Inativar em massa é pra perfil Gerência ou Master. Posso te mostrar a prévia, mas a gravação precisa desse nível.' };
  }

  const rows = alvo === 'clientes'
    ? (await db.query(`
        WITH ult AS (
          SELECT ped_cliente, MAX(ped_data) AS ultima
          FROM pedidos WHERE ped_situacao IN ('P','F')
          GROUP BY ped_cliente
        )
        SELECT c.cli_codigo AS id,
               COALESCE(NULLIF(TRIM(c.cli_nomred), ''), c.cli_nome) AS nome,
               u.ultima, (u.ultima IS NULL) AS nunca
        FROM clientes c
        LEFT JOIN ult u ON u.ped_cliente = c.cli_codigo
        WHERE c.cli_tipopes = 'A'
          AND (c.cli_atuacao IS DISTINCT FROM 'FILIAL' AND COALESCE(c.cli_ignora_estat, false) = false)
          AND COALESCE(u.ultima, c.cli_datacad) < (CURRENT_DATE - make_interval(years => $1::int))
        ORDER BY nome
      `, [anos])).rows
    : (await db.query(`
        WITH ult AS (
          SELECT ped_industria, MAX(ped_data) AS ultima
          FROM pedidos WHERE ped_situacao IN ('P','F')
          GROUP BY ped_industria
        )
        SELECT f.for_codigo AS id,
               COALESCE(NULLIF(TRIM(f.for_nomered), ''), f.for_nome) AS nome,
               u.ultima, (u.ultima IS NULL) AS nunca
        FROM fornecedores f
        LEFT JOIN ult u ON u.ped_industria = f.for_codigo
        WHERE f.for_tipo2 = 'A'
          AND (u.ultima IS NULL OR u.ultima < (CURRENT_DATE - make_interval(years => $1::int)))
        ORDER BY nome
      `, [anos])).rows;

  const subst = alvo === 'clientes' ? 'cliente' : 'indústria';
  const plural = alvo === 'clientes' ? 'cliente(s)' : 'indústria(s)';
  if (rows.length === 0) {
    return { vazio: true, alvo, anos, mensagem: `Nenhum(a) ${subst} sem pedido há mais de ${anos} ano(s). Limpo nesse critério.` };
  }

  const nunca = rows.filter((r: any) => r.nunca).length;
  const pararam = rows.length - nunca;

  if (!confirmar) {
    const amostra = rows.slice(0, 20).map((r: any) => r.nome).join(', ') + (rows.length > 20 ? '…' : '');
    return {
      previa: true, alvo, anos,
      total: rows.length, nunca_movimentaram: nunca, movimentaram_e_pararam: pararam,
      nomes: rows.map((r: any) => r.nome),
      mensagem: `Achei ${rows.length} ${plural} sem pedido há mais de ${anos} ano(s) — ${pararam} que já compraram e pararam, ${nunca} que nunca tiveram pedido: ${amostra}. Confirma que inativo todos? (somem dos filtros; é reversível pelo cadastro.)`,
    };
  }

  const ids = rows.map((r: any) => Number(r.id));
  return db.transaction(async (client: any) => {
    if (alvo === 'clientes')
      await client.query(`UPDATE clientes SET cli_tipopes = 'I' WHERE cli_codigo = ANY($1::int[])`, [ids]);
    else
      await client.query(`UPDATE fornecedores SET for_tipo2 = 'I' WHERE for_codigo = ANY($1::int[])`, [ids]);
    return {
      ok: true, alvo, anos, inativados: ids.length,
      mensagem: `Pronto — ${ids.length} ${plural} inativado(s) (sem pedido há mais de ${anos} ano(s)). Somem dos filtros; pra reativar, é só pelo cadastro.`,
    };
  });
}
