# Relatórios de Faturamento — Design Spec
**Data**: 2026-05-03  
**Status**: Aprovado

---

## Contexto

A categoria "Faturamento" na Central de Relatórios já está mapeada na `RelatoriosPage.tsx` com 5 entradas, todas exibindo placeholder "Em construção". Este spec define a implementação completa dessas 5 telas do zero — os dois primeiros baseados em relatórios do sistema Delphi V1, os três restantes novos.

---

## Decisões de design

### Renderização (Opção C aprovada)
Tabela agrupada no painel direito (padrão dos outros relatórios do sistema). Ao imprimir, `@media print` esconde sidebar, filtros e navegação, e exibe cabeçalho da empresa. Um componente `PrintHeader` compartilhado busca os dados de `/api/empresa` e é ocultado por padrão, visível apenas em `@media print`.

### Comissão por grupo de produto (flag gru_usa_percomiss)
A tabela `grupos` recebeu o campo `gru_usa_percomiss BOOLEAN DEFAULT FALSE` (migration 031). Quando `TRUE`, o sistema usa `gru_percomiss` do grupo como o % de comissão do preposto — em vez do `vin_percom` padrão do `vendedor_ind`. Isso resolve casos em que uma indústria reduz a comissão sobre determinados grupos de produtos (ex: freios na somarep).

A regra de cálculo universal para comissão do preposto:
```sql
CASE
  WHEN g.gru_usa_percomiss = TRUE THEN g.gru_percomiss
  ELSE COALESCE(v.vin_percom, 0)
END AS percent_comissao
```

### Campos de comissão em fatura_ped
- `fat_percent` = % de comissão do **preposto** (vendedor) informado no faturamento
- `fat_percomissind` = % de comissão do **representante** (escritório), vindo de `for_percom` do fornecedor. **Atenção**: no código V2 atual este campo foi implementado incorretamente como `'E'`/`'V'` (indicador de tipo) em vez de um valor numérico. O relatório 2 deve fazer `NULLIF(fat_percomissind, 'E')::NUMERIC` com fallback para `for_percom` da tabela `fornecedores` quando o valor armazenado não for numérico.
- `fat_comissao` = valor calculado da comissão do preposto (armazenado, mas **não usado** no relatório 1 — recalculado via itens para aplicar a regra de grupos)

### Filtros extras
Cada componente gerencia seus próprios filtros além do período (vendedor, indústria) com um `<select>` discreto acima da tabela — mesmo padrão dos relatórios de vendas.

### Permissão multi-tenant
Todos os endpoints seguem o padrão: `authMiddleware` + `tenantMiddleware` + `getLinkedSellerId()`. Usuário vinculado a vendedor vê apenas seus dados.

---

## Arquitetura

### Backend
5 novos endpoints em `backend/src/modules/reports/reports.routes.ts`:

```
GET /api/reports/faturamento/comissao
GET /api/reports/faturamento/periodo
GET /api/reports/faturamento/pedidos-faturados
GET /api/reports/faturamento/pendente
GET /api/reports/faturamento/produtos-nao-faturados
```

### Frontend
5 novos componentes em `src/modules/relatorios/components/`:
- `ComissaoVendedoresReport.tsx`
- `FaturamentoPeriodoReport.tsx`
- `PedidosFaturadosReport.tsx`
- `FaturamentoPendenteReport.tsx`
- `ProdutosNaoFaturadosReport.tsx`

Componente compartilhado:
- `src/modules/relatorios/components/PrintHeader.tsx` — cabeçalho da empresa para impressão

### GruposPage
Adicionar toggle "Comissão própria" (`gru_usa_percomiss`) + campo `gru_percomiss` que aparece quando o toggle está ativo. O rep configura por grupo sem precisar de suporte.

### Migration
- Script pgAdmin: `backend/scripts/pgadmin_031_grupos_usa_percomiss.sql` — já criado

---

## Relatório 1 — Comissão de Vendedores (`comissao-vendedores`)

**Referência**: Delphi "Faturamento por vendedor (comissões)"

### Endpoint
`GET /api/reports/faturamento/comissao`

**Parâmetros**: `dataInicio`, `dataFim` (filtram `fat_datafat`), `vendedor?`, `industria?`

### Query
A comissão é recalculada via itens (não usa `fat_comissao` armazenado) para aplicar a regra de grupos. A implementação usa uma subquery que agrega por `fat_lancto` e depois faz JOIN com os dados do pedido/cliente.

