# NFS-e — Evolução do Form · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Acesso Gerência+ no sidebar, número da sequência, seletor de serviços (códigos+discriminação por nota), envio por e-mail das autorizadas, e indústrias ativas — no form de NFS-e.

**Architecture:** Nova tabela `fin_nfse_servicos` + `fin_nfse.servico_id` guardam o serviço por nota; o handler resolve os códigos do serviço (fallback pro default da empresa). Backend ganha CRUD de serviços + endpoint de e-mail (reusa o módulo `email`). Rotas abrem pra Gerência. Frontend: combobox de serviço, nº pré-preenchido, modal de gestão de serviços, modal de e-mail, item no sidebar.

**Tech Stack:** Express/TS, `pg`, React/Vite. Verificação: tsx+assert / tsc / vite build.

**Spec:** `docs/superpowers/specs/2026-06-12-nfse-form-evolucao-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/migrations/053_fin_nfse_servicos.sql` + `replicate-053.ts` (criar) | tabela serviços + `fin_nfse.servico_id` + seed |
| `backend/src/modules/nfse/nfse.controller.ts` (modificar) | CRUD serviços; resolver códigos do serviço em carregar/montar; handler de e-mail |
| `backend/src/modules/nfse/nfse.routes.ts` (modificar) | rotas serviços + e-mail; `requireLevel(GERENCIA)` |
| `src/modules/financeiro/pages/NfseComissoesPage.tsx` (modificar) | combobox serviço + nº pré-fill no NfseModal; ServicosModal; EmailModal; botão e-mail |
| `src/shared/components/layout/AppSidebar.tsx` (modificar) | item "NFS-e" (minLevel 2) |

---

## Task 1: Migration — serviços + servico_id

**Files:**
- Create: `backend/migrations/053_fin_nfse_servicos.sql`
- Create: `backend/migrations/replicate-053.ts`

- [ ] **Step 1: SQL** — `053_fin_nfse_servicos.sql`:
```sql
-- Migration 053: cadastro de serviços da NFS-e + referência no lançamento (por tenant).
CREATE TABLE IF NOT EXISTS fin_nfse_servicos (
  id          SERIAL PRIMARY KEY,
  descricao   VARCHAR(120) NOT NULL,
  item_lc116  VARCHAR(12),
  ctribnac    VARCHAR(10),
  cnbs        VARCHAR(12),
  ctribmun    VARCHAR(10),
  iss_pct     NUMERIC(6,2) DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMP DEFAULT NOW()
);

ALTER TABLE fin_nfse ADD COLUMN IF NOT EXISTS servico_id INTEGER;

-- Seed dos serviços com códigos já validados ao vivo (idempotente por descricao).
INSERT INTO fin_nfse_servicos (descricao, item_lc116, ctribnac, cnbs, iss_pct)
SELECT 'Representação comercial', '10.09.01', '100901', '102010000', 0
WHERE NOT EXISTS (SELECT 1 FROM fin_nfse_servicos WHERE descricao = 'Representação comercial');

INSERT INTO fin_nfse_servicos (descricao, item_lc116, ctribnac, cnbs, iss_pct)
SELECT 'Suporte técnico em TI', '01.07.01', '010701', '115013000', 0
WHERE NOT EXISTS (SELECT 1 FROM fin_nfse_servicos WHERE descricao = 'Suporte técnico em TI');
```

