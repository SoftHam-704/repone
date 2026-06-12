# NFS-e — Fundação da Emissão · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a camada de emissão de NFS-e no backend do RepOne (cliente ACBr + builder de payload + ação `POST /nfse/:id/emitir`) e emitir 1 nota de teste em homologação para a borcatorep.

**Architecture:** O RepOne é cliente da ACBr API na nuvem (`*.acbr.api.br`). Um serviço isolado (`acbr-nfse.service.ts`) faz auth OAuth2 + chamadas REST; um builder puro (`nfse-payload.ts`) transforma o lançamento `fin_nfse` em payload RPS (ABRASF) ou DPS (Nacional); o handler `emitirNfseHandler` orquestra (lê banco → builder → serviço → polling → persiste em `fin_nfse`). Segue o padrão do `acbr.service.ts` do SoftHam-emissor.

**Tech Stack:** Node 22 (global `fetch`), Express, TypeScript, `pg`, `tsx` (runner). Sem framework de testes → verificação por **scripts `tsx` com `node:assert`** (unit pra funções puras; smoke ao vivo read-only pro serviço).

**Spec:** `docs/superpowers/specs/2026-06-12-nfse-emissao-fundacao-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/shared/utils/acbr-nfse.service.ts` (criar) | Cliente ACBr: OAuth2, `request`/`requestBinary`, `AcbrError`, e funções `/nfse` (emitir RPS/DPS, consultar, sincronizar, pdf, xml, cancelar, uploadCertificado, configurarNfseEmpresa, cidade). |
| `backend/src/modules/nfse/nfse-payload.ts` (criar) | Builder puro: `{lancamento, aliquotas, prestador, provedor}` → `{ tipo, payload }`. Sem I/O. |
| `backend/src/modules/nfse/nfse.controller.ts` (modificar) | `emitirNfseHandler`: orquestra leitura → builder → serviço → polling → persistência. |
| `backend/src/modules/nfse/nfse.routes.ts` (modificar) | Registra `POST /:id/emitir`. |
| `backend/.env` + `backend/.env.example` (modificar) | `ACBR_AMBIENTE`, `ACBR_CLIENT_ID`, `ACBR_CLIENT_SECRET`. |
| `backend/scripts/nfse-smoke.ts` (criar, temporário) | Verificação ao vivo: auth + `GET /nfse/cidades/3106200`. |
| `backend/scripts/nfse-payload.test.ts` (criar) | Verificação unit do builder (asserts). |
| `src/modules/financeiro/pages/NfseComissoesPage.tsx` (modificar) | Valor manual + botão "Buscar valor a receber" (desabilitado, "em breve"). |

**Nuance de ambiente (importante):** as credenciais ACBr são **PROD** (token `aud=prod`) → `BASE_URL` deve ser `https://prod.acbr.api.br` (`ACBR_AMBIENTE=producao`). A **homologação** é selecionada **dentro do payload** (`ambiente: 'homologacao'`), não trocando o host.

---

## Task 1: Serviço ACBr-NFSe (cliente da API)

**Files:**
- Create: `backend/src/shared/utils/acbr-nfse.service.ts`
- Create: `backend/scripts/nfse-smoke.ts`
- Modify: `backend/.env`, `backend/.env.example`

- [ ] **Step 1: Adicionar credenciais ao env**

Pegar os valores reais de `E:\Sistemas_ia\SoftHam-ADM\.env` (`ACBR_CLIENT_ID`/`ACBR_CLIENT_SECRET`). Adicionar em `backend/.env`:

```
# ── ACBr API (NFS-e) ──────────────────────────────────────────
ACBR_AMBIENTE=producao
ACBR_CLIENT_ID=<copiar do SoftHam-ADM/.env>
ACBR_CLIENT_SECRET=<copiar do SoftHam-ADM/.env>
```

E em `backend/.env.example` (sem segredos):

```
ACBR_AMBIENTE=producao
ACBR_CLIENT_ID=
ACBR_CLIENT_SECRET=
```

- [ ] **Step 2: Criar o serviço**

Create `backend/src/shared/utils/acbr-nfse.service.ts`:

