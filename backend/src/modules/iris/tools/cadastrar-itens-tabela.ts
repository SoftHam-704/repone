// ── Tool de ESCRITA da IRIS ──────────────────────────────────────────────────
// Cadastra a relação de itens avulsos que o REP passar na(s) tabela(s) de preço
// de UMA indústria (→ cad_prod + cad_tabelaspre). Reusa fn_upsert_produto +
// fn_upsert_preco (canônicos: trigger/normalização ok). Multi-tenant: db é o
// schema do REP.
//
// SEGURANÇA (1º poder de escrita da IRIS):
//  - 2 fases: confirmar=false → PRÉVIA (não grava) · confirmar=true → grava (transação).
//  - Indústria OBRIGATÓRIA (resolve por nome reduzido). Sem indústria → pede.
//  - Cadastra em TODAS as tabelas da indústria.
//  - Mínimo: código + preço. descrição/IPI/ST se vierem; senão "fazemos nossa parte".

function parsePrecoBR(v: any): number {
  if (v == null) return NaN;
  let s = String(v).trim();
  if (s === '') return NaN;
  // "1.234,56" → milhar ponto, decimal vírgula | "45,90" → vírgula decimal | "45.90" → ponto decimal
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s.replace(/[^0-9.\-]/g, ''));
}

