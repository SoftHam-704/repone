import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, Users, Building2, AlertTriangle, Plus, Search,
  Download, Upload, Trash2, Edit2, X, CheckCircle2, RefreshCw,
  BarChart2, FileSpreadsheet, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';
import { G } from '@/shared/components/layout/CadastroShell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SellOutRecord {
  id: number;
  cli_codigo: number;
  for_codigo: number;
  periodo: string;
  valor: number;
  quantidade: number;
  criado_em: string;
  cli_nome: string;
  cli_fantasia: string;
  cli_nomred: string;
  industria_nome: string;
  industria_nomered: string;
}

interface SellOutStats {
  total_valor: number;
  total_clientes: number;
  total_industrias: number;
  pendencias: number;
  crescimento: number | null;
}

interface TrendPoint {
  periodo: string;
  total_valor: number;
  total_quantidade: number;
  total_clientes: number;
  total_industrias: number;
}

interface RankingItem {
  id: number;
  nome: string;
  total_valor: number;
  total_quantidade: number;
  total_clientes?: number;
  total_industrias?: number;
}

interface Pendency {
  cli_codigo: number;
  for_codigo: number;
  cli_nomred: string;
  cli_fantasia: string;
  industria_nome: string;
  industria_nomered: string;
  valor_anterior: number;
  quantidade_anterior: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}
