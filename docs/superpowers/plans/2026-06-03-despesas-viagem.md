# Despesas de Viagem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de despesas de viagem — o vendedor/promotor lança despesas (com foto do comprovante) pelo celular; o gestor acompanha e exporta pelo web. Sem fluxo de aprovação.

**Architecture:** Tabela `despesas` por tenant. Backend `despesas` (Express + multer diskStorage por schema, auto-escopo por `getLinkedSellerId`). Mobile: card no home + página de lista/lançamento com upload de foto (redimensionada no cliente). Web: tela de controle do gestor (filtros, totais, comprovante, export).

**Tech Stack:** Express + PostgreSQL (multi-tenant), multer, React, TypeScript. Sem runner de testes — verificação por `tsc --noEmit`, `vite build` e piloto manual.

---

## Estrutura de arquivos

- **Create:** `backend/migrations/059_create_despesas.sql` — tabela em todos os schemas (pgAdmin).
- **Create:** `backend/src/modules/despesas/despesas.controller.ts` — handlers + multer.
- **Create:** `backend/src/modules/despesas/despesas.routes.ts` — rotas.
- **Modify:** `backend/src/app.ts` — registrar `/api/despesas`.
- **Create:** `src/mobile/lib/imagem.ts` — redimensionar foto no cliente.
- **Create:** `src/mobile/pages/DespesasPage.tsx` — lista + lançamento mobile.
- **Modify:** `src/mobile/MobileApp.tsx` — rota `/mobile/despesas`.
- **Modify:** `src/mobile/pages/HomePage.tsx` — card "Despesas".
- **Create:** `src/modules/despesas/pages/DespesasPage.tsx` — controle do gestor (web).
- **Modify:** `src/shared/lib/routeConfig.tsx` — rota web.
- **Modify:** `src/shared/components/layout/AppSidebar.tsx` — item de menu.
- **Create:** `src/shared/lib/despesasCategorias.ts` — lista de categorias compartilhada (mobile+web).

---

## Task 1: Migração — tabela `despesas` (pgAdmin)

**Files:**
- Create: `backend/migrations/059_create_despesas.sql`

- [ ] **Step 1: Escrever o SQL (DO $$ loop em todos os schemas)**

```sql
-- Migration 059: Despesas de viagem lançadas em campo pelo vendedor/promotor.
-- Sem fluxo de aprovação (decisão Hamilton 2026-06-03): lançamento + relatório.
-- desp_vendedor = vendedores.ven_codigo (mesma convenção de ped_vendedor; sem FK rígida).
-- desp_comprovante = nome do arquivo da foto em uploads/despesas/<schema>/ (nulo = sem foto).
-- Seguro rodar múltiplas vezes (IF NOT EXISTS).
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast','public')
       AND schema_name NOT LIKE 'pg_temp_%'
       AND schema_name NOT LIKE 'pg_toast_temp_%'
     ORDER BY schema_name
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.despesas (
        desp_id          SERIAL PRIMARY KEY,
        desp_vendedor    INTEGER NOT NULL,
        desp_data        DATE NOT NULL,
        desp_categoria   VARCHAR(30) NOT NULL,
        desp_valor       NUMERIC(12,2) NOT NULL,
        desp_descricao   TEXT,
        desp_km          INTEGER,
        desp_comprovante VARCHAR(255),
        desp_criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_despesas_vendedor ON %I.despesas (desp_vendedor)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_despesas_data ON %I.despesas (desp_data)', s);
    RAISE NOTICE 'Schema % — tabela despesas garantida.', s;
  END LOOP;
END;
$$;
```

- [ ] **Step 2: Commit (o SQL é rodado por Hamilton no pgAdmin — não executar aqui)**

```bash
git add backend/migrations/059_create_despesas.sql
git commit -m "feat(despesas): migration 059 — tabela despesas em todos os schemas (pgAdmin)"
```

> NOTA: a tabela precisa existir no banco para os testes ao vivo do backend. A verificação das
> tasks seguintes é por `tsc`/`build`; o teste funcional acontece após Hamilton rodar o SQL.

