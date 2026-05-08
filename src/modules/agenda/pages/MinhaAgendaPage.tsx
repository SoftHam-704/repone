import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Calendar, LayoutGrid, List, Sun,
  Clock, AlertCircle, CheckCircle2, RotateCcw, XCircle,
  Phone, Eye, Users, Briefcase, DollarSign, Bell,
  Cake, Pencil, Trash2, X, Loader2, Play, GripVertical,
  ChevronRight, ArrowRight, HelpCircle,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { irisAudio } from '@/modules/nexus-ia/services/audio-handler';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type TipoAgenda =
  | 'tarefa' | 'lembrete' | 'visita' | 'ligacao'
  | 'reuniao' | 'cobranca' | 'followup' | 'aniversario';

type StatusAgenda = 'pendente' | 'em_andamento' | 'concluida' | 'adiada' | 'cancelada';
type Prioridade   = 'A' | 'M' | 'B';
type ViewMode     = 'lista' | 'hoje' | 'kanban';

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
  titulo: string; descricao: string; tipo: TipoAgenda;
  data_inicio: string; hora_inicio: string; data_fim: string; hora_fim: string;
  dia_inteiro: boolean; status: StatusAgenda; prioridade: Prioridade;
  cliente_id: string; cliente_nome_display: string;
  pedido_codigo: string; lembrete_ativo: boolean; lembrete_antes: number; cor: string;
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const TIPO_META: Record<TipoAgenda, { label: string; color: string; bg: string; icon: any }> = {
  tarefa:      { label: 'Tarefa',      color: '#3B82F6', bg: '#DBEAFE', icon: CheckCircle2 },
  lembrete:    { label: 'Lembrete',    color: '#F59E0B', bg: '#FEF3C7', icon: Bell         },
  visita:      { label: 'Visita',      color: '#10B981', bg: '#D1FAE5', icon: Eye          },
  ligacao:     { label: 'Ligação',     color: '#06B6D4', bg: '#CFFAFE', icon: Phone        },
  reuniao:     { label: 'Reunião',     color: '#8B5CF6', bg: '#EDE9FE', icon: Users        },
  cobranca:    { label: 'Cobrança',    color: '#EF4444', bg: '#FEE2E2', icon: DollarSign   },
  followup:    { label: 'Follow-up',   color: '#F97316', bg: '#FFEDD5', icon: Briefcase    },
  aniversario: { label: 'Aniversário', color: '#EC4899', bg: '#FCE7F3', icon: Cake         },
};

