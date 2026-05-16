# WhatsApp → Rascunho de Pedido (Status J) — Design Spec

**Data:** 2026-05-16
**Status:** Aprovado

---

## Problema

Reps reportaram que lojistas (clientes já cadastrados) preferem mandar pedidos pelo WhatsApp a usar o Portal do Lojista. O portal é bom, mas exige mudança de comportamento. A solução é capturar o pedido onde o lojista já está e usar o portal como destino de revisão, não como ponto de entrada.

## Objetivo

Quando um cliente cadastrado mandar uma mensagem de WhatsApp com intenção de pedido, a IRIS:
1. Detecta automaticamente que é um pedido
2. Resolve os produtos (inclusive por código de concorrente)
3. Cria um rascunho de pedido com status 'J' no sistema
4. Confirma o recebimento para o lojista
5. Notifica a fila compartilhada para qualquer rep revisar

---

## Arquitetura

### Ponto de desvio: `getFichaCliente()`

O orquestrador já chama `getFichaCliente()` para todo remetente. O retorno determina o caminho:

```
processMessage()
    ↓
getFichaCliente()
    ├── não é cliente → rotaIA() [fluxo de lead, sem alteração]
    └── é cliente     → rotaClientePedido() [novo]
                            ↓
                    detectarIntencaoPedido()
                            ├── não é pedido → resposta de atendimento simples
                            └── é pedido     → resolverItensPedido()
                                                    ↓
                                             criarRascunhoWhatsApp()
                                                    ↓
                                             responde lojista + fila rep
```

O fluxo de leads existente não é alterado.

---

## Novos Módulos

### `whatsapp-pedido.service.ts` (arquivo novo)

#### `detectarIntencaoPedido(conteudo: string): Promise<DeteccaoPedido>`

Chamada Claude com system prompt focado exclusivamente em extração de itens de pedido. Não qualifica lead — só extrai.

Retorno:
```typescript
interface DeteccaoPedido {
  eh_pedido:  boolean;
  itens: Array<{
    codigo_enviado: string;   // exatamente como o lojista mandou
    quantidade:     number;   // 1 se não informado
  }>;
}
```

Exemplos que ativam `eh_pedido: true`:
- "20 PH3682, 10 correia Gates K060475"
- "Preciso de filtros: WL7200 x5, ar 2031 x2"
- "manda 3 jogo de pastilhas dianteira sandero"

Exemplos que retornam `eh_pedido: false`:
- "qual o prazo de entrega?"
- "tem desconto para quantidade?"
- "boa tarde"

#### `resolverItensPedido(db, itens, cli_codigo): Promise<ResoluçãoItens>`

Cadeia de resolução por item — esgota todas as tentativas antes de marcar como não encontrado:

```
1. pro_codprod = codigo_enviado (exact)
2. pro_codigonormalizado = normalizar(codigo_enviado)  ← remove traços, pontos, espaços
3. pro_conversao = codigo_enviado (exact)              ← códigos de concorrentes
4. pro_conversao normalizado
5. pro_nome ILIKE '%codigo_enviado%'                   ← busca por nome
6. → não encontrado
```

Para itens resolvidos: busca preço em `cad_tabelaspre` via tabela da relação `cli_ind` do cliente.

Retorno:
```typescript
interface ResoluçãoItens {
  resolvidos: Array<{
    pro_id:         number;
    pro_codprod:    string;
    pro_nome:       string;
    quantidade:     number;
    preco_unitario: number;   // 0 se tabela não encontrada
  }>;
  nao_resolvidos: Array<{
    codigo_enviado: string;
    quantidade:     number;
  }>;
}
```

**Regra de quantidade:** se o lojista não informar quantidade, `ite_quant = 1`.

#### `criarRascunhoWhatsApp(db, cli_codigo, resolucao, conversa_id): Promise<string>`

Transação atômica — retorna `ped_pedido` (número do pedido):

1. Cria `pedidos` com:
   - `ped_situacao = 'J'`
   - `ped_cliente = cli_codigo`
   - `ped_vendedor = NULL` (fila compartilhada — qualquer rep pode revisar)
   - `ped_industria = NULL` (rep define na revisão; produtos de múltiplas indústrias ficam no mesmo rascunho)
   - `ped_data = CURRENT_DATE`
   - `ped_pedido` gerado no padrão existente (próximo número disponível)
2. Insere itens resolvidos em `itens_ped` com `ite_puni` do preço da tabela
3. Insere itens não resolvidos em `itens_ped` com `ite_puni = 0` e `ite_nomeprod = '[NÃO ENCONTRADO] ' || codigo_enviado`
4. Atualiza `wpp_conversa.pedido_id = novo_pedido_numero`

---

### Alterações em `whatsapp-orchestrator.ts`

#### Nova função `rotaClientePedido()`

Substitui `rotaIA()` quando `getFichaCliente()` retorna cliente:

