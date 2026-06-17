import { levelOf, LEVEL } from '../../../shared/roles';
import { normCod, resolverIndustria, temMovimentoMap } from './catalogo-shared';

type Acao = 'inativar' | 'reativar' | 'excluir';

export async function removerItens(db: any, input: any, user: any) {
  const acao: Acao = ['inativar', 'reativar', 'excluir'].includes(input?.acao) ? input.acao : 'inativar';
  const confirmar = input?.confirmar === true;

  if (acao === 'excluir' && confirmar && levelOf(user?.role) < LEVEL.MASTER) {
    return { erro: 'permissao_Master', mensagem: 'Excluir itens em definitivo é só pra perfil Master. Posso INATIVAR (some do catálogo, preserva o histórico) — quer assim?' };
  }

  const ind = await resolverIndustria(db, input?.industria);
  if (!ind.ok) return (ind as { ok: false; resposta: any }).resposta;
  const forId = ind.industria.for_codigo;

  const codigos: string[] = Array.isArray(input?.codigos) ? input.codigos.map((c: any) => String(c).trim()).filter(Boolean) : [];
  const padrao = input?.padrao && input.padrao.valor ? { modo: String(input.padrao.modo || 'igual'), valor: String(input.padrao.valor) } : null;
  if (codigos.length === 0 && !padrao) {
    return { precisa: 'criterio', mensagem: 'Me diga EXATAMENTE quais itens: uma lista de códigos, ou um padrão (ex.: código terminado em "000"). Não removo nada no escuro.' };
  }

  const params: any[] = [forId];
  const canon = `regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g')`;
  let filtro: string;
  if (codigos.length > 0) {
    params.push(codigos.map((c) => normCod(c)));
    filtro = `${canon} = ANY($2::text[])`;
  } else {
    const v = normCod(padrao!.valor);
    params.push(v);
    filtro = padrao!.modo === 'termina' ? `${canon} LIKE '%' || $2`
           : padrao!.modo === 'comeca'  ? `${canon} LIKE $2 || '%'`
           : padrao!.modo === 'contem'  ? `${canon} LIKE '%' || $2 || '%'`
           :                              `${canon} = $2`;
  }

  const prods = (await db.query(
    `SELECT pro_id, pro_codprod, pro_nome, pro_status FROM cad_prod
      WHERE pro_industria = $1 AND ${filtro} ORDER BY pro_codprod`, params)).rows;
  if (prods.length === 0) return { vazio: true, mensagem: `Nenhum item da ${ind.industria.for_nomered} bateu com esse critério.` };

  const mov = await temMovimentoMap(db, prods.map((p: any) => Number(p.pro_id)));
  const comMov = prods.filter((p: any) => mov.get(Number(p.pro_id)));

  if (!confirmar) {
    const lista = prods.slice(0, 30).map((p: any) => p.pro_codprod).join(', ') + (prods.length > 30 ? '…' : '');
    const verbo = acao === 'inativar' ? 'INATIVAR' : acao === 'reativar' ? 'REATIVAR' : 'EXCLUIR';
    let aviso = '';
    if (acao === 'excluir' && comMov.length)
      aviso = ` ⚠ ${comMov.length} têm pedido e NÃO serão excluídos (sugiro inativar esses): ${comMov.slice(0, 15).map((p: any) => p.pro_codprod).join(', ')}.`;
    return {
      previa: true, industria: ind.industria.for_nomered, acao,
      total: prods.length, com_movimento: comMov.length, itens: prods.map((p: any) => p.pro_codprod),
      mensagem: `Vou ${verbo} ${prods.length} item(ns) da ${ind.industria.for_nomered}: ${lista}.${aviso} Confirma?`,
    };
  }

  return db.transaction(async (client: any) => {
    if (acao === 'inativar' || acao === 'reativar') {
      const novo = acao === 'reativar';
      await client.query(`UPDATE cad_prod SET pro_status = $2 WHERE pro_id = ANY($1::int[])`, [prods.map((p: any) => Number(p.pro_id)), novo]);
      return { ok: true, acao, industria: ind.industria.for_nomered, afetados: prods.length,
        mensagem: `Pronto — ${prods.length} item(ns) ${novo ? 'reativados' : 'inativados'} na ${ind.industria.for_nomered}.` };
    }
    const semMov = prods.filter((p: any) => !mov.get(Number(p.pro_id)));
    const ids = semMov.map((p: any) => Number(p.pro_id));
    if (ids.length) {
      await client.query(`DELETE FROM cad_tabelaspre WHERE itab_idprod = ANY($1::int[])`, [ids]);
      await client.query(`DELETE FROM cad_prod WHERE pro_id = ANY($1::int[])`, [ids]);
    }
    return { ok: true, acao: 'excluir', industria: ind.industria.for_nomered,
      excluidos: ids.length, preservados_com_movimento: comMov.map((p: any) => p.pro_codprod),
      mensagem: `Excluí ${ids.length} item(ns) sem movimento.` + (comMov.length ? ` ${comMov.length} com pedido foram preservados (use inativar/mesclar).` : '') };
  });
}
