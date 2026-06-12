# Form de Emissão da NFS-e — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir/baixar/consultar/cancelar a NFS-e de comissão na tela de Comissões, com prévia fiel + confirmação (1 a 1), lendo a config fiscal de `empresa_status`.

**Architecture:** Helpers puros mapeiam `empresa_status` → config do ACBr e → `AliquotasNfse` do builder. O handler de emissão é reescrito para ler `empresa_status` (não mais BH fixo), garantir a config no ACBr de forma lazy, emitir via `emitirDps`, fazer polling e persistir. A prévia roda no backend (mesmo `buildNfsePayload`). Frontend ganha modal de prévia/confirmação + ações por linha (PDF/XML/link/cancelar).

**Tech Stack:** Express/TS, `pg`, React/Vite. Verificação: scripts `tsx` + `node:assert` (sem framework de teste); typecheck; build.

**Spec:** `docs/superpowers/specs/2026-06-12-nfse-emissao-form-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/modules/nfse/nfse-empresa-config.ts` (criar) | Helpers PUROS: `empresaToConfigNfse(emp)` e `empresaToAliquotas(emp)`. |
| `backend/scripts/nfse-empresa-config.test.ts` (criar) | Verificação unit dos helpers. |
| `backend/src/modules/nfse/nfse.controller.ts` (modificar) | `previaNfseHandler`, reescrever `emitirNfseHandler`, `pdfNfseHandler`, `xmlNfseHandler`, `cancelarNfseHandler`. |
| `backend/src/modules/nfse/nfse.routes.ts` (modificar) | Rotas `/:id/previa`, `/:id/pdf`, `/:id/xml`, `/:id/cancelar`. |
| `src/modules/financeiro/pages/NfseComissoesPage.tsx` (modificar) | Interface `Nfse` + status; `EmitirModal`; `CancelarModal`; ações por linha. |

**Modelo de numeração:** o contador é da ACBr (semeado por `emp_nfse_proximo_numero` na 1ª config). A emissão **não re-configura** a numeração a cada nota (evita reset/duplicidade); grava o `numero` devolvido em `fin_nfse.numero` e atualiza `emp_nfse_proximo_numero = numero+1` (sincronia de exibição).

---

## Task 1: Helpers puros (empresa_status → ACBr)

**Files:**
- Create: `backend/src/modules/nfse/nfse-empresa-config.ts`
- Create: `backend/scripts/nfse-empresa-config.test.ts`

- [ ] **Step 1: Teste (falha primeiro)** — `backend/scripts/nfse-empresa-config.test.ts`:
```ts
import assert from 'node:assert';
import { empresaToConfigNfse, empresaToAliquotas } from '../src/modules/nfse/nfse-empresa-config';

const empSimples = {
  emp_cnpj: '17.504.829/0001-24', emp_nome: 'HAMILTON LUIZ', emp_im: '00179657007',
  emp_regime: 'SIMPLES_MEEPP', emp_ibge: '5002704', emp_nfse_ambiente: 'HOMOLOGACAO',
  emp_nfse_proximo_numero: 442, emp_nfse_serie: '1',
  emp_ctribnac: '010701', emp_cnbs: '115013000', emp_item_lc116: '01.07.01',
  emp_ctribmun: null, emp_cnae: '620910000', emp_iss_pct: 5,
};

const cfg = empresaToConfigNfse(empSimples);
assert.equal(cfg.ambiente, 'homologacao');
assert.equal(cfg.regTrib.opSimpNac, 3, 'SIMPLES_MEEPP → opSimpNac 3');
assert.equal(cfg.regTrib.regApTribSN, 1, 'optante → regApTribSN 1');
assert.equal(cfg.rps.numero, 442, 'semente da numeração');

const aliq = empresaToAliquotas(empSimples);
assert.equal(aliq.regime, 'SIMPLES_MEEPP');
assert.equal(aliq.codigo_servico_padrao, '010701', 'cTribNac');
assert.equal(aliq.cnbs, '115013000');
assert.equal(aliq.inscricao_municipal, '00179657007');

const empPres = { ...empSimples, emp_regime: 'PRESUMIDO' };
const cfgP = empresaToConfigNfse(empPres);
assert.equal(cfgP.regTrib.opSimpNac, 1, 'não optante');
assert.equal(cfgP.regTrib.regApTribSN, undefined, 'não-optante não manda regApTribSN');

console.log('OK — empresa-config helpers');
```

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx tsx scripts/nfse-empresa-config.test.ts` → "Cannot find module".

- [ ] **Step 3: Implementar** — `backend/src/modules/nfse/nfse-empresa-config.ts`:
```ts
import { AliquotasNfse } from './nfse-payload';