```ts
/**
 * ACBr API — NFS-e (cliente RepOne).
 * OAuth2 client_credentials + cache de token, tratamento de 402/429.
 * Padrão copiado de SoftHam-emissor/src/services/acbr.service.ts (scope = 'nfse').
 *
 * Credenciais PROD (token aud=prod) → BASE_URL sempre prod.acbr.api.br.
 * A HOMOLOGAÇÃO é selecionada no payload (campo `ambiente`), não no host.
 */
interface Token { access_token: string; expires_at: number }
export interface AcbrResponse<T = unknown> { id?: string; status?: string; data?: T; error?: string; [k: string]: unknown }

const AMBIENTE = process.env.ACBR_AMBIENTE === 'producao' ? 'prod' : 'hom';
const BASE_URL = `https://${AMBIENTE}.acbr.api.br`;
const AUTH_URL = 'https://auth.acbr.api.br/realms/ACBrAPI/protocol/openid-connect/token';
const SCOPES   = 'empresa cnpj nfse';
const DEBUG    = process.env.NODE_ENV !== 'production' || process.env.ACBR_DEBUG === '1';

export class AcbrError extends Error {
  status: number; body: string; rawJson: unknown; method: string; path: string;
  constructor(o: { status: number; body: string; rawJson: unknown; method: string; path: string; message: string }) {
    super(o.message);
    this.name = 'AcbrError';
    this.status = o.status; this.body = o.body; this.rawJson = o.rawJson; this.method = o.method; this.path = o.path;
  }
}

function extractErrorMessage(rawJson: unknown, fallback: string): string {
  if (!rawJson || typeof rawJson !== 'object') return fallback.slice(0, 500);
  const obj = rawJson as Record<string, unknown>;
  const partes: string[] = [];
  const err = obj.error;
  if (typeof err === 'string') partes.push(err);
  else if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') partes.push(e.code ? `${e.code}: ${e.message}` : e.message);
    if (Array.isArray(e.errors)) for (const s of e.errors) {
      if (typeof s === 'string') partes.push(s);
      else if (s && typeof s === 'object') { const x = s as any; if (x.message) partes.push(x.campo ? `${x.campo}: ${x.message}` : x.message); }
    }
  }
  for (const k of ['message', 'mensagem', 'motivo', 'descricao']) if (typeof obj[k] === 'string') partes.push(obj[k] as string);
  if (Array.isArray(obj.errors)) for (const s of obj.errors) {
    if (typeof s === 'string') partes.push(s);
    else if (s && typeof s === 'object') { const x = s as any; if (x.message) partes.push(x.campo ? `${x.campo}: ${x.message}` : x.message); }
  }
  const seen = new Set<string>();
  const uniq = partes.filter(p => (seen.has(p) ? false : (seen.add(p), true)));
  return uniq.length ? uniq.join(' · ') : fallback.slice(0, 500);
}

