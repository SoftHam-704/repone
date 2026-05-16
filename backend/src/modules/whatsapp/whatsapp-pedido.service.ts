import { Pool } from 'pg';
import { callAI } from '../../shared/utils/ai_providers';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface DeteccaoPedido {
  eh_pedido: boolean;
  itens: Array<{
    codigo_enviado: string;
    quantidade:     number;
  }>;
}

interface ItemResolvido {
  pro_id:         number;
  pro_codprod:    string;
  pro_nome:       string;
  pro_industria:  number;
  quantidade:     number;
  preco_unitario: number;
}

interface ItemNaoResolvido {
  codigo_enviado: string;
  quantidade:     number;
}

export interface ResolucaoItens {
  resolvidos:     ItemResolvido[];
  nao_resolvidos: ItemNaoResolvido[];
}

// ─── Normalização de código ───────────────────────────────────────────────────
function normalizar(codigo: string): string {
  return codigo.replace(/[\s\-\.\/]/g, '').toUpperCase();
}

// ─── detectarIntencaoPedido ───────────────────────────────────────────────────
export async function detectarIntencaoPedido(conteudo: string): Promise<DeteccaoPedido> {
  const system = `Você detecta pedidos de produtos em mensagens de lojistas.
Retorne JSON com { "eh_pedido": boolean, "itens": [{ "codigo_enviado": string, "quantidade": number }] }.
Regras:
- eh_pedido = true apenas quando a mensagem pede produtos (lista de códigos, "manda X", "quero Y unidades", etc.)
- codigo_enviado = exatamente como o lojista escreveu (preserve traços e letras)
- quantidade = número informado ou 1 se não informado
- Não é pedido: saudações, perguntas sobre prazo/preço/estoque, reclamações, agradecimentos`;

  try {
    const raw = await callAI(
      [
        { role: 'system', content: system },
        { role: 'user',   content: conteudo },
      ],
      { responseFormat: 'json_object', temperature: 0, maxTokens: 600 }
    );
    const parsed = JSON.parse(raw) as DeteccaoPedido;
    return {
      eh_pedido: Boolean(parsed.eh_pedido),
      itens: Array.isArray(parsed.itens) ? parsed.itens.map(i => ({
        codigo_enviado: String(i.codigo_enviado || '').trim(),
        quantidade:     Number(i.quantidade) > 0 ? Number(i.quantidade) : 1,
      })).filter(i => i.codigo_enviado.length > 0) : [],
    };
  } catch {
    return { eh_pedido: false, itens: [] };
  }
}

// ─── resolverItensPedido ──────────────────────────────────────────────────────
export async function resolverItensPedido(
  db: Pool,
  itens: Array<{ codigo_enviado: string; quantidade: number }>,
  cliCodigo: number
): Promise<ResolucaoItens> {
  const resolvidos: ItemResolvido[] = [];
  const nao_resolvidos: ItemNaoResolvido[] = [];

  for (const item of itens) {
    const { codigo_enviado, quantidade } = item;
    const norm = normalizar(codigo_enviado);

    // Tenta todas as estratégias em ordem de prioridade:
    // 1. pro_codprod exato  2. normalizado  3. pro_conversao (concorrente) raw  4. normalizado
    // 5. pro_codigooriginal  6. nome ILIKE
    const r = await db.query<{
      pro_id: number; pro_codprod: string; pro_nome: string; pro_industria: number;
    }>(
      `SELECT pro_id, pro_codprod, pro_nome, pro_industria
       FROM cad_prod
       WHERE pro_status IS NOT FALSE
         AND (
               TRIM(pro_codprod)            = $1
            OR TRIM(pro_codigonormalizado)   = $2
            OR pro_conversao                 ILIKE $3
            OR TRIM(pro_codigooriginal)      = $1
            OR pro_nome                      ILIKE $4
         )
       ORDER BY
         CASE
           WHEN TRIM(pro_codprod)          = $1    THEN 1
           WHEN TRIM(pro_codigonormalizado) = $2    THEN 2
           WHEN pro_conversao               ILIKE $3 THEN 3
           WHEN TRIM(pro_codigooriginal)   = $1    THEN 4
           ELSE 5
         END
       LIMIT 1`,
      [codigo_enviado, norm, `%${codigo_enviado}%`, `%${codigo_enviado}%`]
    );

    if (!r.rows.length) {
      nao_resolvidos.push({ codigo_enviado, quantidade });
      continue;
    }

    const prod = r.rows[0];

    // Busca preço na tabela do cliente para esta indústria
    const priceR = await db.query<{ itab_precobruto: string }>(
      `SELECT t.itab_precobruto
       FROM cad_tabelaspre t
       INNER JOIN cli_ind ci ON ci.cli_tabela = t.itab_tabela
         AND ci.cli_forcodigo = t.itab_industria
       WHERE ci.cli_codigo = $1
         AND t.itab_idprod  = $2
       LIMIT 1`,
      [cliCodigo, prod.pro_id]
    );

    resolvidos.push({
      pro_id:         prod.pro_id,
      pro_codprod:    prod.pro_codprod || '',
      pro_nome:       prod.pro_nome    || '',
      pro_industria:  prod.pro_industria,
      quantidade,
      preco_unitario: priceR.rows.length ? parseFloat(priceR.rows[0].itab_precobruto) : 0,
    });
  }

  return { resolvidos, nao_resolvidos };
}

