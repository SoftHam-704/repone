# IRIS — Manutenção de Catálogo v1 (remover_itens + mesclar_itens) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dar à IRIS duas tools de manutenção de catálogo — `remover_itens` (inativar/reativar/excluir) e `mesclar_itens` (dedupe com merge de histórico) — no padrão prévia→confirma, resolvendo o caso ndsrep/CANAPARTS (.000).

**Architecture:** Cada tool é um handler `(db, input, user) => Promise<obj>` no padrão do `cadastrar-itens-tabela.ts` (2 fases: `confirmar=false` devolve prévia estruturada; `confirmar=true` grava em `db.transaction`). Helpers compartilhados (resolver indústria, normalizar código, checar movimento) ficam em `catalogo-shared.ts`. Registro em `tools/index.ts`; a IRIS é ensinada no `buildBlocoEstavel`. Guardrails: hard delete só sem movimento; merge re-aponta `itens_ped`; permissão por `levelOf(user.role)`.

**Tech Stack:** TypeScript, Node, PostgreSQL (multi-tenant, `req.db!`), Anthropic tools, vitest (testes determinísticos com db mockado).

**Princípios:** SEM achismo (só coordenadas exatas do REP); histórico sagrado.

---

## File Structure

- **Create** `backend/src/modules/iris/tools/catalogo-shared.ts` — `normCod`, `resolverIndustria(db, termo)`, `temMovimentoMap(db, proIds)`.
- **Create** `backend/src/modules/iris/tools/remover-itens.ts` — handler `removerItens`.
- **Create** `backend/src/modules/iris/tools/mesclar-itens.ts` — handler `mesclarItens`.
- **Create** `backend/src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts` — testes (vitest, db mock).
- **Modify** `backend/src/modules/iris/tools/index.ts` — registrar no `TOOLS_REGISTRY` + `TOOLS`.
- **Modify** `backend/src/modules/iris/iris-chat.controller.ts` — descrever as tools + regras no `buildBlocoEstavel`.
- **Modify** `backend/package.json` + **Create** `backend/vitest.config.ts` — runner de teste (se ainda não existir).

Contrato comum do `db` (igual cadastrar-itens-tabela): `db.query(sql, params) → { rows }` e `db.transaction(async (client) => {...})` onde `client.query` existe.

---

## Task 1: Garantir o runner de testes (vitest)

**Files:** Modify `backend/package.json`; Create `backend/vitest.config.ts`

- [ ] **Step 1: Verificar se já há vitest**

Run: `cd backend && node -e "console.log(require('./package.json').devDependencies?.vitest || 'AUSENTE')"`
Expected: imprime a versão OU `AUSENTE`.

- [ ] **Step 2: Se AUSENTE, instalar**

Run (só se ausente): `cd backend && npm install -D vitest@^2`
Expected: `added ... packages`.

- [ ] **Step 3: Criar/garantir a config (escopo nas tools da IRIS)**

Create `backend/vitest.config.ts` (se já existir do plano iris-core, só garanta que o include cobre o caminho abaixo):

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Garantir o script `test` no package.json**

Em `backend/package.json` → `"scripts"`, garanta: `"test": "vitest run"`.

- [ ] **Step 5: Rodar vazio**

Run: `cd backend && npm test`
Expected: vitest sobe (ok mesmo sem testes ainda).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts
git commit -m "chore(iris): vitest para as tools de manutenção"
```

---

## Task 2: Helpers compartilhados (`catalogo-shared.ts`)

**Files:** Create `backend/src/modules/iris/tools/catalogo-shared.ts`; Test `backend/src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`

- [ ] **Step 1: Escrever o teste dos helpers**

Create `backend/src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { normCod, resolverIndustria, temMovimentoMap } from '../catalogo-shared';

describe('normCod', () => {
  it('tira máscara e caixa', () => {
    expect(normCod('al-1010')).toBe('AL1010');
    expect(normCod(' 01.00126 ')).toBe('0100126');
  });
});