const onlyDigits = (s: any) => String(s ?? '').replace(/\D/g, '');

export interface EmpresaStatusFiscal {
  emp_cnpj?: string; emp_nome?: string; emp_im?: string;
  emp_regime?: string; emp_ibge?: string; emp_nfse_ambiente?: string;
  emp_nfse_proximo_numero?: number | string; emp_nfse_serie?: string;
  emp_ctribnac?: string; emp_cnbs?: string; emp_item_lc116?: string;
  emp_ctribmun?: string | null; emp_cnae?: string | null; emp_iss_pct?: number | string;
}

/** empresa_status → AliquotasNfse (o que buildNfsePayload espera). */
export function empresaToAliquotas(e: EmpresaStatusFiscal): AliquotasNfse {
  return {
    regime: e.emp_regime || 'PRESUMIDO',
    iss_pct: Number(e.emp_iss_pct) || 0,
    inscricao_municipal: e.emp_im || '',
    codigo_servico_padrao: e.emp_ctribnac || '',
    ctrib_mun: e.emp_ctribmun || undefined,
    cnbs: e.emp_cnbs || undefined,
  };
}

/** empresa_status → EmpresaConfigNfse (PUT /empresas/{cnpj}/nfse). */
export function empresaToConfigNfse(e: EmpresaStatusFiscal) {
  const regime = (e.emp_regime || '').toUpperCase();
  const isSimples = regime.includes('SIMPLES');
  const isMEI = regime === 'SIMPLES_MEI';
  const opSimpNac = isMEI ? 2 : isSimples ? 3 : 1;
  const regTrib: any = { opSimpNac, regEspTrib: 0 };
  if (isSimples) regTrib.regApTribSN = 1;        // optante: obrigatório (1/2/3)
  return {
    ambiente: e.emp_nfse_ambiente === 'PRODUCAO' ? 'producao' : 'homologacao',
    incentivo_fiscal: false,
    regTrib,
    rps: { numero: Number(e.emp_nfse_proximo_numero) || 1, serie: e.emp_nfse_serie || '1', lote: 1 },
  };
}

export const cnpjDigits = onlyDigits;
```

- [ ] **Step 4: Rodar e passar** — `npx tsx scripts/nfse-empresa-config.test.ts` → `OK — empresa-config helpers`.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/nfse/nfse-empresa-config.ts backend/scripts/nfse-empresa-config.test.ts
git commit -m "feat(nfse): helpers empresa_status -> config ACBr + AliquotasNfse"
```

---

## Task 2: Prévia (backend)

**Files:**
- Modify: `backend/src/modules/nfse/nfse.controller.ts` (imports + novo handler)
- Modify: `backend/src/modules/nfse/nfse.routes.ts`

- [ ] **Step 1: Imports no topo do controller** (após os imports já existentes do módulo):
```ts
import { empresaToAliquotas, empresaToConfigNfse, cnpjDigits } from './nfse-empresa-config';
```
(Confirme que `buildNfsePayload` e `* as acbr` já estão importados — estão, do trabalho anterior.)

