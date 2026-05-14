# CRM Campo Digital — Phase 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar o resultado de cada visita de campo (positivou/não positivou) e exibir um painel ao vivo para o diretor com todos os promotores e visitas do dia.

**Architecture:** Nova tabela `visitas_campo` (design simples, sem UUID, por tenant via search_path) recebe INSERT no check-in e UPDATE no checkout com resultado. Backend adiciona endpoint `GET /crm/campo/ao-vivo`. Mobile adiciona `CheckoutResultadoModal` que intercepta o checkout. Web adiciona `CampoAoVivoPage` com polling de 30s.

**Tech Stack:** PostgreSQL (search_path multi-tenant), Node.js/TypeScript backend, React + Lucide + react-leaflet frontend, Tailwind-style inline styles.

**Spec:** `docs/superpowers/specs/2026-05-14-crm-campo-design.md` (Phase 1)

---

## File Map

| Ação | Arquivo |
|------|---------|
| CREATE | `backend/migrations/042_crm_visitas_campo.sql` |
| MODIFY | `backend/src/modules/crm/crm.controller.ts` |
| MODIFY | `backend/src/modules/crm/crm.routes.ts` |
| CREATE | `src/mobile/components/CheckoutResultadoModal.tsx` |
| MODIFY | `src/mobile/pages/ClientesPage.tsx` |
| CREATE | `src/modules/crm/pages/CampoAoVivoPage.tsx` |
| MODIFY | `src/shared/lib/routeConfig.tsx` |
| MODIFY | `src/shared/components/layout/AppSidebar.tsx` |

---

## Task 1: Migration SQL — visitas_campo + iris_insights

**Files:**
- Create: `backend/migrations/042_crm_visitas_campo.sql`

- [ ] **Step 1.1: Criar o arquivo de migration**

```sql
-- Migration 042: CRM Visitas Campo + IRIS Insights
-- Execute no pgAdmin para cada schema de tenant

-- ── visitas_campo ─────────────────────────────────────────────────────────────
-- Tabela de check-in/checkout de campo com captura de resultado de positivação.
-- Substitui registro_visitas para o fluxo novo; registro_visitas mantido para compat.
CREATE TABLE IF NOT EXISTS visitas_campo (
  id                   SERIAL PRIMARY KEY,
  cli_codigo           INTEGER NOT NULL REFERENCES clientes(cli_codigo)   ON DELETE CASCADE,
  ven_codigo           INTEGER NOT NULL REFERENCES vendedores(ven_codigo) ON DELETE CASCADE,
  data                 DATE         NOT NULL DEFAULT CURRENT_DATE,
  checkin_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  checkin_lat          NUMERIC(10,7),
  checkin_lng          NUMERIC(10,7),
  checkout_at          TIMESTAMPTZ,
  checkout_lat         NUMERIC(10,7),
  checkout_lng         NUMERIC(10,7),
  resultado            TEXT CHECK (resultado IN ('positivou','nao_positivou','reagendou','ausente','fechado')),
  motivo_nao_positivo  TEXT,
  duracao_minutos      INTEGER,
  notas                TEXT,
  criado_em            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_data         ON visitas_campo(data);
CREATE INDEX IF NOT EXISTS idx_vc_ven_data     ON visitas_campo(ven_codigo, data);
CREATE INDEX IF NOT EXISTS idx_vc_cli_data     ON visitas_campo(cli_codigo, data);
CREATE INDEX IF NOT EXISTS idx_vc_resultado    ON visitas_campo(resultado) WHERE resultado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vc_open         ON visitas_campo(data, ven_codigo) WHERE checkout_at IS NULL;

-- ── iris_insights ─────────────────────────────────────────────────────────────
-- Cache de insights gerados pelo IRIS (Claude API). Portal home consome daqui.
CREATE TABLE IF NOT EXISTS iris_insights (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT         NOT NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  gerado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valido_ate  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_iris_tipo      ON iris_insights(tipo);
CREATE INDEX IF NOT EXISTS idx_iris_gerado_em ON iris_insights(gerado_em DESC);
```

- [ ] **Step 1.2: Rodar no pgAdmin para cada schema de tenant**

Substitua `repsoma` pelo schema do tenant desejado e execute:
```sql
SET search_path TO repsoma;
-- cole o conteúdo acima
```

- [ ] **Step 1.3: Verificar criação**

```sql
SET search_path TO repsoma;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'visitas_campo' ORDER BY ordinal_position;
```

