# WhatsApp → Rascunho de Pedido (Status J) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um cliente cadastrado manda um pedido pelo WhatsApp, a IRIS detecta automaticamente, resolve os produtos (inclusive por código de concorrente), cria um pedido 'J' e avisa o lojista — deixando o rascunho na fila para qualquer rep revisar.

**Architecture:** O ponto de desvio é `processMessage()` em `whatsapp-orchestrator.ts`: se o contato é cliente cadastrado (`getFichaCliente()` retorna dados), a mensagem vai para `rotaClientePedido()` em vez de `rotaIA()`. Três funções novas em `whatsapp-pedido.service.ts` fazem: detecção de intenção (Claude), resolução de produtos (batch SQL com 5 estratégias), e criação atômica do pedido 'J'. O frontend adiciona tab "WhatsApp" em PedidosPage e badge no menu.

**Tech Stack:** TypeScript, PostgreSQL, Claude API (via ai_providers), Evolution API (sendText já existente), React + Vite frontend.

---

## Estrutura de Arquivos

| Arquivo | Ação |
|---|---|
| `backend/migrations/047_status_j_whatsapp.sql` | Criar — índice partial para ped_situacao='J' |
| `backend/src/modules/whatsapp/whatsapp-pedido.service.ts` | Criar — 3 funções: detectar, resolver, criar |
| `backend/src/modules/whatsapp/whatsapp-orchestrator.ts` | Modificar — rotaClientePedido() + wiring em processMessage() |
| `src/modules/pedidos/pages/PedidosPage.tsx` | Modificar — tab WhatsApp + highlight itens não resolvidos |
| `src/shared/components/layout/MainLayout.tsx` | Modificar — badge contador de pedidos J pendentes |

---

## Contexto Crítico para o Implementador

### Como o orquestrador funciona hoje
- `processMessage()` em `whatsapp-orchestrator.ts` linha ~316 é o ponto central
- Ele chama `decidirRota()` que retorna: `'ia_responde'`, `'optout'`, `'humano_ativo'`, `'nao_responder'`
- Quando `'ia_responde'` → chama `rotaIA(db, conversa, contato, msgId, instance)`
- `getFichaCliente(db, phone)` já existe (linha ~127) e retorna `FichaCliente | null` — null se não for cliente cadastrado
- Para enviar resposta WhatsApp: `sendText(instance, phone, text)` (linha ~17) — já existe

### Como enviar resposta WhatsApp
```typescript
// sendText já existe no topo do whatsapp-orchestrator.ts:
await sendText(instance, contato.telefone, 'sua mensagem aqui');
```

### Como chamar Claude (padrão do projeto)
Olhar `whatsapp-ai.service.ts` importa `callAI` de `'../../shared/utils/ai_providers'`.
Ler `backend/src/shared/utils/ai_providers.ts` para ver a assinatura exata antes de implementar.
O padrão geral:
```typescript
import { callAI } from '../../shared/utils/ai_providers';
const resposta = await callAI({ system: PROMPT, messages: [...], maxTokens: 400, temperature: 0, responseFormat: 'json_object' });
```

### Número do pedido
```typescript
// Padrão usado em orders.controller.ts (nextNumberHandler):
let seqResult;
try   { seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
catch { seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }
const pedNumero = seqResult.rows[0].next_num;
const pedPedido = 'WA' + pedNumero.toString().padStart(6, '0'); // ex: WA000001
```

### cli_ind — tabela de relação cliente-indústria
A tabela `cli_ind` armazena as relações de cada cliente com seus fornecedores. Para consultar a tabela de preço de um cliente:
```sql
-- Verificar as colunas reais com: SELECT column_name FROM information_schema.columns WHERE table_name='cli_ind' LIMIT 20
-- Os campos mais prováveis são cliind_cli (FK clientes) e cliind_tab (tabela de preço)
```
Se a query de preço falhar, `preco_unitario = 0` — o rep corrige na revisão.

---

## Task 1: Migration 047 — índice para status J

