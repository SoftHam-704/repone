# Rotas no Mobile — Design

**Data:** 2026-06-03
**Autor:** Hamilton × IRIS/Claude
**Status:** Aguardando revisão

## Contexto

O REP precisa, no celular, **consumir** as rotas (itinerários) que já são cadastradas no app web.
O cadastro/edição continua exclusivo do web — no mobile o vendedor seleciona uma rota e vê,
no mapa, todos os clientes a visitar dentro daquela rota, com os km previstos.

### O que já existe (reaproveitar)

- **Backend `itinerarios`** completo e em produção:
  - `GET /api/itinerarios?vendedor=<ven>` — lista de rotas (descrição, frequência, região, vendedor, `total_paradas`).
  - `GET /api/itinerarios/:id/paradas` — paradas **ordenadas** (`itp_ordem`), cada uma com
    `cli_latitude`/`cli_longitude` (COALESCE GPS real do cliente → centro da cidade), flag `gps_real`,
    endereço, `cli_fone1`, nome reduzido (`cli_nomred`) e fantasia.
  - Demais endpoints (create/update/delete/reorder paradas) **não usados no mobile**.
- **Web `ItinerariosPage.tsx`** já renderiza o mapa com Leaflet:
  - Componente `RotaMap`: marcadores **numerados na ordem** + polyline tracejada + badge de km.
  - Cálculo de km: **Haversine entre paradas consecutivas × 1.3** (fator rota-real vs linha-reta),
    rotulado como `~X km estimados`. → **é o "km previsto" que o REP quer.**
- **Leaflet já instalado** no projeto (`leaflet`, `react-leaflet`, `@types/leaflet`).
- **BottomNav mobile** tem 6 slots fixos: Home · Clientes · Pedidos · **Pontos** · Sell-Out · BI.
  - "Pontos" → `/mobile/aftermarket` (funil de prospecção de pontos de venda do aftermarket).

## Decisões

1. **Navbar:** o slot **"Pontos"** vira **"Rotas"** (ícone `Route`/`Navigation`, `/mobile/rotas`).
   Mantém os 6 slots — sem 7º botão (limite confortável da barra).
2. **Pontos não é removido:** a rota `/mobile/aftermarket` continua viva; o acesso ao funil de
   aftermarket passa a ser um **atalho na Home mobile** (placement exato a confirmar contra o layout
   atual da `HomePage.tsx` na implementação).
3. **Escopo mobile = consumo:** sem cadastro/edição/reordenação de rotas no celular.
4. **Mapa:** reusar o padrão `RotaMap` do web (Leaflet, marcadores numerados, polyline, badge de km).
5. **KM previsto:** mesma fórmula do web (Haversine × 1.3), rotulado `~X km estimados`.
6. **Ação ao tocar num cliente:** navegar (abre Google Maps/Waze **até aquele cliente**).
7. **Navegar rota inteira:** botão no topo abre Google Maps com **todas as paradas como waypoints
   na ordem** (multi-parada; limite ~9-10 waypoints do Google Maps — ver Riscos).

## Arquitetura

### Rotas de navegação (MobileApp.tsx)

```
/mobile/rotas        → RotasPage      (lista de rotas do REP)
/mobile/rotas/:id    → RotaMapaPage   (mapa + paradas + navegar)
/mobile/aftermarket  → AftermarketPage (mantida; sai da navbar)
```

### Componentes novos (`src/mobile/`)

- **`pages/RotasPage.tsx`**
  - Carrega `GET /itinerarios?vendedor=<ven do REP logado>`.
  - Master/Gerência: sem filtro de vendedor (vê todas). Operador: filtra pela própria carteira.
  - Lista de cards (Areia+Navy): descrição, região, frequência, nº de paradas. Toque → `/mobile/rotas/:id`.

