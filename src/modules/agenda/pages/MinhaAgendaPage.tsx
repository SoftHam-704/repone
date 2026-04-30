import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Calendar,
  Clock, AlertCircle, CheckCircle2, RotateCcw, XCircle,
  Phone, Eye, Users, Briefcase, DollarSign, Bell,
  Cake, Pencil, Trash2, X, Loader2,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { irisAudio } from '@/modules/nexus-ia/services/audio-handler';
import { Play, Square } from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type TipoAgenda =
  | 'tarefa' | 'lembrete' | 'visita' | 'ligacao'
  | 'reuniao' | 'cobranca' | 'followup' | 'aniversario';

type StatusAgenda = 'pendente' | 'em_andamento' | 'concluida' | 'adiada' | 'cancelada';
type Prioridade   = 'A' | 'M' | 'B';
type ViewMode     = 'lista' | 'hoje';

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: TipoAgenda;
  data_inicio: string;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  dia_inteiro: boolean;
  status: StatusAgenda;
  prioridade: Prioridade;
  cliente_id: number | null;
  cliente_nome?: string | null;
  pedido_codigo: string | null;
  recorrente: boolean;
  lembrete_ativo: boolean;
  lembrete_antes: number;
  vezes_adiada: number;
  cor: string | null;
  concluido_em: string | null;
  notas_conclusao: string | null;
  created_at: string;
}

interface TarefaForm {
  titulo: string;
  descricao: string;
  tipo: TipoAgenda;
  data_inicio: string;
  hora_inicio: string;
  data_fim: string;
  hora_fim: string;
  dia_inteiro: boolean;
  status: StatusAgenda;
  prioridade: Prioridade;
  cliente_id: string;
  pedido_codigo: string;
  lembrete_ativo: boolean;
  lembrete_antes: number;
  cor: string;
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const TIPO_META: Record<TipoAgenda, { label: string; color: string; bg: string; icon: any }> = {
  tarefa:      { label: 'Tarefa',     color: '#3B82F6', bg: '#DBEAFE', icon: CheckCircle2  },
  lembrete:    { label: 'Lembrete',   color: '#F59E0B', bg: '#FEF3C7', icon: Bell          },
  visita:      { label: 'Visita',     color: '#10B981', bg: '#D1FAE5', icon: Eye           },
  ligacao:     { label: 'Ligação',    color: '#06B6D4', bg: '#CFFAFE', icon: Phone         },
  reuniao:     { label: 'Reunião',    color: '#8B5CF6', bg: '#EDE9FE', icon: Users         },
  cobranca:    { label: 'Cobrança',   color: '#EF4444', bg: '#FEE2E2', icon: DollarSign    },
  followup:    { label: 'Follow-up',  color: '#F97316', bg: '#FFEDD5', icon: Briefcase     },
  aniversario: { label: 'Aniversário',color: '#EC4899', bg: '#FCE7F3', icon: Cake          },
};

const STATUS_META: Record<StatusAgenda, { label: string; color: string; bg: string; icon: any }> = {
  pendente:     { label: 'Pendente',     color: '#6B7280', bg: '#F3F4F6', icon: Clock        },
  em_andamento: { label: 'Em Andamento', color: '#3B82F6', bg: '#DBEAFE', icon: RotateCcw   },
  concluida:    { label: 'Concluída',    color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  adiada:       { label: 'Adiada',      color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle  },
  cancelada:    { label: 'Cancelada',   color: '#EF4444', bg: '#FEE2E2', icon: XCircle      },
};

const PRIOR_META: Record<Prioridade, { label: string; color: string; bg: string }> = {
  A: { label: 'Alta',  color: '#EF4444', bg: '#FEE2E2' },
  M: { label: 'Média', color: '#F59E0B', bg: '#FEF3C7' },
  B: { label: 'Baixa', color: '#6B7280', bg: '#F3F4F6' },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtHora(h: string | null) {
  if (!h) return '';
  return h.substring(0, 5);
}

function groupByDate(tasks: Tarefa[]): [string, Tarefa[]][] {
  const map: Record<string, Tarefa[]> = {};
  for (const t of tasks) {
    const key = t.data_inicio;
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function dateLabel(iso: string) {
  const today = todayISO();
  const [y, m, d] = iso.split('-');
  const label = `${d}/${m}/${y}`;
  if (iso === today) return `Hoje — ${label}`;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tISO = tomorrow.toISOString().split('T')[0];
  if (iso === tISO) return `Amanhã — ${label}`;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yISO = yesterday.toISOString().split('T')[0];
  if (iso === yISO) return `Ontem — ${label}`;
  return label;
}

// ─── EMPTY FORM ───────────────────────────────────────────────────────────────

const emptyForm = (): TarefaForm => ({
  titulo: '', descricao: '', tipo: 'tarefa',
  data_inicio: todayISO(), hora_inicio: '', data_fim: '', hora_fim: '',
  dia_inteiro: false, status: 'pendente', prioridade: 'M',
  cliente_id: '', pedido_codigo: '', lembrete_ativo: true, lembrete_antes: 15, cor: '',
});

// ─── SELECT HELPER ────────────────────────────────────────────────────────────

const sel: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${G.border}`,
  background: G.card, color: G.text, fontSize: 13, paddingLeft: 10,
  paddingRight: 8, cursor: 'pointer', outline: 'none',
};

const inp: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${G.border}`,
  background: G.card, color: G.text, fontSize: 13, padding: '0 10px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: TipoAgenda }) {
  const m = TIPO_META[tipo];
  const Icon = m.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: m.bg, color: m.color, fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={11} />
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: StatusAgenda }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: m.bg, color: m.color, fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={11} />
      {m.label}
    </span>
  );
}

function PriorBadge({ p }: { p: Prioridade }) {
  const m = PRIOR_META[p];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color,
    }}>
      {m.label}
    </span>
  );
}