**Files:**
- Create: `backend/migrations/047_status_j_whatsapp.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- Migration 047: status 'J' — cotação WhatsApp aguardando revisão do rep
-- ped_situacao é VARCHAR livre, sem constraint a alterar.
-- Cria índice partial para performance da fila de revisão.

DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema
      FROM information_schema.tables
     WHERE table_name = 'pedidos'
       AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
     ORDER BY table_schema
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_pedidos_situacao_j ON %I.pedidos(created_at DESC) WHERE ped_situacao = ''J''',
      s
    );
    RAISE NOTICE 'Schema % — índice J criado.', s;
  END LOOP;
END;
$$;
```

- [ ] **Step 2: Rodar no pgAdmin**

Conectar ao banco master (sem selecionar schema). Executar o script acima. Verificar que o NOTICE aparece para cada tenant.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/047_status_j_whatsapp.sql
git commit -m "feat(db): migration 047 — índice partial para pedidos status J (WhatsApp)"
```

---

## Task 2: `whatsapp-pedido.service.ts` — tipos e `detectarIntencaoPedido()`

**Files:**
- Create: `backend/src/modules/whatsapp/whatsapp-pedido.service.ts`

- [ ] **Step 1: Ler a assinatura exata de `callAI`**

Abrir `backend/src/shared/utils/ai_providers.ts` e anotar a assinatura exata da função `callAI`. O plan usa o padrão mais comum mas verificar antes de escrever o código.

- [ ] **Step 2: Criar o arquivo com tipos e `detectarIntencaoPedido()`**

```typescript
import { Pool } from 'pg';
import { callAI } from '../../shared/utils/ai_providers';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ItemDetectado {
  codigo_enviado: string;  // exatamente como o lojista enviou
  quantidade:     number;  // 1 se não informado
}

export interface DeteccaoPedido {
  eh_pedido: boolean;
  itens:     ItemDetectado[];
}

export interface ItemResolvido {
  pro_id:         number;
  pro_codprod:    string;
  pro_nome:       string;
  quantidade:     number;
  preco_unitario: number;  // 0 se tabela não encontrada
}

export interface ItemNaoResolvido {
  codigo_enviado: string;
  quantidade:     number;
}

export interface ResolucaoItens {
  resolvidos:     ItemResolvido[];
  nao_resolvidos: ItemNaoResolvido[];
}

// ─── Sistema de detecção ──────────────────────────────────────────────────────

const PROMPT_DETECCAO = `Você é um analisador de mensagens de WhatsApp para representantes comerciais de autopeças.

Analise a mensagem e determine se é um pedido de produtos. Se for um pedido, extraia os itens.

Um pedido contém referências a produtos (códigos, nomes, descrições) com ou sem quantidade.

Retorne APENAS este JSON:
{
  "eh_pedido": true,
  "itens": [
    { "codigo_enviado": "PH3682", "quantidade": 20 },
    { "codigo_enviado": "correia gates k060475", "quantidade": 1 }
  ]
}

Se NÃO for um pedido (dúvida, reclamação, saudação, pergunta de prazo/preço genérica):
{ "eh_pedido": false, "itens": [] }

REGRAS:
- quantidade padrão = 1 quando não informada
- codigo_enviado = exatamente como o lojista escreveu (não alterar)
- Considerar pedido: "manda X unidades de Y", "preciso de X Y", "quero Y x5", listas de produtos com ou sem quantidade
- NÃO considerar pedido: "qual o preço?", "tem desconto?", "boa tarde", "qual o prazo?"`;

