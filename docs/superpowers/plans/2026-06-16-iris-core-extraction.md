# IRIS Core — Extração (Fase 0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desacoplar o motor da IRIS num módulo product-agnostic (`backend/src/iris-core/`) que o RepOne passa a plugar, com **comportamento idêntico** ao atual.

**Architecture:** O motor (tool-loop, montagem do prompt em 2 blocos com cache, loader de corpus, artifacts, permissões) vira `iris-core/` com **zero import de coisas do RepOne** — recebe tudo por injeção (tools, corpus, persona, modelo). O que é RepOne (as tools, o conteúdo do corpus, a persona/soul) fica em `modules/iris/` e é passado ao core. A extração física pro pacote npm `@softham/iris-core` é deferida para quando o 2º consumidor (Emissor) chegar — aqui só criamos a fronteira limpa.

**Tech Stack:** TypeScript, Node, Express, `@anthropic-ai/sdk` (já em uso). Testes determinísticos dos seams com **vitest** (novo devDep, leve, TS-native). Sem tocar no fluxo de build/deploy atual (continua `tsc`).

**Por que "idêntico" é verificável sem snapshot de resposta:** a resposta final passa pela API (não-determinística). O que garante equivalência é que os **seams determinísticos** não mudam: (a) os blocos de system prompt gerados são byte-idênticos; (b) a lista de tools enviada é idêntica; (c) o controle de fluxo do tool-loop é o mesmo; (d) os artifacts gerados de um resultado fixo são idênticos. Tudo isso é unit-testável.

---

## File Structure

**Criar (o motor product-agnostic):**
- `backend/src/iris-core/types.ts` — contratos públicos (`IrisTool`, `ToolDef`, `ToolHandler`, `ToolEvent`, `ToolLoopResult`, `Artifact`, `Formato`).
- `backend/src/iris-core/artifacts.ts` — `buildArtifactsFromTool` (movido, sem mudança de lógica).
- `backend/src/iris-core/corpus.ts` — `loadCorpus(dir, files)` (generalização do `loadIrisKnowledge`).
- `backend/src/iris-core/prompt.ts` — `buildSystemBlocks({ estavel, dinamico })` (mecanismo dos 2 blocos com cache).
- `backend/src/iris-core/tool-loop.ts` — `runToolLoop(...)` recebendo `tools`+`registry`+`model` por parâmetro.
- `backend/src/iris-core/index.ts` — reexporta a API pública do core.
- `backend/src/iris-core/__tests__/*.test.ts` — testes determinísticos dos seams.

**Modificar (a fiação RepOne, que injeta o domínio):**
- `backend/src/modules/iris/tools/tool-loop.ts` — **deletado** (vai pro core).
- `backend/src/modules/iris/tools/artifacts.ts` — **deletado** (vai pro core).
- `backend/src/modules/iris/knowledge/index.ts` — passa a usar `loadCorpus` do core.
- `backend/src/modules/iris/iris-chat.controller.ts` — passa `TOOLS`+`TOOLS_REGISTRY`+modelo ao `runToolLoop` do core e usa `buildSystemBlocks`.
- `backend/src/modules/iris/tools/index.ts` — sem mudança de conteúdo (só é a fonte das tools injetadas).
- `backend/package.json` — adiciona `vitest` em devDependencies + script `test`.
- `backend/vitest.config.ts` — **criar** (config mínima, só `iris-core/__tests__`).

---

## Task 1: Adicionar vitest ao backend

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Instalar vitest**

Run: `cd backend && npm install -D vitest@^2`
Expected: `added ... packages`, sem erros.

- [ ] **Step 2: Adicionar o script de teste**

Em `backend/package.json`, dentro de `"scripts"`, adicione:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Criar a config do vitest (escopo só no iris-core)**

Create `backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/iris-core/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Rodar pra confirmar que o runner está de pé (sem testes ainda)**

Run: `cd backend && npm test`
Expected: vitest roda e diz "No test files found" (ou similar) — runner OK.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts
git commit -m "chore(iris-core): adiciona vitest pro motor da IRIS"
```

---

## Task 2: Contratos públicos do core (`types.ts`)

**Files:**
- Create: `backend/src/iris-core/types.ts`
- Test: `backend/src/iris-core/__tests__/types.test.ts`

- [ ] **Step 1: Escrever o teste do contrato (compila e aceita uma tool válida)**