---

## Task 2: Backend — categorias compartilhadas

**Files:**
- Create: `src/shared/lib/despesasCategorias.ts`

Lista única de categorias usada no mobile e no web (DRY).

- [ ] **Step 1: Criar o arquivo**

```ts
// src/shared/lib/despesasCategorias.ts
// Categorias de despesa de viagem — fonte única para mobile e web.
export const DESPESA_CATEGORIAS = [
  'Combustível',
  'Alimentação',
  'Manutenção',
  'Pedágio',
  'Hospedagem',
  'Outros',
] as const;

export type DespesaCategoria = typeof DESPESA_CATEGORIAS[number];
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/lib/despesasCategorias.ts
git commit -m "feat(despesas): categorias compartilhadas mobile+web"
```

---

## Task 3: Backend — módulo `despesas` (controller + routes + registro)

**Files:**
- Create: `backend/src/modules/despesas/despesas.controller.ts`
- Create: `backend/src/modules/despesas/despesas.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Criar o controller**

```ts
// backend/src/modules/despesas/despesas.controller.ts
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { getLinkedSellerId } from '../../shared/permissions';

// ─── Upload do comprovante (disco, por schema) ───────────────────────────────
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
});
export const uploadComprovante = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// ─── GET /api/despesas ───────────────────────────────────────────────────────
export async function listDespesasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { vendedor, categoria, de, ate } = req.query;
    const params: any[] = [];
    let q = `
      SELECT d.desp_id, d.desp_vendedor, d.desp_data, d.desp_categoria, d.desp_valor,
             d.desp_descricao, d.desp_km, d.desp_comprovante, d.desp_criado_em,
             v.ven_nome AS vendedor_nome
      FROM despesas d
      LEFT JOIN vendedores v ON v.ven_codigo = d.desp_vendedor
      WHERE 1=1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); q += ` AND d.desp_vendedor = $${params.length}`; }
    else if (vendedor)    { params.push(vendedor); q += ` AND d.desp_vendedor = $${params.length}`; }
    if (categoria) { params.push(categoria); q += ` AND d.desp_categoria = $${params.length}`; }
    if (de)        { params.push(de);        q += ` AND d.desp_data >= $${params.length}`; }
    if (ate)       { params.push(ate);       q += ` AND d.desp_data <= $${params.length}`; }
    q += ` ORDER BY d.desp_data DESC, d.desp_id DESC`;
    const result = await db.query(q, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [DESPESAS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/despesas (multipart: comprovante opcional) ─────────────────────
export async function createDespesaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { desp_data, desp_categoria, desp_valor, desp_descricao, desp_km, desp_vendedor } = req.body;
    if (!desp_data || !desp_categoria || !desp_valor) {
      res.status(400).json({ success: false, message: 'Data, categoria e valor são obrigatórios.' });
      return;
    }
    // Vendedor: operador grava na própria carteira; gestor/master pode informar desp_vendedor.
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    const venId = sellerId !== null ? sellerId : (desp_vendedor ? parseInt(String(desp_vendedor)) : null);
    if (venId === null) {
      res.status(400).json({ success: false, message: 'Vendedor não identificado para a despesa.' });
      return;
    }
    const comprovante = req.file ? req.file.filename : null;
    const result = await db.query(
      `INSERT INTO despesas
         (desp_vendedor, desp_data, desp_categoria, desp_valor, desp_descricao, desp_km, desp_comprovante)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING desp_id`,
      [venId, desp_data, desp_categoria, parseFloat(String(desp_valor).replace(',', '.')),
       desp_descricao || null, desp_km ? parseInt(String(desp_km)) : null, comprovante]
    );
    res.json({ success: true, message: 'Despesa lançada.', id: result.rows[0].desp_id });
  } catch (error: any) {
    console.error('❌ [DESPESAS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/despesas/:id ────────────────────────────────────────────────
export async function deleteDespesaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    // Operador só apaga as próprias.
    const params: any[] = [id];
    let q = `DELETE FROM despesas WHERE desp_id = $1`;
    if (sellerId !== null) { params.push(sellerId); q += ` AND desp_vendedor = $${params.length}`; }
    q += ` RETURNING desp_comprovante`;
    const result = await db.query(q, params);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Despesa não encontrada.' }); return; }
    // Remove o arquivo do comprovante (best-effort).
    const arq = result.rows[0].desp_comprovante;
    if (arq) {
      const fp = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public', arq);
      fs.promises.unlink(fp).catch(() => {});
    }
    res.json({ success: true, message: 'Despesa removida.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/despesas/relatorio ─────────────────────────────────────────────
export async function relatorioDespesasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { vendedor, de, ate } = req.query;
    const params: any[] = [];
    let where = ` WHERE 1=1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); where += ` AND desp_vendedor = $${params.length}`; }
    else if (vendedor)    { params.push(vendedor); where += ` AND desp_vendedor = $${params.length}`; }
    if (de)  { params.push(de);  where += ` AND desp_data >= $${params.length}`; }
    if (ate) { params.push(ate); where += ` AND desp_data <= $${params.length}`; }
    const porCat = await db.query(
      `SELECT desp_categoria, COUNT(*) AS qtd, COALESCE(SUM(desp_valor),0) AS total
       FROM despesas ${where} GROUP BY desp_categoria ORDER BY total DESC`, params);
    const totalRow = await db.query(
      `SELECT COALESCE(SUM(desp_valor),0) AS total, COUNT(*) AS qtd FROM despesas ${where}`, params);
    res.json({ success: true, data: { por_categoria: porCat.rows, total: totalRow.rows[0] } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/despesas/comprovante/:arquivo (servido autenticado) ─────────────
export async function comprovanteHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const arquivo = path.basename(String(req.params.arquivo)); // evita path traversal
    // O arquivo precisa pertencer a uma despesa do tenant (e, p/ operador, a uma despesa dele).
    const params: any[] = [arquivo];
    let q = `SELECT 1 FROM despesas WHERE desp_comprovante = $1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); q += ` AND desp_vendedor = $${params.length}`; }
    q += ` LIMIT 1`;
    const ok = await db.query(q, params);
    if (!ok.rows.length) { res.status(404).json({ success: false, message: 'Comprovante não encontrado.' }); return; }
    const fp = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public', arquivo);
    if (!fs.existsSync(fp)) { res.status(404).json({ success: false, message: 'Arquivo ausente.' }); return; }
    res.sendFile(fp);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
```

- [ ] **Step 2: Criar as rotas**

```ts
// backend/src/modules/despesas/despesas.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  uploadComprovante,
  listDespesasHandler, createDespesaHandler, deleteDespesaHandler,
  relatorioDespesasHandler, comprovanteHandler,
} from './despesas.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// rotas específicas antes de /:id
router.get('/relatorio',           relatorioDespesasHandler);
router.get('/comprovante/:arquivo', comprovanteHandler);

router.get('/',        listDespesasHandler);
router.post('/',       uploadComprovante.single('comprovante'), createDespesaHandler);
router.delete('/:id',  deleteDespesaHandler);

export default router;
```

- [ ] **Step 3: Registrar no app.ts**

Em `backend/src/app.ts`, junto dos outros imports de rotas (ex.: após a linha de `aftermarketRoutes`):

```ts
import despesasRoutes        from './modules/despesas/despesas.routes';
```

E junto dos `app.use('/api/...')` (ex.: após a linha de `/api/aftermarket`):

```ts
app.use('/api/despesas',       despesasRoutes);
```

- [ ] **Step 4: Typecheck**

Run: `cd backend; npx tsc --noEmit`
Expected: sem erros referenciando os arquivos de `despesas` nem `app.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/despesas/despesas.controller.ts backend/src/modules/despesas/despesas.routes.ts backend/src/app.ts
git commit -m "feat(despesas): modulo backend (CRUD + relatorio + comprovante autenticado)"
```

---

## Task 4: Mobile — helper de redimensionamento de imagem

**Files:**
- Create: `src/mobile/lib/imagem.ts`

- [ ] **Step 1: Criar o helper**

```ts
// src/mobile/lib/imagem.ts
// Redimensiona uma imagem (foto do comprovante) no cliente antes de subir,
// para não pesar no 4G. Retorna um Blob JPEG (~maxLado px, qualidade 0.7).
export async function resizeImage(file: File, maxLado = 1280, quality = 0.7): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxLado || height > maxLado) {
    if (width >= height) { height = Math.round(height * (maxLado / width)); width = maxLado; }
    else { width = Math.round(width * (maxLado / height)); height = maxLado; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao processar imagem'))), 'image/jpeg', quality));
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `npx tsc --noEmit`
Expected: sem erros em `imagem.ts`.

```bash
git add src/mobile/lib/imagem.ts
git commit -m "feat(despesas): helper de resize de imagem no mobile"
```

---

## Task 5: Mobile — DespesasPage (lista + lançamento)

**Files:**
- Create: `src/mobile/pages/DespesasPage.tsx`

- [ ] **Step 1: Criar a página**

```tsx
// src/mobile/pages/DespesasPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Loader2, Camera, Trash2, Receipt } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { DESPESA_CATEGORIAS } from '@/shared/lib/despesasCategorias';
import { resizeImage } from '../lib/imagem';
import { MobileHeader } from '../components/MobileHeader';

interface Despesa {
  desp_id: number;
  desp_data: string;
  desp_categoria: string;
  desp_valor: number | string;
  desp_descricao?: string;
  desp_km?: number | null;
  desp_comprovante?: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const fmtBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const inputSt: React.CSSProperties = {
  borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
  background: '#fff', color: 'var(--navy)', padding: '11px 12px',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const lblSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, display: 'block',
};

export default function DespesasPage() {
  const [rows, setRows] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [data, setData] = useState(hoje());
  const [categoria, setCategoria] = useState<string>(DESPESA_CATEGORIAS[0]);
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [km, setKm] = useState('');
  const [foto, setFoto] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/despesas');
      setRows(r.data?.data || []);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalMes = rows
    .filter(d => String(d.desp_data).slice(0, 7) === hoje().slice(0, 7))
    .reduce((s, d) => s + Number(d.desp_valor), 0);

  function resetForm() {
    setData(hoje()); setCategoria(DESPESA_CATEGORIAS[0]); setValor('');
    setDescricao(''); setKm(''); setFoto(null); setErr('');
  }

  async function salvar() {
    setErr('');
    if (!valor || Number(String(valor).replace(',', '.')) <= 0) { setErr('Informe o valor.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('desp_data', data);
      fd.append('desp_categoria', categoria);
      fd.append('desp_valor', String(valor).replace(',', '.'));
      if (descricao.trim()) fd.append('desp_descricao', descricao.trim());
      if (km.trim()) fd.append('desp_km', km.trim());
      if (foto) {
        const blob = await resizeImage(foto);
        fd.append('comprovante', blob, 'comprovante.jpg');
      }
      const res = await fetch('/api/despesas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
        body: fd,
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setModal(false); resetForm(); await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar.');
    } finally { setSaving(false); }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir esta despesa?')) return;
    try { await api.delete(`/despesas/${id}`); await load(); } catch { /* */ }
  }

  return (
    <>
      <MobileHeader
        title="Despesas"
        helpItems={[{ icon: '🧾', title: 'O que é', text: 'Lance aqui suas despesas de viagem (combustível, alimentação, manutenção…) com foto do comprovante. O gestor acompanha pelo sistema.' }]}
      />

      {/* Total do mês */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ background: 'var(--navy)', borderRadius: 14, padding: '14px 16px', color: '#fff' }}>
          <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total no mês</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{fmtBRL(totalMes)}</div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Loader2 size={24} style={{ color: 'var(--navy)', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--navy-muted)' }}>
            <Receipt size={34} style={{ opacity: 0.4, marginBottom: 10 }} />
            <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Nenhuma despesa lançada</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Toque em "+ Nova" para começar.</p>
          </div>
        ) : rows.map(d => (
          <div key={d.desp_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>{d.desp_categoria}</div>
              <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2 }}>
                {new Date(d.desp_data + 'T00:00:00').toLocaleDateString('pt-BR')}
                {d.desp_descricao ? ` · ${d.desp_descricao}` : ''}
              </div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--navy)' }}>{fmtBRL(d.desp_valor)}</div>
            <button onClick={() => excluir(d.desp_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, display: 'flex' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* FAB nova */}
      <button
        onClick={() => { resetForm(); setModal(true); }}
        style={{ position: 'fixed', right: 18, bottom: 80, width: 54, height: 54, borderRadius: '50%', background: 'var(--mustard)', border: 'none', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', cursor: 'pointer', zIndex: 90 }}
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      {/* Modal de lançamento */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sand-bg)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>Nova despesa</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-muted)', display: 'flex' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lblSt}>Categoria</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputSt}>
                  {DESPESA_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={lblSt}>Valor (R$)</label>
                  <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" style={inputSt} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lblSt}>Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputSt} />
                </div>
              </div>
              {categoria === 'Combustível' && (
                <div>
                  <label style={lblSt}>KM / Odômetro (opcional)</label>
                  <input value={km} onChange={e => setKm(e.target.value)} inputMode="numeric" placeholder="ex.: 84520" style={inputSt} />
                </div>
              )}
              <div>
                <label style={lblSt}>Descrição (opcional)</label>
                <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="ex.: posto BR rodovia" style={inputSt} />
              </div>
              <div>
                <label style={lblSt}>Comprovante</label>
                <label style={{ ...inputSt, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: foto ? 'var(--navy)' : 'var(--navy-muted)' }}>
                  <Camera size={18} />
                  {foto ? foto.name : 'Tirar foto / escolher imagem'}
                  <input type="file" accept="image/*" capture="environment" onChange={e => setFoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </label>
              </div>

              {err && <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>{err}</div>}

              <button onClick={salvar} disabled={saving} style={{ width: '100%', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Salvar despesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros referenciando `DespesasPage.tsx`. (Se `HelpItem` divergir, ajustar `helpItems` conforme a interface em `src/mobile/components/HelpSheet.tsx` — esperado `{ icon, title, text }`.)

- [ ] **Step 3: Commit**

```bash
git add src/mobile/pages/DespesasPage.tsx
git commit -m "feat(despesas): mobile — lista + lancamento com foto"
```

---

## Task 6: Mobile — card no home + rota

**Files:**
- Modify: `src/mobile/MobileApp.tsx`
- Modify: `src/mobile/pages/HomePage.tsx`

- [ ] **Step 1: Registrar a rota**

Em `src/mobile/MobileApp.tsx`, após o lazy import de `RotaMapaPage`:

```tsx
const DespesasPage     = lazy(() => import('./pages/DespesasPage'));
```

E após a rota `<Route path="rotas/:id" ... />`:

```tsx
          <Route path="despesas"     element={<DespesasPage />} />
```

- [ ] **Step 2: Adicionar o card no home**

Em `src/mobile/pages/HomePage.tsx`, no array `ACTIONS`, antes da entrada `Aftermarket`, inserir:

```tsx
  { icon: Receipt,      label: 'Despesas',    bg: '#0d9488', path: '/mobile/despesas' },
```

E garantir `Receipt` no import do `lucide-react` em HomePage.tsx (adicionar à lista de ícones, se ainda não estiver).

> O card "Despesas" NÃO está na lista de ocultação do promotor (`HIDE_PROMOTOR_PATHS`),
> então aparece para todos — inclusive promotores. Correto: todos lançam despesas.

- [ ] **Step 3: Typecheck + Commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add src/mobile/MobileApp.tsx src/mobile/pages/HomePage.tsx
git commit -m "feat(despesas): card no home + rota no mobile"
```

---

## Task 7: Web — DespesasPage (controle do gestor)

**Files:**
- Create: `src/modules/despesas/pages/DespesasPage.tsx`

- [ ] **Step 1: Criar a página de controle**

```tsx
// src/modules/despesas/pages/DespesasPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Receipt, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { DESPESA_CATEGORIAS } from '@/shared/lib/despesasCategorias';
import { CadastroShell, G } from '@/shared/components/layout/CadastroShell';

interface Despesa {
  desp_id: number;
  desp_vendedor: number;
  vendedor_nome?: string;
  desp_data: string;
  desp_categoria: string;
  desp_valor: number | string;
  desp_descricao?: string;
  desp_comprovante?: string | null;
}

const fmtBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DespesasPage() {
  const [rows, setRows] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params: any = {};
      if (categoria) params.categoria = categoria;
      if (de) params.de = de;
      if (ate) params.ate = ate;
      const r = await api.get('/despesas', { params });
      setRows(r.data?.data || []);
    } catch { /* */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [categoria, de, ate]);

  const total = useMemo(() => rows.reduce((s, d) => s + Number(d.desp_valor), 0), [rows]);
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(d => m.set(d.desp_categoria, (m.get(d.desp_categoria) || 0) + Number(d.desp_valor)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  function exportCSV() {
    const head = ['Data', 'Vendedor', 'Categoria', 'Valor', 'Descrição'];
    const lines = rows.map(d => [
      new Date(d.desp_data + 'T00:00:00').toLocaleDateString('pt-BR'),
      d.vendedor_nome || d.desp_vendedor,
      d.desp_categoria,
      String(Number(d.desp_valor).toFixed(2)).replace('.', ','),
      (d.desp_descricao || '').replace(/;/g, ','),
    ].join(';'));
    const csv = [head.join(';'), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'despesas.csv';
    a.click();
  }

  function abrirComprovante(arq: string) {
    // Servido autenticado — abre via fetch com Bearer e mostra numa nova aba.
    fetch(`/api/despesas/comprovante/${arq}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
    })
      .then(r => r.blob())
      .then(b => window.open(URL.createObjectURL(b), '_blank'));
  }

  const selSt: React.CSSProperties = {
    border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 13, color: G.text, background: '#fff', outline: 'none',
  };

  return (
    <CadastroShell title="Despesas de Viagem" icon={<Receipt size={20} />}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} style={selSt}>
          <option value="">Todas as categorias</option>
          {DESPESA_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={de} onChange={e => setDe(e.target.value)} style={selSt} />
        <span style={{ color: G.textMuted }}>até</span>
        <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={selSt} />
        <button onClick={exportCSV} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: G.text, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {/* Totais */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ background: G.text, color: '#fff', borderRadius: 12, padding: '12px 18px' }}>
          <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase' }}>Total no período</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{fmtBRL(total)}</div>
        </div>
        {porCategoria.map(([cat, val]) => (
          <div key={cat} style={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: G.textMuted, textTransform: 'uppercase' }}>{cat}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: G.text }}>{fmtBRL(val)}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={26} style={{ color: G.text, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: G.bg, color: G.textSec, textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Data</th>
                <th style={{ padding: '10px 12px' }}>Vendedor</th>
                <th style={{ padding: '10px 12px' }}>Categoria</th>
                <th style={{ padding: '10px 12px' }}>Descrição</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Comprov.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: G.textMuted }}>Nenhuma despesa no período.</td></tr>
              ) : rows.map(d => (
                <tr key={d.desp_id} style={{ borderTop: `1px solid ${G.border}` }}>
                  <td style={{ padding: '10px 12px' }}>{new Date(d.desp_data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '10px 12px' }}>{d.vendedor_nome || d.desp_vendedor}</td>
                  <td style={{ padding: '10px 12px' }}>{d.desp_categoria}</td>
                  <td style={{ padding: '10px 12px', color: G.textSec }}>{d.desp_descricao || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: G.text }}>{fmtBRL(d.desp_valor)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {d.desp_comprovante
                      ? <button onClick={() => abrirComprovante(d.desp_comprovante!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mustard }}><ImageIcon size={17} /></button>
                      : <span style={{ color: G.textMuted }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CadastroShell>
  );
}
```

> Confirmar na implementação as props reais de `CadastroShell` e os tokens de `G`
> (text, textSec, textMuted, mustard, bg, border). Ajustar se a assinatura divergir
> (ex.: `CadastroShell` pode não aceitar `icon` — nesse caso usar só `title`).

- [ ] **Step 2: Typecheck + Commit**

Run: `npx tsc --noEmit`
Expected: sem erros referenciando o novo arquivo.

```bash
git add src/modules/despesas/pages/DespesasPage.tsx
git commit -m "feat(despesas): web — tela de controle do gestor (filtros, totais, comprovante, export)"
```

---

## Task 8: Web — rota e menu

**Files:**
- Modify: `src/shared/lib/routeConfig.tsx`
- Modify: `src/shared/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Lazy import + entrada no ROUTE_CONFIG**

Em `src/shared/lib/routeConfig.tsx`, junto dos outros `const X = lazy(...)`:

```tsx
const DespesasPage = lazy(() => import('@/modules/despesas/pages/DespesasPage'))
```

E dentro de `ROUTE_CONFIG`, adicionar a entrada (usar o ícone `Wallet` já importado no topo):

```tsx
  '/despesas': { id: 'despesas', label: 'Despesas de Viagem', path: '/despesas', icon: Wallet, element: <DespesasPage /> },
```

- [ ] **Step 2: Item no menu (Movimentações, só gestor)**

Em `src/shared/components/layout/AppSidebar.tsx`, no grupo `movimentacoes` (`items: [ ... ]`), adicionar:

```tsx
      { label: 'Despesas de Viagem', path: '/despesas', icon: Wallet, minLevel: 2 },
```

> `minLevel: 2` = gestor/master (padrão dos itens de controle). Garantir que `Wallet`
> esteja importado no AppSidebar (já é usado em outros itens; se não, adicionar ao import do lucide).

- [ ] **Step 3: Typecheck + Commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add src/shared/lib/routeConfig.tsx src/shared/components/layout/AppSidebar.tsx
git commit -m "feat(despesas): rota web + item de menu (gestor)"
```

---

## Task 9: Build e verificação

**Files:** nenhum.

- [ ] **Step 1: Build do frontend**

Run: `npx vite build`
Expected: build conclui sem erros.

- [ ] **Step 2: Compilar o backend (para deploy)**

Run: `cd backend; npx tsc`
Expected: emite `dist/src/modules/despesas/*.js` e `dist/src/app.js`.

- [ ] **Step 3: Verificação manual (piloto) — após Hamilton rodar a migration 059 no pgAdmin**

- Mobile (qualquer rep): card "Despesas" no home → lança despesa com foto → aparece na lista, total do mês soma.
- Rep só vê as próprias; comprovante de outro rep não abre (403/404).
- Web (gestor): filtra por categoria/período, vê totais por categoria, abre o comprovante, exporta CSV.
- Promotor: também tem o card "Despesas" (todos lançam).

- [ ] **Step 4: Commit (se houver ajuste pós-piloto)**

```bash
git add -A
git commit -m "fix(despesas): ajustes pos-piloto"
```

---

## Notas de execução

- **Migration:** roda no **pgAdmin** (Hamilton), não por Node. Backend só funciona ao vivo após isso.
- **uploads/** fica **fora do dist/** — preservar no servidor entre deploys (não sobrescrever).
- **Deploy:** frontend = `dist/` inteiro; backend = `dist/src/modules/despesas/*.js` + `dist/src/app.js`.
- **Sem testes unitários:** verificação por `tsc` + `vite build` + piloto.
- **Notícia para REPs:** ao entregar, post na Central de Notícias ("Agora você lança suas despesas de
  viagem pelo app, com foto do comprovante").
```