describe('resolverIndustria', () => {
  it('acha exata pelo nome reduzido', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ for_codigo: 7, for_nomered: 'CANAPARTS', for_nome: 'CANA' }] }) };
    const r = await resolverIndustria(db as any, 'CANAPARTS');
    expect(r.ok).toBe(true);
    expect((r as any).industria.for_codigo).toBe(7);
  });
  it('não achou → pede de novo', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const r = await resolverIndustria(db as any, 'XPTO');
    expect(r.ok).toBe(false);
  });
});

describe('temMovimentoMap', () => {
  it('marca quais pro_id têm pedido', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ ite_idproduto: 10 }] }) };
    const m = await temMovimentoMap(db as any, [10, 20]);
    expect(m.get(10)).toBe(true);
    expect(m.get(20)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — falha (módulo não existe)**

Run: `cd backend && npx vitest run src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`
Expected: FAIL — `Cannot find module '../catalogo-shared'`.

- [ ] **Step 3: Implementar os helpers**

Create `backend/src/modules/iris/tools/catalogo-shared.ts`:

```ts
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
```

- [ ] **Step 4: Rodar — passa**

Run: `cd backend && npx vitest run src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/iris/tools/catalogo-shared.ts backend/src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts
git commit -m "feat(iris): helpers de manutenção de catálogo (indústria/movimento)"
```

---

## Task 3: Tool `remover_itens`

**Files:** Create `backend/src/modules/iris/tools/remover-itens.ts`; Test (append no mesmo arquivo de teste)

Comportamento: resolve a indústria; seleciona os produtos por `codigos` (lista) OU `padrao` ({modo, valor}); na prévia lista o que casou + movimento; na execução aplica `inativar`/`reativar` (UPDATE pro_status) ou `excluir` (DELETE só dos SEM movimento). `excluir` exige Master.

- [ ] **Step 1: Escrever os testes do handler**

Append em `__tests__/manutencao-catalogo.test.ts`:

```ts
import { removerItens } from '../remover-itens';

function dbWith(rowsByCall: any[][]) {
  let i = 0;
  const query = vi.fn(async () => ({ rows: rowsByCall[i++] ?? [] }));
  const transaction = vi.fn(async (fn: any) => fn({ query }));
  return { query, transaction };
}
const IND = [{ for_codigo: 7, for_nomered: 'CANAPARTS', for_nome: 'CANA' }];
const MASTER = { role: 'admin' };
const GER = { role: 'manager' };

describe('removerItens', () => {
  it('prévia por padrão "termina em 000" lista os itens e quem tem movimento', async () => {
    // calls: resolverIndustria, SELECT alvo, temMovimentoMap
    const db = dbWith([
      IND,
      [{ pro_id: 1, pro_codprod: 'AL1010000', pro_nome: 'X', pro_status: true },
       { pro_id: 2, pro_codprod: 'AL2020000', pro_nome: 'Y', pro_status: true }],
      [{ ite_idproduto: 1 }], // pro 1 tem movimento
    ]);
    const r: any = await removerItens(db as any, { industria: 'CANAPARTS', padrao: { modo: 'termina', valor: '000' }, acao: 'excluir' }, GER);
    expect(r.previa).toBe(true);
    expect(r.total).toBe(2);
    expect(r.com_movimento).toBe(1);
  });

  it('excluir exige Master', async () => {
    const db = dbWith([IND, [{ pro_id: 2, pro_codprod: 'AL2020000', pro_nome: 'Y', pro_status: true }], []]);
    const r: any = await removerItens(db as any, { industria: 'CANAPARTS', codigos: ['AL2020000'], acao: 'excluir', confirmar: true }, GER);
    expect(r.erro).toMatch(/Master/i);
  });

  it('excluir (Master) apaga só os sem movimento', async () => {
    const db = dbWith([
      IND,
      [{ pro_id: 1, pro_codprod: 'A000', pro_nome: 'X', pro_status: true },
       { pro_id: 2, pro_codprod: 'B000', pro_nome: 'Y', pro_status: true }],
      [{ ite_idproduto: 1 }],          // pro 1 tem movimento → não exclui
      [],                               // DELETE (dentro da transação)
    ]);
    const r: any = await removerItens(db as any, { industria: 'CANAPARTS', padrao: { modo: 'termina', valor: '000' }, acao: 'excluir', confirmar: true }, MASTER);
    expect(r.ok).toBe(true);
    expect(r.excluidos).toBe(1);       // só o pro 2
    expect(r.preservados_com_movimento).toEqual(['A000']);
  });
});
```

- [ ] **Step 2: Rodar — falha (módulo não existe)**

Run: `cd backend && npx vitest run src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`
Expected: FAIL — `Cannot find module '../remover-itens'`.

- [ ] **Step 3: Implementar o handler**

Create `backend/src/modules/iris/tools/remover-itens.ts`:

```ts
import { levelOf, LEVEL } from '../../../shared/roles';
import { normCod, resolverIndustria, temMovimentoMap } from './catalogo-shared';

type Acao = 'inativar' | 'reativar' | 'excluir';

export async function removerItens(db: any, input: any, user: any) {
  const acao: Acao = ['inativar', 'reativar', 'excluir'].includes(input?.acao) ? input.acao : 'inativar';
  const confirmar = input?.confirmar === true;

  // Guardrail de permissão: excluir (hard delete) é só Master.
  if (acao === 'excluir' && levelOf(user?.role) < LEVEL.MASTER) {
    return { erro: 'permissao', mensagem: 'Excluir itens em definitivo é só pra perfil Master. Posso INATIVAR (some do catálogo, preserva o histórico) — quer assim?' };
  }

  const ind = await resolverIndustria(db, input?.industria);
  if (!ind.ok) return ind.resposta;
  const forId = ind.industria.for_codigo;

  // Seleção EXATA: lista de códigos OU padrão {modo, valor}. Sem isso, não age.
  const codigos: string[] = Array.isArray(input?.codigos) ? input.codigos.map((c: any) => String(c).trim()).filter(Boolean) : [];
  const padrao = input?.padrao && input.padrao.valor ? { modo: String(input.padrao.modo || 'igual'), valor: String(input.padrao.valor) } : null;
  if (codigos.length === 0 && !padrao) {
    return { precisa: 'criterio', mensagem: 'Me diga EXATAMENTE quais itens: uma lista de códigos, ou um padrão (ex.: código terminado em "000"). Não removo nada no escuro.' };
  }

  // Monta o filtro sobre o código normalizado (sem máscara/caixa).
  const params: any[] = [forId];
  const canon = `regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g')`;
  let filtro: string;
  if (codigos.length > 0) {
    params.push(codigos.map((c) => normCod(c)));
    filtro = `${canon} = ANY($2::text[])`;
  } else {
    const v = normCod(padrao!.valor);
    params.push(v);
    filtro = padrao!.modo === 'termina' ? `${canon} LIKE '%' || $2`
           : padrao!.modo === 'comeca'  ? `${canon} LIKE $2 || '%'`
           : padrao!.modo === 'contem'  ? `${canon} LIKE '%' || $2 || '%'`
           :                              `${canon} = $2`;
  }

  const prods = (await db.query(
    `SELECT pro_id, pro_codprod, pro_nome, pro_status FROM cad_prod
      WHERE pro_industria = $1 AND ${filtro} ORDER BY pro_codprod`, params)).rows;
  if (prods.length === 0) return { vazio: true, mensagem: `Nenhum item da ${ind.industria.for_nomered} bateu com esse critério.` };

  const mov = await temMovimentoMap(db, prods.map((p: any) => Number(p.pro_id)));
  const comMov = prods.filter((p: any) => mov.get(Number(p.pro_id)));

  // ── PRÉVIA ──
  if (!confirmar) {
    const lista = prods.slice(0, 30).map((p: any) => p.pro_codprod).join(', ') + (prods.length > 30 ? '…' : '');
    const verbo = acao === 'inativar' ? 'INATIVAR' : acao === 'reativar' ? 'REATIVAR' : 'EXCLUIR';
    let aviso = '';
    if (acao === 'excluir' && comMov.length)
      aviso = ` ⚠ ${comMov.length} têm pedido e NÃO serão excluídos (sugiro inativar esses): ${comMov.slice(0, 15).map((p: any) => p.pro_codprod).join(', ')}.`;
    return {
      previa: true, industria: ind.industria.for_nomered, acao,
      total: prods.length, com_movimento: comMov.length, itens: prods.map((p: any) => p.pro_codprod),
      mensagem: `Vou ${verbo} ${prods.length} item(ns) da ${ind.industria.for_nomered}: ${lista}.${aviso} Confirma?`,
    };
  }

  // ── EXECUÇÃO ──
  return db.transaction(async (client: any) => {
    if (acao === 'inativar' || acao === 'reativar') {
      const novo = acao === 'reativar';
      await client.query(`UPDATE cad_prod SET pro_status = $2 WHERE pro_id = ANY($1::int[])`, [prods.map((p: any) => Number(p.pro_id)), novo]);
      return { ok: true, acao, industria: ind.industria.for_nomered, afetados: prods.length,
        mensagem: `Pronto — ${prods.length} item(ns) ${novo ? 'reativados' : 'inativados'} na ${ind.industria.for_nomered}.` };
    }
    // excluir: só os SEM movimento
    const semMov = prods.filter((p: any) => !mov.get(Number(p.pro_id)));
    const ids = semMov.map((p: any) => Number(p.pro_id));
    if (ids.length) {
      await client.query(`DELETE FROM cad_tabelaspre WHERE itab_idprod = ANY($1::int[])`, [ids]);
      await client.query(`DELETE FROM cad_prod WHERE pro_id = ANY($1::int[])`, [ids]);
    }
    return { ok: true, acao: 'excluir', industria: ind.industria.for_nomered,
      excluidos: ids.length, preservados_com_movimento: comMov.map((p: any) => p.pro_codprod),
      mensagem: `Excluí ${ids.length} item(ns) sem movimento.` + (comMov.length ? ` ${comMov.length} com pedido foram preservados (use inativar/mesclar).` : '') };
  });
}
```

- [ ] **Step 4: Rodar — passa**

Run: `cd backend && npx vitest run src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`
Expected: PASS (todos os `removerItens`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/iris/tools/remover-itens.ts backend/src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts
git commit -m "feat(iris): tool remover_itens (inativar/reativar/excluir + guardrail de movimento)"
```