function fmtShort(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function parsePeriodoLabel(p: string) {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const m = p.match(/^(\d{4})-(\d{2})/);
  if (!m) return p;
  return `${months[parseInt(m[2]) - 1]}/${m[1].slice(2)}`;
}

function currentPeriodStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── InlineSearch ─────────────────────────────────────────────────────────────

interface InlineSearchProps {
  endpoint: string;
  labelField: string;
  idField: string;
  placeholder: string;
  value: { id: number; label: string } | null;
  onChange: (v: { id: number; label: string } | null) => void;
}

function InlineSearch({ endpoint, labelField, idField, placeholder, value, onChange }: InlineSearchProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(endpoint, { params: { search: q, limit: 20 } });
        setOptions(res.data.data || res.data);
      } catch { setOptions([]); }
      finally { setLoading(false); }
    }, 300);
  }, [q, open, endpoint]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px',
          background: '#fff', minWidth: 200, fontSize: 13,
        }}
      >
        <span style={{ flex: 1, color: value ? '#1a1a1a' : '#999' }}>
          {value ? value.label : placeholder}
        </span>
        {value
          ? <X size={13} style={{ color: '#666' }} onClick={(e) => { e.stopPropagation(); onChange(null); setQ(''); }} />
          : <ChevronDown size={13} style={{ color: '#888' }} />
        }
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 999,
          background: '#fff', border: '1px solid #ddd', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: 280, marginTop: 4,
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar..."
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13 }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {loading && <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#888' }}>Buscando...</div>}
            {!loading && options.length === 0 && <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#aaa' }}>Nenhum resultado</div>}
            {options.map(opt => (
              <div
                key={opt[idField]}
                onClick={() => { onChange({ id: opt[idField], label: opt[labelField] || opt.cli_nomred || opt.for_nomered }); setOpen(false); setQ(''); }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f5f5f5' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f5f0')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {opt[labelField] || opt.cli_nomred || opt.for_nomered}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SellOut Modal (Create / Edit) ────────────────────────────────────────────

interface ModalProps {
  record: Partial<SellOutRecord> | null;
  onClose: () => void;
  onSaved: () => void;
}

function SellOutModal({ record, onClose, onSaved }: ModalProps) {
  const isEdit = !!record?.id;

  const [client, setClient] = useState<{ id: number; label: string } | null>(
    record?.cli_codigo ? { id: record.cli_codigo, label: record.cli_nomred || record.cli_fantasia || String(record.cli_codigo) } : null
  );
  const [industry, setIndustry] = useState<{ id: number; label: string } | null>(
    record?.for_codigo ? { id: record.for_codigo, label: record.industria_nomered || record.industria_nome || String(record.for_codigo) } : null
  );
  const [periodo, setPeriodo] = useState(record?.periodo?.slice(0, 7) || currentPeriodStr().slice(0, 7));
  const [valor, setValor] = useState(record?.valor != null ? String(record.valor) : '');
  const [quantidade, setQuantidade] = useState(record?.quantidade != null ? String(record.quantidade) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!isEdit && (!client || !industry)) {
      toast.error('Selecione cliente e indústria.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/sellout/${record!.id}`, { valor: parseFloat(valor) || 0, quantidade: parseFloat(quantidade) || 0 });
      } else {
        await api.post('/sellout', {
          cli_codigo: client!.id,
          for_codigo: industry!.id,
          periodo: `${periodo}-01`,
          valor: parseFloat(valor) || 0,
          quantidade: parseFloat(quantidade) || 0,
        });
      }
      toast.success(isEdit ? 'Registro atualizado!' : 'Sell-Out registrado!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#28374A' }}>
            {isEdit ? 'Editar Sell-Out' : 'Novo Registro de Sell-Out'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>CLIENTE *</label>
                <InlineSearch
                  endpoint="/clients"
                  labelField="cli_nomred"
                  idField="cli_codigo"
                  placeholder="Selecionar cliente..."
                  value={client}
                  onChange={setClient}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>INDÚSTRIA *</label>
                <InlineSearch
                  endpoint="/suppliers"
                  labelField="for_nomered"
                  idField="for_codigo"
                  placeholder="Selecionar indústria..."
                  value={industry}
                  onChange={setIndustry}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>PERÍODO *</label>
                <input
                  type="month"
                  value={periodo}
                  onChange={e => setPeriodo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>VALOR (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' }}>QUANTIDADE</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="0"
                style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #ccc',
            background: '#fff', cursor: 'pointer', fontSize: 13,
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 22px', borderRadius: 8, border: 'none',
            background: '#28374A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SellOutPage() {
  const [activeTab, setActiveTab] = useState<'registros' | 'pendencias'>('registros');
  const [stats, setStats] = useState<SellOutStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [rankingBy, setRankingBy] = useState<'client' | 'industry'>('client');
  const [records, setRecords] = useState<SellOutRecord[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPeriodo, setSelectedPeriodo] = useState(currentPeriodStr().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState<Partial<SellOutRecord> | null | false>(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Load stats + trend on mount / refresh
  useEffect(() => {
    api.get('/sellout/stats').then(r => setStats(r.data.data)).catch(() => {});
    api.get('/sellout/summary').then(r => setTrend(r.data.data)).catch(() => {});
  }, [refreshKey]);

  // Load ranking when rankingBy or period changes
  useEffect(() => {
    api.get('/sellout/ranking', { params: { by: rankingBy, periodo: `${selectedPeriodo}-01` } })
      .then(r => setRanking(r.data.data))
      .catch(() => {});
  }, [rankingBy, selectedPeriodo, refreshKey]);

  // Load records or pendencies based on tab
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'registros') {
      api.get('/sellout', { params: { search: search || undefined, periodo: `${selectedPeriodo}-01` } })
        .then(r => setRecords(r.data.data))
        .catch(() => setRecords([]))
        .finally(() => setLoading(false));
    } else {
      api.get('/sellout/pendencies')
        .then(r => setPendencies(r.data.data))
        .catch(() => setPendencies([]))
        .finally(() => setLoading(false));
    }
  }, [activeTab, search, selectedPeriodo, refreshKey]);

  // Handle search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  function handleSearchChange(v: string) {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 400);
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este registro de sell-out?')) return;
    try {
      await api.delete(`/sellout/${id}`);
      toast.success('Registro excluído.');
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir.');
    }
  }

  // ─── Excel Import ─────────────────────────────────────────────────────────
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        toast.error('Planilha sem dados.');
        return;
      }

      // Expected columns: cli_codigo, for_codigo, periodo (MM/YYYY), valor, quantidade
      const data = rows.slice(1).filter(r => r[0] && r[1] && r[2]).map(r => ({
        cli_codigo: parseInt(r[0]),
        for_codigo: parseInt(r[1]),
        periodo: String(r[2]).trim(),
        valor: parseFloat(String(r[3]).replace(',', '.')) || 0,
        quantidade: parseFloat(String(r[4]).replace(',', '.')) || 0,
      }));

      if (!data.length) {
        toast.error('Nenhuma linha válida encontrada.');
        return;
      }

      const res = await api.post('/sellout/import', { rows: data });
      const { imported, errors } = res.data;
      toast.success(`${imported} registros importados${errors > 0 ? `, ${errors} com erro` : ''}.`);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro na importação.');
    } finally {
      setImporting(false);
    }
  }

  // ─── Template Download ────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Lançamentos
      const launchData = [
        ['cod_cliente', 'cod_industria', 'periodo (MM/YYYY)', 'valor', 'quantidade'],
        [12345, 678, '04/2026', 15000.00, 250],
        [12346, 678, '04/2026', 8500.50, 120],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(launchData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Lancamentos');

      // Sheet 2: Note
      const noteData = [
        ['INSTRUÇÕES DE PREENCHIMENTO'],
        [''],
        ['cod_cliente: Código do cliente no sistema'],
        ['cod_industria: Código da indústria/fornecedor no sistema'],
        ['periodo: Mês/Ano no formato MM/YYYY (ex: 04/2026)'],
        ['valor: Valor total de sell-out (use ponto como decimal)'],
        ['quantidade: Quantidade de unidades vendidas (opcional)'],
        [''],
        ['* Registros duplicados para o mesmo cliente/indústria/período serão atualizados.'],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(noteData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Instrucoes');

      XLSX.writeFile(wb, 'template_sellout.xlsx');
      toast.success('Template baixado!');
    } catch {
      toast.error('Erro ao gerar template.');
    }
  }

  // ─── Stat Card ────────────────────────────────────────────────────────────
  const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 14, flex: 1,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#28374A', lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: sub.startsWith('+') ? '#16a34a' : sub.startsWith('-') ? '#dc2626' : '#888' }}>{sub}</div>}
      </div>
    </div>
  );

  const crescimento = stats?.crescimento;
  const crescStr = crescimento != null
    ? `${crescimento >= 0 ? '+' : ''}${crescimento.toFixed(1)}% vs mês anterior`
    : 'Sem dados do mês anterior';

  return (
    <div style={{ padding: 24, background: '#E8E1D4', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#28374A' }}>Sell-Out</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Monitoramento de vendas ao consumidor final</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleDownloadTemplate} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc',
            background: '#fff', cursor: 'pointer', fontSize: 13, color: '#28374A',
          }}>
            <FileSpreadsheet size={15} /> Template
          </button>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: '1px solid #16a34a',
            background: importing ? '#dcfce7' : '#f0fdf4', cursor: 'pointer', fontSize: 13, color: '#16a34a',
          }}>
            <Upload size={15} /> {importing ? 'Importando...' : 'Importar Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileImport} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setModal({})} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#28374A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Plus size={15} /> Novo Registro
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <StatCard icon={TrendingUp}  label="Sell-Out Mês Atual"  value={stats ? fmt(stats.total_valor) : '—'}       sub={crescStr}   color="#28374A" />
        <StatCard icon={Users}       label="Clientes Ativos"     value={stats ? stats.total_clientes : '—'}          sub="no período" color="#2563eb" />
        <StatCard icon={Building2}   label="Indústrias"          value={stats ? stats.total_industrias : '—'}        sub="no período" color="#7c3aed" />
        <StatCard icon={AlertTriangle} label="Pendências"        value={stats ? stats.pendencias : '—'}              sub="sem lançamento" color="#dc2626" />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {/* Trend Chart */}
        <div style={{
          flex: 1.5, background: '#fff', borderRadius: 12, padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#28374A' }}>Evolução Mensal (Sell-Out R$)</h3>
            <button onClick={refresh} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="selloutGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#28374A" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#28374A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="periodo" tickFormatter={parsePeriodoLabel} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={50} />
              <Tooltip
                formatter={((v: number) => [fmt(v), 'Sell-Out']) as any}
                labelFormatter={parsePeriodoLabel as any}
                contentStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total_valor" stroke="#28374A" strokeWidth={2} fill="url(#selloutGrad)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking Chart */}
        <div style={{
          flex: 1, background: '#fff', borderRadius: 12, padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#28374A' }}>Ranking</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['client', 'industry'] as const).map(v => (
                <button key={v} onClick={() => setRankingBy(v)} style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, border: 'none',
                  background: rankingBy === v ? '#28374A' : '#f0f0f0',
                  color: rankingBy === v ? '#fff' : '#666', cursor: 'pointer',
                }}>
                  {v === 'client' ? 'Clientes' : 'Indústrias'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ranking.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={((v: number) => [fmt(v), 'Sell-Out']) as any} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="total_valor" fill="#28374A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Tab Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {(['registros', 'pendencias'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '13px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none',
              color: activeTab === tab ? '#28374A' : '#888',
              borderBottom: activeTab === tab ? '2px solid #28374A' : '2px solid transparent',
            }}>
              {tab === 'registros' ? 'Registros' : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Pendências
                  {stats && stats.pendencias > 0 && (
                    <span style={{
                      background: '#dc2626', color: '#fff', borderRadius: 999,
                      fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    }}>{stats.pendencias}</span>
                  )}
                </span>
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {activeTab === 'registros' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
              <input
                type="month"
                value={selectedPeriodo}
                onChange={e => setSelectedPeriodo(e.target.value)}
                style={{ border: '1px solid #ddd', borderRadius: 6, padding: '5px 10px', fontSize: 13 }}
              />
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input
                  value={searchInput}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Buscar cliente / indústria..."
                  style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: '1px solid #ddd', borderRadius: 6, fontSize: 13, width: 220 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {activeTab === 'registros' ? (
          <div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>Carregando...</div>
            ) : records.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
                <BarChart2 size={36} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div>Nenhum registro encontrado</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9f9f9' }}>
                    {['Cliente', 'Indústria', 'Período', 'Valor', 'Quantidade', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f5f5f5' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: '#28374A' }}>
                        {r.cli_nomred || r.cli_fantasia || r.cli_nome}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#555' }}>
                        {r.industria_nomered || r.industria_nome}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#555' }}>
                        {parsePeriodoLabel(r.periodo)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#28374A', fontWeight: 600 }}>
                        {fmt(r.valor)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#555' }}>
                        {r.quantidade ? Number(r.quantidade).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setModal(r)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 4 }}
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>Carregando...</div>
            ) : pendencies.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#16a34a', fontSize: 14 }}>
                <CheckCircle2 size={36} style={{ marginBottom: 8 }} />
                <div>Sem pendências para o período atual!</div>
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 16px', background: '#fef2f2', borderBottom: '1px solid #fee2e2', fontSize: 12, color: '#991b1b' }}>
                  <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                  {pendencies.length} clientes que reportaram no período anterior ainda não registraram sell-out este mês.
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9f9f9' }}>
                      {['Cliente', 'Indústria', 'Valor Anterior', 'Qtd. Anterior', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendencies.map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 500, color: '#28374A' }}>
                          {p.cli_nomred || p.cli_fantasia}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#555' }}>
                          {p.industria_nomered || p.industria_nome}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#dc2626', fontWeight: 600 }}>
                          {fmt(p.valor_anterior)}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#555' }}>
                          {p.quantidade_anterior ? Number(p.quantidade_anterior).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => setModal({ cli_codigo: p.cli_codigo, for_codigo: p.for_codigo, cli_nomred: p.cli_nomred, cli_fantasia: p.cli_fantasia, industria_nomered: p.industria_nomered, industria_nome: p.industria_nome })}
                            style={{
                              padding: '4px 12px', borderRadius: 6, border: 'none',
                              background: '#28374A', color: '#fff', cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            Registrar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== false && (
        <SellOutModal
          record={modal}
          onClose={() => setModal(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
