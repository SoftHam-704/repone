# Despesas de Viagem — Design

**Data:** 2026-06-03
**Status:** Aguardando revisão
**Origem:** Pedido do REP (Dama) — o promotor deve lançar todas as despesas de viagem
(alimentação, manutenção do veículo, abastecimento, pedágio, hospedagem…) para o gestor
ter controle. Não existe tabela própria no banco.

## Objetivo

Módulo novo para **lançar despesas de viagem no campo** (mobile, com foto do comprovante)
e **acompanhar/relatar** essas despesas (web, gestor). Todos os vendedores/reps podem lançar.
**Sem fluxo de aprovação** — apenas lançamento + relatório (decisão Hamilton 2026-06-03).

## Decisões fechadas

- **Quem lança:** todos os vendedores/reps (não só promotores).
- **Aprovação:** não há. A despesa nasce válida; o gestor só visualiza e soma.
- **Comprovante:** foto obrigatória-quando-houver (anexo opcional por lançamento), já no V1.
- **Destino futuro:** exportar para o Centro de Custo do Financeiro — **fora do V1**.

## Modelo de dados

Migration SQL para pgAdmin + script Node de replicação em todos os schemas de tenant
(padrão do projeto — `feedback_pgadmin_scripts`).

```sql
CREATE TABLE despesas (
  desp_id          SERIAL PRIMARY KEY,
  desp_vendedor    INTEGER NOT NULL,                 -- ven_codigo de quem lançou
  desp_data        DATE NOT NULL,                    -- data da despesa
  desp_categoria   VARCHAR(30) NOT NULL,             -- Combustível|Alimentação|Manutenção|Pedágio|Hospedagem|Outros
  desp_valor       NUMERIC(12,2) NOT NULL,
  desp_descricao   TEXT,
  desp_km          INTEGER,                          -- odômetro (opcional, p/ abastecimento)
  desp_comprovante VARCHAR(255),                     -- nome do arquivo da foto (uploads/despesas/<schema>/)
  desp_criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_despesas_vendedor ON despesas (desp_vendedor);
CREATE INDEX idx_despesas_data     ON despesas (desp_data);
```

Sem `desp_status` (sem aprovação). `desp_vendedor` referencia `vendedores.ven_codigo` (mesma
convenção de `ped_vendedor`); não se cria FK rígida para manter o padrão leve do schema.

## Arquitetura backend — módulo `despesas`

`backend/src/modules/despesas/` com `despesas.controller.ts` + `despesas.routes.ts`,
registrado em `app.ts` sob `/api/despesas`. Router com `authMiddleware + tenantMiddleware`
(usar `req.db!`, nunca pool — `feedback_tenant_isolation`).

### Upload (multer diskStorage, padrão do portal)

```ts
const storage = multer.diskStorage({
  destination: (req, _f, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e6)}${path.extname(file.originalname)}`),
});
export const uploadComprovante = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });
```

> Pasta `uploads/` vive **fora do `dist/`** — não é sobrescrita no deploy. Garantir que o
> servidor a preserve entre deploys.

### Endpoints

- `GET  /api/despesas` — lista. Auto-escopo via `getLinkedSellerId`: operador vê só as suas
  (`desp_vendedor = sellerId`); gestor/master (sellerId null) vê todas. Filtros opcionais:
  `vendedor`, `categoria`, `de`, `ate` (datas).
- `POST /api/despesas` — cria. `upload.single('comprovante')` (multipart). Campos no body:
  `desp_data, desp_categoria, desp_valor, desp_descricao, desp_km`. O `desp_vendedor` é
  resolvido no backend a partir do usuário logado (`getLinkedSellerId`); se for gestor/master
  sem vínculo, aceita `desp_vendedor` do body. Salva `desp_comprovante` = nome do arquivo (se enviado).
- `DELETE /api/despesas/:id` — remove. Operador só remove as suas (ownership check, como nas rotas).
- `GET  /api/despesas/relatorio` — agregados: total geral, por categoria e por vendedor no
  período/filtro. Mesmo auto-escopo.
- `GET  /api/despesas/comprovante/:arquivo` — serve a foto **autenticado** (não via express.static
  público — recibo é privado). Valida que o arquivo pertence a uma despesa do tenant (e, para
  operador, a uma despesa dele) antes de enviar com `res.sendFile`.

## Arquitetura mobile (todos os reps)

- **Card "Despesas"** no home (`src/mobile/pages/HomePage.tsx` `ACTIONS`) → `/mobile/despesas`.
- **`src/mobile/pages/DespesasPage.tsx`** — lista das próprias despesas (mais recentes primeiro),
  com **total do mês** no topo; botão flutuante "+ Nova". Cada item: categoria, valor, data,
  miniatura do comprovante (se houver).
- **Lançamento** (modal ou `DespesaFormPage`): categoria (chips/SearchCombobox), valor (R$),
  data (default hoje), descrição, km (aparece só p/ Combustível), e **foto do comprovante**
  via `<input type="file" accept="image/*" capture="environment">`.
  - **Redimensionar no cliente** antes de subir (canvas → ~1280px, JPEG ~0.7) para não pesar no 4G.
  - Envia `multipart/form-data` para `POST /api/despesas`.
- Rotas em `src/mobile/MobileApp.tsx`: `<Route path="despesas" element={<DespesasPage />} />`.
- V1 **online** (upload exige rede). Fila offline fica para depois.

## Arquitetura web (gestor)

- **`src/modules/despesas/pages/DespesasPage.tsx`** — tela de controle:
  filtros (vendedor, categoria, período); tabela de lançamentos; **totais por categoria** e
  total geral; abrir/visualizar o comprovante; **exportar** (CSV e/ou PDF, padrão dos relatórios).
  **Sem botões de aprovar/reprovar.**
- Rota no app web + item de menu (seguir padrão de `routeConfig`/`AppSidebar`). Visível para
  gestor/master (e, se fizer sentido, ao próprio rep ver as suas — decidir no plano; default:
  gestor/master).
- Design System Areia+Navy (`reference_ui_ux_checklist`).

## Fluxo de dados

```
Mobile: DespesaForm → (resize foto) → POST /api/despesas (multipart) → grava linha + arquivo
        DespesasPage → GET /api/despesas (auto-escopo: só as do rep) → lista + total do mês
Web:    DespesasPage(gestor) → GET /api/despesas?filtros + GET /api/despesas/relatorio → tabela+totais
        clicar comprovante → GET /api/despesas/comprovante/:arq (autenticado)
```

## Tratamento de erros / bordas

- Upload sem foto → `desp_comprovante` nulo (permitido).
- Arquivo > 8MB ou tipo não-imagem → multer rejeita; mobile mostra erro amigável.
- Valor inválido / categoria vazia → 400 com mensagem.
- Operador tentando ver/excluir despesa de outro → 403 (ownership, padrão das rotas).
- `getLinkedSellerId` retorna null para gestor/master → enxerga tudo (visão de controle).

## Testes (piloto manual)

- Rep lança despesa com foto → aparece na lista, total do mês soma.
- Rep só vê as próprias; gestor vê todas com filtros e totais por categoria.
- Comprovante abre autenticado; outro rep não acessa o arquivo alheio.
- Export gera o arquivo com os lançamentos filtrados.

## Fora de escopo (V1)

- Aprovação/reprovação de despesas.
- Exportar/integrar com Centro de Custo do Financeiro.
- Lançamento offline com fila de sync.
- Edição de despesa (V1: criar + excluir; editar entra depois se necessário).
- Limites/políticas por categoria (teto de diária etc.).
