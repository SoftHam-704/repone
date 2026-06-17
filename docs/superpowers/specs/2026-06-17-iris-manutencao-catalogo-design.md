# IRIS — Manutenção de Catálogo e Tabelas de Preço — Design

> **Data:** 2026-06-17 · **Status:** aprovado no brainstorm, pronto para virar plano.
> Dá à IRIS o poder de **manutenção** (remover/editar/mesclar) em produtos e tabelas
> de preço, estendendo o padrão de escrita `cadastrar_itens_tabela` (prévia→confirma).

## 1. Objetivo

Hoje a IRIS só **cria/atualiza** (cadastrar_itens_tabela, cadastrar_cadastro) — não
remove nem corrige catálogo. Resultado: pedidos como "remova os itens com `.000` no
código" (caso real ndsrep/CANAPARTS) não são atendidos. Este design adiciona a camada
de **manutenção executora**, com segurança máxima.

**Caso de teste real (ndsrep/CANAPARTS):** a indústria manda códigos com 3 zeros a mais
no fim. A 1ª importação foi feita SEM os zeros; a 2ª (esqueceram de tirar) entrou COM
`.000`, duplicando o catálogo. A IRIS deve resolver isso.

## 2. Princípios inegociáveis

1. **SEM ACHISMO.** A IRIS age **só sobre coordenadas exatas que o REP deu** (lista de
   códigos ou regra explícita, ex.: "terminados em `000`"). NUNCA auto-detecta duplicado
   nem infere pareamento. Pedido vago → pede a regra exata.
2. **Prévia → confirma** em toda operação. `confirmar=false` mostra a **lista exata** que
   a regra resolveu; `confirmar=true` grava em transação. Nada destrutivo sem confirmação.
3. **Histórico é sagrado.** Hard delete só sem movimento; com movimento → inativar ou mesclar.
4. **Precisão vem da tool, não do modelo** — o banco resolve/filtra; a IRIS só orquestra.

## 3. As ferramentas (4 novas no registro da IRIS)

Todas: escopo do tenant (`req.db`), resolvem a indústria pelo **nome reduzido** (mesma
função do cadastrar_itens_tabela), e seguem **prévia→confirma**.

### 3.1 `remover_itens`
Inativa / reativa / exclui itens do catálogo de UMA indústria.
- **Input:** `industria` (obrig) · critério explícito: `codigos` (lista) **OU** `padrao`
  (ex.: sufixo `000`, com modo: começa/termina/contém/igual) · `acao`:
  `inativar`|`reativar`|`excluir` · `confirmar`.
- **Semântica:** `inativar`→`pro_status=false` (some do catálogo/pedidos/portal/IRIS,
  fica no banco); `reativar`→`pro_status=true`; `excluir`→`DELETE FROM cad_prod`.
- **Guardrail:** `excluir` só nos itens **sem movimento** (`itens_ped`); os com movimento
  são recusados e listados, com sugestão de `inativar`.

### 3.2 `editar_item`
Corrige a identidade de um produto.
- **Input:** `industria` · `codigo_atual` · `novo_codigo?` e/ou `nova_descricao?` · `confirmar`.
- **Guardrail:** se `novo_codigo` já existir na indústria → **colisão** → recusa e sugere
  `mesclar_itens` (é dedupe, não edição).

### 3.3 `mesclar_itens` (dedupe com merge de histórico)
- **Input:** `industria` · `pares` (lista explícita `{de_codigo, para_codigo}`) **OU** regra
  explícita (`padrao_duplicado` + como derivar o original) · `confirmar`.
- **Mecânica (transação atômica), por par:** (1) o `para_codigo` (original) DEVE existir,
  senão recusa; (2) `UPDATE itens_ped SET ite_idproduto=<id original>, ite_produto=<código
  original> WHERE ite_idproduto=<id duplicado>`; (3) mantém as tabelas de preço do original;
  (4) remove o duplicado (já sem movimento). Não mescla item nele mesmo.

