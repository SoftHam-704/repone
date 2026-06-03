# Livro Caixa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o Livro Caixa (multi-conta, conta corrente com saldo calculado e passagem de saldo mensal) no Financeiro, integrado às baixas do Contas a Pagar/Receber, e adicionar split sem/com imposto + teto mensal configurável (só avisa) na baixa do Contas a Pagar.

**Architecture:** Backend Express/TS multi-tenant (`req.db!`, `db.transaction`); novo módulo `livro-caixa` (controller + routes) montado em `/api/livro-caixa` com `requireLevel(LEVEL.GERENCIA)`. Saldos são sempre derivados (nada gravado por mês). As baixas geram lançamentos de caixa via helper compartilhado, e a destruição de parcelas pagas (no update/delete da conta) limpa os lançamentos. Frontend React (Vite) com uma página no padrão Areia+Navy do Financeiro.

**Tech Stack:** TypeScript, Express, PostgreSQL (schema-per-tenant), React 18 + Vite, lucide-react, axios (`api`).

**Spec:** `docs/superpowers/specs/2026-06-03-livro-caixa-design.md`

> **Sobre testes (leia antes de começar):** este repositório **não tem** runner de testes no backend (`backend/package.json` não tem script `test`/jest/vitest) e o frontend valida por `vite build`. Portanto, em vez de TDD com testes unitários, cada tarefa é verificada por:
> - **Backend:** `cd backend && npx tsc --noEmit` (zero erros) + uma query SQL de verificação executada manualmente (descrita na tarefa) quando há lógica de dados.
> - **Frontend:** `npx vite build` na raiz (build sem erros).
> Não crie framework de teste novo. Não rode o servidor nem migrations em produção — Hamilton roda as migrations no pgAdmin (`basesales`).

> **Regras da casa (não-negociáveis):**
> - Migrations: SQL idempotente para **pgAdmin**, em loop nos schemas dos tenants. Nunca Node.
> - Nunca `git add -A` — staje só os arquivos da tarefa (a árvore tem MUITO WIP não relacionado).
> - Toda query usa `req.db!` (pool do tenant). Transações via `db.transaction(async client => …)`.
> - Colunas NUMERIC voltam como **string** do pg → coerça com `Number()` antes de devolver/usar.
> - Valor do lançamento de caixa numa baixa = `valor_pago + juros` (CP) / `valor_recebido + juros` (CR). Desconto **não** entra no caixa.

---

## File Structure

**Backend (novos):**
- `backend/migrations/063_livro_caixa_tables.sql` — 2 tabelas + índices.
- `backend/migrations/064_parcelas_pagar_imposto.sql` — ALTER `fin_parcelas_pagar` (valor_com/sem_imposto).
- `backend/migrations/065_empresa_status_teto_imposto.sql` — ALTER `empresa_status` (teto).
- `backend/src/modules/livro-caixa/livro-caixa.controller.ts` — handlers de contas, lançamentos, transferência, resumo, config + helpers `lancarBaixaNoCaixa`/`estornarBaixaDoCaixa`.
- `backend/src/modules/livro-caixa/livro-caixa.routes.ts` — rotas, `requireLevel(LEVEL.GERENCIA)`.

**Backend (modificados):**
- `backend/src/app.ts` — montar `/api/livro-caixa`.
- `backend/src/modules/financeiro/financeiro.controller.ts` — baixas geram lançamento; update/delete limpam; teto no baixaContaPagar.

**Frontend (novos):**
- `src/modules/financeiro/pages/LivroCaixaPage.tsx` — a página.

**Frontend (modificados):**
- `src/shared/lib/routeConfig.tsx` — lazy import + entrada de rota.
- `src/App.tsx` — `<Route path="/financeiro/livro-caixa" element={null} />`.
- `src/shared/components/layout/AppSidebar.tsx` — item de menu (minLevel 2).
- `src/modules/financeiro/pages/ContasPagarPage.tsx` — BaixaModal: seletor de caixa + campos sem/com imposto + aviso de teto.

---

## Task 1: Migrations (banco)

**Files:**
- Create: `backend/migrations/063_livro_caixa_tables.sql`
- Create: `backend/migrations/064_parcelas_pagar_imposto.sql`
- Create: `backend/migrations/065_empresa_status_teto_imposto.sql`

- [ ] **Step 1: Criar `063_livro_caixa_tables.sql`**

```sql
-- Migration 063: Livro Caixa — contas (caixa/banco/PIX) + lançamentos (conta corrente).
-- Saldo é sempre calculado (saldo_inicial + Σ lançamentos). Idempotente. Roda no basesales (pgAdmin).
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
     WHERE table_name = 'fin_plano_contas'
       AND table_schema NOT IN ('pg_catalog','information_schema','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.livro_caixa_contas (
        id                 SERIAL PRIMARY KEY,
        conta_nome         VARCHAR(100) NOT NULL,
        conta_tipo         VARCHAR(20)  NOT NULL DEFAULT 'caixa',
        saldo_inicial      NUMERIC(14,2) NOT NULL DEFAULT 0,
        data_saldo_inicial DATE         NOT NULL DEFAULT CURRENT_DATE,
        ativo              BOOLEAN      NOT NULL DEFAULT true,
        criado_em          TIMESTAMP    DEFAULT now()
      )$f$, s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.livro_caixa_lancamentos (
        id                SERIAL PRIMARY KEY,
        conta_id          INTEGER NOT NULL REFERENCES %I.livro_caixa_contas(id),
        data              DATE    NOT NULL,
        historico         TEXT    NOT NULL,
        tipo              CHAR(1) NOT NULL CHECK (tipo IN ('C','D')),
        valor             NUMERIC(14,2) NOT NULL CHECK (valor > 0),
        id_plano_contas   INTEGER NULL,
        id_centro_custo   INTEGER NULL,
        documento         VARCHAR(60) NULL,
        origem            CHAR(2) NOT NULL DEFAULT 'MA',
        id_parcela_origem INTEGER NULL,
        id_transferencia  INTEGER NULL,
        criado_em         TIMESTAMP DEFAULT now()
      )$f$, s, s);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_lc_lanc_conta_data ON %I.livro_caixa_lancamentos (conta_id, data, id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_lc_lanc_origem ON %I.livro_caixa_lancamentos (origem, id_parcela_origem)', s);
    RAISE NOTICE 'Schema % — livro_caixa pronto.', s;
  END LOOP;
END $$;
```

- [ ] **Step 2: Criar `064_parcelas_pagar_imposto.sql`**

```sql
-- Migration 064: split sem/com imposto na baixa do Contas a Pagar (reforma tributária).
-- Metadado fiscal por parcela; acumulado do mês é derivado por SUM. Idempotente. pgAdmin / basesales.
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
     WHERE table_name = 'fin_parcelas_pagar'
       AND table_schema NOT IN ('pg_catalog','information_schema','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format('ALTER TABLE %I.fin_parcelas_pagar ADD COLUMN IF NOT EXISTS valor_com_imposto NUMERIC(14,2) DEFAULT 0', s);
    EXECUTE format('ALTER TABLE %I.fin_parcelas_pagar ADD COLUMN IF NOT EXISTS valor_sem_imposto NUMERIC(14,2) DEFAULT 0', s);
    RAISE NOTICE 'Schema % — fin_parcelas_pagar imposto ok.', s;
  END LOOP;
END $$;
```

- [ ] **Step 3: Criar `065_empresa_status_teto_imposto.sql`**

```sql
-- Migration 065: teto mensal de pagamento "com imposto" por empresa (configurável).
-- 0 (default) = recurso desligado → não afeta os demais reps. Idempotente. pgAdmin / basesales.
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
     WHERE table_name = 'empresa_status'
       AND table_schema NOT IN ('pg_catalog','information_schema','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format('ALTER TABLE %I.empresa_status ADD COLUMN IF NOT EXISTS emp_teto_com_imposto_mensal NUMERIC(14,2) DEFAULT 0', s);
    EXECUTE format('UPDATE %I.empresa_status SET emp_teto_com_imposto_mensal = 0 WHERE emp_teto_com_imposto_mensal IS NULL', s);
    RAISE NOTICE 'Schema % — teto com imposto ok.', s;
  END LOOP;
END $$;
```

