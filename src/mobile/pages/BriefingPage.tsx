import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Package, Zap, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { db }           from '../db/db';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileClient } from '../db/types';

/* ─── types ────────────────────────────────────────────────────────────────── */
interface ClientDetail {
  resumo: {
    total_valor:   number;
    total_pedidos: number;
    total_skus:    number;
    total_itens:   number;
  };
  pedidos: {
    ped_pedido:  string;
    ped_data:    string;
    industria:   string;
    ped_totliq:  number;
    total_skus:  number;
    total_itens: number;
  }[];
  industrias: {
    industria:     string;
    total_valor:   number;
    total_pedidos: number;
    total_skus:    number;
    ultimo_pedido: string;
  }[];
}

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const fmtBRL   = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDate  = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const RISK_COLOR: Record<string, string> = {
  ativo: '#16A34A', em_queda: '#D97706', burnout: '#DC2626',
};
const RISK_LABEL: Record<string, string> = {
  ativo: 'Ativo', em_queda: 'Em queda', burnout: 'Burnout',
};

/* ─── Subcomponents ─────────────────────────────────────────────────────────── */

function SectionTitle({ icon: Icon, label, accent }: { icon: any; label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 10,
        background: accent ?? 'var(--navy)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={13} color="#FFF" strokeWidth={2.5} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)',
        textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div style={{ background: `${color}0F`, borderRadius: 14, padding: '10px 4px',
      textAlign: 'center', border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default function BriefingPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnline } = useOffline();

  const [cliente,   setCliente]   = useState<MobileClient | null>(null);
  const [detail,    setDetail]    = useState<ClientDetail | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loadingD,  setLoadingD]  = useState(false);
  const [loadingN,  setLoadingN]  = useState(false);
  const [showAll,   setShowAll]   = useState(false);

  /* load local client from Dexie */
  useEffect(() => {
    if (!id) return;
    db.clients.get(Number(id)).then(c => setCliente(c ?? null));
  }, [id]);

  /* load detail + narrative when online */
  useEffect(() => {
    if (!id || !isOnline) return;
    setLoadingD(true);
    api.get(`/dashboard/mobile-client/${id}`)
      .then(r => { if (r.data.success) setDetail(r.data.data); })
      .catch(() => {})
      .finally(() => setLoadingD(false));

    setLoadingN(true);
    api.post('/orders/iris-panel-narrative', { clienteId: Number(id) })
      .then(r => setNarrative(r.data.data?.narrative ?? r.data.narrative ?? null))
      .catch(() => setNarrative(null))
      .finally(() => setLoadingN(false));
  }, [id, isOnline]);

  if (!cliente && !loadingD) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MobileHeader title="Briefing" showBack />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--navy-muted)', fontSize: 13 }}>
          Cliente não encontrado. Sincronize primeiro.
        </div>
      </div>
    );
  }

  const riskColor = RISK_COLOR[cliente?.risk ?? ''] ?? 'var(--navy-muted)';
  const pedidosShown = showAll ? (detail?.pedidos ?? []) : (detail?.pedidos ?? []).slice(0, 4);
  const totalInds = detail?.industrias?.reduce((s, i) => s + Number(i.total_valor), 0) ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title={cliente?.cli_nomred ?? '...'} showBack />

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 100px' }}>

        {/* ── Identity card ─────────────────────────────────────────────── */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          style={{ background: '#FFF', borderRadius: 16, padding: '16px', marginBottom: 14,
            border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>
                {cliente?.cli_nomred ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--navy-muted)' }}>
                {cliente?.cli_cidade}{cliente?.cli_uf ? ` — ${cliente.cli_uf}` : ''}
              </div>
            </div>
            {cliente?.risk && (
              <span style={{ fontSize: 11, fontWeight: 700, color: riskColor,
                background: `${riskColor}1A`, padding: '4px 12px', borderRadius: 8, flexShrink: 0 }}>
                {RISK_LABEL[cliente.risk] ?? cliente.risk}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Resumo trimestre ──────────────────────────────────────────── */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
            border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <SectionTitle icon={ShoppingCart} label="Trimestre (90 dias)" />

          {loadingD ? (
            <div style={{ fontSize: 12, color: 'var(--navy-muted)', padding: '8px 0' }}>Carregando...</div>
          ) : detail ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy)',
                letterSpacing: -1, marginBottom: 4 }}>
                {fmtBRL(detail.resumo.total_valor)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <StatChip label="Pedidos"    value={detail.resumo.total_pedidos} color="#2563eb" />
                <StatChip label="SKUs únicos" value={detail.resumo.total_skus}   color="#7c3aed" />
                <StatChip label="Total itens" value={Math.round(Number(detail.resumo.total_itens))} color="#059669" />
              </div>
            </>
          ) : !isOnline ? (
            <div style={{ fontSize: 12, color: 'var(--navy-muted)', fontStyle: 'italic' }}>Disponível apenas online</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--navy-muted)' }}>Sem pedidos no trimestre</div>
          )}
        </motion.div>

        {/* ── Últimos pedidos ───────────────────────────────────────────── */}
        {detail && detail.pedidos.length > 0 && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.14 }}
            style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
              border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
            <SectionTitle icon={Package} label="Últimos Pedidos" />

            {pedidosShown.map((p, i) => (
              <div key={p.ped_pedido}
                style={{ padding: '11px 0', borderBottom: i < pedidosShown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--mustard)',
                        textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        #{p.ped_pedido}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>{fmtDate(p.ped_data)}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
                      marginTop: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.industria}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>
                        {p.total_skus} SKUs · {Math.round(Number(p.total_itens))} itens
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)',
                    letterSpacing: -0.5, flexShrink: 0, marginLeft: 8 }}>
                    {fmtBRL(p.ped_totliq)}
                  </div>
                </div>
              </div>
            ))}

            {detail.pedidos.length > 4 && (
              <button onClick={() => setShowAll(v => !v)}
                style={{ width: '100%', marginTop: 10, background: 'none', border: 'none',
                  color: 'var(--mustard)', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {showAll ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver todos ({detail.pedidos.length})</>}
              </button>
            )}
          </motion.div>
        )}

        {/* ── Indústrias ────────────────────────────────────────────────── */}
        {detail && detail.industrias.length > 0 && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
              border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
            <SectionTitle icon={Package} label="Indústrias (12 meses)" accent="#059669" />

            {detail.industrias.map((ind, i) => {
              const pct = totalInds > 0 ? Math.round((Number(ind.total_valor) / totalInds) * 100) : 0;
              return (
                <div key={ind.industria}
                  style={{ padding: '10px 0', borderBottom: i < detail.industrias.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)',
                      textTransform: 'uppercase', flex: 1, minWidth: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ind.industria}
                    </span>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)' }}>
                        {fmtShort(ind.total_valor)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--navy-muted)', marginLeft: 6 }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  {/* progress bar */}
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`,
                      background: 'var(--mustard)', borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>{ind.total_pedidos} pedidos</span>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>{ind.total_skus} SKUs</span>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>último: {fmtDate(ind.ultimo_pedido)}</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── IRIS Narrative ────────────────────────────────────────────── */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.26 }}
          style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
            border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionTitle icon={Zap} label="Narrativa IRIS" accent="var(--mustard)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px',
              borderRadius: 20, background: 'rgba(255,210,0,0.1)', border: '1px solid rgba(255,210,0,0.25)' }}>
              <Sparkles size={9} color="var(--mustard)" />
              <span style={{ fontSize: 8, fontWeight: 900, color: 'var(--mustard)',
                textTransform: 'uppercase', letterSpacing: 1 }}>IA</span>
            </div>
          </div>
          {!isOnline ? (
            <p style={{ fontSize: 13, color: 'var(--navy-muted)', fontStyle: 'italic', margin: 0 }}>
              Narrativa IRIS indisponível sem conexão.
            </p>
          ) : loadingN ? (
            <p style={{ fontSize: 13, color: 'var(--navy-muted)', margin: 0 }}>Gerando análise com IA...</p>
          ) : narrative ? (
            <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.7, margin: 0 }}>{narrative}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--navy-muted)', fontStyle: 'italic', margin: 0 }}>
              Análise não disponível para este cliente.
            </p>
          )}
        </motion.div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <button onClick={() => navigate(`/mobile/pedido?cliente=${id}`)}
          style={{ background: 'var(--mustard)', color: 'var(--navy)', border: 'none',
            borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 800,
            cursor: 'pointer', width: '100%', boxShadow: '0 4px 14px rgba(255,210,0,0.35)' }}>
          Fazer Pedido →
        </button>
      </div>
    </div>
  );
}
