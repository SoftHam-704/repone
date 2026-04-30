import React, { useState, useEffect, useCallback } from 'react';
import {
  Target, TrendingUp, Calendar, AlertCircle, Plus, Search,
  Sparkles, Activity, RotateCcw, Trash2, ChevronLeft, ChevronRight,
  Save, Calculator, DollarSign, CheckCircle2, History, Award, FileText,
  Info, X,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';
import { G } from '@/shared/components/layout/CadastroShell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  cmp_codigo: number;
  cmp_descricao: string;
  cmp_status: string;
  cmp_cliente_id: number;
  cmp_industria_id: number;
  cmp_promotor_id: number | null;
  cmp_periodo_base_ini: string;
  cmp_periodo_base_fim: string;
  cmp_campanha_ini: string;
  cmp_campanha_fim: string;
  cmp_base_dias_kpi: number;
  cmp_base_valor_total: number;
  cmp_base_qtd_total: number;
  cmp_base_media_diaria_val: number;
  cmp_base_media_diaria_qtd: number;
  cmp_perc_crescimento: number;
  cmp_meta_valor_total: number;
  cmp_meta_qtd_total: number;
  cmp_meta_diaria_val: number;
  cmp_meta_diaria_qtd: number;
  cmp_real_valor_total: number;
  cmp_real_qtd_total: number;
  cmp_verba_solicitada: number;
  cmp_tema: string;
  cmp_observacao: string;
  cmp_justificativa: string;
  cmp_premiacoes: string;
  cmp_setor: string;
  cmp_regiao: string;
  cmp_equipe_vendas: number;
  cmp_tipo_periodo: string;
  cli_nome: string;
  cli_nomred: string;
  cli_fantasia: string;
  industria_nome: string;
  industria_nomered: string;
}

interface TrackingLog {
  tra_id: number;
  tra_campanha_id: number;
  tra_data: string;
  tra_vlr_acumulado: number;
  tra_qtd_acumulada: number;
  tra_observacao: string;
}

