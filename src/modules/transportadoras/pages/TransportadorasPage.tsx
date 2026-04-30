import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, FormRow, Field, G, inp,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

interface Transportadora {
  tra_codigo: number;
  tra_nome: string;
  tra_endereco: string;
  tra_bairro: string;
  tra_cidade: string;
  tra_uf: string;
  tra_cep: string;
  tra_fone: string;
  tra_cgc: string;
  tra_inscricao: string;
  tra_email: string;
  tra_contato: string;
  tra_obs: string;
}

const empty: Partial<Transportadora> = {};

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

export default function TransportadorasPage() {
  const [data, setData]           = useState<Transportadora[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [editing, setEditing]     = useState<Partial<Transportadora>>(empty);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/transportadoras?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(empty); setActiveTab('cadastro'); };
  const cancel   = () => { setActiveTab('lista'); setEditing(empty); };

  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/transportadoras/${id}`);
      setEditing(res.data.data);
      setActiveTab('cadastro');
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!editing.tra_nome?.trim()) return;
    setSaving(true);
    try {
      if (editing.tra_codigo) {
        await api.put(`/transportadoras/${editing.tra_codigo}`, editing);
      } else {
        await api.post('/transportadoras', editing);
      }
      cancel(); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remover esta transportadora?')) return;
    try { await api.delete(`/transportadoras/${id}`); load(); }
    catch (err: any) { alert(err?.response?.data?.message || 'Erro ao excluir.'); }
  };

  const set = (field: keyof Transportadora, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  const filtered = data.filter(r =>
    !search || r.tra_nome?.toLowerCase().includes(search.toLowerCase()) ||
    r.tra_cidade?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CadastroShell
      title="Transportadoras"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por nome ou cidade..."
      onNew={openNew}
      newLabel="Nova Transportadora"
      loading={loading}
      activeTab={activeTab}
      formTitle={editing.tra_codigo ? `Editar — ${editing.tra_nome}` : 'Nova Transportadora'}
      onSave={save}
      onCancel={cancel}
      saving={saving}
      form={
        <>
          <FormSection title="Dados Principais">
            <Field label="Nome da Transportadora *">
              <input style={inp} value={editing.tra_nome || ''} autoFocus
                onChange={e => set('tra_nome', e.target.value)} onKeyDown={onEnterTab}
                placeholder="Razão social ou nome fantasia..." />
            </Field>
            <FormRow>
              <Field label="CNPJ">
                <input style={inp} value={editing.tra_cgc || ''}
                  onChange={e => set('tra_cgc', e.target.value)} onKeyDown={onEnterTab}
                  placeholder="00.000.000/0000-00" />
              </Field>
              <Field label="Inscrição Estadual">
                <input style={inp} value={editing.tra_inscricao || ''}
                  onChange={e => set('tra_inscricao', e.target.value)} onKeyDown={onEnterTab} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Telefone">
                <input style={inp} value={editing.tra_fone || ''}
                  onChange={e => set('tra_fone', e.target.value)} onKeyDown={onEnterTab}
                  placeholder="(00) 00000-0000" />
              </Field>
              <Field label="E-mail">
                <input style={inp} type="email" value={editing.tra_email || ''}
                  onChange={e => set('tra_email', e.target.value)} onKeyDown={onEnterTab}
                  placeholder="contato@transportadora.com" />
              </Field>
            </FormRow>
            <Field label="Contato">
              <input style={inp} value={editing.tra_contato || ''}
                onChange={e => set('tra_contato', e.target.value)} onKeyDown={onEnterTab}
                placeholder="Nome do responsável..." />
            </Field>
          </FormSection>

          <FormSection title="Endereço">
            <Field label="Endereço">
              <input style={inp} value={editing.tra_endereco || ''}
                onChange={e => set('tra_endereco', e.target.value)} onKeyDown={onEnterTab} />
            </Field>
            <FormRow>
              <Field label="Bairro">
                <input style={inp} value={editing.tra_bairro || ''}
                  onChange={e => set('tra_bairro', e.target.value)} onKeyDown={onEnterTab} />
              </Field>
              <Field label="CEP">
                <input style={inp} value={editing.tra_cep || ''}
                  onChange={e => set('tra_cep', e.target.value)} onKeyDown={onEnterTab}
                  placeholder="00000-000" />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Cidade">
                <input style={inp} value={editing.tra_cidade || ''}
                  onChange={e => set('tra_cidade', e.target.value)} onKeyDown={onEnterTab} />
              </Field>
              <Field label="UF">
                <input style={{ ...inp, maxWidth: 80 }} value={editing.tra_uf || ''}
                  onChange={e => set('tra_uf', e.target.value.toUpperCase().slice(0, 2))} onKeyDown={onEnterTab}
                  maxLength={2} placeholder="SP" />
              </Field>
            </FormRow>
          </FormSection>

          <FormSection title="Observações">
            <Field label="Observações">
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }}
                value={editing.tra_obs || ''}
                onChange={e => set('tra_obs', e.target.value)}
                placeholder="Informações adicionais..." />
            </Field>
          </FormSection>
        </>
      }
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Cód</Th>
            <Th>Nome</Th>
            <Th>Cidade / UF</Th>
            <Th>Telefone</Th>
            <Th>Contato</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>Nenhuma transportadora encontrada.</td></tr>
          )}
          {filtered.map(row => (
            <TrHover key={row.tra_codigo} onClick={() => openEdit(row.tra_codigo)}>
              <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{String(row.tra_codigo).padStart(3, '0')}</span></Td>
              <Td><span style={{ fontWeight: 700 }}>{row.tra_nome}</span></Td>
              <Td>
                <span style={{ fontSize: 12, color: G.textSec }}>
                  {[row.tra_cidade, row.tra_uf].filter(Boolean).join(' / ') || '—'}
                </span>
              </Td>
              <Td><span style={{ fontSize: 12, color: G.textSec }}>{row.tra_fone || '—'}</span></Td>
              <Td><span style={{ fontSize: 12, color: G.textSec }}>{row.tra_contato || '—'}</span></Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(row.tra_codigo); }} style={actionBtn}><Pencil size={13} /></button>
                  <button onClick={e => remove(row.tra_codigo, e)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={13} /></button>
                </div>
              </Td>
            </TrHover>
          ))}
        </tbody>
      </CadastroTable>
    </CadastroShell>
  );
}