export async function detectarIntencaoPedido(conteudo: string): Promise<DeteccaoPedido> {
  try {
    const resposta = await callAI({
      system:         PROMPT_DETECCAO,
      messages:       [{ role: 'user', content: conteudo }],
      maxTokens:      400,
      temperature:    0,
      responseFormat: 'json_object',
    });

    const raw   = typeof resposta === 'string' ? resposta : (resposta as any).text ?? JSON.stringify(resposta);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!parsed.eh_pedido) return { eh_pedido: false, itens: [] };

    const itens: ItemDetectado[] = (parsed.itens || []).map((i: any) => ({
      codigo_enviado: String(i.codigo_enviado || '').trim(),
      quantidade:     Math.max(1, Number(i.quantidade) || 1),
    })).filter((i: ItemDetectado) => i.codigo_enviado.length > 0);

    return { eh_pedido: itens.length > 0, itens };
  } catch (e: any) {
    console.warn('[WPP-PEDIDO] detectarIntencaoPedido falhou:', e.message);
    return { eh_pedido: false, itens: [] };
  }
}
```

- [ ] **Step 3: Verificar que o arquivo compila**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros para este arquivo (outros erros não relacionados podem existir).

- [ ] **Step 4: Commit parcial**

```bash
git add backend/src/modules/whatsapp/whatsapp-pedido.service.ts
git commit -m "feat(whatsapp): whatsapp-pedido.service — tipos + detectarIntencaoPedido()"
```

---

## Task 3: `whatsapp-pedido.service.ts` — `resolverItensPedido()`

**Files:**
- Modify: `backend/src/modules/whatsapp/whatsapp-pedido.service.ts`

- [ ] **Step 1: Descobrir colunas de `cli_ind`**

Executar no pgAdmin (conectado a um schema de tenant):
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cli_ind'
ORDER BY ordinal_position;
```
Anotar os nomes das colunas que representam:
- FK para clientes (provavelmente `cliind_cli` ou `cli_codigo`)
- tabela de preço (provavelmente `cliind_tab` ou `cli_tabela`)

- [ ] **Step 2: Adicionar `resolverItensPedido()` ao arquivo**

Adicionar após `detectarIntencaoPedido()`:

