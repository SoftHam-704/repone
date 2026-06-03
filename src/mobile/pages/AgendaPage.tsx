import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import {
  Plus, Loader2, CheckCircle2, Trash2, Clock,
  Eye, Phone, Users, DollarSign, Briefcase,
  Bell, AlertTriangle, X, Calendar, RotateCcw, Sparkles, Pencil, Cake,
} from 'lucide-react';
import { api }           from '@/shared/lib/api';
import { MobileHeader }  from '../components/MobileHeader';

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface AgendaItem {
  id:           number;
  titulo:       string;
  descricao:    string | null;
  tipo:         string;
  data_inicio:  string;
  hora_inicio:  string | null;
  status:       string;
  prioridade:   string;
  cliente_id:   number | null;
  cliente_nome: string | null;
}

interface Resumo {
  tarefas_hoje: number;
  atrasadas:    number;
  pendentes:    number;
  concluidas:   number;
}

/* ─── meta ───────────────────────────────────────────────────────────────────── */
const TIPOS: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  tarefa:      { label: 'Tarefa',      color: '#3B82F6', Icon: CheckCircle2 },
  lembrete:    { label: 'Lembrete',    color: '#F59E0B', Icon: Bell         },
  visita:      { label: 'Visita',      color: '#10B981', Icon: Eye          },
  ligacao:     { label: 'Ligação',     color: '#06B6D4', Icon: Phone        },
  reuniao:     { label: 'Reunião',     color: '#8B5CF6', Icon: Users        },
  cobranca:    { label: 'Cobrança',    color: '#EF4444', Icon: DollarSign   },
  followup:    { label: 'Follow-up',   color: '#F97316', Icon: Briefcase    },
  aniversario: { label: 'Aniversário', color: '#EC4899', Icon: Cake         },
};
const tipoMeta = (t: string) => TIPOS[t] ?? { label: t, color: '#64748B', Icon: Calendar };

const PRIOR_COLOR: Record<string, string> = { A: '#DC2626', M: '#D97706', B: '#059669' };
const PRIOR_LABEL: Record<string, string> = { A: 'Alta', M: 'Média', B: 'Baixa' };

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);

