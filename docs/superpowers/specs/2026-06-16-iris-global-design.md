# IRIS Global — Design

> **Data:** 2026-06-16 · **Status:** aprovado no brainstorm, pronto para virar plano de implementação.
> Evolução da IRIS (hoje cérebro só do RepOne) para um **cérebro único** que serve todos os
> sistemas SoftHam. Semente concreta da visão "SoftHam's LLM".

## 1. Visão e objetivo

Transformar a IRIS num **modelo central** capaz de responder sobre qualquer sistema SoftHam
(RepOne, Emissor, MasterFisher, SoftHam-ADM, Quick Cash, …). **Estado final:** a IRIS com
conhecimento suficiente para ser a **assistente pessoal do dono do negócio** — seja ele rep,
lojista, exportador ou emissor.

**Princípio inegociável (o moat):** o valor está no **corpus + dados + tools**, não nos pesos.
Precisão vem de **tools determinísticas** (o banco calcula), nunca do palpite do modelo.

## 2. Decisões fechadas

| # | Decisão | Escolha |
|---|---|---|
| Foco | Quem senta na frente do cérebro | **A — cérebro compartilhado, embutido em cada produto** (o usuário fala com a IRIS dentro do próprio app; um motor só por trás) |
| Alcance | Silo × cruzar produtos | **A1 — silo por produto** agora (um chapéu por vez). A2 (visão 360º do dono) é futuro |
| Stack | Homogeneidade | **Tudo Node/TypeScript, infra própria, dono único.** 2 fora do padrão (Emissor, Quick Cash) estão sendo reescritos para conformar |
| Arquitetura | Como um motor serve N produtos | **3 — Híbrido:** biblioteca compartilhada `@softham/iris-core` + S: como hub de corpus + interface limpa que deixa um gateway central futuro ser aditivo |
| Corpus | Onde mora o canônico | **Repositório git** (`softham-iris-global`, podendo morar junto do `iris-core`). `S:\IRIS Global` é **hub/espelho** e ponto de entrada de contexto bruto; o build puxa do git |

## 3. Arquitetura & componentes

```
        ┌─────────────────────────────────────────────────────┐
 corpus  │  CORPUS — canônico em git (S:\IRIS Global = hub)     │
 git/S:  │  • soul + ofício GLOBAL (igual em todos)             │
        │  • contexto/<sistema>/ (domínio de cada produto)     │
        └───────────────────────┬─────────────────────────────┘
                                │  build: copia o corpus do sistema
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │   @softham/iris-core  — O MOTOR (extraído do RepOne)          │
 │   tool-loop · prompt(soul+corpus, prompt-cache) · permissões  │
 │   · artifacts/render rico · registrar_lacuna · contrato tools │
 └────────▲────────────────▲────────────────▲───────────────────┘
   importa │        importa │        importa │
 ┌─────────┴───┐  ┌─────────┴───┐  ┌─────────┴───┐
 │   RepOne    │  │   Emissor   │  │   ADM  ...  │  cada produto entrega:
 │ corpus+tools│  │ corpus+tools│  │ corpus+tools│  • seu corpus (do git/S:)
 │  +db +auth  │  │  +db +auth  │  │  +db +auth  │  • suas tools (banco próprio)
 └─────────────┘  └─────────────┘  └─────────────┘  • seu auth/escopo
        └──────── gateway central FUTURO (A2 / console B) ────────┘
                  importa o MESMO core → aditivo, não retrabalho
```

### 3.1 `@softham/iris-core` (motor compartilhado)
Extraído de `RepOne\backend\src\modules\iris`. Contém o que é **igual em todo sistema**:
- **tool-loop** — laço agêntico (Anthropic SDK, `claude-opus-4-8`, thinking adaptativo).
- **montagem de prompt** — 2 blocos com prompt-cache: (soul + ofício global + corpus do sistema) / conversa viva.
- **framework de permissões** — cada tool declara nível/escopo; o core aplica via o resolver de identidade do produto.
- **artifacts / render rico** — saída estruturada.
- **padrão `registrar_lacuna`** — registra quando a IRIS não conseguiu atender (vira backlog).
- **contrato de tools** — a interface que cada produto implementa (ver §5).

### 3.2 O que cada produto pluga (fino)
- **Corpus** do seu domínio (markdown), compilado do git/S: no build (como o `copy-iris-knowledge.mjs` de hoje).
- **Tools** determinísticas (schema p/ o modelo + handler que lê o **próprio banco**).
- **DB + identidade/escopo** — o produto passa o acessor do banco e resolve quem pergunta.
- Uso final no produto: `runIris({ corpus, tools, db, user })` + expor a rota `/iris/chat`. ~90% do código é o core.

