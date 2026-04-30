import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, Field, G, inp,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

interface AreaAtuacao {
  atu_id: number;
  atu_descricao: string;
  atu_sel: string;
}

const empty: Partial<AreaAtuacao> = { atu_sel: 'S' };

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

export default function AreaAtuacaoPage() {
  const [data, setData]           = useState<AreaAtuacao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [editing, setEditing]     = useState<Partial<AreaAtuacao>>(empty);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/area-atuacao?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(empty); setActiveTab('cadastro'); };
  const cancel   = () => { setActiveTab('lista'); setEditing(empty); };

  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/area-atuacao/${id}`);
      setEditing(res.data.data);
      setActiveTab('cadastro');
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!editing.atu_descricao?.trim()) return;
    setSaving(true);
    try {
      if (editing.atu_id) {
        await api.put(`/area-atuacao/${editing.atu_id}`, editing);
      } else {
        await api.post('/area-atuacao', editing);
      }
      cancel(); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remover esta área de atuação?')) return;
    try { await api.delete(`/area-atuacao/${id}`); load(); }
    catch (err: any) { alert(err?.response?.data?.message || 'Erro ao excluir.'); }
  };

  const set = (field: keyof AreaAtuacao, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  const filtered = data.filter(r => !search || r.atu_descricao?.toLowerCase().includes(search.toLowerCase()));

  return (
    <CadastroShell
      title="Áreas de Atuação"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por descrição..."
      onNew={openNew}
      newLabel="Nova Área"
      loading={loading}
      activeTab={activeTab}
      formTitle={editing.atu_id ? `Editar — ${editing.atu_descricao}` : 'Nova Área de Atuação'}
      onSave={save}
      onCancel={cancel}
      saving={saving}
      form={
        <FormSection title="Dados da Área de Atuação">
          <Field label="Descrição *">
            <input style={inp} value={editing.atu_descricao || ''} autoFocus
              onChange={e => set('atu_descricao', e.target.value)} onKeyDown={onEnterTab}
              placeholder="Ex: INDÚSTRIA, COMÉRCIO, CONSTRUÇÃO CIVIL..." />
          </Field>
          <Field label="Ativa">
            <select style={{ ...inp, cursor: 'pointer', maxWidth: 160 }}
              value={editing.atu_sel || 'S'}
              onChange={e => set('atu_sel', e.target.value)}>
              <option value="S">Sim</option>
              <option value="N">Não</option>
            </select>
          </Field>
        </FormSection>
      }
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Cód</Th>
            <Th>Descrição</Th>
            <Th align="center">Ativa</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>Nenhuma área de atuação encontrada.</td></tr>
          )}
          {filtered.map(row => (
            <TrHover key={row.atu_id} onClick={() => openEdit(row.atu_id)}>
              <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{String(row.atu_id).padStart(3, '0')}</span></Td>
              <Td><span style={{ fontWeight: 700 }}>{row.atu_descricao}</span></Td>
              <Td align="center">
                <span style={{
                  fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 10px',
                  background: row.atu_sel === 'S' ? G.success + '22' : G.danger + '22',
                  color: row.atu_sel === 'S' ? G.success : G.danger,
                }}>
                  {row.atu_sel === 'S' ? 'Sim' : 'Não'}
                </span>
              </Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(row.atu_id); }} style={actionBtn}><Pencil size={13} /></button>
                  <button onClick={e => remove(row.atu_id, e)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={13} /></button>
                </div>
              </Td>
            </TrHover>
          ))}
        </tbody>
      </CadastroTable>
    </CadastroShell>
  );
}