```typescript
async function rotaClientePedido(db, conversa, contato, mensagem, fichaCliente) {
  // 1. Detectar intenção
  const deteccao = await detectarIntencaoPedido(mensagem.content);

  if (!deteccao.eh_pedido) {
    // Não é pedido → cai no fluxo IRIS normal (dúvidas, reclamações, etc.)
    await rotaIA(db, conversa, contato, mensagem, fichaCliente);
    return;
  }

  // 2. Resolver itens
  const resolucao = await resolverItensPedido(db, deteccao.itens, fichaCliente.cli_codigo);

  // 3. Criar rascunho
  const numeroPedido = await criarRascunhoWhatsApp(db, fichaCliente.cli_codigo, resolucao, conversa.id);

  // 4. Responder lojista
  const naoEncontrados = resolucao.nao_resolvidos.length;
  const msg = naoEncontrados > 0
    ? `Recebi seu pedido (${numeroPedido})! ${naoEncontrados} item(s) precisam de verificação. Nosso time confirma em breve.`
    : `Recebi seu pedido (${numeroPedido})! Nosso time confirma em breve.`;
  await enviarResposta(db, conversa, contato, msg);
}
```

---

## Migration

**Arquivo:** `backend/migrations/047_status_j_whatsapp.sql`

```sql
-- Migration 047: status 'J' — cotação WhatsApp aguardando revisão do rep
-- ped_situacao é VARCHAR livre, não precisa alterar constraint.
-- Apenas documenta e cria índice para performance da fila.

COMMENT ON COLUMN pedidos.ped_situacao IS
  'P=pendente, F=faturado, C=cotação, Q=fila, E=excluído, J=WhatsApp (aguardando revisão)';

CREATE INDEX IF NOT EXISTS idx_pedidos_situacao_j
  ON pedidos(ped_situacao) WHERE ped_situacao = ''J'';
```

Script pgAdmin para todos os schemas (padrão das migrations 043-046):

```sql
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
    WHERE table_name = 'pedidos'
      AND table_schema NOT IN ('pg_catalog','information_schema','public')
    ORDER BY table_schema
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_pedidos_situacao_j ON %I.pedidos(ped_situacao) WHERE ped_situacao = ''J''',
      s
    );
    RAISE NOTICE 'Schema % — índice J criado.', s;
  END LOOP;
END;
$$;
```

---

## Frontend — `PedidosPage.tsx`

### Badge no menu lateral
Contador de pedidos 'J' pendentes no item de menu "Pedidos", igual ao badge do WhatsApp hoje. Busca via endpoint existente com filtro `situacao=J`.

### Tab "WhatsApp" na PedidosPage
Novo filtro ao lado dos existentes. Exibe apenas `ped_situacao='J'`, ordenado por `created_at DESC`.

### Card do pedido 'J'
- Nome do cliente + telefone WhatsApp (via `wpp_contato` pelo `wpp_conversa.pedido_id`)
- Itens resolvidos: fonte normal, com preço
- Itens não resolvidos: destaque amarelo, preço em branco, texto original do lojista
- Botão **"Revisar e Confirmar"** → abre `PedidoModal` existente carregado com os itens
- Rep edita o que precisar → salva → `ped_situacao` vai para 'P' ou 'C'

### Evento no terminal IRIS (PortalHome)
`irisEventosHandler` inclui novo tipo `[WHATSAPP_PEDIDO]`: quando um 'J' é criado, aparece no feed de eventos da home com cliente, número do pedido e quantidade de itens.

---

## Fluxo Completo de Ponta a Ponta

```
Lojista WhatsApp: "20 PH3682, 10 correia Gates K060475"
    ↓
IRIS detecta: eh_pedido=true, 2 itens
    ↓
Resolução:
  PH3682 → pro_conversao match → pro_id=1234, R$12,50
  K060475 → pro_codigonormalizado match → pro_id=5678, R$47,00
    ↓
Pedido J criado: HS000042
  itens_ped: PH3682 x20 R$250,00 | K060475 x10 R$470,00
    ↓
WhatsApp lojista: "Recebi seu pedido (HS000042)! Nosso time confirma em breve."
    ↓
RepOne — fila WhatsApp: "HS000042 — 2H Contagem — 2 itens — agora"
    ↓
Rep abre, confere, clica Confirmar → ped_situacao='P'
    ↓
[futuro] WhatsApp lojista: "Seu pedido HS000042 foi confirmado!"
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `backend/src/modules/whatsapp/whatsapp-pedido.service.ts` | Criar |
| `backend/src/modules/whatsapp/whatsapp-orchestrator.ts` | Modificar |
| `backend/migrations/047_status_j_whatsapp.sql` | Criar |
| `src/modules/pedidos/pages/PedidosPage.tsx` | Modificar |
| `src/modules/dashboard/pages/PortalHome.tsx` | Modificar |
| `backend/src/modules/dashboard/dashboard.controller.ts` | Modificar |

---

## Fora de Escopo (próximas versões)

- Confirmação de volta ao lojista quando rep aprovar o pedido
- Lojista responder "não" para cancelar o rascunho
- Suporte a imagens/fotos de lista de pedido (multimodal)
- Histórico de pedidos do lojista respondido pela IRIS ("qual o status do meu pedido?")