interface SimulationData {
  base: { days: number; total_value: number; total_qty: number; daily_avg_value: number; daily_avg_qty: number; };
  projection: { days: number; growth_percent: number; target_daily_value: number; target_daily_qty: number; target_total_value: number; target_total_qty: number; };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => iso ? iso.split('T')[0] : '';

function statusColor(s: string) {
  if (s === 'ATIVA')     return { bg: '#10B981', text: '#fff' };
  if (s === 'CONCLUIDA') return { bg: '#3B82F6', text: '#fff' };
  if (s === 'CANCELADA') return { bg: '#6B7280', text: '#fff' };
  return { bg: '#F59E0B', text: '#fff' }; // SIMULACAO default
}

function statusBar(s: string) {
  if (s === 'ATIVA')     return '#10B981';
  if (s === 'CONCLUIDA') return '#3B82F6';
  if (s === 'CANCELADA') return '#9CA3AF';
  return '#F59E0B';
}

// ─── Inline search inputs ──────────────────────────────────────────────────────

function InlineSearch({ placeholder, endpoint, labelKey, valueKey, value, onChange }: {
  placeholder: string;
  endpoint: string;
  labelKey: string;
  valueKey: string;
  value: { id: number | null; label: string };
  onChange: (id: number, label: string, item: any) => void;
}) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!q || q.length < 2) { setOpts([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`${endpoint}?search=${encodeURIComponent(q)}&limit=15`);
        setOpts(res.data.data || []);
        setOpen(true);
      } catch { setOpts([]); }
    }, 300);
  }, [q, endpoint]);

  if (value.id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid #10B981', background: '#F0FDF4' }}>
        <CheckCircle2 size={13} color="#10B981" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#065F46' }}>{value.label}</span>
        <button onClick={() => onChange(0, '', null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 14 }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text" value={q} onChange={e => setQ(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      />
      {open && opts.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
          {opts.map((o, i) => (
            <div key={i} onClick={() => { onChange(o[valueKey], o[labelKey] || o.cli_nomred || o.for_nomered || o.for_nome, o); setQ(''); setOpen(false); setOpts([]); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1E293B', borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              {o[labelKey] || o.cli_nomred || o.for_nomered || o.for_nome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaign Form ────────────────────────────────────────────────────────────

function CampaignForm({ data, onClose, onSave }: { data: Campaign | null; onClose: () => void; onSave: (f: any) => void }) {
  const [activeTab, setActiveTab] = useState<'planning' | 'monitoring' | 'audit'>(
    data && (data.cmp_status === 'ATIVA' || data.cmp_status === 'CONCLUIDA') ? 'monitoring' : 'planning'
  );
  const [planStep, setPlanStep] = useState(1);
  const [loadingSim, setLoadingSim] = useState(false);
  const [trackingLogs, setTrackingLogs] = useState<TrackingLog[]>([]);
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [newTrack, setNewTrack] = useState({ tra_data: new Date().toISOString().split('T')[0], tra_vlr_acumulado: 0, tra_qtd_acumulada: 0, tra_observacao: '' });

  const [form, setForm] = useState({
    cmp_codigo: null as number | null,
    cmp_descricao: '',
    cmp_cliente_id: null as number | null,
    client_name: '',
    cmp_industria_id: null as number | null,
    industry_name: '',
    cmp_promotor_id: null as number | null,
    cmp_setor: '', cmp_regiao: '', cmp_equipe_vendas: 0,
    cmp_tipo_periodo: 'TRIMESTRAL',
    cmp_periodo_base_ini: '', cmp_periodo_base_fim: '',
    cmp_perc_crescimento: 20,
    cmp_verba_solicitada: 0,
    cmp_tema: '', cmp_campanha_ini: '', cmp_campanha_fim: '',
    simulation_data: null as SimulationData | null,
    cmp_observacao: '', cmp_justificativa: '', cmp_premiacoes: '',
    cmp_status: 'SIMULACAO',
    cmp_real_valor_total: 0, cmp_real_qtd_total: 0,
  });

  useEffect(() => {
    if (data) {
      setForm({
        cmp_codigo:           data.cmp_codigo,
        cmp_descricao:        data.cmp_descricao || '',
        cmp_cliente_id:       data.cmp_cliente_id || null,
        client_name:          data.cli_nomred || data.cli_fantasia || data.cli_nome || '',
        cmp_industria_id:     data.cmp_industria_id || null,
        industry_name:        data.industria_nomered || data.industria_nome || '',
        cmp_promotor_id:      data.cmp_promotor_id || null,
        cmp_setor:            data.cmp_setor || '',
        cmp_regiao:           data.cmp_regiao || '',
        cmp_equipe_vendas:    data.cmp_equipe_vendas || 0,
        cmp_tipo_periodo:     data.cmp_tipo_periodo || 'TRIMESTRAL',
        cmp_periodo_base_ini: fmtDate(data.cmp_periodo_base_ini),
        cmp_periodo_base_fim: fmtDate(data.cmp_periodo_base_fim),
        cmp_campanha_ini:     fmtDate(data.cmp_campanha_ini),
        cmp_campanha_fim:     fmtDate(data.cmp_campanha_fim),
        cmp_perc_crescimento: parseFloat(String(data.cmp_perc_crescimento)) || 20,
        cmp_verba_solicitada: parseFloat(String(data.cmp_verba_solicitada)) || 0,
        cmp_tema:             data.cmp_tema || '',
        simulation_data:      data.cmp_base_valor_total ? {
          base:       { days: data.cmp_base_dias_kpi || 0, total_value: parseFloat(String(data.cmp_base_valor_total)) || 0, total_qty: parseFloat(String(data.cmp_base_qtd_total)) || 0, daily_avg_value: parseFloat(String(data.cmp_base_media_diaria_val)) || 0, daily_avg_qty: parseFloat(String(data.cmp_base_media_diaria_qtd)) || 0 },
          projection: { days: 0, growth_percent: parseFloat(String(data.cmp_perc_crescimento)) || 0, target_total_value: parseFloat(String(data.cmp_meta_valor_total)) || 0, target_total_qty: parseFloat(String(data.cmp_meta_qtd_total)) || 0, target_daily_value: parseFloat(String(data.cmp_meta_diaria_val)) || 0, target_daily_qty: parseFloat(String(data.cmp_meta_diaria_qtd)) || 0 },
        } : null,
        cmp_observacao:       data.cmp_observacao || '',
        cmp_justificativa:    data.cmp_justificativa || '',
        cmp_premiacoes:       data.cmp_premiacoes || '',
        cmp_status:           data.cmp_status || 'SIMULACAO',
        cmp_real_valor_total: parseFloat(String(data.cmp_real_valor_total)) || 0,
        cmp_real_qtd_total:   parseFloat(String(data.cmp_real_qtd_total)) || 0,
      });
      if (data.cmp_base_valor_total) setPlanStep(2);
      fetchTracking(data.cmp_codigo);
    } else {
      const end = new Date(), start = new Date();
      start.setMonth(end.getMonth() - 3);
      setForm(prev => ({ ...prev, cmp_periodo_base_ini: start.toISOString().split('T')[0], cmp_periodo_base_fim: end.toISOString().split('T')[0] }));
    }
  }, [data]);

  const fetchTracking = async (id: number) => {
    try {
      const res = await api.get(`/campaigns/${id}/tracking`);
      if (res.data.success) setTrackingLogs(res.data.data || []);
    } catch { /* ok */ }
  };

  const handleSimulate = async () => {
    if (!form.cmp_cliente_id || !form.cmp_industria_id || !form.cmp_periodo_base_ini || !form.cmp_periodo_base_fim) {
      toast.error('Preencha cliente, indústria e período de referência.'); return;
    }
    setLoadingSim(true);
    try {
      const res = await api.post('/campaigns/simulate', {
        client_id: form.cmp_cliente_id, industry_id: form.cmp_industria_id,
        base_start: form.cmp_periodo_base_ini, base_end: form.cmp_periodo_base_fim,
        campaign_start: form.cmp_campanha_ini || form.cmp_periodo_base_ini,
        campaign_end:   form.cmp_campanha_fim || form.cmp_periodo_base_fim,
        growth_percent: form.cmp_perc_crescimento,
      });
      if (res.data.success) {
        setForm(prev => ({
          ...prev,
          simulation_data: res.data.data,
          cmp_verba_solicitada: parseFloat((res.data.data.projection.target_total_value * 0.02).toFixed(2)),
        }));
        setPlanStep(2);
        toast.success('Simulação concluída!');
      }
    } catch { toast.error('Erro na simulação.'); }
    finally { setLoadingSim(false); }
  };

  const handleAddTracking = async () => {
    if (!newTrack.tra_vlr_acumulado) { toast.error('Informe o valor acumulado.'); return; }
    try {
      const res = await api.post(`/campaigns/${form.cmp_codigo}/tracking`, newTrack);
      if (res.data.success) {
        toast.success('Progresso lançado!');
        setShowTrackingForm(false);
        fetchTracking(form.cmp_codigo!);
        setForm(prev => ({ ...prev, cmp_real_valor_total: newTrack.tra_vlr_acumulado, cmp_real_qtd_total: newTrack.tra_qtd_acumulada }));
      }
    } catch { toast.error('Erro ao lançar progresso.'); }
  };

  const handleDeleteTrack = async (tid: number) => {
    if (!window.confirm('Remover este lançamento?')) return;
    try {
      await api.delete(`/campaigns/tracking/${tid}`);
      toast.success('Removido.');
      const remaining = trackingLogs.filter(t => t.tra_id !== tid);
      setTrackingLogs(remaining);
      const latest = remaining[0];
      setForm(prev => ({ ...prev, cmp_real_valor_total: latest?.tra_vlr_acumulado || 0, cmp_real_qtd_total: latest?.tra_qtd_acumulada || 0 }));
    } catch { toast.error('Erro ao remover.'); }
  };

  const progress = form.simulation_data
    ? Math.min(100, (form.cmp_real_valor_total / (form.simulation_data.projection.target_total_value || 1)) * 100)
    : 0;

  // ─── Styles ───────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 5 };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#F8FAFC', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', fontSize: 13, fontWeight: 700 }}>
            <ChevronLeft size={16} /> Campanhas
          </button>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ fontWeight: 900, fontSize: 15, color: '#1E293B' }}>{data ? 'Gestão de Campanha' : 'Nova Campanha'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(form)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {data ? 'Salvar Alterações' : 'Criar Campanha'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 28px', display: 'flex', gap: 0, flexShrink: 0 }}>
        {([
          { id: 'planning',   label: 'Planejamento',    icon: FileText },
          { id: 'monitoring', label: 'Monitoramento',   icon: Activity,  disabled: !form.simulation_data },
          { id: 'audit',      label: 'Auditoria',       icon: Award,     disabled: !data },
        ] as any[]).map(t => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setActiveTab(t.id)}
            disabled={t.disabled}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer',
              fontWeight: 900, fontSize: 12, color: activeTab === t.id ? '#10B981' : t.disabled ? '#CBD5E1' : '#64748B',
              borderBottom: activeTab === t.id ? '2px solid #10B981' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

        {/* ── PLANEJAMENTO ── */}
        {activeTab === 'planning' && (
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Step 1: Configuração */}
            <div style={card}>
              <div style={{ borderLeft: '4px solid #10B981', paddingLeft: 14, marginBottom: 20 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#1E293B' }}>1. Configuração Inicial</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Defina o alvo, parceiro e período de análise histórico.</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                <div>
                  <span style={lbl}>Título da Ação Comercial</span>
                  <input style={inp} value={form.cmp_descricao} onChange={e => setForm({ ...form, cmp_descricao: e.target.value })} placeholder="Ex: Desafio Q1 2026 - Aceleração de Mix" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <span style={lbl}>Parceiro (Lojista)</span>
                    <InlineSearch
                      placeholder="Selecionar cliente..." endpoint="/clients"
                      labelKey="cli_nomred" valueKey="cli_codigo"
                      value={{ id: form.cmp_cliente_id, label: form.client_name }}
                      onChange={(id, label, item) => setForm(prev => ({ ...prev, cmp_cliente_id: id || null, client_name: item?.cli_nomred || label }))}
                    />
                  </div>
                  <div>
                    <span style={lbl}>Indústria / Fornecedor</span>
                    <InlineSearch
                      placeholder="Selecionar indústria..." endpoint="/suppliers"
                      labelKey="for_nomered" valueKey="for_codigo"
                      value={{ id: form.cmp_industria_id, label: form.industry_name }}
                      onChange={(id, label, item) => setForm(prev => ({ ...prev, cmp_industria_id: id || null, industry_name: item?.for_nomered || item?.for_nome || label }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0' }}>
                  <div><span style={lbl}>Setor</span><input style={inp} value={form.cmp_setor} onChange={e => setForm({ ...form, cmp_setor: e.target.value })} /></div>
                  <div><span style={lbl}>Região</span><input style={inp} value={form.cmp_regiao} onChange={e => setForm({ ...form, cmp_regiao: e.target.value })} /></div>
                  <div><span style={lbl}>Equipe (Qtd)</span><input type="number" style={inp} value={form.cmp_equipe_vendas} onChange={e => setForm({ ...form, cmp_equipe_vendas: parseInt(e.target.value) || 0 })} /></div>
                </div>
              </div>
            </div>

            {/* Step 2: Simulação */}
            <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, opacity: 0.05 }}><TrendingUp size={80} color="#0F172A" /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14 }}>2</div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#1E293B', textTransform: 'uppercase' }}>Análise de Potencial</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <span style={lbl}>Janela de Histórico</span>
                  <select style={{ ...inp }} value={form.cmp_tipo_periodo} onChange={e => setForm({ ...form, cmp_tipo_periodo: e.target.value })}>
                    <option value="BIMESTRAL">Bimestral (60 dias)</option>
                    <option value="TRIMESTRAL">Trimestral (90 dias)</option>
                    <option value="SEMESTRAL">Semestral (180 dias)</option>
                    <option value="ANUAL">Anual (365 dias)</option>
                  </select>
                </div>
                <div>
                  <span style={lbl}>% Crescimento Meta</span>
                  <input type="number" style={inp} value={form.cmp_perc_crescimento} onChange={e => setForm({ ...form, cmp_perc_crescimento: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <span style={lbl}>Início do Período Base</span>
                  <input type="date" style={inp} value={form.cmp_periodo_base_ini} onChange={e => setForm({ ...form, cmp_periodo_base_ini: e.target.value })} />
                </div>
                <div>
                  <span style={lbl}>Fim do Período Base</span>
                  <input type="date" style={inp} value={form.cmp_periodo_base_fim} onChange={e => setForm({ ...form, cmp_periodo_base_fim: e.target.value })} />
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button onClick={handleSimulate} disabled={loadingSim}
                  style={{ padding: '12px 40px', borderRadius: 12, border: 'none', background: loadingSim ? '#94A3B8' : '#10B981', color: '#fff', fontWeight: 900, fontSize: 14, cursor: loadingSim ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {loadingSim ? <><RotateCcw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analisando...</> : <><Calculator size={16} /> Calcular Objetivos de Venda</>}
                </button>
              </div>
            </div>

            {/* Step 3: Resultado da simulação */}
            {form.simulation_data && (
              <div style={card}>
                <div style={{ fontWeight: 900, fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Resultado da Performance Base</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total Vendido', value: fmt(form.simulation_data.base.total_value), color: '#1E293B' },
                    { label: 'Dias Úteis',   value: `${form.simulation_data.base.days} dias`,   color: '#1E293B' },
                    { label: 'Média Diária', value: fmt(form.simulation_data.base.daily_avg_value), color: '#10B981', hi: true },
                    { label: 'Meta Diária',  value: fmt(form.simulation_data.projection.target_daily_value), color: '#F59E0B', hi: true },
                  ].map(f => (
                    <div key={f.label} style={{ background: f.hi ? (f.color === '#10B981' ? '#F0FDF4' : '#FFFBEB') : '#F8FAFC', borderRadius: 12, padding: 14, border: `1px solid ${f.hi ? (f.color === '#10B981' ? '#BBF7D0' : '#FDE68A') : '#E2E8F0'}` }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: f.color }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={lbl}>Tema / Mote</span>
                    <input style={inp} value={form.cmp_tema} onChange={e => setForm({ ...form, cmp_tema: e.target.value })} placeholder="Ex: Queima de Estoque / Lançamento Verão..." />
                  </div>
                  <div>
                    <span style={lbl}>Verba Solicitada (R$)</span>
                    <input type="number" step="0.01" style={inp} value={form.cmp_verba_solicitada} onChange={e => setForm({ ...form, cmp_verba_solicitada: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span style={lbl}>Início da Campanha</span>
                    <input type="date" style={inp} value={form.cmp_campanha_ini} onChange={e => setForm({ ...form, cmp_campanha_ini: e.target.value })} />
                  </div>
                  <div>
                    <span style={lbl}>Fim da Campanha</span>
                    <input type="date" style={inp} value={form.cmp_campanha_fim} onChange={e => setForm({ ...form, cmp_campanha_fim: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MONITORAMENTO ── */}
        {activeTab === 'monitoring' && form.simulation_data && (
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Status + progresso */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: '#1E293B' }}>Realizado vs Meta</div>
                <select value={form.cmp_status} onChange={e => setForm({ ...form, cmp_status: e.target.value })} style={{ ...inp, width: 'auto' }}>
                  <option value="SIMULACAO">Simulação</option>
                  <option value="ATIVA">Ativa</option>
                  <option value="CONCLUIDA">Concluída</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Meta Total',    value: fmt(form.simulation_data.projection.target_total_value), color: '#F59E0B' },
                  { label: 'Realizado',     value: fmt(form.cmp_real_valor_total),                          color: progress >= 100 ? '#10B981' : '#3B82F6' },
                  { label: 'Progresso',     value: `${progress.toFixed(0)}%`,                              color: progress >= 100 ? '#10B981' : '#64748B' },
                ].map(f => (
                  <div key={f.label} style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{f.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: f.color }}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ height: 8, background: '#F1F5F9', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#10B981' : '#F59E0B', borderRadius: 8, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            {/* Log de progresso */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 900, fontSize: 14, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={16} color="#10B981" /> Histórico de Progresso
                </div>
                <button onClick={() => setShowTrackingForm(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={13} /> Lançar
                </button>
              </div>

              {showTrackingForm && (
                <div style={{ background: '#F0FDF4', borderRadius: 12, padding: 16, border: '1px solid #BBF7D0', marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div><span style={lbl}>Data</span><input type="date" style={inp} value={newTrack.tra_data} onChange={e => setNewTrack({ ...newTrack, tra_data: e.target.value })} /></div>
                    <div><span style={lbl}>Vlr Acumulado (R$)</span><input type="number" step="0.01" style={inp} value={newTrack.tra_vlr_acumulado} onChange={e => setNewTrack({ ...newTrack, tra_vlr_acumulado: parseFloat(e.target.value) || 0 })} /></div>
                    <div><span style={lbl}>Qtd Acumulada</span><input type="number" style={inp} value={newTrack.tra_qtd_acumulada} onChange={e => setNewTrack({ ...newTrack, tra_qtd_acumulada: parseFloat(e.target.value) || 0 })} /></div>
                  </div>
                  <input style={{ ...inp, marginBottom: 10 }} value={newTrack.tra_observacao} onChange={e => setNewTrack({ ...newTrack, tra_observacao: e.target.value })} placeholder="Observação (opcional)" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleAddTracking} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>Confirmar</button>
                    <button onClick={() => setShowTrackingForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {trackingLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>Nenhum lançamento ainda.</div>
              ) : (
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Data', 'Vlr Acumulado', 'Qtd Acumulada', 'Obs', ''].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Vlr Acumulado' || h === 'Qtd Acumulada' ? 'right' : 'left', fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trackingLogs.map(t => (
                      <tr key={t.tra_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#64748B' }}>{fmtDate(t.tra_data)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#10B981', fontFamily: 'monospace' }}>{fmt(parseFloat(String(t.tra_vlr_acumulado)))}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#1E293B' }}>{t.tra_qtd_acumulada}</td>
                        <td style={{ padding: '7px 10px', color: '#94A3B8', fontSize: 11 }}>{t.tra_observacao}</td>
                        <td style={{ padding: '7px 4px' }}>
                          <button onClick={() => handleDeleteTrack(t.tra_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5' }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── AUDITORIA ── */}
        {activeTab === 'audit' && (
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={card}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={16} color="#F59E0B" /> Auditoria e Encerramento
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><span style={lbl}>Justificativa</span><textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' } as any} value={form.cmp_justificativa} onChange={e => setForm({ ...form, cmp_justificativa: e.target.value })} placeholder="Justificativa dos resultados..." /></div>
                <div><span style={lbl}>Premiações / Bonificações</span><textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' } as any} value={form.cmp_premiacoes} onChange={e => setForm({ ...form, cmp_premiacoes: e.target.value })} placeholder="Descreva premiações acordadas..." /></div>
                <div><span style={lbl}>Observações Gerais</span><textarea style={{ ...inp, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' } as any} value={form.cmp_observacao} onChange={e => setForm({ ...form, cmp_observacao: e.target.value })} /></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ item, onEdit }: { item: Campaign; onEdit: (c: Campaign) => void }) {
  const progress = item.cmp_meta_valor_total > 0
    ? Math.min(100, (parseFloat(String(item.cmp_real_valor_total)) / parseFloat(String(item.cmp_meta_valor_total))) * 100)
    : 0;
  const sc = statusColor(item.cmp_status || 'SIMULACAO');

  return (
    <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Barra de status */}
      <div style={{ height: 6, background: statusBar(item.cmp_status || 'SIMULACAO') }} />

      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#64748B', flexShrink: 0 }}>
            {(item.cmp_descricao || 'C').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.cmp_descricao}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.cli_nomred || item.cli_fantasia || item.cli_nome}
            </div>
          </div>
        </div>

        {/* Fornecedor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase' }}>
          <Sparkles size={10} color="#F59E0B" />
          Fornecedor: {item.industria_nomered || item.industria_nome}
        </div>

        {/* Tema */}
        {item.cmp_tema && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '5px 10px', fontSize: 9, fontWeight: 900, color: '#065F46', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Mote: {item.cmp_tema}
          </div>
        )}

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Meta Diária',     value: fmt(parseFloat(String(item.cmp_meta_diaria_val || 0))) },
            { label: 'Verba Solicitada', value: fmt(parseFloat(String(item.cmp_verba_solicitada || 0))) },
          ].map(f => (
            <div key={f.label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace' }}>{f.value}</div>
            </div>
          ))}
        </div>

        {/* Progresso + ação */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Progresso</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 80, height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#10B981' : '#F59E0B', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B' }}>{progress.toFixed(0)}%</span>
            </div>
          </div>
          <button onClick={() => onEdit(item)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#F0FDF4', color: '#10B981', fontWeight: 900, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Gerenciar
          </button>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <span style={{ fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 999, background: sc.bg, color: sc.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {item.cmp_status || 'SIMULAÇÃO'}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [selected, setSelected]   = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      if (res.data.success) setCampaigns(res.data.data || []);
    } catch { toast.error('Erro ao carregar campanhas.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const filtered = campaigns.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.cmp_descricao || '').toLowerCase().includes(q) ||
      (c.cli_nomred || c.cli_fantasia || c.cli_nome || '').toLowerCase().includes(q) ||
      (c.industria_nome || '').toLowerCase().includes(q)
    );
  });

  const handleSave = async (form: any) => {
    try {
      const isEdit = !!form.cmp_codigo;
      if (isEdit) {
        await api.put(`/campaigns/${form.cmp_codigo}`, form);
        toast.success('Campanha atualizada!');
      } else {
        await api.post('/campaigns', form);
        toast.success('Campanha criada!');
      }
      setShowForm(false);
      fetchCampaigns();
    } catch { toast.error('Erro ao salvar campanha.'); }
  };

  if (showForm) {
    return <CampaignForm data={selected} onClose={() => setShowForm(false)} onSave={handleSave} />;
  }

  const totalVerba = campaigns.reduce((s, c) => s + parseFloat(String(c.cmp_verba_solicitada || 0)), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 9, background: '#10B981', borderRadius: 12 }}>
            <Target size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.3 }}>Campanhas Promocionais</div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.4 }}>Gerencie acordos de crescimento e metas individuais</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por cliente, indústria ou título..."
              style={{ padding: '10px 12px 10px 30px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', width: 280, background: '#F8FAFC' }}
            />
          </div>
          <button onClick={() => { setSelected(null); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={16} /> Nova Estratégia
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '16px 28px 8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
        {[
          { label: 'Total de Campanhas',  value: campaigns.length,                                     color: '#1E293B' },
          { label: 'Campanhas Ativas',    value: campaigns.filter(c => c.cmp_status === 'ATIVA').length, color: '#10B981' },
          { label: 'Em Planejamento',     value: campaigns.filter(c => c.cmp_status === 'SIMULACAO').length, color: '#F59E0B' },
          { label: 'Verba Comprometida',  value: fmt(totalVerba),                                       color: '#1E293B', currency: true },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: s.currency ? 16 : 24, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 28px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#94A3B8' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #10B981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sincronizando estratégias...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 16, background: '#fff', borderRadius: 24, border: '2px dashed #E2E8F0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={36} color="#E2E8F0" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>Nenhuma campanha no radar</div>
            <button onClick={() => { setSelected(null); setShowForm(true); }} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#10B981', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {filtered.map(c => (
              <CampaignCard key={c.cmp_codigo} item={c} onEdit={c => { setSelected(c); setShowForm(true); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