- **`pages/RotaMapaPage.tsx`**
  - Carrega `GET /itinerarios/:id/paradas`.
  - Header: nome da rota + badge `~X km estimados`.
  - **Mapa Leaflet** (full-width, altura generosa): marcadores numerados na ordem + polyline tracejada.
    Auto-fit nos bounds das paradas. Centro de fallback = média das coords.
  - Botão **"Navegar rota inteira"** (multi-waypoint Google Maps).
  - **Lista das paradas** abaixo do mapa (numeradas): nome reduzido + endereço + selo quando `gps_real=false`
    ("posição aproximada pela cidade"). Toque no cliente → navega até ele (Maps/Waze).

- **`components/RotaMap.tsx`** (mobile)
  - Porte enxuto do `RotaMap` do web. Recebe `paradas`, `kmTotal`, `center`.
  - Ícones de marcador numerados (divIcon). Polyline tracejada navy.

- **`lib/rota.ts`** (helpers)
  - `haversine(lat1,lng1,lat2,lng2)` + `calcKm(paradas)` (× 1.3) — copiados/centralizados do web.
  - `mapsUrlRotaInteira(paradas)` — monta URL `https://www.google.com/maps/dir/?api=1&...&waypoints=...`.
  - `mapsUrlCliente(parada)` — `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`.

### BottomNav.tsx

Trocar a entrada:
```diff
- { path: '/mobile/aftermarket', icon: Wrench, label: 'Pontos' },
+ { path: '/mobile/rotas',       icon: Route,  label: 'Rotas'  },
```

## Fluxo de dados

```
RotasPage
  └─ GET /itinerarios?vendedor=<ven>  → cards
        └─ (toque) navigate(/mobile/rotas/:id)
RotaMapaPage
  └─ GET /itinerarios/:id/paradas     → paradas ordenadas c/ coords
        ├─ calcKm(paradas) → badge "~X km estimados"
        ├─ RotaMap(paradas) → Leaflet
        ├─ "Navegar rota inteira" → mapsUrlRotaInteira → window.open(Google Maps)
        └─ (toque cliente) → mapsUrlCliente → window.open(Maps/Waze)
```

## Tratamento de erros / bordas

- **Sem coordenadas:** paradas usam fallback do centro da cidade (`COALESCE`). Marcar `gps_real=false`
  visualmente; ainda assim plota e entra no cálculo de km (aproximado).
- **< 2 paradas com coords:** km = 0 (não mostra badge), mapa centra na única parada.
- **> 9 paradas (limite Google Maps):** ver Riscos — V1 abre as primeiras 9 como waypoints e avisa;
  navegação individual por cliente sempre disponível.
- **Offline:** tiles do Leaflet exigem internet. V1 é online. Se sem rede, exibir aviso amigável.
- **Vendedor do REP logado:** confirmar na implementação como o mobile expõe o `ven_codigo`
  (auth store) para o filtro `?vendedor=`. Ponto de integração único a validar.

## Fora de escopo (YAGNI — V1)

- Cadastro/edição/reordenação de rotas no mobile (fica no web).
- Sincronização offline das rotas/paradas.
- Cálculo de km por API de roteamento real (Directions). Mantém Haversine × 1.3, igual web.
- Registrar visita / abrir ficha a partir da rota (ação ao tocar = navegar, conforme decidido).

## Riscos

- **Limite de waypoints do Google Maps (~9-10):** rotas longas não cabem num único link multi-parada.
  Mitigação V1: abrir as primeiras 9 paradas + aviso; navegação individual sempre disponível.
  Evolução futura: quebrar em trechos.
- **Qualidade do GPS dos clientes:** muitos clientes podem cair no centro da cidade (fallback).
  O selo `gps_real=false` deixa isso explícito; não bloqueia o uso.

## Testes (validação manual no piloto)

- REP com rota de N clientes geocodificados → lista mostra a rota, mapa plota na ordem, km bate
  com o web para a mesma rota.
- "Navegar rota inteira" abre Google Maps com waypoints na ordem.
- Toque num cliente abre navegação até ele.
- REP sem rota → estado vazio amigável.
- Cliente sem GPS real → selo de posição aproximada.

## Notícia para os REPs

Ao entregar: post na Central de Notícias — "Agora você acessa suas **Rotas** direto pelo celular:
toque na rota e veja todos os clientes no mapa, com os km previstos e navegação pelo Google Maps."