### 3.3 Gateway central (futuro, fora de escopo agora)
Quando 2–3 sistemas estiverem dentro, um serviço central importa o **mesmo** core e cruza
dados do **mesmo dono** (mapeamento por CNPJ) → assistente pessoal 360º (A2) e/ou console
SoftHam (B). A interface de tools limpa garante que isso seja **aditivo**.

## 4. Corpus em 2 camadas

| Camada | Onde | Conteúdo |
|---|---|---|
| **GLOBAL** | git/S: raiz | `soul` (persona única) + ofício global (postura, decisão, ética, vocabulário) — igual em todos |
| **POR SISTEMA** | `contexto/<sistema>/` | **Referência** (o que as coisas SÃO: identidade, glossário, modelo de dados resumido, regras, fronteiras) + **Ofício** (como SER o melhor assistente daquele domínio — a camada que vira "assistente pessoal do dono") |

O gabarito de registro vive em `S:\IRIS Global\contexto\_GABARITO.md` e ganha a seção de **Ofício**
por domínio (a camada de craft, não só de dados).

## 5. Contrato de tools

```ts
interface IrisTool {
  name: string;          // ex.: "consultar_vendas_periodo"
  description: string;   // pro modelo decidir QUANDO usar
  input_schema: object;  // JSON Schema (Anthropic tools)
  handler: (db: any, input: any, user: any) => Promise<any>; // lê o BANCO do produto
  mode: 'read' | 'write';
}
```
- **read** — consulta determinística (o banco calcula; a IA não chuta número).
- **write** — 2 passos: **prévia → confirma** (o padrão `cadastrar_*` que o RepOne já usa; nada grava sem confirmação).
- cada tool declara **nível/escopo** exigido → o core aplica via o auth do produto.

## 6. Como um sistema novo entra (receita)
1. Escrever `contexto/<sistema>/` (referência + ofício) pelo gabarito.
2. Implementar **3–5 tools de leitura** primeiro.
3. `runIris({ corpus, tools, db, user })` + expor a rota.
4. Conjunto de avaliação (perguntas reais do domínio) + ligar.

## 7. Rollout em fases
- **Fase 0 — Extrair `@softham/iris-core` do RepOne.** RepOne vira o 1º consumidor, com
  **resposta idêntica** (refactor sem mudar comportamento). Soul + ofício global migram para
  o corpus versionado (git), com o S: como hub. *Prova: a extração funciona.*
- **Fase 1 — Emissor (2ª prova, domínio fiscal).** `contexto/emissor/` (referência + ofício) +
  3–5 tools de leitura (notas no período, status de uma nota, última NFe do cliente, totais por
  competência). Encaixar **já na reescrita V2 do Emissor** (nasce com a IRIS dentro).
  *Prova: o motor é genérico (domínio totalmente diferente).*
- **Fase 2+ — MasterFisher · ADM · Quick Cash · …** cada um repete a receita.
- **Futuro — Gateway central / A2.** Fora de escopo deste spec.

## 8. Testes
- **Extração à prova de regressão:** snapshot das respostas atuais da IRIS-RepOne (perguntas-âncora) → após extrair o core, mesmas respostas.
- **Tools:** teste unitário determinístico por tool (input → saída do banco).
- **Write tools:** garantir que **não grava sem o passo de confirmação**.
- **Eval por sistema:** conjunto de perguntas reais do domínio, por produto.

## 9. Riscos & mitigação
- **Drift de versão do pacote** entre produtos → semver interno; cada produto fixa a versão.
- **Emissor é alvo móvel** (em reescrita) → encaixar a interface de tools junto da V2, após o core dele estabilizar.
- **Corpus canônico** precisa de versionamento → mora em **git**; S: é hub/espelho e entrada de contexto bruto; o build puxa do git.

## 10. Não-objetivos (YAGNI por agora)
- **Sem serviço central / gateway** nesta etapa (só a interface deixa a porta aberta).
- **Sem A2 / cruzamento entre produtos** agora (silo por produto).
- **Sem fine-tuning / pesos próprios** — RAG/corpus + tools, sempre.

## 11. Critérios de sucesso
1. RepOne roda 100% sobre `@softham/iris-core` com comportamento idêntico ao atual.
2. Emissor responde perguntas fiscais reais via a mesma IRIS, com tools determinísticas.
3. Adicionar um 3º sistema é "seguir a receita" (corpus + 3–5 tools + wire), sem mexer no core.
