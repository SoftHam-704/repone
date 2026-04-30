import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, FormRow, Field, G, inp, label,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

interface GrupoDesc {
  gde_id: number;
  gid: string;
  gde_nome: string;
  gde_desc1: number; gde_desc2: number; gde_desc3: number;
  gde_desc4: number; gde_desc5: number; gde_desc6: number;
  gde_desc7: number; gde_desc8: number; gde_desc9: number;
}

const empty: Partial<GrupoDesc> = {
  gid: '', gde_nome: '',
  gde_desc1: 0, gde_desc2: 0, gde_desc3: 0,
  gde_desc4: 0, gde_desc5: 0, gde_desc6: 0,
  gde_desc7: 0, gde_desc8: 0, gde_desc9: 0,
};

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

// ─── Máscara de percentual (digita da direita) ────────────────────────────────
function centsToDisplay(cents: number): string {
  if (cents === 0) return '';
  const str = String(cents).padStart(3, '0');
  return `${str.slice(0, -2)},${str.slice(-2)}`;
}
function displayToCents(display: string): number {
  return parseInt(display.replace(/\D/g, '') || '0', 10);
}
function floatToCents(v: number): number { return Math.round((v || 0) * 100); }
function centsToFloat(cents: number): number { return cents / 100; }

function DiscountField({ n, value, onChange }: { n: number; value: number; onChange: (v: number) => void }) {
  const [cents, setCents] = useState(() => floatToCents(value));
  useEffect(() => { setCents(floatToCents(value)); }, [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ ...label, display: 'block', textAlign: 'center', marginBottom: 4 }}>{n}º</span>
      <input
        style={{ ...inp, textAlign: 'center', padding: '6px 4px' }}
        type="text" inputMode="numeric"
        value={centsToDisplay(cents)}
        onChange={e => {
          const c = displayToCents(e.target.value);
          if (c > 9999) return;
          setCents(c);
          onChange(centsToFloat(c));
        }}
        onFocus={e => e.target.select()}
        onKeyDown={onEnterTab}
        placeholder="0,00"
      />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function GrupoDescPage() {
  const [data, setData]           = useState<GrupoDesc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [editing, setEditing]     = useState<Partial<GrupoDesc>>(empty);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/grupo-desc?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(empty); setActiveTab('cadastro'); };

  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/grupo-desc/${id}`);
      setEditing(res.data.data);
      setActiveTab('cadastro');
    } catch { /* ignore */ }
  };

  const cancel = () => { setActiveTab('lista'); setEditing(empty); };

  const save = async () => {
    if (!editing.gid?.trim()) return;
    setSaving(true);
    try {
      if (editing.gde_id) {
        await api.put(`/grupo-desc/${editing.gde_id}`, editing);
      } else {
        await api.post('/grupo-desc', editing);
      }
      cancel();
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remover este grupo de desconto?')) return;
    try {
      await api.delete(`/grupo-desc/${id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao excluir.');
    }
  };

  const set = (field: keyof GrupoDesc, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  const filtered = data.filter(r =>
    !search ||
    r.gid?.toLowerCase().includes(search.toLowerCase()) ||
    r.gde_nome?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDescs = (row: GrupoDesc) =>
    ([row.gde_desc1, row.gde_desc2, row.gde_desc3,
      row.gde_desc4, row.gde_desc5, row.gde_desc6,
      row.gde_desc7, row.gde_desc8, row.gde_desc9] as number[])
      .filter(v => v > 0).map(v => `${Number(v).toFixed(2)}%`).join(' / ') || '—';

  const formTitle = editing.gde_id ? `Editar — ${editing.gid}` : 'Novo Grupo de Desconto';

  return (
    <CadastroShell
      title="Grupos de Desconto"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por identificador ou descrição..."
      onNew={openNew}
      newLabel="Novo Grupo"
      loading={loading}
      activeTab={activeTab}
      formTitle={formTitle}
      onSave={save}
      onCancel={cancel}
      saving={saving}
      form={
        <>
          <FormSection title="Grupo">
            <FormRow>
              <Field label="Identificador *">
                <input
                  style={{ ...inp, fontFamily: 'monospace', fontWeight: 700 }}
                  value={editing.gid || ''}
                  onChange={e => set('gid', e.target.value)}
                  onKeyDown={onEnterTab}
                  placeholder="Ex: 1, GOLD, PREM..."
                  autoFocus
                />
              </Field>
              <Field label="Descrição">
                <input
                  style={inp}
                  value={editing.gde_nome || ''}
                  onChange={e => set('gde_nome', e.target.value)}
                  onKeyDown={onEnterTab}
                  placeholder="Nome completo do grupo"
                />
              </Field>
            </FormRow>
          </FormSection>

          <FormSection title="Níveis de Desconto (%)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map(n => {
                const k = `gde_desc${n}` as keyof GrupoDesc;
                return (
                  <DiscountField
                    key={n}
                    n={n}
                    value={(editing[k] as number) ?? 0}
                    onChange={v => set(k, v)}
                  />
                );
              })}
            </div>
          </FormSection>
        </>
      }
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Identificador</Th>
            <Th>Descrição</Th>
            <Th>Níveis de Desconto</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum grupo de desconto encontrado.
              </td>
            </tr>
          )}
          {filtered.map(row => (
            <TrHover key={row.gde_id} onClick={() => openEdit(row.gde_id)}>
              <Td>
                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 6, background: '#28374A14', fontSize: 12, fontWeight: 800, color: G.text, fontFamily: 'monospace' }}>
                  {row.gid}
                </span>
              </Td>
              <Td><span style={{ fontWeight: 600 }}>{row.gde_nome || '—'}</span></Td>
              <Td><span style={{ fontSize: 12, color: G.textSec, fontFamily: 'monospace' }}>{fmtDescs(row)}</span></Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(row.gde_id); }} style={actionBtn}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => remove(row.gde_id, e)} style={{ ...actionBtn, color: G.danger }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </Td>
            </TrHover>
          ))}
        </tbody>
      </CadastroTable>
    </CadastroShell>
  );
}