---

## Task 4: Tool `mesclar_itens`

**Files:** Create `backend/src/modules/iris/tools/mesclar-itens.ts`; Test (append)

Comportamento: Master only. Resolve pares EXPLÍCITOS `{de_codigo, para_codigo}` OU regra `{remover_sufixo}` (de = código com sufixo; para = código sem o sufixo). O `para` (original) tem que existir. Execução: re-aponta `itens_ped` do `de` pro `para`, remove o `de`.

- [ ] **Step 1: Escrever os testes**

Append em `__tests__/manutencao-catalogo.test.ts`:

```ts
import { mesclarItens } from '../mesclar-itens';

describe('mesclarItens', () => {
  it('exige Master', async () => {
    const db = { query: vi.fn(), transaction: vi.fn() };
    const r: any = await mesclarItens(db as any, { industria: 'CANAPARTS', pares: [{ de_codigo: 'A000', para_codigo: 'A' }] }, { role: 'manager' });
    expect(r.erro).toMatch(/Master/i);
  });

  it('prévia mostra o par resolvido e nº de pedidos a re-apontar', async () => {
    // calls: resolverIndustria, SELECT de, SELECT para, COUNT pedidos do de
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ for_codigo: 7, for_nomered: 'CANAPARTS', for_nome: 'C' }] })
        .mockResolvedValueOnce({ rows: [{ pro_id: 11, pro_codprod: 'A000' }] })
        .mockResolvedValueOnce({ rows: [{ pro_id: 1, pro_codprod: 'A' }] })
        .mockResolvedValueOnce({ rows: [{ n: '5' }] }),
      transaction: vi.fn(),
    };
    const r: any = await mesclarItens(db as any, { industria: 'CANAPARTS', pares: [{ de_codigo: 'A000', para_codigo: 'A' }] }, { role: 'admin' });
    expect(r.previa).toBe(true);
    expect(r.pares[0]).toMatchObject({ de: 'A000', para: 'A', pedidos: 5 });
  });

  it('original inexistente → recusa (não é merge)', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ for_codigo: 7, for_nomered: 'CANAPARTS', for_nome: 'C' }] })
        .mockResolvedValueOnce({ rows: [{ pro_id: 11, pro_codprod: 'A000' }] })
        .mockResolvedValueOnce({ rows: [] }),  // para não existe
      transaction: vi.fn(),
    };
    const r: any = await mesclarItens(db as any, { industria: 'CANAPARTS', pares: [{ de_codigo: 'A000', para_codigo: 'A' }] }, { role: 'admin' });
    expect(r.erro || r.recusados?.length).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `cd backend && npx vitest run src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`
Expected: FAIL — `Cannot find module '../mesclar-itens'`.

- [ ] **Step 3: Implementar o handler**

Create `backend/src/modules/iris/tools/mesclar-itens.ts`:

```ts
import { levelOf, LEVEL } from '../../../shared/roles';
import { normCod, resolverIndustria } from './catalogo-shared';