```sql
-- Subquery de comissão por lançamento
WITH comissao_lancto AS (
  SELECT
    TRIM(i.ite_pedido)                AS pedido,
    SUM(
      i.ite_totliquido *
      CASE WHEN g.gru_usa_percomiss = TRUE THEN COALESCE(g.gru_percomiss, 0)
           ELSE COALESCE(v.vin_percom, 0)
      END / 100
    )                                 AS comissao,
    COALESCE(MAX(v.vin_percom), 0)    AS percent_display
  FROM itens_ped    i
  JOIN pedidos      p  ON TRIM(p.ped_pedido)   = TRIM(i.ite_pedido)
  JOIN cad_prod     pr ON TRIM(pr.pro_codprod) = TRIM(i.ite_produto)
  LEFT JOIN grupos  g  ON g.gru_codigo         = pr.pro_grupo
  LEFT JOIN vendedor_ind v ON v.vin_codigo     = p.ped_vendedor
                          AND v.vin_industria  = p.ped_industria
  GROUP BY TRIM(i.ite_pedido)
)
SELECT
  f.for_nomered     AS industria_nome,
  c.cli_nomred      AS cliente,
  p.ped_pedido,
  p.ped_data,
  fp.fat_nf,
  fp.fat_datafat,
  p.ped_totliq      AS valor_pedido,
  fp.fat_valorfat,
  cl.percent_display,
  cl.comissao
FROM fatura_ped    fp
JOIN pedidos       p  ON TRIM(p.ped_pedido)  = TRIM(fp.fat_pedido)
JOIN clientes      c  ON c.cli_codigo         = p.ped_cliente
JOIN fornecedores  f  ON f.for_codigo         = fp.fat_industria
JOIN comissao_lancto cl ON cl.pedido          = TRIM(fp.fat_pedido)
WHERE fp.fat_datafat BETWEEN $dataInicio AND $dataFim
  [AND p.ped_vendedor = $vendedor]
  [AND fp.fat_industria = $industria]
ORDER BY f.for_nomered, p.ped_data
```

### Colunas da tabela

| Coluna | Fonte |
|---|---|
| Cliente | `cli_nomred` |
| Pedido | `ped_pedido` |
| Dt. Pedido | `ped_data` |
| Nota | `fat_nf` |
| Data Fat. | `fat_datafat` |
| Valor Ped. | `ped_totliq` |
| Valor Fat. | `fat_valorfat` |
| % | `percent_display` |
| Comissão | `comissao` (calculada via itens + regra de grupos) |

### Agrupamento e totais
- Cabeçalho de grupo: nome da indústria (`for_nomered`) em bold
- Linha de subtotal por grupo: `Sub-total: SUM(fat_valorfat) | Comissão: SUM(comissao)`
- Linha de total geral ao final

---

## Relatório 2 — Faturamento no Período (`faturamento-periodo`)

**Referência**: Delphi "Relatório de faturamentos" (visão do representante/escritório)

### Endpoint
`GET /api/reports/faturamento/periodo`

**Parâmetros**: `dataInicio`, `dataFim` (filtram `fat_datafat`)

### Query
```sql
SELECT
  f.for_nomered                                         AS industria_nome,
  c.cli_nomred                                          AS cliente,
  p.ped_pedido,
  fp.fat_datafat,
  fp.fat_nf,
  fp.fat_valorfat,
  -- fat_percomissind pode ser 'E'/'V' (V2 incorreto) ou numérico (V1 correto).
  -- Fallback para for_percom do fornecedor quando não for numérico.
  COALESCE(
    NULLIF(regexp_replace(fp.fat_percomissind, '[^0-9.]', '', 'g'), '')::NUMERIC,
    f.for_percom,
    0
  )                                                     AS percent_rep,
  ROUND(fp.fat_valorfat *
    COALESCE(
      NULLIF(regexp_replace(fp.fat_percomissind, '[^0-9.]', '', 'g'), '')::NUMERIC,
      f.for_percom,
      0
    ) / 100, 2)                                         AS comissao_rep
FROM fatura_ped   fp
JOIN pedidos      p ON TRIM(p.ped_pedido)  = TRIM(fp.fat_pedido)
JOIN clientes     c ON c.cli_codigo         = p.ped_cliente
JOIN fornecedores f ON f.for_codigo         = fp.fat_industria
WHERE fp.fat_datafat BETWEEN $dataInicio AND $dataFim
ORDER BY f.for_nomered, fp.fat_datafat
```