- [ ] **Step 2: Replicate** — `replicate-053.ts` (copie `replicate-051.ts` trocando o nome do SQL e o filtro de existência da tabela `empresa_status` por `fin_nfse`):
```ts
import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const master = new Pool({
    host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database: process.env.MASTER_DB_NAME, user: process.env.MASTER_DB_USER,
    password: process.env.MASTER_DB_PASSWORD,
    ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  const cred = (await master.query(
    `SELECT db_nome, db_usuario, db_senha FROM public.empresas WHERE status='ATIVO' AND db_nome IS NOT NULL LIMIT 1`
  )).rows[0];
  await master.end();
  if (!cred) throw new Error('Sem tenant ativo.');
  const pool = new Pool({
    host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database: cred.db_nome, user: cred.db_usuario, password: cred.db_senha,
    ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  const sql = fs.readFileSync(path.join(__dirname, '053_fin_nfse_servicos.sql'), 'utf8');
  const schemas = (await pool.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','pg_catalog','information_schema','pg_toast','basesales')
      AND schema_name NOT LIKE 'pg_%'
      AND EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = schema_name AND t.table_name = 'fin_nfse')
    ORDER BY schema_name
  `)).rows.map(r => r.schema_name);
  console.log(`Migration 053 → ${schemas.length} schemas...`);
  let ok = 0, fail = 0;
  for (const schema of schemas) {
    const c = await pool.connect();
    try { await c.query(`SET search_path TO "${schema}", public`); await c.query(sql); console.log(`  ✅ ${schema}`); ok++; }
    catch (err: any) { console.error(`  ❌ ${schema}: ${err.message}`); fail++; }
    finally { await c.query('RESET search_path').catch(() => {}); c.release(); }
  }
  await pool.end();
  console.log(`\nDone. OK=${ok} FAIL=${fail}`);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
