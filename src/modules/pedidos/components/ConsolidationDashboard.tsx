import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Factory, TrendingUp, ShoppingCart, ArrowRight, Loader2, HelpCircle, Info, Trash2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface ConsolidationStat {
  for_codigo: number;
  for_nomered: string;
  for_min_order: number;
  ped_cliente: number;
  cli_nomred: string;
  cli_nome: string;
  current_total: number;
  order_count: number;
}

const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Tooltip leve baseado em hover ────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<'top' | 'bottom'>('top');

  const show = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 100 ? 'bottom' : 'top');
    }
    setVisible(true);
  };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
          <motion.div
            initial={{ opacity: 0, y: pos === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              [pos === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: G.text,
              color: '#fff',
              fontSize: 11,
              lineHeight: 1.5,
              fontWeight: 500,
              padding: '7px 10px',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              maxWidth: 240,
              zIndex: 9999,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
            }}
          >
            {text}
            {/* Seta */}
            <div style={{
              position: 'absolute',
              [pos === 'top' ? 'top' : 'bottom']: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              [pos === 'top'
                ? 'borderBottom'
                : 'borderTop']: `5px solid ${G.text}`,
            }} />
          </motion.div>
        )}
    </div>
  );
}

// ─── Ícone de ajuda com tooltip ───────────────────────────────────────────────
function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <HelpCircle
        size={13}
        style={{ color: G.textMuted, cursor: 'help', flexShrink: 0, marginLeft: 4 }}
      />
    </Tooltip>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConsolidationDashboard() {
  const [stats, setStats] = useState<ConsolidationStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/orders/consolidation-stats');
      setStats(res.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadDetails = async (induId: number, cliId: number) => {
    const key = `${induId}:${cliId}`;
    setExpanded(key);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/orders?situacao=Q&industria=${induId}&cliente=${cliId}`);
      setDetails(res.data.pedidos || []);
    } catch { /* ignore */ }
    finally { setDetailsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: G.textMuted }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
        <p style={{ fontSize: 13 }}>Carregando dados de consolidação...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Cabeçalho explicativo ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: G.mustard + '14', border: `1px solid ${G.mustard}40`,
        borderRadius: 12, padding: '12px 16px', marginBottom: 20,
      }}>
        <ShoppingCart size={18} style={{ color: G.mustard, flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: G.text, margin: '0 0 2px' }}>
            Como funciona a Fila de Consolidação?
          </p>
          <p style={{ fontSize: 11, color: G.textSec, margin: 0, lineHeight: 1.6 }}>
            Cada indústria exige um <strong>valor mínimo por pedido</strong>.
            O sistema funciona como um <strong>carrinho de compras por cliente</strong>:
            os pedidos vão sendo acumulados na fila até que o valor mínimo seja atingido.
            Somente então você pode consolidá-los e enviar para a indústria.
            Cada cliente tem seu próprio carrinho — os pedidos de clientes diferentes nunca se misturam.
          </p>
        </div>
      </div>

      {/* ── Cards por cliente + indústria ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16, paddingBottom: 20 }}>
        {stats.map(item => {
          const key = `${item.for_codigo}:${item.ped_cliente}`;
          const progress = Math.min((item.current_total / item.for_min_order) * 100, 100);
          const remaining = Math.max(item.for_min_order - item.current_total, 0);
          const isExpanded = expanded === key;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#fff', borderRadius: 16, padding: '16px 20px',
                border: `1px solid ${G.border}`,
                boxShadow: '0 4px 12px rgba(40,55,74,0.06)',
              }}
            >
              {/* ── Cabeçalho do card ── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Tooltip text={`Carrinho de compras de ${item.cli_nomred || item.cli_nome} para a indústria ${item.for_nomered}.\n\nCada cliente tem seu próprio processo de consolidação — os valores nunca se somam entre clientes diferentes.`}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: G.mustard + '18', color: G.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'help',
                    }}>
                      <ShoppingCart size={18} />
                    </div>
                  </Tooltip>

                  <div
                    onClick={() => {
                      if (isExpanded) setExpanded(null);
                      else loadDetails(item.for_codigo, item.ped_cliente);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <h3 style={{ fontSize: 14, fontWeight: 900, color: G.text, margin: 0 }}>
                      {item.for_nomered}
                    </h3>
                    <span style={{ fontSize: 11, color: G.mustard, fontWeight: 800, display: 'block' }}>
                      {item.cli_nomred || item.cli_nome}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{
                        fontSize: 11, color: G.textSec, fontWeight: 700,
                        textDecoration: 'underline', textDecorationStyle: 'dashed',
                      }}>
                        {item.order_count} pedido{Number(item.order_count) !== 1 ? 's' : ''} na fila
                      </span>
                      <HelpTip text={`Estes são os pedidos (OCs) deste cliente que já foram lançados mas ainda aguardam o valor mínimo ser atingido.\n\nClique para ver os pedidos na fila.`} />
                      <ArrowRight size={10} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '0.2s', color: G.textMuted }} />
                    </div>
                  </div>
                </div>

                <TrendingUp size={16} style={{ color: progress >= 100 ? G.success : G.textMuted, flexShrink: 0 }} />
              </div>

              {/* ── Lista expandida de pedidos ── */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    style={{ overflow: 'hidden', marginBottom: 12, background: G.cardHi, borderRadius: 10, padding: 8 }}
                  >
                    {detailsLoading ? (
                      <div style={{ padding: 10, textAlign: 'center' }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : details.length === 0 ? (
                      <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: G.textMuted }}>
                        Nenhum pedido encontrado.
                      </div>
                    ) : details.map(d => (
                      <div key={d.ped_pedido} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 8px', borderBottom: `1px solid ${G.border}20`, fontSize: 11,
                      }}>
                        <span style={{ fontWeight: 900, color: G.mustard, flexShrink: 0 }}>#{d.ped_pedido}</span>
                        {d.ped_oc && (
                          <Tooltip text={`OC do cliente: ${d.ped_oc}\n\nEste número nunca é perdido mesmo após a consolidação.`}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: G.textSec,
                              background: G.mustard + '18', borderRadius: 4,
                              padding: '1px 5px', marginLeft: 6, cursor: 'help',
                              fontFamily: 'monospace', flexShrink: 0,
                            }}>
                              OC {d.ped_oc}
                            </span>
                          </Tooltip>
                        )}
                        <span style={{ fontWeight: 900, color: G.text, marginLeft: 'auto' }}>{fmt(d.ped_totliq)}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

              {/* ── Totais ── */}
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: G.text }}>{fmt(item.current_total)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: G.textMuted }}>Mínimo exigido: {fmt(item.for_min_order)}</span>
                  <HelpTip text={`A indústria ${item.for_nomered} exige no mínimo ${fmt(item.for_min_order)} por pedido de ${item.cli_nomred || item.cli_nome}.\n\nEnquanto este valor não for atingido, o pedido fica na fila.`} />
                </div>
              </div>

              {/* ── Barra de progresso ── */}
              <Tooltip text={`${Math.round(progress)}% do mínimo atingido.\n\n${remaining > 0 ? `Adicione mais ${fmt(remaining)} em pedidos para liberar a consolidação.` : 'Valor mínimo atingido! Você já pode enviar para a indústria.'}`}>
                <div style={{ height: 8, background: '#F2ECE2', borderRadius: 10, overflow: 'hidden', marginBottom: 12, cursor: 'help', width: '100%' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    style={{
                      height: '100%',
                      background: progress >= 100 ? G.success : G.mustard,
                      borderRadius: 10,
                    }}
                  />
                </div>
              </Tooltip>

              {/* ── Rodapé: status + botão ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {remaining > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: G.textMuted }}>
                      Faltam <strong>{fmt(remaining)}</strong>
                    </span>
                    <HelpTip text={`Continue lançando pedidos para ${item.cli_nomred || item.cli_nome} nesta indústria.\n\nQuando o carrinho atingir ${fmt(item.for_min_order)}, o botão de consolidação será liberado.`} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: G.success, fontWeight: 800 }}>META ATINGIDA!</span>
                    <HelpTip text="Todos os pedidos deste cliente para esta indústria atingiram o valor mínimo. Você pode consolidá-los agora em um único pedido para envio." />
                  </div>
                )}

                <Tooltip text={remaining > 0
                  ? `Aguardando mais ${fmt(remaining)} para liberar.\n\nA indústria não aceita pedidos abaixo do mínimo configurado.`
                  : `Clique para unir todos os ${item.order_count} pedido${Number(item.order_count) !== 1 ? 's' : ''} de ${item.cli_nomred || item.cli_nome} em um único pedido de transmissão para ${item.for_nomered}.`
                }>
                  <button
                    onClick={async () => {
                      if (remaining > 0) return;
                      if (!window.confirm(
                        `Consolidar ${item.order_count} pedido${Number(item.order_count) !== 1 ? 's' : ''} de ${item.cli_nomred || item.cli_nome} para ${item.for_nomered}?\n\nOs pedidos serão unidos em um único pedido de transmissão.`
                      )) return;
                      try {
                        await api.post('/orders/consolidate', { indu_id: item.for_codigo, cli_id: item.ped_cliente });
                        load();
                      } catch (e: any) {
                        alert(e.response?.data?.message || 'Erro ao consolidar pedidos');
                      }
                    }}
                    disabled={remaining > 0}
                    style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: remaining > 0 ? G.text + '08' : G.success,
                      color: remaining > 0 ? G.textMuted : '#fff',
                      fontSize: 11, fontWeight: 900,
                      cursor: remaining > 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.2s',
                      boxShadow: remaining > 0 ? 'none' : '0 4px 12px rgba(22,163,74,0.3)',
                    }}
                  >
                    {remaining > 0
                      ? <Loader2 size={13} style={{ opacity: 0.5 }} />
                      : <ArrowRight size={13} />
                    }
                    CONSOLIDAR AGORA
                  </button>
                </Tooltip>
              </div>

              {/* ── Descartar carrinho (tira os pedidos da fila → pedido normal) ── */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                <Tooltip text={`Tira os ${item.order_count} pedido${Number(item.order_count) !== 1 ? 's' : ''} desta fila e os devolve a pedido normal.\n\nNÃO exclui — o pedido continua existindo; só sai da consolidação.`}>
                  <button
                    onClick={async () => {
                      if (!window.confirm(
                        `Descartar o carrinho de ${item.cli_nomred || item.cli_nome} (${item.for_nomered})?\n\n` +
                        `Os ${item.order_count} pedido${Number(item.order_count) !== 1 ? 's' : ''} saem da fila e voltam a ser pedido normal. Não serão excluídos.`
                      )) return;
                      try {
                        await api.post('/orders/descartar-fila', { indu_id: item.for_codigo, cli_id: item.ped_cliente });
                        load();
                      } catch (e: any) {
                        alert(e.response?.data?.message || 'Erro ao descartar o carrinho');
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: G.danger, fontSize: 11, fontWeight: 800, padding: 0,
                    }}
                  >
                    <Trash2 size={12} />
                    Descartar carrinho
                  </button>
                </Tooltip>
              </div>
            </motion.div>
          );
        })}

        {stats.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', padding: '40px', textAlign: 'center',
            color: G.textMuted, background: G.card, borderRadius: 16,
          }}>
            <ShoppingCart size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Nenhum pedido em fila de consolidação no momento.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11 }}>
              Quando um pedido for criado com situação "Fila", ele aparecerá aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
