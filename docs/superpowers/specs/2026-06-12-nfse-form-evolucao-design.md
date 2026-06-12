# NFS-e — Evolução do Form de Emissão (Design)

**Data:** 2026-06-12
**Base:** form de emissão já entregue (prévia+confirma, PDF/XML/cancelar). Esta evolução
atende 6 pedidos do borcatorep/Hamilton sobre o form "Nova NFS-e".

---

## Objetivo

Tornar a emissão de NFS-e acessível a mais perfis (sem ver o Financeiro), continuar a
numeração da empresa, escolher o **serviço prestado** por nota (não só comissão), enviar
as notas autorizadas por e-mail, e garantir que só indústrias ativas apareçam.

## Itens e escopo

| # | Pedido | Solução |
|---|---|---|
| 1 | Acesso fora do Financeiro | Item **"NFS-e"** no sidebar (Gerência+Master); rotas backend abrem pra Gerência+ |
| 2 | Número segue a sequência | "Nº da NF" pré-preenche com `emp_nfse_proximo_numero`; emissão atualiza com o nº real |
| 3 | Só indústrias ativas | Já filtrado (`for_tipo2='A'`); confirmar/garantir |
| 4 | Não é só comissão | **Seletor de serviços** (cadastro `fin_nfse_servicos`) define os códigos + discriminação da nota |
| 5 | Enviar por e-mail | Botão na linha EMITIDA → e-mail do tomador editável → anexa PDF+XML |
| 6 | Ver DANFSE + XML | Já entregue (botões PDF/XML nas linhas EMITIDA) |

**Fora de escopo:** emissão em lote; auto-resolução de IBGE; upload de certificado (etapa do form de Config, separada).

---

## 1. Acesso + sidebar (Gerência + Master)

- **Backend:** `nfse.routes.ts` troca `requireLevel(LEVEL.MASTER)` por `requireLevel(LEVEL.GERENCIA)`
  (Gerência e acima — Master incluído). Operador comum continua sem acesso.
- **Frontend:** novo item no sidebar **"NFS-e"** apontando pra `/financeiro/nfse-comissoes`
  (a mesma tela), visível só pra Gerência+. (Segue o padrão de visibilidade por nível já
  usado no sidebar.) O card no Hub Financeiro continua existindo.

## 2. Numeração

- `GET /empresa` já devolve `emp_nfse_proximo_numero`. O `NfseModal` (Nova NF), ao abrir em
  modo "new", **pré-preenche o campo "Nº da NF"** com esse valor (somente leitura sugerida,
  editável). Na emissão, o número real volta da ACBr e sobrescreve (`fin_nfse.numero`), e o
  `emp_nfse_proximo_numero` é incrementado (já implementado no handler).

## 3. Indústrias ativas

- `listRepresentadasHandler` já tem `WHERE for_tipo2 = 'A'` (A=Ativo). Confirmar que o combobox
  do `NfseModal` usa essa fonte (`/nfse/representadas`). Sem mudança de código esperada — só
  validação. (`for_tipo2` é a Situação no cadastro de Indústrias: A=Ativo, I=Inativo.)

## 4. Seletor de serviços prestados

A nota nem sempre é comissão. Um **cadastro de serviços** guarda os códigos fiscais por serviço;
a nota referencia um serviço, que define `item_lc116`/`cTribNac`/`cNBS` e a **discriminação**.

### Tabela `fin_nfse_servicos` (por tenant, migration nova)
```
id           SERIAL PK
descricao    VARCHAR(120)   -- "Representação comercial", "Suporte técnico em TI"
item_lc116   VARCHAR(12)    -- 10.09.01
ctribnac     VARCHAR(10)    -- 100901
cnbs         VARCHAR(12)    -- 102010000
ctribmun     VARCHAR(10)    -- opcional
iss_pct      NUMERIC(6,2)   -- opcional (fora do Simples)
ativo        BOOLEAN DEFAULT true
```
**Seed** (os 2 com códigos já validados ao vivo):
- Representação comercial — 10.09.01 · 100901 · 102010000
- Suporte técnico em TI — 01.07.01 · 010701 · 115013000

(Outros do ramo a completar conforme cadastro: 10.05 agenciamento/intermediação, 10.08
publicidade — falta levantar o cNBS de cada.)

### `fin_nfse.servico_id`
Coluna nova (nullable). O lançamento referencia o serviço escolhido. Na prévia/emissão:
- Se `servico_id` preenchido → usa os códigos **do serviço** + descrição = `servico.descricao`.
- Senão → cai no **default da empresa** (`empresa_status`), mantendo retrocompatibilidade.

### Backend
- `GET /nfse/servicos` — lista serviços ativos.
- CRUD mínimo (`POST/PUT/DELETE /nfse/servicos`) num modal de gestão (padrão do `AliquotasModal`).
- `montarPayload`/`carregarParaEmissao` passam a resolver os códigos do `servico_id` quando houver,
  e a **discriminação** = `servico.descricao + ' — competência ' + competencia` (em vez do fixo).

### Frontend
- Combobox **"Serviço prestado"** no `NfseModal`, default = serviço padrão (o 1º ativo ou o que
  casar com os códigos da empresa). Grava `servico_id` no lançamento.

## 5. Envio por e-mail das notas autorizadas

- **Backend:** `POST /nfse/:id/email` body `{ para, assunto?, mensagem? }` — baixa PDF+XML da ACBr
  e envia pelo serviço de e-mail já existente (o mesmo usado no envio de pedido). Anexa PDF+XML.
- **Frontend:** botão **"Enviar por e-mail"** (✉) na linha EMITIDA → modal com:
  - **Para:** pré-preenchido com o e-mail do tomador (indústria, `for_email`), **editável**.
  - Assunto/mensagem padrão editáveis.
  - Anexos: PDF + XML (fixos).
  - Botão Enviar → feedback de sucesso/erro.

## Tratamento de erros
- Serviço sem códigos completos → bloqueia emissão com aviso ("complete cTribNac/cNBS do serviço").
- E-mail sem destinatário válido → valida antes de enviar.
- Demais erros (ACBr) reaproveitam o tratamento já existente (motivo rico).

## Componentes / arquivos
- **Migration:** `fin_nfse_servicos` + `fin_nfse.servico_id` (replicada nos 31 tenants).
- **Backend:** `nfse.controller.ts` (servicos CRUD, email handler, ajuste em montarPayload/carregar),
  `nfse.routes.ts` (rotas + requireLevel GERENCIA).
- **Frontend:** `NfseComissoesPage.tsx` (combobox serviço no NfseModal, número pré-fill, botão e-mail
  + EmailModal, modal de serviços), sidebar (item NFS-e).

## Dependências
- Serviço de e-mail (SMTP) já configurado no backend (reusar do envio de pedido).
- Certificado A1 (emissão real) — etapa pendente do form de Config.

## Pesquisa pendente (dados, não código)
- cNBS de 10.05 (agenciamento/intermediação) e 10.08 (publicidade) para completar o seed do cadastro.
