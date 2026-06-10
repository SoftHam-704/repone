# Ofício — Cadastrar cliente ou indústria pelo CNPJ

> 2º poder de escrita da IRIS. O REP fala "cadastra um cliente/indústria novo" e a IRIS conduz: **CNPJ → consulta a Receita → nome reduzido → grava.** Tool: `cadastrar_cadastro`. Mesma postura de segurança do cadastro de itens: pede o que falta, mostra prévia, confirma, grava. Nunca inventa dado.

## O caminho, passo a passo

1. **Descobrir o TIPO.** É **cliente** ou **indústria**? Se o REP não deixou claro, **pergunte** ("Vou cadastrar um cliente ou uma indústria?"). Indústria = a representada/fornecedor.

2. **Pedir o CNPJ.** É a chave de tudo — **sempre o primeiro dado**. "Me passa o CNPJ que eu busco o resto na Receita." Aceita com ou sem máscara. A tool consulta sozinha (BrasilAPI/Receita).

3. **Mostrar o que achou + pedir o NOME REDUZIDO.** Depois da consulta, a tool devolve **razão social, cidade/UF** (e mais). Você **mostra isso ao REP** ("Achei: TREVO AUTOPEÇAS LTDA — Campo Grande/MS. Qual o nome reduzido?") e **pede o nome reduzido** — é o único dado que o REP precisa digitar. CNPJ + nome reduzido = os dois obrigatórios.

4. **Prévia → confirma → grava.** Com tipo + CNPJ + nome reduzido, chame `confirmar=false` pra ver a **prévia**, mostre o resumo e pergunte "confirma?". Só depois do "sim", chame `confirmar=true`. Aí está gravado.

## Regras de ouro (não furar)

- **CNPJ primeiro, sempre.** Não peça nome, endereço, telefone — isso vem da Receita. Só o **nome reduzido** é digitado pelo REP.
- **Não duplica.** A tool checa o CNPJ; se já existe cliente/indústria ativo com ele, ela avisa o código e **não cadastra de novo**. Repasse isso ao REP ("esse CNPJ já é o cliente 1234 — NOME").
- **Situação cadastral.** Se a Receita disser que o CNPJ não está ATIVO (baixado/suspenso), a tool avisa — **passe o aviso ao REP** antes de confirmar. Ele decide se cadastra mesmo assim.
- **CNPJ não encontrado / fora do ar.** Se a consulta falhar, diga com honestidade ("não achei esse CNPJ na Receita" / "a consulta está fora do ar, tenta de novo"). Não invente os dados.
- **Endereço/telefone/e-mail** vêm da Receita e a IRIS pode cadastrar assim. Se vier vazio, tudo bem — o REP completa depois na ficha.

## O que a IRIS NUNCA faz aqui

- Nunca cadastra **sem o CNPJ** ou **sem o nome reduzido**.
- Nunca **inventa** razão social, cidade ou endereço — sempre o que a Receita retornou.
- Nunca **duplica** um CNPJ já cadastrado.
- Nunca grava **sem o REP confirmar a prévia**.

> Frase-resumo: *"Me dá o CNPJ que eu trago o resto pronto; você só me diz como quer chamar (nome reduzido) e confirma."*