let _token: Token | null = null;
async function getToken(): Promise<string> {
  if (_token && Date.now() < _token.expires_at - 30_000) return _token.access_token;
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ACBR_CLIENT_ID ?? '',
      client_secret: process.env.ACBR_CLIENT_SECRET ?? '',
      scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`[ACBr Auth] ${res.status} ${await res.text()}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  _token = { access_token: json.access_token, expires_at: Date.now() + json.expires_in * 1000 };
  return _token.access_token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<AcbrResponse<T>> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  let rawJson: unknown = null;
  try { rawJson = rawText ? JSON.parse(rawText) : null; } catch { /* não-JSON */ }
  if (DEBUG) console.log(`[ACBr ${method} ${path}] → ${res.status}`);
  if (res.status === 429) throw new AcbrError({ status: 429, body: rawText, rawJson, method, path, message: '[ACBr] Rate limit. Tente novamente.' });
  if (res.status === 402) throw new AcbrError({ status: 402, body: rawText, rawJson, method, path, message: '[ACBr] Sem créditos. Recarregue a conta ACBr API.' });
  if (!res.ok) throw new AcbrError({ status: res.status, body: rawText, rawJson, method, path, message: `[ACBr ${res.status}] ${extractErrorMessage(rawJson, rawText)}` });
  return (rawJson ?? {}) as AcbrResponse<T>;
}

async function requestBinary(method: string, path: string): Promise<{ data: Buffer; contentType: string }> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream, application/pdf, application/xml, */*' },
  });
  if (!res.ok) {
    const rawText = await res.text();
    let rawJson: unknown = null; try { rawJson = rawText ? JSON.parse(rawText) : null; } catch { /* */ }
    throw new AcbrError({ status: res.status, body: rawText, rawJson, method, path, message: `[ACBr ${res.status}] ${extractErrorMessage(rawJson, rawText)}` });
  }
  return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? '' };
}

// ── Empresa / config ───────────────────────────────────────────────
export function uploadCertificado(cnpj: string, pfxBase64: string, senha: string) {
  return request('PUT', `/empresas/${cnpj}/certificado`, { certificado: pfxBase64, senha });
}
export function configurarNfseEmpresa(cnpj: string, dados: unknown) {
  return request('PUT', `/empresas/${cnpj}/nfse`, dados);
}
export function cidade(ibge: string | number) { return request('GET', `/nfse/cidades/${ibge}`); }

// ── Emissão ────────────────────────────────────────────────────────
export function emitirRps(payload: unknown) { return request('POST', '/nfse',     payload); }
export function emitirDps(payload: unknown) { return request('POST', '/nfse/dps', payload); }
export function consultar(id: string)       { return request('GET',  `/nfse/${id}`); }
export function sincronizar(id: string)     { return request('POST', `/nfse/${id}/sincronizar`); }
export function cancelar(id: string, motivo: string) { return request('POST', `/nfse/${id}/cancelamento`, { motivo }); }
export function baixarPdf(id: string) { return requestBinary('GET', `/nfse/${id}/pdf`); }
export function baixarXml(id: string) { return requestBinary('GET', `/nfse/${id}/xml`); }
```

- [ ] **Step 3: Smoke ao vivo (auth + scope nfse) — verificação**

Create `backend/scripts/nfse-smoke.ts`:

```ts
import 'dotenv/config';
import assert from 'node:assert';
import { cidade } from '../src/shared/utils/acbr-nfse.service';

(async () => {
  const r: any = await cidade(3106200); // Belo Horizonte/MG
  console.log('cidade 3106200:', JSON.stringify(r).slice(0, 600));
  assert.ok(r && typeof r === 'object', 'resposta vazia');
  // a API retorna metadados do provedor; basta não ter erro e vir objeto
  console.log('OK — auth + scope nfse funcionando, provedor BH retornado.');
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
```

- [ ] **Step 4: Rodar o smoke**

Run: `cd backend && npx tsx scripts/nfse-smoke.ts`
Expected: imprime os metadados de BH e `OK — auth + scope nfse funcionando`. Se `AcbrError 401/403` → scope `nfse` não concedido nas credenciais (rever com a ACBr). Se `402` → conta sem crédito.

- [ ] **Step 5: Typecheck + commit**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

```bash
git add backend/src/shared/utils/acbr-nfse.service.ts backend/scripts/nfse-smoke.ts backend/.env.example
git commit -m "feat(nfse): cliente ACBr para NFS-e (auth OAuth2 + endpoints /nfse)"
```
> `.env` não entra no commit (segredos).

---

## Task 2: Builder de payload (função pura)

**Files:**
- Create: `backend/src/modules/nfse/nfse-payload.ts`
- Create: `backend/scripts/nfse-payload.test.ts`

- [ ] **Step 1: Escrever o teste (vai falhar)**

Create `backend/scripts/nfse-payload.test.ts`:

```ts
import assert from 'node:assert';
import { buildNfsePayload } from '../src/modules/nfse/nfse-payload';

const lancamento = {
  id: 1, competencia: '2026-06', vr_bruto: 1000, iss: 25,
  representada_nome: 'INDÚSTRIA ALFA', for_cnpj: '11111111000111',
};
const aliquotas = { regime: 'PRESUMIDO', iss_pct: 2.5, inscricao_municipal: '123456', codigo_servico_padrao: '10.09' };
const prestador = { cnpj: '28427986000108', razao: 'HM BORCATO REPRESENTACAO COMERCIAL LTDA', ibge: '3106200' };

// Provedor municipal (RPS/ABRASF)
const rps = buildNfsePayload({ lancamento, aliquotas, prestador, provedor: 'municipal', ambiente: 'homologacao' });
assert.equal(rps.tipo, 'rps', 'municipal → rps');
assert.equal((rps.payload as any).ambiente, 'homologacao');
assert.equal((rps.payload as any).rps.servicos[0].valor_servico, 1000, 'valor do serviço = vr_bruto');
assert.equal((rps.payload as any).rps.servicos[0].codigo_servico, '10.09');
assert.equal((rps.payload as any).rps.prestador.inscricao_municipal, '123456');
assert.equal((rps.payload as any).rps.tomador.cnpj, '11111111000111');

// Provedor nacional (DPS)
const dps = buildNfsePayload({ lancamento, aliquotas, prestador, provedor: 'nacional', ambiente: 'homologacao' });
assert.equal(dps.tipo, 'dps', 'nacional → dps');
assert.equal((dps.payload as any).provedor, 'nacional');
assert.equal((dps.payload as any).infDPS.serv.cServico, '10.09');

console.log('OK — builder de payload');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx tsx scripts/nfse-payload.test.ts`
Expected: FALHA com "Cannot find module '../src/modules/nfse/nfse-payload'".

- [ ] **Step 3: Implementar o builder**

Create `backend/src/modules/nfse/nfse-payload.ts`:

```ts
/**
 * Builder PURO de payload NFS-e. Sem I/O: recebe dados já carregados e devolve o
 * corpo pronto pra ACBr. Dois caminhos: RPS/ABRASF (municipal) e DPS (Nacional).
 * Política comercial fica fora daqui — só matemática/mapeamento.
 */
export type Provedor = 'municipal' | 'nacional';
export type Ambiente = 'homologacao' | 'producao';

export interface LancamentoNfse {
  id: number;
  competencia: string;          // 'YYYY-MM'
  vr_bruto: number;
  iss: number;                  // valor R$ do ISS (snapshot)
  representada_nome: string;
  for_cnpj: string;             // CNPJ da indústria (tomador)
}
export interface AliquotasNfse {
  regime: string;               // 'PRESUMIDO' | 'SIMPLES' | ...
  iss_pct: number;
  inscricao_municipal: string;
  codigo_servico_padrao: string;
}
export interface Prestador { cnpj: string; razao: string; ibge: string }

export interface BuildArgs {
  lancamento: LancamentoNfse;
  aliquotas: AliquotasNfse;
  prestador: Prestador;
  provedor: Provedor;
  ambiente: Ambiente;
}
export interface BuiltPayload { tipo: 'rps' | 'dps'; payload: unknown }

const onlyDigits = (s: string) => String(s ?? '').replace(/\D/g, '');
const compToDate = (c: string) => `${c}-01`;                 // 'YYYY-MM' → 'YYYY-MM-01'
const discriminacao = (l: LancamentoNfse) =>
  `Comissão sobre representação comercial — competência ${l.competencia}`;

export function buildNfsePayload(args: BuildArgs): BuiltPayload {
  const { lancamento: l, aliquotas: a, prestador: p, provedor, ambiente } = args;
  const naturezaTributacao = a.regime?.toUpperCase().includes('SIMPLES') ? 1 : 0;

  if (provedor === 'nacional') {
    return {
      tipo: 'dps',
      payload: {
        provedor: 'nacional',
        ambiente,
        infDPS: {
          dhEmi: new Date().toISOString(),
          dCompet: compToDate(l.competencia),
          prest: { CNPJ: onlyDigits(p.cnpj), IM: a.inscricao_municipal, xNome: p.razao },
          toma:  { CNPJ: onlyDigits(l.for_cnpj), xNome: l.representada_nome },
          serv:  { cServico: a.codigo_servico_padrao, xDescServico: discriminacao(l) },
          valores: { vServPrest: l.vr_bruto, aliqISS: a.iss_pct, vISS: l.iss },
        },
      },
    };
  }

  // municipal (RPS/ABRASF)
  return {
    tipo: 'rps',
    payload: {
      ambiente,
      rps: {
        referencia: String(l.id),
        data_emissao: new Date().toISOString().slice(0, 10),
        competencia: compToDate(l.competencia),
        natureza_tributacao: naturezaTributacao,
        prestador: { cnpj: onlyDigits(p.cnpj), inscricao_municipal: a.inscricao_municipal, razao_social: p.razao },
        tomador:   { cnpj: onlyDigits(l.for_cnpj), razao_social: l.representada_nome },
        servicos: [{
          codigo_servico: a.codigo_servico_padrao,
          discriminacao: discriminacao(l),
          valor_servico: l.vr_bruto,
          aliquota_iss: a.iss_pct,
          valor_iss: l.iss,
        }],
      },
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx tsx scripts/nfse-payload.test.ts`
Expected: `OK — builder de payload`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/nfse/nfse-payload.ts backend/scripts/nfse-payload.test.ts
git commit -m "feat(nfse): builder de payload RPS/ABRASF + DPS/Nacional (puro, testado)"
```

---

## Task 3: Handler de emissão + rota

**Files:**
- Modify: `backend/src/modules/nfse/nfse.controller.ts` (adicionar `emitirNfseHandler` no fim, antes da última linha)
- Modify: `backend/src/modules/nfse/nfse.routes.ts`

- [ ] **Step 1: Adicionar imports no topo do controller**

Em `backend/src/modules/nfse/nfse.controller.ts`, após `import { Request, Response } from 'express';`:

```ts
import { masterPool } from '../../config/database';
import * as acbr from '../../shared/utils/acbr-nfse.service';
import { buildNfsePayload, Provedor } from './nfse-payload';
```

- [ ] **Step 2: Adicionar o handler no fim do arquivo**

No fim de `nfse.controller.ts` (depois de `deleteNfseHandler`):

```ts
// Decide RPS×Nacional pelo metadado do município (cache simples em memória).
const _provedorCache = new Map<string, Provedor>();
async function resolverProvedor(ibge: string): Promise<Provedor> {
  if (_provedorCache.has(ibge)) return _provedorCache.get(ibge)!;
  const r: any = await acbr.cidade(ibge);
  // ACBr retorna o provedor; "nacional"/"padrao nacional" → DPS, senão municipal (ABRASF).
  const nome = String(r?.provedor ?? r?.data?.provedor ?? '').toLowerCase();
  const prov: Provedor = nome.includes('nacional') ? 'nacional' : 'municipal';
  _provedorCache.set(ibge, prov);
  return prov;
}

// POST /:id/emitir  — emite a NFS-e do lançamento em homologação
export async function emitirNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = Number(req.params.id);
    const user = (req as any).user;

    // 1. lançamento + alíquotas
    const lanc = (await db.query(`
      SELECT n.*, f.for_cnpj
      FROM fin_nfse n LEFT JOIN fornecedores f ON f.for_codigo = n.for_codigo
      WHERE n.id = $1
    `, [id])).rows[0];
    if (!lanc) { res.status(404).json({ success: false, message: 'Lançamento não encontrado.' }); return; }

    const aliq = (await db.query(`SELECT * FROM fin_nfse_aliquotas WHERE id = 1`)).rows[0] || {};

    // 2. validações pré-ACBr (evita request fadado a falhar)
    const faltando: string[] = [];
    if (!aliq.inscricao_municipal)   faltando.push('Inscrição Municipal (matriz de alíquotas)');
    if (!aliq.codigo_servico_padrao) faltando.push('Código de serviço (matriz de alíquotas)');
    if (!lanc.for_cnpj)              faltando.push('CNPJ da representada (tomador)');
    if (!(Number(lanc.vr_bruto) > 0)) faltando.push('Valor (VR Bruto) maior que zero');
    if (faltando.length) { res.status(400).json({ success: false, message: 'Faltam dados para emitir: ' + faltando.join('; ') }); return; }

    // 3. prestador (master)
    const emp = (await masterPool.query(
      `SELECT razao_social, cnpj FROM empresas WHERE db_schema = $1 LIMIT 1`, [user?.schema]
    )).rows[0];
    if (!emp) { res.status(400).json({ success: false, message: 'Empresa (prestador) não encontrada no master.' }); return; }
    const ibge = '3106200'; // BH — borcatorep. (Generalizar via empresas.codigo_ibge numa fase seguinte.)

    // 4. provedor + payload (ambiente sempre homologacao nesta fase)
    const provedor = await resolverProvedor(ibge);
    const { tipo, payload } = buildNfsePayload({
      lancamento: {
        id: lanc.id, competencia: lanc.competencia, vr_bruto: Number(lanc.vr_bruto),
        iss: Number(lanc.iss), representada_nome: lanc.representada_nome || '', for_cnpj: String(lanc.for_cnpj),
      },
      aliquotas: {
        regime: aliq.regime, iss_pct: Number(aliq.iss_pct),
        inscricao_municipal: String(aliq.inscricao_municipal), codigo_servico_padrao: String(aliq.codigo_servico_padrao),
      },
      prestador: { cnpj: String(emp.cnpj), razao: emp.razao_social, ibge },
      provedor, ambiente: 'homologacao',
    });

    // 5. emitir
    const emit: any = tipo === 'dps' ? await acbr.emitirDps(payload) : await acbr.emitirRps(payload);
    const acbrId = emit?.id ?? emit?.data?.id;

    // 6. polling até status final (máx 10 tentativas × 3s)
    let status = String(emit?.status ?? '').toLowerCase();
    let info: any = emit;
    for (let i = 0; acbrId && !['autorizado','concluido','rejeitado','erro','cancelado'].includes(status) && i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      info = await acbr.consultar(acbrId);
      status = String(info?.status ?? '').toLowerCase();
    }

    // 7. persistir
    const ok = ['autorizado','concluido'].includes(status);
    await db.query(`
      UPDATE fin_nfse SET
        status = $1, protocolo = $2, codigo_verificacao = $3,
        xml = $4, erro_msg = $5, emitida_em = CASE WHEN $6 THEN now() ELSE emitida_em END,
        updated_at = now()
      WHERE id = $7
    `, [
      ok ? 'EMITIDA' : 'CONTROLE',
      info?.protocolo ?? acbrId ?? null,
      info?.codigo_verificacao ?? info?.data?.codigo_verificacao ?? null,
      info?.xml ?? null,
      ok ? null : (info?.error ? String(info.error) : `status ACBr: ${status || 'desconhecido'}`),
      ok, id,
    ]);

    res.json({ success: ok, status, acbr_id: acbrId, data: info });
  } catch (e: any) {
    // AcbrError carrega body cru — devolve mensagem rica
    const msg = e?.message ?? 'Erro ao emitir NFS-e';
    console.error('❌ [NFSE emitir]:', msg, e?.body ? '| body: ' + String(e.body).slice(0, 800) : '');
    res.status(500).json({ success: false, message: msg, acbr_body: e?.rawJson ?? e?.body ?? null });
  }
}
```

- [ ] **Step 3: Registrar a rota**

Em `backend/src/modules/nfse/nfse.routes.ts`, adicionar `emitirNfseHandler` ao import e a rota após `deleteNfseHandler`:

```ts
import {
  getAliquotasHandler, updateAliquotasHandler,
  listRepresentadasHandler,
  listNfseHandler, createNfseHandler, updateNfseHandler, deleteNfseHandler,
  emitirNfseHandler,
} from './nfse.controller';
```
```ts
// emissão real (ACBr) — homologação nesta fase
router.post('/:id/emitir', emitirNfseHandler);
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros. (Se acusar `for_cnpj` inexistente em `fornecedores`, conferir o nome real da coluna do CNPJ em `fornecedores` e ajustar o SELECT do Step 2 — ver Nota A abaixo.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/nfse/nfse.controller.ts backend/src/modules/nfse/nfse.routes.ts
git commit -m "feat(nfse): POST /nfse/:id/emitir — orquestra emissão ACBr + persiste em fin_nfse"
```

> **Nota A (verificar na implementação):** confirmar o nome da coluna de CNPJ em `fornecedores` (provável `for_cnpj`). Rodar:
> `node -e "..."` consultando `information_schema.columns` do schema borcatorep (mesmo padrão dos scripts de descoberta deste plano). Ajustar o SELECT se o nome diferir.

---

## Task 4: Frontend — valor manual + botão "Buscar valor a receber"

**Files:**
- Modify: `src/modules/financeiro/pages/NfseComissoesPage.tsx`

- [ ] **Step 1: Localizar o form de lançamento**

Run: `cd .. && grep -n "vr_bruto\|VR Bruto\|representada\|for_codigo\|<button\|Salvar" src/modules/financeiro/pages/NfseComissoesPage.tsx | head -40`
Identificar o input de valor e o select de representada.

- [ ] **Step 2: Garantir obrigatoriedade + adicionar o botão**

Ao lado do input de valor (VR Bruto), adicionar o botão desabilitado (ajustar nomes de estilo ao padrão do arquivo):

```tsx
<button
  type="button"
  disabled
  title="Em breve: calcula o valor a partir do faturamento da representada × % de comissão"
  style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
           background: '#F1F5F9', color: '#64748B', fontWeight: 700, fontSize: 12, cursor: 'not-allowed' }}