```typescript
// ─── Normaliza código: só letras e números, maiúsculas ────────────────────────
function normCod(c: string): string {
  return c.replace(/[^A-Z0-9]/g, '').toUpperCase();
}

// ─── Busca preço do produto para o cliente ────────────────────────────────────
async function buscarPreco(db: Pool, proId: number, cliCodigo: number): Promise<number> {
  try {
    // ATENÇÃO: verificar nomes das colunas de cli_ind no Step 1
    // Colunas mais prováveis: cliind_cli (FK clientes), cliind_tab (tabela de preço)
    const r = await db.query(`
      SELECT ct.itab_precobruto
      FROM cad_tabelaspre ct
      WHERE ct.itab_idprod = $1
        AND ct.itab_tabela IN (
          SELECT DISTINCT cliind_tab FROM cli_ind WHERE cliind_cli = $2
          UNION
          SELECT DISTINCT cli_tabela  FROM cli_ind WHERE cliind_cli = $2
        )
      ORDER BY ct.itab_precobruto ASC
      LIMIT 1
    `, [proId, cliCodigo]);
    return r.rows[0] ? parseFloat(r.rows[0].itab_precobruto) || 0 : 0;
  } catch {
    return 0; // rep define na revisão
  }
}

// ─── Resolução de itens ───────────────────────────────────────────────────────
export async function resolverItensPedido(
  db: Pool,
  itens: ItemDetectado[],
  cliCodigo: number
): Promise<ResolucaoItens> {
  if (itens.length === 0) return { resolvidos: [], nao_resolvidos: [] };

  const exactCodes = [...new Set(itens.map(i => i.codigo_enviado.toUpperCase()))];
  const normCodes  = [...new Set(exactCodes.map(normCod).filter(c => c.length >= 2))];

  // ── Batch 1: exact + normalized em todos os campos de código ─────────────────
  const prodRes = await db.query(`
    SELECT
      pro_id, pro_codprod, pro_nome,
      UPPER(TRIM(pro_codprod))                                                        AS c1,
      UPPER(TRIM(COALESCE(pro_conversao,'')))                                         AS c2,
      UPPER(TRIM(COALESCE(pro_codigooriginal,'')))                                    AS c3,
      UPPER(TRIM(COALESCE(pro_codigonormalizado,'')))                                 AS c4,
      REGEXP_REPLACE(UPPER(TRIM(pro_codprod)),               '[^A-Z0-9]','','g')      AS n1,
      REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_conversao,''))), '[^A-Z0-9]','','g')    AS n2,
      REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_codigooriginal,''))), '[^A-Z0-9]','','g') AS n3
    FROM cad_prod
    WHERE pro_status IS NOT FALSE
      AND (
        UPPER(TRIM(pro_codprod))                                                   = ANY($1::text[])
        OR UPPER(TRIM(COALESCE(pro_conversao,'')))                                 = ANY($1::text[])
        OR UPPER(TRIM(COALESCE(pro_codigooriginal,'')))                            = ANY($1::text[])
        OR UPPER(TRIM(COALESCE(pro_codigonormalizado,'')))                         = ANY($1::text[])
        OR REGEXP_REPLACE(UPPER(TRIM(pro_codprod)),              '[^A-Z0-9]','','g') = ANY($2::text[])
        OR REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_conversao,''))), '[^A-Z0-9]','','g') = ANY($2::text[])
        OR REGEXP_REPLACE(UPPER(TRIM(COALESCE(pro_codigooriginal,''))), '[^A-Z0-9]','','g') = ANY($2::text[])
      )
  `, [exactCodes, normCodes]);

  // Mapeia código → produto (exact tem prioridade sobre normalized)
  const prodMap = new Map<string, any>();
  for (const p of prodRes.rows) {
    const exactAliases = [p.c1, p.c2, p.c3, p.c4] as string[];
    const normAliases  = [p.n1, p.n2, p.n3]        as string[];
    for (const a of exactAliases) {
      if (a && exactCodes.includes(a) && !prodMap.has(a)) prodMap.set(a, p);
    }
    for (const na of normAliases) {
      if (!na) continue;
      for (const orig of exactCodes) {
        if (normCod(orig) === na && !prodMap.has(orig)) prodMap.set(orig, p);
      }
    }
  }

  // ── Itens ainda não resolvidos → fallback por nome ILIKE ─────────────────────
  const pendentes = itens.filter(i => !prodMap.has(i.codigo_enviado.toUpperCase()));
  for (const item of pendentes) {
    if (item.codigo_enviado.length < 3) continue;
    try {
      const r = await db.query(`
        SELECT pro_id, pro_codprod, pro_nome
        FROM cad_prod
        WHERE pro_status IS NOT FALSE
          AND pro_nome ILIKE $1
        ORDER BY pro_nome ASC LIMIT 1
      `, [`%${item.codigo_enviado}%`]);
      if (r.rows.length > 0) {
        prodMap.set(item.codigo_enviado.toUpperCase(), r.rows[0]);
      }
    } catch { /* segue */ }
  }

  // ── Montar resultado ──────────────────────────────────────────────────────────
  const resolvidos:     ItemResolvido[]    = [];
  const nao_resolvidos: ItemNaoResolvido[] = [];

  for (const item of itens) {
    const key    = item.codigo_enviado.toUpperCase();
    const prod   = prodMap.get(key);
    if (prod) {
      const preco = await buscarPreco(db, prod.pro_id, cliCodigo);
      resolvidos.push({
        pro_id:         prod.pro_id,
        pro_codprod:    prod.pro_codprod,
        pro_nome:       prod.pro_nome,
        quantidade:     item.quantidade,
        preco_unitario: preco,
      });
    } else {
      nao_resolvidos.push({ codigo_enviado: item.codigo_enviado, quantidade: item.quantidade });
    }
  }

  console.log(`[WPP-PEDIDO] Resolução: ${resolvidos.length} ok, ${nao_resolvidos.length} não encontrados`);
  return { resolvidos, nao_resolvidos };
}
```

- [ ] **Step 3: Verificar compilação**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "whatsapp-pedido"
```

Expected: sem erros neste arquivo.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/whatsapp/whatsapp-pedido.service.ts
git commit -m "feat(whatsapp): resolverItensPedido — cadeia de 5 estratégias incl. pro_conversao"
```