```

- [ ] **Step 3: Rodar** — `cd backend && npx tsx migrations/replicate-053.ts` → `Done. OK=31 FAIL=0`.

- [ ] **Step 4: Commit**
```bash
git add backend/migrations/053_fin_nfse_servicos.sql backend/migrations/replicate-053.ts
git commit -m "feat(nfse): migration 053 — cadastro de serviços + fin_nfse.servico_id (seed)"
```

---

## Task 2: Backend — serviços CRUD + payload pelo serviço + acesso Gerência

**Files:**
- Modify: `backend/src/modules/nfse/nfse.controller.ts`
- Modify: `backend/src/modules/nfse/nfse.routes.ts`

- [ ] **Step 1: Handlers de serviços** — adicionar ao controller:
```ts
// GET /servicos — lista serviços (ativos primeiro)
export async function listServicosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query(`SELECT * FROM fin_nfse_servicos ORDER BY ativo DESC, descricao`);
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'listServicos'); }
}
// POST /servicos
export async function createServicoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!; const b = req.body || {};
    if (!String(b.descricao || '').trim()) { res.status(400).json({ success: false, message: 'Descrição é obrigatória.' }); return; }
    const r = await db.query(`
      INSERT INTO fin_nfse_servicos (descricao, item_lc116, ctribnac, cnbs, ctribmun, iss_pct, ativo)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,true)) RETURNING *
    `, [b.descricao.trim(), b.item_lc116 || null, b.ctribnac || null, b.cnbs || null, b.ctribmun || null,
        b.iss_pct === '' || b.iss_pct == null ? 0 : Number(b.iss_pct), b.ativo]);
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'createServico'); }
}
// PUT /servicos/:id
export async function updateServicoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!; const b = req.body || {};
    const r = await db.query(`
      UPDATE fin_nfse_servicos SET descricao=$1, item_lc116=$2, ctribnac=$3, cnbs=$4, ctribmun=$5, iss_pct=$6, ativo=COALESCE($7,ativo)
      WHERE id=$8 RETURNING *
    `, [b.descricao, b.item_lc116 || null, b.ctribnac || null, b.cnbs || null, b.ctribmun || null,
        b.iss_pct === '' || b.iss_pct == null ? 0 : Number(b.iss_pct), b.ativo, Number(req.params.id)]);
    if (!r.rowCount) { res.status(404).json({ success: false, message: 'Serviço não encontrado.' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { err(res, e, 'updateServico'); }
}
// DELETE /servicos/:id
export async function deleteServicoHandler(req: Request, res: Response): Promise<void> {
  try { await req.db!.query(`DELETE FROM fin_nfse_servicos WHERE id=$1`, [Number(req.params.id)]); res.json({ success: true }); }
  catch (e) { err(res, e, 'deleteServico'); }
}
```

- [ ] **Step 2: Resolver os códigos do serviço** — em `carregarParaEmissao`, carregar o serviço do lançamento; em `montarPayload`/prévia, usar o serviço quando houver. Substituir `carregarParaEmissao` por:
```ts
async function carregarParaEmissao(db: any, id: number) {
  const lanc = (await db.query(`
    SELECT n.*, f.for_cgc AS for_cnpj, f.for_email AS tomador_email,
           COALESCE(NULLIF(TRIM(f.for_nomered),''), f.for_nome, n.representada_nome) AS tomador_nome,
           s.descricao AS serv_descricao, s.item_lc116 AS serv_item, s.ctribnac AS serv_ctribnac,
           s.cnbs AS serv_cnbs, s.ctribmun AS serv_ctribmun, s.iss_pct AS serv_iss
    FROM fin_nfse n
    LEFT JOIN fornecedores f ON f.for_codigo = n.for_codigo
    LEFT JOIN fin_nfse_servicos s ON s.id = n.servico_id
    WHERE n.id = $1
  `, [id])).rows[0];
  const emp = (await db.query(`SELECT * FROM empresa_status WHERE emp_id = 1`)).rows[0] || {};
  return { lanc, emp };
}
```
E em `montarPayload`, montar as alíquotas e a discriminação preferindo o serviço:
```ts
function montarPayload(lanc: any, emp: any) {
  const usaServ = !!lanc.serv_ctribnac;
  const aliquotas = usaServ
    ? { regime: emp.emp_regime || 'PRESUMIDO', iss_pct: Number(lanc.serv_iss) || 0,
        inscricao_municipal: emp.emp_im || '', codigo_servico_padrao: lanc.serv_ctribnac,
        ctrib_mun: lanc.serv_ctribmun || undefined, cnbs: lanc.serv_cnbs || undefined }
    : empresaToAliquotas(emp);
  const desc = lanc.serv_descricao
    ? `${lanc.serv_descricao} — competência ${lanc.competencia}`
    : `Comissão sobre representação comercial — competência ${lanc.competencia}`;
  return buildNfsePayload({
    lancamento: { id: lanc.id, competencia: lanc.competencia, vr_bruto: Number(lanc.vr_bruto), iss: Number(lanc.iss),
      representada_nome: lanc.tomador_nome || lanc.representada_nome || '', for_cnpj: String(lanc.for_cnpj), descricao: desc },
    aliquotas,
    prestador: { cnpj: String(emp.emp_cnpj), razao: emp.emp_nome || '', ibge: String(emp.emp_ibge || '') },
    provedor: 'nacional', ambiente: emp.emp_nfse_ambiente === 'PRODUCAO' ? 'producao' : 'homologacao',
  });
}
```
> **Nota:** isso exige `buildNfsePayload` aceitar uma `descricao` opcional no `lancamento`. No `nfse-payload.ts`, em `LancamentoNfse` adicione `descricao?: string;` e na função `discriminacao(l)` retorne `l.descricao ?? 'Comissão sobre representação comercial — competência ' + l.competencia`. (Verifique a assinatura atual antes.)

- [ ] **Step 3: previaNfseHandler** — incluir o serviço no resumo: trocar o bloco `servico:` por:
```ts
      servico: { item_lc116: lanc.serv_item || emp.emp_item_lc116, ctribnac: lanc.serv_ctribnac || emp.emp_ctribnac,
                 cnbs: lanc.serv_cnbs || emp.emp_cnbs, descricao: lanc.serv_descricao
                   ? `${lanc.serv_descricao} — competência ${lanc.competencia}`
                   : `Comissão sobre representação comercial — competência ${lanc.competencia}` },
```

- [ ] **Step 4: Rotas + acesso Gerência** — em `nfse.routes.ts`: troque `requireLevel(LEVEL.MASTER)` por `requireLevel(LEVEL.GERENCIA)`; adicione import dos handlers de serviço e as rotas:
```ts
router.get   ('/servicos',     listServicosHandler);
router.post  ('/servicos',     createServicoHandler);
router.put   ('/servicos/:id', updateServicoHandler);
router.delete('/servicos/:id', deleteServicoHandler);
```
> Coloque `/servicos` ANTES de `/:id` se houver conflito de rota (Express casa `/:id` com `servicos`). Use `/servicos` e `/servicos/:id` — não colidem com `/:id` numérico, mas registre as de serviço antes por segurança.

- [ ] **Step 5: Typecheck** — `cd backend && npx tsc --noEmit` → sem erros.

- [ ] **Step 6: Commit**
```bash
git add backend/src/modules/nfse/nfse.controller.ts backend/src/modules/nfse/nfse.routes.ts backend/src/modules/nfse/nfse-payload.ts
git commit -m "feat(nfse): cadastro de serviços + emissão usa códigos/discriminação do serviço; acesso Gerência+"
```

---

## Task 3: Backend — envio por e-mail

**Files:**
- Modify: `backend/src/modules/nfse/nfse.controller.ts`
- Modify: `backend/src/modules/nfse/nfse.routes.ts`

- [ ] **Step 1: Ler o módulo de e-mail** — abra `backend/src/modules/email/email.controller.ts` e identifique como ele envia (transporter nodemailer / função exportada). Reuse esse mecanismo (mesmo transporter/credenciais SMTP do envio de pedido).

- [ ] **Step 2: Handler** — adicionar ao controller (ajuste a chamada de envio ao que o módulo `email` expõe):
```ts
// POST /:id/email  { para, assunto?, mensagem? }
export async function emailNfseHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = Number(req.params.id);
    const para = String(req.body?.para || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) { res.status(400).json({ success: false, message: 'E-mail do destinatário inválido.' }); return; }
    const r = (await db.query(`SELECT protocolo, numero FROM fin_nfse WHERE id=$1`, [id])).rows[0];
    if (!r?.protocolo) { res.status(404).json({ success: false, message: 'NFS-e não emitida.' }); return; }
    const [pdf, xml] = await Promise.all([acbr.baixarPdf(String(r.protocolo)), acbr.baixarXml(String(r.protocolo))]);
    const assunto = String(req.body?.assunto || '').trim() || `NFS-e nº ${r.numero ?? ''}`;
    const corpo = String(req.body?.mensagem || '').trim() || `Segue em anexo a NFS-e nº ${r.numero ?? ''} (DANFSE em PDF e XML).`;
    // REUSE o sender do módulo email: enviar { to: para, subject: assunto, html/text: corpo,
    //   attachments: [{ filename: `nfse-${id}.pdf`, content: pdf.data },
    //                 { filename: `nfse-${id}.xml`, content: xml.data }] }
    await enviarEmailComAnexos({ to: para, subject: assunto, text: corpo, attachments: [
      { filename: `nfse-${id}.pdf`, content: pdf.data, contentType: 'application/pdf' },
      { filename: `nfse-${id}.xml`, content: xml.data, contentType: 'application/xml' },
    ]});
    res.json({ success: true });
  } catch (e: any) {
    console.error('❌ [NFSE email]:', e?.message);
    res.status(500).json({ success: false, message: e?.message ?? 'Erro ao enviar e-mail' });
  }
}
```
> Substitua `enviarEmailComAnexos(...)` pela função real do módulo `email` (import no topo). Se o módulo só expõe um handler HTTP e não uma função reutilizável, extraia a lógica de envio (transporter nodemailer) para uma função exportável `enviarEmail(opts)` em `email.controller.ts` ou um novo `email.service.ts`, e use-a aqui. A assinatura mínima: `{ to, subject, text, attachments: [{filename, content:Buffer, contentType}] }`.

- [ ] **Step 3: Rota** — `nfse.routes.ts`: import + `router.post('/:id/email', emailNfseHandler);`

- [ ] **Step 4: Typecheck** — `cd backend && npx tsc --noEmit` → sem erros.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/nfse/
git commit -m "feat(nfse): envio da NFS-e por e-mail (PDF+XML) ao tomador"
```