Expected: 15 colunas — id, cli_codigo, ven_codigo, data, checkin_at, checkin_lat, checkin_lng, checkout_at, checkout_lat, checkout_lng, resultado, motivo_nao_positivo, duracao_minutos, notas, criado_em.

---

## Task 2: Backend — checkin escreve em visitas_campo

**Files:**
- Modify: `backend/src/modules/crm/crm.controller.ts` (função `checkinHandler`, ~linha 1083)

O checkin existente já escreve em `registro_visitas`. Vamos adicionar escrita paralela em `visitas_campo` e retornar o `campo_id` para uso no checkout.

- [ ] **Step 2.1: Localizar checkinHandler**

Abra `backend/src/modules/crm/crm.controller.ts`. A função começa em ~linha 1083:
```typescript
export async function checkinHandler(req: Request, res: Response): Promise<void> {
```

- [ ] **Step 2.2: Substituir o corpo de checkinHandler**

Substitua todo o conteúdo da função (do `try {` ao `}` final) pelo seguinte:

```typescript
export async function checkinHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { ven_codigo, cli_codigo, latitude, longitude } = req.body;
  if (!ven_codigo || !cli_codigo) {
    res.status(400).json({ success: false, message: 'ven_codigo e cli_codigo são obrigatórios.' });
    return;
  }
  try {
    // ── Calcular distância Haversine se cliente tem coordenadas ──────────────
    let distancia: number | null = null;
    if (latitude && longitude) {
      const cliRes = await db.query(
        'SELECT cli_latitude, cli_longitude FROM clientes WHERE cli_codigo = $1',
        [parseInt(cli_codigo)]
      );
      const cli = cliRes.rows[0];
      if (cli?.cli_latitude && cli?.cli_longitude) {
        const R = 6371000;
        const dLat = (Number(cli.cli_latitude)  - latitude)  * Math.PI / 180;
        const dLon = (Number(cli.cli_longitude) - longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
          Math.cos(latitude * Math.PI/180) * Math.cos(Number(cli.cli_latitude) * Math.PI/180) *
          Math.sin(dLon/2)**2;
        distancia = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      }
    }

    // ── Escrita legada em registro_visitas (mantém compat com VisitasPage) ──
    const legacyRes = await db.query(`
      INSERT INTO registro_visitas
        (vis_promotor_id, vis_cliente_id, vis_latitude_checkin, vis_longitude_checkin, vis_distancia_metros, vis_tipo)
      VALUES ($1, $2, $3, $4, $5, 'CHECKIN')
      RETURNING vis_codigo, vis_datahora
    `, [parseInt(ven_codigo), parseInt(cli_codigo), latitude ?? 0, longitude ?? 0, distancia]);
    const legacy = legacyRes.rows[0];

    // ── Escrita nova em visitas_campo (com resultado no checkout) ───────────
    const campoRes = await db.query(`
      INSERT INTO visitas_campo
        (cli_codigo, ven_codigo, data, checkin_at, checkin_lat, checkin_lng)
      VALUES ($1, $2, CURRENT_DATE, NOW(), $3, $4)
      RETURNING id
    `, [parseInt(cli_codigo), parseInt(ven_codigo), latitude ?? null, longitude ?? null]);
    const campo_id = campoRes.rows[0].id;

    console.log(`📍 [CHECKIN] ven=${ven_codigo} cli=${cli_codigo} dist=${distancia}m campo_id=${campo_id}`);
    res.json({
      success: true,
      vis_codigo: legacy.vis_codigo,
      campo_id,
      datahora: legacy.vis_datahora,
      distancia_metros: distancia,
    });
  } catch (e) { err(res, e, 'checkin'); }
}
```

- [ ] **Step 2.3: Compilar e verificar sem erros**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem output (zero erros).

---

## Task 3: Backend — checkout aceita resultado, atualiza visitas_campo

**Files:**
- Modify: `backend/src/modules/crm/crm.controller.ts` (função `checkoutHandler`, ~linha 1122)

- [ ] **Step 3.1: Substituir checkoutHandler completo**