// Resolve um produto da indústria pelo código (normalizado). Retorna {pro_id, pro_codprod} ou null.
async function acharProduto(db: any, forId: number, codigo: string) {
  const r = await db.query(
    `SELECT pro_id, pro_codprod FROM cad_prod
      WHERE pro_industria = $1 AND regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g') = $2
      LIMIT 1`, [forId, normCod(codigo)]);
  return r.rows[0] || null;
}

export async function mesclarItens(db: any, input: any, user: any) {
  // Mesclar mexe no histórico → só Master.
  if (levelOf(user?.role) < LEVEL.MASTER)
    return { erro: 'permissao', mensagem: 'Mesclar itens (mexe no histórico de pedidos) é só pra perfil Master.' };

  const confirmar = input?.confirmar === true;
  const ind = await resolverIndustria(db, input?.industria);
  if (!ind.ok) return ind.resposta;
  const forId = ind.industria.for_codigo;

  // Pares EXPLÍCITOS ou regra de sufixo. Sem isso, não age (anti-achismo).
  let paresIn: { de_codigo: string; para_codigo: string }[] = [];
  if (Array.isArray(input?.pares) && input.pares.length) {
    paresIn = input.pares.map((p: any) => ({ de_codigo: String(p.de_codigo ?? p.de ?? '').trim(), para_codigo: String(p.para_codigo ?? p.para ?? '').trim() }))
      .filter((p: { de_codigo: string; para_codigo: string }) => p.de_codigo && p.para_codigo);
  } else if (input?.regra?.remover_sufixo) {
    const suf = normCod(input.regra.remover_sufixo);
    const dups = (await db.query(
      `SELECT pro_codprod FROM cad_prod
        WHERE pro_industria = $1 AND regexp_replace(upper(trim(pro_codprod)), '[^A-Z0-9]', '', 'g') LIKE '%' || $2`,
      [forId, suf])).rows;
    paresIn = dups.map((d: any) => {
      const canon = normCod(d.pro_codprod);
      return { de_codigo: d.pro_codprod, para_codigo: canon.slice(0, canon.length - suf.length) };
    }).filter((p: { de_codigo: string; para_codigo: string }) => p.para_codigo);
  }
  if (paresIn.length === 0)
    return { precisa: 'pares', mensagem: 'Me diga EXATAMENTE o que mesclar: os pares (duplicado → original) ou uma regra (ex.: remover o sufixo "000"). Não pareio no chute.' };

  // Resolve cada par (de e para devem existir; senão recusa).
  const pares: any[] = [];
  const recusados: string[] = [];
  for (const p of paresIn) {
    const de = await acharProduto(db, forId, p.de_codigo);
    if (!de) { recusados.push(`${p.de_codigo} (duplicado não encontrado)`); continue; }
    const para = await acharProduto(db, forId, p.para_codigo);
    if (!para) { recusados.push(`${p.de_codigo} → ${p.para_codigo} (original não existe — isso é renomear, use editar_item)`); continue; }
    if (Number(de.pro_id) === Number(para.pro_id)) { recusados.push(`${p.de_codigo} (mesmo item)`); continue; }
    const cnt = Number((await db.query(`SELECT COUNT(*)::int n FROM itens_ped WHERE ite_idproduto = $1`, [de.pro_id])).rows[0].n);
    pares.push({ de: de.pro_codprod, para: para.pro_codprod, de_id: Number(de.pro_id), para_id: Number(para.pro_id), para_cod: para.pro_codprod, pedidos: cnt });
  }
  if (pares.length === 0)
    return { erro: 'sem_pares_validos', recusados, mensagem: `Nenhum par válido pra mesclar. ${recusados.join('; ')}.` };

  // ── PRÉVIA ──
  if (!confirmar) {
    const totalPed = pares.reduce((s, x) => s + x.pedidos, 0);
    return {
      previa: true, industria: ind.industria.for_nomered, pares,
      recusados,
      mensagem: `Vou mesclar ${pares.length} duplicado(s) na ${ind.industria.for_nomered}, re-apontando ${totalPed} pedido(s) e removendo os duplicados: ` +
        pares.slice(0, 15).map((x) => `${x.de}→${x.para}`).join(', ') +
        (recusados.length ? ` (recusados: ${recusados.length}).` : '.') + ` Confirma?`,
    };
  }

  // ── EXECUÇÃO (atômica) ──
  return db.transaction(async (client: any) => {
    let pedidosMig = 0;
    for (const x of pares) {
      const up = await client.query(
        `UPDATE itens_ped SET ite_idproduto = $1, ite_produto = $2 WHERE ite_idproduto = $3`,
        [x.para_id, x.para_cod, x.de_id]);
      pedidosMig += up.rowCount ?? 0;
      await client.query(`DELETE FROM cad_tabelaspre WHERE itab_idprod = $1`, [x.de_id]);
      await client.query(`DELETE FROM cad_prod WHERE pro_id = $1`, [x.de_id]);
    }
    return { ok: true, industria: ind.industria.for_nomered, mesclados: pares.length, pedidos_reapontados: pedidosMig, recusados,
      mensagem: `Pronto — ${pares.length} duplicado(s) mesclado(s), ${pedidosMig} pedido(s) re-apontados na ${ind.industria.for_nomered}.` };
  });
}
```

- [ ] **Step 4: Rodar — passa**

Run: `cd backend && npx vitest run src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/iris/tools/mesclar-itens.ts backend/src/modules/iris/tools/__tests__/manutencao-catalogo.test.ts
git commit -m "feat(iris): tool mesclar_itens (dedupe re-apontando itens_ped)"
```

---

## Task 5: Registrar no `index.ts`

**Files:** Modify `backend/src/modules/iris/tools/index.ts`

- [ ] **Step 1: Importar e registrar no `TOOLS_REGISTRY`**

No topo, adicione os imports:
```ts
import { removerItens } from './remover-itens';
import { mesclarItens } from './mesclar-itens';
```
Dentro de `TOOLS_REGISTRY`, adicione:
```ts
  remover_itens:  removerItens,
  mesclar_itens:  mesclarItens,
