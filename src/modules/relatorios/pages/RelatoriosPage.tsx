import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, BarChart2, Users, Package, ShoppingCart,
  TrendingUp, Target, DollarSign, UserX, Building2,
  ChevronRight, Construction, Printer, Download,
  Receipt, Truck, Tag, Wallet, BookOpen,
  ClipboardList, MapPin,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { Loader2 } from 'lucide-react';

const ClientesSimplificadaReport  = lazy(() => import('../components/ClientesSimplificadaReport'));
const ClientesSelecionavelReport  = lazy(() => import('../components/ClientesSelecionavelReport'));
const IndustriasReport            = lazy(() => import('../components/IndustriasReport'));
const TransportadorasReport          = lazy(() => import('../components/TransportadorasReport'));
const TabelaPrecosDescontoReport     = lazy(() => import('../components/TabelaPrecosDescontoReport'));
const TabelaPrecosCompletaReport     = lazy(() => import('../components/TabelaPrecosCompletaReport'));
const TabelaPrecosReduzidaReport     = lazy(() => import('../components/TabelaPrecosReduzidaReport'));
const PromocaoProdutosReport         = lazy(() => import('../components/PromocaoProdutosReport'));
const ClientesIndustriaReport        = lazy(() => import('../components/ClientesIndustriaReport'));
const ClientesAreaAtuacaoReport      = lazy(() => import('../components/ClientesAreaAtuacaoReport'));
const VendasFamiliaReport            = lazy(() => import('../components/VendasFamiliaReport'));
const VendasProdutoReport            = lazy(() => import('../components/VendasProdutoReport'));
const VendasPeriodoReport            = lazy(() => import('../components/VendasPeriodoReport'));
const VendasClienteIndustriaReport   = lazy(() => import('../components/VendasClienteIndustriaReport'));
const VendasPeriodoSinteticoReport   = lazy(() => import('../components/VendasPeriodoSinteticoReport'));
const VendasCidadeEstadoReport       = lazy(() => import('../components/VendasCidadeEstadoReport'));
const CotacoesPendentesReport        = lazy(() => import('../components/CotacoesPendentesReport'));
const ComissaoVendedoresReport       = lazy(() => import('../components/ComissaoVendedoresReport'));
const FaturamentoPeriodoReport       = lazy(() => import('../components/FaturamentoPeriodoReport'));
const PedidosFaturadosReport         = lazy(() => import('../components/PedidosFaturadosReport'));
const FaturamentoPendenteReport      = lazy(() => import('../components/FaturamentoPendenteReport'));
const ProdutosNaoFaturadosReport     = lazy(() => import('../components/ProdutosNaoFaturadosReport'));

// ─── Categorias + relatórios ──────────────────────────────────────────────────
type CategoriaId = 'cadastros' | 'vendas' | 'faturamento' | 'financeiro';

const CATEGORIAS: { id: CategoriaId; label: string; color: string }[] = [
  { id: 'cadastros',    label: 'Cadastros',          color: '#0891B2' },
  { id: 'vendas',       label: 'Vendas Realizadas',  color: '#16A34A' },
  { id: 'faturamento',  label: 'Faturamento',        color: '#D97706' },
  { id: 'financeiro',   label: 'Financeiro',         color: '#7C3AED' },
];

interface Relatorio {
  id: string;
  label: string;
  desc: string;
  icon: any;
}