- [ ] **Step 2: Helper de carga + handler de prévia** — adicionar ANTES do `emitirNfseHandler`:
```ts
// Carrega o que a emissão/prévia precisam: lançamento (com CNPJ do tomador) + empresa_status.
async function carregarParaEmissao(db: any, id: number) {
  const lanc = (await db.query(`
    SELECT n.*, f.for_cgc AS for_cnpj, COALESCE(NULLIF(TRIM(f.for_nomered),''), f.for_nome, n.representada_nome) AS tomador_nome
    FROM fin_nfse n LEFT JOIN fornecedores f ON f.for_codigo = n.for_codigo
    WHERE n.id = $1
  `, [id])).rows[0];
  const emp = (await db.query(`SELECT * FROM empresa_status WHERE emp_id = 1`)).rows[0] || {};
  return { lanc, emp };
}

function validarEmissao(lanc: any, emp: any): string[] {
  const faltando: string[] = [];
  if (!lanc) { faltando.push('Lançamento não encontrado'); return faltando; }
  if (!emp.emp_cnpj) faltando.push('CNPJ da empresa (Configurações)');
  if (!emp.emp_im) faltando.push('Inscrição Municipal (Configurações → Dados Fiscais)');
  if (!emp.emp_ctribnac) faltando.push('Código de tributação nacional (Configurações)');
  if (!emp.emp_cnbs) faltando.push('Código NBS (Configurações)');
  if (!lanc.for_cnpj) faltando.push('CNPJ da representada (tomador)');
  if (!(Number(lanc.vr_bruto) > 0)) faltando.push('Valor (VR Bruto) maior que zero');
  return faltando;
}

function montarPayload(lanc: any, emp: any) {
  return buildNfsePayload({
    lancamento: {
      id: lanc.id, competencia: lanc.competencia, vr_bruto: Number(lanc.vr_bruto),
      iss: Number(lanc.iss), representada_nome: lanc.tomador_nome || lanc.representada_nome || '',
      for_cnpj: String(lanc.for_cnpj),
    },
    aliquotas: empresaToAliquotas(emp),
    prestador: { cnpj: String(emp.emp_cnpj), razao: emp.emp_nome || '', ibge: String(emp.emp_ibge || '') },
    provedor: 'nacional',  // v2: emissão sempre via /nfse/dps
    ambiente: emp.emp_nfse_ambiente === 'PRODUCAO' ? 'producao' : 'homologacao',
  });
}

// GET /:id/previa — monta o payload e devolve um resumo legível, SEM emitir.
export async function previaNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { lanc, emp } = await carregarParaEmissao(db, Number(req.params.id));
    const faltando = validarEmissao(lanc, emp);
    if (faltando.length) { res.status(400).json({ success: false, message: 'Faltam dados para emitir: ' + faltando.join('; '), faltando }); return; }
    const { payload } = montarPayload(lanc, emp);
    const isSimples = (emp.emp_regime || '').toUpperCase().includes('SIMPLES');
    res.json({ success: true, data: {
      prestador: { nome: emp.emp_nome, cnpj: emp.emp_cnpj, im: emp.emp_im },
      tomador: { nome: lanc.tomador_nome || lanc.representada_nome, cnpj: lanc.for_cnpj },
      servico: { item_lc116: emp.emp_item_lc116, ctribnac: emp.emp_ctribnac, cnbs: emp.emp_cnbs,
                 descricao: `Comissão sobre representação comercial — competência ${lanc.competencia}` },
      valor: Number(lanc.vr_bruto), iss_pct: isSimples ? null : Number(emp.emp_iss_pct) || 0, iss_simples: isSimples,
      competencia: lanc.competencia,
      ambiente: emp.emp_nfse_ambiente === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO',
    }, payload });
  } catch (e: any) {
    console.error('❌ [NFSE previa]:', e?.message);
    res.status(500).json({ success: false, message: e?.message ?? 'Erro ao montar prévia' });
  }
}
```

- [ ] **Step 3: Rota** — em `nfse.routes.ts`, adicionar `previaNfseHandler` ao import e a rota:
```ts
router.get('/:id/previa', previaNfseHandler);
```

