import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Package, RefreshCw, ChevronDown, X, Calculator, Upload, Wand2, SquarePen } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, FormRow, Field, G, inp, label as labelStyle,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductRow {
  itab_idprod: number;
  pro_id: number;
  pro_codprod: string;
  pro_nome: string;
  pro_grupo: number | null;
  pro_embalagem: number | null;
  pro_peso: number | null;
  pro_codigonormalizado: string | null;
  pro_conversao: string | null;
  itab_precobruto: number | null;
  itab_precopromo: number | null;
  itab_precoespecial: number | null;
  itab_ipi: number | null;
  itab_st: number | null;
  itab_descontoadd: number | null;
  itab_grupodesconto: number | null;
  itab_prepeso: number | null;
  itab_tabela: string;
  itab_datatabela: string | null;
  itab_status: boolean | null;
}

interface ProductForm {
  pro_id?: number;
  codigo: string; codigoOriginal: string; codigoBarras: string;
  descricao: string; ncm: string; grupo: string;
  embalagem: string; peso: string; conversao: string; aplicacao: string;
  linhaleve: boolean; linhapesada: boolean; linhaagricola: boolean;
  linhautilitarios: boolean; motocicletas: boolean; offroad: boolean;
  linhaamarela: boolean;
  precobruto: string; precopromo: string; precoespecial: string;
  ipi: string; st: string; descontoadd: string; grupodesconto: string;
  prepeso: string; replicate: boolean;
}

interface SelectOption { value: string | number; label: string; }

const emptyForm: ProductForm = {
  codigo: '', codigoOriginal: '', codigoBarras: '', descricao: '', ncm: '',
  grupo: '', embalagem: '', peso: '', conversao: '', aplicacao: '',
  linhaleve: false, linhapesada: false, linhaagricola: false,
  linhautilitarios: false, motocicletas: false, offroad: false,
  linhaamarela: false,
  precobruto: '', precopromo: '', precoespecial: '',
  ipi: '', st: '', descontoadd: '', grupodesconto: '', prepeso: '',
  replicate: false,
};

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

const sel: React.CSSProperties = {
  ...inp,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235E7282' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  paddingRight: 32, cursor: 'pointer',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBR(v: number | null | undefined, decimals = 2): string {
  if (v == null || v === 0) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number | null | undefined): string {
  if (!v) return '—';
  return `${Number(v).toFixed(2)}%`;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return v; }
}

// Cálculo do Preço Líquido: promo tem prioridade, depois aplica descontos em cascata sobre o bruto
function calcNetPrice(row: ProductRow, discounts: string[]): number | null {
  const promo    = Number(row.itab_precopromo)   || 0;
  const bruto    = Number(row.itab_precobruto)   || 0;
  const especial = Number(row.itab_precoespecial) || 0;

  if (promo > 0) return promo; // promo já é líquido, não recebe desconto

  let base = bruto > 0 ? bruto : especial;
  if (base <= 0) return null;

  for (const d of discounts) {
    const val = parseFloat(d.replace(',', '.'));
    if (!isNaN(val) && val > 0) base *= (1 - val / 100);
  }
  return base;
}

// ─── Dropdown Ações da Tabela ────────────────────────────────────────────────
function AcoesTabela({
  onDelete, onUpdateIpi, onUpdateSt, onExportExcel,
}: { onDelete: () => void; onUpdateIpi: () => void; onUpdateSt: () => void; onExportExcel: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const item = (label: string, action: () => void, danger = false) => (
    <button
      onClick={() => { setOpen(false); action(); }}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 16px', border: 'none', background: 'transparent',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        color: danger ? G.danger : G.text,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = G.cardHi; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${G.border}`, background: 'transparent',
          fontSize: 13, fontWeight: 700, color: G.textSec,
        }}
      >
        Ações da Tabela <ChevronDown size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
          background: G.card, border: `1px solid ${G.border}`,
          borderRadius: 10, boxShadow: '0 8px 24px rgba(40,55,74,0.12)',
          minWidth: 240, overflow: 'hidden',
        }}>
          {item('Exportar para Excel', onExportExcel)}
          <div style={{ height: 1, background: G.border, margin: '4px 0' }} />
          {item('Atualizar percentual de IPI', onUpdateIpi)}
          {item('Atualizar percentual de ST', onUpdateSt)}
          <div style={{ height: 1, background: G.border, margin: '4px 0' }} />
          {item('Excluir tabela de preço', onDelete, true)}
        </div>
      )}
    </div>
  );
}