```

- [ ] **Step 2: Adicionar as definições no array `TOOLS`** (schema Anthropic)

Adicione ao final do array `TOOLS`:
```ts
  {
    name: 'remover_itens',
    description:
      'ESCRITA — Inativa, reativa ou exclui itens do CATÁLOGO de UMA indústria. SEMPRE 2 passos: confirmar=false (PRÉVIA, mostra a lista exata) → mostre ao REP e peça "confirma?"; confirmar=true grava. NUNCA infira o alvo: o REP DEVE dar os códigos (lista) OU um padrão (ex.: termina em "000"). acao=inativar (some do catálogo/pedidos/portal, preserva histórico — REVERSÍVEL via reativar) é o padrão seguro; acao=excluir (apaga de vez) só funciona em item SEM pedido e é só pra Master — com pedido, oriente inativar.',
    input_schema: {
      type: 'object',
      properties: {
        industria: { type: 'string', description: 'Nome reduzido da indústria. Obrigatório.' },
        codigos:   { type: 'array', items: { type: 'string' }, description: 'Lista exata de códigos a remover (use OU padrao).' },
        padrao:    { type: 'object', description: 'Critério por padrão de código (use OU codigos).',
          properties: { modo: { type: 'string', enum: ['igual', 'comeca', 'termina', 'contem'] }, valor: { type: 'string' } } },
        acao:      { type: 'string', enum: ['inativar', 'reativar', 'excluir'], description: 'inativar (padrão) | reativar | excluir.' },
        confirmar: { type: 'boolean', description: 'false (default) = prévia; true = grava (após o REP confirmar).' },
      },
      required: ['industria', 'acao'],
    },
  },
  {
    name: 'mesclar_itens',
    description:
      'ESCRITA (só Master) — DEDUPLICA itens do catálogo: re-aponta o histórico de pedidos do DUPLICADO para o ORIGINAL e remove o duplicado. SEMPRE 2 passos (prévia→confirma). NUNCA pareie no chute: o REP DEVE dar os pares exatos {de_codigo (duplicado), para_codigo (original)} OU uma regra (ex.: remover o sufixo "000" do código pra achar o original). O ORIGINAL tem que existir; se não existir, é renomear (use editar_item), não mesclar.',
    input_schema: {
      type: 'object',
      properties: {
        industria: { type: 'string', description: 'Nome reduzido da indústria. Obrigatório.' },
        pares:     { type: 'array', description: 'Pares exatos duplicado→original.',
          items: { type: 'object', properties: { de_codigo: { type: 'string' }, para_codigo: { type: 'string' } }, required: ['de_codigo', 'para_codigo'] } },
        regra:     { type: 'object', description: 'Alternativa: regra de derivação do original.',
          properties: { remover_sufixo: { type: 'string', description: 'Sufixo do código do duplicado a remover pra achar o original (ex.: "000").' } } },
        confirmar: { type: 'boolean', description: 'false (default) = prévia; true = grava.' },
      },
      required: ['industria'],
    },
  },