Create `backend/src/iris-core/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { IrisTool } from '../types';

describe('IrisTool', () => {
  it('aceita uma tool de leitura bem formada', async () => {
    const tool: IrisTool = {
      name: 'eco',
      description: 'devolve o input',
      input_schema: { type: 'object', properties: {} },
      handler: async (_db, input) => ({ ok: true, input }),
      mode: 'read',
    };
    const out = await tool.handler({}, { a: 1 }, {});
    expect(out).toEqual({ ok: true, input: { a: 1 } });
    expect(tool.mode).toBe('read');
  });
});
```

- [ ] **Step 2: Rodar — deve falhar (módulo não existe)**

Run: `cd backend && npx vitest run src/iris-core/__tests__/types.test.ts`
Expected: FAIL — `Cannot find module '../types'`.

- [ ] **Step 3: Implementar os tipos**

Create `backend/src/iris-core/types.ts`:

```ts
// Contratos públicos do motor da IRIS (product-agnostic). Nenhum tipo aqui
// conhece RepOne, NFe ou qualquer domínio — só a forma do que um produto pluga.

export type ToolMode = 'read' | 'write';

// Definição enviada ao modelo (formato Anthropic tools).
export interface ToolDef {
  name: string;
  description: string;
  input_schema: any;
}

// Handler que executa a tool contra o banco do produto.
export type ToolHandler = (db: any, input: any, user: any) => Promise<any>;

// A tool completa que um produto registra: definição + handler + modo.
export interface IrisTool extends ToolDef {
  handler: ToolHandler;
  mode: ToolMode;
}

export type Formato = 'auto' | 'tabela' | 'grafico' | 'mapa' | 'kpi' | 'narrativa';

export interface Artifact {
  tipo: Formato;
  // payload livre (a forma exata é responsabilidade de quem renderiza)
  [k: string]: any;
}

export interface ToolEvent {
  name: string;
  input: any;
  ms: number;
  ok: boolean;
}

export interface ToolLoopResult {
  answer: string;
  toolEvents: ToolEvent[];
  artifacts: Artifact[];
  usage: { input_tokens: number; output_tokens: number };
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `cd backend && npx vitest run src/iris-core/__tests__/types.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add backend/src/iris-core/types.ts backend/src/iris-core/__tests__/types.test.ts
git commit -m "feat(iris-core): contratos públicos product-agnostic"
```

---

## Task 3: Mover `artifacts.ts` pro core (sem mudar lógica)

**Files:**
- Create: `backend/src/iris-core/artifacts.ts`
- Test: `backend/src/iris-core/__tests__/artifacts.test.ts`
- (depois) Delete: `backend/src/modules/iris/tools/artifacts.ts`

- [ ] **Step 1: Caracterizar o comportamento atual com um teste (golden)**

Primeiro leia o arquivo atual `backend/src/modules/iris/tools/artifacts.ts` e escolha UM caso real: uma chamada a `buildArtifactsFromTool('consultar_vendas_periodo', <resultado fixo>, 'tabela')`. Capture a saída atual rodando um script pontual e cole o valor esperado no teste.

Create `backend/src/iris-core/__tests__/artifacts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildArtifactsFromTool } from '../artifacts';

describe('buildArtifactsFromTool', () => {
  it('monta artifact de tabela a partir de um resultado de vendas', () => {
    // <RESULTADO_FIXO> e <SAIDA_ESPERADA> vêm da caracterização do código atual
    const resultado = /* <RESULTADO_FIXO capturado do artifacts.ts atual> */ {};
    const out = buildArtifactsFromTool('consultar_vendas_periodo', resultado as any, 'tabela');
    expect(out).toMatchSnapshot();
  });
});
```

> Use `toMatchSnapshot()` para travar a saída atual exatamente. O primeiro run grava o snapshot; depois da movimentação, o snapshot DEVE continuar idêntico.

- [ ] **Step 2: Copiar o arquivo pro core, ajustando só os imports de tipos**

Copie `backend/src/modules/iris/tools/artifacts.ts` → `backend/src/iris-core/artifacts.ts`. Troque qualquer `import` de tipos locais por `import { Artifact, Formato } from './types'`. **Não mude nenhuma lógica.**

- [ ] **Step 3: Rodar — grava o snapshot**

Run: `cd backend && npx vitest run src/iris-core/__tests__/artifacts.test.ts`
Expected: PASS (1 snapshot escrito).

- [ ] **Step 4: Commit**

```bash
git add backend/src/iris-core/artifacts.ts backend/src/iris-core/__tests__/
git commit -m "feat(iris-core): move artifacts (lógica intacta + snapshot)"
```

---

## Task 4: Generalizar o loader de corpus (`corpus.ts`)

**Files:**
- Create: `backend/src/iris-core/corpus.ts`
- Test: `backend/src/iris-core/__tests__/corpus.test.ts`

- [ ] **Step 1: Escrever o teste (lê N arquivos de um dir, concatena, ignora ausentes, memoiza por chave)**

Create `backend/src/iris-core/__tests__/corpus.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadCorpus } from '../corpus';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-'));
  fs.writeFileSync(path.join(dir, 'a.md'), 'AAA');
  fs.writeFileSync(path.join(dir, 'b.md'), 'BBB');
});

