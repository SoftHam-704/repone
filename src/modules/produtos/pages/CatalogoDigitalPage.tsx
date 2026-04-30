import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Package, Search, Pencil, Trash2, Plus } from 'lucide-react';
import {
  FormSection, FormRow, Field, G, inp, label as labelStyle,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CatalogProduct {
  pro_id: number;
  pro_codprod: string;
  pro_nome: string;
  pro_ncm: string | null;
  pro_peso: number | null;
  pro_embalagem: number | null;
  pro_grupo: number | null;
  pro_aplicacao: string | null;
  pro_codbarras: string | null;
  pro_status: boolean | null;
  pro_linhaleve: boolean | null;
  pro_linhapesada: boolean | null;
  pro_linhaagricola: boolean | null;
  pro_linhautilitarios: boolean | null;
  pro_motocicletas: boolean | null;
  pro_offroad: boolean | null;
  pro_linhaamarela: boolean | null;
  pro_codigonormalizado: string | null;
  pro_conversao: string | null;
  pro_codigooriginal: string | null;
}

interface ProductForm {
  pro_id?: number;
  codigo: string; codigoOriginal: string; codigoBarras: string;
  descricao: string; ncm: string; grupo: string;
  embalagem: string; peso: string; conversao: string; aplicacao: string;
  linhaleve: boolean; linhapesada: boolean; linhaagricola: boolean;
  linhautilitarios: boolean; motocicletas: boolean; offroad: boolean;
  linhaamarela: boolean;
}

interface SelectOption { value: string | number; label: string }

const emptyForm: ProductForm = {
  codigo: '', codigoOriginal: '', codigoBarras: '', descricao: '', ncm: '',
  grupo: '', embalagem: '', peso: '', conversao: '', aplicacao: '',
  linhaleve: false, linhapesada: false, linhaagricola: false,
  linhautilitarios: false, motocicletas: false, offroad: false,
  linhaamarela: false,
};

const sel: React.CSSProperties = {
  ...inp,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235E7282' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  paddingRight: 32, cursor: 'pointer',
};

// ─── Linha flags ──────────────────────────────────────────────────────────────
const LINE_COLS = [
  { key: 'pro_linhaleve'      as keyof CatalogProduct, label: 'LEVE',  color: '#059669' },
  { key: 'pro_linhapesada'    as keyof CatalogProduct, label: 'PESAD', color: '#1D4ED8' },
  { key: 'pro_linhaagricola'  as keyof CatalogProduct, label: 'AGRÍC', color: '#B45309' },
  { key: 'pro_linhautilitarios'as keyof CatalogProduct,label: 'UTIL',  color: '#7C3AED' },
  { key: 'pro_motocicletas'   as keyof CatalogProduct, label: 'MOTO',  color: '#DC2626' },
  { key: 'pro_offroad'        as keyof CatalogProduct, label: 'OFF',   color: '#374151' },
  { key: 'pro_linhaamarela'   as keyof CatalogProduct, label: 'AMAR',  color: '#CA8A04' },
];

const thBase: React.CSSProperties = {
  padding: '9px 10px', textAlign: 'left', fontWeight: 700,
  fontSize: 10, color: G.textMuted, textTransform: 'uppercase',
  letterSpacing: '0.08em', whiteSpace: 'nowrap', borderBottom: `1.5px solid ${G.border}`,
  background: G.bg, position: 'sticky', top: 0, zIndex: 2,
};
const tdBase: React.CSSProperties = {
  padding: '8px 10px', borderBottom: `1px solid ${G.border}`, fontSize: 13,
};

// ─── Industry Badge ───────────────────────────────────────────────────────────
function IndustriaBadge({
  value, options, onChange,
}: { value: string; options: SelectOption[]; onChange: (v: string) => void }) {
  const chosen = options.find(o => String(o.value) === value);
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          padding: '6px 30px 6px 12px',
          border: `1.5px solid ${chosen ? '#10B981' : G.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 800,
          color: chosen ? '#065F46' : G.textMuted,
          background: chosen ? '#ECFDF5' : G.card,
          cursor: 'pointer', outline: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235E7282' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
        }}
      >
        <option value="">Selecione a indústria...</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CatalogoDigitalPage() {
  const [industrias, setIndustrias] = useState<SelectOption[]>([]);
  const [grupos, setGrupos]         = useState<SelectOption[]>([]);
  const [data, setData]             = useState<CatalogProduct[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [view, setView]             = useState<'lista' | 'form'>('lista');
  const [editing, setEditing]       = useState<ProductForm>(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [selIndustria, setSelIndustria] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Aux
  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selIndustria) { setGrupos([]); return; }
    api.get(`/aux/grupos/${selIndustria}`).then(r => setGrupos(r.data.data || [])).catch(() => {});
  }, [selIndustria]);

  // Load catalog
  const load = useCallback(async () => {
    if (!selIndustria) { setData([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/products/catalog/${selIndustria}`);
      setData(res.data.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [selIndustria]);

  useEffect(() => { load(); }, [load]);

  // Filter
  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.pro_codprod?.toLowerCase().includes(q) ||
      r.pro_nome?.toLowerCase().includes(q) ||
      r.pro_aplicacao?.toLowerCase().includes(q) ||
      r.pro_codigonormalizado?.toLowerCase().includes(q) ||
      r.pro_conversao?.toLowerCase().includes(q)
    );
  });

  // CRUD
  const openNew = () => { setEditing(emptyForm); setView('form'); };

  const openEdit = async (row: CatalogProduct) => {
    try {
      const res = await api.get(`/products/detail/${row.pro_id}?tabela=`);
      const d = res.data.data;
      setEditing({
        pro_id: d.pro_id,
        codigo: d.pro_codprod || '', codigoOriginal: d.pro_codigooriginal || '',
        codigoBarras: d.pro_codbarras || '', descricao: d.pro_nome || '',
        ncm: d.pro_ncm || '', grupo: d.pro_grupo ? String(d.pro_grupo) : '',
        embalagem: d.pro_embalagem ? String(d.pro_embalagem) : '',
        peso: d.pro_peso ? String(d.pro_peso) : '',
        conversao: d.pro_conversao || '', aplicacao: d.pro_aplicacao || '',
        linhaleve: !!d.pro_linhaleve, linhapesada: !!d.pro_linhapesada,
        linhaagricola: !!d.pro_linhaagricola, linhautilitarios: !!d.pro_linhautilitarios,
        motocicletas: !!d.pro_motocicletas, offroad: !!d.pro_offroad,
        linhaamarela: !!d.pro_linhaamarela,
      });
      setView('form');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao carregar produto.');
    }
  };

  const cancel = () => { setView('lista'); setEditing(emptyForm); };

  const save = async () => {
    if (!editing.codigo.trim() || !editing.descricao.trim()) {
      toast.error('Código e Descrição são obrigatórios.');
      return;
    }
    if (!selIndustria) { toast.error('Selecione uma indústria.'); return; }
    setSaving(true);
    try {
      await api.post('/products/save', {
        industria: selIndustria,
        codigo: editing.codigo, codigoOriginal: editing.codigoOriginal,
        codigoBarras: editing.codigoBarras, descricao: editing.descricao,
        ncm: editing.ncm, grupo: editing.grupo || undefined,
        embalagem: editing.embalagem || undefined, peso: editing.peso || undefined,
        conversao: editing.conversao, aplicacao: editing.aplicacao,
        linhaleve: editing.linhaleve, linhapesada: editing.linhapesada,
        linhaagricola: editing.linhaagricola, linhautilitarios: editing.linhautilitarios,
        motocicletas: editing.motocicletas, offroad: editing.offroad,
        linhaamarela: editing.linhaamarela,
      });
      toast.success(editing.pro_id ? 'Produto atualizado.' : 'Produto cadastrado.');
      cancel(); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar produto.');
    } finally { setSaving(false); }
  };

  const remove = async (row: CatalogProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Excluir "${row.pro_nome}" do catálogo?`)) return;
    try {
      await api.delete(`/products/${row.pro_id}`);
      toast.success('Produto excluído.');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir produto.');
    }
  };

  const set = (field: keyof ProductForm, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (view === 'form') return (
    <div style={{ height: '100%', overflowY: 'auto', background: G.bg }}>
      {/* Form header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: G.card, borderBottom: `1px solid ${G.border}`,
        padding: '10px 20px', display: 'flex', alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: G.text, flex: 1 }}>
          {editing.pro_id ? `Editar — ${editing.codigo}` : 'Novo Produto'}
        </span>
        <button onClick={cancel} style={{
          padding: '7px 16px', borderRadius: 8, border: `1px solid ${G.border}`,
          background: 'transparent', fontSize: 13, fontWeight: 700,
          color: G.textSec, cursor: 'pointer',
        }}>
          Cancelar
        </button>
        <button onClick={save} disabled={saving} style={{
          padding: '7px 20px', borderRadius: 8, border: 'none',
          background: saving ? G.border : G.mustard, fontSize: 13,
          fontWeight: 800, color: G.text, cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
        <FormSection title="Identificação">
          <FormRow>
            <Field label="Código *">
              <input style={{ ...inp, fontFamily: 'monospace', fontWeight: 700 }}
                value={editing.codigo} onChange={e => set('codigo', e.target.value)}
                onKeyDown={onEnterTab} placeholder="Ex: 90123456" autoFocus />
            </Field>
            <Field label="Código Original">
              <input style={{ ...inp, fontFamily: 'monospace' }}
                value={editing.codigoOriginal} onChange={e => set('codigoOriginal', e.target.value)}
                onKeyDown={onEnterTab} placeholder="Cód. do fabricante" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Descrição *">
              <input style={inp} value={editing.descricao}
                onChange={e => set('descricao', e.target.value)}
                onKeyDown={onEnterTab} placeholder="Nome completo do produto" />
            </Field>
            <Field label="NCM">
              <input style={inp} value={editing.ncm}
                onChange={e => set('ncm', e.target.value)}
                onKeyDown={onEnterTab} placeholder="Ex: 8483.10.00" />
            </Field>
          </FormRow>
          <Field label="Código de Barras">
            <input style={{ ...inp, maxWidth: 240 }} value={editing.codigoBarras}
              onChange={e => set('codigoBarras', e.target.value)}
              onKeyDown={onEnterTab} placeholder="EAN-13" />
          </Field>
        </FormSection>

        <FormSection title="Características">
          <FormRow>
            <Field label="Grupo">
              <select style={sel} value={editing.grupo} onChange={e => set('grupo', e.target.value)}>
                <option value="">Nenhum</option>
                {grupos.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Embalagem (mult.)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={1} step={1}
                value={editing.embalagem} onChange={e => set('embalagem', e.target.value)}
                onKeyDown={onEnterTab} placeholder="1" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Peso (kg)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.001}
                value={editing.peso} onChange={e => set('peso', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0.000" />
            </Field>
            <div />
          </FormRow>
          <Field label="Conversão">
            <input style={inp} value={editing.conversao}
              onChange={e => set('conversao', e.target.value)}
              onKeyDown={onEnterTab} placeholder="Ex: 1 CX = 12 UN" />
          </Field>
          <Field label="Aplicação">
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 72 }}
              value={editing.aplicacao}
              onChange={e => set('aplicacao', e.target.value)}
              placeholder="Veículos / modelos compatíveis..." />
          </Field>
        </FormSection>

        <FormSection title="Linha de Produto">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {([
              ['linhaleve',      'Linha Leve'],
              ['linhapesada',    'Linha Pesada'],
              ['linhaagricola',  'Agrícola'],
              ['linhaamarela',   'Linha Amarela'],
              ['linhautilitarios','Utilitários'],
              ['motocicletas',   'Motos'],
              ['offroad',        'Off-Road'],
            ] as [keyof ProductForm, string][]).map(([key, lbl]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: G.textSec }}>
                <input type="checkbox" checked={!!editing[key]}
                  onChange={e => set(key, e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: G.mustard, cursor: 'pointer' }} />
                {lbl}
              </label>
            ))}
          </div>
        </FormSection>
      </div>
    </div>
  );

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: G.card, borderBottom: `1px solid ${G.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        {/* Industry badge */}
        <IndustriaBadge
          value={selIndustria}
          options={industrias}
          onChange={v => { setSelIndustria(v); setData([]); setSearch(''); }}
        />

        {/* Search */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: G.textMuted, pointerEvents: 'none',
          }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, descrição, aplicação..."
            disabled={!selIndustria}
            style={{
              ...inp, paddingLeft: 32, width: '100%',
              opacity: !selIndustria ? 0.5 : 1,
            }}
          />
        </div>

        {/* Atualizar */}
        <button onClick={load} disabled={!selIndustria || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${G.border}`,
            background: 'transparent', fontSize: 12, fontWeight: 700,
            color: G.textSec, cursor: selIndustria && !loading ? 'pointer' : 'not-allowed',
            opacity: !selIndustria ? 0.5 : 1,
          }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>

        {/* Count */}
        <span style={{ fontSize: 12, fontWeight: 700, color: G.textMuted, whiteSpace: 'nowrap', paddingLeft: 6, borderLeft: `1px solid ${G.border}` }}>
          {filtered.length.toLocaleString('pt-BR')} produto{filtered.length !== 1 ? 's' : ''}
          {search && data.length > 0 && <span style={{ color: G.mustard, fontWeight: 800 }}> (filtrado)</span>}
        </span>

        {/* Novo */}
        <button onClick={openNew} disabled={!selIndustria}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: selIndustria ? G.mustard : G.border,
            fontSize: 12, fontWeight: 800, color: G.text,
            cursor: selIndustria ? 'pointer' : 'not-allowed',
          }}>
          <Plus size={13} /> Novo Produto
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {!selIndustria ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12, color: G.textMuted }}>
            <Package size={44} strokeWidth={1.2} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Selecione uma indústria para visualizar o catálogo.</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: 130 }}>Código</th>
                <th style={{ ...thBase }}>Descrição</th>
                <th style={{ ...thBase, width: 160 }}>Conversão</th>
                <th style={{ ...thBase, width: 70, textAlign: 'right' }}>Peso</th>
                <th style={{ ...thBase, width: 50, textAlign: 'center' }}>EMB</th>
                <th style={{ ...thBase, width: 46, textAlign: 'center' }}>GRP</th>
                {LINE_COLS.map(c => (
                  <th key={c.key} style={{ ...thBase, width: 46, textAlign: 'center', color: c.color }}>
                    {c.label}
                  </th>
                ))}
                <th style={{ ...thBase, width: 28, textAlign: 'center' }}>ST</th>
                <th style={{ ...thBase, width: 72, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={13} style={{ ...tdBase, textAlign: 'center', color: G.textMuted, padding: '40px 0' }}>
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ ...tdBase, textAlign: 'center', color: G.textMuted, padding: '40px 0' }}>
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
              {!loading && filtered.map((row, idx) => (
                <tr
                  key={row.pro_id}
                  style={{ background: idx % 2 === 0 ? G.card : G.bg, cursor: 'pointer', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? G.card : G.bg)}
                  onClick={() => openEdit(row)}
                >
                  {/* Código */}
                  <td style={tdBase}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: '#1D4ED8' }}>
                      {row.pro_codprod}
                    </span>
                  </td>

                  {/* Descrição + aplicação */}
                  <td style={tdBase}>
                    <div style={{ fontWeight: 600 }}>{row.pro_nome}</div>
                    {row.pro_aplicacao && (
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 1, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.pro_aplicacao}
                      </div>
                    )}
                  </td>

                  {/* Conversão */}
                  <td style={{ ...tdBase, color: G.textSec, fontSize: 12 }}>
                    {row.pro_conversao || ''}
                  </td>

                  {/* Peso */}
                  <td style={{ ...tdBase, textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: G.textSec }}>
                    {row.pro_peso ? `${row.pro_peso}` : ''}
                  </td>

                  {/* Embalagem */}
                  <td style={{ ...tdBase, textAlign: 'center', color: G.textSec, fontSize: 12 }}>
                    {row.pro_embalagem || 1}
                  </td>

                  {/* Grupo */}
                  <td style={{ ...tdBase, textAlign: 'center', color: G.textMuted, fontSize: 12 }}>
                    {row.pro_grupo || ''}
                  </td>

                  {/* Line flags — individual columns */}
                  {LINE_COLS.map(c => (
                    <td key={c.key} style={{ ...tdBase, textAlign: 'center' }}>
                      {row[c.key] && (
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: c.color, margin: '0 auto',
                        }} />
                      )}
                    </td>
                  ))}

                  {/* Status dot */}
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', margin: '0 auto',
                      background: row.pro_status !== false ? '#16A34A' : '#EF4444',
                    }} />
                  </td>

                  {/* Ações */}
                  <td style={{ ...tdBase, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => openEdit(row)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          border: `1px solid ${G.border}`, background: 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: G.textSec,
                        }}
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={e => remove(row, e)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          border: `1px solid ${G.border}`, background: 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: G.danger,
                        }}
                        title="Excluir"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