const RELATORIOS_POR_CATEGORIA: Record<CategoriaId, Relatorio[]> = {
  cadastros: [
    { id: 'cli-simplificada',      label: 'Clientes (simplificada)',          desc: 'Listagem resumida da carteira de clientes',            icon: Users },
    { id: 'cli-selecionavel',      label: 'Clientes (selecionável)',          desc: 'Lista de clientes com filtros por campo',              icon: Users },
    { id: 'industrias',            label: 'Indústrias',                       desc: 'Ficha completa das indústrias cadastradas',           icon: Building2 },
    { id: 'transportadoras',       label: 'Transportadoras',                  desc: 'Ficha completa das transportadoras cadastradas',       icon: Truck },
    { id: 'tabela-descontos',      label: 'Tabela de preços com descontos',   desc: 'Tabela de preços aplicando descontos por grupo',       icon: Tag },
    { id: 'tabela-completa',       label: 'Tabela de preços completa',        desc: 'Preços completos de todos os produtos',                icon: Package },
    { id: 'tabela-reduzida',       label: 'Tabela de preço reduzida',         desc: 'Tabela com preços no formato reduzido',                icon: Package },
    { id: 'cli-industria',         label: 'Relação clientes por indústria',   desc: 'Clientes agrupados por indústria atendida',            icon: Building2 },
    { id: 'promocao-produtos',     label: 'Promoção de produtos',             desc: 'Produtos em promoção com preços promocionais',         icon: Tag },
    { id: 'cli-area-atuacao',      label: 'Clientes por área de atuação',     desc: 'Clientes agrupados pela área/região de atuação',       icon: MapPin },
  ],
  vendas: [
    { id: 'cotacoes-pendentes',      label: 'Cotações pendentes',            desc: 'Cotações em aberto para o rep correr atrás e fechar',     icon: ClipboardList },
    { id: 'vendas-periodo',          label: 'Vendas no período',             desc: 'Pedidos por período, filtrado por vendedor e indústria',  icon: ShoppingCart },
    { id: 'vendas-periodo-totais',   label: 'Vendas no período (sintético)', desc: 'Totais por indústria agrupados no intervalo selecionado', icon: BarChart2 },
    { id: 'vendas-cliente-industria',label: 'Vendas por cliente/indústria',  desc: 'Pedidos de um cliente agrupados por indústria',           icon: Users },
    { id: 'vendas-cidade-estado',    label: 'Vendas por cidade/estado',      desc: 'Pedidos agrupados por cidade dentro de um estado',        icon: MapPin },
    { id: 'produtos-vendidos',       label: 'Produtos vendidos',             desc: 'SKUs vendidos com quantidade e valor por período',        icon: Package },
    { id: 'produtos-grupo-clientes', label: 'Produtos por grupo/clientes',   desc: 'Mix de produtos por grupo e carteira de clientes',        icon: ShoppingCart },
  ],
  faturamento: [
    { id: 'comissao-vendedores',       label: 'Comissão vendedores',              desc: 'Cálculo de comissões por vendedor e período',            icon: DollarSign },
    { id: 'faturamento-periodo',       label: 'Faturamento no período',           desc: 'Notas fiscais emitidas no intervalo selecionado',        icon: Receipt },
    { id: 'pedidos-faturados',         label: 'Pedidos faturados no período',     desc: 'Pedidos com NF emitida no período',                      icon: ShoppingCart },
    { id: 'faturamento-pendente',      label: 'Faturamento pendente',             desc: 'Pedidos aprovados ainda não faturados',                  icon: ClipboardList },
    { id: 'produtos-nao-faturados',    label: 'Produtos não faturados',           desc: 'Itens de pedido sem NF correspondente',                  icon: Package },
  ],
  financeiro: [
    { id: 'contas-pagar-receber',      label: 'Contas pagar/receber por vencimento', desc: 'Posição de contas a pagar e receber por data de vencimento', icon: Wallet },
  ],
};

// ─── Relatorio Card ───────────────────────────────────────────────────────────
function RelatorioCard({
  relatorio, active, color, onClick,
}: {
  relatorio: Relatorio;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  const Icon = relatorio.icon;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        padding: '10px 12px', borderRadius: 12,
        background: active ? `${color}12` : 'transparent',
        outline: active ? `1.5px solid ${color}40` : '1.5px solid transparent',
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 7, bottom: 7,
          width: 3, borderRadius: '0 3px 3px 0',
          background: color,
        }} />
      )}

      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: active ? `${color}20` : `${color}10`,
        border: `1px solid ${color}${active ? '40' : '20'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        <Icon size={14} style={{ color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: active ? color : G.text,
          letterSpacing: 0.1, transition: 'color 0.15s',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {relatorio.label}
        </div>
        <div style={{
          fontSize: 10, color: G.textMuted, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {relatorio.desc}
        </div>
      </div>

      {active && <ChevronRight size={12} style={{ color, flexShrink: 0 }} />}
    </motion.button>
  );
}

// ─── Placeholder ─────────────────────────────────────────────────────────────
function RelatorioPlaceholder({
  relatorio, color,
}: {
  relatorio: Relatorio;
  color: string;
}) {
  const Icon = relatorio.icon;
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 48,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: `${color}12`, border: `2px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={32} style={{ color }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: G.text, marginBottom: 6 }}>
          {relatorio.label}
        </div>
        <div style={{ fontSize: 13, color: G.textMuted, lineHeight: 1.6 }}>
          {relatorio.desc}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 10,
        background: `${color}10`, border: `1px solid ${color}30`,
        fontSize: 12, color, fontWeight: 700,
      }}>
        <Construction size={14} />
        Em construção — disponível em breve
      </div>
    </div>
  );
}