/* ─── IrisBriefing ───────────────────────────────────────────────────────────── */
function IrisBriefing() {
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [briefing,  setBriefing]  = useState('');
  const [generated, setGenerated] = useState(false);
  const [meta,      setMeta]      = useState<{ visitas: number; pendentes: number } | null>(null);

  const generate = async () => {
    if (generated && briefing) { setOpen(true); return; }
    setOpen(true); setLoading(true);
    try {
      const res = await api.get('/ia/briefing');
      setBriefing(res.data.briefing || '');
      setMeta({ visitas: res.data.metadata?.visitas || 0, pendentes: res.data.metadata?.pendentes || 0 });
      setGenerated(true);
    } catch {
      setBriefing('Não foi possível gerar o briefing. Verifique sua conexão e tente novamente.');
    } finally { setLoading(false); }
  };

  const regerar = async () => {
    setGenerated(false); setBriefing(''); setLoading(true);
    try {
      const res = await api.get('/ia/briefing');
      setBriefing(res.data.briefing || '');
      setMeta({ visitas: res.data.metadata?.visitas || 0, pendentes: res.data.metadata?.pendentes || 0 });
      setGenerated(true);
    } catch {
      setBriefing('Erro ao gerar briefing.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      margin: '0 16px 10px',
      border: `1px solid ${open ? 'rgba(255,210,0,0.6)' : 'rgba(40,55,74,0.12)'}`,
      borderRadius: 14, overflow: 'hidden',
      background: '#FFF', transition: 'border-color .2s',
    }}>
      {/* trigger row */}
      <button
        onClick={() => open ? setOpen(false) : generate()}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: '#FFD200', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? '0 0 10px 2px rgba(255,210,0,0.45)' : 'none', transition: 'box-shadow .3s',
        }}>
          <Sparkles size={15} color="#28374A" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>IRIS — Briefing do Dia</div>
          {!open && (
            <div style={{ fontSize: 11, color: 'var(--navy-muted)' }}>
              {generated ? 'Clique para ver' : 'Clique para gerar análise com IA'}
            </div>
          )}
        </div>
        {meta && !open && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            <span style={{ color: '#2563EB' }}>{meta.visitas} hoje</span>
            {meta.pendentes > 0 && <span style={{ color: '#EF4444' }}>{meta.pendentes} atr.</span>}
          </div>
        )}
        <span style={{ color: 'var(--navy-muted)', fontSize: 11, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* body */}
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(40,55,74,0.08)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--navy-muted)' }}>
              <Loader2 size={15} style={{ animation: 'spin 0.9s linear infinite', color: '#FFD200' }} />
              <span style={{ fontSize: 13 }}>IRIS está analisando sua agenda...</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.65,
                padding: '12px 0 10px', margin: 0, whiteSpace: 'pre-wrap' }}>
                {briefing}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--navy-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  IRIS · SALESMASTERS V2
                </span>
                <button onClick={regerar} disabled={loading}
                  style={{ fontSize: 11, color: 'var(--navy-muted)', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                  <RotateCcw size={11} /> Regerar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── TaskCard ───────────────────────────────────────────────────────────────── */
function TaskCard({ item, onComplete, onDelete, onEdit }: {
  item:       AgendaItem;
  onComplete: (id: number) => void;
  onDelete:   (id: number) => void;
  onEdit:     (item: AgendaItem) => void;
}) {
  const meta      = tipoMeta(item.tipo);
  const Icon      = meta.Icon;
  const isDone    = item.status === 'concluida' || item.status === 'cancelada';
  const isAdiada  = item.status === 'adiada';
  const isAndamento = item.status === 'em_andamento';
  const isLate    = !isDone && item.data_inicio < todayStr();
  const priorClr  = PRIOR_COLOR[item.prioridade] ?? '#64748B';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      background: isDone ? '#F8F9FA' : '#FFF',
      opacity: isDone ? 0.65 : 1,
      borderLeft: `3px solid ${isLate ? '#DC2626' : meta.color}`,
    }}>
      {/* tipo icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${meta.color}18`,
      }}>
        <Icon size={16} color={meta.color} />
      </div>

      {/* body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: meta.color,
            background: `${meta.color}15`, borderRadius: 5, padding: '2px 6px',
            textTransform: 'uppercase' }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 10, fontWeight: 900, color: priorClr,
            background: `${priorClr}15`, borderRadius: 5, padding: '2px 6px' }}>
            {PRIOR_LABEL[item.prioridade]}
          </span>
          {isLate && (
            <span style={{ fontSize: 10, fontWeight: 900, color: '#DC2626',
              background: '#FEE2E2', borderRadius: 5, padding: '2px 6px',
              display: 'flex', alignItems: 'center', gap: 3 }}>
              <AlertTriangle size={9} /> Atrasada
            </span>
          )}
          {isAndamento && (
            <span style={{ fontSize: 10, fontWeight: 900, color: '#2563EB',
              background: '#DBEAFE', borderRadius: 5, padding: '2px 6px' }}>
              Em Andamento
            </span>
          )}
          {isAdiada && (
            <span style={{ fontSize: 10, fontWeight: 900, color: '#D97706',
              background: '#FEF3C7', borderRadius: 5, padding: '2px 6px' }}>
              Adiada
            </span>
          )}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)',
          textDecoration: isDone ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.titulo}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          {item.hora_inicio && (
            <span style={{ fontSize: 11, color: 'var(--navy-muted)',
              display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {item.hora_inicio.slice(0, 5)}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--navy-muted)' }}>
            {fmtDate(item.data_inicio)}
          </span>
          {item.cliente_nome && (
            <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 140 }}>
              {item.cliente_nome}
            </span>
          )}
        </div>

        {item.descricao && (
          <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.descricao}
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!isDone && (
          <button onClick={() => onComplete(item.id)}
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={16} color="#059669" />
          </button>
        )}
        <button onClick={() => onEdit(item)}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Pencil size={15} color="#2563EB" />
        </button>
        <button onClick={() => onDelete(item.id)}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={16} color="#DC2626" />
        </button>
      </div>
    </div>
  );
}

/* ─── ClienteSearchMobile ────────────────────────────────────────────────────── */
function ClienteSearchMobile({ value, displayValue, onChange }: {
  value: string;
  displayValue: string;
  onChange: (id: string, nome: string) => void;
}) {
  const [query,   setQuery]   = useState(displayValue);
  const [opts,    setOpts]    = useState<{ id: number; nome: string }[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setQuery(displayValue); }, [displayValue]);

  useEffect(() => {
    if (query.length < 2) { setOpts([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get(`/clients?search=${encodeURIComponent(query)}&limit=10`);
        setOpts((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })));
        setOpen(true);
      } catch { setOpts([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const inp2: React.CSSProperties = {
    width: '100%', padding: '10px 36px 10px 12px', borderRadius: 10, fontSize: 14,
    border: '1px solid var(--border)', background: 'var(--sand-card)',
    color: 'var(--navy)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative' }}>
      <input style={inp2} value={query} placeholder="Buscar pelo nome do cliente..."
        onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange('', ''); }} />
      {loading && (
        <Loader2 size={13} style={{ position: 'absolute', right: 12, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--navy-muted)', animation: 'spin 1s linear infinite' }} />
      )}
      {value && !loading && (
        <button onClick={() => { onChange('', ''); setQuery(''); setOpts([]); setOpen(false); }}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-muted)', padding: 2 }}>
          <X size={13} />
        </button>
      )}
      {open && opts.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#FFF', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: 200, overflowY: 'auto',
        }}>
          {opts.map(c => (
            <div key={c.id}
              onMouseDown={() => { onChange(String(c.id), c.nome); setQuery(c.nome); setOpen(false); }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>
              {c.nome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── CreateForm ─────────────────────────────────────────────────────────────── */
interface FormData {
  titulo:              string;
  tipo:                string;
  data_inicio:         string;
  hora_inicio:         string;
  data_fim:            string;
  hora_fim:            string;
  dia_inteiro:         boolean;
  prioridade:          string;
  status:              string;
  descricao:           string;
  cliente_id:          string;
  cliente_nome_display:string;
  pedido_codigo:       string;
  lembrete_ativo:      boolean;
  lembrete_antes:      number;
  cor:                 string;
}

function CreateForm({ onClose, onSaved, editing }: {
  onClose: () => void;
  onSaved: () => void;
  editing?: AgendaItem | null;
}) {
  const emptyForm = (): FormData => ({
    titulo: '', tipo: 'tarefa', data_inicio: todayStr(),
    hora_inicio: '', data_fim: '', hora_fim: '', dia_inteiro: false,
    prioridade: 'M', status: 'pendente', descricao: '',
    cliente_id: '', cliente_nome_display: '', pedido_codigo: '',
    lembrete_ativo: true, lembrete_antes: 15, cor: '',
  });

  const [form, setForm] = useState<FormData>(() => editing ? {
    titulo:               editing.titulo,
    tipo:                 editing.tipo,
    data_inicio:          editing.data_inicio,
    hora_inicio:          editing.hora_inicio?.slice(0, 5) ?? '',
    data_fim:             '',
    hora_fim:             '',
    dia_inteiro:          false,
    prioridade:           editing.prioridade,
    status:               editing.status,
    descricao:            editing.descricao ?? '',
    cliente_id:           editing.cliente_id ? String(editing.cliente_id) : '',
    cliente_nome_display: editing.cliente_nome ?? '',
    pedido_codigo:        '',
    lembrete_ativo:       true,
    lembrete_antes:       15,
    cor:                  '',
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const upd = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.titulo.trim()) { setErr('Título é obrigatório'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        titulo:         form.titulo.trim(),
        tipo:           form.tipo,
        data_inicio:    form.data_inicio,
        hora_inicio:    form.hora_inicio || null,
        data_fim:       form.data_fim    || null,
        hora_fim:       form.hora_fim    || null,
        dia_inteiro:    form.dia_inteiro,
        prioridade:     form.prioridade,
        status:         form.status,
        descricao:      form.descricao   || null,
        cliente_id:     form.cliente_id  ? parseInt(form.cliente_id) : null,
        pedido_codigo:  form.pedido_codigo || null,
        lembrete_ativo: form.lembrete_ativo,
        lembrete_antes: form.lembrete_antes,
        cor:            form.cor         || null,
      };
      if (editing) await api.put(`/agenda/${editing.id}`, payload);
      else         await api.post('/agenda', payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
    border: '1px solid var(--border)', background: 'var(--sand-card)',
    color: 'var(--navy)', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--navy-muted)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block',
  };

  const TIPOS_LIST = Object.entries(TIPOS).map(([v, m]) => ({ v, label: m.label }));
  const pillSt = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(40,55,74,0.12)' : 'transparent',
    border: active ? '1.5px solid var(--navy)' : '1px solid var(--border)',
    borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 900,
    cursor: 'pointer', color: active ? 'var(--navy)' : 'var(--navy-muted)',
    fontFamily: 'inherit', flexShrink: 0,
  });

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto', flex: 1 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)' }}>{editing ? 'Editar Tarefa' : 'Nova Tarefa'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={20} color="var(--navy-muted)" />
        </button>
      </div>

      {/* título */}
      <input placeholder="Título *" value={form.titulo} onChange={e => upd('titulo', e.target.value)}
        style={inp} autoFocus />

      {/* tipo */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-muted)', marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIPOS_LIST.map(({ v, label }) => (
            <button key={v} onClick={() => upd('tipo', v)} style={pillSt(form.tipo === v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* data início + hora início */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={lbl}>Data Início *</div>
          <input type="date" value={form.data_inicio} onChange={e => upd('data_inicio', e.target.value)}
            style={{ ...inp, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={lbl}>Hora</div>
          <input type="time" value={form.hora_inicio} onChange={e => upd('hora_inicio', e.target.value)}
            style={{ ...inp, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={lbl}>Data Fim</div>
          <input type="date" value={form.data_fim} onChange={e => upd('data_fim', e.target.value)}
            style={{ ...inp, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={lbl}>Hora Fim</div>
          <input type="time" value={form.hora_fim} onChange={e => upd('hora_fim', e.target.value)}
            style={{ ...inp, padding: '9px 10px' }} />
        </div>
      </div>

      {/* dia inteiro */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.dia_inteiro}
          onChange={e => setForm(f => ({ ...f, dia_inteiro: e.target.checked }))} />
        <span style={{ fontSize: 13, color: 'var(--navy)' }}>Dia inteiro</span>
      </label>

      {/* cliente */}
      <div>
        <div style={lbl}>Cliente</div>
        <ClienteSearchMobile
          value={form.cliente_id}
          displayValue={form.cliente_nome_display}
          onChange={(id, nome) => setForm(f => ({ ...f, cliente_id: id, cliente_nome_display: nome }))}
        />
      </div>

      {/* pedido */}
      <div>
        <div style={lbl}>Nº do Pedido</div>
        <input value={form.pedido_codigo} onChange={e => upd('pedido_codigo', e.target.value)}
          placeholder="Ex: HS001234" style={inp} />
      </div>

      {/* prioridade + status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={lbl}>Prioridade</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['A', 'M', 'B'] as const).map(p => (
              <button key={p} onClick={() => upd('prioridade', p)}
                style={{
                  ...pillSt(form.prioridade === p),
                  color: form.prioridade === p ? PRIOR_COLOR[p] : 'var(--navy-muted)',
                  border: form.prioridade === p ? `1.5px solid ${PRIOR_COLOR[p]}` : '1px solid var(--border)',
                  background: form.prioridade === p ? `${PRIOR_COLOR[p]}15` : 'transparent',
                  flex: 1, justifyContent: 'center',
                }}>
                {PRIOR_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={lbl}>Status</div>
          <select value={form.status} onChange={e => upd('status', e.target.value)}
            style={{ ...inp, height: 38, padding: '0 10px', cursor: 'pointer' }}>
            <option value="pendente">Pendente</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="adiada">Adiada</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* lembrete */}
      <div style={{ background: 'var(--sand-card)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={form.lembrete_ativo}
            onChange={e => setForm(f => ({ ...f, lembrete_ativo: e.target.checked }))} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
            <Bell size={12} style={{ display: 'inline', marginRight: 4 }} />Lembrete
          </span>
        </label>
        {form.lembrete_ativo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={5} max={1440} value={form.lembrete_antes}
              onChange={e => setForm(f => ({ ...f, lembrete_antes: parseInt(e.target.value) || 15 }))}
              style={{ ...inp, width: 70, height: 34 }} />
            <span style={{ fontSize: 12, color: 'var(--navy-muted)' }}>minutos antes</span>
          </div>
        )}
      </div>

      {/* cor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={lbl}>Cor</div>
        <input type="color"
          value={form.cor || (TIPOS[form.tipo]?.color ?? '#3B82F6')}
          onChange={e => upd('cor', e.target.value)}
          style={{ width: 36, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
        {form.cor && (
          <button onClick={() => upd('cor', '')}
            style={{ background: 'none', border: 'none', color: 'var(--navy-muted)', cursor: 'pointer', fontSize: 11 }}>
            Padrão
          </button>
        )}
      </div>

      {/* descricao */}
      <div>
        <div style={lbl}>Descrição</div>
        <textarea value={form.descricao} onChange={e => upd('descricao', e.target.value)}
          placeholder="Opcional..." rows={2}
          style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
      </div>

      {err && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 700 }}>{err}</div>}

      <button onClick={handleSave} disabled={saving}
        style={{ background: 'var(--navy)', border: 'none', borderRadius: 12,
          color: '#FFF', fontSize: 14, fontWeight: 900, padding: '14px',
          cursor: saving ? 'default' : 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
        {saving
          ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</>
          : editing ? 'Salvar Alterações' : 'Salvar Tarefa'
        }
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
type Tab = 'hoje' | 'proximos' | 'concluidas';

export default function AgendaPage() {
  const [tab,        setTab]       = useState<Tab>('hoje');
  const [items,      setItems]     = useState<AgendaItem[]>([]);
  const [resumo,     setResumo]    = useState<Resumo>({ tarefas_hoje: 0, atrasadas: 0, pendentes: 0, concluidas: 0 });
  const [loading,    setLoading]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [editing,    setEditing]   = useState<AgendaItem | null>(null);
  const [search,     setSearch]    = useState('');
  const [filterTipo, setFilterTipo]= useState('todos');

  const loadResumo = useCallback(async () => {
    try {
      const r = await api.get('/agenda/resumo');
      const d = r.data.data;
      setResumo({
        tarefas_hoje: d.tarefas_hoje ?? 0,
        atrasadas:    d.atrasadas    ?? 0,
        pendentes:    d.pendentes    ?? 0,
        concluidas:   d.concluidas   ?? 0,
      });
    } catch {}
  }, []);

  const loadItems = useCallback(async (activeTab: Tab) => {
    setLoading(true);
    try {
      const today = todayStr();
      let params: Record<string, string> = {};
      if (activeTab === 'hoje') {
        params = { data_inicio: today, data_fim: today };
      } else if (activeTab === 'proximos') {
        const future = new Date();
        future.setDate(future.getDate() + 30);
        const futureStr = future.toISOString().slice(0, 10);
        params = { data_inicio: today, data_fim: futureStr, status: 'pendente' };
      } else {
        params = { status: 'concluida' };
      }
      const r = await api.get('/agenda', { params });
      setItems(r.data.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadResumo(); }, [loadResumo]);
  useEffect(() => { loadItems(tab); }, [tab, loadItems]);

  async function handleComplete(id: number) {
    try {
      await api.patch(`/agenda/${id}/status`, { status: 'concluida' });
      setItems(prev => prev.map(x => x.id === id ? { ...x, status: 'concluida' } : x));
      loadResumo();
    } catch {}
  }

  function handleEdit(item: AgendaItem) {
    setEditing(item);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await api.delete(`/agenda/${id}`);
      setItems(prev => prev.filter(x => x.id !== id));
      loadResumo();
    } catch {}
  }

  const tabSt = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 6px', fontSize: 12, fontWeight: 900,
    background: active ? 'var(--navy)' : 'transparent',
    color: active ? '#FFF' : 'var(--navy-muted)',
    border: 'none', cursor: 'pointer', borderRadius: 10,
    fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title="Agenda" showBack />

      {/* ── resumo chips ── */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, flexShrink: 0 }}>
        {[
          { label: 'Pendentes',  value: resumo.pendentes,    bg: '#F8FAFC', color: '#64748B' },
          { label: 'Hoje',       value: resumo.tarefas_hoje, bg: '#EEF2FF', color: '#3730A3' },
          { label: 'Atrasadas',  value: resumo.atrasadas,
            bg: resumo.atrasadas > 0 ? '#FEE2E2' : '#F0FDF4',
            color: resumo.atrasadas > 0 ? '#DC2626' : '#059669' },
          { label: 'Concluídas', value: resumo.concluidas,   bg: '#F0FDF4', color: '#059669' },
        ].map(({ label, value, bg, color }) => (
          <div key={label} style={{ flex: 1, background: bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── tabs ── */}
      <div style={{ padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--sand-card)',
          borderRadius: 12, padding: 4 }}>
          <button style={tabSt(tab === 'hoje')}      onClick={() => setTab('hoje')}>Hoje</button>
          <button style={tabSt(tab === 'proximos')}  onClick={() => setTab('proximos')}>Próximos 30d</button>
          <button style={tabSt(tab === 'concluidas')}onClick={() => setTab('concluidas')}>Concluídas</button>
        </div>
      </div>

      {/* ── filtros ── */}
      <div style={{ padding: '6px 16px 8px', flexShrink: 0, display: 'flex', gap: 8 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tarefas ou clientes..."
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          style={{
            padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="todos">Todos</option>
          {Object.entries(TIPOS).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* ── list ── */}
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', background: '#FFF' }}>
        <IrisBriefing />
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 40, color: 'var(--navy-muted)', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
            Carregando...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13,
            padding: '48px 24px', lineHeight: 1.6 }}>
            {tab === 'hoje'
              ? 'Nenhuma tarefa para hoje.\nUse o + para criar uma.'
              : tab === 'proximos'
              ? 'Nenhuma tarefa nos próximos 30 dias.'
              : 'Nenhuma tarefa concluída recente.'}
          </div>
        ) : (
          items
            .filter(item =>
              (filterTipo === 'todos' || item.tipo === filterTipo) &&
              (!search ||
                item.titulo.toLowerCase().includes(search.toLowerCase()) ||
                (item.cliente_nome && item.cliente_nome.toLowerCase().includes(search.toLowerCase())) ||
                (item.descricao && item.descricao.toLowerCase().includes(search.toLowerCase()))
              )
            )
            .map(item => (
              <TaskCard key={item.id} item={item}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit} />
            ))
        )}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => { setEditing(null); setShowForm(true); }}
        style={{
          position: 'fixed', bottom: 88, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: '#FFD200', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(255,210,0,0.5)',
          zIndex: 40,
        }}>
        <Plus size={24} color="#28374A" strokeWidth={2.5} />
      </button>

      {/* ── Create form sheet ── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 48 }}
            />
            <motion.div
              key="sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                background: 'var(--sand-bg)', borderRadius: '20px 20px 0 0',
                maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                zIndex: 49, overflowY: 'auto',
              }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)',
                margin: '12px auto 0', flexShrink: 0 }} />
              <CreateForm
                onClose={() => { setShowForm(false); setEditing(null); }}
                onSaved={() => { loadItems(tab); loadResumo(); }}
                editing={editing}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