// ─── Modal genérico de percentual ────────────────────────────────────────────
function PctModal({
  title, onConfirm, onClose,
}: { title: string; onConfirm: (v: number) => void; onClose: () => void }) {
  const [val, setVal] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(40,55,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: G.card, borderRadius: 16, padding: 28, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: G.text, margin: '0 0 16px' }}>{title}</h2>
        <input
          style={{ ...inp, textAlign: 'right' }}
          type="number" min={0} max={100} step={0.01}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="0.00"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(parseFloat(val.replace(',', '.')) || 0); if (e.key === 'Escape') onClose(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ ...actionBtn, width: 'auto', padding: '8px 16px', height: 'auto', fontSize: 13, fontWeight: 700, color: G.textSec }}>Cancelar</button>
          <button onClick={() => onConfirm(parseFloat(val.replace(',', '.')) || 0)} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none',
            background: G.mustard, color: G.text, fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProdutosPage() {
  const navigate = useNavigate();
  const [industrias, setIndustrias]   = useState<SelectOption[]>([]);
  const [tabelas, setTabelas]         = useState<SelectOption[]>([]);
  const [grupos, setGrupos]           = useState<SelectOption[]>([]);
  const [grupoDesc, setGrupoDesc]     = useState<SelectOption[]>([]);
  const [data, setData]               = useState<ProductRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [activeTab, setActiveTab]     = useState<'lista' | 'cadastro'>('lista');
  const [editing, setEditing]         = useState<ProductForm>(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [selIndustria, setSelIndustria] = useState('');
  const [selTabela, setSelTabela]       = useState('');

  // 8-level discount calculator
  const [discounts, setDiscounts] = useState<string[]>(Array(8).fill(''));
  const isSimulating = discounts.some(d => parseFloat(d.replace(',', '.')) > 0);

  // Modal state
  const [pctModal, setPctModal] = useState<null | 'ipi' | 'st'>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameVal, setRenameVal] = useState('');

  // Load aux data once
  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || [])).catch(() => {});
    api.get('/aux/grupo-desc').then(r => setGrupoDesc(r.data.data || [])).catch(() => {});
  }, []);

  // Load tables when industry changes
  useEffect(() => {
    setTabelas([]); setSelTabela(''); setData([]);
    if (!selIndustria) return;
    api.get(`/products/tables/${selIndustria}`)
      .then(r => {
        const rows = r.data.data || [];
        const opts = rows.map((row: any) => ({
          value: row.nome_tabela ?? row.itab_tabela ?? '',
          label: row.nome_tabela ?? row.itab_tabela ?? '',
        }));
        setTabelas(opts);
        if (opts.length === 1) setSelTabela(String(opts[0].value));
      }).catch(() => {});
    api.get(`/aux/grupos/${selIndustria}`)
      .then(r => setGrupos(r.data.data || [])).catch(() => {});
  }, [selIndustria]);

  const load = useCallback(async () => {
    if (!selIndustria || !selTabela) { setData([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/products/${selIndustria}?tabela=${encodeURIComponent(selTabela)}`);
      setData(res.data.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [selIndustria, selTabela]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.pro_codprod?.toLowerCase().includes(q) ||
      r.pro_nome?.toLowerCase().includes(q) ||
      r.pro_codigonormalizado?.toLowerCase().includes(q) ||
      r.pro_conversao?.toLowerCase().includes(q)
    );
  });

  const openNew = () => { setEditing(emptyForm); setActiveTab('cadastro'); };

  const openEdit = async (row: ProductRow) => {
    try {
      const res = await api.get(`/products/detail/${row.pro_id}?tabela=${encodeURIComponent(selTabela)}`);
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
        precobruto: d.itab_precobruto != null ? String(d.itab_precobruto) : '',
        precopromo: d.itab_precopromo != null ? String(d.itab_precopromo) : '',
        precoespecial: d.itab_precoespecial != null ? String(d.itab_precoespecial) : '',
        ipi: d.itab_ipi != null ? String(d.itab_ipi) : '',
        st: d.itab_st != null ? String(d.itab_st) : '',
        descontoadd: d.itab_descontoadd != null ? String(d.itab_descontoadd) : '',
        grupodesconto: d.itab_grupodesconto ? String(d.itab_grupodesconto) : '',
        prepeso: d.itab_prepeso != null ? String(d.itab_prepeso) : '',
        replicate: false,
      });
      setActiveTab('cadastro');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao carregar produto.');
    }
  };

  const cancel = () => { setActiveTab('lista'); setEditing(emptyForm); };

  const save = async () => {
    if (!editing.codigo.trim() || !editing.descricao.trim()) { alert('Código e Descrição são obrigatórios.'); return; }
    if (!selIndustria) { alert('Selecione uma indústria.'); return; }
    setSaving(true);
    try {
      await api.post('/products/save', {
        industria: selIndustria, tabela: selTabela || undefined,
        codigo: editing.codigo, codigoOriginal: editing.codigoOriginal,
        codigoBarras: editing.codigoBarras, descricao: editing.descricao,
        ncm: editing.ncm, grupo: editing.grupo || undefined,
        embalagem: editing.embalagem || undefined, peso: editing.peso || undefined,
        conversao: editing.conversao, aplicacao: editing.aplicacao,
        linhaleve: editing.linhaleve, linhapesada: editing.linhapesada,
        linhaagricola: editing.linhaagricola, linhautilitarios: editing.linhautilitarios,
        motocicletas: editing.motocicletas, offroad: editing.offroad,
        linhaamarela: editing.linhaamarela,
        precobruto: editing.precobruto || undefined, precopromo: editing.precopromo || undefined,
        precoespecial: editing.precoespecial || undefined,
        ipi: editing.ipi || undefined, st: editing.st || undefined,
        descontoadd: editing.descontoadd || undefined,
        grupodesconto: editing.grupodesconto || undefined,
        prepeso: editing.prepeso || undefined, replicate: editing.replicate,
      });
      cancel(); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar produto.');
    } finally { setSaving(false); }
  };

  const remove = async (row: ProductRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover "${row.pro_nome}" da tabela "${selTabela}"?`)) return;
    try {
      await api.delete(
        `/price-tables/product/${selIndustria}/${row.pro_id}?tabela=${encodeURIComponent(selTabela)}`
      );
      load();
    }
    catch (err: any) { alert(err?.response?.data?.message || 'Erro ao remover produto da tabela.'); }
  };

  const deleteTable = async () => {
    if (!selTabela || !confirm(`Excluir toda a tabela "${selTabela}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/price-tables/${selIndustria}?tabela=${encodeURIComponent(selTabela)}`);
      setSelTabela(''); setData([]);
      const r = await api.get(`/products/tables/${selIndustria}`);
      const rows = r.data.data || [];
      setTabelas(rows.map((row: any) => ({ value: row.nome_tabela, label: row.nome_tabela })));
    } catch (err: any) { alert(err?.response?.data?.message || 'Erro ao excluir tabela.'); }
  };

  const openRename = () => { setRenameVal(selTabela); setRenameModal(true); };

  const renameTable = async () => {
    const novoNome = renameVal.trim();
    if (!novoNome || novoNome === selTabela) { setRenameModal(false); return; }
    try {
      await api.put(`/price-tables/rename/${selIndustria}?tabela=${encodeURIComponent(selTabela)}`, { novoNome });
      setSelTabela(novoNome);
      setRenameModal(false);
      const r = await api.get(`/products/tables/${selIndustria}`);
      setTabelas((r.data.data || []).map((row: any) => ({ value: row.nome_tabela, label: row.nome_tabela })));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao renomear tabela.');
    }
  };

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      'Código':         r.pro_codprod,
      'Cód. Original':  r.pro_codigonormalizado || '',
      'Produto':        r.pro_nome,
      'Embalagem':      r.pro_embalagem ?? '',
      'Peso':           r.pro_peso ?? '',
      'IPI (%)':        r.itab_ipi ?? 0,
      'ST (%)':         r.itab_st  ?? 0,
      'Preço Bruto':    r.itab_precobruto   ?? 0,
      'Preço Promo':    r.itab_precopromo   ?? 0,
      'Preço Especial': r.itab_precoespecial ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 50 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Preços');
    XLSX.writeFile(wb, `tabela-${selTabela}-${selIndustria}.xlsx`);
  };

  const applyIpi = async (pct: number) => {
    try {
      await api.put(`/price-tables/update-ipi/${selIndustria}?tabela=${encodeURIComponent(selTabela)}`, { percentage: pct });
      setPctModal(null); load();
    } catch (err: any) { alert(err?.response?.data?.message || 'Erro ao atualizar IPI.'); }
  };

  const applySt = async (pct: number) => {
    try {
      await api.put(`/price-tables/update-st/${selIndustria}?tabela=${encodeURIComponent(selTabela)}`, { percentage: pct });
      setPctModal(null); load();
    } catch (err: any) { alert(err?.response?.data?.message || 'Erro ao atualizar ST.'); }
  };

  const set = (field: keyof ProductForm, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  const setDiscount = (idx: number, val: string) =>
    setDiscounts(prev => { const n = [...prev]; n[idx] = val; return n; });

  const clearDiscounts = () => setDiscounts(Array(8).fill(''));

  const formTitle = editing.pro_id ? `Editar — ${editing.codigo}` : 'Novo Produto';

  // ── Toolbar selectors ──────────────────────────────────────────────────────
  const toolbar = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div>
        <span style={{ ...labelStyle, display: 'block', marginBottom: 3 }}>Indústria</span>
        <select style={{ ...sel, width: 190, fontSize: 12 }} value={selIndustria} onChange={e => setSelIndustria(e.target.value)}>
          <option value="">Selecione...</option>
          {industrias.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </div>
      <div>
        <span style={{ ...labelStyle, display: 'block', marginBottom: 3 }}>Tabela de Preço</span>
        <select style={{ ...sel, width: 190, fontSize: 12 }} value={selTabela} onChange={e => setSelTabela(e.target.value)} disabled={!selIndustria}>
          <option value="">Selecione...</option>
          {tabelas.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
    </div>
  );

  // ── Discount Calculator Bar ────────────────────────────────────────────────
  const calcBar = selTabela && filtered.length > 0 && (
    <div style={{
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
      padding: '10px 16px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
        <Calculator size={15} style={{ color: G.mustard }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Calculadora
        </span>
      </div>
      {discounts.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {i + 1}º DESC
          </span>
          <input
            type="text" inputMode="decimal"
            value={d}
            onChange={e => setDiscount(i, e.target.value)}
            onKeyDown={onEnterTab}
            placeholder="0"
            style={{
              ...inp, width: 64, textAlign: 'center', padding: '5px 4px', fontSize: 12,
              border: `1px solid ${d ? G.mustard : G.border}`,
              fontWeight: d ? 800 : 600,
            }}
          />
        </div>
      ))}
      {isSimulating && (
        <button onClick={clearDiscounts} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 8, border: `1px solid ${G.border}`,
          background: 'transparent', fontSize: 11, fontWeight: 700, color: G.textMuted,
          cursor: 'pointer', marginLeft: 4,
        }}>
          <X size={11} /> Limpar
        </button>
      )}
    </div>
  );

  // ── Barra de importação — sempre visível ────────────────────────────────────
  const importBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 10 }}>
      <button
        onClick={() => navigate('/utilitarios/importacao-precos')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${G.border}`, background: 'transparent',
          fontSize: 13, fontWeight: 700, color: G.textSec,
        }}
      >
        <Upload size={14} /> Importar Tabela
      </button>
      <button
        onClick={() => navigate('/utilitarios/importacao-precos?tab=magic')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
          border: 'none', background: '#1D1D1D',
          fontSize: 13, fontWeight: 800, color: '#FFD200',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}
      >
        <Wand2 size={14} /> MAGIC IMPORT
      </button>
    </div>
  );

  // ── Barra de ações da tabela — só quando há tabela selecionada ──────────────
  const actionsBar = selTabela && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <button onClick={load} style={{ ...actionBtn, width: 'auto', padding: '7px 14px', height: 'auto', gap: 5, fontSize: 12, fontWeight: 700 }}>
        <RefreshCw size={13} /> Atualizar
      </button>
      <button onClick={openRename} style={{ ...actionBtn, width: 'auto', padding: '7px 14px', height: 'auto', gap: 5, fontSize: 12, fontWeight: 700 }}>
        <SquarePen size={13} /> Renomear
      </button>
      <AcoesTabela
        onDelete={deleteTable}
        onUpdateIpi={() => setPctModal('ipi')}
        onUpdateSt={() => setPctModal('st')}
        onExportExcel={exportExcel}
      />
      <span style={{ fontSize: 12, color: G.textMuted, fontWeight: 600 }}>
        {filtered.length.toLocaleString('pt-BR')} produto(s)
      </span>
    </div>
  );

  // ── Form ───────────────────────────────────────────────────────────────────
  const form = (
    <>
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
            <input style={inp} value={editing.descricao} onChange={e => set('descricao', e.target.value)}
              onKeyDown={onEnterTab} placeholder="Nome completo do produto" />
          </Field>
          <Field label="NCM">
            <input style={inp} value={editing.ncm} onChange={e => set('ncm', e.target.value)}
              onKeyDown={onEnterTab} placeholder="Ex: 8483.10.00" />
          </Field>
        </FormRow>
        <Field label="Código de Barras">
          <input style={{ ...inp, maxWidth: 240 }} value={editing.codigoBarras}
            onChange={e => set('codigoBarras', e.target.value)} onKeyDown={onEnterTab} placeholder="EAN-13" />
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
          <input style={inp} value={editing.conversao} onChange={e => set('conversao', e.target.value)}
            onKeyDown={onEnterTab} placeholder="Ex: 1 CX = 12 UN" />
        </Field>
        <Field label="Aplicação">
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }}
            value={editing.aplicacao} onChange={e => set('aplicacao', e.target.value)}
            placeholder="Veículos compatíveis..." />
        </Field>
      </FormSection>

      <FormSection title="Linha de Produto">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {([
            ['linhaleve', 'Linha Leve'], ['linhapesada', 'Linha Pesada'],
            ['linhaagricola', 'Agrícola'], ['linhaamarela', 'Linha Amarela'],
            ['linhautilitarios', 'Utilitários'],
            ['motocicletas', 'Motos'], ['offroad', 'Off-Road'],
          ] as [keyof ProductForm, string][]).map(([key, lbl]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: G.textSec }}>
              <input type="checkbox" checked={!!editing[key]} onChange={e => set(key, e.target.checked)}
                style={{ width: 15, height: 15, accentColor: G.mustard, cursor: 'pointer' }} />
              {lbl}
            </label>
          ))}
        </div>
      </FormSection>

      {selTabela && (
        <FormSection title={`Tabela de Preços — ${selTabela}`}>
          <FormRow>
            <Field label="Preço Bruto (R$)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.precobruto} onChange={e => set('precobruto', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
            <Field label="Preço Promo (R$)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.precopromo} onChange={e => set('precopromo', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Preço Especial (R$)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.precoespecial} onChange={e => set('precoespecial', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
            <Field label="Preço/Peso (R$/kg)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.prepeso} onChange={e => set('prepeso', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="IPI (%)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.ipi} onChange={e => set('ipi', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
            <Field label="ST (%)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.st} onChange={e => set('st', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Desconto ADD (%)">
              <input style={{ ...inp, textAlign: 'right' }} type="number" min={0} step={0.01}
                value={editing.descontoadd} onChange={e => set('descontoadd', e.target.value)}
                onKeyDown={onEnterTab} placeholder="0,00" />
            </Field>
            <Field label="Grupo de Desconto">
              <select style={sel} value={editing.grupodesconto} onChange={e => set('grupodesconto', e.target.value)}>
                <option value="">Nenhum</option>
                {grupoDesc.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
          </FormRow>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={editing.replicate} onChange={e => set('replicate', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: G.mustard, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: G.textSec }}>
              Replicar preço para todas as tabelas desta indústria
            </span>
          </label>
        </FormSection>
      )}
    </>
  );

  return (
    <>
      <CadastroShell
        title="Produtos"
        total={filtered.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Pesquisar código ou descrição..."
        onNew={openNew}
        newLabel="Novo Produto"
        loading={loading}
        toolbar={toolbar}
        activeTab={activeTab}
        formTitle={formTitle}
        onSave={save}
        onCancel={cancel}
        saving={saving}
        form={form}
      >
        {importBar}

        {!selIndustria || !selTabela ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: G.textMuted }}>
            <Package size={40} strokeWidth={1.2} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {!selIndustria ? 'Selecione uma indústria para visualizar os produtos.' : 'Selecione uma tabela de preço.'}
            </span>
          </div>
        ) : (
          <>
            {calcBar}
            {actionsBar}
            <CadastroTable>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Código</Th>
                  <Th>Produto</Th>
                  <Th align="right">Preço Bruto</Th>
                  <Th align="right">Promo</Th>
                  <Th align="right">Especial</Th>
                  <Th align="right">Preço Líquido</Th>
                  <Th align="center">Embal.</Th>
                  <Th align="right">IPI %</Th>
                  <Th align="right">ST %</Th>
                  <Th>Cód. Normaliz.</Th>
                  <Th align="center">Data</Th>
                  <Th align="center">Status</Th>
                  <Th align="center">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                      Nenhum produto encontrado nesta tabela.
                    </td>
                  </tr>
                )}
                {filtered.map(row => {
                  const netPrice = calcNetPrice(row, discounts);
                  const isPromo = (Number(row.itab_precopromo) || 0) > 0;
                  const netColor = isSimulating && !isPromo ? '#1D4ED8' : '#7C3AED';

                  return (
                    <TrHover key={`${row.pro_id}-${row.itab_tabela}`} onClick={() => openEdit(row)}>
                      <Td>
                        <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>{row.itab_idprod || row.pro_id}</span>
                      </Td>
                      <Td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#1D4ED8' }}>
                          {row.pro_codprod}
                        </span>
                      </Td>
                      <Td><span style={{ fontWeight: 600 }}>{row.pro_nome}</span></Td>
                      <Td align="right">
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                          {row.itab_precobruto ? `R$ ${fmtBR(row.itab_precobruto)}` : '—'}
                        </span>
                      </Td>
                      <Td align="right">
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#1D4ED8' }}>
                          {row.itab_precopromo ? `R$ ${fmtBR(row.itab_precopromo)}` : <span style={{ color: G.textMuted }}>R$ 0,00</span>}
                        </span>
                      </Td>
                      <Td align="right">
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: G.success }}>
                          {row.itab_precoespecial ? `R$ ${fmtBR(row.itab_precoespecial)}` : <span style={{ color: G.textMuted }}>R$ 0,00</span>}
                        </span>
                      </Td>
                      <Td align="right">
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 800,
                          color: netPrice != null ? netColor : G.textMuted,
                          background: netPrice != null ? (isSimulating && !isPromo ? '#EFF6FF' : '#F3E8FF') : 'transparent',
                          padding: netPrice != null ? '2px 6px' : '0',
                          borderRadius: 4,
                        }}>
                          {netPrice != null ? `R$ ${fmtBR(netPrice)}` : '—'}
                        </span>
                      </Td>
                      <Td align="center">
                        <span style={{ fontSize: 12, color: G.textSec }}>{row.pro_embalagem || '—'}</span>
                      </Td>
                      <Td align="right">
                        <span style={{ fontSize: 12, color: G.textSec }}>{fmtPct(row.itab_ipi)}</span>
                      </Td>
                      <Td align="right">
                        <span style={{ fontSize: 12, color: G.textSec }}>{fmtPct(row.itab_st)}</span>
                      </Td>
                      <Td>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: G.textMuted }}>
                          {row.pro_codigonormalizado || '—'}
                        </span>
                      </Td>
                      <Td align="center">
                        <span style={{ fontSize: 11, color: G.textMuted }}>{fmtDate(row.itab_datatabela)}</span>
                      </Td>
                      <Td align="center">
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
                          background: row.itab_status !== false ? '#16A34A18' : '#C0392B18',
                          color: row.itab_status !== false ? G.success : G.danger,
                          border: `1px solid ${row.itab_status !== false ? '#16A34A33' : '#C0392B33'}`,
                        }}>
                          {row.itab_status === false ? 'INATIVO' : 'ATIVO'}
                        </span>
                      </Td>
                      <Td align="center">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={e => { e.stopPropagation(); openEdit(row); }} style={actionBtn}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={e => remove(row, e)} style={{ ...actionBtn, color: G.danger }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </Td>
                    </TrHover>
                  );
                })}
              </tbody>
            </CadastroTable>
          </>
        )}
      </CadastroShell>

      {renameModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(40,55,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setRenameModal(false); }}>
          <div style={{ background: G.card, borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: G.text, margin: '0 0 6px' }}>Renomear Tabela</h2>
            <p style={{ fontSize: 12, color: G.textMuted, margin: '0 0 16px' }}>O nome será atualizado em todos os produtos desta tabela.</p>
            <input
              style={inp}
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') renameTable(); if (e.key === 'Escape') setRenameModal(false); }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setRenameModal(false)} style={{ ...actionBtn, width: 'auto', padding: '8px 16px', height: 'auto', fontSize: 13, fontWeight: 700, color: G.textSec }}>Cancelar</button>
              <button onClick={renameTable} disabled={!renameVal.trim() || renameVal.trim() === selTabela}
                style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none',
                  background: G.mustard, color: G.text, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  opacity: !renameVal.trim() || renameVal.trim() === selTabela ? 0.5 : 1,
                }}>
                Renomear
              </button>
            </div>
          </div>
        </div>
      )}

      {pctModal === 'ipi' && (
        <PctModal title="Atualizar IPI para todos os produtos" onConfirm={applyIpi} onClose={() => setPctModal(null)} />
      )}
      {pctModal === 'st' && (
        <PctModal title="Atualizar ST para todos os produtos" onConfirm={applySt} onClose={() => setPctModal(null)} />
      )}
    </>
  );
}