- [ ] **Step 4: Typecheck** — `cd backend && npx tsc --noEmit` → sem erros.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/nfse/nfse.controller.ts backend/src/modules/nfse/nfse.routes.ts
git commit -m "feat(nfse): GET /nfse/:id/previa — resumo fiel sem emitir"
```

---

## Task 3: Reescrever `emitirNfseHandler` (lê empresa_status)

**Files:**
- Modify: `backend/src/modules/nfse/nfse.controller.ts`

- [ ] **Step 1: Substituir o corpo do `emitirNfseHandler`** pelo novo (reaproveita `carregarParaEmissao`/`validarEmissao`/`montarPayload` da Task 2 e `extrairMotivoAcbr` já existente):
```ts
// POST /:id/emitir  — emite a NFS-e do lançamento (ambiente vem da config da empresa)
export async function emitirNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = Number(req.params.id);
    const { lanc, emp } = await carregarParaEmissao(db, id);
    const faltando = validarEmissao(lanc, emp);
    if (faltando.length) { res.status(400).json({ success: false, message: 'Faltam dados para emitir: ' + faltando.join('; '), faltando }); return; }

    const cnpj = cnpjDigits(emp.emp_cnpj);
    const { payload } = montarPayload(lanc, emp);

    // Emite; se faltar config no ACBr, configura (lazy, semeando a numeração) e repete UMA vez.
    let emit: any;
    try {
      emit = await acbr.emitirDps(payload);
    } catch (err: any) {
      const isConfig = err?.status === 400 && /ConfigNfseNotFound|configura/i.test(String(err?.message) + String(err?.body ?? ''));
      if (!isConfig) throw err;
      await acbr.configurarNfseEmpresa(cnpj, empresaToConfigNfse(emp));
      emit = await acbr.emitirDps(payload);
    }

    const acbrId = emit?.id ?? emit?.data?.id;
    let status = String(emit?.status ?? '').toLowerCase();
    let info: any = emit;
    for (let i = 0; acbrId && !['autorizada','autorizado','concluido','negada','rejeitado','erro','cancelada'].includes(status) && i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      info = await acbr.consultar(acbrId);
      status = String(info?.status ?? '').toLowerCase();
    }

    const ok = ['autorizada','autorizado','concluido'].includes(status);
    const terminal = ['negada','rejeitado','erro','cancelada'].includes(status);
    const novoStatus = ok ? 'EMITIDA' : terminal ? 'ERRO' : 'PENDENTE';
    const motivo = ok ? null : (extrairMotivoAcbr(info) ?? motivoMensagens(info) ?? `status ACBr: ${status || 'desconhecido'}`);
    const numero = info?.numero ?? null;

    await db.query(`
      UPDATE fin_nfse SET
        status=$1, numero=COALESCE($2, numero), protocolo=$3, codigo_verificacao=$4,
        xml=$5, erro_msg=$6, emitida_em = CASE WHEN $7 THEN now() ELSE emitida_em END, updated_at=now()
      WHERE id=$8
    `, [novoStatus, numero, acbrId ?? null,
        info?.codigo_verificacao ?? null, info?.xml ?? null, motivo, ok, id]);

    if (ok && numero) {
      await db.query(`UPDATE empresa_status SET emp_nfse_proximo_numero = $1 WHERE emp_id = 1`, [Number(numero) + 1]);
    }

    res.json({ success: ok, status: novoStatus, numero, acbr_id: acbrId,
      codigo_verificacao: info?.codigo_verificacao ?? null, link_url: info?.link_url ?? null,
      motivo, data: info });
  } catch (e: any) {
    const msg = e?.message ?? 'Erro ao emitir NFS-e';
    console.error('❌ [NFSE emitir]:', msg, e?.body ? '| body: ' + String(e.body).slice(0, 800) : '');
    res.status(500).json({ success: false, message: msg, acbr_body: e?.rawJson ?? e?.body ?? null });
  }
}
```

- [ ] **Step 2: Helper `motivoMensagens`** (lê o array `mensagens[]` do Sistema Nacional) — adicionar perto de `extrairMotivoAcbr`:
```ts
// Motivo vindo de info.mensagens[] (Sistema Nacional NFS-e: [{codigo, descricao}]).
function motivoMensagens(info: any): string | null {
  const arr = Array.isArray(info?.mensagens) ? info.mensagens : null;
  if (!arr || !arr.length) return null;
  return arr.map((m: any) => (m?.codigo ? `${m.codigo}: ` : '') + (m?.descricao ?? m?.mensagem ?? '')).filter(Boolean).join(' · ').slice(0, 1000) || null;
}
```

- [ ] **Step 3: Remover o `resolverProvedor`/`masterPool`/IBGE fixo** do handler antigo (se ainda referenciados e sem uso). Remova o import de `masterPool` se ficou órfão.

- [ ] **Step 4: Typecheck** — `cd backend && npx tsc --noEmit` → sem erros.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/nfse/nfse.controller.ts
git commit -m "feat(nfse): emitir lê empresa_status (config 051), config ACBr lazy, numeração"
```