```

- [ ] **Step 2b: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/iris/tools/index.ts
git commit -m "feat(iris): registra remover_itens e mesclar_itens no tool registry"
```

---

## Task 6: Ensinar a IRIS (prompt) + regras

**Files:** Modify `backend/src/modules/iris/iris-chat.controller.ts`

- [ ] **Step 1: Acrescentar a descrição das tools no `buildBlocoEstavel`**

Na seção que lista as ferramentas (depois das de consulta), adicione o bloco abaixo (texto literal dentro da template string do `buildBlocoEstavel`):

```
## Manutenção de catálogo (ESCRITA — com prévia e confirmação)
- **remover_itens** — inativar / reativar / excluir itens do catálogo de uma indústria.
- **mesclar_itens** — deduplicar (junta o histórico do duplicado no original e remove o duplicado). Só Master.

REGRAS DE OURO da manutenção:
1. SEMPRE 2 passos: chame com confirmar=false, MOSTRE a prévia (a lista exata que bateu) e pergunte "confirma?"; só com o "sim" chame confirmar=true.
2. NUNCA infira o alvo nem o par. Aja só sobre o que o REP especificou (lista de códigos, padrão, ou pares). Pedido vago ("limpa o catálogo") → peça a regra exata.
3. "Excluir" apaga de vez e só funciona em item SEM pedido (e só Master). Item com pedido → ofereça INATIVAR (some de tudo, preserva histórico) ou MESCLAR.
4. Não tem ferramenta pro que pediram → registrar_lacuna.
```

