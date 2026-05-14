# CRM RepOne — Campo Digital + Escritório Integrado
**Data:** 2026-05-14
**Status:** Aprovado para implementação

---

## 1. Contexto e Motivação

O CRM é o segundo módulo mais importante do RepOne, perdendo apenas para Pedidos. Nenhum CRM genérico do mercado atende representações comerciais de autopeças — todos são horizontais. O RepOne tem a oportunidade de ser **o único CRM verticalmente especializado nesse segmento**.

O banco já possui uma arquitetura V2 (`repcrm_*`) completa e bem projetada que nunca foi exposta ao usuário. Paralelamente existe uma arquitetura V1 (`crm_*`) que o controller atual usa, porém nenhum cliente está em produção ainda. **Este é o momento de cortar o V1 e construir exclusivamente sobre o V2.**

### Problema central
O checkout de visita não captura **resultado** (positivou / não positivou). Sem esse dado, o CRM é cego: sabe que o promotor foi ao cliente, mas não sabe se saiu com pedido. A **taxa de positivação** é o KPI mais importante de uma representação de autopeças e hoje é zero.

---

## 2. Visão Geral da Solução

O CRM opera em dois pilares complementares que convergem na **Central de Comando** (portal home) e na **Ficha do Cliente**.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CENTRAL DE COMANDO                          │
│         (Portal Home — alimentada pelo IRIS periodicamente)     │
│  Pipeline │ Follow-ups │ Positivação Hoje │ Campo Ao Vivo       │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                        ▼
┌──────────────────┐    ┌─────────────────────┐
│  PILAR 1: CAMPO  │    │  PILAR 2: ESCRITÓRIO │
│  (Mobile-first)  │    │  (Web)               │
│                  │    │                      │
│  Check-in GPS    │    │  Agendar compromisso │
│  Catálogo+Pedido │    │  Registrar ligação   │
│  Checkout+Result │    │  Follow-ups          │
│  → repcrm_visita │    │  → repcrm_atividade  │
└────────┬─────────┘    └──────────┬───────────┘
         │                         │
         └──────────┬──────────────┘
                    ▼
         ┌─────────────────────┐
         │  FICHA DO CLIENTE   │
         │  Timeline unificada │
         │  Visitas+Ligações   │
         │  +Pedidos+Agenda    │
         └─────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │        IRIS         │
         │  Análise periódica  │
         │  → atualiza cards   │
         │  → gera alertas     │
         │  → briefing campo   │
         └─────────────────────┘
```

---

## 3. Consolidação do Banco de Dados

### 3.1 Tabelas a ELIMINAR (V1 — nunca usadas em produção)

| Tabela | Substituta V2 |
|--------|---------------|
| `crm_interacao` | `repcrm_atividade` |
| `crm_interacao_industria` | `repcrm_atividade` + metadata jsonb |
| `crm_agenda` | `repcrm_atividade` tipo=reuniao/tarefa |
| `crm_alerta` | `repcrm_notificacao` |
| `crm_sellout` | descartada — sem substituta nesta fase |
| `registro_visitas` | `repcrm_visita` |

### 3.1b Tabelas V1 a MANTER (ainda sem equivalente V2 pronto)

| Tabela | Motivo |
|--------|--------|
| `crm_oportunidades` | Pipeline de vendas ativo no portal home |
| `crm_followups` | Follow-ups funcionando, KPIs no portal home |
| `crm_funil_etapas` | Configuração do pipeline |

### 3.2 Tabelas V2 que passam a ser ATIVAS

| Tabela | Papel |
|--------|-------|
| `repcrm_visita` | Check-in/checkout + resultado + pedido_id |
| `repcrm_atividade` | Ligações, WhatsApp, reuniões, notas, tarefas |
| `repcrm_cliente` | Clientes enriquecidos (ABC, frequência, última visita) |
| `repcrm_cliente_industria` | Faturamento por indústria por cliente |
| `repcrm_comprador` | Contatos/compradores dentro do cliente |
| `repcrm_rota` | Rotas de visita dos promotores |
| `repcrm_notificacao` | Alertas e notificações |
| `repcrm_comissao` | Controle de comissões (fase futura) |

### 3.3 Migração necessária: `registro_visitas` → `repcrm_visita`

Script SQL de migração:
- Copiar registros de CHECKIN para `repcrm_visita` com `resultado = null`
- Calcular `duracao_minutos` a partir do CHECKOUT correspondente
- Popular `cli_codigo` e `ven_codigo` para compatibilidade

---

## 4. Pilar 1 — Campo (Mobile-first)

### 4.1 Fluxo do Promotor

```
1. Abre app → lista de clientes do dia (rota planejada ou livre)
2. Chega no cliente → botão CHECK-IN
   → captura GPS atual
   → INSERT em repcrm_visita: {cli_codigo, ven_codigo, data, checkin_hora, checkin_lat, checkin_lng}
   → retorna o id da visita — fica em memória no app
