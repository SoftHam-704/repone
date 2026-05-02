# Magic Import com IA — Design Spec
**Data:** 2026-05-02  
**Feature:** Importação inteligente de tabela de preços via upload Excel + análise de IA  
**Tela:** Utilitários → Importação de Tabela de Preços → aba "✨ Magic Import"

---

## Contexto

A tela atual de Magic Import faz upload de Excel e exibe mapeamento manual de colunas. O objetivo é substituir esse mapeamento manual por análise de IA (OpenAI/Gemini via `callAI()` já existente), que detecta automaticamente as colunas, valida os dados e sugere grupos de produto.

---

## Gabarito de Referência

Colunas esperadas no Excel (ordem do gabarito oficial):

| Campo | Obrigatório | Tipo | Observação |
|-------|-------------|------|------------|
| `codigo` | Sim | Texto | SKU da indústria — chave de upsert |
| `descricao` | Sim | Texto | Nome do produto |
| `linha` | Não | Texto | Marca/linha do produto |
| `precobruto` | Sim | Número | Preço sem descontos (ponto como decimal) |
| `precopromo` | Não | Número | Preço promocional |
| `precoespecial` | Não | Número | Preço especial/negociado |
| `ipi` | Não | Número | Alíquota IPI em % |
| `st` | Não | Número | Alíquota ICMS-ST em % |
| `embalagem` | Não | Inteiro | Qtd de unidades na embalagem |
| `peso` | Não | Número | Peso unitário em kg |
| `conversao` | Não | Texto | Ex: "1 CX = 12 UN" |
| `aplicacao` | Não | Texto | Veículos/equipamentos compatíveis |
| `grupo` | Não | Inteiro | `gru_codigo` da tabela `grupos` |

A planilha não precisa ter esses nomes exatos — a IA mapeia qualquer cabeçalho.

---

## Fluxo Completo

### Etapa 1 — Upload
Usuário arrasta ou seleciona arquivo `.xlsx`/`.xls`. Sem mudança em relação ao comportamento atual.

### Etapa 2 — Análise por IA (NOVO)
Frontend envia para `POST /price-tables/magic-analyze`:
- Array de cabeçalhos da planilha
- 5 primeiras linhas de dados (amostra)
- Lista de grupos do tenant: `[{gru_codigo, gru_nome}]`

Backend chama `callAI()` com prompt estruturado e retorna:
```json
{
  "mapping": { "0": "codigo", "3": "precobruto", "12": "grupo" },
  "anomalies": [
    { "type": "zero_price", "count": 3, "message": "3 produtos com preço zerado" },
    { "type": "missing_grupo", "count": 12, "message": "12 produtos sem grupo" }
  ],
  "groupSuggestions": {
    "4": 7,
    "9": 3
  }
}
```

### Etapa 3 — Revisão na UI (NOVO)
Usuário vê:
- **Mapeamento detectado**: cada coluna do Excel → campo do sistema (editável)
- **Alertas**: lista de inconsistências detectadas (preço zerado, código vazio, etc.)
- **Sugestões de grupo**: produtos sem grupo onde a IA sugeriu um `gru_codigo` (usuário pode aceitar ou ignorar)

Produtos sem grupo **não bloqueiam** a importação — importam com `pro_grupo = null`.

### Etapa 4 — Indústria e Tabela
Usuário seleciona:
- **Indústria** (dropdown de fornecedores existentes)
- **Nome da tabela**: criar nova (texto livre) ou atualizar existente (dropdown)

### Etapa 5 — Importação
Frontend monta o payload para `POST /price-tables/import` (endpoint existente, sem alterações):
- Colunas **não presentes** na planilha → enviadas como `null`
- O backend usa `COALESCE` em todas as colunas — `null` preserva o valor existente no banco
- Garante semântica de PATCH: atualização parcial sem sobrescrever dados não informados

**Exemplo**: planilha só com `codigo` + `precobruto` → apenas o preço bruto é atualizado. Nome, grupo, aplicação, IPI, ST permanecem intactos no banco.

---

## Backend — Novo Endpoint

### `POST /price-tables/magic-analyze`

**Auth:** `authMiddleware + tenantMiddleware` (padrão)

**Body:**
```ts
{
  headers: string[];          // ex: ["Cód. Produto", "Descrição", "Preço Normal"]
  sample: string[][];         // 5 primeiras linhas de dados
  grupos: { gru_codigo: number; gru_nome: string }[];
}
```