- [ ] **Step 2: Typecheck + build**

Run: `cd backend && npx tsc --noEmit && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/iris/iris-chat.controller.ts
git commit -m "feat(iris): ensina remover_itens/mesclar_itens no prompt (regras anti-achismo)"
```

---

## Task 7: Aceite ao vivo — ndsrep / CANAPARTS

**Files:** nenhum (verificação manual com a IRIS real, tenant ndsrep)

- [ ] **Step 1: Rodar a suíte toda**

Run: `cd backend && npm test`
Expected: PASS em todos os testes de manutenção.

- [ ] **Step 2: Prévia de inativação (sem gravar)**

Pela IRIS (tenant ndsrep, perfil Gerência+): *"inativa os itens da CANAPARTS com código terminado em 000"*.
Expected: a IRIS chama `remover_itens` com `padrao={modo:'termina',valor:'000'}`, `confirmar=false`; responde com a **lista exata** dos `.000` e pede confirmação. NÃO grava.

- [ ] **Step 3: Confirmar a inativação**

Responder "confirma".
Expected: `confirmar=true`; os `.000` somem do catálogo/pedidos/portal (pro_status=false); histórico intacto. Conferir no catálogo que os `.000` sumiram e os sem-zero permaneceram.

- [ ] **Step 4: Caso merge (se houver .000 com pedido)**