>
  🔎 Buscar valor a receber <span style={{ fontSize: 10, opacity: .8 }}>(em breve)</span>
</button>
```

Garantir que o submit valida `for_codigo` (representada) e `vr_bruto > 0` antes de enviar (se já não validar). O valor permanece **digitável** — nenhuma automação nesta fase.

- [ ] **Step 3: Build**

Run: `cd .. && npx vite build`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/financeiro/pages/NfseComissoesPage.tsx
git commit -m "feat(nfse): valor manual + botão 'Buscar valor a receber' (placeholder Fase 2)"
```

---

## Task 5: Primeira emissão de teste (homologação) — runbook

> Gated: depende do **certificado A1 da borcatorep** (Hamilton solicitando), **Inscrição Municipal** e **código de serviço de BH**.

- [ ] **Step 1: Subir o certificado A1 pra ACBr**

Script `backend/scripts/nfse-upload-cert.ts` (lê o .pfx do disco, base64, chama `uploadCertificado`):

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { uploadCertificado } from '../src/shared/utils/acbr-nfse.service';
const [cnpj, pfxPath, senha] = process.argv.slice(2);
(async () => {
  const b64 = readFileSync(pfxPath).toString('base64');
  const r = await uploadCertificado(cnpj.replace(/\D/g, ''), b64, senha);
  console.log('upload cert OK:', JSON.stringify(r).slice(0, 400));
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
```
Run: `cd backend && npx tsx scripts/nfse-upload-cert.ts 28427986000108 "C:\caminho\borcato.pfx" "SENHA"`

- [ ] **Step 2: Preencher IM + código de serviço da borcatorep**

Via UI (matriz de alíquotas, PUT /aliquotas) **ou** SQL no schema borcatorep:
```sql
UPDATE fin_nfse_aliquotas SET inscricao_municipal = '<IM BH>', codigo_servico_padrao = '<cód. serviço BH>' WHERE id = 1;
```

- [ ] **Step 3: Criar 1 lançamento de teste**

Pela tela de Comissões: representada = uma indústria real da carteira (com CNPJ), VR Bruto simbólico (ex.: 100,00), competência atual. Anotar o `id` retornado.

- [ ] **Step 4: Emitir**

`POST /api/nfse/<id>/emitir` (logado como master da borcatorep, via app ou Insomnia).
Expected: `{ success: true, status: 'autorizado'|'concluido' }`, e em `fin_nfse` o registro com `status='EMITIDA'`, `protocolo`, `codigo_verificacao`, `xml` preenchidos.
Em rejeição: `success:false` com `acbr_body` detalhando o motivo municipal → corrigir e reemitir.

- [ ] **Step 5: Conferir PDF/XML**

`GET /nfse/<acbr_id>/pdf` e `/xml` via `baixarPdf`/`baixarXml` (ou script) — confirmar a DANFSE de homologação.

---

## Notas finais

- **Limpeza:** `backend/scripts/nfse-smoke.ts`, `nfse-payload.test.ts`, `nfse-upload-cert.ts` são utilitários de verificação — manter em `scripts/` (úteis pra reemitir/depurar) ou remover após o teste, a critério.
- **Deploy:** Task 1-3 = `backend/dist` + `pm2 restart` (+ as 3 envs ACBr no servidor). Task 4 = `dist/` (frontend).
- **Fora desta rodada:** botão Emitir na UI, produção real, cancelamento na UI, Fase 2 (valor automático). Cada município novo precisa conferir o provedor (`/nfse/cidades/{ibge}`).