### Colunas da tabela

| Coluna | Fonte |
|---|---|
| Cliente | `cli_nomred` |
| Pedido | `ped_pedido` |
| Data | `fat_datafat` |
| Nota Fiscal | `fat_nf` |
| Valor Faturado | `fat_valorfat` |
| % | `fat_percomissind` |
| Comissão | `fat_valorfat * fat_percomissind / 100` |

### Agrupamento e totais
- Cabeçalho de grupo: nome da indústria
- Subtotal por grupo: `Faturamento: SUM(fat_valorfat) — Comissão: SUM(comissao_rep)` (label idêntico ao Delphi)
- Total geral ao final

---

## Relatório 3 — Pedidos Faturados no Período (`pedidos-faturados`)

**Referência**: Novo (sem equivalente no V1)

### Endpoint
`GET /api/reports/faturamento/pedidos-faturados`

**Parâmetros**: `dataInicio`, `dataFim` (filtram `fat_datafat`), `industria?`

### Query
Pedidos que têm pelo menos um lançamento em `fatura_ped` no período.

```sql
SELECT
  f.for_nomered                         AS industria_nome,
  p.ped_pedido,
  c.cli_nomred                          AS cliente,
  p.ped_data,
  MIN(fp.fat_datafat)                   AS primeira_fat,
  STRING_AGG(fp.fat_nf, ', ')           AS notas,
  p.ped_totliq                          AS valor_pedido,
  SUM(fp.fat_valorfat)                  AS valor_faturado,
  p.ped_situacao
FROM pedidos      p
JOIN clientes     c  ON c.cli_codigo    = p.ped_cliente
JOIN fornecedores f  ON f.for_codigo    = p.ped_industria
JOIN fatura_ped   fp ON TRIM(fp.fat_pedido) = TRIM(p.ped_pedido)
                    AND fp.fat_datafat BETWEEN $dataInicio AND $dataFim
[AND p.ped_industria = $industria]
GROUP BY f.for_nomered, p.ped_pedido, c.cli_nomred,
         p.ped_data, p.ped_totliq, p.ped_situacao
ORDER BY f.for_nomered, p.ped_data
```

### Colunas da tabela

| Coluna | Fonte |
|---|---|
| Pedido | `ped_pedido` |
| Cliente | `cli_nomred` |
| Dt. Pedido | `ped_data` |
| Data Fat. | `primeira_fat` |
| Nota(s) | `notas` (STRING_AGG) |
| Valor Pedido | `ped_totliq` |
| Valor Faturado | `valor_faturado` |
| Situação | badge "Faturado" (`F`) / "Parcial" (`P`) |

### Agrupamento e totais
- Subtotal por grupo: contagem de pedidos + `SUM(valor_faturado)`

---

## Relatório 4 — Faturamento Pendente (`faturamento-pendente`)

**Referência**: Novo (sem equivalente no V1)

### Endpoint
`GET /api/reports/faturamento/pendente`

**Parâmetros**: `dataInicio`, `dataFim` (filtram `ped_data`), `industria?`

### Query
Pedidos aprovados (`ped_situacao = 'P'`) com saldo a faturar, no período do pedido.

```sql
SELECT
  f.for_nomered                                           AS industria_nome,
  p.ped_pedido,
  c.cli_nomred                                            AS cliente,
  p.ped_data,
  p.ped_totliq                                            AS valor_pedido,
  COALESCE(SUM(fp.fat_valorfat), 0)                      AS total_faturado,
  p.ped_totliq - COALESCE(SUM(fp.fat_valorfat), 0)       AS saldo_pendente,
  (CURRENT_DATE - p.ped_data::DATE)::INT                 AS dias_aberto
FROM pedidos      p
JOIN clientes     c  ON c.cli_codigo     = p.ped_cliente
JOIN fornecedores f  ON f.for_codigo     = p.ped_industria
LEFT JOIN fatura_ped fp ON TRIM(fp.fat_pedido) = TRIM(p.ped_pedido)
WHERE p.ped_situacao = 'P'
  AND p.ped_data BETWEEN $dataInicio AND $dataFim
  [AND p.ped_industria = $industria]
GROUP BY f.for_nomered, p.ped_pedido, c.cli_nomred, p.ped_data, p.ped_totliq
HAVING p.ped_totliq - COALESCE(SUM(fp.fat_valorfat), 0) > 0
ORDER BY f.for_nomered, p.ped_data
```