- [ ] **Step 4: Sanidade (não executar em produção — só revisar)**

Confira: os 3 arquivos usam `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`, fazem loop nos schemas de tenant (excluindo `public`), e não têm `DROP`. Hamilton roda no pgAdmin.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/063_livro_caixa_tables.sql backend/migrations/064_parcelas_pagar_imposto.sql backend/migrations/065_empresa_status_teto_imposto.sql
git commit -m "feat(financeiro): migrations do Livro Caixa + imposto/teto (063-065)"
```

---

## Task 2: Backend — contas CRUD + resumo + config

**Files:**
- Create: `backend/src/modules/livro-caixa/livro-caixa.controller.ts`

- [ ] **Step 1: Criar o controller com header, helper de erro e os handlers de CONTAS, RESUMO e CONFIG**

```ts
import { Request, Response } from 'express';

// ─── helpers ─────────────────────────────────────────────────────────────────
function err(res: Response, e: any, ctx = '') {
  console.error(`❌ [LIVRO-CAIXA]${ctx ? ' ' + ctx : ''}:`, e?.message ?? e);
  res.status(500).json({ success: false, message: e?.message ?? 'Erro interno' });
}

// ════════════════════════════════════════════════════════════════════
// CONTAS (caixa / banco / pix)
// ════════════════════════════════════════════════════════════════════

// GET /contas — lista contas ativas com saldo atual (saldo_inicial + Σ lançamentos)
export async function listContasCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`
      SELECT c.id, c.conta_nome, c.conta_tipo, c.saldo_inicial, c.data_saldo_inicial, c.ativo,
        (c.saldo_inicial + COALESCE((
          SELECT SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
          FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id
        ), 0)) AS saldo_atual
      FROM livro_caixa_contas c
      WHERE c.ativo = true
      ORDER BY c.conta_nome
    `);
    const data = r.rows.map((x: any) => ({
      ...x,
      saldo_inicial: Number(x.saldo_inicial),
      saldo_atual: Number(x.saldo_atual),
    }));
    res.json({ success: true, data });
  } catch (e) { err(res, e, 'list contas'); }
}

// POST /contas
export async function createContaCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { conta_nome, conta_tipo, saldo_inicial, data_saldo_inicial } = req.body;
    if (!conta_nome || !String(conta_nome).trim()) {
      res.status(400).json({ success: false, message: 'Nome da conta é obrigatório.' }); return;
    }
    const r = await db.query(`
      INSERT INTO livro_caixa_contas (conta_nome, conta_tipo, saldo_inicial, data_saldo_inicial)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [String(conta_nome).trim(), conta_tipo || 'caixa', Number(saldo_inicial) || 0,
        data_saldo_inicial || new Date().toISOString().split('T')[0]]);
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'create conta'); }
}

// PUT /contas/:id
export async function updateContaCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { conta_nome, conta_tipo, saldo_inicial, data_saldo_inicial, ativo } = req.body;
    const r = await db.query(`
      UPDATE livro_caixa_contas
      SET conta_nome=$1, conta_tipo=$2, saldo_inicial=$3, data_saldo_inicial=$4, ativo=$5
      WHERE id=$6 RETURNING *
    `, [String(conta_nome).trim(), conta_tipo || 'caixa', Number(saldo_inicial) || 0,
        data_saldo_inicial, ativo !== false, id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada.' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'update conta'); }
}

// DELETE /contas/:id — inativa se tiver lançamento, senão exclui de fato
export async function deleteContaCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const usos = await db.query('SELECT COUNT(*)::int AS n FROM livro_caixa_lancamentos WHERE conta_id=$1', [id]);
    if (usos.rows[0].n > 0) {
      await db.query('UPDATE livro_caixa_contas SET ativo=false WHERE id=$1', [id]);
      res.json({ success: true, message: 'Conta inativada (possui lançamentos).' }); return;
    }
    await db.query('DELETE FROM livro_caixa_contas WHERE id=$1', [id]);
    res.json({ success: true, message: 'Conta excluída.' });
  } catch (e) { err(res, e, 'delete conta'); }
}

// ════════════════════════════════════════════════════════════════════
// RESUMO + CONFIG
// ════════════════════════════════════════════════════════════════════

// GET /resumo — saldo de cada conta ativa + total geral
export async function resumoCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`
      SELECT c.id, c.conta_nome, c.conta_tipo,
        (c.saldo_inicial + COALESCE((
          SELECT SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
          FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id
        ), 0)) AS saldo_atual
      FROM livro_caixa_contas c WHERE c.ativo = true ORDER BY c.conta_nome
    `);
    const contas = r.rows.map((x: any) => ({ ...x, saldo_atual: Number(x.saldo_atual) }));
    const total = contas.reduce((s: number, x: any) => s + x.saldo_atual, 0);
    res.json({ success: true, data: { contas, total } });
  } catch (e) { err(res, e, 'resumo'); }
}

// GET /config — teto mensal de imposto + acumulado do mês atual (p/ a baixa do Contas a Pagar)
export async function configCaixaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const cfg = await db.query('SELECT COALESCE(emp_teto_com_imposto_mensal,0) AS teto FROM empresa_status WHERE emp_id=1 LIMIT 1');
    const teto = Number(cfg.rows[0]?.teto || 0);
    const acc = await db.query(`
      SELECT COALESCE(SUM(valor_com_imposto),0) AS acc
      FROM fin_parcelas_pagar
      WHERE status='PAGO'
        AND data_pagamento >= date_trunc('month', CURRENT_DATE)
        AND data_pagamento <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    `);
    res.json({ success: true, data: { teto_com_imposto_mensal: teto, acumulado_mes: Number(acc.rows[0].acc) } });
  } catch (e) { err(res, e, 'config'); }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros. (Os handlers ainda não estão referenciados em rotas — isso é a Task 5; `tsc --noEmit` valida o arquivo isolado mesmo assim.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/livro-caixa/livro-caixa.controller.ts
git commit -m "feat(livro-caixa): contas CRUD + resumo + config (teto imposto)"
```

---

## Task 3: Backend — lançamentos (listar com saldo, criar)

**Files:**
- Modify: `backend/src/modules/livro-caixa/livro-caixa.controller.ts` (acrescentar handlers)

- [ ] **Step 1: Acrescentar ao final do controller os handlers de listagem e criação de lançamentos**

```ts
// ════════════════════════════════════════════════════════════════════
// LANÇAMENTOS (conta corrente) — ordenados pela SEQUÊNCIA (id)
// ════════════════════════════════════════════════════════════════════

// Bloqueia lançamento retroativo: a data não pode ser anterior à última já lançada na conta
// (nem ao saldo inicial). Garante que ORDER BY id == ordem cronológica. Aceita db OU client.
// Retorna o "piso" (DD/MM/YYYY) quando é retroativo, senão null.
async function checkRetroativo(db: any, contaId: number, data: string): Promise<string | null> {
  const r = await db.query(`
    SELECT ($2::date < GREATEST(c.data_saldo_inicial,
              COALESCE((SELECT MAX(l.data) FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id), c.data_saldo_inicial))) AS retro,
           to_char(GREATEST(c.data_saldo_inicial,
              COALESCE((SELECT MAX(l.data) FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id), c.data_saldo_inicial)), 'DD/MM/YYYY') AS piso
    FROM livro_caixa_contas c WHERE c.id = $1
  `, [contaId, data]);
  return r.rows[0]?.retro ? (r.rows[0].piso as string) : null;
}

// GET /lancamentos?conta_id=&de=&ate=  → saldo anterior + KPIs + lançamentos (ordem = id/sequence)
export async function listLancamentosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const contaId = parseInt(String(req.query.conta_id));
    const de = String(req.query.de || '');   // YYYY-MM-DD
    const ate = String(req.query.ate || ''); // YYYY-MM-DD
    if (!Number.isFinite(contaId) || !de || !ate) {
      res.status(400).json({ success: false, message: 'conta_id, de e ate são obrigatórios.' }); return;
    }
    // saldo anterior = saldo_inicial + Σ lançamentos com data < de
    const ant = await db.query(`
      SELECT (c.saldo_inicial + COALESCE((
        SELECT SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
        FROM livro_caixa_lancamentos l WHERE l.conta_id = c.id AND l.data < $2
      ), 0)) AS saldo_anterior
      FROM livro_caixa_contas c WHERE c.id = $1
    `, [contaId, de]);
    if (!ant.rows.length) { res.status(404).json({ success: false, message: 'Conta não encontrada.' }); return; }
    const saldoAnterior = Number(ant.rows[0].saldo_anterior);

    // lançamentos do período ordenados pela SEQUÊNCIA (id). Sem retroativo → id == cronologia.
    const r = await db.query(`
      SELECT l.id, l.data, l.historico, l.tipo, l.valor, l.documento, l.origem,
             l.id_parcela_origem, l.id_transferencia,
             l.id_plano_contas, pc.descricao AS plano_descricao,
             l.id_centro_custo, cc.descricao AS centro_descricao,
             SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END)
               OVER (ORDER BY l.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS delta_acum
      FROM livro_caixa_lancamentos l
      LEFT JOIN fin_plano_contas pc ON pc.id = l.id_plano_contas
      LEFT JOIN fin_centro_custo  cc ON cc.id = l.id_centro_custo
      WHERE l.conta_id = $1 AND l.data >= $2 AND l.data <= $3
      ORDER BY l.id
    `, [contaId, de, ate]);

    let entradas = 0, saidas = 0;
    const lancamentos = r.rows.map((x: any) => {
      const v = Number(x.valor);
      if (x.tipo === 'C') entradas += v; else saidas += v;
      return { ...x, valor: v, saldo: saldoAnterior + Number(x.delta_acum) };
    });
    const saldoFinal = lancamentos.length ? lancamentos[lancamentos.length - 1].saldo : saldoAnterior;
    res.json({ success: true, data: {
      saldo_anterior: saldoAnterior, saldo_final: saldoFinal,
      total_entradas: entradas, total_saidas: saidas, resultado: entradas - saidas,
      lancamentos,
    } });
  } catch (e) { err(res, e, 'list lancamentos'); }
}

// POST /lancamentos — lançamento MANUAL (sem retroativo)
export async function createLancamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento } = req.body;
    const valorNum = Number(valor);
    if (!conta_id || !data || !historico || !String(historico).trim()) {
      res.status(400).json({ success: false, message: 'Conta, data e histórico são obrigatórios.' }); return;
    }
    if (tipo !== 'C' && tipo !== 'D') { res.status(400).json({ success: false, message: 'Tipo deve ser C ou D.' }); return; }
    if (!Number.isFinite(valorNum) || valorNum <= 0) { res.status(400).json({ success: false, message: 'Valor inválido.' }); return; }
    const piso = await checkRetroativo(db, Number(conta_id), data);
    if (piso) { res.status(400).json({ success: false, message: `Lançamento retroativo não permitido (anterior a ${piso}).` }); return; }
    const r = await db.query(`
      INSERT INTO livro_caixa_lancamentos
        (conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento, origem)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'MA') RETURNING id
    `, [conta_id, data, String(historico).trim(), tipo, valorNum,
        id_plano_contas || null, id_centro_custo || null, documento || null]);
    res.json({ success: true, message: 'Lançamento registrado.', id: r.rows[0].id });
  } catch (e) { err(res, e, 'create lancamento'); }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/livro-caixa/livro-caixa.controller.ts
git commit -m "feat(livro-caixa): listar lancamentos com saldo corrido + criar manual"
```