// ─── CategoriaVazia ───────────────────────────────────────────────────────────
function CategoriaVazia({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48,
    }}>
      <BookOpen size={40} style={{ color, opacity: 0.4 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: G.text, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: G.textMuted }}>
          Relatórios desta categoria em construção
        </div>
      </div>
    </div>
  );
}

// ─── ContentHeader ────────────────────────────────────────────────────────────
function ContentHeader({
  relatorio, color, dataInicio, dataFim, onDataInicio, onDataFim,
}: {
  relatorio: Relatorio | null;
  color: string;
  dataInicio: string;
  dataFim: string;
  onDataInicio: (v: string) => void;
  onDataFim: (v: string) => void;
}) {
  const Icon = relatorio?.icon ?? FileText;
  return (
    <div style={{
      padding: '14px 22px', background: G.card,
      borderBottom: `1px solid ${G.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: G.text, letterSpacing: -0.3 }}>
            {relatorio?.label ?? 'Selecione um relatório'}
          </div>
          <div style={{ fontSize: 11, color: G.textMuted, marginTop: 1 }}>
            {relatorio?.desc ?? 'Escolha um relatório no painel à esquerda'}
          </div>
        </div>
      </div>

      {relatorio && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>Período:</span>
            <input
              type="date" value={dataInicio}
              onChange={e => onDataInicio(e.target.value)}
              style={{
                padding: '5px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${G.border}`, background: G.cardHi,
                color: G.text, outline: 'none', cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 11, color: G.textMuted }}>até</span>
            <input
              type="date" value={dataFim}
              onChange={e => onDataFim(e.target.value)}
              style={{
                padding: '5px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${G.border}`, background: G.cardHi,
                color: G.text, outline: 'none', cursor: 'pointer',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: `1px solid ${G.border}`, background: 'transparent',
              color: G.textSec, cursor: 'pointer',
            }}>
              <Printer size={12} />
              Imprimir
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: `1px solid ${G.mustard}40`,
              background: `${G.mustard}15`,
              color: G.mustard, cursor: 'pointer',
            }}>
              <Download size={12} />
              Exportar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading fallback ─────────────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Loader2 size={20} style={{ color: G.mustard, animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13, color: G.textMuted, fontWeight: 600 }}>Carregando...</span>
    </div>
  );
}