---

## Task 4: PDF / XML / Cancelar (backend)

**Files:**
- Modify: `backend/src/modules/nfse/nfse.controller.ts`
- Modify: `backend/src/modules/nfse/nfse.routes.ts`

- [ ] **Step 1: Handlers** — adicionar ao fim do controller:
```ts
// GET /:id/pdf — DANFSE
export async function pdfNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = (await db.query(`SELECT protocolo FROM fin_nfse WHERE id=$1`, [Number(req.params.id)])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e ainda não emitida.' }); return; }
    const pdf = await acbr.baixarPdf(String(r.protocolo));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="nfse-${req.params.id}.pdf"`);
    res.send(pdf.data);
  } catch (e: any) { res.status(500).json({ success: false, message: e?.message ?? 'Erro ao baixar PDF' }); }
}

// GET /:id/xml
export async function xmlNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = (await db.query(`SELECT protocolo FROM fin_nfse WHERE id=$1`, [Number(req.params.id)])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e ainda não emitida.' }); return; }
    const xml = await acbr.baixarXml(String(r.protocolo));
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${req.params.id}.xml"`);
    res.send(xml.data);
  } catch (e: any) { res.status(500).json({ success: false, message: e?.message ?? 'Erro ao baixar XML' }); }
}

// POST /:id/cancelar  { motivo }
export async function cancelarNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = Number(req.params.id);
    const motivo = String(req.body?.motivo || '').trim();
    if (motivo.length < 15) { res.status(400).json({ success: false, message: 'Informe um motivo de cancelamento (mín. 15 caracteres).' }); return; }
    const r = (await db.query(`SELECT protocolo, status FROM fin_nfse WHERE id=$1`, [id])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e não emitida.' }); return; }
    if (r.status === 'CANCELADA') { res.status(400).json({ success: false, message: 'NFS-e já cancelada.' }); return; }
    const out: any = await acbr.cancelar(String(r.protocolo), motivo);
    await db.query(`UPDATE fin_nfse SET status='CANCELADA', cancelada_em=now(), obs=COALESCE(obs,'')||' [CANCELADA: '||$2||']', updated_at=now() WHERE id=$1`, [id, motivo]);
    res.json({ success: true, data: out });
  } catch (e: any) {
    console.error('❌ [NFSE cancelar]:', e?.message);
    res.status(500).json({ success: false, message: e?.message ?? 'Erro ao cancelar', acbr_body: e?.rawJson ?? e?.body ?? null });
  }
}
```

- [ ] **Step 2: Rotas** — `nfse.routes.ts`, import + rotas:
```ts
router.get ('/:id/pdf',      pdfNfseHandler);
router.get ('/:id/xml',      xmlNfseHandler);
router.post('/:id/cancelar', cancelarNfseHandler);
```

- [ ] **Step 3: Typecheck** — `cd backend && npx tsc --noEmit` → sem erros.

- [ ] **Step 4: Commit**
```bash
git add backend/src/modules/nfse/nfse.controller.ts backend/src/modules/nfse/nfse.routes.ts
git commit -m "feat(nfse): endpoints PDF, XML e cancelamento da NFS-e"
```

---

## Task 5: Frontend — status na tabela + EmitirModal (prévia/confirma)

**Files:**
- Modify: `src/modules/financeiro/pages/NfseComissoesPage.tsx`

- [ ] **Step 1: Estender a interface `Nfse`** (adicionar após `obs`):
```ts
  status?: string; codigo_verificacao?: string | null; protocolo?: string | null; erro_msg?: string | null