---

## Task 4: Backend — editar/excluir lançamento + transferência

**Files:**
- Modify: `backend/src/modules/livro-caixa/livro-caixa.controller.ts`

- [ ] **Step 1: Acrescentar os handlers de update, delete e transferência**

```ts
// PUT /lancamentos/:id — só lançamento MANUAL pode ser editado
export async function updateLancamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento } = req.body;
    const valorNum = Number(valor);
    if (tipo !== 'C' && tipo !== 'D') { res.status(400).json({ success: false, message: 'Tipo deve ser C ou D.' }); return; }
    if (!Number.isFinite(valorNum) || valorNum <= 0) { res.status(400).json({ success: false, message: 'Valor inválido.' }); return; }

    const cur = await db.query('SELECT origem FROM livro_caixa_lancamentos WHERE id=$1', [id]);
    if (!cur.rows.length) { res.status(404).json({ success: false, message: 'Lançamento não encontrado.' }); return; }
    if (cur.rows[0].origem !== 'MA') {
      res.status(400).json({ success: false, message: 'Lançamento de baixa/transferência não pode ser editado aqui. Use a conta a pagar/receber.' }); return;
    }
    await db.query(`
      UPDATE livro_caixa_lancamentos
      SET conta_id=$1, data=$2, historico=$3, tipo=$4, valor=$5, id_plano_contas=$6, id_centro_custo=$7, documento=$8
      WHERE id=$9
    `, [conta_id, data, String(historico).trim(), tipo, valorNum, id_plano_contas || null, id_centro_custo || null, documento || null, id]);
    res.json({ success: true, message: 'Lançamento atualizado.' });
  } catch (e) { err(res, e, 'update lancamento'); }
}

// DELETE /lancamentos/:id — manual: exclui; transferência: exclui o par; CP/CR: bloqueia
export async function deleteLancamentoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const cur = await db.query('SELECT origem, id_transferencia FROM livro_caixa_lancamentos WHERE id=$1', [id]);
    if (!cur.rows.length) { res.status(404).json({ success: false, message: 'Lançamento não encontrado.' }); return; }
    const { origem, id_transferencia } = cur.rows[0];
    if (origem === 'CP' || origem === 'CR') {
      res.status(400).json({ success: false, message: 'Lançamento de baixa: estorne pela conta a pagar/receber.' }); return;
    }
    if (origem === 'TR' && id_transferencia) {
      await db.query('DELETE FROM livro_caixa_lancamentos WHERE id_transferencia=$1', [id_transferencia]);
    } else {
      await db.query('DELETE FROM livro_caixa_lancamentos WHERE id=$1', [id]);
    }
    res.json({ success: true, message: 'Lançamento excluído.' });
  } catch (e) { err(res, e, 'delete lancamento'); }
}

// POST /transferencia — par vinculado (D na origem + C no destino)
export async function transferenciaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { conta_origem, conta_destino, valor, data, historico } = req.body;
    const valorNum = Number(valor);
    if (!conta_origem || !conta_destino) { res.status(400).json({ success: false, message: 'Contas de origem e destino são obrigatórias.' }); return; }
    if (conta_origem === conta_destino) { res.status(400).json({ success: false, message: 'Origem e destino devem ser diferentes.' }); return; }
    if (!data) { res.status(400).json({ success: false, message: 'Data é obrigatória.' }); return; }
    if (!Number.isFinite(valorNum) || valorNum <= 0) { res.status(400).json({ success: false, message: 'Valor inválido.' }); return; }
    const hist = (historico && String(historico).trim()) || 'Transferência entre contas';

    // Sem retroativo nas duas contas (checa antes da transação para devolver 400 limpo).
    for (const cid of [Number(conta_origem), Number(conta_destino)]) {
      const piso = await checkRetroativo(db, cid, data);
      if (piso) { res.status(400).json({ success: false, message: `Transferência retroativa não permitida (anterior a ${piso}).` }); return; }
    }

    await db.transaction(async client => {
      const deb = await client.query(`
        INSERT INTO livro_caixa_lancamentos (conta_id, data, historico, tipo, valor, origem)
        VALUES ($1,$2,$3,'D',$4,'TR') RETURNING id
      `, [conta_origem, data, hist, valorNum]);
      const tid = deb.rows[0].id;
      const cred = await client.query(`
        INSERT INTO livro_caixa_lancamentos (conta_id, data, historico, tipo, valor, origem, id_transferencia)
        VALUES ($1,$2,$3,'C',$4,'TR',$5) RETURNING id
      `, [conta_destino, data, hist, valorNum, tid]);
      await client.query('UPDATE livro_caixa_lancamentos SET id_transferencia=$1 WHERE id IN ($2,$3)', [tid, tid, cred.rows[0].id]);
    });
    res.json({ success: true, message: 'Transferência registrada.' });
  } catch (e) { err(res, e, 'transferencia'); }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/livro-caixa/livro-caixa.controller.ts
git commit -m "feat(livro-caixa): editar/excluir lancamento + transferencia entre contas"
```