```typescript
export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { ven_codigo, cli_codigo, latitude, longitude, resultado, motivo_nao_positivo } = req.body;
  if (!ven_codigo || !cli_codigo) {
    res.status(400).json({ success: false, message: 'ven_codigo e cli_codigo são obrigatórios.' });
    return;
  }
  if (!resultado) {
    res.status(400).json({ success: false, message: 'resultado é obrigatório no checkout.' });
    return;
  }
  const resultadosValidos = ['positivou', 'nao_positivou', 'reagendou', 'ausente', 'fechado'];
  if (!resultadosValidos.includes(resultado)) {
    res.status(400).json({ success: false, message: `resultado deve ser: ${resultadosValidos.join(', ')}` });
    return;
  }
  try {
    // ── Escrita legada em registro_visitas ───────────────────────────────────
    const legacyRes = await db.query(`
      INSERT INTO registro_visitas
        (vis_promotor_id, vis_cliente_id, vis_latitude_checkin, vis_longitude_checkin, vis_tipo)
      VALUES ($1, $2, $3, $4, 'CHECKOUT')
      RETURNING vis_codigo, vis_datahora
    `, [parseInt(ven_codigo), parseInt(cli_codigo), latitude ?? 0, longitude ?? 0]);
    const legacy = legacyRes.rows[0];

    // ── Atualizar visita_campo com resultado e checkout coords ───────────────
    // Encontra o check-in aberto mais recente deste promotor+cliente hoje
    const updateRes = await db.query(`
      UPDATE visitas_campo
      SET checkout_at         = NOW(),
          checkout_lat        = $3,
          checkout_lng        = $4,
          resultado           = $5,
          motivo_nao_positivo = $6,
          duracao_minutos     = ROUND(EXTRACT(EPOCH FROM (NOW() - checkin_at)) / 60)
      WHERE id = (
        SELECT id FROM visitas_campo
        WHERE ven_codigo = $1 AND cli_codigo = $2
          AND data = CURRENT_DATE AND checkout_at IS NULL
        ORDER BY checkin_at DESC
        LIMIT 1
      )
      RETURNING id, duracao_minutos
    `, [
      parseInt(ven_codigo), parseInt(cli_codigo),
      latitude ?? null, longitude ?? null,
      resultado, motivo_nao_positivo ?? null,
    ]);

    const campo = updateRes.rows[0];
    console.log(`🏁 [CHECKOUT] ven=${ven_codigo} cli=${cli_codigo} resultado=${resultado} dur=${campo?.duracao_minutos}min`);
    res.json({
      success: true,
      vis_codigo: legacy.vis_codigo,
      campo_id: campo?.id ?? null,
      resultado,
      duracao_minutos: campo?.duracao_minutos ?? null,
    });
  } catch (e) { err(res, e, 'checkout'); }
}
```

- [ ] **Step 3.2: Compilar**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros.

---

## Task 4: Backend — endpoint GET /crm/campo/ao-vivo

**Files:**
- Modify: `backend/src/modules/crm/crm.controller.ts` (adicionar no final do arquivo)
- Modify: `backend/src/modules/crm/crm.routes.ts`

- [ ] **Step 4.1: Adicionar campoAoVivoHandler no final de crm.controller.ts**

Adicione antes do último `}` ou no final do arquivo:

```typescript
// GET /crm/campo/ao-vivo — estado atual dos promotores + todas as visitas do dia
export async function campoAoVivoHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { data } = req.query as Record<string, string>;
  const dia = data || new Date().toISOString().slice(0, 10);

  try {
    // Todas as visitas do dia com nomes
    const visitasRes = await db.query(`
      SELECT
        vc.id,
        vc.cli_codigo,
        vc.ven_codigo,
        vc.checkin_at,
        vc.checkout_at,
        vc.resultado,
        vc.motivo_nao_positivo,
        vc.duracao_minutos,
        vc.checkin_lat,
        vc.checkin_lng,
        c.cli_nomred  AS cliente_nome,
        c.cli_nome    AS cliente_razao,
        v.ven_nome    AS promotor_nome
      FROM visitas_campo vc
      JOIN clientes   c ON c.cli_codigo  = vc.cli_codigo
      JOIN vendedores v ON v.ven_codigo = vc.ven_codigo
      WHERE vc.data = $1
      ORDER BY vc.checkin_at DESC
    `, [dia]);

    const visitas = visitasRes.rows;

    // Agrupar por promotor
    const promMap = new Map<number, {
      ven_codigo: number;
      promotor_nome: string;
      total_visitas: number;
      positivadas: number;
      nao_positivadas: number;
      em_visita: boolean;
      cliente_atual: string | null;
      checkin_atual: string | null;
    }>();

    for (const v of visitas) {
      if (!promMap.has(v.ven_codigo)) {
        promMap.set(v.ven_codigo, {
          ven_codigo:      v.ven_codigo,
          promotor_nome:   v.promotor_nome,
          total_visitas:   0,
          positivadas:     0,
          nao_positivadas: 0,
          em_visita:       false,
          cliente_atual:   null,
          checkin_atual:   null,
        });
      }
      const p = promMap.get(v.ven_codigo)!;
      p.total_visitas++;
      if (v.resultado === 'positivou')     p.positivadas++;
      if (v.resultado === 'nao_positivou') p.nao_positivadas++;
      if (!v.checkout_at && !p.em_visita) {
        p.em_visita    = true;
        p.cliente_atual = v.cliente_nome;
        p.checkin_atual = v.checkin_at;
      }
    }

    // KPIs globais
    const kpis = {
      total_visitas:   visitas.length,
      positivadas:     visitas.filter(v => v.resultado === 'positivou').length,
      nao_positivadas: visitas.filter(v => v.resultado === 'nao_positivou').length,
      em_visita:       visitas.filter(v => !v.checkout_at).length,
    };

    res.json({
      success: true,
      data: { kpis, promotores: [...promMap.values()], visitas },
    });
  } catch (e) { err(res, e, 'campo ao vivo'); }
}
```

