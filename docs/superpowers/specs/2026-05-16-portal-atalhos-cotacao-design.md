# Portal do Lojista — Atalhos de Cotação: Design Spec

## Contexto

O portal hoje exige que o lojista digite ou cole os códigos manualmente na textarea. O objetivo é adicionar 3 atalhos acima da textarea que aceleram a montagem da cotação usando o histórico de compras:

1. **Repetir meu mix** — produtos do último pedido naquela indústria
2. **Produtos esquecidos** — itens comprados antes mas sem pedido há 90+ dias
3. **Explorar catálogo** — busca livre no catálogo da indústria com filtros

---

## Layout (B2 — hierarquia visual)

Posicionamento dentro da aba "Cotar", abaixo do combobox de indústria:

```
[ Combobox: SABO ▾ ]

[ 🔄 Repetir meu mix          ] ← botão primário (amarelo, largura total)
  12 produtos · último pedido há 18 dias

[ ⚠️ Esquecidos   ] [ 📋 Catálogo  ] ← botões secundários (grid 1fr 1fr)
  5 itens · +90 dias    847 produtos

── ou cole os códigos ──

[ textarea ]
[ Solicitar Cotação ]
```

Os dados contextuais (contagem de itens, dias) são carregados junto com a indústria selecionada via o endpoint `/insights` já existente. Enquanto carregam, os botões aparecem sem o subtítulo.

---

## Interação: Modal Centralizado

Cada botão abre um **modal centralizado** (~480px de largura, backdrop escurecido, fecha com Esc ou clique fora). Os três modais compartilham o mesmo shell de componente — só a fonte de dados e o comportamento pré-selecionado mudam.

### Shell comum do modal

```
╔══════════════════════════════╗
║  [Título]  [X fechar]        ║
║  [subtítulo / busca]         ║
╠══════════════════════════════╣
║  Código   Nome       Qtd  ✓  ║
║  SO7505   RETENTOR…   5   ☑  ║
║  SO5001   CÂMBIO      2   ☑  ║
║  ...                         ║
╠══════════════════════════════╣
║  [ Adicionar N itens à cota ]║
╚══════════════════════════════╝
```

- **Coluna Qtd**: input numérico editável (mínimo 1). Para mix e esquecidos, pré-preenchido com a quantidade do último pedido; para catálogo, começa em 1.
- **Coluna checkbox**: controla se o item entra na cotação.
- **Botão CTA no rodapé**: ativo apenas quando ≥1 item selecionado. Texto dinâmico: "Adicionar 7 itens à cotação".

### Ação ao confirmar (os 3 modos)

Ao clicar em "Adicionar N itens à cotação", o modal fecha e **popula a textarea** com os códigos no formato `CODIGO x QTD` (ex: `SO7505 x5`), **somando** com o que já estava digitado. O lojista revisa e clica em "Solicitar Cotação" normalmente — todo o fluxo de resolução de produtos e criação do pedido já existente é reutilizado sem alteração.

---

## Comportamento por modo

### Modo: Repetir meu mix

- Fonte: endpoint `/insights` → campo `ultimo_pedido_itens` (ver Backend abaixo)
- Todos os itens chegam **pré-selecionados** com a quantidade do último pedido
- O lojista desmarcar ou ajustar quantidades antes de confirmar
- Lista ordenada por quantidade (maior primeiro)

### Modo: Produtos esquecidos

- Fonte: endpoint `/insights` → campo `forgotten_products` (já existe)
- Itens chegam **desmarcados** — o lojista escolhe o que recomprar
- Exibe a última data de compra abaixo do nome do produto
- Lista ordenada por data de última compra (mais antiga primeiro)

### Modo: Explorar catálogo

- Fonte: novo endpoint `GET /portal-pub/produtos?industria=&q=&categoria=&limit=20&offset=0`
- Busca em tempo real (debounce 300ms) por código ou nome
- Chips de filtro por categoria (gerados dinamicamente a partir das categorias disponíveis)
- Paginação via botão "Carregar mais" (infinite scroll simples)
- Itens chegam **desmarcados**, quantidade começa em 1
- Campo Qtd editável antes de adicionar

---

## Backend

### Endpoint existente: `GET /api/portal-pub/insights`

**Extensão necessária**: adicionar o campo `ultimo_pedido_itens` à resposta. Ele retorna os itens do pedido mais recente do cliente naquela indústria:

