import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, Field, G, inp,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

interface Grupo {
  gru_codigo: number;
  gru_nome: string;
  gru_percomiss: number;
  gru_usa_percomiss: boolean;
}

const empty: Partial<Grupo> = { gru_percomiss: 0, gru_usa_percomiss: false };

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

export default function GruposPage() {
  const [data, setData]         = useState<Grupo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [editing, setEditing]   = useState<Partial<Grupo>>(empty);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/grupos?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(empty); setActiveTab('cadastro'); };

  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/grupos/${id}`);
      setEditing(res.data.data);
      setActiveTab('cadastro');
    } catch { /* ignore */ }
  };

  const cancel = () => { setActiveTab('lista'); setEditing(empty); };

  const save = async () => {
    if (!editing.gru_nome?.trim()) return;
    setSaving(true);
    try {
      if (editing.gru_codigo) {
        await api.put(`/grupos/${editing.gru_codigo}`, editing);
      } else {
        await api.post('/grupos', editing);
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
    if (!confirm('Remover este grupo?')) return;
    try {
      await api.delete(`/grupos/${id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao excluir.');
    }
  };

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      'Código':      r.gru_codigo,
      'Nome do Grupo': r.gru_nome,
      '% Comissão':  r.gru_percomiss ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grupos');
    XLSX.writeFile(wb, 'grupos-de-produtos.xlsx');
  };

  const set = (field: keyof Grupo, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  const filtered = data.filter(r =>
    !search || r.gru_nome?.toLowerCase().includes(search.toLowerCase())
  );

  const formTitle = editing.gru_codigo ? `Editar — ${editing.gru_nome}` : 'Novo Grupo';

  return (
    <CadastroShell
      title="Grupos de Produtos"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por nome..."
      onNew={openNew}
      newLabel="Novo Grupo"
      toolbar={
        <button onClick={exportExcel} title="Exportar para Excel" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: '#1D6F42', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          <Download size={13} /> Excel
        </button>
      }
      loading={loading}
      activeTab={activeTab}
      formTitle={formTitle}
      onSave={save}
      onCancel={cancel}
      saving={saving}
      form={
        <FormSection title="Dados do Grupo">
          <Field label="Nome do Grupo *">
            <input
              style={inp}
              value={editing.gru_nome || ''}
              onChange={e => set('gru_nome', e.target.value)}
              onKeyDown={onEnterTab}
              placeholder="Ex: FILTROS, LUBRIFICANTES..."
              autoFocus
            />
          </Field>
          <Field label="Comissão Própria por Grupo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: G.text }}>
                <input
                  type="checkbox"
                  checked={!!editing.gru_usa_percomiss}
                  onChange={e => {
                    set('gru_usa_percomiss', e.target.checked);
                    if (!e.target.checked) set('gru_percomiss', 0);
                  }}
                  style={{ width: 16, height: 16, accentColor: G.mustard, cursor: 'pointer' }}
                />
                Usar % próprio para comissão do preposto
              </label>
            </div>
          </Field>
          {editing.gru_usa_percomiss && (
            <Field label="% Comissão do Preposto">
              <input
                style={{ ...inp, textAlign: 'right', maxWidth: 160 }}
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={editing.gru_percomiss ?? 0}
                onChange={e => set('gru_percomiss', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </Field>
          )}
        </FormSection>
      }
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Cód</Th>
            <Th>Nome do Grupo</Th>
            <Th align="right">% Comissão</Th>
            <Th align="center">Comissão Própria</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum grupo encontrado.
              </td>
            </tr>
          )}
          {filtered.map(row => (
            <TrHover key={row.gru_codigo} onClick={() => openEdit(row.gru_codigo)}>
              <Td>
                <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>
                  #{String(row.gru_codigo).padStart(3, '0')}
                </span>
              </Td>
              <Td><span style={{ fontWeight: 700 }}>{row.gru_nome}</span></Td>
              <Td align="right">
                <span style={{ fontSize: 12, color: row.gru_percomiss > 0 ? G.success : G.textMuted, fontWeight: 700 }}>
                  {row.gru_percomiss > 0 ? `${Number(row.gru_percomiss).toFixed(2)}%` : '—'}
                </span>
              </Td>
              <Td align="center">
                {row.gru_usa_percomiss ? (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: `${G.mustard}30`, color: G.text }}>
                    SIM — {Number(row.gru_percomiss).toFixed(2)}%
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: G.textMuted }}>—</span>
                )}
              </Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(row.gru_codigo); }} style={actionBtn}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => remove(row.gru_codigo, e)} style={{ ...actionBtn, color: G.danger }}>
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
