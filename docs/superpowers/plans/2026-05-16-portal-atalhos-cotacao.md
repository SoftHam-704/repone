# Portal do Lojista — Atalhos de Cotação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 3 botões de atalho (Repetir mix, Esquecidos, Catálogo) acima da textarea de cotação do portal, cada um abrindo um modal com checkboxes que pré-preenchem a textarea.

**Architecture:** Backend: estender o endpoint `/insights` existente com o último pedido do cliente + novo endpoint `/produtos` para busca de catálogo. Frontend: novo componente `QuickActionModal` com 3 modos; `PortalLojista.tsx` ganha os botões B2 e renderiza o modal.

**Tech Stack:** TypeScript + Express (backend), React 18 + Vite (frontend), PostgreSQL multi-tenant via `req.db` / `getTenantDb`.

---

## File Structure

| Arquivo | Mudança |
|---|---|
| `backend/src/modules/portal-pub/portal-pub.controller.ts` | Adicionar query `ultimoPedidoItens`/`diasUltimoPedido` ao handler `/insights`; criar `portalProdutosHandler` |
| `backend/src/modules/portal-pub/portal-pub.routes.ts` | Importar e registrar `GET /produtos` |
| `src/modules/portal-pub/pages/QuickActionModal.tsx` | Criar — modal com 3 modos (mix, esquecidos, catálogo) |
| `src/modules/portal-pub/pages/PortalLojista.tsx` | Estender interface, estados, useEffect, B2 JSX, importar modal |

---

## Task 1: Backend — Estender `/insights` com `ultimoPedidoItens` e `diasUltimoPedido`

**Files:**
- Modify: `backend/src/modules/portal-pub/portal-pub.controller.ts` (linhas 647–655)

O handler `portalInsightsHandler` termina com `res.json(...)` na linha 649. Precisamos adicionar duas queries antes do `res.json` e incluir os novos campos na resposta.

- [ ] **Step 1: Localizar o ponto de inserção**

Abrir `backend/src/modules/portal-pub/portal-pub.controller.ts` e ir para linha 647. O bloco atual:

```typescript
    res.json({
      success: true,
      mensal: mensalR.rows,
      esquecidos: esquecidasR.rows,
      topProdutos: topR.rows,
      sugestoes: sugestaoR.rows,
    });
```

- [ ] **Step 2: Adicionar queries do último pedido antes do `res.json`**

Inserir imediatamente antes do bloco `res.json(...)`:

```typescript
    // Último pedido itens
    let ultimoPedidoItens: Array<{ codigo: string; nome: string; quantidade: number }> = [];
    let diasUltimoPedido: number | null = null;

    const ultimoPedR = await client.query(
      `SELECT ped_pedido, ped_data FROM pedidos
       WHERE ped_cliente = $1 AND ped_industria = $2 AND ped_situacao IN ('P','F')
       ORDER BY ped_numero DESC LIMIT 1`,
      [cliCodigo, indId]
    );

    if (ultimoPedR.rows.length > 0) {
      const { ped_pedido, ped_data } = ultimoPedR.rows[0];
      diasUltimoPedido = Math.floor(
        (Date.now() - new Date(ped_data).getTime()) / (1000 * 60 * 60 * 24)
      );
      const itensR = await client.query(
        `SELECT ite_produto AS codigo,
                MIN(ite_nomeprod) AS nome,
                SUM(ite_quant)::int AS quantidade
         FROM itens_ped
         WHERE ite_pedido = $1
         GROUP BY ite_produto
         ORDER BY quantidade DESC`,
        [ped_pedido]
      );
      ultimoPedidoItens = itensR.rows;
    }
```

- [ ] **Step 3: Atualizar `res.json` para incluir os novos campos**

Substituir o bloco `res.json` atual por:

```typescript
    res.json({
      success: true,
      mensal: mensalR.rows,
      esquecidos: esquecidasR.rows,
      topProdutos: topR.rows,
      sugestoes: sugestaoR.rows,
      ultimoPedidoItens,
      diasUltimoPedido,
    });
```

