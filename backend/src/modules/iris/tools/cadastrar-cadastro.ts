// ── Tool de ESCRITA da IRIS: cadastrar CLIENTE ou INDÚSTRIA a partir do CNPJ ─────
// Fluxo (mesmo padrão seguro do cadastrar_itens_tabela):
//   1. tipo OBRIGATÓRIO (cliente | industria) — sem ele, pergunta.
//   2. CNPJ OBRIGATÓRIO — sem ele, pede. Consulta a Receita (BrasilAPI).
//   3. Dedup por CNPJ (não duplica cliente/indústria já ativo).
//   4. Nome reduzido OBRIGATÓRIO — IRIS mostra os dados achados e pede.
//   5. confirmar=false → PRÉVIA (não grava) · confirmar=true → grava.
// Cliente → tabela `clientes` (cli_*); Indústria → `fornecedores` (for_*).
// código auto-gerado; cidade (cli_idcidade) resolvida best-effort por nome+UF.
import { consultarCnpj, formatCnpj } from '../../../shared/utils/cnpj-lookup';

const onlyDigits = (s: any) => String(s ?? '').replace(/\D/g, '');

function normalizeTipo(raw: any): 'cliente' | 'industria' | '' {
  const t = String(raw || '').toLowerCase().trim();
  if (['cliente', 'clientes', 'loja', 'lojista', 'comprador'].includes(t)) return 'cliente';
  if (['industria', 'indústria', 'industrias', 'fornecedor', 'fornecedora', 'representada', 'fabrica', 'fábrica'].includes(t)) return 'industria';
  return '';
}