const STATUS_META: Record<StatusAgenda, { label: string; color: string; bg: string; icon: any }> = {
  pendente:     { label: 'Pendente',      color: '#6B7280', bg: '#F3F4F6', icon: Clock        },
  em_andamento: { label: 'Em Andamento',  color: '#3B82F6', bg: '#DBEAFE', icon: RotateCcw    },
  concluida:    { label: 'Concluída',     color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  adiada:       { label: 'Adiada',        color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle  },
  cancelada:    { label: 'Cancelada',     color: '#EF4444', bg: '#FEE2E2', icon: XCircle      },
};

const PRIOR_META: Record<Prioridade, { label: string; color: string; dot: string }> = {
  A: { label: 'Alta',  color: '#EF4444', dot: '#EF4444' },
  M: { label: 'Média', color: '#F59E0B', dot: '#F59E0B' },
  B: { label: 'Baixa', color: '#9CA3AF', dot: '#9CA3AF' },
};

const KANBAN_COLS: Array<{ key: StatusAgenda; label: string; color: string; bg: string; border: string }> = [
  { key: 'pendente',     label: 'A Fazer',       color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  { key: 'em_andamento', label: 'Em Andamento',  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'concluida',    label: 'Concluída',     color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const todayISO   = () => new Date().toISOString().split('T')[0];
const isoDate    = (v: string) => String(v || '').substring(0, 10);
const fmtHora    = (h: string | null) => h ? h.substring(0, 5) : '';

function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function dateLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return 'Hoje';
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  if (iso === tom.toISOString().split('T')[0]) return 'Amanhã';
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (iso === yest.toISOString().split('T')[0]) return 'Ontem';
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}`;
}

function dateBadgeStyle(iso: string, status: StatusAgenda) {
  const today = todayISO();
  const done = ['concluida', 'cancelada'].includes(status);
  if (done) return { color: '#9CA3AF', bg: 'transparent' };
  if (iso < today) return { color: '#EF4444', bg: '#FEF2F2' };
  if (iso === today) return { color: '#2563EB', bg: '#EFF6FF' };
  return { color: '#6B7280', bg: 'transparent' };
}

function groupByDate(tasks: Tarefa[]): [string, Tarefa[]][] {
  const map: Record<string, Tarefa[]> = {};
  for (const t of tasks) {
    const key = isoDate(t.data_inicio);
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

const emptyForm = (): TarefaForm => ({
  titulo: '', descricao: '', tipo: 'tarefa',
  data_inicio: todayISO(), hora_inicio: '', data_fim: '', hora_fim: '',
  dia_inteiro: false, status: 'pendente', prioridade: 'M',
  cliente_id: '', cliente_nome_display: '',
  pedido_codigo: '', lembrete_ativo: true, lembrete_antes: 15, cor: '',
});

// ─── STYLE ATOMS ─────────────────────────────────────────────────────────────

const sel: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${G.border}`,
  background: G.card, color: G.text, fontSize: 13, paddingLeft: 10, paddingRight: 8,
  cursor: 'pointer', outline: 'none',
};
const inp: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${G.border}`,
  background: G.card, color: G.text, fontSize: 13, padding: '0 10px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};

// ─── BADGE COMPONENTS ────────────────────────────────────────────────────────

function TipoBadge({ tipo, small }: { tipo: TipoAgenda; small?: boolean }) {
  const m = TIPO_META[tipo];
  const Icon = m.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: small ? 3 : 4,
      padding: small ? '1px 6px' : '2px 8px', borderRadius: 20,
      background: m.bg, color: m.color, fontSize: small ? 10 : 11, fontWeight: 600,
    }}>
      <Icon size={small ? 10 : 11} />{m.label}
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
      <Icon size={11} />{m.label}
    </span>
  );
}

// ─── CLIENTE SEARCH ───────────────────────────────────────────────────────────

interface ClienteOpt { cli_codigo: number; cli_nomred: string; cli_nome?: string }

function ClienteSearch({ value, displayValue, onChange }: {
  value: string; displayValue: string;
  onChange: (id: string, nome: string) => void;
}) {
  const [query, setQuery]     = useState(displayValue);
  const [opts, setOpts]       = useState<ClienteOpt[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [rect, setRect]       = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref      = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(displayValue); }, [displayValue]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setOpts([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get(`/clientes?search=${encodeURIComponent(query)}&limit=15`);
        setOpts(r.data.data || []);
        if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
        setOpen(true);
      } catch { setOpts([]); }
      finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const dropdownStyle: React.CSSProperties = rect ? {
    position: 'fixed',
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width,
    zIndex: 99999,
    background: G.card,
    border: `1px solid ${G.border}`,
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    maxHeight: 240,
    overflowY: 'auto',
  } : {};

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Users size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          style={{ ...inp, paddingLeft: 30 }}
          value={query}
          placeholder="Buscar pelo nome do cliente..."
          onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange('', ''); }}
          onFocus={() => {
            if (opts.length && inputRef.current) {
              setRect(inputRef.current.getBoundingClientRect());
              setOpen(true);
            }
          }}
        />
        {loading && <Loader2 size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, animation: 'spin 1s linear infinite' }} />}
        {value && !loading && (
          <button onClick={() => { onChange('', ''); setQuery(''); setOpts([]); setOpen(false); }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: G.textMuted, padding: 2 }}>
            <X size={12} />
          </button>
        )}
      </div>
      {open && opts.length > 0 && (
        <div style={dropdownStyle}>
          {opts.map(c => (
            <div
              key={c.cli_codigo}
              onMouseDown={() => { onChange(String(c.cli_codigo), c.cli_nomred); setQuery(c.cli_nomred); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${G.border}`, fontSize: 13, color: G.text }}
              onMouseEnter={e => (e.currentTarget.style.background = G.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontWeight: 700 }}>{c.cli_nomred}</span>
              {c.cli_nome && c.cli_nome !== c.cli_nomred && (
                <div style={{ fontSize: 11, color: G.textMuted, marginTop: 1 }}>{c.cli_nome}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KANBAN CARD ─────────────────────────────────────────────────────────────

interface KanbanCardProps {
  tarefa: Tarefa;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, s: StatusAgenda) => void;
  nextStatus?: StatusAgenda;
}

function KanbanCard({ tarefa: t, isDragging, onDragStart, onDragEnd, onEdit, onDelete, onStatusChange, nextStatus }: KanbanCardProps) {
  const today = todayISO();
  const date  = isoDate(t.data_inicio);
  const done  = ['concluida', 'cancelada'].includes(t.status);
  const late  = !done && date < today;
  const ds    = dateBadgeStyle(date, t.status);
  const Icon  = TIPO_META[t.tipo]?.icon || CheckCircle2;
  const accentColor = t.cor || TIPO_META[t.tipo]?.color || G.border;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: G.card,
        border: `1px solid ${late ? '#FCA5A5' : G.border}`,
        borderRadius: 10,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.06)',
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? 'rotate(2deg)' : 'none',
        transition: 'box-shadow .15s, opacity .15s, transform .15s',
        overflow: 'hidden',
        cursor: 'grab',
        position: 'relative',
      }}
    >
      {/* colored top accent bar */}
      <div style={{ height: 3, background: accentColor, opacity: done ? 0.3 : 1 }} />

      <div style={{ padding: '10px 12px' }}>
        {/* Row 1: tipo badge + prioridade dot + grip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <TipoBadge tipo={t.tipo} small />
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIOR_META[t.prioridade].dot, flexShrink: 0, marginLeft: 'auto' }} title={`Prioridade ${PRIOR_META[t.prioridade].label}`} />
          <GripVertical size={12} style={{ color: G.border, flexShrink: 0 }} />
        </div>

        {/* Title */}
        <p style={{
          margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: G.text, lineHeight: 1.4,
          textDecoration: done ? 'line-through' : 'none',
          opacity: done ? 0.6 : 1,
        }}>
          {t.titulo}
        </p>

        {/* Cliente */}
        {t.cliente_nome && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: accentColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={10} style={{ color: accentColor }} />
            </div>
            <span style={{ fontSize: 11, color: G.textSec, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.cliente_nome}
            </span>
          </div>
        )}

        {/* Pedido */}
        {t.pedido_codigo && (
          <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 5 }}>
            Pedido #{t.pedido_codigo}
          </div>
        )}

        {/* Date + time row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
            background: ds.bg, color: ds.color,
          }}>
            {late ? '⚠ ' : ''}{dateLabel(date)}
          </span>
          {t.hora_inicio && (
            <span style={{ fontSize: 10, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={9} /> {fmtHora(t.hora_inicio)}
            </span>
          )}
          {t.status === 'adiada' && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', marginLeft: 'auto' }}>Adiada</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: `1px solid ${G.border}`, paddingTop: 8 }}>
          {!done && (
            <button title="Concluir" onClick={() => onStatusChange(t.id, 'concluida')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid #D1FAE5`, background: '#F0FDF4', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              <CheckCircle2 size={12} /> Concluir
            </button>
          )}
          {nextStatus && !done && (
            <button title={`Mover para ${STATUS_META[nextStatus].label}`} onClick={() => onStatusChange(t.id, nextStatus)}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer', fontSize: 11 }}>
              <ArrowRight size={11} />
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <button onClick={() => onEdit(t)} title="Editar"
              style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: G.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete(t.id)} title="Excluir"
              style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KANBAN VIEW ─────────────────────────────────────────────────────────────

interface KanbanViewProps {
  tasks: Tarefa[];
  onEdit: (t: Tarefa) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, s: StatusAgenda) => void;
  onNew: (defaultStatus?: StatusAgenda) => void;
}

function KanbanView({ tasks, onEdit, onDelete, onStatusChange, onNew }: KanbanViewProps) {
  const [dragId,     setDragId]     = useState<number | null>(null);
  const [dragOver,   setDragOver]   = useState<StatusAgenda | null>(null);

  const getColTasks = (key: StatusAgenda) => {
    if (key === 'pendente') return tasks.filter(t => t.status === 'pendente' || t.status === 'adiada');
    return tasks.filter(t => t.status === key);
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16, height: '100%', alignItems: 'start',
    }}>
      {KANBAN_COLS.map((col, ci) => {
        const colTasks  = getColTasks(col.key);
        const late      = colTasks.filter(t => isoDate(t.data_inicio) < todayISO() && !['concluida','cancelada'].includes(t.status)).length;
        const isOver    = dragOver === col.key;
        const nextCol   = KANBAN_COLS[ci + 1];

        return (
          <div
            key={col.key}
            onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => {
              if (dragId !== null) { onStatusChange(dragId, col.key); }
              setDragOver(null);
            }}
            style={{
              background: isOver ? col.border + '55' : col.bg,
              border: `2px solid ${isOver ? col.color : col.border}`,
              borderRadius: 14, overflow: 'hidden',
              transition: 'border-color .15s, background .15s',
              minHeight: 200,
            }}
          >
            {/* Column header */}
            <div style={{
              padding: '12px 14px',
              borderBottom: `1px solid ${col.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: 13, color: col.color, flex: 1 }}>{col.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: col.color + '18', color: col.color,
              }}>
                {colTasks.length}
              </span>
              {late > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: '#FEF2F2', padding: '1px 6px', borderRadius: 8 }}>
                  {late} atras.
                </span>
              )}
            </div>

            {/* Cards */}
            <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {colTasks.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '24px 16px',
                  color: G.textMuted, fontSize: 12,
                  border: `2px dashed ${col.border}`, borderRadius: 10,
                }}>
                  {isOver
                    ? <span style={{ color: col.color, fontWeight: 700 }}>Solte aqui</span>
                    : <span>Nenhuma tarefa aqui</span>
                  }
                </div>
              ) : (
                colTasks.map(t => (
                  <KanbanCard
                    key={t.id}
                    tarefa={t}
                    isDragging={dragId === t.id}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    nextStatus={nextCol?.key}
                  />
                ))
              )}

              {/* Add card button */}
              <button
                onClick={() => onNew(col.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '7px', borderRadius: 8,
                  border: `1px dashed ${col.border}`, background: 'transparent',
                  color: G.textMuted, fontSize: 12, cursor: 'pointer',
                  transition: 'color .15s, border-color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = col.color; e.currentTarget.style.borderColor = col.color; }}
                onMouseLeave={e => { e.currentTarget.style.color = G.textMuted; e.currentTarget.style.borderColor = col.border; }}
              >
                <Plus size={13} /> Adicionar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAREFA CARD (lista) ──────────────────────────────────────────────────────

function TarefaCard({ tarefa: t, onEdit, onDelete, onStatusChange }: {
  tarefa: Tarefa;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, s: StatusAgenda) => void;
}) {
  const today = todayISO();
  const isPast = isoDate(t.data_inicio) < today && !['concluida','cancelada'].includes(t.status);
  const Icon   = TIPO_META[t.tipo]?.icon || CheckCircle2;

  return (
    <div style={{
      background: G.card,
      border: `1px solid ${isPast ? '#FCA5A5' : G.border}`,
      borderLeft: `4px solid ${t.cor || TIPO_META[t.tipo]?.color || G.border}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      opacity: ['concluida','cancelada'].includes(t.status) ? 0.65 : 1,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: TIPO_META[t.tipo]?.bg || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TIPO_META[t.tipo]?.color || G.textSec }}>
        <Icon size={16} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: G.text, textDecoration: ['concluida','cancelada'].includes(t.status) ? 'line-through' : 'none' }}>
            {t.titulo}
          </span>
          <TipoBadge tipo={t.tipo} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIOR_META[t.prioridade].dot, flexShrink: 0 }} title={`Prioridade ${PRIOR_META[t.prioridade].label}`} />
        </div>

        {t.descricao && (
          <p style={{ fontSize: 12, color: G.textSec, margin: '4px 0 0', lineHeight: 1.5 }}>{t.descricao}</p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {t.hora_inicio && (
            <span style={{ fontSize: 12, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> {fmtHora(t.hora_inicio)}
              {t.hora_fim ? ` — ${fmtHora(t.hora_fim)}` : ''}
            </span>
          )}
          {t.cliente_nome && (
            <span style={{ fontSize: 12, color: G.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Users size={11} /> {t.cliente_nome}
            </span>
          )}
          {t.pedido_codigo && (
            <span style={{ fontSize: 12, color: G.textMuted }}>Pedido #{t.pedido_codigo}</span>
          )}
          {isPast && <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>Atrasada</span>}
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {!['concluida','cancelada'].includes(t.status) && (
          <button title="Concluir" onClick={() => onStatusChange(t.id, 'concluida')}
            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={14} />
          </button>
        )}
        <button title="Editar" onClick={() => onEdit(t)}
          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: G.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Pencil size={13} />
        </button>
        <button title="Excluir" onClick={() => onDelete(t.id)}
          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── FORMULÁRIO MODAL ────────────────────────────────────────────────────────

function TarefaModal({ open, editing, defaultStatus, onClose, onSaved }: {
  open: boolean; editing: Tarefa | null; defaultStatus?: StatusAgenda;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm]     = useState<TarefaForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (editing) {
      setForm({
        titulo: editing.titulo, descricao: editing.descricao || '',
        tipo: editing.tipo, data_inicio: editing.data_inicio,
        hora_inicio: fmtHora(editing.hora_inicio), data_fim: editing.data_fim || '',
        hora_fim: fmtHora(editing.hora_fim), dia_inteiro: editing.dia_inteiro,
        status: editing.status, prioridade: editing.prioridade,
        cliente_id: editing.cliente_id ? String(editing.cliente_id) : '',
        cliente_nome_display: editing.cliente_nome || '',
        pedido_codigo: editing.pedido_codigo || '',
        lembrete_ativo: editing.lembrete_ativo, lembrete_antes: editing.lembrete_antes,
        cor: editing.cor || '',
      });
    } else {
      const base = emptyForm();
      if (defaultStatus) base.status = defaultStatus;
      setForm(base);
    }
    setError('');
  }, [editing, open, defaultStatus]);

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
      if (editing) await api.put(`/agenda/${editing.id}`, payload);
      else          await api.post('/agenda', payload);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: '90vh', zIndex: 1001,
        background: G.bg, borderRadius: 16, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: `1px solid ${G.border}`,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G.border}`, background: G.card, borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: TIPO_META[form.tipo]?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TIPO_META[form.tipo]?.color }}>
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
            <span style={lbl}>Tipo</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(TIPO_META) as TipoAgenda[]).map(t => {
                const m = TIPO_META[t]; const Icon = m.icon; const active = form.tipo === t;
                return (
                  <button key={t} onClick={() => set('tipo', t)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: active ? `1.5px solid ${m.color}` : `1px solid ${G.border}`, background: active ? m.bg : G.card, color: active ? m.color : G.textSec }}>
                    <Icon size={12} />{m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <span style={lbl}>Título *</span>
            <input style={inp} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Descreva a tarefa..." />
          </div>

          {/* Descrição */}
          <div>
            <span style={lbl}>Descrição</span>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Detalhes adicionais..." rows={3}
              style={{ ...inp, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          {/* Cliente */}
          <div>
            <span style={lbl}>Cliente</span>
            <ClienteSearch
              value={form.cliente_id}
              displayValue={form.cliente_nome_display}
              onChange={(id, nome) => { set('cliente_id', id); set('cliente_nome_display', nome); }}
            />
          </div>

          {/* Data e Hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <span style={lbl}>Data Início *</span>
              <input type="date" style={inp} value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
            </div>
            <div>
              <span style={lbl}>Hora</span>
              <input type="time" style={inp} value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
            </div>
            <div>
              <span style={lbl}>Data Fim</span>
              <input type="date" style={inp} value={form.data_fim} onChange={e => set('data_fim', e.target.value)} />
            </div>
            <div>
              <span style={lbl}>Hora Fim</span>
              <input type="time" style={inp} value={form.hora_fim} onChange={e => set('hora_fim', e.target.value)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.dia_inteiro} onChange={e => set('dia_inteiro', e.target.checked)} />
            <span style={{ fontSize: 13, color: G.text }}>Dia inteiro</span>
          </label>

          {/* Status + Prioridade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <span style={lbl}>Status</span>
              <select style={{ ...sel, width: '100%' }} value={form.status} onChange={e => set('status', e.target.value as StatusAgenda)}>
                {(Object.keys(STATUS_META) as StatusAgenda[]).map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <span style={lbl}>Prioridade</span>
              <select style={{ ...sel, width: '100%' }} value={form.prioridade} onChange={e => set('prioridade', e.target.value as Prioridade)}>
                <option value="A">Alta</option>
                <option value="M">Média</option>
                <option value="B">Baixa</option>
              </select>
            </div>
          </div>

          {/* Pedido */}
          <div>
            <span style={lbl}>Nº do Pedido</span>
            <input style={inp} value={form.pedido_codigo} onChange={e => set('pedido_codigo', e.target.value)} placeholder="Ex: HS001234" />
          </div>

          {/* Lembrete */}
          <div style={{ background: G.card, borderRadius: 9, padding: 12, border: `1px solid ${G.border}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={form.lembrete_ativo} onChange={e => set('lembrete_ativo', e.target.checked)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                <Bell size={13} style={{ display: 'inline', marginRight: 4 }} />Lembrete
              </span>
            </label>
            {form.lembrete_ativo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={5} max={1440} style={{ ...inp, width: 80 }} value={form.lembrete_antes} onChange={e => set('lembrete_antes', parseInt(e.target.value) || 15)} />
                <span style={{ fontSize: 12, color: G.textSec }}>minutos antes</span>
              </div>
            )}
          </div>

          {/* Cor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...lbl, marginBottom: 0 }}>Cor</span>
            <input type="color" value={form.cor || TIPO_META[form.tipo]?.color || '#3B82F6'}
              onChange={e => set('cor', e.target.value)}
              style={{ width: 36, height: 28, borderRadius: 6, border: `1px solid ${G.border}`, cursor: 'pointer', padding: 2 }} />
            {form.cor && (
              <button onClick={() => set('cor', '')} style={{ background: 'none', border: 'none', color: G.textSec, cursor: 'pointer', fontSize: 11 }}>Padrão</button>
            )}
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${G.border}`, background: G.card, borderRadius: '0 0 16px 16px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: G.text, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {editing ? 'Salvar Alterações' : 'Criar Tarefa'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── IRIS BRIEFING ────────────────────────────────────────────────────────────

function IrisBriefing() {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [briefing, setBriefing]   = useState('');
  const [meta, setMeta]           = useState<{ tarefas_hoje: number; atrasadas: number } | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    if (generated && briefing) { setOpen(true); return; }
    setOpen(true); setLoading(true);
    try {
      const res = await api.get('/ia/briefing');
      const bText = res.data.briefing || '';
      setBriefing(bText);
      setMeta({ tarefas_hoje: res.data.metadata?.visitas || 0, atrasadas: res.data.metadata?.pendentes || 0 });
      setGenerated(true);
      irisAudio.speak(bText);
    } catch {
      setBriefing('Não foi possível gerar o briefing no momento. Verifique sua conexão e tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom: 4, border: `1px solid ${open ? '#FFD200' : G.border}`, borderRadius: 12, overflow: 'hidden', background: G.card, transition: 'border-color .2s' }}>
      <button onClick={() => open ? setOpen(false) : generate()} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#FFD200', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: open ? '0 0 12px 3px rgba(255,210,0,0.4)' : 'none', transition: 'box-shadow .3s' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#28374A', lineHeight: 1 }}>✦</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>IRIS — Briefing do Dia</span>
          {!open && <span style={{ fontSize: 11, color: G.textMuted, marginLeft: 8 }}>{generated ? 'Clique para ver' : 'Clique para gerar análise com IA'}</span>}
        </div>
        {meta && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 700 }}>
            <span style={{ color: '#3B82F6' }}>{meta.tarefas_hoje} hoje</span>
            {meta.atrasadas > 0 && <span style={{ color: '#EF4444' }}>{meta.atrasadas} atrasada{meta.atrasadas > 1 ? 's' : ''}</span>}
          </div>
        )}
        <span style={{ color: G.textMuted, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${G.border}` }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: G.textMuted }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#FFD200' }} />
              <span style={{ fontSize: 13 }}>IRIS está analisando sua agenda...</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: G.textSec, lineHeight: 1.65, padding: '12px 0 10px', whiteSpace: 'pre-wrap' }}>{briefing}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, letterSpacing: '0.05em' }}>IRIS · INTELIGÊNCIA ARTIFICIAL · SALESMASTERS V2</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => irisAudio.speak(briefing)} style={{ fontSize: 11, color: '#FFD200', background: 'rgba(255,210,0,0.1)', border: '1px solid #FFD200', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Play size={11} fill="#FFD200" /> Ouvir
                  </button>
                  <button onClick={() => { setGenerated(false); generate(); }} style={{ fontSize: 11, color: G.textMuted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
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

const VIEW_CONFIG = [
  { key: 'lista'  as ViewMode, label: 'Lista',   icon: List       },
  { key: 'hoje'   as ViewMode, label: 'Hoje',    icon: Sun        },
  { key: 'kanban' as ViewMode, label: 'Kanban',  icon: LayoutGrid },
];

export default function MinhaAgendaPage() {
  const [tasks, setTasks]               = useState<Tarefa[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterTipo, setFilterTipo]     = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [view, setView]                 = useState<ViewMode>('lista');
  const [modalOpen, setModalOpen]       = useState(false);
  const [editing, setEditing]           = useState<Tarefa | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<StatusAgenda | undefined>();
  const [helpOpen, setHelpOpen]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTipo   !== 'todos') params.set('tipo',   filterTipo);
      if (filterStatus !== 'todos') params.set('status', filterStatus);
      const res = await api.get(`/agenda?${params.toString()}`);
      setTasks(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterTipo, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter(t =>
    !search ||
    t.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (t.descricao && t.descricao.toLowerCase().includes(search.toLowerCase())) ||
    (t.cliente_nome && t.cliente_nome.toLowerCase().includes(search.toLowerCase()))
  );
  const grouped = groupByDate(filtered);
  const today   = todayISO();

  const handleEdit   = (t: Tarefa)         => { setEditing(t); setDefaultStatus(undefined); setModalOpen(true); };
  const handleNew    = (ds?: StatusAgenda) => { setEditing(null); setDefaultStatus(ds); setModalOpen(true); };
  const handleClose  = ()                  => { setModalOpen(false); setEditing(null); setDefaultStatus(undefined); };
  const handleSaved  = ()                  => { handleClose(); load(); };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta tarefa?')) return;
    try { await api.delete(`/agenda/${id}`); setTasks(prev => prev.filter(t => t.id !== id)); }
    catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
  };

  const handleStatusChange = async (id: number, status: StatusAgenda) => {
    try {
      await api.patch(`/agenda/${id}/status`, { status });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) { alert(e.response?.data?.message || 'Erro ao atualizar status.'); }
  };

  const stats = {
    pendentes:  tasks.filter(t => t.status === 'pendente').length,
    hoje:       tasks.filter(t => isoDate(t.data_inicio) === today && !['concluida','cancelada'].includes(t.status)).length,
    atrasadas:  tasks.filter(t => isoDate(t.data_inicio) < today && !['concluida','cancelada'].includes(t.status)).length,
    concluidas: tasks.filter(t => t.status === 'concluida').length,
  };

  const isKanban = view === 'kanban';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: G.bg }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${G.border}`, background: G.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={20} color={G.text} />
          <span style={{ fontWeight: 800, fontSize: 16, color: G.text }}>Minha Agenda</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: `1px solid ${G.border}`, borderRadius: 9, overflow: 'hidden', background: G.bg }}>
            {VIEW_CONFIG.map(v => {
              const Icon = v.icon;
              const active = view === v.key;
              return (
                <button key={v.key} onClick={() => setView(v.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: active ? G.text : 'transparent', color: active ? '#fff' : G.textSec, transition: 'background .15s' }}>
                  <Icon size={13} />{v.label}
                </button>
              );
            })}
          </div>

          <button onClick={() => setHelpOpen(true)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.textMuted }} title="Ajuda">
            <HelpCircle size={16} />
          </button>

          <button onClick={() => handleNew()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: G.text, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div style={{ padding: '8px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 24, background: G.card, alignItems: 'center' }}>
        {[
          { label: 'Pendentes',  value: stats.pendentes,  color: '#64748B' },
          { label: 'Hoje',       value: stats.hoje,       color: '#2563EB' },
          { label: 'Atrasadas',  value: stats.atrasadas,  color: '#EF4444' },
          { label: 'Concluídas', value: stats.concluidas, color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div style={{ padding: '8px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: G.bg }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
          <input style={{ ...inp, paddingLeft: 30, height: 32, fontSize: 12 }} placeholder="Buscar tarefas ou clientes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ ...sel, height: 32, fontSize: 12 }} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="todos">Todos os Tipos</option>
          {(Object.keys(TIPO_META) as TipoAgenda[]).map(t => <option key={t} value={t}>{TIPO_META[t].label}</option>)}
        </select>
        {!isKanban && (
          <select style={{ ...sel, height: 32, fontSize: 12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="todos">Todos os Status</option>
            {(Object.keys(STATUS_META) as StatusAgenda[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        {(filterTipo !== 'todos' || filterStatus !== 'todos' || search) && (
          <button onClick={() => { setFilterTipo('todos'); setFilterStatus('todos'); setSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, fontSize: 12, cursor: 'pointer' }}>
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: isKanban ? 'hidden' : 'auto', padding: isKanban ? '16px 20px' : '16px 24px', display: 'flex', flexDirection: 'column', gap: isKanban ? 0 : 0 }}>

        {!isKanban && <IrisBriefing />}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: G.textMuted, gap: 10 }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando agenda...
          </div>

        ) : isKanban ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <KanbanView tasks={filtered} onEdit={handleEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} onNew={handleNew} />
          </div>

        ) : view === 'hoje' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const todayTasks = filtered.filter(t => isoDate(t.data_inicio) === today);
              if (!todayTasks.length) return <div style={{ textAlign: 'center', color: G.textMuted, padding: 40, fontSize: 14 }}>Nenhuma tarefa para hoje.</div>;
              return todayTasks.map(t => (
                <TarefaCard key={t.id} tarefa={t} onEdit={handleEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} />
              ));
            })()}
          </div>

        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: G.textMuted, gap: 10 }}>
            <Calendar size={36} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>Nenhuma tarefa encontrada</span>
            <button onClick={() => handleNew()} style={{ marginTop: 8, padding: '8px 18px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, color: G.text, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              Criar primeira tarefa
            </button>
          </div>

        ) : (
          // Lista agrupada por data
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {grouped.map(([date, items]) => (
              <div key={date}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: date === today ? G.text : date < today ? '#FEE2E2' : G.card, color: date === today ? '#fff' : date < today ? '#EF4444' : G.text, border: `1px solid ${date < today ? '#FCA5A5' : G.border}` }}>
                    {date === today ? `Hoje — ${fmtDate(date)}` : date < today ? `Atrasado — ${fmtDate(date)}` : fmtDate(date)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: G.border }} />
                  <span style={{ fontSize: 11, color: G.textMuted }}>{items.length} tarefa{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(t => (
                    <TarefaCard key={t.id} tarefa={t} onEdit={handleEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TarefaModal open={modalOpen} editing={editing} defaultStatus={defaultStatus} onClose={handleClose} onSaved={handleSaved} />

      {/* ── MODAL DE AJUDA ── */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(40,55,74,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: G.card, borderRadius: 18, width: '100%', maxWidth: 580, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: G.text }}>Como usar a Agenda</h2>
                  <p style={{ margin: 0, fontSize: 11, color: G.textMuted }}>Guia rápido de todas as funcionalidades</p>
                </div>
              </div>
              <button onClick={() => setHelpOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: G.textMuted, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Views */}
              {[
                {
                  icon: List, color: '#3B82F6', title: 'Vista Lista',
                  desc: 'Todas as tarefas organizadas por data. Tarefas atrasadas aparecem em vermelho no topo. Use os filtros para encontrar por tipo ou status.',
                },
                {
                  icon: Sun, color: '#F59E0B', title: 'Vista Hoje',
                  desc: 'Foco total no dia atual. Mostra apenas as tarefas de hoje — ideal para começar o dia sabendo exatamente o que precisa ser feito.',
                },
                {
                  icon: LayoutGrid, color: '#7C3AED', title: 'Vista Kanban',
                  desc: 'Três colunas: A Fazer → Em Andamento → Concluída. Arraste os cards entre colunas para atualizar o status instantaneamente.',
                },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 12, background: G.bg, border: `1px solid ${G.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color={color} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: G.text }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: G.textMuted, lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}

              {/* Tipos */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Tipos de Tarefa</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(Object.entries(TIPO_META) as [TipoAgenda, typeof TIPO_META[TipoAgenda]][]).map(([key, m]) => {
                    const Icon = m.icon;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: m.bg + '80', border: `1px solid ${m.color}22` }}>
                        <Icon size={13} color={m.color} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dicas rápidas */}
              <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: 0.6 }}>Dicas Rápidas</p>
                {[
                  'No Kanban, clique em "+" em qualquer coluna para criar a tarefa já no status certo.',
                  'Cards com data vermelha estão atrasados — atenção imediata.',
                  'A seta → avança o card para a próxima coluna sem precisar arrastar.',
                  'Clique no nome do cliente para buscar diretamente pelo nome reduzido.',
                  'Prioridade Alta (A) aparece com ponto vermelho no card do Kanban.',
                ].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 4 ? 8 : 0 }}>
                    <span style={{ fontSize: 12, color: '#0284C7', fontWeight: 800, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: 12, color: '#0369A1', lineHeight: 1.6 }}>{tip}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