---

## Task 5: Backend — rotas + montagem no app

**Files:**
- Create: `backend/src/modules/livro-caixa/livro-caixa.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Criar `livro-caixa.routes.ts`**

```ts
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  listContasCaixaHandler, createContaCaixaHandler, updateContaCaixaHandler, deleteContaCaixaHandler,
  resumoCaixaHandler, configCaixaHandler,
  listLancamentosHandler, createLancamentoHandler, updateLancamentoHandler, deleteLancamentoHandler,
  transferenciaHandler,
} from './livro-caixa.controller';

const router = Router();
// Livro Caixa: gerência+ (igual ao Financeiro). Master vê tudo.
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA));

router.get   ('/contas',         listContasCaixaHandler);
router.post  ('/contas',         createContaCaixaHandler);
router.put   ('/contas/:id',     updateContaCaixaHandler);
router.delete('/contas/:id',     deleteContaCaixaHandler);

router.get   ('/resumo',         resumoCaixaHandler);
router.get   ('/config',         configCaixaHandler);

router.get   ('/lancamentos',     listLancamentosHandler);
router.post  ('/lancamentos',     createLancamentoHandler);
router.put   ('/lancamentos/:id', updateLancamentoHandler);
router.delete('/lancamentos/:id', deleteLancamentoHandler);

router.post  ('/transferencia',   transferenciaHandler);