---

## Task 4: Frontend — nº pré-fill + combobox de serviço

**Files:**
- Modify: `src/modules/financeiro/pages/NfseComissoesPage.tsx`

- [ ] **Step 1: Carregar serviços + próximo número** — na `NfseComissoesPage`, adicionar estados e fetch:
```ts
  const [servicos, setServicos] = useState<any[]>([])
  const [proxNum, setProxNum] = useState<string>('')
```
No `useEffect` de carga inicial (junto dos outros `api.get`):
```ts
    api.get('/nfse/servicos').then(r => setServicos((r.data.data || []).filter((s: any) => s.ativo))).catch(() => {})
    api.get('/empresa').then(r => setProxNum(String(r.data?.data?.emp_nfse_proximo_numero ?? ''))).catch(() => {})
```

- [ ] **Step 2: Passar pro NfseModal** — onde o modal é montado (`<NfseModal ... />`), adicione `servicos={servicos}` e `proximoNumero={proxNum}` às props, e estenda a assinatura do `NfseModal`:
```ts
function NfseModal({ data, competencia, aliq, reps, servicos, proximoNumero, onClose, onSaved }: {
  data: Nfse | null; competencia: string; aliq: Aliquotas
  reps: { id: number; nome: string }[]; servicos: any[]; proximoNumero: string
  onClose: () => void; onSaved: () => void
}) {
```

