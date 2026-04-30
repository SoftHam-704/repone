import { useEffect, useState, useCallback } from 'react';
import {
  Users, Check, Building2, Trash2, Pencil, X,
  MapPin, Phone, ShoppingCart, Star, Clock,
  ArrowRight, PlusCircle, RotateCcw, MessageSquare, Layers,
  FileText, Printer,
} from 'lucide-react';
import SearchCombobox from '@/shared/components/ui/SearchCombobox';
import type { ComboboxOption } from '@/shared/components/ui/SearchCombobox';
import { api } from '@/shared/lib/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  bg: '#E8E1D4', card: '#F2EDE4', border: '#D6CCBA',
  text: '#28374A', muted: '#6B7A8A', mustard: '#FFD200',
  danger: '#EF4444',
};

// Dark form panel tokens
const D = {
  bg: '#1A2535', surface: '#243447', border: '#334D66',
  text: '#E8E1D4', muted: '#8BA4BD', gold: '#FFD200',
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function tipoColor(tipo: string): string {
  const palette = ['#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#14B8A6', '#F97316'];
  let hash = 0;
  for (const c of (tipo || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

const RESULTADO_STYLE: Record<string, { bg: string; color: string }> = {
  'positivo':  { bg: '#D1FAE5', color: '#065F46' },
  'realizado': { bg: '#DBEAFE', color: '#1E40AF' },
  'agendado':  { bg: '#FEF3C7', color: '#92400E' },
  'em aberto': { bg: '#F1F5F9', color: '#475569' },
  'cancelado': { bg: '#FEE2E2', color: '#991B1B' },
  'negativo':  { bg: '#FEE2E2', color: '#991B1B' },
};
function resultadoStyle(r: string | null) {
  return RESULTADO_STYLE[(r ?? '').toLowerCase()] ?? { bg: '#F1F5F9', color: '#64748B' };
}

function fmtDate(d: string) { return (d ?? '').slice(0, 10).split('-').reverse().join('/'); }
function fmtTime(d: string) { return (d ?? '').slice(11, 16) || '—'; }
function fmtBRL(v: number | string) {
  return (parseFloat(String(v)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Interacao {
  interacao_id: number;
  data_interacao: string;
  descricao: string | null;
  ven_codigo: number;
  cli_codigo: number;
  cli_nomred: string;
  tipo: string;
  tipo_interacao_id: number;
  resultado: string | null;
  resultado_id: number | null;
  canal: string | null;
  canal_id: number | null;
  ven_nome: string;
  industrias: number[] | null;
}

interface Lookup { id: number; descricao: string }
interface ClienteOpt { cli_codigo: number; cli_nome: string; cli_nomred?: string }
interface Industria { for_codigo: number; for_nomered: string; for_nome?: string }
interface PedidoFicha { ped_pedido: string; ped_data: string; ped_totliq: number | string; ped_situacao: string; industria: string }
interface ProdFav { ite_produto: string; ite_nomeprod: string; vezes: number }
interface RelRow {
  interacao_id: number; data_interacao: string; descricao: string | null;
  cliente_nome: string; cli_cidade: string; cli_uf: string;
  operador: string; tipo: string; resultado: string;
  industria: string; for_codigo: number;
}
interface ClienteFicha {
  cli_codigo: number; cli_nomred: string; cli_nome: string;
  cli_cidade: string; cli_uf: string; cli_fone1: string;
  cli_atuacaoprincipal?: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RegistroRelacionamentosPage() {
  const authState = (() => {
    try { return JSON.parse(localStorage.getItem('sm_auth_state') || '{}'); } catch { return {}; }
  })();
  const venCodigo: number | null = authState?.seller?.ven_codigo ?? authState?.ven_codigo ?? null;

  // Client selection
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clienteSel, setClienteSel] = useState('');
  const [ficha, setFicha] = useState<{
    cliente: ClienteFicha | null;
    pedidos: PedidoFicha[];
    produtos_favs: ProdFav[];
    areas: string[];
  }>({ cliente: null, pedidos: [], produtos_favs: [], areas: [] });
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaError, setFichaError] = useState(false);

  // Lookups
  const [tipos, setTipos] = useState<Lookup[]>([]);
  const [canais, setCanais] = useState<Lookup[]>([]);
  const [resultados, setResultados] = useState<Lookup[]>([]);
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const indMap = Object.fromEntries(industrias.map(i => [i.for_codigo, i.for_nomered || i.for_nome || '']));

  // Timeline
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [tlLoading, setTlLoading] = useState(false);

  // Form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    tipo_id: '', canal_id: '', resultado_id: '',
    data_interacao: new Date().toISOString().slice(0, 10),
    descricao: '',
  });
  const [indSel, setIndSel] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Relatório
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [relFilter, setRelFilter] = useState({
    dataInicio: new Date().toISOString().slice(0, 8) + '01',
    dataFim: new Date().toISOString().slice(0, 10),
    for_codigo: '',
  });
  const [relData, setRelData] = useState<RelRow[]>([]);
  const [relLoading, setRelLoading] = useState(false);
  const [relSearched, setRelSearched] = useState(false);
  const [relError, setRelError] = useState('');

  // Load lookups + clients once
  useEffect(() => {
    Promise.all([
      api.get('/clients?limit=2000'),
      api.get('/crm/tipos'),
      api.get('/crm/canais'),
      api.get('/crm/resultados'),
      api.get('/suppliers'),
    ]).then(([cl, t, c, r, ind]) => {
      setClientes(cl.data.data ?? []);
      const tiposData: Lookup[] = t.data.data ?? [];
      setTipos(tiposData);
      setCanais(c.data.data ?? []);
      setResultados(r.data.data ?? []);
      setIndustrias(ind.data.data ?? ind.data ?? []);
      if (tiposData.length) setForm(f => ({ ...f, tipo_id: String(tiposData[0].id) }));
    }).catch(() => {});
  }, []);

  // Load client ficha
  useEffect(() => {
    if (!clienteSel) {
      setFicha({ cliente: null, pedidos: [], produtos_favs: [], areas: [] });
      setFichaError(false);
      return;
    }
    setFichaLoading(true);
    setFichaError(false);
    api.get(`/crm/carteira/clientes/${clienteSel}/ficha`)
      .then(r => {
        if (r.data.success) setFicha({
          cliente: r.data.data.cliente,
          pedidos: r.data.data.pedidos ?? [],
          produtos_favs: r.data.data.produtos_favs ?? [],
          areas: r.data.data.areas ?? [],
        });
        else setFichaError(true);
      })
      .catch(() => setFichaError(true))
      .finally(() => setFichaLoading(false));
  }, [clienteSel]);

  // Load timeline
  const loadInteracoes = useCallback(() => {
    if (!clienteSel) { setInteracoes([]); return; }
    setTlLoading(true);
    api.get(`/crm/interacoes?cli_codigo=${clienteSel}`)
      .then(r => { if (r.data.success) setInteracoes(r.data.data ?? []); })
      .catch(() => {}).finally(() => setTlLoading(false));
  }, [clienteSel]);

  useEffect(() => { loadInteracoes(); }, [loadInteracoes]);

  function resetForm() {
    setEditingId(null);
    setForm({
      tipo_id: tipos.length ? String(tipos[0].id) : '',
      canal_id: '', resultado_id: '',
      data_interacao: new Date().toISOString().slice(0, 10),
      descricao: '',
    });
    setIndSel(new Set());
    setError('');
  }

  function startEdit(item: Interacao) {
    setEditingId(item.interacao_id);
    setForm({
      tipo_id: String(item.tipo_interacao_id),
      canal_id: String(item.canal_id ?? ''),
      resultado_id: String(item.resultado_id ?? ''),
      data_interacao: (item.data_interacao ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      descricao: item.descricao ?? '',
    });
    setIndSel(new Set(item.industrias ?? []));
    setError('');
    // Scroll form panel into view on mobile-ish widths
    document.getElementById('rr-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteSel) { setError('Selecione um cliente.'); return; }
    if (!form.tipo_id) { setError('Selecione o tipo de interação.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        cli_codigo: parseInt(clienteSel),
        ven_codigo: venCodigo ?? 1,
        tipo_interacao_id: parseInt(form.tipo_id),
        canal_id: form.canal_id ? parseInt(form.canal_id) : null,
        resultado_id: form.resultado_id ? parseInt(form.resultado_id) : null,
        data_interacao: form.data_interacao,
        descricao: form.descricao || null,
        industrias: Array.from(indSel),
      };
      if (editingId) {
        await api.put(`/crm/interacoes/${editingId}`, payload);
      } else {
        await api.post('/crm/interacoes', payload);
      }
      resetForm();
      loadInteracoes();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este registro de relacionamento?')) return;
    await api.delete(`/crm/interacoes/${id}`);
    loadInteracoes();
    if (editingId === id) resetForm();
  }

  const loadRelatorio = useCallback(async () => {
    setRelLoading(true);
    setRelError('');
    setRelSearched(false);
    try {
      const params = new URLSearchParams({ dataInicio: relFilter.dataInicio, dataFim: relFilter.dataFim });
      if (relFilter.for_codigo) params.append('for_codigo', relFilter.for_codigo);
      const res = await api.get(`/crm/relatorio/relacionamentos?${params}`);
      setRelData(res.data.data || []);
      setRelSearched(true);
    } catch (e: any) {
      setRelError(e?.response?.data?.message ?? `Erro ao buscar relatório (${e?.response?.status ?? 'rede'})`);
      setRelData([]);
    } finally { setRelLoading(false); }
  }, [relFilter]);

  useEffect(() => {
    if (!showRelatorio) return;
    const style = document.createElement('style');
    style.id = 'rr-print-style';
    style.textContent = [
      '@media print {',
      '  body * { visibility: hidden; }',
      '  #relatorio-overlay, #relatorio-overlay * { visibility: visible !important; }',
      '  #relatorio-overlay { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; background: white !important; z-index: 9999 !important; }',
      '  #relatorio-print-controls { display: none !important; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
    return () => { document.getElementById('rr-print-style')?.remove(); };
  }, [showRelatorio]);

  const toggleInd = (cod: number) => {
    setIndSel(prev => { const n = new Set(prev); n.has(cod) ? n.delete(cod) : n.add(cod); return n; });
  };

  const clienteOpts: ComboboxOption[] = clientes.map(c => ({
    id: c.cli_codigo,
    nome: c.cli_nomred || c.cli_nome,
  }));

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${D.border}`, background: D.surface, color: D.text,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg, overflow: 'hidden' }}>

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: D.bg, borderBottom: `1px solid ${D.border}`,
        padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: 2, background: D.gold,
          boxShadow: `0 0 8px ${D.gold}70`,
        }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: D.text, letterSpacing: '0.01em' }}>
            Registro de Relacionamentos
          </div>
          <div style={{ fontSize: 10, color: D.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            CRM · Histórico de Interações por Cliente
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setShowRelatorio(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${D.gold}18`, border: `1px solid ${D.gold}35`,
            color: D.gold, borderRadius: 8, padding: '7px 15px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          <FileText size={13} /> Relatório
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left Panel — Context ──────────────────────────────────────── */}
        <div style={{
          width: 256, borderRight: `1px solid ${G.border}`,
          display: 'flex', flexDirection: 'column',
          background: G.card, flexShrink: 0, overflow: 'hidden',
        }}>
          {/* Client selector */}
          <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${G.border}` }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: G.muted,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Cliente
            </div>
            <SearchCombobox
              options={clienteOpts}
              value={clienteSel}
              onChange={v => { setClienteSel(v); resetForm(); }}
              placeholder="Selecione um cliente..."
              searchPlaceholder="Buscar cliente..."
              minWidth={0}
            />
          </div>

          {/* Context cards */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
            {!clienteSel ? (
              <div style={{ textAlign: 'center', padding: '40px 12px' }}>
                <MessageSquare size={30} style={{ color: G.muted, opacity: 0.3, marginBottom: 10 }} />
                <div style={{ fontSize: 11, color: G.muted, lineHeight: 1.6 }}>
                  Selecione um cliente para ver o contexto de relacionamento
                </div>
              </div>
            ) : fichaLoading ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: G.muted }}>Carregando...</div>
            ) : fichaError ? (
              <div style={{
                padding: '14px 12px', textAlign: 'center', fontSize: 11, color: G.muted,
                background: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: 8, marginTop: 8,
              }}>
                Não foi possível carregar o contexto deste cliente.
              </div>
            ) : ficha.cliente ? (
              <>
                {/* Client card */}
                <div style={{
                  background: G.bg, border: `1px solid ${G.border}`, borderRadius: 10,
                  padding: '12px 13px', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 5, lineHeight: 1.3 }}>
                    {ficha.cliente.cli_nomred || ficha.cliente.cli_nome}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: G.muted, marginBottom: 2 }}>
                    <MapPin size={10} /> {ficha.cliente.cli_cidade} — {ficha.cliente.cli_uf}
                  </div>
                  {ficha.cliente.cli_fone1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: G.muted }}>
                      <Phone size={10} /> {ficha.cliente.cli_fone1}
                    </div>
                  )}
                </div>

                {/* Last orders */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: G.muted, letterSpacing: '0.08em',
                    textTransform: 'uppercase', marginBottom: 7,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <ShoppingCart size={10} /> Últimos Pedidos
                  </div>
                  {ficha.pedidos.length === 0 ? (
                    <div style={{ fontSize: 11, color: G.muted, fontStyle: 'italic', padding: '4px 0' }}>
                      Nenhum pedido encontrado
                    </div>
                  ) : ficha.pedidos.slice(0, 5).map((p, i) => {
                    const sitLabel: Record<string, { label: string; color: string }> = {
                      P: { label: 'Pedido', color: '#16A34A' },
                      F: { label: 'Fat.',   color: '#1D4ED8' },
                      A: { label: 'Cot.',   color: '#B45309' },
                      C: { label: 'Cot.',   color: '#B45309' },
                    };
                    const sit = sitLabel[p.ped_situacao] ?? { label: p.ped_situacao, color: G.muted };
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 0',
                        borderBottom: i < Math.min(ficha.pedidos.length, 5) - 1 ? `1px solid ${G.border}` : 'none',
                        fontSize: 11,
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: sit.color }}>{sit.label}</span>
                            <span style={{ color: G.text, fontWeight: 500 }}>{p.industria || '—'}</span>
                          </div>
                          <div style={{ color: G.muted, fontSize: 10 }}>{fmtDate(p.ped_data)}</div>
                        </div>
                        <div style={{ color: G.text, fontWeight: 700 }}>{fmtBRL(p.ped_totliq)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Atividade principal */}
                {ficha.cliente.cli_atuacaoprincipal && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: G.muted, letterSpacing: '0.08em',
                      textTransform: 'uppercase', marginBottom: 5,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Layers size={10} /> Atividade
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: G.text,
                      background: `${G.mustard}22`, border: `1px solid ${G.mustard}60`,
                      padding: '2px 9px', borderRadius: 6,
                    }}>
                      {ficha.cliente.cli_atuacaoprincipal}
                    </span>
                  </div>
                )}

                {/* Áreas de atuação */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: G.muted, letterSpacing: '0.08em',
                    textTransform: 'uppercase', marginBottom: 5,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <MapPin size={10} /> Áreas de Atuação
                  </div>
                  {ficha.areas.length === 0 ? (
                    <div style={{ fontSize: 11, color: G.muted, fontStyle: 'italic' }}>
                      Nenhuma área configurada
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ficha.areas.map((a, i) => (
                        <span key={i} style={{
                          fontSize: 10, fontWeight: 600, color: G.muted,
                          background: G.bg, border: `1px solid ${G.border}`,
                          padding: '2px 7px', borderRadius: 5,
                        }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top produtos */}
                {ficha.produtos_favs.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: G.muted, letterSpacing: '0.08em',
                      textTransform: 'uppercase', marginBottom: 7,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Star size={10} /> Top Produtos
                    </div>
                    {ficha.produtos_favs.map((p, i) => (
                      <div key={i} style={{
                        padding: '5px 0',
                        borderBottom: i < ficha.produtos_favs.length - 1 ? `1px solid ${G.border}` : 'none',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: G.text, fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                          {p.ite_produto}
                        </div>
                        <div style={{ fontSize: 10, color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.ite_nomeprod} · {p.vezes}×
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Interaction count */}
                <div style={{
                  marginTop: 14, padding: '8px 12px', borderRadius: 8,
                  background: `${G.mustard}18`, border: `1px solid ${G.mustard}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: 10, color: G.text, fontWeight: 600 }}>Registros</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>{interacoes.length}</div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* ── Center — Timeline ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>Histórico</div>
            {clienteSel && (
              <div style={{ fontSize: 11, color: G.muted }}>
                {interacoes.length} registro{interacoes.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {tlLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: G.muted, fontSize: 13 }}>Carregando...</div>
          ) : !clienteSel ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: `2px dashed ${G.border}`, borderRadius: 14,
            }}>
              <Clock size={36} style={{ color: G.muted, opacity: 0.2, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: G.muted }}>Selecione um cliente</div>
              <div style={{ fontSize: 12, color: G.muted, marginTop: 4, opacity: 0.7 }}>
                O histórico de relacionamentos será exibido aqui
              </div>
            </div>
          ) : interacoes.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: `2px dashed ${G.border}`, borderRadius: 14,
            }}>
              <Clock size={36} style={{ color: G.muted, opacity: 0.2, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: G.muted }}>Nenhum registro ainda</div>
              <div style={{ fontSize: 12, color: G.muted, marginTop: 4, opacity: 0.7 }}>
                Use o formulário ao lado para registrar o primeiro contato
              </div>
            </div>
          ) : interacoes.map(item => {
            const color = tipoColor(item.tipo);
            const rStyle = resultadoStyle(item.resultado);
            const isEditing = editingId === item.interacao_id;
            return (
              <div key={item.interacao_id} style={{
                background: isEditing ? `${color}0A` : G.card,
                border: `1px solid ${isEditing ? color + '80' : G.border}`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 10,
                padding: '14px 16px',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: item.descricao ? 10 : 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 4,
                      background: `${color}1A`, color, letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      {item.tipo}
                    </span>
                    {item.resultado && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, ...rStyle }}>
                        {item.resultado}
                      </span>
                    )}
                    {item.canal && (
                      <span style={{
                        fontSize: 10, color: G.muted, padding: '2px 7px',
                        border: `1px solid ${G.border}`, borderRadius: 4,
                      }}>
                        {item.canal}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, color: G.muted, whiteSpace: 'nowrap' }}>
                      {fmtDate(item.data_interacao)}
                    </span>
                    <button onClick={() => startEdit(item)} title="Editar" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: G.muted, padding: 3, borderRadius: 4,
                      display: 'flex', alignItems: 'center',
                    }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(item.interacao_id)} title="Excluir" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: G.danger, padding: 3, borderRadius: 4,
                      display: 'flex', alignItems: 'center',
                    }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {item.descricao && (
                  <div style={{ fontSize: 13, color: G.text, lineHeight: 1.65, marginBottom: 8, whiteSpace: 'pre-line' }}>
                    {item.descricao}
                  </div>
                )}

                {/* Industries */}
                {item.industrias && item.industrias.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                    {item.industrias.map(id => (
                      <span key={id} style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                        background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A',
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                        <Building2 size={9} /> {indMap[id] || `#${id}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Right Panel — Form ────────────────────────────────────────── */}
        <div id="rr-form-panel" style={{
          width: 360, background: D.bg, borderLeft: `1px solid ${D.border}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 22px' }}>

            {/* Form header */}
            <div style={{ marginBottom: 22 }}>
              {editingId ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: D.gold, marginBottom: 3 }}>
                      Editando Registro
                    </div>
                    <div style={{ fontSize: 11, color: D.muted }}>Modifique e salve as alterações</div>
                  </div>
                  <button onClick={resetForm} style={{
                    background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8,
                    padding: '5px 10px', cursor: 'pointer', color: D.muted, fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}>
                    <RotateCcw size={10} /> Cancelar
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 10,
                    background: `${D.gold}18`, border: `1px solid ${D.gold}35`,
                    padding: '3px 10px', borderRadius: 20,
                  }}>
                    <PlusCircle size={10} style={{ color: D.gold }} />
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: D.gold,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      Novo Registro
                    </span>
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 900, color: D.text,
                    lineHeight: 1.15, marginBottom: 8, letterSpacing: '-0.01em',
                  }}>
                    Registrar este<br />
                    <span style={{ color: D.gold }}>Momento</span>
                  </div>
                  <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.55 }}>
                    Cada contato documentado fortalece o relacionamento.
                    Não deixe este momento passar sem registro.
                  </div>
                </div>
              )}
            </div>

            {/* No client warning */}
            {!clienteSel && (
              <div style={{
                background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10,
                padding: '12px 14px', marginBottom: 18, fontSize: 12, color: D.muted, lineHeight: 1.5,
              }}>
                ← Selecione um cliente no painel esquerdo para registrar uma interação.
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {error && (
                <div style={{
                  background: '#4B1D1D', border: '1px solid #7B2D2D', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#FCA5A5',
                }}>
                  {error}
                </div>
              )}

              {/* Tipo — pill selection */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: 9,
                }}>
                  Tipo de Interação *
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tipos.map(t => {
                    const color = tipoColor(t.descricao);
                    const sel = form.tipo_id === String(t.id);
                    return (
                      <button key={t.id} type="button"
                        onClick={() => setForm(f => ({ ...f, tipo_id: String(t.id) }))}
                        style={{
                          padding: '6px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          border: sel ? `2px solid ${color}` : `1px solid ${D.border}`,
                          background: sel ? `${color}22` : D.surface,
                          color: sel ? color : D.muted,
                          cursor: 'pointer', transition: 'all 0.12s', letterSpacing: '0.02em',
                        }}>
                        {t.descricao}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Canal + Resultado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Canal</div>
                  <select value={form.canal_id} onChange={e => setForm(f => ({ ...f, canal_id: e.target.value }))} style={inp}>
                    <option value="">— Nenhum —</option>
                    {canais.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Resultado</div>
                  <select value={form.resultado_id} onChange={e => setForm(f => ({ ...f, resultado_id: e.target.value }))} style={inp}>
                    <option value="">— Nenhum —</option>
                    {resultados.map(r => <option key={r.id} value={r.id}>{r.descricao}</option>)}
                  </select>
                </div>
              </div>

              {/* Data */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Data</div>
                <input type="date" value={form.data_interacao}
                  onChange={e => setForm(f => ({ ...f, data_interacao: e.target.value }))}
                  style={inp} />
              </div>

              {/* Industries */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: 9,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Building2 size={11} color={D.muted} />
                  Indústrias Abordadas
                  {indSel.size > 0 && (
                    <span style={{
                      background: D.gold, color: G.text, fontSize: 9,
                      fontWeight: 800, padding: '1px 6px', borderRadius: 10,
                    }}>
                      {indSel.size}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {industrias.map(ind => {
                    const sel = indSel.has(ind.for_codigo);
                    return (
                      <button key={ind.for_codigo} type="button" onClick={() => toggleInd(ind.for_codigo)} style={{
                        padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        border: sel ? `2px solid ${D.gold}` : `1px solid ${D.border}`,
                        background: sel ? `${D.gold}1A` : D.surface,
                        color: sel ? D.gold : D.muted,
                        cursor: 'pointer', transition: 'all 0.1s',
                        display: 'flex', alignItems: 'center', gap: 4,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>
                        {sel && <Check size={8} strokeWidth={3} />}
                        {ind.for_nomered || ind.for_nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description — BIG FIELD */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: D.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Descrição</div>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="O que aconteceu? Como estava o humor do cliente? Quais produtos foram mencionados? Qual é o próximo passo?"
                  rows={6}
                  style={{
                    ...inp, resize: 'vertical', minHeight: 120, lineHeight: 1.65,
                  }}
                />
              </div>

              {/* Submit */}
              <button type="submit" disabled={saving || !clienteSel} style={{
                width: '100%', padding: '14px 20px', borderRadius: 10,
                background: saving || !clienteSel ? D.surface : D.gold,
                color: saving || !clienteSel ? D.muted : G.text,
                border: 'none', fontSize: 14, fontWeight: 900, cursor: saving || !clienteSel ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s', letterSpacing: '0.01em',
                boxShadow: !saving && clienteSel ? `0 4px 20px ${D.gold}35` : 'none',
              }}>
                {saving ? 'Salvando...' : editingId ? (
                  <><Pencil size={14} /> Salvar Alterações</>
                ) : (
                  <>Registrar este Momento <ArrowRight size={15} /></>
                )}
              </button>

              {editingId && (
                <button type="button" onClick={resetForm} style={{
                  width: '100%', padding: '9px 16px', borderRadius: 8,
                  background: 'transparent', border: `1px solid ${D.border}`,
                  color: D.muted, fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <X size={12} /> Cancelar edição
                </button>
              )}

            </form>
          </div>
        </div>

      </div>

      {/* ── Relatório Overlay ─────────────────────────────────────────── */}
      {showRelatorio && (() => {
        const grouped: Record<string, RelRow[]> = {};
        for (const row of relData) {
          const key = row.industria || '(Sem indústria)';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row);
        }
        const total = relData.length;

        const thStyle: React.CSSProperties = {
          padding: '7px 10px', textAlign: 'left', fontSize: 10,
          fontWeight: 700, color: '#6B7A8A', letterSpacing: '0.06em',
          textTransform: 'uppercase', borderBottom: '2px solid #D6CCBA',
          background: '#F2EDE4',
        };
        const tdStyle: React.CSSProperties = {
          padding: '8px 10px', fontSize: 12, color: '#28374A',
          borderBottom: '1px solid #E8E1D4', verticalAlign: 'top',
        };

        return (
          <div id="relatorio-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: '#E8E1D4', display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Overlay header */}
            <div id="relatorio-print-controls" style={{
              background: D.bg, borderBottom: `1px solid ${D.border}`,
              padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 14,
              flexShrink: 0,
            }}>
              <FileText size={16} style={{ color: D.gold }} />
              <div style={{ fontSize: 14, fontWeight: 800, color: D.text }}>
                Relatório de Relacionamentos
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={window.print} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: `${D.gold}22`, border: `1px solid ${D.gold}50`,
                color: D.gold, borderRadius: 8, padding: '7px 15px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                <Printer size={13} /> Imprimir
              </button>
              <button onClick={() => setShowRelatorio(false)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'transparent', border: `1px solid ${D.border}`,
                color: D.muted, borderRadius: 8, padding: '7px 14px',
                fontSize: 12, cursor: 'pointer',
              }}>
                <X size={13} /> Fechar
              </button>
            </div>

            {/* Filters */}
            <div id="relatorio-print-controls" style={{
              background: '#F2EDE4', borderBottom: '1px solid #D6CCBA',
              padding: '12px 24px', display: 'flex', alignItems: 'flex-end', gap: 14, flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A8A', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>Data Início</div>
                <input type="date" value={relFilter.dataInicio}
                  onChange={e => setRelFilter(f => ({ ...f, dataInicio: e.target.value }))}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D6CCBA', background: '#fff', fontSize: 13, color: '#28374A', outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A8A', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>Data Fim</div>
                <input type="date" value={relFilter.dataFim}
                  onChange={e => setRelFilter(f => ({ ...f, dataFim: e.target.value }))}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D6CCBA', background: '#fff', fontSize: 13, color: '#28374A', outline: 'none' }}
                />
              </div>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7A8A', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>Indústria</div>
                <select value={relFilter.for_codigo}
                  onChange={e => setRelFilter(f => ({ ...f, for_codigo: e.target.value }))}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D6CCBA', background: '#fff', fontSize: 13, color: '#28374A', outline: 'none', width: '100%' }}
                >
                  <option value="">Todas as indústrias</option>
                  {industrias.map(i => (
                    <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered || i.for_nome}</option>
                  ))}
                </select>
              </div>
              <button onClick={loadRelatorio} disabled={relLoading} style={{
                padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#FFD200', color: '#28374A', border: 'none',
                cursor: relLoading ? 'wait' : 'pointer',
              }}>
                {relLoading ? 'Buscando...' : 'Buscar'}
              </button>
              {total > 0 && (
                <div style={{ fontSize: 12, color: '#6B7A8A', marginLeft: 'auto' }}>
                  <strong style={{ color: '#28374A' }}>{total}</strong> registro{total !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {relError && (
                <div style={{
                  padding: '14px 18px', borderRadius: 10, marginBottom: 16,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  fontSize: 13, color: '#B91C1C', fontWeight: 600,
                }}>
                  ⚠ {relError}
                </div>
              )}
              {!relLoading && !relError && relData.length === 0 && !relSearched && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7A8A', fontSize: 13 }}>
                  Selecione o período e clique em <strong>Buscar</strong> para gerar o relatório.
                </div>
              )}
              {!relLoading && !relError && relData.length === 0 && relSearched && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7A8A', fontSize: 13 }}>
                  Nenhum registro encontrado para os filtros selecionados.
                </div>
              )}
              {Object.entries(grouped).map(([industria, rows]) => (
                <div key={industria} style={{ marginBottom: 28 }}>
                  {/* Industry header */}
                  <div style={{
                    background: '#28374A', color: '#FFD200',
                    padding: '8px 14px', borderRadius: '8px 8px 0 0',
                    fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Building2 size={13} />
                    {industria}
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: '#8BA4BD' }}>
                      {rows.length} registro{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Table */}
                  <div style={{ border: '1px solid #D6CCBA', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Data</th>
                          <th style={thStyle}>Horário</th>
                          <th style={thStyle}>Cliente</th>
                          <th style={thStyle}>Cidade</th>
                          <th style={thStyle}>Operador</th>
                          <th style={thStyle}>Tipo</th>
                          <th style={thStyle}>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <>
                            <tr key={`${row.interacao_id}-main`} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                              <td style={tdStyle}>{fmtDate(row.data_interacao)}</td>
                              <td style={tdStyle}>{fmtTime(row.data_interacao)}</td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{row.cliente_nome}</td>
                              <td style={tdStyle}>{row.cli_cidade}</td>
                              <td style={tdStyle}>{row.operador || '—'}</td>
                              <td style={tdStyle}>
                                <span style={{
                                  fontSize: 10, fontWeight: 700,
                                  padding: '2px 8px', borderRadius: 4,
                                  background: `${tipoColor(row.tipo)}1A`,
                                  color: tipoColor(row.tipo),
                                }}>
                                  {row.tipo}
                                </span>
                              </td>
                              <td style={tdStyle}>{row.resultado || '—'}</td>
                            </tr>
                            {row.descricao && (
                              <tr key={`${row.interacao_id}-desc`} style={{ background: i % 2 === 0 ? '#F8F6F2' : '#F5F3EE' }}>
                                <td colSpan={7} style={{
                                  ...tdStyle, fontSize: 11, color: '#6B7A8A',
                                  fontStyle: 'italic', paddingLeft: 24, paddingTop: 4, paddingBottom: 10,
                                }}>
                                  {row.descricao}
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