// ─── criarRascunhoWhatsApp ────────────────────────────────────────────────────
export async function criarRascunhoWhatsApp(
  db: Pool,
  cliCodigo: number,
  resolucao: ResolucaoItens,
  conversaId: number
): Promise<string> {
  await db.query('BEGIN');

  try {
    // Gera número do pedido com prefixo WA
    let seqResult;
    try {
      seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num");
    } catch {
      seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num");
    }
    const pedNumero = seqResult.rows[0].next_num;
    const pedPedido = 'WA' + String(pedNumero).padStart(6, '0');

    // Determina indústria padrão: primeiro item resolvido, ou primeira disponível no sistema
    // Necessário pois em schemas V1 ped_industria pode ser parte da PK composta (NOT NULL obrigatório)
    let pedIndustria: number | null = resolucao.resolvidos[0]?.pro_industria ?? null;
    if (!pedIndustria) {
      const indRes = await db.query<{ for_codigo: number }>(
        `SELECT for_codigo FROM fornecedores ORDER BY for_codigo LIMIT 1`
      );
      pedIndustria = indRes.rows[0]?.for_codigo ?? null;
    }

    // Cria rascunho — ped_industria preenchida com a indústria do 1º item (rep ajusta na revisão)
    const pedRes = await db.query<{ ped_numero: number }>(
      `INSERT INTO pedidos
         (ped_pedido, ped_cliente, ped_vendedor, ped_industria,
          ped_situacao, ped_data, ped_datacad)
       VALUES ($1, $2, NULL, $3, 'J', CURRENT_DATE, CURRENT_DATE)
       RETURNING ped_numero`,
      [pedPedido, cliCodigo, pedIndustria]
    );
    const pedNumeroDb = pedRes.rows[0].ped_numero;

    // Insere itens resolvidos
    let seq = 1;
    for (const item of resolucao.resolvidos) {
      const totliq = item.preco_unitario * item.quantidade;
      await db.query(
        `INSERT INTO itens_ped
           (ite_pedido, ite_industria, ite_seq, ite_produto,
            ite_nomeprod, ite_quant, ite_puni, ite_puniliq, ite_totliquido)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)`,
        [pedPedido, item.pro_industria, seq++, item.pro_codprod,
         item.pro_nome, item.quantidade, item.preco_unitario, totliq]
      );
    }

    // Insere itens não resolvidos — usa pedIndustria como fallback para schemas com NOT NULL
    for (const item of resolucao.nao_resolvidos) {
      await db.query(
        `INSERT INTO itens_ped
           (ite_pedido, ite_industria, ite_seq, ite_produto,
            ite_nomeprod, ite_quant, ite_puni, ite_puniliq, ite_totliquido)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0)`,
        [pedPedido, pedIndustria, seq++, item.codigo_enviado,
         '[NÃO ENCONTRADO] ' + item.codigo_enviado, item.quantidade]
      );
    }

    // Vincula conversa ao pedido criado
    await db.query(
      `UPDATE wpp_conversa SET pedido_id = $1, updated_at = NOW() WHERE id = $2`,
      [pedNumeroDb, conversaId]
    );

    await db.query('COMMIT');
    return pedPedido;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