```sql
-- Passo 1: buscar o número do último pedido válido
SELECT ped_numero, ped_data
FROM pedidos
WHERE ped_cliente = $cliCodigo
  AND ped_industria = $industria
  AND ped_situacao IN ('P', 'F')
ORDER BY ped_numero DESC
LIMIT 1

-- Passo 2: buscar todos os itens desse pedido
SELECT ite_codprod AS codigo, ite_nomeprod AS nome, ite_qtd AS quantidade
FROM itens_ped
WHERE ite_numero = $pedNumeroAcimadash
```

Retornar junto: `dias_ultimo_pedido` = `NOW() - ped_data` em dias inteiros (para o subtítulo do botão).

A query retorna os itens do último pedido válido (P ou F) para o par cliente+indústria.

O campo `forgotten_products` já existe e retorna os itens com 90+ dias sem compra — nenhuma alteração necessária.

Os dados contextuais dos botões (contagens) vêm dos mesmos campos:
- `ultimo_pedido_itens.length` → "12 produtos"
- `dias_ultimo_pedido` (novo campo no response) → "último pedido há 18 dias"
- `forgotten_products.length` → "5 itens"

### Novo endpoint: `GET /api/portal-pub/produtos`

```
Params: industria (obrigatório), q (opcional), categoria (opcional), limit=20, offset=0
Auth: tokenMiddleware (mesmo dos outros endpoints do portal-pub)
```

```sql
SELECT pro_codprod AS codigo,
       pro_nome AS nome,
       pro_grupo AS categoria
FROM cad_prod
WHERE pro_industria = $industria
  AND pro_status IS NOT FALSE
  AND (
    $q IS NULL OR $q = '' OR
    pro_codprod ILIKE '%' || $q || '%' OR
    pro_nome ILIKE '%' || $q || '%'
  )
  AND ($categoria IS NULL OR $categoria = '' OR pro_grupo = $categoria)
ORDER BY pro_codprod
LIMIT $limit OFFSET $offset
```

Também retorna `total` (COUNT sem limit) para o subtítulo "847 produtos".

Um segundo query retorna as categorias disponíveis para os chips de filtro:
```sql
SELECT DISTINCT pro_grupo AS categoria
FROM cad_prod
WHERE pro_industria = $industria AND pro_status IS NOT FALSE AND pro_grupo IS NOT NULL
ORDER BY pro_grupo
```

---

## Frontend

### Arquivo modificado: `src/modules/portal-pub/pages/PortalLojista.tsx`

Inserções na aba "cotar" (após o combobox de indústria, antes da textarea):

1. **State adicional**:
   - `quickModal: null | 'mix' | 'esquecidos' | 'catalogo'` — controla qual modal está aberto
   - `insightsData` — já carregado pelo efeito existente; adicionar `ultimo_pedido_itens` ao tipo

2. **Bloco B2** (JSX inserido no lugar correto):
   - Botão primário amarelo com texto e subtítulo contextual
   - Dois botões secundários em grid 2 colunas
   - Cada botão chama `setQuickModal('mix' | 'esquecidos' | 'catalogo')`

3. **Componente `<QuickActionModal>`** (novo arquivo `QuickActionModal.tsx` no mesmo diretório):
   - Recebe: `mode`, `industria`, `onConfirm(items: {codigo, quantidade}[])`, `onClose`
   - Gerencia internamente: lista de itens, seleção, quantidades, busca (catálogo), paginação
   - No modo `mix` e `esquecidos`: busca via `/insights` (já carregado — passa via prop)
   - No modo `catalogo`: fetch próprio para `/portal-pub/produtos`
   - `onConfirm` retorna os itens selecionados com quantidade

4. **Handler `handleQuickConfirm`** em PortalLojista:
   ```ts
   function handleQuickConfirm(items: {codigo: string; quantidade: number}[]) {
     const linhas = items.map(i => `${i.codigo} x${i.quantidade}`).join('\n');
     setRawCodes(prev => prev ? prev + '\n' + linhas : linhas);
     setQuickModal(null);
   }
   ```

---

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `backend/src/modules/portal-pub/portal-pub.controller.ts` | Adicionar `ultimo_pedido_itens` ao handler do `/insights`; criar `portalProdutosHandler` |
| `backend/src/modules/portal-pub/portal-pub.routes.ts` | Registrar `GET /produtos` |
| `src/modules/portal-pub/pages/PortalLojista.tsx` | Inserir bloco B2, estado do modal, handler |
| `src/modules/portal-pub/pages/QuickActionModal.tsx` | Criar (novo componente) |

---

## Fora do escopo

- Não altera o fluxo de resolução de produtos nem o backend de criação de pedidos
- Não cria nova rota de pedido — reutiliza o textarea + "Solicitar Cotação" existente
- Não adiciona animações complexas ao modal — apenas fade padrão com Tailwind/CSS
- Não salva seleções do modal entre sessões