### 3.4 `remover_item_da_tabela`
Tira item(ns) de UMA tabela de preço específica (não mexe no produto do catálogo).
- **Input:** `industria` · `codigos` · `tabela` · `confirmar`.
- **Ação:** `DELETE FROM cad_tabelaspre WHERE itab_idindustria=$ AND itab_tabela=$ AND
  itab_idprod IN (...)`.

**Preço (criar/atualizar)** continua no `cadastrar_itens_tabela`. Se for preciso editar
preço de UMA tabela só (hoje ele aplica em todas), estende-se aquele tool com um param
`tabela?` opcional — fora do escopo desta v1, anotado.

## 4. Prévia → confirma (formato)

Igual ao cadastrar_itens_tabela: retorno estruturado.
- **Prévia (`confirmar=false`):** `{ previa:true, industria, acao, itens:[{codigo, nome,
  tem_movimento}], total, com_movimento, mensagem:"... Confirma?" }`. Para `mesclar`: os
  pares resolvidos + nº de pedidos que serão re-apontados.
- **Execução (`confirmar=true`):** transação; retorno `{ ok:true, ... , mensagem }`.

## 5. Como a IRIS é ensinada (system prompt)

No bloco estável (buildBlocoEstavel), adicionar as 4 tools + regras:
- Toda manutenção é **2 passos** (prévia → REP confirma → executa). Nunca pular.
- **Nunca inferir** alvo/par — só coordenadas exatas; pedido vago → pedir a regra.
- `excluir` só sem movimento; com movimento → `inativar`/`mesclar`.
- Sem tool pro pedido → `registrar_lacuna`.

## 6. Permissão

| Tool / ação | Nível |
|---|---|
| `inativar` / `reativar` / `editar_item` / `remover_item_da_tabela` | **Gerência+** (mesmo do acesso à IRIS) |
| `excluir` (hard delete) e `mesclar_itens` | **Master** |

Aplicado no handler de cada tool (via `user.role` / `levelOf`), além do gate de acesso à IRIS.

## 7. Modelo de dados tocado
- `cad_prod` (pro_id, pro_codprod, pro_industria, pro_nome, **pro_status**).
- `cad_tabelaspre` (itab_idprod, itab_idindustria, itab_tabela).
- `itens_ped` (ite_idproduto, ite_produto) — re-apontado no merge.
- Filtro universal `pro_status IS NOT FALSE` (catálogo/pedidos/portal/IRIS) faz o
  inativar "sumir" o item sem apagar.

## 8. Testes / aceite (ndsrep / CANAPARTS)
1. *"inativa os itens da CANAPARTS com código terminado em 000"* → prévia lista os N
   `.000` → confirma → somem de tudo, histórico intacto. ✅
2. *"exclui os itens da CANAPARTS terminados em 000"* com algum tendo pedido → IRIS
   exclui os sem movimento e **recusa** os com movimento, sugerindo inativar/mesclar. ✅
3. *"mescla os terminados em 000 no mesmo código sem os 000"* → prévia mostra os pares +
   nº de pedidos a re-apontar → confirma → histórico migra pro original, `.000` removido. ✅
4. Unitário por handler (mock db): prévia não grava; confirma grava; guardrail de movimento
   bloqueia hard delete; merge re-aponta itens_ped e remove o dup; colisão de código recusa.

## 9. Não-objetivos (YAGNI)
- **Sem auto-detecção/sugestão de duplicados** (princípio anti-achismo).
- **Sem edição de preço por tabela** na v1 (usar cadastrar_itens_tabela; estender depois).
- Sem desfazer/undo automático (inativar já é reversível por `reativar`).

## 10. Critérios de sucesso
1. A IRIS atende "remova/inativa/mescla os `.000` da CANAPARTS" no ndsrep, com prévia exata e confirmação.
2. Nenhuma operação destrutiva ocorre sem prévia+confirmação.
3. Hard delete jamais apaga item com pedido; merge nunca perde histórico.
4. A IRIS nunca infere alvo — só executa coordenadas explícitas.