- [ ] **Step 3: Pré-preencher número + estado do serviço** — dentro do `NfseModal`, ajustar os states:
```ts
  const [numero, setNumero] = useState(data?.numero || (data ? '' : proximoNumero))
  const [servicoId, setServicoId] = useState<string>(data ? String((data as any).servico_id || '') : (servicos[0] ? String(servicos[0].id) : ''))
```

- [ ] **Step 4: Combobox de serviço no form** — adicionar logo após a Representada (antes do VR Bruto), um `<select>` no padrão do form:
```tsx
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={lbl}>Serviço prestado</span>
          <select value={servicoId} onChange={e => setServicoId(e.target.value)} style={{ ...inputStyle, marginTop: 4, cursor: 'pointer' }}>
            {!servicos.length && <option value="">(cadastre um serviço)</option>}
            {servicos.map(s => <option key={s.id} value={String(s.id)}>{s.descricao} — {s.item_lc116 || 's/ código'}</option>)}
          </select>
        </div>
```

- [ ] **Step 5: Incluir `servico_id` no save** — no objeto `body` da função `save`, adicionar:
```ts
        servico_id: servicoId ? Number(servicoId) : null,
```
E garanta que o backend grava `servico_id` em `createNfseHandler`/`updateNfseHandler` — **adicione `servico_id` ao INSERT/UPDATE de `fin_nfse`** nesses handlers (coluna criada na migration 053). (Edite `nfse.controller.ts`: inclua `servico_id` nas colunas e `b.servico_id ?? null` nos params.)

- [ ] **Step 6: Build** — `cd .. && npx vite build` → `✓ built`.

- [ ] **Step 7: Commit**
```bash
git add src/modules/financeiro/pages/NfseComissoesPage.tsx backend/src/modules/nfse/nfse.controller.ts
git commit -m "feat(nfse): nº pré-preenchido da sequência + seletor de serviço no lançamento"
```

---

## Task 5: Frontend — ServicosModal + EmailModal + botão e-mail

**Files:**
- Modify: `src/modules/financeiro/pages/NfseComissoesPage.tsx`

- [ ] **Step 1: Botão "Serviços"** — no cabeçalho (ao lado do botão "Alíquotas"), adicionar:
```tsx
          <button style={btnGhost} onClick={() => setServicosModal(true)}><Layers size={15} /> Serviços</button>
```
E o estado `const [servicosModal, setServicosModal] = useState(false)`. Importe `Layers` de lucide-react.