- [ ] **Step 4.2: Adicionar a rota em crm.routes.ts**

No arquivo `backend/src/modules/crm/crm.routes.ts`:

Adicione `campoAoVivoHandler` na linha de imports do controller:
```typescript
import {
  // ... existentes ...
  campoAoVivoHandler,
} from './crm.controller';
```

Adicione a rota junto ao bloco de Check-in / Check-out (após linha 82):
```typescript
// Campo Ao Vivo — Painel do Diretor
router.get('/campo/ao-vivo', campoAoVivoHandler);
```

- [ ] **Step 4.3: Compilar backend completo**

```bash
cd backend && npx tsc
```

Expected: sem output (zero erros). Dist gerado em `backend/dist/src/...`.

- [ ] **Step 4.4: Commit do backend**

```bash
git add backend/src/modules/crm/crm.controller.ts backend/src/modules/crm/crm.routes.ts backend/migrations/042_crm_visitas_campo.sql
git commit -m "feat(crm): checkout captura resultado + endpoint campo/ao-vivo

- visitas_campo: nova tabela por tenant com resultado de positivação
- checkinHandler: dual-write registro_visitas + visitas_campo
- checkoutHandler: aceita resultado/motivo, UPDATE visitas_campo
- campoAoVivoHandler: KPIs + promotores + visitas do dia

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Mobile — CheckoutResultadoModal component

**Files:**
- Create: `src/mobile/components/CheckoutResultadoModal.tsx`

- [ ] **Step 5.1: Criar o componente**

```tsx
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const RESULTADOS = [
  { value: 'positivou',     emoji: '✅', label: 'Positivou',     sub: 'Saí com pedido' },
  { value: 'nao_positivou', emoji: '❌', label: 'Não positivou', sub: 'Sem pedido desta vez' },
  { value: 'reagendou',     emoji: '📅', label: 'Reagendou',     sub: 'Marcamos novo contato' },
  { value: 'ausente',       emoji: '🚪', label: 'Ausente',       sub: 'Loja fechada / sem responsável' },
] as const;

const MOTIVOS = [
  'Sem estoque / estoque cheio',
  'Preço acima do mercado',
  'Concorrência',
  'Sem interesse no momento',
  'Comprador ausente',
  'Outro',
];

interface Props {
  clienteNome: string;
  onConfirm: (resultado: string, motivo: string | null) => Promise<void>;
  onCancel: () => void;
}