export default router;
```

- [ ] **Step 2: Montar em `app.ts`**

No bloco de imports de rotas (perto da linha 52, onde está `import financeiroRoutes`), adicionar:

```ts
import livroCaixaRoutes        from './modules/livro-caixa/livro-caixa.routes';
```

No bloco de `app.use(...)` (perto da linha 98, onde está `app.use('/api/financeiro', …)`), adicionar logo abaixo:

```ts
app.use('/api/livro-caixa',     livroCaixaRoutes);
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/livro-caixa/livro-caixa.routes.ts backend/src/app.ts
git commit -m "feat(livro-caixa): rotas + montagem em /api/livro-caixa"
```

---

## Task 6: Backend — baixa gera lançamento no caixa (CP + CR)

**Files:**
- Modify: `backend/src/modules/livro-caixa/livro-caixa.controller.ts` (helper exportado)
- Modify: `backend/src/modules/financeiro/financeiro.controller.ts` (baixaContaPagar, baixaContaReceber)

- [ ] **Step 1: Adicionar o helper `lancarBaixaNoCaixa` ao final do `livro-caixa.controller.ts`**

```ts
// ════════════════════════════════════════════════════════════════════
// HELPER usado pelo módulo financeiro (baixa → caixa). Recebe o `client`
// da transação aberta no handler de baixa, para tudo ser atômico.
// ════════════════════════════════════════════════════════════════════
export async function lancarBaixaNoCaixa(client: any, p: {
  conta_id: number; data: string; valor: number; tipo: 'C' | 'D';
  origem: 'CP' | 'CR'; id_parcela_origem: number; historico: string;
  id_plano_contas?: number | null; id_centro_custo?: number | null; documento?: string | null;
}): Promise<void> {
  await client.query(`
    INSERT INTO livro_caixa_lancamentos
      (conta_id, data, historico, tipo, valor, id_plano_contas, id_centro_custo, documento, origem, id_parcela_origem)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [p.conta_id, p.data, p.historico, p.tipo, p.valor,
      p.id_plano_contas ?? null, p.id_centro_custo ?? null, p.documento ?? null, p.origem, p.id_parcela_origem]);
}
```

- [ ] **Step 2: No `financeiro.controller.ts`, importar o helper no topo (após a linha 1)**

```ts
import { Request, Response } from 'express';
import { lancarBaixaNoCaixa } from '../livro-caixa/livro-caixa.controller';
```

- [ ] **Step 3: Em `baixaContaPagarHandler`, exigir `id_conta_caixa` e gerar o débito dentro da transação**

Trocar a desestruturação do body (linha ~438) para incluir o caixa:

```ts
    const { id_parcela, data_pagamento, valor_pago, juros = 0, desconto = 0, observacoes, gerar_residuo = true, id_conta_caixa } = req.body;
    if (!id_conta_caixa) { res.status(400).json({ success: false, message: 'Informe a conta de caixa do pagamento.' }); return; }
```

Dentro do `db.transaction(async client => { … })`, **após** o bloco que atualiza `fin_contas_pagar` (depois da linha ~470, antes de fechar a função da transação), adicionar:

```ts
      // Espelha o pagamento no Livro Caixa (débito). Dinheiro que saiu = valor_pago + juros.
      const cab = await client.query(
        'SELECT descricao, numero_documento, id_plano_contas, id_centro_custo FROM fin_contas_pagar WHERE id=$1', [id]);
      const c = cab.rows[0] || {};
      const histDoc = c.numero_documento ? ` • Doc ${c.numero_documento}` : '';
      await lancarBaixaNoCaixa(client, {
        conta_id: Number(id_conta_caixa),
        data: data_pagamento,
        valor: Number(valor_pago) + Number(juros),
        tipo: 'D', origem: 'CP', id_parcela_origem: Number(id_parcela),
        historico: `Pagto: ${c.descricao ?? 'conta a pagar'}${histDoc}`,
        id_plano_contas: c.id_plano_contas, id_centro_custo: c.id_centro_custo,
        documento: c.numero_documento ?? null,
      });
```

- [ ] **Step 4: Em `baixaContaReceberHandler` (linha ~681), fazer o análogo (crédito)**

Incluir `id_conta_caixa` no body e validar:

```ts
    const { id_parcela, data_recebimento, valor_recebido, juros = 0, desconto = 0, observacoes, gerar_residuo = true, id_conta_caixa } = req.body;
    if (!id_conta_caixa) { res.status(400).json({ success: false, message: 'Informe a conta de caixa do recebimento.' }); return; }
```

Dentro da transação, após atualizar `fin_contas_receber`:

```ts
      const cab = await client.query(
        'SELECT descricao, numero_documento, id_plano_contas, id_centro_custo FROM fin_contas_receber WHERE id=$1', [id]);
      const c = cab.rows[0] || {};
      const histDoc = c.numero_documento ? ` • Doc ${c.numero_documento}` : '';
      await lancarBaixaNoCaixa(client, {
        conta_id: Number(id_conta_caixa),
        data: data_recebimento,
        valor: Number(valor_recebido) + Number(juros),
        tipo: 'C', origem: 'CR', id_parcela_origem: Number(id_parcela),
        historico: `Receb: ${c.descricao ?? 'conta a receber'}${histDoc}`,
        id_plano_contas: c.id_plano_contas, id_centro_custo: c.id_centro_custo,
        documento: c.numero_documento ?? null,
      });
```

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/livro-caixa/livro-caixa.controller.ts backend/src/modules/financeiro/financeiro.controller.ts
git commit -m "feat(livro-caixa): baixa CP/CR gera lancamento no caixa (helper compartilhado)"
```

---

## Task 7: Backend — limpeza no update/delete + teto de imposto

**Files:**
- Modify: `backend/src/modules/financeiro/financeiro.controller.ts`

- [ ] **Step 1: Em `updateContaPagarHandler`, limpar lançamentos de caixa ANTES de regenerar parcelas**

Dentro da transação, **imediatamente antes** de `DELETE FROM fin_parcelas_pagar WHERE id_conta_pagar = $1` (linha ~397), adicionar:

```ts
      // As parcelas (inclusive pagas) serão apagadas e regeneradas → remove os lançamentos de caixa delas.
      await client.query(`
        DELETE FROM livro_caixa_lancamentos
        WHERE origem='CP' AND id_parcela_origem IN (SELECT id FROM fin_parcelas_pagar WHERE id_conta_pagar=$1)
      `, [id]);
```

- [ ] **Step 2: Em `deleteContaPagarHandler`, fazer o mesmo antes de excluir parcelas/conta**

Localizar o `deleteContaPagarHandler` (linha ~477) e, dentro da sua transação, antes do DELETE das parcelas/conta, adicionar o mesmo bloco:

```ts
      await client.query(`
        DELETE FROM livro_caixa_lancamentos
        WHERE origem='CP' AND id_parcela_origem IN (SELECT id FROM fin_parcelas_pagar WHERE id_conta_pagar=$1)
      `, [id]);
```

- [ ] **Step 3: Nos handlers equivalentes de RECEBER (`updateContaReceberHandler` e `deleteContaReceberHandler`), adicionar a limpeza com `origem='CR'` e `fin_parcelas_receber`/`id_conta_receber`**

```ts
      await client.query(`
        DELETE FROM livro_caixa_lancamentos
        WHERE origem='CR' AND id_parcela_origem IN (SELECT id FROM fin_parcelas_receber WHERE id_conta_receber=$1)
      `, [id]);
```

(Em cada um, antes do `DELETE FROM fin_parcelas_receber …` correspondente.)

- [ ] **Step 4: Teto de imposto no `baixaContaPagarHandler`**

a) Persistir o split na parcela: alterar o `UPDATE fin_parcelas_pagar` da baixa (linha ~442) para gravar os dois valores. Primeiro, ler do body (já na desestruturação da Task 6, acrescentar):

```ts
    const valor_com_imposto = Number(req.body.valor_com_imposto) || 0;
    const valor_sem_imposto = Number(req.body.valor_sem_imposto) || 0;
```

Trocar o UPDATE da parcela por:

```ts
      await client.query(`
        UPDATE fin_parcelas_pagar
        SET data_pagamento=$1, valor_pago=$2, juros=$3, desconto=$4, status='PAGO', observacoes=$5,
            valor_com_imposto=$7, valor_sem_imposto=$8
        WHERE id=$6
      `, [data_pagamento, valor_pago, juros, desconto, observacoes, id_parcela, valor_com_imposto, valor_sem_imposto]);
```

b) Após a transação (antes do `res.json` final, linha ~473), calcular o aviso de teto:

```ts
    // Aviso de teto "com imposto" do mês (só avisa, nunca trava). 0 = desligado.
    let aviso_teto_imposto: { teto: number; acumulado: number } | null = null;
    try {
      const cfg = await db.query('SELECT COALESCE(emp_teto_com_imposto_mensal,0) AS teto FROM empresa_status WHERE emp_id=1 LIMIT 1');
      const teto = Number(cfg.rows[0]?.teto || 0);
      if (teto > 0 && valor_com_imposto > 0) {
        const acc = await db.query(`
          SELECT COALESCE(SUM(valor_com_imposto),0) AS acc FROM fin_parcelas_pagar
          WHERE status='PAGO'
            AND data_pagamento >= date_trunc('month', $1::date)
            AND data_pagamento <  date_trunc('month', $1::date) + INTERVAL '1 month'
        `, [data_pagamento]);
        const acumulado = Number(acc.rows[0].acc);
        if (acumulado > teto) aviso_teto_imposto = { teto, acumulado };
      }
    } catch { /* config ausente → sem aviso */ }
```

Trocar o `res.json` final do handler por:

```ts
    res.json({ success: true, message: 'Pagamento registrado com sucesso', aviso_teto_imposto });
```

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/financeiro/financeiro.controller.ts
git commit -m "feat(livro-caixa): limpeza de lancamentos no update/delete + aviso de teto imposto"
```

---

## Task 8: Frontend — LivroCaixaPage

**Files:**
- Create: `src/modules/financeiro/pages/LivroCaixaPage.tsx`

> **Antes de escrever:** abra `src/modules/financeiro/pages/PlanoContasPage.tsx` e copie EXATAMENTE os tokens locais `G`, os helpers de estilo (`inputStyle`, `btnPrimary`, `btnSecondary`), `fmtBRL`, `todayISO`, e o import do `api`/`SearchCombobox`, para manter o visual idêntico (Areia+Navy). O código abaixo assume esses utilitários disponíveis no arquivo.

- [ ] **Step 1: Criar `LivroCaixaPage.tsx` com seletor de conta+mês, SALDO ANTERIOR, cards de resumo, tabela conta-corrente e os modais**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, X, BookOpen, Wallet, Trash2 } from 'lucide-react'
import { api } from '@/shared/lib/api'                 // confirmar o caminho real em PlanoContasPage
import { SearchCombobox } from '@/shared/components/ui/SearchCombobox'

// ── tokens (copiar de PlanoContasPage.tsx para casar 100%) ──────────────────
const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8', text: '#28374A',
  muted: '#7A8899', navy: '#1E2D3D', mustard: '#FFD200', green: '#059669', red: '#DC2626',
}
const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const todayISO = () => new Date().toISOString().split('T')[0]
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, color: G.text, background: '#fff', marginTop: 4 }
const btnPrimary = (c: string): React.CSSProperties => ({ background: c, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const btnSecondary: React.CSSProperties = { background: '#fff', color: G.text, border: `1px solid ${G.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }

interface ContaCaixa { id: number; conta_nome: string; conta_tipo: string; saldo_inicial: number; data_saldo_inicial: string; saldo_atual: number }
interface Lancamento { id: number; data: string; historico: string; tipo: 'C' | 'D'; valor: number; documento: string | null; origem: string; plano_descricao: string | null; centro_descricao: string | null; saldo: number }

export default function LivroCaixaPage() {
  const hoje = new Date()
  const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const hojeISO = hoje.toISOString().split('T')[0]
  const [contas, setContas] = useState<ContaCaixa[]>([])
  const [contaId, setContaId] = useState<number | null>(null)
  const [de, setDe] = useState(primeiroDia)
  const [ate, setAte] = useState(hojeISO)
  const [saldoAnterior, setSaldoAnterior] = useState(0)
  const [saldoFinal, setSaldoFinal] = useState(0)
  const [entradas, setEntradas] = useState(0)
  const [saidas, setSaidas] = useState(0)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(false)
  const [teto, setTeto] = useState(0)
  const [accImposto, setAccImposto] = useState(0)
  const [novo, setNovo] = useState(false)
  const [transf, setTransf] = useState(false)
  const [gerirContas, setGerirContas] = useState(false)

  async function loadContas() {
    const r = await api.get('/livro-caixa/contas')
    const cs: ContaCaixa[] = r.data.data
    setContas(cs)
    if (contaId == null && cs.length) setContaId(cs[0].id)
  }
  async function loadConfig() {
    try {
      const r = await api.get('/livro-caixa/config')
      setTeto(Number(r.data.data.teto_com_imposto_mensal) || 0)
      setAccImposto(Number(r.data.data.acumulado_mes) || 0)
    } catch { /* config opcional */ }
  }
  async function loadLancamentos() {
    if (contaId == null) { setLancamentos([]); setSaldoAnterior(0); setSaldoFinal(0); setEntradas(0); setSaidas(0); return }
    setLoading(true)
    try {
      const r = await api.get('/livro-caixa/lancamentos', { params: { conta_id: contaId, de, ate } })
      const d = r.data.data
      setSaldoAnterior(d.saldo_anterior); setSaldoFinal(d.saldo_final)
      setEntradas(d.total_entradas); setSaidas(d.total_saidas)
      setLancamentos(d.lancamentos)
    } finally { setLoading(false) }
  }
  useEffect(() => { loadContas(); loadConfig() }, [])         // eslint-disable-line
  useEffect(() => { loadLancamentos() }, [contaId, de, ate]) // eslint-disable-line

  const totalGeral = useMemo(() => contas.reduce((s, c) => s + c.saldo_atual, 0), [contas])

  function reload() { loadContas(); loadConfig(); loadLancamentos() }

  return (
    <div style={{ background: G.bg, minHeight: '100%', paddingBottom: 40 }}>
      {/* HERO */}
      <div style={{ background: G.navy, color: '#fff', padding: '24px 28px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <BookOpen size={22} color={G.mustard} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Livro Caixa</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 240 }}>
            <label style={{ fontSize: 11, color: '#B9C4D0' }}>Conta</label>
            <SearchCombobox
              value={contaId ? String(contaId) : ''}
              onChange={(v: string) => setContaId(v ? Number(v) : null)}
              options={contas.map(c => ({ value: String(c.id), label: `${c.conta_nome} — ${fmtBRL(c.saldo_atual)}` }))}
              placeholder="Selecione a conta"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#B9C4D0', display: 'block' }}>De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#B9C4D0', display: 'block' }}>Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setGerirContas(true)} style={btnSecondary}><Wallet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Contas</button>
          <button onClick={() => setTransf(true)} style={btnSecondary}><ArrowLeftRight size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Transferência</button>
          <button onClick={() => setNovo(true)} style={btnPrimary(G.mustard)}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Novo lançamento</button>
        </div>
      </div>

      {/* KPI strip — resultado do período + card do teto de imposto */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '0 28px', marginTop: -36 }}>
        <KpiCard label="Entradas no período" value={fmtBRL(entradas)} color={G.green} />
        <KpiCard label="Saídas no período" value={fmtBRL(saidas)} color={G.red} />
        <KpiCard label="Resultado do período" value={fmtBRL(entradas - saidas)} color={(entradas - saidas) < 0 ? G.red : G.text} />
        <KpiCard label="Saldo final" value={fmtBRL(saldoFinal)} color={saldoFinal < 0 ? G.red : G.text} strong />
        {teto > 0 && (
          <div style={{ background: accImposto > teto ? '#FEF2F2' : '#FEF9C3', border: `1px solid ${accImposto > teto ? G.red : '#FCD34D'}`, borderRadius: 10, padding: 16, minWidth: 230, boxShadow: '0 6px 18px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>Imposto no mês (teto)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: accImposto > teto ? G.red : '#92400E' }}>{fmtBRL(accImposto)} <span style={{ fontSize: 12, fontWeight: 500 }}>de {fmtBRL(teto)}</span></div>
            <div style={{ height: 6, background: 'rgba(0,0,0,.08)', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, teto ? (accImposto / teto) * 100 : 0)}%`, background: accImposto > teto ? G.red : G.mustard }} />
            </div>
            {accImposto > teto && <div style={{ fontSize: 11, color: G.red, marginTop: 4, fontWeight: 600 }}>⚠️ Teto ultrapassado</div>}
          </div>
        )}
      </div>

      {/* Saldo por conta */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '14px 28px 0' }}>
        {contas.map(c => (
          <div key={c.id} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 16px', minWidth: 160 }}>
            <div style={{ fontSize: 12, color: G.muted }}>{c.conta_nome}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.saldo_atual < 0 ? G.red : G.text }}>{fmtBRL(c.saldo_atual)}</div>
          </div>
        ))}
        <div style={{ background: G.text, color: '#fff', borderRadius: 10, padding: '12px 16px', minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#B9C4D0' }}>Total Geral</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtBRL(totalGeral)}</div>
        </div>
      </div>

      {/* SALDO ANTERIOR + tabela */}
      <div style={{ padding: '20px 28px' }}>
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F3EEE3', borderBottom: `1px solid ${G.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: G.muted }}>SALDO ANTERIOR (antes de {de.split('-').reverse().join('/')})</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: saldoAnterior < 0 ? G.red : G.text }}>{fmtBRL(saldoAnterior)}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAF7F0', color: G.muted, textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Seq</th>
                <th style={{ padding: '8px 12px' }}>Data</th>
                <th style={{ padding: '8px 12px' }}>Histórico</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Débito</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Crédito</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saldo</th>
                <th style={{ padding: '8px 12px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Carregando…</td></tr>}
              {!loading && lancamentos.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: G.muted }}>Sem lançamentos neste mês.</td></tr>}
              {!loading && lancamentos.map(l => {
                const isBaixa = l.origem === 'CP' || l.origem === 'CR'
                return (
                  <tr key={l.id} style={{ borderTop: `1px solid ${G.border}`, background: isBaixa ? '#FBFAF6' : '#fff' }}>
                    <td style={{ padding: '8px 12px', color: G.muted, fontVariantNumeric: 'tabular-nums' }}>{l.id}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{l.data.split('-').reverse().join('/')}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {l.historico}
                      {isBaixa && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: G.muted, border: `1px solid ${G.border}`, borderRadius: 4, padding: '1px 4px' }}>{l.origem}</span>}
                      {(l.plano_descricao || l.centro_descricao) && <span style={{ marginLeft: 6, fontSize: 11, color: G.muted }}>· {[l.plano_descricao, l.centro_descricao].filter(Boolean).join(' / ')}</span>}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: G.red }}>{l.tipo === 'D' ? fmtBRL(l.valor) : ''}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: G.green }}>{l.tipo === 'C' ? fmtBRL(l.valor) : ''}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: l.saldo < 0 ? G.red : G.text }}>{fmtBRL(l.saldo)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {!isBaixa && (
                        <button title="Excluir" onClick={async () => { if (confirm('Excluir este lançamento?')) { await api.delete(`/livro-caixa/lancamentos/${l.id}`); reload() } }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {novo && <NovoLancamentoModal contas={contas} contaInicial={contaId} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); reload() }} />}
      {transf && <TransferenciaModal contas={contas} onClose={() => setTransf(false)} onSaved={() => { setTransf(false); reload() }} />}
      {gerirContas && <ContasModal onClose={() => setGerirContas(false)} onChanged={reload} />}
    </div>
  )
}