- [ ] **Step 4: Verificar tipagem localmente**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros relacionados ao `portal-pub.controller.ts`.

---

## Task 2: Backend — Novo endpoint `GET /api/portal-pub/produtos`

**Files:**
- Modify: `backend/src/modules/portal-pub/portal-pub.controller.ts` (adicionar ao final, antes do último `}`)
- Modify: `backend/src/modules/portal-pub/portal-pub.routes.ts`

- [ ] **Step 1: Adicionar `portalProdutosHandler` ao final do controller**

Após a função `portalCotacaoConfirmHandler` (última função do arquivo, que termina na linha 697), adicionar:

```typescript
// GET /api/portal-pub/produtos?t=<uuid>&s=<schema>&industria=<id>&q=&categoria=&limit=20&offset=0
export async function portalProdutosHandler(req: Request, res: Response): Promise<void> {
  const { t, s, industria, q = '', categoria = '', limit = '20', offset = '0' } = req.query as Record<string, string>;
  if (!t || !s || !industria || !validSchema(s)) {
    res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
    return;
  }

  let client: any;
  try {
    client = await getTenantDb(s);
    const cliCodigo = await assertToken(client, t);
    if (!cliCodigo) { res.status(403).json({ success: false, message: 'Acesso negado.' }); return; }

    const indId = parseInt(industria);
    const lim   = Math.min(parseInt(limit) || 20, 50);
    const off   = parseInt(offset) || 0;

    const totalR = await client.query(
      `SELECT COUNT(*)::int AS total FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE
         AND ($2 = '' OR pro_codprod ILIKE '%' || $2 || '%' OR pro_nome ILIKE '%' || $2 || '%')
         AND ($3 = '' OR pro_grupo = $3)`,
      [indId, q, categoria]
    );

    const produtosR = await client.query(
      `SELECT pro_codprod AS codigo, pro_nome AS nome, pro_grupo AS categoria
       FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE
         AND ($2 = '' OR pro_codprod ILIKE '%' || $2 || '%' OR pro_nome ILIKE '%' || $2 || '%')
         AND ($3 = '' OR pro_grupo = $3)
       ORDER BY pro_codprod
       LIMIT $4 OFFSET $5`,
      [indId, q, categoria, lim, off]
    );

    const categoriasR = await client.query(
      `SELECT DISTINCT pro_grupo AS categoria FROM cad_prod
       WHERE pro_industria = $1 AND pro_status IS NOT FALSE AND pro_grupo IS NOT NULL
       ORDER BY pro_grupo`,
      [indId]
    );

    res.json({
      success: true,
      total: totalR.rows[0].total,
      produtos: produtosR.rows,
      categorias: categoriasR.rows.map((r: any) => r.categoria),
    });
  } catch (error: any) {
    console.error('❌ [PORTAL-PUB] produtos error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
}
```

- [ ] **Step 2: Registrar a rota em `portal-pub.routes.ts`**

Arquivo atual (`backend/src/modules/portal-pub/portal-pub.routes.ts`):

```typescript
import { Router } from 'express';
import {
  validatePortalTokenHandler,
  portalOrdersHandler,
  portalPolicyHandler,
  portalCotacaoCreateHandler,
  portalCotacaoStatusHandler,
  portalCotacaoAddItemsHandler,
  portalCotacaoConfirmHandler,
  portalInsightsHandler,
} from './portal-pub.controller';

const router = Router();

router.get('/validate',                          validatePortalTokenHandler);
router.get('/orders',                            portalOrdersHandler);
router.get('/policy',                            portalPolicyHandler);
router.post('/cotacao',                          portalCotacaoCreateHandler);
router.get('/cotacao/:pedNumero',                portalCotacaoStatusHandler);
router.post('/cotacao/:pedNumero/itens',         portalCotacaoAddItemsHandler);
router.post('/cotacao/:pedNumero/confirmar',     portalCotacaoConfirmHandler);
router.get('/insights',                          portalInsightsHandler);

export default router;
```

