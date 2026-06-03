import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Target, TrendingUp, Plus, Loader2, X,
  Activity, RotateCcw, Calculator, AlertTriangle,
  CheckCircle2, ChevronLeft, LayoutGrid, Store, Package,
  FileText, Award, Trash2, History,
} from 'lucide-react';
import { api }          from '@/shared/lib/api';
import { db }           from '../db/db';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileClient } from '../db/types';

/* ─── types ─────────────────────────────────────────────────────────────────── */
type CampaignTipo = 'CRESCIMENTO' | 'MIX' | 'POSITIVACAO' | 'VOLUME';

interface Campaign {
  cmp_codigo: number;
  cmp_descricao: string;
  cmp_status: string;
  cmp_tipo: CampaignTipo;
  cmp_cliente_id: number;
  cmp_industria_id: number;
  cmp_campanha_ini: string;
  cmp_campanha_fim: string;
  cmp_periodo_base_ini: string;
  cmp_periodo_base_fim: string;
  cmp_perc_crescimento: number;
  cmp_meta_valor_total: number;
  cmp_meta_qtd_total: number;
  cmp_meta_diaria_val: number;
  cmp_meta_diaria_qtd: number;
  cmp_base_valor_total: number;
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
  cmp_meta_qtd_input?: number;
  cli_nomred: string;
  industria_nomered: string;
}

interface AutoProgress {
  realizado: number;
  meta: number;
  progress_pct: number;
  elapsed_pct: number;
  behind: boolean;
  tipo: string;
  label: string;
}

interface SimData {
  base: { days: number; total_value: number; daily_avg_value: number };
  projection: { target_daily_value: number; target_total_value: number; target_total_qty: number; days: number };
}

interface Industria { id: number; nome: string }

interface TrackingLog {
  tra_id: number;
  tra_data: string;
  tra_vlr_acumulado: number;
  tra_qtd_acumulada: number;
  tra_observacao: string;
}

/* ─── config ─────────────────────────────────────────────────────────────────── */
const TIPO_CONFIG: Record<CampaignTipo, {
  label: string; color: string; bg: string; border: string;
  Icon: React.ElementType; metaLabel: string; metaUnit: string; desc: string;
}> = {
  CRESCIMENTO: {
    label: 'Crescimento', color: '#059669', bg: '#ECFDF5', border: '#6EE7B7',
    Icon: TrendingUp,
    metaLabel: 'Meta de Faturamento (R$)', metaUnit: 'R$',
    desc: 'Meta em valor financeiro — quanto o cliente deve faturar com a indústria durante o período.',
  },
  MIX: {
    label: 'Mix', color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD',
    Icon: LayoutGrid,
    metaLabel: 'Meta: Famílias de Produto', metaUnit: 'famílias',
    desc: 'Meta de diversificação — quantas famílias diferentes o cliente deve comprar.',
  },
  POSITIVACAO: {
    label: 'Positivação', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D',
    Icon: Store,
    metaLabel: 'Meta: Meses com Pedido', metaUnit: 'meses',
    desc: 'Meta de ativação — compras em X meses distintos dentro do período.',
  },
  VOLUME: {
    label: 'Volume', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
    Icon: Package,
    metaLabel: 'Meta: Unidades', metaUnit: 'unidades',
    desc: 'Meta em quantidade — total de unidades vendidas no período.',
  },
};

/* ─── helpers ────────────────────────────────────────────────────────────────── */
const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const fmtDate = (s: string) => s ? s.split('T')[0] : '';

function fmtRealized(tipo: CampaignTipo | string, v: number) {
  return tipo === 'CRESCIMENTO' ? fmtBRL(v) : fmtNum(v);
}

function statusBadge(s: string) {
  const map: Record<string, { bg: string; color: string }> = {
    ATIVA:     { bg: '#DCFCE7', color: '#059669' },
    CONCLUIDA: { bg: '#DBEAFE', color: '#2563EB' },
    CANCELADA: { bg: '#F1F5F9', color: '#64748B' },
    SIMULACAO: { bg: '#FEF3C7', color: '#D97706' },
  };
  return map[s] ?? { bg: '#F1F5F9', color: '#64748B' };
}

