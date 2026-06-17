// Helpers compartilhados das tools de manutenção de catálogo da IRIS.
export const normCod = (s: any) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export type IndustriaResolv =
  | { ok: true; industria: { for_codigo: number; for_nomered: string; for_nome: string } }
  | { ok: false; resposta: any };

// Resolve a indústria pelo NOME REDUZIDO (mesma lógica do cadastrar-itens-tabela).
export async function resolverIndustria(db: any, termo: string): Promise<IndustriaResolv> {
  const t = String(termo || '').trim();
  if (!t) return { ok: false, resposta: { precisa: 'industria', mensagem: 'De qual indústria são esses itens?' } };
  const ind = await db.query(
    `SELECT for_codigo, for_nomered, for_nome FROM fornecedores
      WHERE for_nomered ILIKE $1 OR for_nome ILIKE $1
      ORDER BY (upper(trim(for_nomered)) = upper(trim($2))) DESC, (for_nomered ILIKE $1) DESC, for_codigo
      LIMIT 5`,
    [`%${t}%`, t]
  );
  if (ind.rows.length === 0)
    return { ok: false, resposta: { precisa: 'industria', erro: 'industria_nao_encontrada', termo: t, mensagem: `Não achei a indústria "${t}". Confere o nome reduzido?` } };
  const exata = ind.rows.find((r: any) => normCod(r.for_nomered) === normCod(t));
  if (ind.rows.length > 1 && !exata)
    return { ok: false, resposta: { precisa: 'industria', ambiguo: true, opcoes: ind.rows.map((r: any) => r.for_nomered), mensagem: `Achei mais de uma: ${ind.rows.map((r: any) => r.for_nomered).join(', ')}. Qual?` } };
  return { ok: true, industria: exata || ind.rows[0] };
}

// Para um conjunto de pro_id, devolve Map<pro_id, tem_pedido?>.
export async function temMovimentoMap(db: any, proIds: number[]): Promise<Map<number, boolean>> {
  const m = new Map<number, boolean>(proIds.map((id) => [id, false]));
  if (proIds.length === 0) return m;
  const r = await db.query(
    `SELECT DISTINCT ite_idproduto FROM itens_ped WHERE ite_idproduto = ANY($1::int[])`,
    [proIds]
  );
  for (const row of r.rows) m.set(Number(row.ite_idproduto), true);
  return m;
}