Substituir por (adiciona `portalProdutosHandler` no import e nova rota):

```typescript
import { Router } from 'express';
import {
  validatePortalTokenHandler,
  portalOrdersHandler,
  portalPolicyHandler,
  portalCotacaoCreateHandler,
  portalCotacaoStatusHandler,
  portalCotacaoAddItemsHandler,
  portalCotacaoConfirmHandler,
  portalInsightsHandler,
  portalProdutosHandler,
} from './portal-pub.controller';

const router = Router();

router.get('/validate',                          validatePortalTokenHandler);
router.get('/orders',                            portalOrdersHandler);
router.get('/policy',                            portalPolicyHandler);
router.post('/cotacao',                          portalCotacaoCreateHandler);
router.get('/cotacao/:pedNumero',                portalCotacaoStatusHandler);
router.post('/cotacao/:pedNumero/itens',         portalCotacaoAddItemsHandler);
router.post('/cotacao/:pedNumero/confirmar',     portalCotacaoConfirmHandler);
router.get('/insights',                          portalInsightsHandler);
router.get('/produtos',                          portalProdutosHandler);

export default router;
```

- [ ] **Step 3: Verificar tipagem**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.

---

## Task 3: Compilar backend e commitar

**Files:**
- `backend/dist/src/modules/portal-pub/portal-pub.controller.js`
- `backend/dist/src/modules/portal-pub/portal-pub.routes.js`

- [ ] **Step 1: Compilar**

```bash
cd backend && npx tsc
```

Esperado: sem erros. Arquivos gerados em `backend/dist/src/modules/portal-pub/`.

- [ ] **Step 2: Verificar arquivos gerados**

```bash
ls backend/dist/src/modules/portal-pub/
```

Esperado: `portal-pub.controller.js`, `portal-pub.routes.js` (entre outros).

- [ ] **Step 3: Commitar**

```bash
git add backend/src/modules/portal-pub/portal-pub.controller.ts backend/src/modules/portal-pub/portal-pub.routes.ts backend/dist/src/modules/portal-pub/portal-pub.controller.js backend/dist/src/modules/portal-pub/portal-pub.routes.js
git commit -m "feat(portal): insights com ultimoPedidoItens + endpoint GET /produtos"
```

---

## Task 4: Frontend — Criar `QuickActionModal.tsx`

**Files:**
- Create: `src/modules/portal-pub/pages/QuickActionModal.tsx`

- [ ] **Step 1: Criar o arquivo com o componente completo**