/* ─── SearchSelect ───────────────────────────────────────────────────────────── */
function SearchSelect({
  placeholder, items, value, display, onSelect,
}: {
  placeholder: string;
  items: { id: number; nome: string }[];
  value: number | null;
  display: string;
  onSelect: (id: number, nome: string) => void;
}) {
  const [q, setQ]       = useState('');
  const [open, setOpen] = useState(false);
  const filtered = q.length > 0
    ? items.filter(i => i.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: 9, fontSize: 13, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: '#f8fafc',
    color: 'var(--navy)', outline: 'none', padding: '9px 11px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inp}
        placeholder={value ? display : placeholder}
        value={open ? q : (value ? display : '')}
        onFocus={() => { setOpen(true); setQ(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => setQ(e.target.value)}
      />
      {value && !open && (
        <button onClick={() => { onSelect(0, ''); setQ(''); }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X size={12} color="var(--navy-muted)" />
        </button>
      )}
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 200, top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 9,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto',
        }}>
          {filtered.map(i => (
            <button key={i.id} onMouseDown={() => onSelect(i.id, i.nome)}
              style={{ display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 12px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, color: 'var(--navy)',
                borderBottom: '1px solid var(--border)' }}>
              {i.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── TipoSelector ───────────────────────────────────────────────────────────── */
function TipoSelector({ value, onChange, disabled }: {
  value: CampaignTipo; onChange: (t: CampaignTipo) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {(Object.entries(TIPO_CONFIG) as [CampaignTipo, typeof TIPO_CONFIG[CampaignTipo]][]).map(([k, v]) => {
        const active = value === k;
        return (
          <button key={k} onClick={() => !disabled && onChange(k)} disabled={disabled}
            style={{
              padding: '10px 4px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer', textAlign: 'center',
              border: `2px solid ${active ? v.color : '#E2E8F0'}`,
              background: active ? v.bg : '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              opacity: disabled && !active ? 0.5 : 1,
            }}>
            <v.Icon size={16} color={active ? v.color : '#94A3B8'} />
            <span style={{ fontSize: 9, fontWeight: 900, color: active ? v.color : '#64748B',
              textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.3 }}>
              {v.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── DetailPanel ────────────────────────────────────────────────────────────── */
type FormState = {
  cmp_codigo?: number;
  cmp_tipo: CampaignTipo;
  cmp_descricao: string;
  cmp_status: string;
  cmp_cliente_id: number | null;
  cli_nome: string;
  cmp_industria_id: number | null;
  for_nome: string;
  cmp_campanha_ini: string;
  cmp_campanha_fim: string;
  cmp_periodo_base_ini: string;
  cmp_periodo_base_fim: string;
  cmp_perc_crescimento: number;
  cmp_tipo_periodo: string;
  cmp_meta_qtd_input: number;
  cmp_verba_solicitada: number;
  cmp_tema: string;
  cmp_setor: string;
  cmp_regiao: string;
  cmp_equipe_vendas: number;
  cmp_justificativa: string;
  cmp_premiacoes: string;
  cmp_observacao: string;
  sim: SimData | null;
};

const emptyForm = (): FormState => ({
  cmp_tipo: 'CRESCIMENTO',
  cmp_descricao: '',
  cmp_status: 'SIMULACAO',
  cmp_cliente_id: null, cli_nome: '',
  cmp_industria_id: null, for_nome: '',
  cmp_campanha_ini: '', cmp_campanha_fim: '',
  cmp_periodo_base_ini: '', cmp_periodo_base_fim: '',
  cmp_perc_crescimento: 20,
  cmp_tipo_periodo: 'TRIMESTRAL',
  cmp_meta_qtd_input: 0,
  cmp_verba_solicitada: 0,
  cmp_tema: '',
  cmp_setor: '',
  cmp_regiao: '',
  cmp_equipe_vendas: 0,
  cmp_justificativa: '',
  cmp_premiacoes: '',
  cmp_observacao: '',
  sim: null,
});

function DetailPanel({
  campaign, clientes, industrias, onClose, onSaved,
}: {
  campaign: Campaign | null;
  clientes: MobileClient[];
  industrias: Industria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!campaign;
  const [tab, setTab]           = useState<'planning' | 'monitoring' | 'audit'>('planning');
  const [form, setForm]         = useState<FormState>(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [autoProgress, setAutoProgress] = useState<AutoProgress | null>(null);
  const [loadingAuto, setLoadingAuto]   = useState(false);
  const [error, setError]       = useState('');
  const [trackingLogs, setTrackingLogs]     = useState<TrackingLog[]>([]);
  const [showTrackForm, setShowTrackForm]   = useState(false);
  const [newTrack, setNewTrack] = useState({ tra_data: new Date().toISOString().split('T')[0], tra_vlr_acumulado: 0, tra_qtd_acumulada: 0, tra_observacao: '' });

  const tipoConf = TIPO_CONFIG[form.cmp_tipo] || TIPO_CONFIG.CRESCIMENTO;
  const isCrescimento = form.cmp_tipo === 'CRESCIMENTO';

  useEffect(() => {
    if (campaign) {
      setForm({
        cmp_codigo:           campaign.cmp_codigo,
        cmp_tipo:             (campaign.cmp_tipo as CampaignTipo) || 'CRESCIMENTO',
        cmp_descricao:        campaign.cmp_descricao || '',
        cmp_status:           campaign.cmp_status || 'SIMULACAO',
        cmp_cliente_id:       campaign.cmp_cliente_id,
        cli_nome:             campaign.cli_nomred || '',
        cmp_industria_id:     campaign.cmp_industria_id,
        for_nome:             campaign.industria_nomered || '',
        cmp_campanha_ini:     fmtDate(campaign.cmp_campanha_ini),
        cmp_campanha_fim:     fmtDate(campaign.cmp_campanha_fim),
        cmp_periodo_base_ini: fmtDate(campaign.cmp_periodo_base_ini),
        cmp_periodo_base_fim: fmtDate(campaign.cmp_periodo_base_fim),
        cmp_perc_crescimento: campaign.cmp_perc_crescimento || 20,
        cmp_tipo_periodo:     campaign.cmp_tipo_periodo || 'TRIMESTRAL',
        cmp_meta_qtd_input:   parseFloat(String(campaign.cmp_meta_qtd_total)) || 0,
        cmp_verba_solicitada: campaign.cmp_verba_solicitada || 0,
        cmp_tema:             campaign.cmp_tema || '',
        cmp_setor:            campaign.cmp_setor || '',
        cmp_regiao:           campaign.cmp_regiao || '',
        cmp_equipe_vendas:    campaign.cmp_equipe_vendas || 0,
        cmp_justificativa:    campaign.cmp_justificativa || '',
        cmp_premiacoes:       campaign.cmp_premiacoes || '',
        cmp_observacao:       campaign.cmp_observacao || '',
        sim: campaign.cmp_base_valor_total ? {
          base: {
            days: campaign.cmp_base_dias_kpi || 0,
            total_value: parseFloat(String(campaign.cmp_base_valor_total)) || 0,
            daily_avg_value: parseFloat(String(campaign.cmp_base_media_diaria_val)) || 0,
          },
          projection: {
            target_daily_value: parseFloat(String(campaign.cmp_meta_diaria_val)) || 0,
            target_total_value: parseFloat(String(campaign.cmp_meta_valor_total)) || 0,
            target_total_qty: parseFloat(String(campaign.cmp_meta_qtd_total)) || 0,
            days: 0,
          },
        } : null,
      });
    } else {
      setForm(emptyForm());
    }
  }, [campaign]);

  useEffect(() => {
    if (tab === 'monitoring' && form.cmp_codigo) {
      fetchAutoProgress(form.cmp_codigo);
      fetchTracking(form.cmp_codigo);
    }
  }, [tab, form.cmp_codigo]);

  async function fetchAutoProgress(id: number) {
    setLoadingAuto(true);
    try {
      const res = await api.get(`/campaigns/${id}/auto-progress`);
      if (res.data.success) setAutoProgress(res.data.data);
    } catch { /* ok */ }
    finally { setLoadingAuto(false); }
  }

  async function fetchTracking(id: number) {
    try {
      const res = await api.get(`/campaigns/${id}/tracking`);
      if (res.data.success) setTrackingLogs(res.data.data || []);
    } catch { /* ok */ }
  }

  async function handleAddTracking() {
    if (!newTrack.tra_vlr_acumulado && !newTrack.tra_qtd_acumulada) { setError('Informe o valor ou quantidade.'); return; }
    try {
      const res = await api.post(`/campaigns/${form.cmp_codigo}/tracking`, newTrack);
      if (res.data.success) {
        setShowTrackForm(false);
        setNewTrack({ tra_data: new Date().toISOString().split('T')[0], tra_vlr_acumulado: 0, tra_qtd_acumulada: 0, tra_observacao: '' });
        fetchTracking(form.cmp_codigo!);
      }
    } catch { setError('Erro ao lançar progresso.'); }
  }

  async function handleDeleteTrack(tid: number) {
    if (!window.confirm('Remover este lançamento?')) return;
    try {
      await api.delete(`/campaigns/tracking/${tid}`);
      setTrackingLogs(prev => prev.filter(t => t.tra_id !== tid));
    } catch { setError('Erro ao remover.'); }
  }

  async function handleSimulate() {
    if (!form.cmp_cliente_id || !form.cmp_industria_id || !form.cmp_periodo_base_ini || !form.cmp_periodo_base_fim) {
      setError('Preencha cliente, indústria e período base antes de calcular.');
      return;
    }
    setError(''); setSimLoading(true);
    try {
      const res = await api.post('/campaigns/simulate', {
        client_id:       form.cmp_cliente_id,
        industry_id:     form.cmp_industria_id,
        base_start:      form.cmp_periodo_base_ini,
        base_end:        form.cmp_periodo_base_fim,
        campaign_start:  form.cmp_campanha_ini || undefined,
        campaign_end:    form.cmp_campanha_fim  || undefined,
        growth_percent:  form.cmp_perc_crescimento,
      });
      if (res.data.success) setForm(f => ({ ...f, sim: res.data.data }));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao simular.');
    } finally { setSimLoading(false); }
  }

  async function handleSave() {
    if (!form.cmp_cliente_id) { setError('Selecione um cliente.'); return; }
    if (!form.cmp_industria_id) { setError('Selecione uma indústria.'); return; }
    if (!form.cmp_descricao.trim()) { setError('Informe um nome para a campanha.'); return; }
    if (isCrescimento && !form.sim) { setError('Calcule os objetivos antes de salvar.'); return; }
    setError(''); setSaving(true);
    try {
      const payload: any = {
        cmp_tipo:         form.cmp_tipo,
        cmp_descricao:    form.cmp_descricao,
        cmp_status:       form.cmp_status,
        cmp_cliente_id:   form.cmp_cliente_id,
        cmp_industria_id: form.cmp_industria_id,
        cmp_campanha_ini: form.cmp_campanha_ini || undefined,
        cmp_campanha_fim: form.cmp_campanha_fim || undefined,
        cmp_tipo_periodo: form.cmp_tipo_periodo,
        cmp_tema:             form.cmp_tema,
        cmp_setor:            form.cmp_setor || undefined,
        cmp_regiao:           form.cmp_regiao || undefined,
        cmp_equipe_vendas:    form.cmp_equipe_vendas || undefined,
        cmp_verba_solicitada: form.cmp_verba_solicitada,
        cmp_justificativa:    form.cmp_justificativa || undefined,
        cmp_premiacoes:       form.cmp_premiacoes || undefined,
        cmp_observacao:       form.cmp_observacao || undefined,
      };
      if (isCrescimento && form.sim) {
        payload.cmp_periodo_base_ini = form.cmp_periodo_base_ini;
        payload.cmp_periodo_base_fim = form.cmp_periodo_base_fim;
        payload.cmp_perc_crescimento = form.cmp_perc_crescimento;
        payload.simulation_data = form.sim;
      } else {
        payload.cmp_meta_qtd_total = form.cmp_meta_qtd_input;
      }
      if (isEdit && form.cmp_codigo) {
        await api.put(`/campaigns/${form.cmp_codigo}`, payload);
      } else {
        await api.post('/campaigns', payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: 9, fontSize: 13, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: '#f8fafc',
    color: 'var(--navy)', outline: 'none', padding: '9px 11px',
    boxSizing: 'border-box' as const,
  };
  const lbl: React.CSSProperties = {
    fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, display: 'block',
  };
  const section: React.CSSProperties = {
    background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    border: '1px solid var(--border)',
  };

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'var(--sand-bg)', display: 'flex', flexDirection: 'column',
      }}>
      {/* header */}
      <div style={{
        background: 'var(--navy)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#fff', padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '2px 8px', borderRadius: 999,
              background: tipoConf.bg, border: `1px solid ${tipoConf.border}`,
              fontSize: 9, fontWeight: 900, color: tipoConf.color, textTransform: 'uppercase' }}>
              {tipoConf.label}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginTop: 2 }}>
            {isEdit ? (form.cmp_descricao || 'Campanha') : 'Nova Campanha'}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{
            background: saving ? '#4B5563' : tipoConf.color, border: 'none', borderRadius: 8,
            padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 900,
            cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
          {saving
            ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <CheckCircle2 size={13} />}
          Salvar
        </button>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[
          { id: 'planning',   label: 'Planejar',  Icon: FileText },
          { id: 'monitoring', label: 'Monitor.',  Icon: Activity, disabled: !isEdit },
          { id: 'audit',      label: 'Auditoria', Icon: Award,    disabled: !isEdit },
        ].map(t => (
          <button key={t.id}
            onClick={() => !t.disabled && setTab(t.id as any)}
            disabled={t.disabled}
            style={{
              flex: 1, padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: tab === t.id ? `2px solid ${tipoConf.color}` : '2px solid transparent',
              fontSize: 11, fontWeight: 900, cursor: t.disabled ? 'default' : 'pointer',
              color: tab === t.id ? tipoConf.color : t.disabled ? '#CBD5E1' : '#64748B',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>

        {tab === 'planning' && (
          <>
            {/* tipo */}
            <div style={section}>
              <span style={{ ...lbl, marginBottom: 10 }}>Tipo de Campanha</span>
              <TipoSelector value={form.cmp_tipo} onChange={t => setForm(f => ({ ...f, cmp_tipo: t, sim: null }))} disabled={isEdit} />
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 10, lineHeight: 1.5 }}>{tipoConf.desc}</p>
            </div>

            {/* parceiros */}
            <div style={section}>
              <div style={{ borderLeft: `4px solid ${tipoConf.color}`, paddingLeft: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy)' }}>Parceiros e Período</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <span style={lbl}>Nome da Campanha *</span>
                  <input style={inp} value={form.cmp_descricao}
                    onChange={e => setForm(f => ({ ...f, cmp_descricao: e.target.value }))}
                    placeholder="Ex: Desafio Q1 2026 — IMA" />
                </div>
                <div>
                  <span style={lbl}>Cliente *</span>
                  <SearchSelect
                    placeholder="Selecionar cliente..."
                    items={clientes.map(c => ({ id: c.cli_codigo, nome: c.cli_nomred }))}
                    value={form.cmp_cliente_id}
                    display={form.cli_nome}
                    onSelect={(id, nome) => setForm(f => ({ ...f, cmp_cliente_id: id || null, cli_nome: nome, sim: null }))}
                  />
                </div>
                <div>
                  <span style={lbl}>Indústria *</span>
                  <SearchSelect
                    placeholder="Selecionar indústria..."
                    items={industrias}
                    value={form.cmp_industria_id}
                    display={form.for_nome}
                    onSelect={(id, nome) => setForm(f => ({ ...f, cmp_industria_id: id || null, for_nome: nome, sim: null }))}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={lbl}>Início da campanha</span>
                    <input type="date" style={inp} value={form.cmp_campanha_ini}
                      onChange={e => setForm(f => ({ ...f, cmp_campanha_ini: e.target.value }))} />
                  </div>
                  <div>
                    <span style={lbl}>Fim da campanha</span>
                    <input type="date" style={inp} value={form.cmp_campanha_fim}
                      onChange={e => setForm(f => ({ ...f, cmp_campanha_fim: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <span style={lbl}>Status</span>
                  <select style={{ ...inp, appearance: 'none' as const }} value={form.cmp_status}
                    onChange={e => setForm(f => ({ ...f, cmp_status: e.target.value }))}>
                    <option value="SIMULACAO">Simulação</option>
                    <option value="ATIVA">Ativa</option>
                    <option value="CONCLUIDA">Concluída</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={lbl}>Setor</span>
                    <input style={inp} value={form.cmp_setor}
                      onChange={e => setForm(f => ({ ...f, cmp_setor: e.target.value }))} placeholder="Ex: Varejo" />
                  </div>
                  <div>
                    <span style={lbl}>Região</span>
                    <input style={inp} value={form.cmp_regiao}
                      onChange={e => setForm(f => ({ ...f, cmp_regiao: e.target.value }))} placeholder="Ex: Sul" />
                  </div>
                </div>
                <div>
                  <span style={lbl}>Equipe de Vendas (qtd)</span>
                  <input type="number" style={inp} value={form.cmp_equipe_vendas}
                    onChange={e => setForm(f => ({ ...f, cmp_equipe_vendas: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>

            {/* meta */}
            {isCrescimento ? (
              <div style={section}>
                <div style={{ borderLeft: `4px solid ${tipoConf.color}`, paddingLeft: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy)' }}>Análise de Potencial</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <span style={lbl}>Início período base</span>
                    <input type="date" style={inp} value={form.cmp_periodo_base_ini}
                      onChange={e => setForm(f => ({ ...f, cmp_periodo_base_ini: e.target.value, sim: null }))} />
                  </div>
                  <div>
                    <span style={lbl}>Fim período base</span>
                    <input type="date" style={inp} value={form.cmp_periodo_base_fim}
                      onChange={e => setForm(f => ({ ...f, cmp_periodo_base_fim: e.target.value, sim: null }))} />
                  </div>
                  <div>
                    <span style={lbl}>% Crescimento meta</span>
                    <input type="number" style={inp} value={form.cmp_perc_crescimento}
                      onChange={e => setForm(f => ({ ...f, cmp_perc_crescimento: parseFloat(e.target.value) || 0, sim: null }))} />
                  </div>
                  <div>
                    <span style={lbl}>Janela de referência</span>
                    <select style={{ ...inp, appearance: 'none' as const }} value={form.cmp_tipo_periodo}
                      onChange={e => setForm(f => ({ ...f, cmp_tipo_periodo: e.target.value }))}>
                      <option value="BIMESTRAL">Bimestral</option>
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleSimulate} disabled={simLoading}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                    background: simLoading ? '#94A3B8' : tipoConf.color, color: '#fff',
                    fontWeight: 900, fontSize: 13, cursor: simLoading ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {simLoading
                    ? <><RotateCcw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Calculando...</>
                    : <><Calculator size={14} /> Calcular Objetivos de Venda</>}
                </button>
                {form.sim && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    {[
                      { label: 'Total Histórico', value: fmtBRL(form.sim.base.total_value), hi: false },
                      { label: 'Média Diária',    value: fmtBRL(form.sim.base.daily_avg_value), hi: false },
                      { label: 'Meta Diária',     value: fmtBRL(form.sim.projection.target_daily_value), hi: true },
                      { label: 'Meta Total',      value: fmtBRL(form.sim.projection.target_total_value), hi: true },
                    ].map(f => (
                      <div key={f.label} style={{
                        borderRadius: 10, padding: 10,
                        background: f.hi ? '#ECFDF5' : '#F8FAFC',
                        border: `1px solid ${f.hi ? '#6EE7B7' : '#E2E8F0'}`,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color: '#64748B',
                          textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{f.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: f.hi ? '#059669' : 'var(--navy)' }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={section}>
                <div style={{ background: tipoConf.bg, border: `1px solid ${tipoConf.border}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 12,
                  fontSize: 12, color: tipoConf.color, fontWeight: 600, lineHeight: 1.5 }}>
                  {tipoConf.desc}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <span style={lbl}>{tipoConf.metaLabel} *</span>
                    <input type="number" style={{ ...inp, borderColor: tipoConf.border }}
                      value={form.cmp_meta_qtd_input}
                      onChange={e => setForm(f => ({ ...f, cmp_meta_qtd_input: parseFloat(e.target.value) || 0 }))}
                      placeholder={`Ex: 5 ${tipoConf.metaUnit}`} />
                  </div>
                  <div>
                    <span style={lbl}>Janela de referência</span>
                    <select style={{ ...inp, appearance: 'none' as const }} value={form.cmp_tipo_periodo}
                      onChange={e => setForm(f => ({ ...f, cmp_tipo_periodo: e.target.value }))}>
                      <option value="BIMESTRAL">Bimestral</option>
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>Verba Solicitada (R$)</span>
                    <input type="number" step="0.01" style={inp}
                      value={form.cmp_verba_solicitada}
                      onChange={e => setForm(f => ({ ...f, cmp_verba_solicitada: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
            )}

            {/* tema / verba */}
            <div style={section}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <span style={lbl}>Tema / Mote</span>
                  <input style={inp} value={form.cmp_tema}
                    onChange={e => setForm(f => ({ ...f, cmp_tema: e.target.value }))}
                    placeholder="Ex: Queima de Estoque / Ativação Verão..." />
                </div>
                {isCrescimento && (
                  <div>
                    <span style={lbl}>Verba solicitada (R$)</span>
                    <input type="number" step="0.01" style={inp}
                      value={form.cmp_verba_solicitada}
                      onChange={e => setForm(f => ({ ...f, cmp_verba_solicitada: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9,
                padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{error}</div>
            )}
          </>
        )}

        {tab === 'monitoring' && (
          <>
            {/* auto progress */}
            <div style={section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={14} color={tipoConf.color} /> Progresso Real
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {form.cmp_codigo && (
                    <button onClick={() => fetchAutoProgress(form.cmp_codigo!)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <RotateCcw size={12} /> Atualizar
                    </button>
                  )}
                  <select value={form.cmp_status}
                    onChange={e => setForm(f => ({ ...f, cmp_status: e.target.value }))}
                    style={{ ...inp, width: 'auto', fontSize: 12, padding: '5px 8px' }}>
                    <option value="SIMULACAO">Simulação</option>
                    <option value="ATIVA">Ativa</option>
                    <option value="CONCLUIDA">Concluída</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
              </div>

              {loadingAuto ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 12 }}>
                  <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 8px', display: 'block' }} />
                  Calculando progresso...
                </div>
              ) : autoProgress ? (
                <>
                  {autoProgress.behind && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
                      background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
                      padding: '10px 12px', marginBottom: 14 }}>
                      <AlertTriangle size={15} color="#EA580C" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12, color: '#C2410C', fontWeight: 700, lineHeight: 1.5 }}>
                        Campanha atrasada — {autoProgress.elapsed_pct.toFixed(0)}% do período decorrido,
                        apenas {autoProgress.progress_pct.toFixed(0)}% da meta atingida.
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                        {fmtRealized(autoProgress.tipo, autoProgress.realizado)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--navy-muted)' }}>
                        meta: {fmtRealized(autoProgress.tipo, autoProgress.meta)}
                      </span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, background: '#E2E8F0', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 5, transition: 'width 0.5s',
                        background: autoProgress.behind ? '#EA580C' : tipoConf.color,
                        width: `${Math.min(autoProgress.progress_pct, 100)}%`,
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: tipoConf.color, fontWeight: 700 }}>
                        {autoProgress.progress_pct.toFixed(1)}% concluído
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>
                        {autoProgress.elapsed_pct.toFixed(0)}% do prazo
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px',
                      border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: '#64748B',
                        textTransform: 'uppercase', marginBottom: 3 }}>Realizado</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: tipoConf.color }}>
                        {fmtRealized(autoProgress.tipo, autoProgress.realizado)}
                      </div>
                    </div>
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px',
                      border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: '#64748B',
                        textTransform: 'uppercase', marginBottom: 3 }}>Meta</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)' }}>
                        {fmtRealized(autoProgress.tipo, autoProgress.meta)}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 12 }}>
                  Nenhum dado de progresso disponível.<br />
                  <span style={{ fontSize: 11 }}>Verifique se há pedidos no período da campanha.</span>
                </div>
              )}
            </div>

            {/* Log Manual Override — apenas CRESCIMENTO */}
            {isCrescimento && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <History size={14} color="#94A3B8" /> Log Manual
                  </div>
                  <button onClick={() => setShowTrackForm(true)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: tipoConf.color,
                      color: '#fff', fontWeight: 900, fontSize: 11, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={12} /> Lançar
                  </button>
                </div>

                {showTrackForm && (
                  <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                      <div>
                        <span style={lbl}>Data</span>
                        <input type="date" style={inp} value={newTrack.tra_data}
                          onChange={e => setNewTrack(t => ({ ...t, tra_data: e.target.value }))} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <span style={lbl}>Vlr Acumulado (R$)</span>
                          <input type="number" step="0.01" style={inp} value={newTrack.tra_vlr_acumulado}
                            onChange={e => setNewTrack(t => ({ ...t, tra_vlr_acumulado: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <span style={lbl}>Qtd Acumulada</span>
                          <input type="number" style={inp} value={newTrack.tra_qtd_acumulada}
                            onChange={e => setNewTrack(t => ({ ...t, tra_qtd_acumulada: parseFloat(e.target.value) || 0 }))} />
                        </div>
                      </div>
                      <div>
                        <span style={lbl}>Observação</span>
                        <input style={inp} value={newTrack.tra_observacao}
                          onChange={e => setNewTrack(t => ({ ...t, tra_observacao: e.target.value }))}
                          placeholder="Opcional..." />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddTracking}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                          background: tipoConf.color, color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                        Confirmar
                      </button>
                      <button onClick={() => setShowTrackForm(false)}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border)',
                          background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: 'var(--navy-muted)' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {trackingLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                    Nenhum lançamento manual ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {trackingLogs.map(t => (
                      <div key={t.tra_id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                        background: '#F8FAFC' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-muted)', marginBottom: 2 }}>
                            {fmtDate(t.tra_data)}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: tipoConf.color, fontFamily: 'monospace' }}>
                            {fmtBRL(parseFloat(String(t.tra_vlr_acumulado)))}
                          </div>
                          {t.tra_observacao ? <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{t.tra_observacao}</div> : null}
                        </div>
                        <button onClick={() => handleDeleteTrack(t.tra_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={14} color="#FCA5A5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'audit' && (
          <>
            <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Award size={14} color="#F59E0B" />
                <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy)' }}>Auditoria e Encerramento</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={lbl}>Justificativa</span>
                  <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' } as React.CSSProperties}
                    value={form.cmp_justificativa}
                    onChange={e => setForm(f => ({ ...f, cmp_justificativa: e.target.value }))}
                    placeholder="Justificativa dos resultados..." />
                </div>
                <div>
                  <span style={lbl}>Premiações / Bonificações</span>
                  <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' } as React.CSSProperties}
                    value={form.cmp_premiacoes}
                    onChange={e => setForm(f => ({ ...f, cmp_premiacoes: e.target.value }))}
                    placeholder="Descreva premiações acordadas..." />
                </div>
                <div>
                  <span style={lbl}>Observações Gerais</span>
                  <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' } as React.CSSProperties}
                    value={form.cmp_observacao}
                    onChange={e => setForm(f => ({ ...f, cmp_observacao: e.target.value }))} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function CampanhasPage() {
  const { isOnline } = useOffline();
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [clientes,   setClientes]   = useState<MobileClient[]>([]);
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [selected,   setSelected]   = useState<Campaign | null | false>(false); // false = new, null = closed
  const [search,     setSearch]     = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');

  useEffect(() => {
    db.clients.toArray().then(setClientes);
    if (isOnline) {
      api.get('/aux/industrias')
        .then(r => setIndustrias((r.data.data || []).map((f: any) => ({
          id: Number(f.for_codigo), nome: f.for_nomered || f.for_nome,
        }))))
        .catch(() => {});
    }
  }, [isOnline]);

  const loadData = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await api.get('/campaigns', { params: search ? { search } : {} });
      setCampaigns(res.data.data || []);
    } catch {
      setCampaigns([]);
    } finally { setLoading(false); }
  }, [isOnline, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filterTipo ? campaigns.filter(c => c.cmp_tipo === filterTipo) : campaigns;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title="Campanhas" showBack />

      {!isOnline ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <span style={{ fontSize: 44 }}>📶</span>
          <p style={{ fontSize: 13, color: 'var(--navy-muted)', textAlign: 'center' }}>
            Campanhas requer conexão com a internet.
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
            {/* stats strip */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { label: 'Total',     value: String(campaigns.length), color: 'var(--navy)', small: false },
                { label: 'Ativas',    value: String(campaigns.filter(c => c.cmp_status === 'ATIVA').length), color: '#059669', small: false },
                { label: 'Simulação', value: String(campaigns.filter(c => c.cmp_status === 'SIMULACAO').length), color: '#D97706', small: false },
                { label: 'Verba',     value: campaigns.reduce((s, c) => s + (parseFloat(String(c.cmp_verba_solicitada)) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: 'var(--navy)', small: true },
              ].map(s => (
                <div key={s.label} style={{ flex: s.small ? 1.5 : 1, background: '#fff', borderRadius: 10,
                  padding: '8px 8px', border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(40,55,74,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: s.small ? 11 : 18, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
                    textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por campanha, cliente ou indústria..."
                style={{
                  width: '100%', borderRadius: 10, fontSize: 13, fontFamily: 'inherit',
                  border: '1px solid var(--border)', background: '#fff',
                  color: 'var(--navy)', outline: 'none', padding: '9px 11px',
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>
            {/* tipo filter pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
              <button onClick={() => setFilterTipo('')}
                style={{ padding: '4px 12px', borderRadius: 999, border: `1px solid ${!filterTipo ? 'var(--navy)' : 'var(--border)'}`,
                  background: !filterTipo ? 'var(--navy)' : '#fff', color: !filterTipo ? '#fff' : 'var(--navy-muted)',
                  fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Todos
              </button>
              {(Object.entries(TIPO_CONFIG) as [CampaignTipo, typeof TIPO_CONFIG[CampaignTipo]][]).map(([k, v]) => {
                const cnt = campaigns.filter(c => (c.cmp_tipo || 'CRESCIMENTO') === k).length;
                if (!cnt) return null;
                const active = filterTipo === k;
                return (
                  <button key={k} onClick={() => setFilterTipo(active ? '' : k)}
                    style={{ padding: '4px 10px', borderRadius: 999,
                      border: `1px solid ${active ? v.color : v.border}`,
                      background: active ? v.bg : '#fff', color: active ? v.color : 'var(--navy-muted)',
                      fontWeight: 700, fontSize: 11, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <v.Icon size={10} /> {v.label} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          {/* list */}
          <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: 40, color: 'var(--navy-muted)', fontSize: 13 }}>
                <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Target size={28} color="#cbd5e1" style={{ display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 12, color: 'var(--navy-muted)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Nenhuma campanha
                </p>
                <p style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 6 }}>
                  Toque em + para criar uma nova campanha.
                </p>
              </div>
            ) : (
              filtered.map(c => {
                const tc   = TIPO_CONFIG[c.cmp_tipo as CampaignTipo] || TIPO_CONFIG.CRESCIMENTO;
                const sb   = statusBadge(c.cmp_status);
                const meta = c.cmp_tipo === 'CRESCIMENTO'
                  ? parseFloat(String(c.cmp_meta_valor_total)) || 0
                  : parseFloat(String(c.cmp_meta_qtd_total)) || 0;
                const real = c.cmp_tipo === 'CRESCIMENTO'
                  ? parseFloat(String(c.cmp_real_valor_total)) || 0
                  : parseFloat(String(c.cmp_real_qtd_total)) || 0;
                const pct = meta > 0 ? Math.min((real / meta) * 100, 100) : 0;
                const behind = (() => {
                  if (c.cmp_status !== 'ATIVA' || !c.cmp_campanha_ini || !c.cmp_campanha_fim || meta === 0) return false;
                  const now = Date.now();
                  const start = new Date(c.cmp_campanha_ini).getTime();
                  const end   = new Date(c.cmp_campanha_fim).getTime();
                  const totalMs = end - start;
                  if (totalMs <= 0) return false;
                  const elapsedPct = Math.min(100, ((now - start) / totalMs) * 100);
                  return elapsedPct > 15 && pct < elapsedPct * 0.75;
                })();
                return (
                  <button key={c.cmp_codigo} onClick={() => setSelected(c)}
                    style={{
                      display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left',
                      padding: '13px 16px',
                      background: behind ? '#FFFBF5' : '#fff', border: 'none', cursor: 'pointer',
                      borderBottom: `1px solid ${behind ? '#FED7AA' : 'var(--border)'}`,
                    }}>
                    {/* top row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ padding: '2px 7px', borderRadius: 999,
                        background: tc.bg, border: `1px solid ${tc.border}`,
                        fontSize: 9, fontWeight: 900, color: tc.color, textTransform: 'uppercase' }}>
                        {tc.label}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 900, color: 'var(--navy)',
                        textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {c.cmp_descricao}
                      </div>
                      <div style={{ padding: '2px 7px', borderRadius: 999,
                        background: sb.bg, fontSize: 9, fontWeight: 900, color: sb.color,
                        textTransform: 'uppercase', flexShrink: 0 }}>
                        {c.cmp_status}
                      </div>
                    </div>
                    {/* client / industry */}
                    <div style={{ fontSize: 11, color: 'var(--navy-muted)', fontWeight: 700, marginBottom: behind ? 6 : 8 }}>
                      {c.cli_nomred} · {c.industria_nomered}
                    </div>
                    {/* behind alert */}
                    {behind && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                        background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 7,
                        padding: '4px 8px', marginBottom: 8, fontSize: 10, fontWeight: 700, color: '#C2410C' }}>
                        <AlertTriangle size={11} /> Campanha atrasada
                      </div>
                    )}
                    {/* progress */}
                    {meta > 0 && (
                      <div>
                        <div style={{ height: 5, borderRadius: 3, background: '#E2E8F0', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            background: tc.color,
                            width: `${pct}%`,
                          }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--navy-muted)', marginTop: 3, fontWeight: 600 }}>
                          {fmtRealized(c.cmp_tipo, real)} / {fmtRealized(c.cmp_tipo, meta)} ({pct.toFixed(0)}%)
                        </div>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* FAB */}
          <button onClick={() => setSelected(false)}
            style={{
              position: 'fixed', bottom: 80, right: 20, zIndex: 100,
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--mustard)', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(255,210,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Plus size={22} color="var(--navy)" strokeWidth={3} />
          </button>
        </>
      )}

      <AnimatePresence>
        {selected !== null && (
          <DetailPanel
            campaign={selected === false ? null : selected}
            clientes={clientes}
            industrias={industrias}
            onClose={() => setSelected(null)}
            onSaved={() => { setSelected(null); loadData(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