3. Durante a visita → catálogo de produtos + criar pedido/cotação
   → pedido fica vinculado ao id da visita (campo ped_visita_id na tabela pedidos)
4. Ao sair → botão CHECK-OUT obrigatório
   → tela de resultado:
     ┌─────────────────────────────────┐
     │  Como foi a visita?             │
     │                                 │
     │  ✅ Positivou (saí com pedido)  │
     │  ❌ Não positivou               │
     │  📅 Reagendou                   │
     │  🚪 Ausente (loja fechada)      │
     └─────────────────────────────────┘
   → Se "Não positivou": campo obrigatório "Por quê?"
     (sem estoque / sem interesse / preço / concorrência / outro)
   → captura GPS checkout
   → calcula duracao_minutos = diferença entre checkout_hora e checkin_hora
   → UPDATE repcrm_visita SET resultado, motivo_nao_positivou, checkout_hora,
     checkout_lat, checkout_lng, duracao_minutos WHERE id = vis_id_em_memoria
```

### 4.2 Campos `repcrm_visita` utilizados

```sql
resultado          → enum: positivou/nao_positivou/reagendou/ausente/fechado
motivo_nao_positivou → text (obrigatório quando resultado = nao_positivou)
pedido_id          → FK pedidos (preenchido automaticamente se houver pedido na visita)
checkin_latitude/longitude
checkout_latitude/longitude
duracao_minutos    → calculado no momento do checkout
notas              → observação livre do promotor
```

### 4.3 Validações

- CHECK-OUT bloqueia se não selecionar resultado
- Se criou pedido durante a visita e selecionar "Não positivou" → alerta de inconsistência
- Distância máxima do cliente configurável por tenant (ex: 500m) — alerta se ultrapassar

---

## 5. Pilar 2 — Escritório (Web)

### 5.1 Modal "Nova Atividade" (já existe — refinar)

O modal atual tem duas abas:

**Aba: Agendar Compromisso**
- Salva em `repcrm_atividade` com tipo = `reuniao` ou `tarefa`
- Campos: cliente, assunto, data, hora, prioridade, descrição
- Aparece na agenda do vendedor responsável

**Aba: Registrar Atendimento (Telemarketing)**
- Salva em `repcrm_atividade` com tipo = `ligacao`
- Campos: cliente, indústrias abordadas (multi-select), resultado da ligação, duração, observação
- Resultado: interessado / não interessou / sem resposta / agendou visita / gerou pedido

### 5.2 Agenda do Escritório

- Calendário semanal mostrando compromissos agendados
- Filtro por vendedor/promotor
- Indicador de visitas de campo no mesmo calendário (integração visual)
- Status: pendente / realizado / cancelado

### 5.3 Follow-ups

- Mantém estrutura atual (`crm_followups`)
- KPIs do header: Atrasados / Hoje / Semana
- Associado a cliente + oportunidade opcional

---

## 6. Painel de Campo — Visão do Diretor (Web)

### 6.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  CAMPO AO VIVO          Hoje: 14/05/2026   [Filtros]│
├──────────────┬──────────────────────────────────────┤
│ KPI STRIP    │  ✅ 8 Positivações  📍 12 Visitas     │
│              │  ❌ 3 Não positivaram  💰 R$24.800   │
├──────────────┴──────────────────────────────────────┤
│                                                     │
│  [MAPA]  Pins coloridos por status:                 │
│          🟢 Em visita agora                         │
│          🔵 Checkout feito (positivou)              │
│          🔴 Checkout feito (não positivou)          │
│          ⚪ Planejado (ainda não visitou)           │
│                                                     │
├─────────────────────────────────────────────────────┤
│  CARDS POR PROMOTOR                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ João Silva   │ │ Pedro Lima   │ │ Ana Costa   │ │
│  │ 🟢 Em visita │ │ 5 visitas    │ │ 3 visitas   │ │
│  │ Auto Freios  │ │ 4 positiv.   │ │ 2 positiv.  │ │
│  │ desde 14:32  │ │ R$12.400     │ │ R$8.200     │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.2 Atualização dos dados

- Polling a cada **30 segundos** (sem necessidade de WebSocket para começo)
- Ao clicar em um card de promotor: expande detalhes das visitas do dia
- Ao clicar em um pin do mapa: mostra popup com dados da visita

### 6.3 Integração com Central de Comando (Portal Home)

O card "CRM" na Central de Comando exibe:
- Taxa de positivação do dia (%)
- Total de pedidos gerados em campo hoje
- Promotores ativos agora (count)
- Alertas pendentes de follow-up

---

## 7. IRIS — Motor de Inteligência

### 7.1 Papel do IRIS no CRM

IRIS não é um chatbot. É um **agente de análise periódica** que roda via cron job e alimenta a Central de Comando com insights prontos.

### 7.2 Jobs periódicos do IRIS

| Job | Frequência | O que faz |
|-----|------------|-----------|
| `iris_campo_diario` | Todo dia às 8h | Analisa carteira do dia, gera briefing por promotor |
| `iris_alerta_churn` | 3x/semana | Detecta clientes em risco, cria alertas no portal |
| `iris_positivacao` | Ao fim do dia (18h) | Calcula taxa de positivação do dia, atualiza cards |
| `iris_oportunidade` | Semanalmente | Identifica clientes com gap de categorias (cross-sell) |

### 7.3 Briefing Pré-Visita (fase 2)

Antes do check-in, o promotor vê no mobile:
> "**Distribuidora XYZ** — Última compra há 42 dias. Compram linha leve mas nunca compraram linha pesada (oportunidade). Pediram prazo estendido na última visita."

Gerado via Claude API com prompt que combina:
- Histórico de pedidos do cliente (últimos 90 dias)
- Última visita (resultado, notas)
- Produtos da indústria que o cliente nunca comprou
- Alertas de risco da carteira viva

### 7.4 Cards da Central de Comando

IRIS atualiza uma tabela `iris_insights` (a criar) com `{tipo, valor, descricao, atualizado_em}`. O portal home consome essa tabela — nunca recalcula na hora.

---

## 8. Ficha do Cliente — Timeline Unificada

### 8.1 Estrutura da timeline

Ordenada por data DESC, intercalando eventos de diferentes origens:

```
📦 14/05 — Pedido #1847 — R$ 3.200 (Fremax)
📍 14/05 — Visita — João Silva — 45min — ✅ Positivou
📞 12/05 — Ligação — Telemarketing — "Interesse em linha pesada"
📅 10/05 — Compromisso — "Apresentação catálogo Bosch"
📦 08/05 — Pedido #1821 — R$ 1.800 (Bosch)
📍 07/05 — Visita — João Silva — 22min — ❌ Não positivou — "Sem estoque"
```

### 8.2 Indicadores do cabeçalho da ficha

- Última visita: data + resultado
- Última compra: data + valor
- Taxa de positivação (últimas 10 visitas): 70%
- Classificação ABC automática
- Indústrias ativas (comprou nos últimos 90 dias)

---

## 9. Arquitetura Técnica

### 9.1 Backend — novos endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/crm/campo/ao-vivo` | Estado atual de todos promotores + visitas abertas do dia |
| `GET` | `/crm/campo/historico-dia` | Todas as visitas do dia com resultado |
| `POST` | `/crm/visitas/checkin` | Check-in com GPS |
| `POST` | `/crm/visitas/checkout` | Checkout com resultado obrigatório |
| `GET` | `/crm/atividades` | Lista atividades (ligações, reuniões) com filtros |
| `POST` | `/crm/atividades` | Cria atividade (agenda ou atendimento) |
| `PUT` | `/crm/atividades/:id` | Atualiza atividade |
| `GET` | `/crm/clientes/:id/timeline` | Timeline unificada do cliente |
| `GET` | `/crm/insights/cards` | Cards do IRIS para portal home |