export async function cadastrarCadastro(db: any, input: any, _user: any) {
  const tipo = normalizeTipo(input.tipo);
  const cnpj = onlyDigits(input.cnpj);
  const nomeReduzido = String(input.nome_reduzido || '').trim();
  const confirmar = input.confirmar === true;

  // 1) tipo obrigatório
  if (!tipo) {
    return { precisa: 'tipo', mensagem: 'Vou cadastrar um CLIENTE ou uma INDÚSTRIA? Me diz qual dos dois.' };
  }
  const ehCliente = tipo === 'cliente';
  const label = ehCliente ? 'cliente' : 'indústria';

  // 2) CNPJ obrigatório
  if (cnpj.length !== 14) {
    return { precisa: 'cnpj', tipo, mensagem: `Me passa o CNPJ (14 dígitos) ${ehCliente ? 'do cliente' : 'da indústria'} que eu já busco os dados na Receita.` };
  }

  // 3) consulta CNPJ na Receita (BrasilAPI)
  const consulta = await consultarCnpj(cnpj);
  if (!consulta.ok || !consulta.data) return { erro: consulta.erro || 'Não consegui consultar o CNPJ.', cnpj };
  const d = consulta.data;
  const avisoSituacao = d.situacao && d.situacao !== 'ATIVA'
    ? ` ⚠ Atenção: a situação cadastral na Receita está "${d.situacao}" (não ATIVA).`
    : '';

  // 4) dedup por CNPJ (compara só dígitos, independe de máscara)
  const dupQ = ehCliente
    ? `SELECT cli_codigo AS cod, cli_nomred AS nomered FROM clientes
        WHERE regexp_replace(COALESCE(cli_cnpj,''),'[^0-9]','','g') = $1 AND cli_tipopes = 'A' LIMIT 1`
    : `SELECT for_codigo AS cod, for_nomered AS nomered FROM fornecedores
        WHERE regexp_replace(COALESCE(for_cgc,''),'[^0-9]','','g') = $1 AND for_tipo2 = 'A' LIMIT 1`;
  const dup = await db.query(dupQ, [cnpj]);
  if (dup.rows.length > 0) {
    return {
      ja_existe: true, tipo, codigo: dup.rows[0].cod, nome: dup.rows[0].nomered,
      mensagem: `Esse CNPJ já está cadastrado como ${label} — código ${dup.rows[0].cod} (${dup.rows[0].nomered}). Não vou duplicar.`,
    };
  }

  // 5) nome reduzido obrigatório — mostra o que achou e pede
  if (!nomeReduzido) {
    const fant = d.nome_fantasia && d.nome_fantasia !== d.razao_social ? ` (${d.nome_fantasia})` : '';
    return {
      precisa: 'nome_reduzido', tipo, cnpj,
      dados: { razao: d.razao_social, fantasia: d.nome_fantasia, municipio: d.municipio, uf: d.uf, situacao: d.situacao },
      mensagem: `Achei na Receita: **${d.razao_social}**${fant} — ${d.municipio}/${d.uf}.${avisoSituacao} Qual o **nome reduzido** que você quer usar pra essa ${label}?`,
    };
  }

  // 6) PRÉVIA (não grava)
  if (!confirmar) {
    return {
      previa: true, tipo, cnpj,
      resumo: {
        nome_reduzido: nomeReduzido, razao: d.razao_social, fantasia: d.nome_fantasia,
        endereco: [d.logradouro, d.numero].filter(Boolean).join(', '), bairro: d.bairro, cep: d.cep,
        municipio: d.municipio, uf: d.uf, telefone: d.telefone, email: d.email, situacao: d.situacao,
      },
      mensagem:
        `Vou cadastrar a ${label}:\n` +
        `• Nome reduzido: **${nomeReduzido}**\n` +
        `• Razão social: ${d.razao_social}\n` +
        `• Cidade: ${d.municipio}/${d.uf}` +
        (d.telefone ? ` · Fone: ${d.telefone}` : '') +
        (d.email ? ` · E-mail: ${d.email}` : '') +
        `${avisoSituacao}\nConfirma?`,
    };
  }

  // 7) GRAVA
  // resolve cidade (cli_idcidade) best-effort pelo nome + UF na tabela global
  let idCidade: number | null = null;
  if (d.municipio && d.uf) {
    try {
      const c = await db.query(
        `SELECT cid_codigo FROM public.cidades WHERE upper(cid_nome) = upper($1) AND upper(cid_uf) = upper($2) LIMIT 1`,
        [d.municipio, d.uf],
      );
      if (c.rows.length) idCidade = c.rows[0].cid_codigo;
    } catch { /* cidade não resolvida — segue com nome/UF em texto */ }
  }
  const cnpjFmt = formatCnpj(cnpj);

  if (ehCliente) {
    const r = await db.query(`
      INSERT INTO clientes (
        cli_nome, cli_fantasia, cli_nomred, cli_cnpj,
        cli_endereco, cli_endnum, cli_bairro, cli_cep,
        cli_idcidade, cli_cidade, cli_uf, cli_fone1, cli_email,
        cli_tipopes, cli_datacad
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'A',NOW())
      RETURNING cli_codigo
    `, [
      d.razao_social, d.nome_fantasia, nomeReduzido, cnpjFmt,
      d.logradouro || null, d.numero || null, d.bairro || null, d.cep || null,
      idCidade, d.municipio || null, d.uf || null, d.telefone || null, d.email || null,
    ]);
    return {
      cadastrado: true, tipo, codigo: r.rows[0].cli_codigo, nome_reduzido: nomeReduzido,
      mensagem: `Pronto! Cliente **${nomeReduzido}** cadastrado — código ${r.rows[0].cli_codigo} (${d.razao_social}, ${d.municipio}/${d.uf}).`,
    };
  }

  const r = await db.query(`
    INSERT INTO fornecedores (
      for_nome, for_nomered, for_cgc,
      for_fone, for_email, for_endereco, for_bairro,
      for_cidade, for_uf, for_cep, for_tipo2
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'A')
    RETURNING for_codigo
  `, [
    d.razao_social, nomeReduzido, cnpjFmt,
    d.telefone || null, d.email || null, d.logradouro || null, d.bairro || null,
    d.municipio || null, d.uf || null, d.cep || null,
  ]);
  return {
    cadastrado: true, tipo, codigo: r.rows[0].for_codigo, nome_reduzido: nomeReduzido,
    mensagem: `Pronto! Indústria **${nomeReduzido}** cadastrada — código ${r.rows[0].for_codigo} (${d.razao_social}, ${d.municipio}/${d.uf}).`,
  };
}