describe('loadCorpus', () => {
  it('concatena na ordem dada e ignora arquivo ausente', () => {
    const out = loadCorpus(dir, ['a.md', 'falta.md', 'b.md']);
    expect(out).toBe('AAA\n\nBBB');
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `cd backend && npx vitest run src/iris-core/__tests__/corpus.test.ts`
Expected: FAIL — `Cannot find module '../corpus'`.

- [ ] **Step 3: Implementar (generalização do loadIrisKnowledge)**

Create `backend/src/iris-core/corpus.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

const cache = new Map<string, string>();

/**
 * Lê e concatena uma lista de arquivos .md de um diretório, na ordem dada.
 * Memoizado por (dir + lista). Arquivo ausente é ignorado (não derruba).
 * Generalização product-agnostic do antigo loadIrisKnowledge do RepOne.
 */
export function loadCorpus(dir: string, files: string[]): string {
  const key = dir + '::' + files.join(',');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const parts: string[] = [];
  for (const f of files) {
    try {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8').trim();
      if (txt) parts.push(txt);
    } catch { /* ausente: ignora */ }
  }
  const out = parts.join('\n\n');
  cache.set(key, out);
  return out;
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `cd backend && npx vitest run src/iris-core/__tests__/corpus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/iris-core/corpus.ts backend/src/iris-core/__tests__/corpus.test.ts
git commit -m "feat(iris-core): loader de corpus genérico (loadCorpus)"
```

---

## Task 5: Mecanismo dos 2 blocos de prompt (`prompt.ts`)

**Files:**
- Create: `backend/src/iris-core/prompt.ts`
- Test: `backend/src/iris-core/__tests__/prompt.test.ts`

- [ ] **Step 1: Escrever o teste (bloco estável cacheável + dinâmico não-cacheado)**

Create `backend/src/iris-core/__tests__/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSystemBlocks } from '../prompt';

describe('buildSystemBlocks', () => {
  it('marca só o bloco estável com cache_control ephemeral', () => {
    const blocks = buildSystemBlocks({ estavel: 'PERSONA', dinamico: 'TENANT' });
    expect(blocks).toEqual([
      { type: 'text', text: 'PERSONA', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'TENANT' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `cd backend && npx vitest run src/iris-core/__tests__/prompt.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `backend/src/iris-core/prompt.ts`:

```ts
// Monta o system prompt em 2 blocos: ESTÁVEL (agnóstico de tenant → cacheável via
// prompt caching) + DINÂMICO (específico do tenant/usuário, fora do cache).
// O CONTEÚDO de cada bloco é responsabilidade do produto; aqui só a estrutura.
export function buildSystemBlocks(opts: { estavel: string; dinamico: string }): any[] {
  return [
    { type: 'text', text: opts.estavel, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: opts.dinamico },
  ];
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `cd backend && npx vitest run src/iris-core/__tests__/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/iris-core/prompt.ts backend/src/iris-core/__tests__/prompt.test.ts
git commit -m "feat(iris-core): mecanismo dos 2 blocos de prompt (cache)"
```

---

## Task 6: `runToolLoop` parametrizado (injeta tools + registry + modelo)

**Files:**
- Create: `backend/src/iris-core/tool-loop.ts`
- Test: `backend/src/iris-core/__tests__/tool-loop.test.ts`

- [ ] **Step 1: Escrever o teste com Anthropic mockado (fluxo: pede tool → executa → responde)**

Create `backend/src/iris-core/__tests__/tool-loop.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runToolLoop } from '../tool-loop';
import type { ToolDef, ToolHandler } from '../types';

function fakeAnthropic(sequence: any[]) {
  let i = 0;
  return { messages: { create: vi.fn(async () => sequence[i++]) } } as any;
}

const TOOLS: ToolDef[] = [{ name: 'soma', description: 's', input_schema: { type: 'object', properties: {} } }];
const REGISTRY: Record<string, ToolHandler> = { soma: async (_db, input) => ({ total: input.a + input.b }) };

describe('runToolLoop', () => {
  it('executa a tool pedida e finaliza com o texto da 2ª rodada', async () => {
    const anthropic = fakeAnthropic([
      { stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 },
        content: [{ type: 'tool_use', id: 't1', name: 'soma', input: { a: 2, b: 3 } }] },
      { stop_reason: 'end_turn', usage: { input_tokens: 4, output_tokens: 2 },
        content: [{ type: 'text', text: 'O total é 5. [[VISUAL:kpi]]' }] },
    ]);

    const r = await runToolLoop({
      anthropic, system: 'SYS', db: {}, user: {}, question: 'soma 2 e 3', history: [],
      tools: TOOLS, registry: REGISTRY, model: 'claude-sonnet-4-6', buildArtifacts: () => [],
    });

    expect(r.answer).toBe('O total é 5.');               // formato removido do texto
    expect(r.toolEvents.map(e => [e.name, e.ok])).toEqual([['soma', true]]);
    expect(r.usage).toEqual({ input_tokens: 14, output_tokens: 7 });
  });

  it('tool inexistente vira erro estruturado, não quebra', async () => {
    const anthropic = fakeAnthropic([
      { stop_reason: 'tool_use', usage: {}, content: [{ type: 'tool_use', id: 't1', name: 'naoexiste', input: {} }] },
      { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: 'ok' }] },
    ]);
    const r = await runToolLoop({
      anthropic, system: 'SYS', db: {}, user: {}, question: 'x', history: [],
      tools: TOOLS, registry: REGISTRY, model: 'claude-sonnet-4-6', buildArtifacts: () => [],
    });
    expect(r.toolEvents[0].ok).toBe(false);
    expect(r.answer).toBe('ok');
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `cd backend && npx vitest run src/iris-core/__tests__/tool-loop.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar — copiar o `modules/iris/tools/tool-loop.ts` atual e trocar a assinatura para receber `tools`/`registry`/`model`/`buildArtifacts` por parâmetro (em vez de importar de `./index` e `./artifacts`). Lógica do laço inalterada.**

Create `backend/src/iris-core/tool-loop.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';
import type { ToolDef, ToolHandler, Artifact, Formato, ToolEvent, ToolLoopResult } from './types';

const FORMATOS: Formato[] = ['auto', 'tabela', 'grafico', 'mapa', 'kpi', 'narrativa'];
function extrairFormato(texto: string): { formato: Formato; limpo: string } {
  const m = texto.match(/\[\[VISUAL:\s*(\w+)\s*\]\]/i);
  let formato: Formato = 'auto';
  if (m && FORMATOS.includes(m[1].toLowerCase() as Formato)) formato = m[1].toLowerCase() as Formato;
  const limpo = texto.replace(/\[\[VISUAL:\s*\w+\s*\]\]/gi, '').trim();
  return { formato, limpo };
}

const MAX_TURNS = 5;

export interface RunToolLoopArgs {
  anthropic: Anthropic;
  system: string | any[];
  db: any;
  user: any;
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  tools: ToolDef[];
  registry: Record<string, ToolHandler>;
  model: string;
  buildArtifacts: (toolName: string, result: any, formato: Formato) => Artifact[];
}

export async function runToolLoop(args: RunToolLoopArgs): Promise<ToolLoopResult> {
  const { anthropic, system, db, user, question, history, tools, registry, model, buildArtifacts } = args;
  const messages: any[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const toolEvents: ToolEvent[] = [];
  const successfulTools: { name: string; result: any }[] = [];
  let totalIn = 0, totalOut = 0;

  const finalize = (rawAnswer: string): ToolLoopResult => {
    const { formato, limpo } = extrairFormato(rawAnswer);
    const artifacts: Artifact[] = [];
    for (const t of successfulTools) artifacts.push(...buildArtifacts(t.name, t.result, formato));
    return { answer: limpo, toolEvents, artifacts, usage: { input_tokens: totalIn, output_tokens: totalOut } };
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await anthropic.messages.create({
      model, max_tokens: 4096, temperature: 0.5, system: system as any, tools: tools as any, messages,
    });
    totalIn += (r.usage as any)?.input_tokens ?? 0;
    totalOut += (r.usage as any)?.output_tokens ?? 0;
    messages.push({ role: 'assistant', content: r.content });

    if (r.stop_reason !== 'tool_use') {
      const answer = r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
      return finalize(answer);
    }

    const toolResults: any[] = [];
    for (const tu of r.content.filter((b: any) => b.type === 'tool_use') as any[]) {
      const t0 = Date.now();
      let payload: any; let ok = false;
      const handler = registry[tu.name];
      if (!handler) {
        payload = { erro: `tool '${tu.name}' não existe`, tools_disponiveis: Object.keys(registry) };
      } else {
        try {
          payload = await handler(db, tu.input, user);
          ok = !payload?.erro;
          if (ok) successfulTools.push({ name: tu.name, result: payload });
        } catch (e: any) {
          console.error(`❌ [IRIS/tool ${tu.name}]`, e?.message);
          payload = { erro: 'falha ao consultar os dados', detalhe: 'tente refinar o período ou o filtro' };
        }
      }
      toolEvents.push({ name: tu.name, input: tu.input, ms: Date.now() - t0, ok });
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(payload) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  const aviso = 'IMPORTANTE: você atingiu o limite de consultas. Responda agora com o que já tem, sem chamar mais ferramentas.';
  const systemFinal = Array.isArray(system) ? [...system, { type: 'text', text: aviso }] : system + '\n\n' + aviso;
  const final = await anthropic.messages.create({ model, max_tokens: 2048, temperature: 0.5, system: systemFinal as any, messages });
  totalIn += (final.usage as any)?.input_tokens ?? 0;
  totalOut += (final.usage as any)?.output_tokens ?? 0;
  const answer = final.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  return finalize(answer);
}
```

- [ ] **Step 4: Rodar — deve passar (2 testes)**

Run: `cd backend && npx vitest run src/iris-core/__tests__/tool-loop.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Reexportar a API pública do core**

Create `backend/src/iris-core/index.ts`:

```ts
export * from './types';
export { runToolLoop } from './tool-loop';
export type { RunToolLoopArgs } from './tool-loop';
export { buildArtifactsFromTool } from './artifacts';
export { loadCorpus } from './corpus';
export { buildSystemBlocks } from './prompt';
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/iris-core/tool-loop.ts backend/src/iris-core/index.ts backend/src/iris-core/__tests__/tool-loop.test.ts
git commit -m "feat(iris-core): runToolLoop parametrizado (tools/registry/model injetados)"
```

---

## Task 7: RepOne passa a consumir o core (comportamento idêntico)

**Files:**
- Modify: `backend/src/modules/iris/knowledge/index.ts`
- Modify: `backend/src/modules/iris/iris-chat.controller.ts`
- Delete: `backend/src/modules/iris/tools/tool-loop.ts`
- Delete: `backend/src/modules/iris/tools/artifacts.ts`

- [ ] **Step 1: `knowledge/index.ts` usa `loadCorpus` do core**

Substitua o corpo de `backend/src/modules/iris/knowledge/index.ts` para delegar ao core, mantendo a MESMA lista `FILES` e o MESMO diretório:

```ts
import path from 'path';
import { loadCorpus } from '../../../iris-core';

const FILES = [
  'negocio-autopecas.md', 'glossario-kpis.md', 'modelo-comercial.md', 'mapa-modulos.md',
  'mapa-navegacao.md', 'mapa-sistema-completo.md', 'financeiro.md', 'regras-negocio.md',
  'oficio-00-postura.md', 'oficio-01-ciclo-comercial.md', 'oficio-02-ler-a-carteira.md',
  'oficio-03-jogo-das-industrias.md', 'oficio-04-negociacao.md', 'oficio-05-qual-tool-usar.md',
  'oficio-06-cadastrar-itens.md', 'oficio-07-cadastrar-clientes-industrias.md', 'oficio-decisoes.md',
];

export function loadIrisKnowledge(): string {
  return loadCorpus(__dirname, FILES);
}
```

- [ ] **Step 2: `iris-chat.controller.ts` — trocar imports e a chamada**

No topo, trocar:

```ts
import { runToolLoop } from './tools/tool-loop';
```
por:
```ts
import { runToolLoop } from '../../iris-core';
import { buildArtifactsFromTool } from '../../iris-core';
import { TOOLS, TOOLS_REGISTRY } from './tools/index';
```

E a chamada do `runToolLoop` (hoje posicional) vira nomeada, injetando tools/registry/modelo/artifacts — **com o MESMO modelo `'claude-sonnet-4-6'`** que o loop usava:

```ts
const result = await runToolLoop({
  anthropic,
  system,
  db: req.db!,
  user: req.user!,
  question: question.trim(),
  history: hist,
  tools: TOOLS,
  registry: TOOLS_REGISTRY,
  model: 'claude-sonnet-4-6',
  buildArtifacts: buildArtifactsFromTool,
});
```

> O `buildBlocoEstavel`/`buildBlocoDinamico` e a montagem `system = [ {…estável, cache}, {…dinâmico} ]` continuam EXATAMENTE como estão (a equivalência byte-a-byte do prompt é o que garante "idêntico"). `buildSystemBlocks` do core fica disponível para o Emissor; o RepOne pode adotá-lo depois sem mudar a saída.

- [ ] **Step 3: Apagar os arquivos antigos do motor**

```bash
git rm backend/src/modules/iris/tools/tool-loop.ts backend/src/modules/iris/tools/artifacts.ts
```

- [ ] **Step 4: Typecheck do backend inteiro**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros (qualquer import órfão de `./tools/artifacts` ou `./tools/tool-loop` aparece aqui — corrigir apontando pro core).

- [ ] **Step 5: Rodar toda a suíte do core**

Run: `cd backend && npm test`
Expected: PASS em todos (types, artifacts+snapshot, corpus, prompt, tool-loop).

- [ ] **Step 6: Build completo (gera dist + copia knowledge)**

Run: `cd backend && npm run build`
Expected: `tsc` ok + `[copy-iris-knowledge] N arquivo(s) .md copiados para dist`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/iris/knowledge/index.ts backend/src/modules/iris/iris-chat.controller.ts
git commit -m "refactor(iris): RepOne consome @iris-core (comportamento idêntico)"
```

---

## Task 8: Smoke test real + fechamento

**Files:** nenhum (verificação manual)

- [ ] **Step 1: Subir o backend em dev**

Run: `cd backend && npm run dev`
Expected: servidor sobe sem erro de import.

- [ ] **Step 2: Uma pergunta real pela IRIS (tenant de teste)**

Pela UI do RepOne (ou curl autenticado em `POST /api/iris/ask`), perguntar algo que use tool, ex.: *"quanto vendi em abril de 2026 por indústria?"*.
Expected: resposta volta com `answer` (texto curto analítico) + `artifacts` (tabela) + `tool_events` — **igual ao comportamento de antes da refatoração**. Conferir que o bloco visual aparece.

- [ ] **Step 3: Uma pergunta conceitual (sem tool)**

Perguntar *"o que é positivação?"*.
Expected: resposta de conhecimento, sem `tool_events`, voz/tom da IRIS inalterados.

- [ ] **Step 4: Registrar o resultado do smoke no commit final**

```bash
git commit --allow-empty -m "test(iris): smoke da IRIS sobre o iris-core — comportamento idêntico confirmado"
```

---

## Self-Review

**1. Cobertura do spec (§ relevantes da Fase 0):**
- Extrair motor (tool-loop, prompt, corpus loader, artifacts) → Tasks 3–6 ✅
- Contrato de tools → Task 2 (`IrisTool`) ✅
- RepOne 1º consumidor, comportamento idêntico → Task 7 + smoke Task 8 ✅
- Permissões: **não há módulo `permissions` acoplado ao loop** (a autorização vive no `isAuthorized` do controller e no `req.user`; as tools recebem `user`). Nada a extrair na Fase 0 — registrado como não-aplicável aqui, revisitar quando uma tool de escrita precisar de gate no core.
- Corpus canônico em git / extração física do pacote npm → **deferido** (decisão de engenharia: desacoplar no lugar agora; empacotar quando o Emissor chegar). Explicitado no topo do plano.

**2. Placeholder scan:** único ponto a preencher é `<RESULTADO_FIXO>`/snapshot na Task 3 — é intencional (caracterização do código atual, que o executor lê na hora). Os demais steps têm código completo.

**3. Consistência de tipos:** `ToolDef`/`ToolHandler`/`IrisTool`/`Artifact`/`Formato`/`ToolLoopResult` definidos na Task 2 e usados igual nas Tasks 3 e 6. `runToolLoop` passou de posicional (antigo) para `RunToolLoopArgs` (nomeado) — o controller na Task 7 usa a forma nomeada. ✅

**Gap aceito:** o RepOne continua usando seu `buildBlocoEstavel` próprio (não o `buildSystemBlocks` do core) nesta fase — de propósito, para garantir equivalência byte-a-byte. Adoção do helper do core é trabalho da Fase 1, sem efeito visível.