// ─── RelatoriosPage ───────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const [categoria, setCategoria] = useState<CategoriaId>('cadastros');
  const [relatorioAtivo, setRelatorioAtivo] = useState<string | null>(null);

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  const catObj     = CATEGORIAS.find(c => c.id === categoria)!;
  const relatorios = RELATORIOS_POR_CATEGORIA[categoria];
  const relObj     = relatorios.find(r => r.id === relatorioAtivo) ?? null;

  const handleCategoria = (id: CategoriaId) => {
    setCategoria(id);
    setRelatorioAtivo(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: G.bg, overflow: 'hidden' }}>

      {/* ── Painel Esquerdo ── */}
      <div style={{
        width: 268, flexShrink: 0,
        background: G.card, borderRight: `1px solid ${G.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Cabeçalho */}
        <div style={{
          padding: '16px 14px 10px',
          borderBottom: `1px solid ${G.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <FileText size={16} style={{ color: G.mustard }} />
            <span style={{ fontSize: 13, fontWeight: 900, color: G.text, letterSpacing: -0.2 }}>
              CENTRAL DE
            </span>
            <span style={{ fontSize: 13, fontWeight: 900, color: G.mustard, letterSpacing: -0.2 }}>
              RELATÓRIOS
            </span>
          </div>
          <p style={{ fontSize: 10, color: G.textMuted, margin: 0, letterSpacing: 0.3 }}>
            {Object.values(RELATORIOS_POR_CATEGORIA).flat().length} relatórios · 4 categorias
          </p>
        </div>

        {/* Abas de Categoria */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 4, padding: '8px 8px 4px',
          borderBottom: `1px solid ${G.border}`,
          flexShrink: 0,
        }}>
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoria(cat.id)}
              style={{
                padding: '7px 6px', borderRadius: 9, fontSize: 10, fontWeight: 800,
                border: categoria === cat.id ? `1.5px solid ${cat.color}50` : `1px solid ${G.border}`,
                background: categoria === cat.id ? `${cat.color}15` : 'transparent',
                color: categoria === cat.id ? cat.color : G.textMuted,
                cursor: 'pointer', transition: 'all 0.15s',
                letterSpacing: 0.2, textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lista de Relatórios */}
        <AnimatePresence mode="wait">
          <motion.div
            key={categoria}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}
          >
            {relatorios.length === 0 ? (
              <div style={{
                padding: '24px 12px', textAlign: 'center',
                fontSize: 11, color: G.textMuted, fontStyle: 'italic',
              }}>
                Em construção
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {relatorios.map(rel => (
                  <RelatorioCard
                    key={rel.id}
                    relatorio={rel}
                    active={relatorioAtivo === rel.id}
                    color={catObj.color}
                    onClick={() => setRelatorioAtivo(rel.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Painel Direito ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <ContentHeader
          relatorio={relObj}
          color={catObj.color}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicio={setDataInicio}
          onDataFim={setDataFim}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={`${categoria}-${relatorioAtivo ?? 'none'}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {!relObj ? (
              <CategoriaVazia label={catObj.label} color={catObj.color} />
            ) : relObj.id === 'cli-simplificada' ? (
              <Suspense fallback={<Loading />}><ClientesSimplificadaReport /></Suspense>
            ) : relObj.id === 'cli-selecionavel' ? (
              <Suspense fallback={<Loading />}><ClientesSelecionavelReport /></Suspense>
            ) : relObj.id === 'industrias' ? (
              <Suspense fallback={<Loading />}><IndustriasReport /></Suspense>
            ) : relObj.id === 'transportadoras' ? (
              <Suspense fallback={<Loading />}><TransportadorasReport /></Suspense>
            ) : relObj.id === 'tabela-descontos' ? (
              <Suspense fallback={<Loading />}><TabelaPrecosDescontoReport /></Suspense>
            ) : relObj.id === 'tabela-completa' ? (
              <Suspense fallback={<Loading />}><TabelaPrecosCompletaReport /></Suspense>
            ) : relObj.id === 'tabela-reduzida' ? (
              <Suspense fallback={<Loading />}><TabelaPrecosReduzidaReport /></Suspense>
            ) : relObj.id === 'promocao-produtos' ? (
              <Suspense fallback={<Loading />}><PromocaoProdutosReport /></Suspense>
            ) : relObj.id === 'cli-industria' ? (
              <Suspense fallback={<Loading />}><ClientesIndustriaReport /></Suspense>
            ) : relObj.id === 'cli-area-atuacao' ? (
              <Suspense fallback={<Loading />}><ClientesAreaAtuacaoReport /></Suspense>
            ) : relObj.id === 'produtos-grupo-clientes' ? (
              <Suspense fallback={<Loading />}><VendasFamiliaReport /></Suspense>
            ) : relObj.id === 'produtos-vendidos' ? (
              <Suspense fallback={<Loading />}><VendasProdutoReport /></Suspense>
            ) : relObj.id === 'vendas-periodo' ? (
              <Suspense fallback={<Loading />}><VendasPeriodoReport /></Suspense>
            ) : relObj.id === 'vendas-cliente-industria' ? (
              <Suspense fallback={<Loading />}><VendasClienteIndustriaReport /></Suspense>
            ) : relObj.id === 'vendas-periodo-totais' ? (
              <Suspense fallback={<Loading />}><VendasPeriodoSinteticoReport /></Suspense>
            ) : relObj.id === 'vendas-cidade-estado' ? (
              <Suspense fallback={<Loading />}><VendasCidadeEstadoReport /></Suspense>
            ) : relObj.id === 'cotacoes-pendentes' ? (
              <Suspense fallback={<Loading />}><CotacoesPendentesReport /></Suspense>
            ) : relObj.id === 'comissao-vendedores' ? (
              <Suspense fallback={<Loading />}><ComissaoVendedoresReport /></Suspense>
            ) : relObj.id === 'faturamento-periodo' ? (
              <Suspense fallback={<Loading />}><FaturamentoPeriodoReport /></Suspense>
            ) : relObj.id === 'pedidos-faturados' ? (
              <Suspense fallback={<Loading />}><PedidosFaturadosReport /></Suspense>
            ) : relObj.id === 'faturamento-pendente' ? (
              <Suspense fallback={<Loading />}><FaturamentoPendenteReport /></Suspense>
            ) : relObj.id === 'produtos-nao-faturados' ? (
              <Suspense fallback={<Loading />}><ProdutosNaoFaturadosReport /></Suspense>
            ) : (
              <RelatorioPlaceholder relatorio={relObj} color={catObj.color} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