### 9.2 Tabela auxiliar para IRIS

```sql
CREATE TABLE iris_insights (
  id          SERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  tipo        TEXT NOT NULL,  -- 'positivacao_dia', 'churn_alerta', 'campo_ao_vivo', etc.
  payload     JSONB NOT NULL,
  gerado_em   TIMESTAMPTZ DEFAULT NOW(),
  valido_ate  TIMESTAMPTZ  -- null = sem expiração
);
```

### 9.3 Frontend — novas páginas/componentes

| Componente | Localização |
|-----------|-------------|
| `CampoAoVivoPage` | `src/modules/crm/pages/CampoAoVivoPage.tsx` |
| `PromotorCard` | `src/modules/crm/components/PromotorCard.tsx` |
| `CheckoutResultadoModal` | `src/mobile/components/CheckoutResultadoModal.tsx` |
| `AtividadeModal` | `src/modules/crm/components/AtividadeModal.tsx` (refatorar o existente) |
| `ClienteTimeline` | `src/modules/crm/components/ClienteTimeline.tsx` |
| `IrisInsightCard` | `src/shared/components/IrisInsightCard.tsx` |

### 9.4 Mapa

Usar **Leaflet.js** (já presente no projeto) com tiles OpenStreetMap. Pins renderizados como SVG colorido por status. Sem custo de API de mapas.

