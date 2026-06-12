# NFS-e — Form de Emissão da Nota (Design)

**Data:** 2026-06-12
**Módulo:** Comissões / NFS-e (`src/modules/financeiro/pages/NfseComissoesPage.tsx` + backend `nfse`)
**Pré-requisito já entregue:** config fiscal por empresa (`empresa_status`, migration 051) + 1ª NFS-e autorizada ao vivo (SoftHam/CG).

> Parte fiscalmente sensível: **gera documento fiscal real**. Princípio: o usuário
> sempre **revisa uma prévia fiel** antes de confirmar, e a prévia é montada no
> **backend** (mesmo `buildNfsePayload` da emissão) — nunca diverge do que é enviado.

---

## Objetivo

Permitir que o representante **emita, baixe, consulte e cancele** a NFS-e de comissão
direto da tela de Comissões, com prévia + confirmação (1 nota por vez), reconciliando
o handler de emissão para ler a config fiscal nova (`empresa_status`) e usar o caminho
**DPS + regras do Simples** já comprovado.

## Escopo

**Inclui:**
- Reconciliação do `emitirNfseHandler` para ler `empresa_status` (identidade fiscal,
  códigos do serviço, ambiente, numeração) em vez do BH fixo / matriz antiga.
- Endpoint de **prévia** (`GET /nfse/:id/previa`) — monta o payload e devolve resumo
  legível **sem emitir**.
- Emissão com **modal de prévia → confirmar** (frontend).
- Pós-emissão por linha: **baixar PDF**, **baixar XML**, **link de consulta pública**,
  **cancelar** (com motivo + dupla confirmação).
- Ciclo de status na UI: CONTROLE → EMITIDA / ERRO / PENDENTE / CANCELADA.

**NÃO inclui (fases seguintes):**
- Emissão em lote.
- Upload do certificado A1 + auto-resolução de IBGE/provedor (etapa do form de Config,
  já marcada). A emissão **depende** dela: sem certificado, falha com erro claro.
- Reenvio por e-mail.

## Arquitetura

```
NfseComissoesPage (lista por competência)
  └─ linha CONTROLE → [Emitir] ─▶ Modal Prévia (GET /nfse/:id/previa)
                                    └─ [Confirmar e emitir] ─▶ POST /nfse/:id/emitir
  └─ linha EMITIDA  → [PDF] [XML] [Link] [Cancelar]
  └─ linha ERRO     → motivo + [Reemitir]

Backend nfse.controller:
  previa(id)   → lê empresa_status + fin_nfse → buildNfsePayload → resumo legível
  emitir(id)   → garante config ACBr → buildNfsePayload → emitirDps → polling →
                 persiste status/protocolo/codigo_verificacao/xml/erro_msg →
                 grava fin_nfse.numero (devolvido pela ACBr)
  pdf(id)/xml(id) → acbr.baixarPdf/baixarXml (binário)
  cancelar(id, motivo) → acbr.cancelar → status CANCELADA
```

### Fonte da config (reconciliação)
- **Identidade + códigos + ambiente + numeração:** `empresa_status` (campos da migration 051).
- **Impostos % (IRRF, PIS, COFINS…):** `fin_nfse_aliquotas` (continua sendo o controle da
  planilha da Lorena) — usados na apuração do lançamento, **não** no payload da NFS-e.
- **Regime** (`empresa_status.emp_regime`) decide as regras do Simples no `buildNfsePayload`
  (sem `pAliq` / `pTotTribSN`) e o `opSimpNac` na config do ACBr.

### Numeração (cuidado)
- O **contador é da ACBr** (config `rps.numero`). O `emp_nfse_proximo_numero` é a **semente
  inicial**: sincronizada pro ACBr quando o usuário salva a config fiscal (ou na 1ª emissão,
  se faltar config — `ConfigNfseNotFound`). A emissão **não re-seta** o contador a cada nota;
  o número autorizado volta na resposta e é gravado em `fin_nfse.numero`.

## Componentes

### Backend (`backend/src/modules/nfse/`)
- **`montarConfigEmpresa(empresaStatus)`** (helper puro) → objeto `EmpresaConfigNfse` do ACBr
  (regTrib via `emp_regime` → opSimpNac/regApTribSN; ambiente; rps numeração).
- **`montarAliquotasDoPayload(empresaStatus)`** (helper) → o objeto `AliquotasNfse` que o
  `buildNfsePayload` espera (cTribNac, cnbs, item, iss_pct, regime, IM).
- **`previaNfseHandler`** — `GET /nfse/:id/previa`: lê lançamento + empresa_status, chama
  `buildNfsePayload`, devolve `{ resumo: {...campos legíveis...}, payload }` sem emitir.
- **`emitirNfseHandler`** (reescrito) — garante config ACBr, emite via `emitirDps`, polling,
  persiste, incrementa numeração.
- **`pdfNfseHandler` / `xmlNfseHandler`** — binários (`Content-Disposition` attachment).
- **`cancelarNfseHandler`** — `POST /nfse/:id/cancelar` (body `{ motivo }`), `status='CANCELADA'`.
- Rotas em `nfse.routes.ts` (já MASTER-only).

### Frontend (`NfseComissoesPage.tsx`)
- **`EmitirModal`** — recebe o lançamento, busca `/previa`, exibe o resumo fiel
  (Prestador/IM · Tomador · Serviço/LC116 · Códigos · Valor · ISS · Ambiente), botão
  **Confirmar e emitir**; ao concluir mostra resultado (sucesso: número + código +
  link + PDF; erro: motivo).
- **`CancelarModal`** — pede motivo (textarea) + **dupla confirmação** ("Tem certeza? Isso é
  irreversível na prefeitura").
- **Coluna de Status + ações** na tabela, por linha, conforme o status.

## Resumo da prévia (campos exibidos)

Prestador (nome + CNPJ + IM) · Ambiente (badge Homolog/Produção) · Tomador (indústria:
nome + CNPJ) · Serviço (item LC116 + descrição "Comissão de representação — competência")
· Códigos (cTribNac · cNBS) · Valor do serviço · ISS (alíquota ou "via DAS" no Simples) ·
Competência. **Aviso destacado** quando ambiente = Produção ("nota com valor fiscal").

## Tratamento de erros

- **Sem certificado / config incompleta:** valida antes; erro claro listando o que falta
  (IM, certificado, ambiente) — não chama a ACBr.
- **Rejeição da prefeitura:** `status='ERRO'` + `erro_msg` com o motivo rico
  (`extrairMotivoAcbr`). Botão **Reemitir** após corrigir.
- **Ambiente Produção:** confirmação reforça que é fiscal.
- **402 (sem crédito ACBr):** mensagem específica.
- **Cancelamento:** dupla confirmação; falha mantém status e mostra o motivo.

## Status

`CONTROLE` (apuração, sem emissão) → `EMITIDA` (autorizada) · `ERRO` (rejeitada,
reemitir) · `PENDENTE` (processando, sincronizar depois) · `CANCELADA`. (CHECK da
migration 068 já permite todos.)

## Dependências externas
- **Certificado A1** subido pro ACBr (etapa do form de Config — próxima).
- **Envs `ACBR_*`** no servidor (já no `backend/.env` local).
- Conta ACBr com crédito.

## Fora de escopo / próximas fases
- Emissão em lote; upload de certificado na UI; reenvio por e-mail; auto-resolução IBGE.