const normCod = (s: string) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function cadastrarItensTabela(db: any, input: any, _user: any) {
  const industriaTermo = String(input.industria || '').trim();
  const confirmar = input.confirmar === true;
  const itensRaw = Array.isArray(input.itens) ? input.itens : [];

  // 1) Indústria é OBRIGATÓRIA — sem ela, a IRIS deve pedir (nunca cadastra no escuro).
  if (!industriaTermo) {
    return { precisa: 'industria', mensagem: 'De qual indústria são esses itens? Preciso saber pra cadastrar no lugar certo.' };
  }

  // 2) Normaliza os itens (mínimo: código + preço).
  const itens = itensRaw
    .map((it: any) => ({
      codigo:    String(it.codigo ?? it.cod ?? it.code ?? '').trim(),
      descricao: it.descricao ? String(it.descricao).trim() : (it.nome ? String(it.nome).trim() : null),
      preco:     parsePrecoBR(it.preco ?? it.preço ?? it.valor ?? it.price),
      ipi:       it.ipi != null && String(it.ipi) !== '' ? parsePrecoBR(it.ipi) : null,
      st:        it.st  != null && String(it.st)  !== '' ? parsePrecoBR(it.st)  : null,
    }))
    .filter((it: any) => it.codigo);
  if (itens.length === 0) return { erro: 'Nenhum item válido — cada item precisa de pelo menos o código.' };

  // 3) Resolve a indústria pelo NOME REDUZIDO (ou nome).
  const ind = await db.query(
    `SELECT for_codigo, for_nomered, for_nome FROM fornecedores
      WHERE for_nomered ILIKE $1 OR for_nome ILIKE $1
      ORDER BY (upper(trim(for_nomered)) = upper(trim($2))) DESC, (for_nomered ILIKE $1) DESC, for_codigo
      LIMIT 5`,
    [`%${industriaTermo}%`, industriaTermo]
  );
  if (ind.rows.length === 0) {
    return { precisa: 'industria', erro: 'industria_nao_encontrada', termo: industriaTermo,
             mensagem: `Não achei a indústria "${industriaTermo}". Confere o nome reduzido?` };
  }
  const exata = ind.rows.find((r: any) => normCod(r.for_nomered) === normCod(industriaTermo));
  if (ind.rows.length > 1 && !exata) {
    return { precisa: 'industria', ambiguo: true, opcoes: ind.rows.map((r: any) => r.for_nomered),
             mensagem: `Achei mais de uma indústria parecida: ${ind.rows.map((r: any) => r.for_nomered).join(', ')}. Qual delas?` };
  }
  const industria = exata || ind.rows[0];

  // 4) Todas as tabelas de preço da indústria.
  const tabRes = await db.query(
    `SELECT DISTINCT itab_tabela FROM cad_tabelaspre
      WHERE itab_idindustria = $1 AND itab_tabela IS NOT NULL AND TRIM(itab_tabela) <> ''
      ORDER BY itab_tabela`,
    [industria.for_codigo]
  );
  const tabelas: string[] = tabRes.rows.map((r: any) => r.itab_tabela);
  if (tabelas.length === 0) {
    return { precisa: 'tabela', industria: industria.for_nomered,
             mensagem: `A ${industria.for_nomered} ainda não tem nenhuma tabela de preço cadastrada. Crie a tabela primeiro (ou me diga o nome da tabela a criar) que eu cadastro os itens nela.` };
  }

  // 5) Quais já existem (novos × atualização) — pelo código normalizado.
  const exist = await db.query(
    `SELECT regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g') AS canon, pro_id, pro_nome
       FROM cad_prod WHERE pro_industria = $1`,
    [industria.for_codigo]
  );
  const existMap = new Map<string, { id: number; nome: string }>(
    exist.rows.map((r: any) => [r.canon, { id: r.pro_id, nome: r.pro_nome }])
  );

  let novos = 0, atualiza = 0;
  const semDescricao: string[] = [];
  const semPreco: string[] = [];
  for (const it of itens) {
    if (!(it.preco > 0)) semPreco.push(it.codigo);
    const ex = existMap.get(normCod(it.codigo));
    if (ex) atualiza++;
    else { novos++; if (!it.descricao) semDescricao.push(it.codigo); }
  }

  // ── PRÉVIA (não grava) ──────────────────────────────────────────────────────
  if (!confirmar) {
    return {
      previa: true,
      industria: industria.for_nomered,
      tabelas,
      total: itens.length,
      novos,
      atualiza,
      novos_sem_descricao: semDescricao,
      sem_preco: semPreco,
      mensagem:
        `Vou cadastrar ${itens.length} ${itens.length === 1 ? 'item' : 'itens'} na **${industria.for_nomered}**, ` +
        `em ${tabelas.length} ${tabelas.length === 1 ? 'tabela' : 'tabelas'} (${tabelas.join(', ')}). ` +
        `${novos} ${novos === 1 ? 'novo' : 'novos'}, ${atualiza} ${atualiza === 1 ? 'atualiza' : 'atualizam'} o preço.` +
        (semDescricao.length ? ` ${semDescricao.length} novo(s) sem descrição (uso o código como nome até você completar).` : '') +
        (semPreco.length ? ` ⚠ ${semPreco.length} sem preço — esses NÃO serão cadastrados.` : '') +
        ` Confirma?`,
    };
  }

  // ── GRAVAÇÃO (transação atômica) ────────────────────────────────────────────
  const out = await db.transaction(async (client: any) => {
    let cad = 0;
    const pulados: string[] = [];
    for (const it of itens) {
      if (!(it.preco > 0)) { pulados.push(it.codigo); continue; } // mínimo é código + preço
      const ex = existMap.get(normCod(it.codigo));
      // nome: descrição dada > (existe → '' mantém o nome atual) > código (produto novo)
      const nome = it.descricao ? it.descricao : (ex ? '' : it.codigo);
      const up = await client.query(
        `SELECT fn_upsert_produto($1, $2, $3) AS pro_id`,
        [industria.for_codigo, it.codigo, nome]
      );
      const proId = up.rows[0].pro_id;
      for (const tab of tabelas) {
        await client.query(
          `SELECT fn_upsert_preco($1, $2, $3, $4, 0, 0, $5, $6, NULL, 0, CURRENT_DATE, NULL, 0)`,
          [proId, industria.for_codigo, tab, it.preco, it.ipi ?? 0, it.st ?? 0]
        );
      }
      cad++;
    }
    return { cad, pulados };
  });

  return {
    cadastrado: true,
    industria: industria.for_nomered,
    itens_cadastrados: out.cad,
    tabelas,
    pulados_sem_preco: out.pulados,
    mensagem:
      `Pronto! ${out.cad} ${out.cad === 1 ? 'item cadastrado' : 'itens cadastrados'} na **${industria.for_nomered}**, ` +
      `em ${tabelas.length} ${tabelas.length === 1 ? 'tabela' : 'tabelas'} (${tabelas.join(', ')}).` +
      (out.pulados.length ? ` ${out.pulados.length} pulado(s) por falta de preço: ${out.pulados.join(', ')}.` : ''),
  };
}