```

- [ ] **Step 1b: Helper de download autenticado** — a rota é MASTER-only (JWT no header), então `<a href>` NÃO funciona (não manda o token). Use `api` (blob). Adicionar perto dos helpers do topo do arquivo:
```ts
async function baixarArquivo(path: string, abrir = false) {
  const r = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(r.data)
  if (abrir) window.open(url, '_blank')
  else { const a = document.createElement('a'); a.href = url; a.download = path.split('/').pop() || 'arquivo'; a.click() }
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
```

- [ ] **Step 2: Estado do modal de emissão** — no componente `NfseComissoesPage`, junto aos outros `useState`:
```ts
  const [emitir, setEmitir] = useState<Nfse | null>(null)
```

- [ ] **Step 3: Coluna de Status + botão Emitir na linha** — na célula de ações (onde estão Editar/Excluir), antes do botão Editar, inserir o badge de status e a ação conforme o status:
```tsx
                    <StatusBadge status={n.status} />
                    {(!n.status || n.status === 'CONTROLE' || n.status === 'ERRO') && (
                      <button title={n.status === 'ERRO' ? 'Reemitir' : 'Emitir NFS-e'} onClick={() => setEmitir(n)} style={{ ...iconBtn, color: G.green }}><FileUp size={14} /></button>
                    )}
```
(importe `FileUp` de `lucide-react` no topo; o `StatusBadge` é definido no Step 4. Mantenha os botões Editar/Excluir existentes.)

- [ ] **Step 4: Componente `StatusBadge`** — adicionar ao arquivo (perto de `KpiCard`):
```tsx
function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'CONTROLE') return null
  const map: Record<string, { t: string; bg: string; c: string }> = {
    EMITIDA:   { t: 'Emitida',   bg: '#E8F5E9', c: '#2E7D32' },
    ERRO:      { t: 'Erro',      bg: '#FDECEA', c: '#C62828' },
    PENDENTE:  { t: 'Processando', bg: '#FFF7ED', c: '#9A3412' },
    CANCELADA: { t: 'Cancelada', bg: '#ECEFF1', c: '#546E7A' },
  }
  const s = map[status] || { t: status, bg: '#ECEFF1', c: '#546E7A' }
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: s.bg, color: s.c, marginRight: 6 }}>{s.t}</span>
}
```

- [ ] **Step 5: Montar o modal** — no JSX, ao lado de `{modal && (...)}`:
```tsx
      {emitir && (
        <EmitirModal nfse={emitir} onClose={() => setEmitir(null)} onDone={() => { setEmitir(null); reload() }} />
      )}
