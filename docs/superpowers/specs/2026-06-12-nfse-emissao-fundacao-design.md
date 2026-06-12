# NFS-e — Fundação da Emissão (Design)

**Data:** 2026-06-12
**Módulo:** Comissões / NFS-e (Fase 3 — emissão real)
**Alvo do 1º teste:** tenant **borcatorep** (HM BORÇATO REPRESENTAÇÃO COMERCIAL LTDA · CNPJ 28.427.986/0001-08 · Belo Horizonte/MG · IBGE 3106200)

---

## Objetivo

Construir a **camada de emissão de NFS-e** dentro do RepOne (a infraestrutura ACBr + builder de payload + ação de emitir) e **emitir 1 nota de teste em homologação** para a borcatorep, sobre a comissão de representação. É a Fase 3 do módulo Comissões, cujo schema já nasceu emission-ready (migration 068).

## Escopo desta rodada

**Inclui:**
- Cliente ACBr de NFS-e no backend do RepOne (auth OAuth2, request, emitir, polling, PDF/XML, cancelar, upload de certificado).
- Builder de payload a partir dos dados já existentes (`fin_nfse` + `fin_nfse_aliquotas` + empresa).
- Ação `POST /nfse/:id/emitir` que persiste o resultado em `fin_nfse`.
- Criação de **1 lançamento de teste** na borcatorep e **emissão em `ambiente:homologacao`**.

**NÃO inclui (fases seguintes):**
- Botão de emitir na UI de Comissões (esta rodada é backend + teste via chamada direta/Insomnia).
- Cancelamento exposto na UI, lotes, produção real.
- VR Bruto automático (Fase 2 do módulo — separada).

## Arquitetura

A emissão vive **no RepOne** (decisão Hamilton 2026-06-12). Os dados da comissão já estão aqui (`fin_nfse`); a feature fica self-contained. A API que efetivamente emite é a **ACBr na nuvem** (`acbr.api.br`) — o RepOne é cliente dela. Reaproveita o **padrão** OAuth2/request do `acbr.service.ts` do SoftHam-emissor (cópia do padrão, não dependência de runtime).

```
fin_nfse (lançamento de comissão)
  + fin_nfse_aliquotas (IM, regime, ISS, código de serviço)
  + empresa (CNPJ, razão social, município/IBGE)
        │
        ▼  nfse-payload.ts (builder)
   RpsPedidoEmissao  (POST /nfse — ABRASF municipal)
        ── ou ──
   NfseDpsPedidoEmissao (POST /nfse/dps — padrão Nacional)
        │
        ▼  acbr-nfse.service.ts  → acbr.api.br (ambiente: homologacao)
   protocolo ──▶ polling/sincronizar ──▶ PDF + XML + código de verificação
        │
        ▼  grava em fin_nfse: status='EMITIDA', protocolo, codigo_verificacao, xml, pdf_url
                              (ou status mantém 'CONTROLE' + erro_msg em caso de rejeição)
```

A escolha **RPS (municipal) × DPS (Nacional)** é feita por configuração do provedor do município, resolvida em `GET /nfse/cidades/{ibge}` na implementação. Para BH (3106200) confirma-se o provedor antes de montar o payload.

## Componentes

### 1. `backend/src/shared/utils/acbr-nfse.service.ts`
Cliente HTTP da ACBr API, isolado de regra de negócio.
- **Faz:** cache de token OAuth2 (client_credentials, scope `nfse`), `request()` genérico (incl. tratamento de `402` = sem crédito ACBr), e métodos:
  - `emitirRps(payload, ambiente)` → `POST /nfse`
  - `emitirDps(payload, ambiente)` → `POST /nfse/dps`
  - `consultar(id)` / `sincronizar(id)` → status/resultado (polling)
  - `pdf(id)` / `xml(id)` → binários/links
  - `cancelar(id, motivo)` → `POST /nfse/{id}/cancelamento`
  - `uploadCertificado(cnpj, pfxBase64, senha)` → sobe o A1 pra ACBr (1x)
  - `cidade(ibge)` → `GET /nfse/cidades/{ibge}` (descobre provedor/ambientes)
- **Depende de:** env `ACBR_CLIENT_ID`, `ACBR_CLIENT_SECRET`, `ACBR_BASE_URL` (prod), `ACBR_AUDIENCE`.
- **Entrega:** objeto tipado de resposta (id ACBr, status, protocolo, erros).