export function CheckoutResultadoModal({ clienteNome, onConfirm, onCancel }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [motivo, setMotivo]           = useState('');
  const [loading, setLoading]         = useState(false);

  const podeConfirmar =
    selecionado !== null &&
    (selecionado !== 'nao_positivou' || motivo !== '');

  async function handleConfirm() {
    if (!podeConfirmar) return;
    setLoading(true);
    await onConfirm(selecionado!, selecionado === 'nao_positivou' ? motivo : null);
    setLoading(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#1E2A3A', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
          Check-out
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 22 }}>
          {clienteNome}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Como foi a visita?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {RESULTADOS.map(r => (
            <button
              key={r.value}
              onClick={() => { setSelecionado(r.value); setMotivo(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px', borderRadius: 14,
                border: selecionado === r.value
                  ? '2px solid #FFD200'
                  : '1px solid rgba(255,255,255,0.1)',
                background: selecionado === r.value
                  ? 'rgba(255,210,0,0.12)'
                  : 'rgba(255,255,255,0.05)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{r.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{r.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {selecionado === 'nao_positivou' && (
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 14,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: motivo ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13,
              appearance: 'none',
            }}>
            <option value=''>Selecione o motivo *</option>
            {MOTIVOS.map(m => (
              <option key={m} value={m} style={{ background: '#1E2A3A', color: '#fff' }}>{m}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!podeConfirmar || loading}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 14, border: 'none',
              background: podeConfirmar ? '#FFD200' : 'rgba(255,255,255,0.08)',
              color: podeConfirmar ? '#1E2A3A' : 'rgba(255,255,255,0.25)',
              fontSize: 14, fontWeight: 800,
              cursor: podeConfirmar ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : 'Confirmar Check-out'
            }
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
```

---

## Task 6: Mobile — interceptar checkout com modal de resultado

**Files:**
- Modify: `src/mobile/pages/ClientesPage.tsx`

- [ ] **Step 6.1: Adicionar import do modal**

No topo do arquivo, após os imports existentes:
```typescript
import { CheckoutResultadoModal } from '../components/CheckoutResultadoModal';
```

- [ ] **Step 6.2: Adicionar estado do modal**

Após a linha `const [loadingCI, setLoadingCI] = useState<number | null>(null);` (linha ~82), adicione:

```typescript
const [checkoutModal, setCheckoutModal] = useState<{ cli_codigo: number; nome: string } | null>(null);
```

- [ ] **Step 6.3: Substituir handleCheckout por duas funções**

Substitua `handleCheckout` (linhas ~125-139) pelas duas funções abaixo:

```typescript
function openCheckoutModal(e: React.MouseEvent, cli_codigo: number, nome: string) {
  e.stopPropagation();
  if (!user?.codigo) return;
  setCheckoutModal({ cli_codigo, nome });
}

async function handleCheckoutConfirm(resultado: string, motivo: string | null) {
  if (!checkoutModal || !user?.codigo) return;
  const { cli_codigo } = checkoutModal;
  setLoadingCI(cli_codigo);
  try {
    const gps = await getGPS();
    const r = await api.post('/crm/visitas/checkout', {
      ven_codigo: user.codigo, cli_codigo, resultado,
      motivo_nao_positivo: motivo,
      ...gps,
    });
    if (r.data.success) {
      setCheckIns(prev => { const s = new Set(prev); s.delete(cli_codigo); return s; });
      setCheckoutModal(null);
    }
  } catch { alert('Erro ao registrar check-out.'); }
  finally { setLoadingCI(null); }
}
```

- [ ] **Step 6.4: Atualizar o onClick do botão de check-in/checkout**

Localize a linha (em torno de 352):
```typescript
onClick={e => isIn ? handleCheckout(e, c.cli_codigo) : handleCheckin(e, c.cli_codigo)}
```

Substitua por:
```typescript
onClick={e => isIn
  ? openCheckoutModal(e, c.cli_codigo, c.cli_nomred || String(c.cli_codigo))
  : handleCheckin(e, c.cli_codigo)
}
```

- [ ] **Step 6.5: Adicionar o modal no JSX**

Imediatamente antes do `</div>` de fechamento mais externo do componente (ou antes do `return null` / após o container principal), adicione:

```tsx
{checkoutModal && (
  <CheckoutResultadoModal
    clienteNome={checkoutModal.nome}
    onConfirm={handleCheckoutConfirm}
    onCancel={() => setCheckoutModal(null)}
  />
)}
```

- [ ] **Step 6.6: Verificar TypeScript**

```bash
cd /e/Sistemas_ia/RepOne && npx tsc --noEmit
```

Expected: sem erros relacionados a ClientesPage ou CheckoutResultadoModal.

- [ ] **Step 6.7: Commit do mobile**

```bash
git add src/mobile/components/CheckoutResultadoModal.tsx src/mobile/pages/ClientesPage.tsx
git commit -m "feat(mobile): checkout captura resultado de positivação via modal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Web — CampoAoVivoPage (Painel do Diretor)

**Files:**
- Create: `src/modules/crm/pages/CampoAoVivoPage.tsx`

- [ ] **Step 7.1: Criar o arquivo completo**

```tsx
import { useEffect, useState, useCallback } from 'react';
import {
  MapPin, Users, CheckCircle2, XCircle, Loader2, Clock,
  RefreshCw, User, TrendingUp,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';
import { AppSidebar } from '@/shared/components/layout/AppSidebar';
import { TabsBar } from '@/shared/components/layout/TabsBar';

// ── Corrigir ícone padrão do Leaflet em Vite ────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function pinIcon(resultado: string | null) {
  const cor = resultado === 'positivou' ? '#16A34A'
    : resultado === 'nao_positivou'    ? '#DC2626'
    : resultado === null               ? '#F59E0B'
    : '#6B7280';
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Kpis {
  total_visitas: number;
  positivadas: number;
  nao_positivadas: number;
  em_visita: number;
}

interface Promotor {
  ven_codigo: number;
  promotor_nome: string;
  total_visitas: number;
  positivadas: number;
  nao_positivadas: number;
  em_visita: boolean;
  cliente_atual: string | null;
  checkin_atual: string | null;
}

interface Visita {
  id: number;
  cli_codigo: number;
  ven_codigo: number;
  checkin_at: string;
  checkout_at: string | null;
  resultado: string | null;
  motivo_nao_positivo: string | null;
  duracao_minutos: number | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  cliente_nome: string;
  cliente_razao: string;
  promotor_nome: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function ResultadoBadge({ resultado }: { resultado: string | null }) {
  if (!resultado) return (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: '#FEF3C7', padding: '2px 8px', borderRadius: 20, border: '1px solid #FDE68A' }}>
      Em visita
    </span>
  );
  const map: Record<string, [string, string, string]> = {
    positivou:     ['✅ Positivou',     '#16A34A', '#F0FDF4'],
    nao_positivou: ['❌ Não positivou', '#DC2626', '#FEF2F2'],
    reagendou:     ['📅 Reagendou',     '#2563EB', '#EFF6FF'],
    ausente:       ['🚪 Ausente',       '#6B7280', '#F9FAFB'],
    fechado:       ['🔒 Fechado',       '#6B7280', '#F9FAFB'],
  };
  const [label, color, bg] = map[resultado] ?? [resultado, '#6B7280', '#F9FAFB'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}

// ── Promotor Card ────────────────────────────────────────────────────────────
function PromotorCard({ p }: { p: Promotor }) {
  const taxa = p.total_visitas > 0 ? Math.round((p.positivadas / p.total_visitas) * 100) : 0;
  return (
    <div style={{
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 14,
      padding: '16px', position: 'relative',
      boxShadow: p.em_visita ? `0 0 0 2px #F59E0B` : 'none',
    }}>
      {p.em_visita && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: '#FEF3C7', color: '#92400E',
          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
          border: '1px solid #FDE68A',
        }}>
          ● EM VISITA
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={18} color={G.textMuted} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>{p.promotor_nome}</div>
          {p.em_visita && p.cliente_atual && (
            <div style={{ fontSize: 11, color: G.textMuted }}>
              {p.cliente_atual} · desde {p.checkin_atual ? fmtHora(p.checkin_atual) : '--'}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Visitas',      value: p.total_visitas, color: G.text },
          { label: 'Positivadas',  value: p.positivadas,   color: '#16A34A' },
          { label: 'Não positiv.', value: p.nao_positivadas, color: '#DC2626' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', background: G.bg, borderRadius: 10, padding: '8px 4px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
          </div>
        ))}
      </div>
      {p.total_visitas > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: G.textMuted }}>Taxa de positivação</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: taxa >= 60 ? '#16A34A' : taxa >= 40 ? '#F59E0B' : '#DC2626' }}>{taxa}%</span>
          </div>
          <div style={{ height: 5, background: G.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${taxa}%`, background: taxa >= 60 ? '#16A34A' : taxa >= 40 ? '#F59E0B' : '#DC2626', borderRadius: 3, transition: 'width .4s' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Visita Row ───────────────────────────────────────────────────────────────
function VisitaRow({ v }: { v: Visita }) {
  return (
    <tr style={{ borderBottom: `1px solid ${G.border}` }}>
      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: G.text }}>
        {v.cliente_razao || v.cliente_nome}
        <div style={{ fontSize: 11, color: G.textMuted, fontWeight: 500 }}>{v.cliente_nome}</div>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: G.textSec }}>{v.promotor_nome}</td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: G.text, fontFamily: 'monospace' }}>
        {fmtHora(v.checkin_at)}
        {v.checkout_at && <> → {fmtHora(v.checkout_at)}</>}
      </td>
      <td style={{ padding: '10px 14px' }}>
        {v.duracao_minutos != null && (
          <span style={{ fontSize: 11, color: G.textMuted, marginRight: 8 }}>{v.duracao_minutos}min</span>
        )}
        <ResultadoBadge resultado={v.resultado} />
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CampoAoVivoPage() {
  const [kpis, setKpis]           = useState<Kpis | null>(null);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [visitas, setVisitas]     = useState<Visita[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const r = await api.get('/crm/campo/ao-vivo');
      if (r.data.success) {
        setKpis(r.data.data.kpis);
        setPromotores(r.data.data.promotores);
        setVisitas(r.data.data.visitas);
        setLastUpdate(new Date());
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const visitasComCoord = visitas.filter(v => v.checkin_lat && v.checkin_lng);
  const mapCenter: [number, number] = visitasComCoord.length > 0
    ? [Number(visitasComCoord[0].checkin_lat), Number(visitasComCoord[0].checkin_lng)]
    : [-14.235, -51.925]; // centro do Brasil como fallback

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: G.bg }}>
      <AppSidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TabsBar />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ background: G.bg, borderBottom: `1px solid ${G.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: G.text, margin: 0, letterSpacing: -0.5 }}>
              Campo Ao Vivo
              <span style={{ fontSize: 12, fontWeight: 700, color: G.textMuted, marginLeft: 8 }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: G.textMuted }}>
                Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, color: G.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Loader2 size={24} style={{ color: G.textMuted, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* ── KPI Strip ──────────────────────────────────────────────── */}
              {kpis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  {[
                    { icon: <MapPin size={18} />,        label: 'Total de Visitas', value: kpis.total_visitas,   color: G.text },
                    { icon: <CheckCircle2 size={18} />,  label: 'Positivações',     value: kpis.positivadas,     color: '#16A34A' },
                    { icon: <XCircle size={18} />,       label: 'Não positivaram',  value: kpis.nao_positivadas, color: '#DC2626' },
                    { icon: <Clock size={18} />,         label: 'Em visita agora',  value: kpis.em_visita,       color: '#F59E0B' },
                  ].map(({ icon, label, value, color }) => (
                    <div key={label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 8 }}>{icon}
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Cards de Promotores ─────────────────────────────────── */}
              {promotores.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 12, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    <Users size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Promotores
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {promotores.map(p => <PromotorCard key={p.ven_codigo} p={p} />)}
                  </div>
                </div>
              )}

              {/* ── Mapa ──────────────────────────────────────────────────── */}
              {visitasComCoord.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 12, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    <MapPin size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Mapa de Cobertura
                  </h2>
                  <div style={{ height: 360, borderRadius: 16, overflow: 'hidden', border: `1px solid ${G.border}` }}>
                    <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {visitasComCoord.map(v => (
                        <Marker
                          key={v.id}
                          position={[Number(v.checkin_lat), Number(v.checkin_lng)]}
                          icon={pinIcon(v.resultado)}>
                          <Popup>
                            <strong>{v.cliente_razao || v.cliente_nome}</strong><br />
                            {v.promotor_nome}<br />
                            {fmtHora(v.checkin_at)}
                            {v.checkout_at && <> → {fmtHora(v.checkout_at)}</>}<br />
                            <ResultadoBadge resultado={v.resultado} />
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    {[
                      { cor: '#F59E0B', label: 'Em visita agora' },
                      { cor: '#16A34A', label: 'Positivou' },
                      { cor: '#DC2626', label: 'Não positivou' },
                      { cor: '#6B7280', label: 'Reagendou / Ausente' },
                    ].map(({ cor, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: cor, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Tabela de Visitas ─────────────────────────────────────── */}
              {visitas.length > 0 ? (
                <div>
                  <h2 style={{ fontSize: 12, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    <TrendingUp size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Todas as Visitas ({visitas.length})
                  </h2>
                  <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: G.cardHi }}>
                          {['Cliente', 'Promotor', 'Horário', 'Resultado'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, borderBottom: `1px solid ${G.border}` }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visitas.map(v => <VisitaRow key={v.id} v={v} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: G.textMuted, padding: '60px 0', fontSize: 14 }}>
                  Nenhuma visita registrada hoje ainda.
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
```

---

## Task 8: Web — Registrar rota e link no sidebar

**Files:**
- Modify: `src/shared/lib/routeConfig.tsx`
- Modify: `src/shared/components/layout/AppSidebar.tsx`

- [ ] **Step 8.1: Adicionar lazy import em routeConfig.tsx**

Após as importações lazy existentes do CRM (em torno de linha 59), adicione:
```typescript
const CampoAoVivoPage = lazy(() => import('@/modules/crm/pages/CampoAoVivoPage'))
```

- [ ] **Step 8.2: Registrar a rota no objeto de rotas**

No objeto de rotas (após a entrada `'/repcrm/visitas'`, em torno de linha 121), adicione:
```typescript
'/repcrm/campo': { id: 'crm-campo', label: 'Campo Ao Vivo', path: '/repcrm/campo', icon: MapPin, element: <CampoAoVivoPage /> },
```

Certifique-se de que `MapPin` está importado no arquivo (provavelmente já está junto com outros ícones do lucide-react).

- [ ] **Step 8.3: Adicionar no sidebar**

Em `AppSidebar.tsx`, no array de subitens do CRM (após `{ label: 'Visitas', path: '/repcrm/visitas', icon: CalendarDays }`), adicione:
```typescript
{ label: 'Campo Ao Vivo', path: '/repcrm/campo', icon: MapPin },
```

Certifique-se de que `MapPin` está importado no AppSidebar.

- [ ] **Step 8.4: Verificar TypeScript**

```bash
cd /e/Sistemas_ia/RepOne && npx tsc --noEmit
```

Expected: zero erros.

---

## Task 9: Build Final + Deploy

- [ ] **Step 9.1: Build do frontend**

```bash
cd /e/Sistemas_ia/RepOne && npx vite build
```

Expected: `✓ built in X.XXs` — sem erros TypeScript ou de bundle.

- [ ] **Step 9.2: Commit final**

```bash
git add src/modules/crm/pages/CampoAoVivoPage.tsx src/shared/lib/routeConfig.tsx src/shared/components/layout/AppSidebar.tsx
git commit -m "feat(crm): CampoAoVivoPage — painel de campo ao vivo do diretor

Mapa com pins coloridos, cards por promotor com taxa de positivação,
KPI strip, tabela de visitas do dia. Polling 30s automático.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 9.3: Listar arquivos backend para deploy**

```
backend/dist/src/modules/crm/crm.controller.js
backend/dist/src/modules/crm/crm.routes.js
```

- [ ] **Step 9.4: Testar fluxo completo**

1. Mobile: abrir app → ir em Clientes → fazer check-in em um cliente → aguardar → pressionar check-out
   - Verificar: modal de resultado abre com 4 opções
   - Selecionar "Positivou" → clicar "Confirmar Check-out"
   - Verificar: botão volta para verde (check-in), sem erro

2. Mobile: fazer outro check-in → check-out com "Não positivou" → selecionar motivo
   - Verificar: modal exige motivo antes de confirmar

3. Web: navegar para `/repcrm/campo`
   - Verificar: KPI strip mostra 2 visitas, 1 positivada, 1 não positivada
   - Verificar: cards de promotores aparecem
   - Se clientes têm coordenadas: verificar pins no mapa

---

## Self-Review

### Cobertura do Spec

| Requisito do Spec (Phase 1) | Task |
|---|---|
| Migration: criar `iris_insights` + `visitas_campo` | Task 1 |
| Mobile: checkout captura resultado obrigatório | Tasks 5, 6 |
| Backend: checkin escreve em visitas_campo | Task 2 |
| Backend: checkout com resultado UPDATE visitas_campo | Task 3 |
| Backend: endpoint `/crm/campo/ao-vivo` | Task 4 |
| Web: CampoAoVivoPage com promotor cards + polling 30s | Task 7 |
| Web: rota e sidebar | Task 8 |

### Checagens Adicionais

- O `checkinHandler` modificado ainda retorna `vis_codigo` (backward compat com código mobile existente que usa esse campo) ✅
- O `visitasHojeHandler` (usa `registro_visitas`) não foi alterado — backward compat mantido ✅
- O `checkoutHandler` exige `resultado` no body — se a versão antiga do mobile chamar sem resultado, retorna 400. O modal no mobile garante que sempre haverá resultado antes de chamar a API ✅
- `react-leaflet` + `leaflet` + `@types/leaflet` já estão em package.json ✅
- Fallback de mapa para o centro do Brasil quando nenhum cliente tem coordenadas ✅
- `ResultadoBadge` é definido dentro do arquivo `CampoAoVivoPage.tsx` — não precisa de import externo ✅
- Nomes de método consistentes: `openCheckoutModal` / `handleCheckoutConfirm` em ClientesPage, sem conflito com `handleCheckin` existente ✅