---

## Task 4: `whatsapp-pedido.service.ts` — `criarRascunhoWhatsApp()`

**Files:**
- Modify: `backend/src/modules/whatsapp/whatsapp-pedido.service.ts`

- [ ] **Step 1: Adicionar `criarRascunhoWhatsApp()` ao final do arquivo**

```typescript
// ─── Criação atômica do rascunho 'J' ─────────────────────────────────────────
export async function criarRascunhoWhatsApp(
  db:          Pool,
  cliCodigo:   number,
  nomeCliente: string,
  resolucao:   ResolucaoItens,
  conversaId:  number
): Promise<string> {
  // Número do pedido
  let seqResult: any;
  try   { seqResult = await db.query("SELECT nextval('gen_pedidos_id') AS next_num"); }
  catch { seqResult = await db.query("SELECT nextval('pedidos_ped_numero_seq') AS next_num"); }
  const pedNumero = seqResult.rows[0].next_num;
  const pedPedido = 'WA' + String(pedNumero).padStart(6, '0');

  // Totais
  const totBruto = resolucao.resolvidos.reduce(
    (acc, i) => acc + i.preco_unitario * i.quantidade, 0
  );

  await db.query('BEGIN');
  try {
    // 1. Cabeçalho do pedido
    await db.query(`
      INSERT INTO pedidos (
        ped_numero, ped_pedido, ped_data, ped_situacao,
        ped_cliente, ped_vendedor, ped_industria, ped_tabela,
        ped_transp, ped_condpag, ped_comprador, ped_tipofrete, ped_cliind,
        ped_totbruto, ped_totliq, ped_totalipi, ped_obs
      ) VALUES (
        $1, $2, CURRENT_DATE, 'J',
        $3, NULL, NULL, '',
        0, '', $4, 'C', '',
        $5, $5, 0, '[Via WhatsApp]'
      )
    `, [pedNumero, pedPedido, cliCodigo, nomeCliente, totBruto]);

    // 2. Itens resolvidos
    let seq = 1;
    for (const item of resolucao.resolvidos) {
      const tot = item.preco_unitario * item.quantidade;
      await db.query(`
        INSERT INTO itens_ped
          (ite_pedido, ite_industria, ite_seq, ite_produto, ite_nomeprod,
           ite_quant, ite_puni, ite_totbruto)
        VALUES ($1, 0, $2, $3, $4, $5, $6, $7)
      `, [pedPedido, seq++, item.pro_codprod, item.pro_nome,
          item.quantidade, item.preco_unitario, tot]);
    }

    // 3. Itens não resolvidos (preço 0, nome sinalizado para o rep)
    for (const item of resolucao.nao_resolvidos) {
      await db.query(`
        INSERT INTO itens_ped
          (ite_pedido, ite_industria, ite_seq, ite_produto, ite_nomeprod,
           ite_quant, ite_puni, ite_totbruto)
        VALUES ($1, 0, $2, $3, $4, $5, 0, 0)
      `, [pedPedido, seq++,
          item.codigo_enviado.substring(0, 25),
          '[NÃO ENCONTRADO] ' + item.codigo_enviado,
          item.quantidade]);
    }

    // 4. Vincular conversa ao pedido
    await db.query(
      `UPDATE wpp_conversa SET pedido_id = $1, updated_at = NOW() WHERE id = $2`,
      [pedPedido, conversaId]
    );

    await db.query('COMMIT');
    console.log(`✅ [WPP-PEDIDO] Rascunho criado: ${pedPedido} | ${resolucao.resolvidos.length} itens | cliente ${cliCodigo}`);
    return pedPedido;
  } catch (e: any) {
    await db.query('ROLLBACK');
    throw e;
  }
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "whatsapp-pedido"
```