### 2. `backend/src/modules/nfse/nfse-payload.ts`
Builder puro (sem I/O): recebe `{ lancamento, aliquotas, empresa, provedor }` e devolve `RpsPedidoEmissao` **ou** `NfseDpsPedidoEmissao`.
- Mapeia: prestador (CNPJ/IM/razão da empresa) · tomador (a indústria do lançamento) · serviço (código LC116 / código municipal, discriminação, valor bruto, ISS) · competência.
- **Não sabe** falar com a ACBr nem com o banco — só transforma dados em payload. Testável isoladamente.

### 3. `backend/src/modules/nfse/nfse.controller.ts` (estende o existente)
Nova ação `POST /nfse/:id/emitir` (MASTER):
1. Lê o lançamento `fin_nfse` por id + `fin_nfse_aliquotas` + dados da empresa (master).
2. Resolve o provedor do município (cache de `cidade(ibge)`).
3. Chama `nfse-payload` → chama `acbr-nfse.service.emitir*` em `ambiente:homologacao`.
4. Faz polling até resultado final (limite de tentativas/timeout).
5. Persiste em `fin_nfse`: `status`, `protocolo`, `codigo_verificacao`, `xml`, `pdf_url`; ou `erro_msg` na rejeição.
- Rota registrada em `nfse.routes.ts` com `authMiddleware` + `RequireMaster` (padrão do módulo).

## Mapeamento do payload (comissão → NFS-e)

| Campo NFS-e | Origem |
|---|---|
| Prestador CNPJ / razão / IM | empresa (master) + `fin_nfse_aliquotas.inscricao_municipal` |
| Regime / natureza tributação | `fin_nfse_aliquotas.regime` (PRESUMIDO) |
| Tomador (CNPJ/razão) | a indústria do lançamento (`fin_nfse`) |
| Código de serviço (LC116) | `fin_nfse_aliquotas.codigo_servico_padrao` (~10.09 representação) |
| Discriminação | "Comissão s/ representação comercial — competência MM/AAAA" |
| Valor do serviço (VR bruto) | `fin_nfse.vr_bruto` |
| ISS (alíquota/valor) | `fin_nfse_aliquotas.iss_pct` |
| Competência / emissão | `fin_nfse.competencia` / data corrente |

## Tratamento de erros

- **402 (sem crédito ACBr):** erro claro "conta ACBr sem saldo", não grava emissão.
- **Rejeição municipal:** grava `erro_msg`, `status` permanece `CONTROLE` (pode reemitir após corrigir).
- **Timeout no polling:** mantém `protocolo`, `status='PROCESSANDO'`; ação separada de `sincronizar` resolve depois.
- **Faltando IM / código de serviço / certificado:** valida ANTES de chamar a ACBr e devolve erro orientando o que falta.

## Plano de teste (1ª emissão)

1. Subir o certificado A1 da borcatorep pra ACBr (`uploadCertificado`).
2. Preencher `fin_nfse_aliquotas` da borcatorep: `inscricao_municipal`, `codigo_servico_padrao`.
3. Criar 1 lançamento de teste em `fin_nfse` (prestador=HM Borçato, tomador=uma indústria real da carteira, vr_bruto simbólico, competência atual).
4. `POST /nfse/:id/emitir` em `ambiente:homologacao` → conferir protocolo → PDF/XML retornados → `status='EMITIDA'`.

## Dependências externas (gating do teste)

Sem estes, o **plumbing** é construído e testável contra a API, mas a **emissão de teste** não completa:

1. **Certificado A1 da borcatorep** (`.pfx` + senha) — *Hamilton solicitando.*
2. **Inscrição Municipal** da borcatorep (BH).
3. **Código de serviço municipal** de BH para representação comercial (LC116 ~10.09).
4. **Credenciais ACBr** (Client ID/Secret) — hoje no `SoftHam-ADM/.env` (PROD); copiar pro env do RepOne backend.
5. **Confirmar provedor de BH** via `GET /nfse/cidades/3106200` (define RPS × Nacional).

## Fora de escopo / fases seguintes

- UI de emitir + status na tela de Comissões.
- Produção real (ambiente `PRODUCAO`), cancelamento via UI, lotes.
- Fase 2 (VR bruto automático = faturamento × % comissão).
- Replicar pra outros tenants (cada município pode ter provedor diferente — TMB/Vila Velha = SilTecnologia).