```typescript
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8',
  text: '#28374A', muted: '#7A8899', mustard: '#FFD200',
  navy: '#1E2D3D', surface: '#FDFBF7',
};
const MONO = '"SF Mono", ui-monospace, "Cascadia Mono", "Roboto Mono", Menlo, monospace';
const BASE = (import.meta as any).env?.VITE_API_URL || '';

interface ModalItem {
  codigo: string;
  nome: string;
  quantidade: number;
  ultima_compra?: string;
  selected: boolean;
}

interface Props {
  mode: 'mix' | 'esquecidos' | 'catalogo';
  industria: string;
  token: string;
  schema: string;
  insightsMix: Array<{ codigo: string; nome: string; quantidade: number }>;
  insightsEsquecidos: Array<{ codigo: string; nome: string; ultima_compra?: string }>;
  onConfirm: (items: { codigo: string; quantidade: number }[]) => void;
  onClose: () => void;
}

export default function QuickActionModal({
  mode, industria, token, schema,
  insightsMix, insightsEsquecidos,
  onConfirm, onClose,
}: Props) {
  const [items, setItems]             = useState<ModalItem[]>([]);
  const [search, setSearch]           = useState('');
  const [categoria, setCategoria]     = useState('');
  const [categorias, setCategorias]   = useState<string[]>([]);
  const [catTotal, setCatTotal]       = useState(0);
  const [catOffset, setCatOffset]     = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inicializar itens para mix e esquecidos
  useEffect(() => {
    if (mode === 'mix') {
      setItems(insightsMix.map(i => ({ ...i, selected: true })));
    } else if (mode === 'esquecidos') {
      setItems(insightsEsquecidos.map(i => ({
        codigo: i.codigo, nome: i.nome, quantidade: 1,
        ultima_compra: i.ultima_compra, selected: false,
      })));
    }
  }, [mode]);

  // Catálogo: carga inicial
  useEffect(() => {
    if (mode === 'catalogo') loadCatalog(0, '', '');
  }, [mode]);

  async function loadCatalog(off: number, q: string, cat: string) {
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ t: token, s: schema, industria, q, categoria: cat, limit: '20', offset: String(off) });
      const r  = await fetch(`${BASE}/api/portal-pub/produtos?${qs}`);
      const d  = await r.json();
      if (!d.success) return;
      setCatTotal(d.total);
      const novos: ModalItem[] = d.produtos.map((p: any) => ({
        codigo: p.codigo, nome: p.nome, quantidade: 1, selected: false,
      }));
      if (off === 0) {
        setCategorias(d.categorias || []);
        setItems(novos);
      } else {
        setItems(prev => [...prev, ...novos]);
      }
      setCatOffset(off + d.produtos.length);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }

  function handleSearch(q: string) {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadCatalog(0, q, categoria), 300);
  }

  function handleCategoria(cat: string) {
    setCategoria(cat);
    loadCatalog(0, search, cat);
  }

  function toggleItem(idx: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  }

  function setQtd(idx: number, v: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: Math.max(1, v || 1) } : it));
  }

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selected = items.filter(i => i.selected);

  const titles = {
    mix:        '🔄 Repetir meu mix',
    esquecidos: '⚠️ Produtos esquecidos',
    catalogo:   '📋 Explorar catálogo',
  };
  const subtitles = {
    mix:        'Selecione os produtos do seu último pedido',
    esquecidos: 'Produtos comprados há mais de 90 dias',
    catalogo:   '',
  };

  return (
    <div
      onClick={e => { if ((e.target as HTMLElement).dataset.backdrop) onClose(); }}
      data-backdrop="1"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: G.surface, borderRadius: 16,
        width: '100%', maxWidth: 480, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>

        {/* Cabeçalho */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: G.text }}>{titles[mode]}</div>
            {subtitles[mode] && <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>{subtitles[mode]}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Busca + chips de categoria (catálogo) */}
        {mode === 'catalogo' && (
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${G.border}` }}>
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 13,
                padding: '8px 12px', borderRadius: 8,
                border: `1.5px solid ${G.border}`, background: G.card,
                color: G.text, outline: 'none',
              }}
            />
            {categorias.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {['', ...categorias].map(cat => (
                  <button key={cat} onClick={() => handleCategoria(cat)} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                    border: 'none', cursor: 'pointer',
                    background: categoria === cat ? G.navy : G.bg,
                    color: categoria === cat ? G.mustard : G.text,
                  }}>
                    {cat === '' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: G.muted, marginTop: 6 }}>{catTotal} produtos</div>
          </div>
        )}

        {/* Lista de itens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px' }}>
          {items.length === 0 && !loadingMore && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: G.muted, fontSize: 13 }}>
              {mode === 'catalogo' ? 'Nenhum produto encontrado.' : 'Nenhum item disponível.'}
            </div>
          )}
          {items.map((item, idx) => (
            <div key={item.codigo + idx} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: `1px solid ${G.border}`,
            }}>
              <input
                type="checkbox"
                checked={item.selected}
                onChange={() => toggleItem(idx)}
                style={{ width: 16, height: 16, accentColor: '#2D4A3E', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: G.text, fontFamily: MONO }}>{item.codigo}</div>
                <div style={{ fontSize: 11, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</div>
                {item.ultima_compra && (
                  <div style={{ fontSize: 10, color: G.muted }}>
                    Última compra: {new Date(item.ultima_compra).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              <input
                type="number"
                min={1}
                value={item.quantidade}
                onChange={e => setQtd(idx, parseInt(e.target.value))}
                style={{
                  width: 52, fontSize: 12, fontWeight: 700, padding: '4px 6px',
                  borderRadius: 6, border: `1px solid ${G.border}`,
                  textAlign: 'center', color: G.text, background: G.card,
                }}
              />
            </div>
          ))}

          {mode === 'catalogo' && items.length < catTotal && (
            <button
              onClick={() => loadCatalog(catOffset, search, categoria)}
              disabled={loadingMore}
              style={{
                width: '100%', margin: '12px 0 4px',
                background: G.bg, border: `1px solid ${G.border}`,
                borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700,
                color: G.text, cursor: loadingMore ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingMore ? 'Carregando...' : `Carregar mais (${catTotal - items.length} restantes)`}
            </button>
          )}
        </div>

        {/* Rodapé CTA */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${G.border}` }}>
          <button
            onClick={() => onConfirm(selected.map(i => ({ codigo: i.codigo, quantidade: i.quantidade })))}
            disabled={selected.length === 0}
            style={{
              width: '100%',
              background: selected.length > 0 ? G.navy : G.border,
              color: selected.length > 0 ? G.mustard : G.muted,
              border: 'none', borderRadius: 10, padding: '12px',
              fontSize: 13, fontWeight: 900,
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {selected.length > 0
              ? `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'} à cotação`
              : 'Selecione ao menos um item'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar se TypeScript aceita o arquivo**

```bash
cd E:\Sistemas_ia\RepOne && npx tsc --noEmit 2>&1 | grep QuickActionModal
```

Esperado: sem erros.

---

## Task 5: Frontend — Integrar em `PortalLojista.tsx`

**Files:**
- Modify: `src/modules/portal-pub/pages/PortalLojista.tsx`

São 5 mudanças pontuais no arquivo. Fazer em ordem.

### 5a — Adicionar `useRef` ao import do React e importar o modal

- [ ] **Step 1: Atualizar linha 1 (import React)**

De:
```typescript
import { useEffect, useState, useCallback } from 'react';
```

Para:
```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
```

- [ ] **Step 2: Adicionar import do modal após os outros imports (antes da linha `const G = {`)**

```typescript
import QuickActionModal from './QuickActionModal';
```

### 5b — Estender a interface `InsightData`

- [ ] **Step 3: Localizar e substituir a interface `InsightData` (linhas 84–89)**

De:
```typescript
interface InsightData {
  mensal: Array<{ mes: string; total: string }>;
  esquecidos: InsightProduto[];
  topProdutos: InsightProduto[];
  sugestoes: InsightProduto[];
}
```

Para:
```typescript
interface InsightData {
  mensal: Array<{ mes: string; total: string }>;
  esquecidos: InsightProduto[];
  topProdutos: InsightProduto[];
  sugestoes: InsightProduto[];
  ultimoPedidoItens: Array<{ codigo: string; nome: string; quantidade: number }>;
  diasUltimoPedido: number | null;
}
```

### 5c — Adicionar estado `quickModal` e ref de controle

- [ ] **Step 4: Adicionar estado após o bloco `// Insights` (linha 151–152)**

Após:
```typescript
  // Insights
  const [insights, setInsights]             = useState<InsightData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
```

Adicionar:
```typescript
  // Quick actions modal
  const [quickModal, setQuickModal]           = useState<null | 'mix' | 'esquecidos' | 'catalogo'>(null);
  const insightsIndustriaRef                  = useRef<string>('0');
```

### 5d — Atualizar `loadInsights` e seu useEffect trigger

- [ ] **Step 5: Atualizar o `setInsights(...)` dentro de `loadInsights` (linha 212)**

De:
```typescript
      if (d.success) setInsights({ mensal: d.mensal, esquecidos: d.esquecidos, topProdutos: d.topProdutos, sugestoes: d.sugestoes });
```

Para:
```typescript
      if (d.success) setInsights({
        mensal: d.mensal,
        esquecidos: d.esquecidos,
        topProdutos: d.topProdutos,
        sugestoes: d.sugestoes,
        ultimoPedidoItens: d.ultimoPedidoItens || [],
        diasUltimoPedido: d.diasUltimoPedido ?? null,
      });
```

- [ ] **Step 6: Atualizar o `useEffect` trigger de insights (linhas 217–219)**

De:
```typescript
  useEffect(() => {
    if (status === 'ok' && activeTab === 'insights' && industria !== '0') loadInsights();
  }, [status, activeTab, industria]);
```

Para:
```typescript
  useEffect(() => {
    if (status === 'ok' && (activeTab === 'insights' || activeTab === 'cotar') && industria !== '0') {
      if (insightsIndustriaRef.current !== industria) {
        insightsIndustriaRef.current = industria;
        loadInsights();
      }
    }
  }, [status, activeTab, industria]);
```

### 5e — Adicionar handler e bloco B2 no JSX da aba cotar

- [ ] **Step 7: Adicionar `handleQuickConfirm` junto com os outros handlers**

Buscar a função `enviarCotacao` ou `confirmarCotacao` no arquivo (próximo da linha 275) e adicionar `handleQuickConfirm` logo antes dela:

```typescript
  function handleQuickConfirm(items: { codigo: string; quantidade: number }[]) {
    const linhas = items.map(i => `${i.codigo} x${i.quantidade}`).join('\n');
    setRawCodes(prev => prev.trim() ? prev.trim() + '\n' + linhas : linhas);
    setQuickModal(null);
  }
```

- [ ] **Step 8: Inserir bloco B2 no JSX da aba cotar**

Localizar a linha com o subtítulo da textarea (linha 560):
```tsx
                    <div style={{ fontSize: 12, color: G.muted, marginBottom: 14, lineHeight: 1.4 }}>Código, código original, conversão ou nome. Nós encontramos.</div>
```

Substituir por (adiciona B2 entre o subtítulo e a textarea):
```tsx
                    <div style={{ fontSize: 12, color: G.muted, marginBottom: 10, lineHeight: 1.4 }}>Código, código original, conversão ou nome. Nós encontramos.</div>

                    {/* B2 — Atalhos de cotação */}
                    {loadingInsights ? (
                      <div style={{ fontSize: 11, color: G.muted, textAlign: 'center', padding: '10px 0', marginBottom: 8 }}>Carregando atalhos...</div>
                    ) : insights ? (
                      <div style={{ marginBottom: 14 }}>
                        <button
                          onClick={() => setQuickModal('mix')}
                          disabled={!insights.ultimoPedidoItens.length}
                          style={{
                            width: '100%', marginBottom: 8, textAlign: 'left',
                            background: insights.ultimoPedidoItens.length ? G.mustard : G.border,
                            border: 'none', borderRadius: 10, padding: '12px 14px',
                            cursor: insights.ultimoPedidoItens.length ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>🔄 Repetir meu mix</div>
                          <div style={{ fontSize: 11, color: insights.ultimoPedidoItens.length ? '#5a4a00' : G.muted, marginTop: 2 }}>
                            {insights.ultimoPedidoItens.length
                              ? `${insights.ultimoPedidoItens.length} produtos · último pedido há ${insights.diasUltimoPedido} dias`
                              : 'Nenhum pedido anterior nesta indústria'}
                          </div>
                        </button>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button
                            onClick={() => setQuickModal('esquecidos')}
                            disabled={!insights.esquecidos.length}
                            style={{
                              textAlign: 'left', border: 'none', borderRadius: 8, padding: '10px 12px',
                              background: insights.esquecidos.length ? '#2D4A3E' : G.border,
                              cursor: insights.esquecidos.length ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 800, color: insights.esquecidos.length ? '#A3D9A5' : G.muted }}>⚠️ Esquecidos</div>
                            <div style={{ fontSize: 9, color: insights.esquecidos.length ? '#6EBF8B' : G.muted, marginTop: 2 }}>
                              {insights.esquecidos.length} {insights.esquecidos.length === 1 ? 'item' : 'itens'} · +90 dias
                            </div>
                          </button>
                          <button
                            onClick={() => setQuickModal('catalogo')}
                            style={{
                              textAlign: 'left', borderRadius: 8, padding: '10px 12px',
                              background: '#283748', border: '1px solid #4A6080', cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#E8E1D4' }}>📋 Catálogo</div>
                            <div style={{ fontSize: 9, color: '#A8B8C4', marginTop: 2 }}>Ver todos os produtos</div>
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 6px' }}>
                          <div style={{ flex: 1, height: 1, background: G.border }} />
                          <div style={{ fontSize: 10, color: G.muted, fontWeight: 600 }}>ou cole os códigos</div>
                          <div style={{ flex: 1, height: 1, background: G.border }} />
                        </div>
                      </div>
                    ) : null}
```

### 5f — Renderizar o modal

- [ ] **Step 9: Adicionar renderização do modal no final do JSX retornado**

Localizar o retorno do componente (o `return (` principal). Antes do `</div>` que fecha o retorno (no final do componente), adicionar:

```tsx
      {quickModal && insights && (
        <QuickActionModal
          mode={quickModal}
          industria={industria}
          token={token}
          schema={schema}
          insightsMix={insights.ultimoPedidoItens}
          insightsEsquecidos={insights.esquecidos}
          onConfirm={handleQuickConfirm}
          onClose={() => setQuickModal(null)}
        />
      )}
```

**Dica:** O componente retorna um `<div>` raiz que envolve tudo. Colocar o modal logo antes do `</div>` final desse elemento raiz garante que o modal apareça acima de tudo (z-index 1000).

- [ ] **Step 10: Verificar tipagem**

```bash
npx tsc --noEmit 2>&1 | grep -E "PortalLojista|QuickAction"
```

Esperado: sem erros.

---

## Task 6: Build e commit final

- [ ] **Step 1: Rodar o build de frontend**

```bash
npx vite build 2>&1 | tail -20
```

Esperado: `✓ built in X.XXs` sem erros.

- [ ] **Step 2: Verificar os arquivos dist**

```bash
ls dist/assets/*.js | head -5
```

Esperado: arquivos gerados com hash atualizado.

- [ ] **Step 3: Commit final**

```bash
git add src/modules/portal-pub/pages/QuickActionModal.tsx src/modules/portal-pub/pages/PortalLojista.tsx dist/
git commit -m "feat(portal): atalhos de cotação — mix, esquecidos e catálogo com modal"
```

---

## Checklist de verificação manual

Após implementar, testar no browser abrindo o portal com um link válido:

- [ ] Selecionar uma indústria na aba "Cotar" — botões B2 aparecem abaixo do título
- [ ] "Repetir meu mix" desabilitado se não há pedido anterior; habilitado com contagem correta
- [ ] "Esquecidos" desabilitado se array vazio
- [ ] Clicar "Repetir mix" → modal abre com itens pré-selecionados e quantidades do último pedido
- [ ] Desmarcar um item e ajustar quantidade → "Adicionar N itens" reflete mudança
- [ ] Confirmar → modal fecha → textarea preenchida com `CODIGO x QTD`
- [ ] Clicar "Esquecidos" → modal com itens desmarcados e data última compra visível
- [ ] Clicar "Catálogo" → modal com busca; digitar código → lista filtra em 300ms
- [ ] Chips de categoria funcionam (se houver categorias no cadastro)
- [ ] "Carregar mais" carrega próxima página e acumula na lista
- [ ] Confirmar do catálogo → textarea acumula com o que já havia digitado
- [ ] Esc fecha o modal
- [ ] Clicar no backdrop (fora do card) fecha o modal
