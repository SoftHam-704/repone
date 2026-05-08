import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  TrendingUp, Plus, Trash2, Loader2,
  CheckCircle2, X, Search,
} from 'lucide-react';
import { db }           from '../db/db';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileClient } from '../db/types';

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface Record {
  id:          number;
  cli_nomred:  string;
  for_nomered: string;
  periodo:     string;
  valor:       number;
  quantidade:  number;
}
interface Stats { total_valor: number; total_registros: number }
interface Industria { id: number; nome: string }

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function periodoLabel(periodoStr: string) {
  const [y, m] = periodoStr.split('-');
  return `${MESES[parseInt(m) - 1]}/${y}`;
}

/* ─── SearchSelect ───────────────────────────────────────────────────────────── */
function SearchSelect({
  placeholder, items, value, onSelect, display,
}: {
  placeholder: string;
  items: { id: number; nome: string }[];
  value: number | null;
  onSelect: (id: number, nome: string) => void;
  display: string;
}) {
  const [q,    setQ]    = useState('');
  const [open, setOpen] = useState(false);

  const filtered = q.length > 0
    ? items.filter(i => i.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: 9, fontSize: 13, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: '#f8fafc',
    color: 'var(--navy)', outline: 'none', padding: '9px 11px 9px 34px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} color="var(--navy-muted)"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
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
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0,
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

/* ─── RegisterForm ───────────────────────────────────────────────────────────── */
interface FormState {
  cli_codigo: number | null; cli_nome: string;
  for_codigo: number | null; for_nome: string;
  periodo: string; valor: string; quantidade: string;
}
const emptyForm = (): FormState => {
  const now  = new Date();
  const yymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { cli_codigo: null, cli_nome: '', for_codigo: null, for_nome: '', periodo: yymm, valor: '', quantidade: '' };
};

function RegisterForm({
  clientes, industrias, onSave, onClose,
}: {
  clientes: MobileClient[]; industrias: Industria[];
  onSave: () => void; onClose: () => void;
}) {
  const [form,     setForm]     = useState<FormState>(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [existing, setExisting] = useState<{ valor: number; quantidade: number } | null>(null);

  useEffect(() => {
    if (!form.cli_codigo || !form.for_codigo || !form.periodo) { setExisting(null); return; }
    api.get('/sellout', { params: {
      cli_codigo: form.cli_codigo,
      for_codigo: form.for_codigo,
      periodo:    form.periodo + '-01',
    }})
      .then(r => {
        const found = (r.data.data || [])[0];
        setExisting(found ? { valor: found.valor, quantidade: found.quantidade } : null);
      })
      .catch(() => setExisting(null));
  }, [form.cli_codigo, form.for_codigo, form.periodo]);

  const cliList = clientes.map(c => ({ id: c.cli_codigo, nome: c.cli_nomred }));

  function parseCurrency(s: string): number {
    return parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  }

  async function submit() {
    if (!form.cli_codigo) { setError('Selecione um cliente.'); return; }
    if (!form.for_codigo) { setError('Selecione uma indústria.'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/sellout', {
        cli_codigo:  form.cli_codigo,
        for_codigo:  form.for_codigo,
        periodo:     form.periodo + '-01',
        valor:       parseCurrency(form.valor),
        quantidade:  parseInt(form.quantidade) || 0,
      });
      onSave();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  const label: React.CSSProperties = {
    fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, display: 'block',
  };
  const inp: React.CSSProperties = {
    width: '100%', borderRadius: 9, fontSize: 13, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: '#f8fafc',
    color: 'var(--navy)', outline: 'none', padding: '9px 11px',
    boxSizing: 'border-box' as const,
  };

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        background: '#fff', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
        padding: '20px 20px 40px', maxHeight: '85vh', overflowY: 'auto',
      }}>
      {/* handle */}
      <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0',
        margin: '0 auto 16px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)' }}>Registrar Sell-Out</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={18} color="var(--navy-muted)" />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <span style={label}>Cliente *</span>
          <SearchSelect placeholder="Buscar cliente..." items={cliList}
            value={form.cli_codigo} display={form.cli_nome}
            onSelect={(id, nome) => setForm(f => ({ ...f, cli_codigo: id || null, cli_nome: nome }))} />
        </div>
        <div>
          <span style={label}>Indústria *</span>
          <SearchSelect placeholder="Buscar indústria..." items={industrias}
            value={form.for_codigo} display={form.for_nome}
            onSelect={(id, nome) => setForm(f => ({ ...f, for_codigo: id || null, for_nome: nome }))} />
        </div>
        <div>
          <span style={label}>Período</span>
          <input type="month" style={inp} value={form.periodo}
            onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={label}>Valor (R$)</span>
            <input style={inp} inputMode="decimal" placeholder="0,00" value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>
          <div>
            <span style={label}>Quantidade</span>
            <input style={inp} inputMode="numeric" placeholder="0" value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
          </div>
        </div>
      </div>

      {existing && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 9,
          padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>➕</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#C2410C' }}>Já registrado neste período</div>
            <div style={{ fontSize: 13, color: '#92400E', marginTop: 2 }}>
              <strong>{fmtBRL(existing.valor)}</strong>
              {existing.quantidade > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>{existing.quantidade} un.</span>}
            </div>
            <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
              O novo lançamento será <strong>somado</strong> ao valor acima.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9,
          padding: '8px 12px', fontSize: 12, color: '#dc2626', marginTop: 10 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9',
          border: '1px solid var(--border)', borderRadius: 12, padding: '12px 0',
          fontSize: 13, fontWeight: 800, color: 'var(--navy-muted)', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={submit} disabled={saving}
          style={{ flex: 2, background: 'var(--navy)', border: 'none', borderRadius: 12,
            padding: '12px 0', fontSize: 13, fontWeight: 800, color: '#FFF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            opacity: saving ? 0.7 : 1 }}>
          {saving
            ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <CheckCircle2 size={15} />}
          Registrar
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function SellOutPage() {
  const { isOnline } = useOffline();

  const NOW   = new Date();
  const [period,      setPeriod]      = useState(`${NOW.getFullYear()}-${String(NOW.getMonth()+1).padStart(2,'0')}`);
  const [stats,       setStats]       = useState<Stats>({ total_valor: 0, total_registros: 0 });
  const [records,     setRecords]     = useState<Record[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [clientes,    setClientes]    = useState<MobileClient[]>([]);
  const [industrias,  setIndustrias]  = useState<Industria[]>([]);
  const [deleting,    setDeleting]    = useState<number | null>(null);
  const [filterCli,   setFilterCli]   = useState<{ id: number; nome: string } | null>(null);
  const [filterFor,   setFilterFor]   = useState<{ id: number; nome: string } | null>(null);

  /* carrega clientes locais e indústrias uma vez */
  useEffect(() => {
    db.clients.toArray().then(setClientes);
    if (isOnline) {
      api.get('/aux/industrias')
        .then(r => setIndustrias((r.data.data || []).map((f: any) => ({
          id: Number(f.for_codigo), nome: f.for_nomered || f.for_nome,
        })))
        ).catch(() => {});
    }
  }, [isOnline]);

  const loadData = useCallback(async (per: string) => {
    if (!isOnline) return;
    setLoading(true);
    const periodoParam = per + '-01';
    try {
      const params: Record<string, any> = { periodo: periodoParam, limit: 50 };
      if (filterCli) params.cli_codigo = filterCli.id;
      if (filterFor) params.for_codigo = filterFor.id;
      const [recRes, statsRes] = await Promise.all([
        api.get('/sellout', { params }),
        api.get(`/sellout/stats?periodo=${periodoParam}`),
      ]);
      setRecords(recRes.data.data || []);
      const s = statsRes.data.data || {};
      setStats({
        total_valor:     parseFloat(s.total_valor ?? s.current_month_total ?? '0'),
        total_registros: parseInt(s.total_registros ?? s.total_records ?? '0'),
      });
    } catch {
      setRecords([]); setStats({ total_valor: 0, total_registros: 0 });
    } finally { setLoading(false); }
  }, [isOnline]);

  useEffect(() => { loadData(period); }, [period, filterCli, filterFor, loadData]);

  async function handleDelete(id: number) {
    if (!confirm('Remover este registro?')) return;
    setDeleting(id);
    try { await api.delete(`/sellout/${id}`); loadData(period); }
    catch {} finally { setDeleting(null); }
  }

  const nowYear  = NOW.getFullYear();
  const nowMonth = NOW.getMonth() + 1;

  /* gera últimos 6 meses */
  const periodPills = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(nowYear, nowMonth - 1 - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return { val, label: `${MESES[d.getMonth()]}/${d.getFullYear()}` };
  }).reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title="Sell-Out" showBack />

      {!isOnline ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <span style={{ fontSize: 44 }}>📶</span>
          <p style={{ fontSize: 13, color: 'var(--navy-muted)', textAlign: 'center' }}>
            Sell-Out requer conexão com a internet.
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>

            {/* stats chips */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, background: '#fff', borderRadius: 12,
                padding: '10px 14px', border: '1px solid var(--border)',
                boxShadow: '0 2px 6px rgba(40,55,74,0.06)' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.6 }}>Total do período</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--navy)',
                  letterSpacing: -0.5, marginTop: 2 }}>{fmtBRL(stats.total_valor)}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px',
                border: '1px solid var(--border)', textAlign: 'center',
                boxShadow: '0 2px 6px rgba(40,55,74,0.06)' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.6 }}>Registros</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb',
                  letterSpacing: -0.5, marginTop: 2 }}>{stats.total_registros}</div>
              </div>
            </div>

            {/* period pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
              {periodPills.map(p => (
                <button key={p.val} onClick={() => setPeriod(p.val)}
                  style={{
                    background: period === p.val ? 'var(--navy)' : 'var(--sand-card)',
                    color:      period === p.val ? '#FFF' : 'var(--navy)',
                    border:     period === p.val ? 'none' : '1px solid var(--border)',
                    borderRadius: 9, padding: '6px 12px', fontSize: 11, fontWeight: 900,
                    cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* filtros cliente / indústria */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingBottom: 10 }}>
              <SearchSelect
                placeholder="Filtrar cliente..."
                items={clientes.map(c => ({ id: c.cli_codigo, nome: c.cli_nomred }))}
                value={filterCli?.id ?? null}
                display={filterCli?.nome ?? ''}
                onSelect={(id, nome) => setFilterCli(id ? { id, nome } : null)}
              />
              <SearchSelect
                placeholder="Filtrar indústria..."
                items={industrias}
                value={filterFor?.id ?? null}
                display={filterFor?.nome ?? ''}
                onSelect={(id, nome) => setFilterFor(id ? { id, nome } : null)}
              />
            </div>
          </div>

          {/* list */}
          <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: 40, color: 'var(--navy-muted)', fontSize: 13 }}>
                <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                Carregando...
              </div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <TrendingUp size={28} color="#cbd5e1" style={{ display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 12, color: 'var(--navy-muted)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Nenhum registro em {periodPills.find(p => p.val === period)?.label}
                </p>
                <p style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 6 }}>
                  Toque em + para registrar o giro do período.
                </p>
              </div>
            ) : (
              records.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 16px', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.cli_nomred}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)',
                      textTransform: 'uppercase', marginTop: 1 }}>
                      {r.for_nomered} · {periodoLabel(r.periodo)}
                    </div>
                    {r.quantidade > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--navy-muted)', marginTop: 1 }}>
                        {r.quantidade} un.
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)',
                      fontFamily: 'monospace' }}>{fmtBRL(r.valor)}</div>
                  </div>
                  <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      padding: 6, flexShrink: 0 }}>
                    {deleting === r.id
                      ? <Loader2 size={14} color="#dc2626" style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <Trash2 size={14} color="#dc2626" />}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* FAB */}
          <button onClick={() => setShowForm(true)}
            style={{
              position: 'fixed', bottom: 80, right: 20, zIndex: 100,
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--mustard)', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(255,210,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Plus size={22} color="var(--navy)" strokeWidth={3} />
          </button>

          {/* form overlay backdrop */}
          <AnimatePresence>
            {showForm && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowForm(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 190 }} />
                <RegisterForm
                  clientes={clientes}
                  industrias={industrias}
                  onSave={() => { setShowForm(false); loadData(period); }}
                  onClose={() => setShowForm(false)}
                />
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