*"mescla os itens da CANAPARTS terminados em 000 no mesmo código sem os 000"* (perfil Master).
Expected: prévia com os pares + nº de pedidos a re-apontar → confirma → histórico migra pro original, `.000` removidos. Conferir que o giro do item deixou de aparecer dividido.

- [ ] **Step 5: Commit de fechamento**

```bash
git commit --allow-empty -m "test(iris): aceite manutenção catálogo ndsrep/CANAPARTS — ok"
```

---

## Self-Review

**1. Cobertura do spec:** remover_itens (inativar/reativar/excluir + guardrail movimento) → Task 3 ✅; mesclar_itens (re-aponta itens_ped, remove dup, original obrigatório) → Task 4 ✅; registro → Task 5 ✅; prompt/regras anti-achismo → Task 6 ✅; permissão Gerência+/Master → Tasks 3,4 (levelOf) ✅; prévia→confirma → Tasks 3,4 ✅; teste ndsrep → Task 7 ✅. **Fora de escopo (2º plano):** editar_item, remover_item_da_tabela, edição de preço por tabela — explicitado.

**2. Placeholders:** nenhum — todo step tem código/comando reais.

**3. Consistência de tipos:** `resolverIndustria` retorna `{ok:true,industria}` | `{ok:false,resposta}` e é consumido igual em remover/mesclar. `temMovimentoMap` → `Map<number,boolean>`. `normCod` usado igual nas 3 unidades. `levelOf/LEVEL` da `shared/roles` (MASTER=3). Tools `remover_itens`/`mesclar_itens` nomeadas igual no registry e nas defs.

**Nota de execução:** sem test runner hoje no backend → Task 1 garante o vitest (compartilhado com o plano iris-core). Os testes usam `db` mockado (sem banco real); o aceite real é manual no ndsrep (Task 7).