### Colunas da tabela

| Coluna | Fonte |
|---|---|
| Pedido | `ped_pedido` |
| Cliente | `cli_nomred` |
| Dt. Pedido | `ped_data` |
| Valor Pedido | `ped_totliq` |
| Já Faturado | `total_faturado` |
| Saldo Pendente | `saldo_pendente` |
| Dias em Aberto | `dias_aberto` |

### Agrupamento e totais
- Subtotal por grupo: contagem de pedidos pendentes + `SUM(saldo_pendente)`

---

## Relatório 5 — Produtos Não Faturados (`produtos-nao-faturados`)

**Referência**: Novo (sem equivalente no V1)

### Endpoint
`GET /api/reports/faturamento/produtos-nao-faturados`

**Parâmetros**: `dataInicio`, `dataFim` (filtram `ped_data`), `industria?`

### Query
Itens com `ite_faturado = 'N'` de pedidos ativos no período.

```sql
SELECT
  f.for_nomered                                       AS industria_nome,
  p.ped_pedido,
  p.ped_data,
  c.cli_nomred                                        AS cliente,
  TRIM(i.ite_produto)                                 AS codigo,
  i.ite_nomeprod                                      AS produto,
  i.ite_quant                                         AS qtd_vendida,
  COALESCE(i.ite_qtdfat, 0)                           AS qtd_faturada,
  i.ite_quant - COALESCE(i.ite_qtdfat, 0)            AS saldo
FROM itens_ped    i
JOIN pedidos      p  ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
JOIN clientes     c  ON c.cli_codigo       = p.ped_cliente
JOIN fornecedores f  ON f.for_codigo       = p.ped_industria
WHERE COALESCE(i.ite_faturado, 'N') = 'N'
  AND p.ped_situacao = 'P'
  AND p.ped_data BETWEEN $dataInicio AND $dataFim
  [AND p.ped_industria = $industria]
ORDER BY f.for_nomered, p.ped_data, c.cli_nomred, i.ite_seq
```

### Colunas da tabela

| Coluna | Fonte | Nota |
|---|---|---|
| Pedido | `ped_pedido` | |
| Dt. Pedido | `ped_data` | |
| Cliente | `cli_nomred` | |
| Código | `codigo` | monospace bold (padrão autopeças) |
| Produto | `produto` | |
| Qtd. Vendida | `qtd_vendida` | |
| Qtd. Faturada | `qtd_faturada` | |
| Saldo | `saldo` | |

### Agrupamento e totais
- Subtotal por grupo: total de itens pendentes

---

## PrintHeader (componente compartilhado)

`src/modules/relatorios/components/PrintHeader.tsx`

Busca dados de `/api/empresa` (já existente). Renderizado dentro de cada componente de relatório com `display: none` por padrão e `display: block` via `@media print`. Exibe:
- Nome da empresa, CNPJ, endereço, telefones
- Período do relatório
- Nome do vendedor (quando filtrado)

---

## GruposPage — alteração

Adicionar na ficha de cada grupo:
- Toggle **"Comissão própria"** (`gru_usa_percomiss`)
- Campo **"% Comissão"** (`gru_percomiss`) — visível apenas quando toggle está ativo

O campo `gru_percomiss` já existe na tabela. O toggle é a única adição ao schema (migration 031).

---

## Arquivos a criar/modificar

### Criar
- `src/modules/relatorios/components/PrintHeader.tsx`
- `src/modules/relatorios/components/ComissaoVendedoresReport.tsx`
- `src/modules/relatorios/components/FaturamentoPeriodoReport.tsx`
- `src/modules/relatorios/components/PedidosFaturadosReport.tsx`
- `src/modules/relatorios/components/FaturamentoPendenteReport.tsx`
- `src/modules/relatorios/components/ProdutosNaoFaturadosReport.tsx`

### Modificar
- `src/modules/relatorios/pages/RelatoriosPage.tsx` — registrar os 5 componentes
- `src/modules/grupos/pages/GruposPage.tsx` — toggle + campo gru_percomiss
- `backend/src/modules/reports/reports.routes.ts` — 5 novos endpoints

### Já criado
- `backend/scripts/pgadmin_031_grupos_usa_percomiss.sql`