```

- [ ] **Step 6: Componente `EmitirModal`** — adicionar ao arquivo:
```tsx
function EmitirModal({ nfse, onClose, onDone }: { nfse: Nfse; onClose: () => void; onDone: () => void }) {
  const [prev, setPrev] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [emitindo, setEmitindo] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    api.get(`/nfse/${nfse.id}/previa`)
      .then(r => setPrev(r.data.data))
      .catch(e => setErro(e?.response?.data?.message || 'Erro ao montar a prévia.'))
      .finally(() => setLoading(false))
  }, [nfse.id])

  const emitir = async () => {
    setEmitindo(true); setErro(null)
    try {
      const r = await api.post(`/nfse/${nfse.id}/emitir`)
      if (r.data.success) setResult(r.data)
      else setErro(r.data.motivo || r.data.message || 'A prefeitura recusou a nota.')
    } catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao emitir.') }
    finally { setEmitindo(false) }
  }

  return (
    <Overlay onClose={onClose} width={560}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: G.navy }}>Emitir NFS-e</div>
        <button onClick={onClose} style={iconBtn}><X size={18} /></button>
      </div>

      {loading ? <div style={{ color: G.muted, padding: 20 }}>Montando prévia…</div>
       : result ? (
        <div>
          <div style={{ padding: 12, borderRadius: 8, background: '#E8F5E9', color: '#2E7D32', fontWeight: 700, marginBottom: 12 }}>
            ✓ NFS-e {result.numero ? `nº ${result.numero}` : ''} autorizada!
          </div>
          {result.codigo_verificacao && <Prev2 l="Cód. verificação" v={result.codigo_verificacao} />}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => baixarArquivo(`/nfse/${nfse.id}/pdf`, true)} style={btnPrimary(G.navy)}>📄 Abrir PDF</button>
            {result.link_url && <a href={result.link_url} target="_blank" rel="noreferrer" style={{ ...btnPrimary(G.mustard), textDecoration: 'none' }}>🔗 Consulta pública</a>}
            <button onClick={onDone} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
       ) : prev ? (
        <div>
          {prev.ambiente === 'PRODUCAO'
            ? <div style={{ padding: 10, borderRadius: 8, background: '#FDECEA', color: '#C62828', fontWeight: 700, fontSize: 12, marginBottom: 12 }}>⚠ PRODUÇÃO — esta nota tem valor fiscal.</div>
            : <div style={{ padding: 10, borderRadius: 8, background: '#FFF7ED', color: '#9A3412', fontWeight: 700, fontSize: 12, marginBottom: 12 }}>Ambiente de HOMOLOGAÇÃO (teste, sem valor fiscal).</div>}
          <Prev2 l="Prestador" v={`${prev.prestador.nome} · ${prev.prestador.cnpj} · IM ${prev.prestador.im}`} />
          <Prev2 l="Tomador" v={`${prev.tomador.nome} · ${prev.tomador.cnpj}`} />
          <Prev2 l="Serviço" v={`${prev.servico.item_lc116} — ${prev.servico.descricao}`} />
          <Prev2 l="Códigos" v={`cTribNac ${prev.servico.ctribnac} · NBS ${prev.servico.cnbs}`} />
          <Prev2 l="Valor" v={fmtBRL(prev.valor)} strong />
          <Prev2 l="ISS" v={prev.iss_simples ? 'recolhido via DAS (Simples)' : `${prev.iss_pct}%`} />
          {erro && <div style={{ padding: 10, borderRadius: 8, background: '#FDECEA', color: '#C62828', fontSize: 12, margin: '12px 0', whiteSpace: 'pre-wrap' }}>{erro}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={emitir} disabled={emitindo} style={btnPrimary(G.green)}>{emitindo ? 'Emitindo…' : 'Confirmar e emitir'}</button>
          </div>
        </div>
       ) : <div style={{ padding: 12, borderRadius: 8, background: '#FDECEA', color: '#C62828', fontSize: 13 }}>{erro}</div>}
    </Overlay>
  )
}

