import { levelOf, LEVEL } from '../../../shared/roles';
import { normCod, resolverIndustria } from './catalogo-shared';

async function acharProduto(db: any, forId: number, codigo: string) {
  const r = await db.query(
    `SELECT pro_id, pro_codprod FROM cad_prod
      WHERE pro_industria = $1 AND regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g') = $2
      LIMIT 1`, [forId, normCod(codigo)]);
  return r.rows[0] || null;
}

export async function mesclarItens(db: any, input: any, user: any) {
  if (levelOf(user?.role) < LEVEL.MASTER)
    return { erro: 'permissao_Master', mensagem: 'Mesclar itens (mexe no histórico de pedidos) é só pra perfil Master.' };

  const confirmar = input?.confirmar === true;
  const ind = await resolverIndustria(db, input?.industria);
  if (!ind.ok) return (ind as { ok: false; resposta: any }).resposta;
  const forId = ind.industria.for_codigo;

  let paresIn: { de_codigo: string; para_codigo: string }[] = [];
  if (Array.isArray(input?.pares) && input.pares.length) {
    paresIn = input.pares.map((p: any) => ({ de_codigo: String(p.de_codigo ?? p.de ?? '').trim(), para_codigo: String(p.para_codigo ?? p.para ?? '').trim() }))
      .filter((p: { de_codigo: string; para_codigo: string }) => p.de_codigo && p.para_codigo);
  } else if (input?.regra?.remover_sufixo) {
    const suf = normCod(input.regra.remover_sufixo);
    const dups = (await db.query(
      `SELECT pro_codprod FROM cad_prod
        WHERE pro_industria = $1 AND regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g') LIKE '%' || $2`,
      [forId, suf])).rows;
    paresIn = dups.map((d: any) => {
      const canon = normCod(d.pro_codprod);
      return { de_codigo: d.pro_codprod, para_codigo: canon.slice(0, canon.length - suf.length) };
    }).filter((p: { de_codigo: string; para_codigo: string }) => p.para_codigo);
  }
  if (paresIn.length === 0)
    return { precisa: 'pares', mensagem: 'Me diga EXATAMENTE o que mesclar: os pares (duplicado → original) ou uma regra (ex.: remover o sufixo "000"). Não pareio no chute.' };

  const pares: any[] = [];
  const recusados: string[] = [];
  for (const p of paresIn) {
    const de = await acharProduto(db, forId, p.de_codigo);
    if (!de) { recusados.push(`${p.de_codigo} (duplicado não encontrado)`); continue; }
    const para = await acharProduto(db, forId, p.para_codigo);
    if (!para) { recusados.push(`${p.de_codigo} → ${p.para_codigo} (original não existe — isso é renomear, use editar_item)`); continue; }
    if (Number(de.pro_id) === Number(para.pro_id)) { recusados.push(`${p.de_codigo} (mesmo item)`); continue; }
    const cnt = Number((await db.query(`SELECT COUNT(*)::int n FROM itens_ped WHERE ite_idproduto = $1`, [de.pro_id])).rows[0].n);
    pares.push({ de: de.pro_codprod, para: para.pro_codprod, de_id: Number(de.pro_id), para_id: Number(para.pro_id), para_cod: para.pro_codprod, pedidos: cnt });
  }
  if (pares.length === 0)
    return { erro: 'sem_pares_validos', recusados, mensagem: `Nenhum par válido pra mesclar. ${recusados.join('; ')}.` };

  if (!confirmar) {
    const totalPed = pares.reduce((s, x) => s + x.pedidos, 0);
    return {
      previa: true, industria: ind.industria.for_nomered, pares, recusados,
      mensagem: `Vou mesclar ${pares.length} duplicado(s) na ${ind.industria.for_nomered}, re-apontando ${totalPed} pedido(s) e removendo os duplicados: ` +
        pares.slice(0, 15).map((x) => `${x.de}→${x.para}`).join(', ') +
        (recusados.length ? ` (recusados: ${recusados.length}).` : '.') + ` Confirma?`,
    };
  }

  return db.transaction(async (client: any) => {
    let pedidosMig = 0;
    for (const x of pares) {
      const up = await client.query(
        `UPDATE itens_ped SET ite_idproduto = $1, ite_produto = $2 WHERE ite_idproduto = $3`,
        [x.para_id, x.para_cod, x.de_id]);
      pedidosMig += up.rowCount ?? 0;
      await client.query(`DELETE FROM cad_tabelaspre WHERE itab_idprod = $1`, [x.de_id]);
      await client.query(`DELETE FROM cad_prod WHERE pro_id = $1`, [x.de_id]);
    }
    return { ok: true, industria: ind.industria.for_nomered, mesclados: pares.length, pedidos_reapontados: pedidosMig, recusados,
      mensagem: `Pronto — ${pares.length} duplicado(s) mesclado(s), ${pedidosMig} pedido(s) re-apontados na ${ind.industria.for_nomered}.` };
  });
}