---

## 10. Fases de Implementação

### Fase 1 — Fundação (Urgente)
1. Migration SQL: criar `iris_insights`, adicionar campos faltantes em `repcrm_visita`
2. Mobile: adicionar tela de resultado no checkout (positivou / não positivou / etc.)
3. Backend: endpoint de checkout atualizado capturando resultado
4. Backend: endpoint `/crm/campo/ao-vivo`
5. Web: `CampoAoVivoPage` com cards de promotores + polling 30s

### Fase 2 — Escritório
6. Refatorar `AtividadeModal` para salvar em `repcrm_atividade` (V2)
7. Backend: endpoints de atividades
8. Web: agenda semanal no escritório

### Fase 3 — Inteligência
9. Timeline unificada do cliente
10. IRIS cron jobs: positivação diária, alertas de churn
11. Cards do IRIS na Central de Comando
12. Briefing pré-visita no mobile (Claude API)

---

## 11. Regras de Negócio Específicas de Autopeças

- **Positivação**: visita com resultado `positivou` E pedido_id preenchido. Taxa = positivações / total visitas.
- **Frequência de visita**: cada cliente tem `frequencia_visita_dias` ideal. IRIS alerta quando ultrapassado.
- **Classificação ABC**: A = top 20% faturamento, B = 30%, C = 50% — recalculada mensalmente.
- **Carteira viva**: cliente é "ativo" se comprou nos últimos 90 dias. "Risco" se 91-120 dias. "Inativo" se >120 dias.
- **Mix de indústrias**: cliente saudável compra de ≥2 indústrias. Concentração em 1 = risco de churn.
- **Dia preferencial de visita**: `dia_preferencial_visita` no cliente — IRIS inclui no briefing e no planejamento de rota.

---

## 12. Manual do Usuário — Roteiro

A seção do CRM no manual terá tratamento especial: é o módulo de maior diferenciação do RepOne no mercado.

### 12.1 Estrutura da seção CRM no manual