function Prev2({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13 }}>
      <span style={{ color: G.muted, flexShrink: 0 }}>{l}</span>
      <span style={{ fontWeight: strong ? 800 : 600, color: G.navy, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
```

- [ ] **Step 7: Build** — `cd .. && npx vite build` → `✓ built`. (Garanta os imports: `FileUp` de lucide-react; `useEffect` já importado.)

- [ ] **Step 8: Commit**
```bash
git add src/modules/financeiro/pages/NfseComissoesPage.tsx
git commit -m "feat(nfse): EmitirModal (prévia + confirma) + status na tabela de Comissões"
```

---

## Task 6: Frontend — ações pós-emissão (PDF/XML/Link/Cancelar)

**Files:**
- Modify: `src/modules/financeiro/pages/NfseComissoesPage.tsx`

- [ ] **Step 1: Estado do cancelamento** — junto aos outros `useState`:
```ts
  const [cancelar, setCancelar] = useState<Nfse | null>(null)
```

- [ ] **Step 2: Ações por linha para EMITIDA** — na célula de ações, para linhas com `status === 'EMITIDA'`, adicionar (além do badge):
```tsx
                    {n.status === 'EMITIDA' && (<>
                      <button title="PDF" onClick={() => baixarArquivo(`/nfse/${n.id}/pdf`, true)} style={{ ...iconBtn, color: G.navy }}><FileText size={14} /></button>
                      <button title="XML" onClick={() => baixarArquivo(`/nfse/${n.id}/xml`)} style={{ ...iconBtn, color: G.navy }}><FileCode size={14} /></button>
                      <button title="Cancelar NFS-e" onClick={() => setCancelar(n)} style={{ ...iconBtn, color: G.red }}><Ban size={14} /></button>
                    </>)}
                    {n.status === 'ERRO' && n.erro_msg && (
                      <span title={n.erro_msg} style={{ color: G.red, fontSize: 11, cursor: 'help' }}>⚠</span>
                    )}
```
(importe `FileText`, `FileCode`, `Ban` de lucide-react.)

- [ ] **Step 3: Montar o `CancelarModal`** — ao lado dos outros modais:
```tsx
      {cancelar && (
        <CancelarModal nfse={cancelar} onClose={() => setCancelar(null)} onDone={() => { setCancelar(null); reload() }} />
      )}
```

- [ ] **Step 4: Componente `CancelarModal`** (motivo + dupla confirmação):
```tsx
function CancelarModal({ nfse, onClose, onDone }: { nfse: Nfse; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [confirma, setConfirma] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const go = async () => {
    setBusy(true); setErro(null)
    try {
      const r = await api.post(`/nfse/${nfse.id}/cancelar`, { motivo })
      if (r.data.success) onDone()
      else setErro(r.data.message || 'Falha ao cancelar.')
    } catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao cancelar.') }
    finally { setBusy(false) }
  }

  return (
    <Overlay onClose={onClose} width={520}>
      <div style={{ fontSize: 16, fontWeight: 800, color: G.red, marginBottom: 10 }}>Cancelar NFS-e nº {nfse.numero}</div>
      <div style={{ padding: 10, borderRadius: 8, background: '#FDECEA', color: '#C62828', fontSize: 12, marginBottom: 12 }}>
        O cancelamento gera um evento na prefeitura e <strong>é irreversível</strong>.
      </div>
      <label style={{ fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase' }}>Motivo do cancelamento (mín. 15 caracteres)</label>
      <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', marginTop: 4 }} placeholder="Ex.: emitida em duplicidade / valor incorreto / a pedido do cliente" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', fontSize: 13, color: G.navy, cursor: 'pointer' }}>
        <input type="checkbox" checked={confirma} onChange={e => setConfirma(e.target.checked)} />
        Confirmo que quero cancelar esta nota na prefeitura.
      </label>
      {erro && <div style={{ padding: 10, borderRadius: 8, background: '#FDECEA', color: '#C62828', fontSize: 12, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Voltar</button>
        <button onClick={go} disabled={busy || !confirma || motivo.trim().length < 15} style={btnPrimary(G.red)}>{busy ? 'Cancelando…' : 'Cancelar a NFS-e'}</button>
      </div>
    </Overlay>
  )
}
```

- [ ] **Step 5: Build** — `cd .. && npx vite build` → `✓ built`.

- [ ] **Step 6: Commit**
```bash
git add src/modules/financeiro/pages/NfseComissoesPage.tsx
git commit -m "feat(nfse): ações pós-emissão (PDF/XML/cancelar c/ dupla confirmação)"
```

---

## Notas finais

- **Deploy:** backend = recompilar `backend/dist` + `pm2 restart` (controller, routes, novo helper) + envs `ACBR_*`; frontend = `dist/`.
- **Dependência real:** sem o **certificado A1** subido pro ACBr a emissão falha (erro claro do ACBr). O upload é a etapa pendente do form de Config.
- **Verificação ao vivo:** após deploy, com cert + config preenchidos, emitir 1 lançamento em homologação e conferir prévia → autorizada → PDF.
- **Fora de escopo:** lote, e-mail, upload de cert, auto-IBGE.