// ── Modal: Novo lançamento manual ───────────────────────────────────────────
function NovoLancamentoModal({ contas, contaInicial, onClose, onSaved }: {
  contas: ContaCaixa[]; contaInicial: number | null; onClose: () => void; onSaved: () => void
}) {
  const [planos, setPlanos] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [form, setForm] = useState<any>({ conta_id: contaInicial ?? (contas[0]?.id ?? ''), data: todayISO(), tipo: 'D', valor: '', historico: '', id_plano_contas: '', id_centro_custo: '', documento: '' })
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  useEffect(() => {
    api.get('/financeiro/plano-contas').then(r => setPlanos(r.data.data)).catch(() => {})
    api.get('/financeiro/centro-custo').then(r => setCentros(r.data.data)).catch(() => {})
  }, [])
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/livro-caixa/lancamentos', {
        conta_id: Number(form.conta_id), data: form.data, tipo: form.tipo,
        valor: parseFloat(String(form.valor).replace(',', '.')), historico: form.historico,
        id_plano_contas: form.id_plano_contas || null, id_centro_custo: form.id_centro_custo || null,
        documento: form.documento || null,
      })
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }
  return (
    <ModalShell title="Novo lançamento" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
        <label style={lblStyle}>Conta
          <select value={form.conta_id} onChange={e => set('conta_id', e.target.value)} style={inputStyle}>
            {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Data<input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputStyle} /></label>
          <label style={lblStyle}>Tipo
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inputStyle}>
              <option value="D">Débito (saída)</option><option value="C">Crédito (entrada)</option>
            </select>
          </label>
        </div>
        <label style={lblStyle}>Valor<input value={form.valor} onChange={e => set('valor', e.target.value)} style={inputStyle} inputMode="decimal" placeholder="0,00" /></label>
        <label style={lblStyle}>Histórico<input value={form.historico} onChange={e => set('historico', e.target.value)} style={inputStyle} placeholder="Descrição do lançamento" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Plano de Contas
            <select value={form.id_plano_contas} onChange={e => set('id_plano_contas', e.target.value)} style={inputStyle}>
              <option value="">—</option>{planos.map(p => <option key={p.id} value={p.id}>{p.codigo} {p.descricao}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Centro de Custo
            <select value={form.id_centro_custo} onChange={e => set('id_centro_custo', e.target.value)} style={inputStyle}>
              <option value="">—</option>{centros.map(c => <option key={c.id} value={c.id}>{c.codigo} {c.descricao}</option>)}
            </select>
          </label>
        </div>
        <label style={lblStyle}>Documento<input value={form.documento} onChange={e => set('documento', e.target.value)} style={inputStyle} placeholder="NF, cheque…" /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={saving} style={btnPrimary(G.mustard)}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Modal: Transferência ────────────────────────────────────────────────────
function TransferenciaModal({ contas, onClose, onSaved }: { contas: ContaCaixa[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ conta_origem: contas[0]?.id ?? '', conta_destino: contas[1]?.id ?? '', valor: '', data: todayISO(), historico: '' })
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/livro-caixa/transferencia', {
        conta_origem: Number(form.conta_origem), conta_destino: Number(form.conta_destino),
        valor: parseFloat(String(form.valor).replace(',', '.')), data: form.data, historico: form.historico,
      })
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }
  return (
    <ModalShell title="Transferência entre contas" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>De
            <select value={form.conta_origem} onChange={e => set('conta_origem', e.target.value)} style={inputStyle}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Para
            <select value={form.conta_destino} onChange={e => set('conta_destino', e.target.value)} style={inputStyle}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lblStyle}>Valor<input value={form.valor} onChange={e => set('valor', e.target.value)} style={inputStyle} inputMode="decimal" placeholder="0,00" /></label>
          <label style={lblStyle}>Data<input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputStyle} /></label>
        </div>
        <label style={lblStyle}>Histórico<input value={form.historico} onChange={e => set('historico', e.target.value)} style={inputStyle} placeholder="Opcional" /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={saving} style={btnPrimary(G.text)}>{saving ? 'Salvando…' : 'Transferir'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Modal: Gerir contas ─────────────────────────────────────────────────────
function ContasModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [contas, setContas] = useState<ContaCaixa[]>([])
  const [form, setForm] = useState<any>({ conta_nome: '', conta_tipo: 'caixa', saldo_inicial: '', data_saldo_inicial: todayISO() })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  async function load() { const r = await api.get('/livro-caixa/contas'); setContas(r.data.data) }
  useEffect(() => { load() }, [])
  async function add(e: React.FormEvent) {
    e.preventDefault()
    await api.post('/livro-caixa/contas', { ...form, saldo_inicial: parseFloat(String(form.saldo_inicial || '0').replace(',', '.')) })
    setForm({ conta_nome: '', conta_tipo: 'caixa', saldo_inicial: '', data_saldo_inicial: todayISO() })
    load(); onChanged()
  }
  async function del(id: number) { if (confirm('Excluir/inativar esta conta?')) { await api.delete(`/livro-caixa/contas/${id}`); load(); onChanged() } }
  return (
    <ModalShell title="Contas de caixa" onClose={onClose}>
      <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 14 }}>
        <label style={lblStyle}>Nome<input value={form.conta_nome} onChange={e => set('conta_nome', e.target.value)} style={inputStyle} required /></label>
        <label style={lblStyle}>Tipo
          <select value={form.conta_tipo} onChange={e => set('conta_tipo', e.target.value)} style={inputStyle}>
            <option value="caixa">Caixa</option><option value="banco">Banco</option><option value="pix">PIX</option><option value="outro">Outro</option>
          </select>
        </label>
        <label style={lblStyle}>Saldo inicial<input value={form.saldo_inicial} onChange={e => set('saldo_inicial', e.target.value)} style={inputStyle} inputMode="decimal" placeholder="0,00" /></label>
        <button type="submit" style={btnPrimary(G.mustard)}>+ Add</button>
      </form>
      <div style={{ maxHeight: 240, overflow: 'auto' }}>
        {contas.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderTop: `1px solid ${G.border}` }}>
            <span>{c.conta_nome} <span style={{ color: G.muted, fontSize: 12 }}>· {c.conta_tipo} · inicial {fmtBRL(c.saldo_inicial)}</span></span>
            <button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </ModalShell>
  )
}