Expected: zero erros neste arquivo.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/whatsapp/whatsapp-pedido.service.ts
git commit -m "feat(whatsapp): criarRascunhoWhatsApp — pedido J atômico com itens resolvidos e não resolvidos"
```

---

## Task 5: `whatsapp-orchestrator.ts` — `rotaClientePedido()` + wiring

**Files:**
- Modify: `backend/src/modules/whatsapp/whatsapp-orchestrator.ts`

- [ ] **Step 1: Adicionar import no topo do orquestrador**

Localizar a seção de imports (linha ~1) e adicionar:

```typescript
import {
  detectarIntencaoPedido,
  resolverItensPedido,
  criarRascunhoWhatsApp,
} from './whatsapp-pedido.service';
```

- [ ] **Step 2: Adicionar `rotaClientePedido()` antes de `processMessage()`**

Inserir esta função logo antes de `export async function processMessage(`:

```typescript
// ─── Rota Cliente Pedido ──────────────────────────────────────────────────────
// Chamada quando getFichaCliente() confirma que o remetente é cliente cadastrado.
// Detecta pedidos automticamente; se não for pedido, cai em rotaIA() normal.
async function rotaClientePedido(
  db:          Pool,
  conversa:    any,
  contato:     any,
  content:     string,
  msgId:       number,
  instance:    string,
  ficha:       { cli_id: number; nome: string }
) {
  // 1. Detectar intenção
  const deteccao = await detectarIntencaoPedido(content);

  if (!deteccao.eh_pedido || deteccao.itens.length === 0) {
    console.log(`[WPP-PEDIDO] Mensagem de cliente sem intenção de pedido — rotaIA normal`);
    await rotaIA(db, conversa, contato, msgId, instance);
    return;
  }

  console.log(`[WPP-PEDIDO] Pedido detectado: ${deteccao.itens.length} item(s) | cliente ${ficha.cli_id}`);

  try {
    // 2. Resolver produtos
    const resolucao = await resolverItensPedido(db, deteccao.itens, ficha.cli_id);

    // 3. Criar rascunho J
    const numPedido = await criarRascunhoWhatsApp(
      db, ficha.cli_id, ficha.nome, resolucao, conversa.id
    );

    // 4. Responder ao lojista
    const nNaoResolvidos = resolucao.nao_resolvidos.length;
    const msg = nNaoResolvidos > 0
      ? `Recebi seu pedido (${numPedido})! ${nNaoResolvidos} item(s) precisam de verificação. Nosso time confirma em breve. 📋`
      : `Recebi seu pedido (${numPedido})! Nosso time vai confirmar em breve. 📋`;

    await sendText(instance, contato.telefone, msg);

    // 5. Atualizar contadores da conversa
    await db.query(
      `UPDATE wpp_conversa SET ultima_msg_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [conversa.id]
    );
  } catch (e: any) {
    console.error('[WPP-PEDIDO] Erro ao criar rascunho, caindo em rotaIA:', e.message);
    await rotaIA(db, conversa, contato, msgId, instance);
  }
}
```

- [ ] **Step 3: Modificar o `switch` em `processMessage()` para desviar clientes**

Localizar no `processMessage()` o bloco:
```typescript
switch (rota) {
  case 'ia_responde':
    await rotaIA(db, conversa, contato, msgId, instance);
    break;
```

Substituir **apenas o `case 'ia_responde'`** por:
```typescript
switch (rota) {
  case 'ia_responde': {
    // Se for cliente cadastrado → tentar capturar como pedido
    const ficha = await getFichaCliente(db, phone);
    if (ficha) {
      await rotaClientePedido(db, conversa, contato, content, msgId, instance, ficha);
    } else {
      await rotaIA(db, conversa, contato, msgId, instance);
    }
    break;
  }
```

- [ ] **Step 4: Compilar backend completo**

```bash
cd backend && npx tsc 2>&1
```

Expected: zero erros de compilação.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/whatsapp/whatsapp-orchestrator.ts
git commit -m "feat(whatsapp): rotaClientePedido — clientes cadastrados criam rascunho J automaticamente"
```

---

## Task 6: Frontend — Tab WhatsApp em PedidosPage + Badge no Menu

**Files:**
- Modify: `src/modules/pedidos/pages/PedidosPage.tsx`
- Modify: `src/shared/components/layout/MainLayout.tsx`

### Parte A — Badge no Menu

- [ ] **Step 1: Adicionar endpoint de contagem no backend**

Em `backend/src/modules/orders/orders.controller.ts`, adicionar após `nextNumberHandler`:

```typescript
// GET /api/orders/count-whatsapp — conta pedidos J pendentes para badge
export async function countWhatsappPedidosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r  = await db.query(
      `SELECT COUNT(*)::int AS total FROM pedidos WHERE ped_situacao = 'J'`
    );
    res.json({ success: true, total: r.rows[0].total });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}
```

- [ ] **Step 2: Registrar rota**

Em `backend/src/modules/orders/orders.routes.ts`, adicionar logo após a linha que registra `/next-number`:

```typescript
import { countWhatsappPedidosHandler } from './orders.controller';
// ...
router.get('/count-whatsapp', authMiddleware, tenantMiddleware, countWhatsappPedidosHandler);
```

- [ ] **Step 3: Adicionar badge em MainLayout**

Em `src/shared/components/layout/MainLayout.tsx`:

1. Localizar o estado onde já existem badges (ex: badge do WhatsApp mensagens). Adicionar estado para pedidos J:

```tsx
const [pedidosWpp, setPedidosWpp] = useState(0);

useEffect(() => {
  if (!user?.token) return;
  const load = () =>
    api.get('/orders/count-whatsapp')
      .then(r => setPedidosWpp(r.data.total ?? 0))
      .catch(() => {});
  load();
  const id = setInterval(load, 60_000); // atualiza a cada 1 min
  return () => clearInterval(id);
}, [user?.token]);
```

2. Localizar o item de menu "Pedidos" no sidebar e adicionar o badge (seguir o mesmo padrão visual do badge de WhatsApp já existente):

```tsx
{/* Pedidos menu item — adicionar badge quando há pedidos J pendentes */}
{pedidosWpp > 0 && (
  <span style={{
    background: '#F59E0B', color: '#fff',
    borderRadius: 10, fontSize: 10, fontWeight: 700,
    padding: '1px 5px', marginLeft: 6,
  }}>
    {pedidosWpp}
  </span>
)}
```

### Parte B — Tab WhatsApp na PedidosPage

- [ ] **Step 4: Adicionar filtro 'J' em PedidosPage**

Em `src/modules/pedidos/pages/PedidosPage.tsx`:

1. Localizar onde os filtros de `situacao` são definidos (provavelmente um estado `filtroSituacao` ou similar). Adicionar opção 'J':

```tsx
// Junto aos outros filtros de situação — adicionar tab/botão:
<button
  onClick={() => setFiltroSituacao('J')}
  style={{
    ...(filtroSituacao === 'J' ? { background: '#F59E0B', color: '#fff' } : {}),
    // ... mesmo estilo dos outros botões de filtro
  }}
>
  WhatsApp {pedidosWpp > 0 && `(${pedidosWpp})`}
</button>
```

2. Verificar que a listagem de pedidos já passa `situacao` como query param para o backend. Se sim, o filtro funcionará automaticamente. Se o endpoint `GET /api/orders` não suporta `situacao=J`, adicionar ao `listOrdersHandler` em `orders.controller.ts`:

```typescript
// No listOrdersHandler, na construção do WHERE:
if (situacao) {
  params.push(situacao);
  where.push(`p.ped_situacao = $${params.length}`);
}
```

- [ ] **Step 5: Destacar itens não resolvidos nos pedidos J**

Em `PedidosPage.tsx` ou no modal de revisão do pedido, ao exibir itens de um pedido 'J', checar se `ite_nomeprod` começa com `'[NÃO ENCONTRADO]'` e aplicar destaque:

```tsx
const naoEncontrado = item.ite_nomeprod?.startsWith('[NÃO ENCONTRADO]');

<tr style={naoEncontrado ? { background: '#FEF3C7', color: '#92400E' } : {}}>
  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
    {naoEncontrado
      ? item.ite_nomeprod.replace('[NÃO ENCONTRADO] ', '')
      : item.ite_produto}
  </td>
  <td>{naoEncontrado ? '⚠ código não encontrado' : item.ite_nomeprod}</td>
  <td>{item.ite_quant}</td>
  <td>{naoEncontrado ? '—' : formatCurrency(item.ite_puni)}</td>
</tr>
```

- [ ] **Step 6: Commit frontend**

```bash
git add src/modules/pedidos/pages/PedidosPage.tsx src/shared/components/layout/MainLayout.tsx backend/src/modules/orders/orders.controller.ts backend/src/modules/orders/orders.routes.ts
git commit -m "feat(pedidos): tab WhatsApp + badge menu + destaque itens não resolvidos"
```

---

## Task 7: Build final e verificação

**Files:**
- `backend/dist/` — compilado
- `dist/` — frontend compilado

- [ ] **Step 1: Compilar backend**

```bash
cd backend && npx tsc 2>&1
```

Expected: zero erros.

- [ ] **Step 2: Verificar arquivos gerados**

```bash
ls backend/dist/src/modules/whatsapp/whatsapp-pedido.service.js
ls backend/dist/src/modules/whatsapp/whatsapp-orchestrator.js
ls backend/dist/src/modules/orders/orders.controller.js
```

Expected: todos os 3 existem com timestamp recente.

- [ ] **Step 3: Build frontend**

```bash
npx vite build 2>&1 | tail -10
```

Expected: `✓ built in X.Xs` sem erros.

- [ ] **Step 4: Listar arquivos backend para upload**

```bash
echo "=== Arquivos para subir no servidor ==="
ls -la backend/dist/src/modules/whatsapp/whatsapp-pedido.service.js
ls -la backend/dist/src/modules/whatsapp/whatsapp-orchestrator.js
ls -la backend/dist/src/modules/orders/orders.controller.js
ls -la backend/dist/src/modules/orders/orders.routes.js
```

- [ ] **Step 5: Commit final**

```bash
git add backend/migrations/047_status_j_whatsapp.sql backend/src/modules/whatsapp/ backend/src/modules/orders/ src/modules/pedidos/ src/shared/
git commit -m "feat: WhatsApp → pedido J — detecção automática, resolução de produtos, fila de revisão"
```

- [ ] **Step 6: Teste end-to-end (cheklist)**

Após deploy:
1. Enviar mensagem de produto para o WhatsApp da instância configurada, de um número cadastrado como `cli_celular` ou `cli_fone1` em `clientes`
2. Verificar PM2 logs: deve aparecer `[WPP-PEDIDO] Pedido detectado` e `✅ [WPP-PEDIDO] Rascunho criado: WA000XXX`
3. Verificar que o lojista recebeu a mensagem de confirmação no WhatsApp
4. Abrir RepOne → Pedidos → tab WhatsApp → rascunho deve aparecer
5. Verificar que itens não resolvidos aparecem em amarelo
6. Rodar migration 047 no pgAdmin

---

## Checklist de Validação

- [ ] Mensagem de lojista cadastrado cria pedido 'J' no banco
- [ ] Mensagem de não-cliente segue fluxo de lead normal (rotaIA)
- [ ] Mensagem de cliente sem intenção de pedido vai para rotaIA normal
- [ ] Produtos resolvidos por pro_conversao (código concorrente) funcionam
- [ ] Itens sem quantidade recebem ite_quant = 1
- [ ] Itens não resolvidos entram como '[NÃO ENCONTRADO]' com preço 0
- [ ] Rep vê tab WhatsApp em PedidosPage
- [ ] Badge no menu mostra contagem correta
- [ ] PedidoModal permite editar e confirmar o pedido J
- [ ] Após confirmação, ped_situacao vai para 'P' ou 'C'
