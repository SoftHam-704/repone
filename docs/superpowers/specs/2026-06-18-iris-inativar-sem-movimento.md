# IRIS — inativar clientes/indústrias sem movimento

**Objetivo:** dar à IRIS o poder de **inativar em massa** clientes e indústrias **sem pedido há mais de N anos**, pra limparem dos filtros. Novo poder executora, no molde de `remover_itens` (prévia→confirma, sem achismo, reversível).

## Critério (decidido com Hamilton 2026-06-18)
Base = **data do último pedido P/F** (`pedidos.ped_situacao IN ('P','F')`), pros dois alvos. O REP dá o **número de anos** (a IRIS pergunta se não vier — sem prazo, não age).

- **Clientes** (`cli_tipopes 'A'→'I'`): inativa se `COALESCE(MAX(ped_data por ped_cliente), cli_datacad) < hoje − N anos`. Nunca-comprou cai pela **data de cadastro** (`cli_datacad`, 99,87% preenchido) → não pega prospect novo. Protege **FILIAL** e **`cli_ignora_estat`** (via `cli_atuacao`/`cli_ignora_estat` — regra `excluiInativoSQL`).
- **Indústrias** (`fornecedores.for_tipo2 'A'→'I'`): inativa se `MAX(ped_data por ped_industria) < hoje − N anos` **OU** nunca teve pedido (`NULL`). Fornecedores **não têm data de cadastro** (confirmado pelo dba) → nunca-vendeu entra direto; a prévia mostra antes de confirmar (são poucas).

## Tool `inativar_sem_movimento(alvo, anos, confirmar)`
- `alvo`: `'clientes' | 'industrias'` (obrigatório; se faltar, pergunta).
- `anos`: inteiro > 0 (obrigatório; se faltar/zero, pergunta "há quantos anos?").
- `confirmar`: `false` (default) = **prévia** (conta, separa "nunca" × "pararam", lista nomes, não grava); `true` = grava em transação.
- **Permissão:** Gerência+ pra gravar (preview liberado). É reversível, não precisa ser Master.
- **Reversível:** flip do flag; reativa pelo cadastro (cliente/fornecedor). MVP não cria reativar na IRIS.

## Integração
- `backend/src/modules/iris/tools/inativar-sem-movimento.ts` (handler).
- Registrar em `tools/index.ts` (TOOLS_REGISTRY + TOOLS def, marcado ESCRITA).
- Ofício `knowledge/oficio-09-inativar-sem-movimento.md` + registrar no `FILES` de `knowledge/index.ts`.

## Guardrails (iguais às outras tools de escrita)
- 2 passos obrigatórios (prévia→confirma); nunca grava sem o "sim".
- Sem achismo: o REP dá o alvo e os anos; a IRIS não inventa prazo.
- Só pedidos P/F contam ([[feedback_status_pedido_e_excluido]]).
- ped_industria órfão (sem fornecedor vivo) não é tocado — o universo parte de `fornecedores`/`clientes` ativos.

## Fora de escopo
- Reativar pela IRIS · auditoria/log do que foi inativado (flip é reversível pelo cadastro; a prévia/confirma já lista) · gating por carteira do operador (acesso é Gerência+).