// ── Modal shell + label ─────────────────────────────────────────────────────
const lblStyle: React.CSSProperties = { fontSize: 12, color: G.muted, fontWeight: 500 }

function KpiCard({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <div style={{ background: G.card, border: `1px solid ${G.border}`, borderTop: strong ? `3px solid ${G.mustard}` : `1px solid ${G.border}`, borderRadius: 10, padding: 16, minWidth: 170, boxShadow: '0 6px 18px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 12, color: G.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 24, width: 480, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

> **Importante:** confirme os caminhos reais de import (`@/shared/lib/api` e `@/shared/components/ui/SearchCombobox`) abrindo `PlanoContasPage.tsx` — use exatamente os mesmos. Se `SearchCombobox` tiver outra assinatura de props, ajuste (o `<select>` nativo dos modais é o fallback aceitável, mas o seletor de conta no hero deve ser SearchCombobox por consistência).

- [ ] **Step 2: Build**

Run (na raiz do projeto): `npx vite build`
Expected: `built in …` sem erros de TypeScript/import.

- [ ] **Step 3: Commit**

```bash
git add src/modules/financeiro/pages/LivroCaixaPage.tsx
git commit -m "feat(livro-caixa): pagina LivroCaixaPage (conta corrente + modais)"
```

---

## Task 9: Frontend — registrar rota e menu

**Files:**
- Modify: `src/shared/lib/routeConfig.tsx`
- Modify: `src/App.tsx`
- Modify: `src/shared/components/layout/AppSidebar.tsx`

- [ ] **Step 1: `routeConfig.tsx` — lazy import (junto dos outros, ~linha 49) e entrada no mapa (~linha 116)**

Import (perto de `const CentroCustoPage = lazy(...)`):

```tsx
const LivroCaixaPage           = lazy(() => import('@/modules/financeiro/pages/LivroCaixaPage'))
```

Entrada no mapa de rotas (logo após a linha do `'/financeiro/pagar'`):

```tsx
  '/financeiro/livro-caixa':           { id: 'fin-livro-caixa', label: 'Livro Caixa', path: '/financeiro/livro-caixa', icon: BookOpen, element: <LivroCaixaPage /> },
```

Garanta que `BookOpen` está importado do `lucide-react` no topo do arquivo (adicione ao import existente se faltar).

- [ ] **Step 2: `App.tsx` — adicionar o stub de rota (junto das linhas 81-89)**

```tsx
          <Route path="/financeiro/livro-caixa" element={null} />
```

- [ ] **Step 3: `AppSidebar.tsx` — adicionar o item de menu (logo após "Contas a Pagar", ~linha 103) e importar o ícone**

```tsx
      { label: 'Livro Caixa',      path: '/financeiro/livro-caixa',            icon: BookOpen,        minLevel: 2 },
```

Adicione `BookOpen` ao import de `lucide-react` no topo do `AppSidebar.tsx` se ainda não estiver lá.

- [ ] **Step 4: Build**

Run: `npx vite build`
Expected: build sem erros; a rota `/financeiro/livro-caixa` resolve para `LivroCaixaPage`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/routeConfig.tsx src/App.tsx src/shared/components/layout/AppSidebar.tsx
git commit -m "feat(livro-caixa): registrar rota e item de menu (gerencia+)"
```

---

## Task 10: Frontend — baixa do Contas a Pagar (caixa + imposto + aviso)

**Files:**
- Modify: `src/modules/financeiro/pages/ContasPagarPage.tsx` (BaixaModal, ~linha 581-657)
- Modify: `src/modules/financeiro/pages/ContasReceberPage.tsx` (BaixaModal análogo — só o seletor de caixa, sem imposto)

- [ ] **Step 1: No `BaixaModal` do Contas a Pagar, carregar contas de caixa e config de teto + ampliar o form**

Logo após o `const [form, setForm] = useState({...})` (linha ~584), acrescentar estados e efeitos:

```tsx
  const [contasCaixa, setContasCaixa] = useState<{ id: number; conta_nome: string }[]>([])
  const [teto, setTeto] = useState(0)
  const [accMes, setAccMes] = useState(0)
  useEffect(() => {
    api.get('/livro-caixa/contas').then(r => setContasCaixa(r.data.data)).catch(() => {})
    api.get('/livro-caixa/config').then(r => { setTeto(Number(r.data.data.teto_com_imposto_mensal) || 0); setAccMes(Number(r.data.data.acumulado_mes) || 0) }).catch(() => {})
  }, [])
```

Ampliar o estado inicial do `form` para incluir caixa e imposto:

```tsx
  const [form, setForm] = useState({
    data_pagamento: todayISO(), valor_pago: String(parcela.valor),
    juros: '0', desconto: '0', observacoes: '', gerar_residuo: true,
    id_conta_caixa: '', valor_sem_imposto: String(parcela.valor), valor_com_imposto: '0',
  })
```

- [ ] **Step 2: Enviar os novos campos no POST da baixa e tratar o aviso de teto**

Trocar o corpo do `submit` (linha ~594-608) por:

```tsx
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    if (!form.id_conta_caixa) { setError('Selecione a conta de caixa do pagamento.'); setSaving(false); return }
    try {
      const resp = await api.post(`/financeiro/contas-pagar/${conta.id}/baixa`, {
        id_parcela: parcela.id,
        data_pagamento: form.data_pagamento,
        valor_pago: vPago,
        juros: parseFloat(form.juros || '0'),
        desconto: parseFloat(form.desconto || '0'),
        observacoes: form.observacoes,
        gerar_residuo: form.gerar_residuo,
        id_conta_caixa: Number(form.id_conta_caixa),
        valor_sem_imposto: parseFloat(form.valor_sem_imposto || '0'),
        valor_com_imposto: parseFloat(form.valor_com_imposto || '0'),
      })
      const aviso = resp?.data?.aviso_teto_imposto
      if (aviso) {
        alert(`⚠️ Teto mensal de pagamento COM IMPOSTO ultrapassado.\nAcumulado no mês: ${fmtBRL(aviso.acumulado)}\nTeto: ${fmtBRL(aviso.teto)}`)
      }
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }
```

- [ ] **Step 3: Adicionar no JSX do form o seletor de caixa (obrigatório) e — só quando `teto > 0` — os campos sem/com imposto + indicador**

Logo após o campo "Data Pagamento" (linha ~625), adicionar:

```tsx
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Conta de caixa
            <select value={form.id_conta_caixa} onChange={e => set('id_conta_caixa', e.target.value)} style={inputStyle}>
              <option value="">Selecione…</option>
              {contasCaixa.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
          {teto > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#FEF9C3', border: '1px solid #FCD34D', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                Split fiscal (reforma) — Com imposto no mês: {fmtBRL(accMes)} de {fmtBRL(teto)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Sem imposto
                  <input value={form.valor_sem_imposto} onChange={e => set('valor_sem_imposto', e.target.value)} style={inputStyle} inputMode="decimal" />
                </label>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Com imposto
                  <input value={form.valor_com_imposto} onChange={e => set('valor_com_imposto', e.target.value)} style={inputStyle} inputMode="decimal" />
                </label>
              </div>
            </div>
          )}
```

> Confirme que `api` e `fmtBRL` já estão importados no `ContasPagarPage.tsx` (estão — a página já os usa).

- [ ] **Step 4: No `BaixaModal` do Contas a Receber, adicionar SÓ o seletor de caixa (sem imposto)**

Em `ContasReceberPage.tsx`, replicar os passos 1 (só o `contasCaixa` + effect e `id_conta_caixa: ''` no form), 2 (enviar `id_conta_caixa` no POST `/financeiro/contas-receber/${conta.id}/baixa`, validar obrigatório; **não** há aviso de teto aqui) e 3 (só o `<select>` de conta de caixa). **Não** adicionar campos sem/com imposto no Receber.

- [ ] **Step 5: Build**

Run: `npx vite build`
Expected: build sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/modules/financeiro/pages/ContasPagarPage.tsx src/modules/financeiro/pages/ContasReceberPage.tsx
git commit -m "feat(livro-caixa): baixa CP/CR escolhe caixa; CP com split/aviso de teto imposto"
```

---

## ⚠️ GATE DE DEPLOY (crítico — produção viva)

A baixa (CP/CR) passou a **exigir `id_conta_caixa`** (400 se faltar). O frontend que envia esse campo
é a **Task 10**. Portanto: **NUNCA suba o backend do Task 6/7 sem subir o frontend do Task 10 junto**
(o `dist/` com os modais de baixa atualizados). Subir o backend sozinho **trava 100% das baixas** dos
30 reps. Ordem segura: rodar migrations 063-065 → subir `dist/` (frontend) + os `.js` do backend
**na mesma janela**. Também rodar as migrations ANTES (senão a baixa quebra ao inserir no caixa).

## Verificação manual (após Hamilton rodar as migrations 063-065 e fazer deploy)

Smoke test end-to-end (não automatizável aqui — depende de banco vivo):
1. Financeiro → **Livro Caixa** aparece no menu (gerência+). Criar 2 contas (Caixa e Banco) com saldos iniciais.
2. Lançar um crédito e um débito manuais → saldo corrido e SALDO ANTERIOR conferem.
3. Transferência Caixa→Banco → par D/C aparece, total geral não muda.
4. Contas a Pagar → baixar parcela escolhendo a conta de caixa → débito espelhado no Livro Caixa (selo CP, só-leitura).
5. Editar/excluir essa conta a pagar → o lançamento de caixa some (sem órfão).
6. Ligar o teto no `empresa_status` (`UPDATE …emp_teto_com_imposto_mensal=500`) → na baixa CP aparece o split + indicador; ultrapassar → alerta "só avisa", baixa conclui.

SQL de conferência do saldo de uma conta (rodar no schema do tenant):

```sql
SELECT c.conta_nome,
  c.saldo_inicial + COALESCE(SUM(CASE WHEN l.tipo='C' THEN l.valor ELSE -l.valor END),0) AS saldo
FROM livro_caixa_contas c
LEFT JOIN livro_caixa_lancamentos l ON l.conta_id = c.id
GROUP BY c.id, c.conta_nome, c.saldo_inicial ORDER BY c.conta_nome;
```

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura da spec:**
- Multi-conta + saldo calculado + SALDO ANTERIOR → Tasks 2, 3, 8. ✓
- Dashboard dedicado: período de/até + KPIs (Entradas/Saídas/Resultado/Saldo final) + card do teto → Tasks 3, 8. ✓
- Grid ordenado por sequence (id) + coluna Seq + bloqueio de lançamento retroativo (`checkRetroativo`) → Tasks 3, 4, 8. ✓
- Transferência (par vinculado) → Tasks 4, 8. ✓
- Lançamentos manuais (CRUD) → Tasks 3, 4, 8. ✓
- Integração baixa CP/CR → caixa → Task 6. ✓
- Limpeza/estorno no update/delete → Task 7. ✓
- Split sem/com imposto + teto mensal configurável (só avisa) → Tasks 1, 7, 10. ✓
- Permissão gerência+ → Tasks 5 (rota), 9 (menu minLevel 2). ✓
- Migrations idempotentes pgAdmin → Task 1. ✓
- Registro rota/menu → Task 9. ✓

**Consistência de tipos/nomes:** handlers exportados na Task 2/3/4 batem com os imports da Task 5; `lancarBaixaNoCaixa` (Task 6) bate com o uso no financeiro; campos do body (`id_conta_caixa`, `valor_com_imposto`, `valor_sem_imposto`) iguais entre Task 7 (backend) e Task 10 (frontend); `aviso_teto_imposto` idêntico entre backend e frontend.

**Sem placeholders:** todo passo de código tem o código real; comandos de verificação são `tsc --noEmit` / `vite build` reais + SQL concreto.