- [ ] **Step 2: `ServicosModal`** (gestão simples — padrão do AliquotasModal/Overlay): lista os serviços com campos editáveis (descrição, item_lc116, ctribnac, cnbs, iss_pct, ativo), botão "+ Novo", salvar via `POST/PUT /nfse/servicos`, excluir via `DELETE`. Ao fechar, recarrega `servicos`. Use `Overlay`, `inputStyle`, `btnPrimary`. (Modelo: `AliquotasModal` já existente no arquivo.)
```tsx
function ServicosModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [lista, setLista] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/nfse/servicos').then(r => setLista(r.data.data || []))
  useEffect(() => { load() }, [])
  const setField = (i: number, k: string, v: any) => setLista(l => l.map((s, idx) => idx === i ? { ...s, [k]: v } : s))
  const novo = () => setLista(l => [...l, { descricao: '', item_lc116: '', ctribnac: '', cnbs: '', iss_pct: 0, ativo: true, _novo: true }])
  const salvar = async (s: any) => {
    setBusy(true)
    try { if (s.id) await api.put(`/nfse/servicos/${s.id}`, s); else await api.post('/nfse/servicos', s); await load() }
    finally { setBusy(false) }
  }
  const excluir = async (s: any) => { if (s.id && confirm('Excluir serviço?')) { await api.delete(`/nfse/servicos/${s.id}`); await load() } }
  return (
    <Overlay onClose={() => { onSaved(); onClose() }} width={680}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: G.text }}>Serviços da NFS-e</h2>
        <button onClick={() => { onSaved(); onClose() }} style={iconBtn}><X size={18} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
        {lista.map((s, i) => (
          <div key={s.id || `n${i}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 1fr 0.6fr auto', gap: 6, alignItems: 'center', borderBottom: `1px solid ${G.border}`, paddingBottom: 6 }}>
            <input value={s.descricao || ''} onChange={e => setField(i, 'descricao', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="Descrição" />
            <input value={s.item_lc116 || ''} onChange={e => setField(i, 'item_lc116', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="LC116" />
            <input value={s.ctribnac || ''} onChange={e => setField(i, 'ctribnac', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="cTribNac" />
            <input value={s.cnbs || ''} onChange={e => setField(i, 'cnbs', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="cNBS" />
            <input value={String(s.iss_pct ?? 0)} onChange={e => setField(i, 'iss_pct', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="ISS%" />
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => salvar(s)} disabled={busy} style={{ ...iconBtn, color: G.green }}><Save size={14} /></button>
              <button onClick={() => excluir(s)} style={{ ...iconBtn, color: G.red }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={novo} style={{ ...btnGhost, marginTop: 10 }}><Plus size={14} /> Novo serviço</button>
    </Overlay>
  )
}
```
(Importe `Save`, `Layers` de lucide-react; `Plus`/`Trash2`/`X` já importados.)

- [ ] **Step 3: Montar o ServicosModal** — junto dos outros modais:
```tsx
      {servicosModal && <ServicosModal onClose={() => setServicosModal(false)} onSaved={() => api.get('/nfse/servicos').then(r => setServicos((r.data.data || []).filter((s: any) => s.ativo)))} />}
```

- [ ] **Step 4: Botão e-mail na linha EMITIDA** — na célula de ações, dentro do bloco `n.status === 'EMITIDA'`, adicionar (após o botão Cancelar):
```tsx
                      <button title="Enviar por e-mail" onClick={() => setEmail(n)} style={{ ...iconBtn, color: G.navy }}><Mail size={14} /></button>
```
Estado `const [email, setEmail] = useState<Nfse | null>(null)`; importe `Mail` de lucide-react.

- [ ] **Step 5: `EmailModal`** — pré-preenche com o e-mail do tomador (busca via `/nfse/${id}/previa`? não — o e-mail do tomador não vem na prévia). Para pré-preencher, busque o e-mail da representada. Simples: o EmailModal recebe a `Nfse`; tenta achar o e-mail nas reps carregadas não é trivial (reps só têm nome). **Solução:** o backend já tem `tomador_email` no `carregarParaEmissao`; exponha-o na prévia. Adicione no `previaNfseHandler` (Task 2/3) `tomador.email: lanc.tomador_email`. No EmailModal, busque a prévia para pegar o e-mail:
```tsx
function EmailModal({ nfse, onClose, onDone }: { nfse: Nfse; onClose: () => void; onDone: () => void }) {
  const [para, setPara] = useState('')
  const [assunto, setAssunto] = useState(`NFS-e nº ${nfse.numero ?? ''}`)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { api.get(`/nfse/${nfse.id}/previa`).then(r => setPara(r.data?.data?.tomador?.email || '')).catch(() => {}) }, [nfse.id])
  const enviar = async () => {
    setBusy(true); setErro(null)
    try { const r = await api.post(`/nfse/${nfse.id}/email`, { para, assunto }); if (r.data.success) onDone(); else setErro(r.data.message || 'Falha ao enviar.') }
    catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao enviar.') } finally { setBusy(false) }
  }
  return (
    <Overlay onClose={onClose} width={480}>
      <div style={{ fontSize: 16, fontWeight: 800, color: G.navy, marginBottom: 12 }}>Enviar NFS-e por e-mail</div>
      <label style={lbl}>Para
        <input value={para} onChange={e => setPara(e.target.value)} style={inputStyle} placeholder="email@cliente.com" />
      </label>
      <label style={lbl}>Assunto
        <input value={assunto} onChange={e => setAssunto(e.target.value)} style={inputStyle} />
      </label>
      <div style={{ fontSize: 11, color: G.muted, margin: '8px 0' }}>Anexos: DANFSE (PDF) + XML.</div>
      {erro && <div style={{ padding: 10, borderRadius: 8, background: '#FDECEA', color: '#C62828', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={enviar} disabled={busy || !para} style={btnPrimary(G.green)}>{busy ? 'Enviando…' : 'Enviar'}</button>
      </div>
    </Overlay>
  )
}
```
E adicione no `previaNfseHandler` o campo `email`: no objeto `tomador`, `email: lanc.tomador_email`.

- [ ] **Step 6: Montar o EmailModal**:
```tsx
      {email && <EmailModal nfse={email} onClose={() => setEmail(null)} onDone={() => { setEmail(null); alert('E-mail enviado!') }} />}
```

- [ ] **Step 7: Build + typecheck do backend** (a prévia ganhou o campo email):
```
cd backend && npx tsc --noEmit && cd .. && npx vite build
```
Ambos sem erro.

- [ ] **Step 8: Commit**
```bash
git add src/modules/financeiro/pages/NfseComissoesPage.tsx backend/src/modules/nfse/nfse.controller.ts
git commit -m "feat(nfse): modal de serviços + envio por e-mail (PDF+XML) na linha emitida"
```

---

## Task 6: Frontend — item no sidebar (Gerência+)

**Files:**
- Modify: `src/shared/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Adicionar o item** — no array de itens (no grupo Financeiro/Cadastros, seguindo o padrão `{ label, path, icon, minLevel }`), adicionar:
```ts
      { label: 'NFS-e',                 path: '/financeiro/nfse-comissoes',    icon: FileText,    minLevel: 2 },
```
Coloque-o num grupo coerente (ex.: junto de Financeiro). Confirme que `/financeiro/nfse-comissoes` já é uma rota registrada (é — o card do Hub aponta pra ela). Reuse um ícone já importado (`FileText`).

- [ ] **Step 2: Build** — `cd .. && npx vite build` → `✓ built`.

- [ ] **Step 3: Commit**
```bash
git add src/shared/components/layout/AppSidebar.tsx
git commit -m "feat(nfse): atalho 'NFS-e' no sidebar (Gerência+)"
```

---

## Notas finais
- **Deploy:** backend `dist/src/modules/nfse/*` + `pm2 restart`; frontend `dist/`. Migration 053 já roda direto no banco.
- **Pesquisa pendente (dados):** completar cNBS de 10.05/10.08 via o ServicosModal quando levantar.
- **Dependência:** envio real de e-mail precisa do SMTP configurado (mesmo do envio de pedido); emissão real precisa do certificado A1 (etapa do form de Config).