// ─── TAREFA CARD ─────────────────────────────────────────────────────────────

interface TarefaCardProps {
  tarefa: Tarefa;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: StatusAgenda) => void;
}

function TarefaCard({ tarefa: t, onEdit, onDelete, onStatusChange }: TarefaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPast = t.data_inicio < todayISO() && !['concluida','cancelada'].includes(t.status);
  const Icon = TIPO_META[t.tipo]?.icon || CheckCircle2;

  return (
    <div style={{
      background: G.card,
      border: `1px solid ${isPast ? '#FCA5A5' : G.border}`,
      borderLeft: `4px solid ${t.cor || TIPO_META[t.tipo]?.color || G.border}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      opacity: ['concluida','cancelada'].includes(t.status) ? 0.65 : 1,
      position: 'relative',
    }}>
      {/* Icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: TIPO_META[t.tipo]?.bg || '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: TIPO_META[t.tipo]?.color || G.textSec,
      }}>
        <Icon size={16} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontWeight: 600, fontSize: 14, color: G.text,
            textDecoration: ['concluida','cancelada'].includes(t.status) ? 'line-through' : 'none',
          }}>{t.titulo}</span>
          <TipoBadge tipo={t.tipo} />
          <PriorBadge p={t.prioridade} />
        </div>

        {t.descricao && (
          <p style={{ fontSize: 12, color: G.textSec, margin: '4px 0 0', lineHeight: 1.5 }}>
            {t.descricao}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {t.hora_inicio && (
            <span style={{ fontSize: 12, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> {fmtHora(t.hora_inicio)}
              {t.hora_fim ? ` — ${fmtHora(t.hora_fim)}` : ''}
            </span>
          )}
          {t.dia_inteiro && (
            <span style={{ fontSize: 12, color: G.textMuted }}>Dia inteiro</span>
          )}
          {t.cliente_nome && (
            <span style={{ fontSize: 12, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Users size={11} /> {t.cliente_nome}
            </span>
          )}
          {t.pedido_codigo && (
            <span style={{ fontSize: 12, color: G.textMuted }}>Pedido #{t.pedido_codigo}</span>
          )}
          {isPast && (
            <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>Atrasada</span>
          )}
          <StatusBadge status={t.status} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {/* Quick complete */}
        {!['concluida','cancelada'].includes(t.status) && (
          <button
            title="Concluir"
            onClick={() => onStatusChange(t.id, 'concluida')}
            style={{
              width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`,
              background: 'transparent', cursor: 'pointer', color: '#10B981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={14} />
          </button>
        )}

        {/* Edit */}
        <button
          title="Editar"
          onClick={() => onEdit(t)}
          style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`,
            background: 'transparent', cursor: 'pointer', color: G.textSec,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Pencil size={13} />
        </button>

        {/* Delete */}
        <button
          title="Excluir"
          onClick={() => onDelete(t.id)}
          style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`,
            background: 'transparent', cursor: 'pointer', color: G.danger,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── FORMULÁRIO LATERAL ───────────────────────────────────────────────────────

interface TarefaModalProps {
  open: boolean;
  editing: Tarefa | null;
  onClose: () => void;
  onSaved: () => void;
}

function TarefaModal({ open, editing, onClose, onSaved }: TarefaModalProps) {
  const [form, setForm] = useState<TarefaForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) {
      setForm({
        titulo:        editing.titulo,
        descricao:     editing.descricao || '',
        tipo:          editing.tipo,
        data_inicio:   editing.data_inicio,
        hora_inicio:   editing.hora_inicio ? fmtHora(editing.hora_inicio) : '',
        data_fim:      editing.data_fim || '',
        hora_fim:      editing.hora_fim ? fmtHora(editing.hora_fim) : '',
        dia_inteiro:   editing.dia_inteiro,
        status:        editing.status,
        prioridade:    editing.prioridade,
        cliente_id:    editing.cliente_id ? String(editing.cliente_id) : '',
        pedido_codigo: editing.pedido_codigo || '',
        lembrete_ativo: editing.lembrete_ativo,
        lembrete_antes: editing.lembrete_antes,
        cor:           editing.cor || '',
      });
    } else {
      setForm(emptyForm());
    }
    setError('');
  }, [editing, open]);

  const set = (field: keyof TarefaForm, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo.trim()) { setError('O título é obrigatório.'); return; }
    if (!form.data_inicio)   { setError('A data é obrigatória.');   return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        cliente_id:    form.cliente_id ? parseInt(form.cliente_id) : null,
        hora_inicio:   form.hora_inicio || null,
        hora_fim:      form.hora_fim || null,
        data_fim:      form.data_fim || null,
        pedido_codigo: form.pedido_codigo || null,
        cor:           form.cor || null,
      };
      if (editing) {
        await api.put(`/agenda/${editing.id}`, payload);
      } else {
        await api.post('/agenda', payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tipoColor = TIPO_META[form.tipo]?.color || G.text;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 1000,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: G.bg, zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${G.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: G.card,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: TIPO_META[form.tipo]?.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: tipoColor,
            }}>
              {(() => { const I = TIPO_META[form.tipo]?.icon || CheckCircle2; return <I size={16} />; })()}
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: G.text }}>
              {editing ? 'Editar Tarefa' : 'Nova Tarefa'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.textSec }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Tipo */}
          <div>
            <span style={label}>Tipo</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(TIPO_META) as TipoAgenda[]).map(t => {
                const m = TIPO_META[t];
                const Icon = m.icon;
                const active = form.tipo === t;
                return (
                  <button
                    key={t}
                    onClick={() => set('tipo', t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer',
                      border: active ? `1.5px solid ${m.color}` : `1px solid ${G.border}`,
                      background: active ? m.bg : G.card,
                      color: active ? m.color : G.textSec,
                    }}
                  >
                    <Icon size={12} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <span style={label}>Título *</span>
            <input
              style={inp}
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Descreva a tarefa..."
            />
          </div>

          {/* Descrição */}
          <div>
            <span style={label}>Descrição</span>
            <textarea
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              style={{
                ...inp, height: 'auto', padding: '8px 10px',
                resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>

          {/* Data e Hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <span style={label}>Data Início *</span>
              <input type="date" style={inp} value={form.data_inicio}
                onChange={e => set('data_inicio', e.target.value)} />
            </div>
            <div>
              <span style={label}>Hora</span>
              <input type="time" style={inp} value={form.hora_inicio}
                onChange={e => set('hora_inicio', e.target.value)} />
            </div>
            <div>
              <span style={label}>Data Fim</span>
              <input type="date" style={inp} value={form.data_fim}
                onChange={e => set('data_fim', e.target.value)} />
            </div>
            <div>
              <span style={label}>Hora Fim</span>
              <input type="time" style={inp} value={form.hora_fim}
                onChange={e => set('hora_fim', e.target.value)} />
            </div>
          </div>

          {/* Dia inteiro */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.dia_inteiro}
              onChange={e => set('dia_inteiro', e.target.checked)} />
            <span style={{ fontSize: 13, color: G.text }}>Dia inteiro</span>
          </label>

          {/* Status + Prioridade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <span style={label}>Status</span>
              <select style={{ ...sel, width: '100%' }} value={form.status}
                onChange={e => set('status', e.target.value as StatusAgenda)}>
                {(Object.keys(STATUS_META) as StatusAgenda[]).map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <span style={label}>Prioridade</span>
              <select style={{ ...sel, width: '100%' }} value={form.prioridade}
                onChange={e => set('prioridade', e.target.value as Prioridade)}>
                <option value="A">Alta</option>
                <option value="M">Média</option>
                <option value="B">Baixa</option>
              </select>
            </div>
          </div>

          {/* Pedido */}
          <div>
            <span style={label}>Nº do Pedido</span>
            <input
              style={inp}
              value={form.pedido_codigo}
              onChange={e => set('pedido_codigo', e.target.value)}
              placeholder="Ex: HS001234"
            />
          </div>

          {/* Lembrete */}
          <div style={{ background: G.card, borderRadius: 9, padding: 12, border: `1px solid ${G.border}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={form.lembrete_ativo}
                onChange={e => set('lembrete_ativo', e.target.checked)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                <Bell size={13} style={{ display: 'inline', marginRight: 4 }} />
                Lembrete
              </span>
            </label>
            {form.lembrete_ativo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={5} max={1440}
                  style={{ ...inp, width: 80 }}
                  value={form.lembrete_antes}
                  onChange={e => set('lembrete_antes', parseInt(e.target.value) || 15)}
                />
                <span style={{ fontSize: 12, color: G.textSec }}>minutos antes</span>
              </div>
            )}
          </div>

          {/* Cor personalizada */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...label, marginBottom: 0 }}>Cor</span>
            <input
              type="color"
              value={form.cor || TIPO_META[form.tipo]?.color || '#3B82F6'}
              onChange={e => set('cor', e.target.value)}
              style={{ width: 36, height: 28, borderRadius: 6, border: `1px solid ${G.border}`, cursor: 'pointer', padding: 2 }}
            />
            {form.cor && (
              <button onClick={() => set('cor', '')}
                style={{ background: 'none', border: 'none', color: G.textSec, cursor: 'pointer', fontSize: 11 }}>
                Padrão
              </button>
            )}
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: `1px solid ${G.border}`,
          background: G.card, display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, border: `1px solid ${G.border}`,
            background: 'transparent', color: G.textSec, fontSize: 13, cursor: 'pointer', fontWeight: 600,
          }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: G.text, color: '#fff', fontSize: 13, cursor: 'pointer',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {editing ? 'Salvar Alterações' : 'Criar Tarefa'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── IRIS BRIEFING PANEL ──────────────────────────────────────────────────────

function IrisBriefing() {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [briefing, setBriefing]   = useState('');
  const [meta, setMeta]           = useState<{ tarefas_hoje: number; atrasadas: number } | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    if (generated && briefing) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await api.get('/ia/briefing');
      const bText = res.data.briefing || '';
      setBriefing(bText);
      setMeta({ 
        tarefas_hoje: res.data.metadata?.visitas || 0, 
        atrasadas: res.data.metadata?.pendentes || 0 
      });
      setGenerated(true);
      // Opcional: fala automaticamente ao gerar pela primeira vez
      irisAudio.speak(bText);
    } catch (e: any) {
      setBriefing('Não foi possível gerar o briefing no momento. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      margin: '0 0 4px',
      border: `1px solid ${open ? '#FFD200' : G.border}`,
      borderRadius: 12, overflow: 'hidden',
      background: G.card,
      transition: 'border-color .2s',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => open ? setOpen(false) : generate()}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* IRIS glow dot */}
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: '#FFD200', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? '0 0 12px 3px rgba(255,210,0,0.4)' : 'none',
          transition: 'box-shadow .3s',
        }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#28374A', lineHeight: 1 }}>✦</span>
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>IRIS — Briefing do Dia</span>
          {!open && (
            <span style={{ fontSize: 11, color: G.textMuted, marginLeft: 8 }}>
              {generated ? 'Clique para ver' : 'Clique para gerar análise com IA'}
            </span>
          )}
        </div>

        {meta && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 700 }}>
            <span style={{ color: '#3B82F6' }}>{meta.tarefas_hoje} hoje</span>
            {meta.atrasadas > 0 && <span style={{ color: '#EF4444' }}>{meta.atrasadas} atrasada{meta.atrasadas > 1 ? 's' : ''}</span>}
          </div>
        )}

        <span style={{ color: G.textMuted, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Content */}
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${G.border}` }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: G.textMuted }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#FFD200' }} />
              <span style={{ fontSize: 13 }}>IRIS está analisando sua agenda...</span>
            </div>
          ) : (
            <>
              <p style={{
                fontSize: 13, color: G.textSec, lineHeight: 1.65,
                padding: '12px 0 10px', whiteSpace: 'pre-wrap',
              }}>
                {briefing}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, letterSpacing: '0.05em' }}>
                  IRIS · INTELIGÊNCIA ARTIFICIAL · SALESMASTERS V2
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => irisAudio.speak(briefing)}
                    style={{
                      fontSize: 11, color: '#FFD200', background: 'rgba(255,210,0,0.1)', border: '1px solid #FFD200',
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Play size={11} fill="#FFD200" /> Ouvir Novamente
                  </button>
                  <button
                    onClick={() => { setGenerated(false); generate(); }}
                    style={{
                      fontSize: 11, color: G.textMuted, background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <RotateCcw size={11} /> Regerar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function MinhaAgendaPage() {
  const [tasks, setTasks]         = useState<Tarefa[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterTipo, setFilterTipo]     = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [view, setView]           = useState<ViewMode>('lista');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<Tarefa | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTipo   !== 'todos') params.set('tipo',   filterTipo);
      if (filterStatus !== 'todos') params.set('status', filterStatus);
      const res = await api.get(`/agenda?${params.toString()}`);
      setTasks(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterTipo, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter(t =>
    !search || t.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (t.descricao && t.descricao.toLowerCase().includes(search.toLowerCase()))
  );

  const grouped = groupByDate(filtered);

  const handleEdit = (t: Tarefa) => { setEditing(t); setPanelOpen(true); };
  const handleNew  = ()           => { setEditing(null); setPanelOpen(true); };
  const handleClose = ()          => { setPanelOpen(false); setEditing(null); };
  const handleSaved = ()          => { handleClose(); load(); };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await api.delete(`/agenda/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao excluir.');
    }
  };

  const handleStatusChange = async (id: number, status: StatusAgenda) => {
    try {
      await api.patch(`/agenda/${id}/status`, { status });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao atualizar status.');
    }
  };

  // Estatísticas rápidas
  const today = todayISO();
  const stats = {
    pendentes:  tasks.filter(t => t.status === 'pendente').length,
    hoje:       tasks.filter(t => t.data_inicio === today && !['concluida','cancelada'].includes(t.status)).length,
    atrasadas:  tasks.filter(t => t.data_inicio < today && !['concluida','cancelada'].includes(t.status)).length,
    concluidas: tasks.filter(t => t.status === 'concluida').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: G.bg }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px', borderBottom: `1px solid ${G.border}`,
        background: G.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Calendar size={22} color={G.text} />
          <span style={{ fontWeight: 700, fontSize: 17, color: G.text }}>Minha Agenda</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex', border: `1px solid ${G.border}`, borderRadius: 8, overflow: 'hidden',
          }}>
            {(['lista', 'hoje'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: view === v ? G.text : 'transparent',
                  color: view === v ? '#fff' : G.textSec,
                }}
              >
                {v === 'lista' ? 'Lista' : 'Hoje'}
              </button>
            ))}
          </div>

          {/* New button */}
          <button
            onClick={handleNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: G.text, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* ─── STATS STRIP ────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 24px', borderBottom: `1px solid ${G.border}`,
        display: 'flex', gap: 20, background: G.card,
      }}>
        {[
          { label: 'Pendentes',  value: stats.pendentes,  color: '#6B7280' },
          { label: 'Hoje',       value: stats.hoje,       color: '#3B82F6' },
          { label: 'Atrasadas',  value: stats.atrasadas,  color: '#EF4444' },
          { label: 'Concluídas', value: stats.concluidas, color: '#10B981' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: G.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ─── FILTERS ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 24px', borderBottom: `1px solid ${G.border}`,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        background: G.bg,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
          <input
            style={{ ...inp, paddingLeft: 32, height: 34 }}
            placeholder="Buscar tarefas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tipo */}
        <select style={sel} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="todos">Todos os Tipos</option>
          {(Object.keys(TIPO_META) as TipoAgenda[]).map(t => (
            <option key={t} value={t}>{TIPO_META[t].label}</option>
          ))}
        </select>

        {/* Status */}
        <select style={sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="todos">Todos os Status</option>
          {(Object.keys(STATUS_META) as StatusAgenda[]).map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>

        {(filterTipo !== 'todos' || filterStatus !== 'todos' || search) && (
          <button
            onClick={() => { setFilterTipo('todos'); setFilterStatus('todos'); setSearch(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 7, border: `1px solid ${G.border}`,
              background: 'transparent', color: G.textSec, fontSize: 12, cursor: 'pointer',
            }}
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* ─── CONTENT ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

        {/* IRIS briefing */}
        <IrisBriefing />

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: G.textMuted, gap: 10 }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando agenda...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 200, color: G.textMuted, gap: 10,
          }}>
            <Calendar size={36} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>Nenhuma tarefa encontrada</span>
            <button
              onClick={handleNew}
              style={{
                marginTop: 8, padding: '8px 18px', borderRadius: 8,
                border: `1px solid ${G.border}`, background: G.card,
                color: G.text, fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Criar primeira tarefa
            </button>
          </div>
        ) : view === 'hoje' ? (
          // VISÃO HOJE
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const todayTasks = filtered.filter(t => t.data_inicio === today);
              if (!todayTasks.length) return (
                <div style={{ textAlign: 'center', color: G.textMuted, padding: 40, fontSize: 14 }}>
                  Nenhuma tarefa para hoje.
                </div>
              );
              return todayTasks.map(t => (
                <TarefaCard
                  key={t.id}
                  tarefa={t}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ));
            })()}
          </div>
        ) : (
          // VISÃO LISTA (agrupada por data)
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {grouped.map(([date, items]) => (
              <div key={date}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 20,
                    background: date === today ? G.text : date < today ? '#FEE2E2' : G.card,
                    color: date === today ? '#fff' : date < today ? '#EF4444' : G.text,
                    border: `1px solid ${date < today ? '#FCA5A5' : G.border}`,
                  }}>
                    {dateLabel(date)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: G.border }} />
                  <span style={{ fontSize: 11, color: G.textMuted }}>{items.length} tarefa{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(t => (
                    <TarefaCard
                      key={t.id}
                      tarefa={t}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODAL FORM ──────────────────────────────────────────────────────── */}
      <TarefaModal
        open={panelOpen}
        editing={editing}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </div>
  );
}