```
CRM RepOne — O CRM que entende autopeças

1. Por que o CRM RepOne é diferente
   - CRMs genéricos vs representação especializada
   - O conceito de positivação (e por que nenhum outro CRM tem isso)
   - A carteira viva como ativo do representante

2. Campo Digital — O Promotor em Ação
   2.1 Fazendo Check-in (mobile)
   2.2 Usando o catálogo durante a visita
   2.3 Registrando pedido na frente do lojista
   2.4 Checkout com resultado: a informação mais importante
   2.5 O que acontece quando você não positivou (motivos e aprendizado)

3. Central de Comando — A Visão do Diretor
   3.1 Painel de Campo Ao Vivo (mapa + cards de promotores)
   3.2 Taxa de positivação: como ler e agir
   3.3 KPIs do dia: visitas, pedidos, valor gerado em campo

4. Escritório — Telemarketing e Agenda
   4.1 Registrando uma ligação de atendimento
   4.2 Agendando um compromisso
   4.3 Follow-ups: nunca deixe um cliente esfriar

5. Carteira Viva (integração com Portal Home)
   5.1 Clientes Ativos, Em Risco, Inativos
   5.2 Como interpretar os alertas do IRIS
   5.3 Ação rápida sobre clientes em risco

6. IRIS no CRM
   6.1 Briefing pré-visita: o que ler antes de entrar no cliente
   6.2 Alertas automáticos de churn
   6.3 Oportunidades de cross-sell identificadas pela IA

7. Glossário de Autopeças para o CRM
   - Positivação, Mix de Pastas, Carteira Viva, ABC, Sell-in/Sell-out
   - Vagas territoriais, Frequência de visita, OTIF
```

### 12.2 Roteiro do Podcast

O podcast será o manual em formato de áudio — ideal para o representante ouvir no carro entre visitas.

**Formato:** episódios curtos (8-12 min), estilo conversa entre dois apresentadores.
**Tom:** prático, direto, exemplos reais de autopeças. Sem jargão técnico.

```
Episódio 01 — "Por que você precisa de um CRM de autopeças?"
  - O problema do CRM genérico para representantes
  - O que muda quando o sistema entende o seu negócio

Episódio 02 — "Positivação: o número que define sua carreira"
  - O que é taxa de positivação e por que ela importa
  - Como o RepOne calcula e exibe esse número
  - Benchmark: o que é uma boa taxa no setor

Episódio 03 — "A visita perfeita: do check-in ao checkout"
  - Passo a passo do campo digital no mobile
  - Como fazer o pedido na frente do lojista
  - O checkout que gera inteligência para o negócio

Episódio 04 — "Central de Comando: o que o diretor vê em tempo real"
  - O mapa ao vivo da equipe em campo
  - Como ler os cards de promotores
  - Tomada de decisão baseada em dados do campo

Episódio 05 — "Telemarketing que converte: registrando atendimentos"
  - A diferença entre ligar e registrar a ligação
  - Como o histórico de ligações alimenta o CRM
  - Follow-ups: a arte de não deixar esfriar

Episódio 06 — "Carteira Viva: seu ativo mais valioso"
  - Clientes ativos, em risco e inativos
  - Como o IRIS detecta quem está prestes a sumir
  - Ação rápida: o que fazer quando o alerta aparece

Episódio 07 — "IRIS: sua IA de autopeças"
  - O briefing pré-visita que o promotor recebe todo dia
  - Oportunidades de cross-sell que o olho humano não vê
  - O futuro: CRM que recomenda, não só registra
```

**Produção:** gerado com texto do manual → TTS via API (ElevenLabs ou similar) ou gravação manual.
**Distribuição:** áudio embedado no próprio sistema (Centro de Aprendizado já existe) + Spotify/RSS futuramente.

---

## 14. O que NÃO está no escopo desta fase

- Portal do cliente/lojista (spec separada)
- Comissões automáticas (tabelas prontas, implementation futura)
- Sell-out (dados do cliente final — requer integração externa)
- Geofencing automático (bloquear checkout fora do raio)
- Integração com Google Maps para otimização de rota