**O que faz:**
1. Monta prompt para a IA com cabeçalhos, amostra e lista de grupos
2. Chama `callAI()` de `src/shared/utils/ai_providers.ts` (OpenAI → fallback Gemini)
3. Faz parse do JSON retornado pela IA
4. Retorna `{ mapping, anomalies, groupSuggestions }`

**Prompt para a IA (estrutura):**
```
Você é um assistente de importação de dados de autopeças.

Analise estes cabeçalhos de planilha e mapeie cada índice de coluna para um dos campos:
codigo, descricao, linha, precobruto, precopromo, precoespecial, ipi, st,
embalagem, peso, conversao, aplicacao, grupo

Cabeçalhos: ["Cód.", "Produto", "Preço", ...]
Amostra (5 linhas): [["ABC-1234", "FILTRO...", "45.90", ...], ...]
Grupos disponíveis: [{"gru_codigo": 1, "gru_nome": "FILTROS"}, ...]

Retorne APENAS JSON válido:
{
  "mapping": {"0": "codigo", "2": "precobruto"},
  "anomalies": [{"type": "zero_price", "count": N, "message": "..."}],
  "groupSuggestions": {"rowIndex": gru_codigo}
}

Regras:
- Mapeie apenas colunas que conseguir identificar com segurança
- anomalies: zero_price, missing_codigo, duplicate_codigo, missing_grupo
- groupSuggestions: só para linhas sem grupo, usando os gru_codigo disponíveis
- grupo é OPCIONAL — não inclua como anomalia se ausente em todas as linhas
```

---

## Frontend — Componente `MagicImport` (refatoração)

O componente existente `MagicImport` em `ImportacaoPrecosPage.tsx` é reescrito.

**Novo estado de steps:**
```ts
type Step = 'upload' | 'analyzing' | 'review' | 'configuring' | 'importing' | 'done'
```

**`upload`** → tela atual (drag & drop)  
**`analyzing`** → spinner "IRIS analisando sua planilha..." enquanto chama `/magic-analyze`  
**`review`** → tabela de mapeamento + alertas + sugestões de grupo (tudo editável)  
**`configuring`** → seleção de indústria + tabela (criar/atualizar)  
**`importing`** → progress bar (lotes de 1000 como no Classic)  
**`done`** → resultado com inseridos / atualizados / sem grupo  

**Campos mapeados → payload:**
```ts
// Colunas da planilha NÃO mapeadas pela IA → null (COALESCE preserva banco)
const buildProduto = (row, mapping) => ({
  codigo:        getCol(row, mapping, 'codigo')        ?? null,
  descricao:     getCol(row, mapping, 'descricao')     ?? null,
  precobruto:    toNum(getCol(row, mapping, 'precobruto'))  ?? null,
  precopromo:    toNum(getCol(row, mapping, 'precopromo'))  ?? null,
  precoespecial: toNum(getCol(row, mapping, 'precoespecial')) ?? null,
  ipi:           toNum(getCol(row, mapping, 'ipi'))     ?? null,
  st:            toNum(getCol(row, mapping, 'st'))      ?? null,
  embalagem:     toInt(getCol(row, mapping, 'embalagem')) ?? null,
  peso:          toNum(getCol(row, mapping, 'peso'))    ?? null,
  conversao:     getCol(row, mapping, 'conversao')      ?? null,
  aplicacao:     getCol(row, mapping, 'aplicacao')      ?? null,
  grupo:         groupSuggestions[rowIdx] ?? toInt(getCol(row, mapping, 'grupo')) ?? null,
})
```

---

## Semântica de PATCH — Garantia de banco

O endpoint `/price-tables/import` já usa `COALESCE` em **todas** as colunas:

- `cad_prod` UPDATE: `pro_nome = COALESCE(NULLIF(v.nome,''), pro_nome)` — null/vazio preserva
- `cad_tabelaspre` UPSERT: `itab_precopromo = COALESCE(EXCLUDED.itab_precopromo, cad_tabelaspre.itab_precopromo)` — null preserva

**Nenhuma alteração necessária no endpoint existente.**

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/modules/produtos/pages/ImportacaoPrecosPage.tsx` | Refatorar componente `MagicImport` |
| `backend/src/modules/price-tables/price-tables.routes.ts` | Adicionar rota `POST /magic-analyze` |
| `backend/src/modules/price-tables/price-tables.controller.ts` | Adicionar handler `magicAnalyze` |

---

## Fora de Escopo

- Suporte a PDF ou imagem (Opção C — futuro)
- Criação automática de grupos não existentes
- Edição inline dos dados na tela de revisão
- Histórico de importações
