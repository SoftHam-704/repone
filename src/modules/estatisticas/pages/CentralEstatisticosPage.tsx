import { useState, useMemo } from 'react';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, TrendingUp, Building2, Users, Package,
  ArrowLeftRight, Store, ShoppingCart, Calendar,
  Hash, Clock, UserX, ChevronRight,
  Construction, PieChart, Target,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import MapaVendas from '../components/MapaVendas';
import ClientInsight from '../components/ClientInsight';
import SelloutPeriodo from '../components/SelloutPeriodo';
import SelloutReal from '../components/SelloutReal';
import MapaCliIndustria from '../components/MapaCliIndustria';
import ClientesYoY from '../components/ClientesYoY';
import MapaMensalItens from '../components/MapaMensalItens';
import ComparativoClientes from '../components/ComparativoClientes';
import GrupoLojas from '../components/GrupoLojas';
import ItensNuncaComprados from '../components/ItensNuncaComprados';
import Mapa3Anos from '../components/Mapa3Anos';
import UltimasCompras from '../components/UltimasCompras';
import ClientesInativos from '../components/ClientesInativos';
import ProdUnicaCompra from '../components/ProdUnicaCompra';
import VendaMensalIndustria from '../components/VendaMensalIndustria';
import MapaPedidos from '../components/MapaPedidos';
import CurvaABC from '../components/CurvaABC';
import MapaOportunidades from '../components/MapaOportunidades';
import MapaIndustria from '../components/MapaIndustria';

// ─── Rotinas disponíveis ───────────────────────────────────────────────────────
const ROTINAS = [
  {
    id: 'mapa-industria',
    label: 'Mapa por Indústria',
    desc: 'Faturamento mensal por indústria — valor e quantidade',
    icon: BarChart2,
    color: '#0891B2',
  },
  {
    id: 'mapa-vendas',
    label: 'Mapa de Vendas',
    desc: 'Visão geral do faturamento por indústria e cliente',
    icon: BarChart2,
    color: '#0891B2',
  },
  {
    id: 'sellout',
    label: 'Sellin por Período',
    desc: 'Análise de sell-in (pedidos do rep) por período selecionado',
    icon: TrendingUp,
    color: '#16A34A',
  },
  {
    id: 'sellout-real',
    label: 'Sellout por Período',
    desc: 'Dados reais de sell-out registrados manualmente (crm_sellout)',
    icon: ShoppingCart,
    color: '#0891B2',
  },
  {
    id: 'mapa-cli-industria',
    label: 'Mapa CLI / Indústria',
    desc: 'Cruzamento de clientes atendidos por indústria',
    icon: Building2,
    color: '#7C3AED',
  },
  {
    id: 'clientes-mom',
    label: 'Clientes Ano a Ano',
    desc: 'Comparativo YoY de clientes por indústria — valor e quantidade',
    icon: Users,
    color: '#D97706',
  },
  {
    id: 'mapa-mensal-itens',
    label: 'Mapa Mensal de Itens',
    desc: 'Quantidade de itens vendidos mês a mês',
    icon: Package,
    color: '#0F766E',
  },
  {
    id: 'comparativo-clientes',
    label: 'Comparativo Clientes',
    desc: 'Comparação de desempenho entre clientes no período',
    icon: ArrowLeftRight,
    color: '#BE185D',
  },
  {
    id: 'grupo-lojas',
    label: 'Grupo de Lojas',
    desc: 'Consolidado de clientes agrupados por rede/grupo',
    icon: Store,
    color: '#B45309',
  },
  {
    id: 'itens-nunca-comprados',
    label: 'Itens Nunca Comprados',
    desc: 'Produtos do catálogo sem nenhuma venda registrada',
    icon: ShoppingCart,
    color: '#DC2626',
  },
  {
    id: 'mapa-3-anos',
    label: 'Mapa 3 Anos',
    desc: 'Evolução comparativa dos últimos 3 anos',
    icon: Calendar,
    color: '#1D4ED8',
  },
  {
    id: 'ultimas-compras',
    label: 'Últimas Compras',
    desc: 'Clientes ordenados pela data da última compra',
    icon: Clock,
    color: '#EA580C',
  },
  {
    id: 'clientes-inativos',
    label: 'Clientes Inativos',
    desc: 'Clientes sem compra no período selecionado',
    icon: UserX,
    color: '#6B7280',
  },
  {
    id: 'prod-unica-compra',
    label: 'Prod. Única Compra',
    desc: 'Produtos comprados apenas uma vez no período',
    icon: ShoppingCart,
    color: '#9333EA',
  },
  {
    id: 'venda-mensal-industria',
    label: 'Venda Mensal Indústria',
    desc: 'Faturamento mensal consolidado por indústria',
    icon: BarChart2,
    color: '#0369A1',
  },
  {
    id: 'mapa-pedidos',
    label: 'Mapa de Pedidos',
    desc: 'Visão geral de pedidos por status e período',
    icon: Package,
    color: '#B45309',
  },
  {
    id: 'client-insight',
    label: 'Client Insight',
    desc: 'Visão 360° da carteira — faturamento, mix, inatividade',
    icon: Users,
    color: '#3B82F6',
  },
  {
    id: 'curva-abc',
    label: 'Curva ABC Produtos',
    desc: 'Classificação Pareto de SKUs por faturamento',
    icon: PieChart,
    color: '#059669',
  },
  {
    id: 'mapa-oportunidades',
    label: 'Mapa de Oportunidades',
    desc: 'Portfólio da indústria × compras do cliente — frequência e gap',
    icon: Target,
    color: '#DC2626',
  },
] as const;

type RotinaId = typeof ROTINAS[number]['id'];

// ─── Rotina Card (esquerdo) ────────────────────────────────────────────────────
function RotinaCard({
  rotina, active, onClick,
}: {
  rotina: typeof ROTINAS[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = rotina.icon;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        padding: '12px 14px', borderRadius: 14,
        background: active ? `${rotina.color}12` : 'transparent',
        outline: active ? `1.5px solid ${rotina.color}40` : '1.5px solid transparent',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {/* Active indicator */}
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 8, bottom: 8,
          width: 3, borderRadius: '0 3px 3px 0',
          background: rotina.color,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: active ? `${rotina.color}20` : `${rotina.color}10`,
        border: `1px solid ${rotina.color}${active ? '40' : '20'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        <Icon size={16} style={{ color: rotina.color }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 800, color: active ? rotina.color : G.text,
          letterSpacing: 0.1, transition: 'color 0.15s',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {rotina.label}
        </div>
        <div style={{
          fontSize: 10, color: G.textMuted, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {rotina.desc}
        </div>
      </div>

      {active && <ChevronRight size={13} style={{ color: rotina.color, flexShrink: 0 }} />}
    </motion.button>
  );
}

// ─── Placeholder de rotina ────────────────────────────────────────────────────
function RotinaPlaceholder({ rotina }: { rotina: typeof ROTINAS[number] }) {
  const Icon = rotina.icon;
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 48,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 22,
        background: `${rotina.color}12`,
        border: `2px solid ${rotina.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={36} style={{ color: rotina.color }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: G.text, marginBottom: 8 }}>
          {rotina.label}
        </div>
        <div style={{ fontSize: 13, color: G.textMuted, lineHeight: 1.6 }}>
          {rotina.desc}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 10,
        background: `${rotina.color}10`, border: `1px solid ${rotina.color}30`,
        fontSize: 12, color: rotina.color, fontWeight: 700,
      }}>
        <Construction size={14} />
        Em construção — disponível em breve
      </div>
    </div>
  );
}

// ─── Painel direito header ────────────────────────────────────────────────────
function ContentHeader({ rotina, dataInicio, dataFim, onDataInicio, onDataFim }: {
  rotina: typeof ROTINAS[number];
  dataInicio: string;
  dataFim: string;
  onDataInicio: (v: string) => void;
  onDataFim: (v: string) => void;
}) {
  const Icon = rotina.icon;
  return (
    <div style={{
      padding: '16px 24px', background: G.card,
      borderBottom: `1px solid ${G.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: `${rotina.color}15`,
          border: `1px solid ${rotina.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: rotina.color }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: G.text, letterSpacing: -0.3 }}>
            {rotina.label}
          </div>
          <div style={{ fontSize: 11, color: G.textMuted, marginTop: 1 }}>
            {rotina.desc}
          </div>
        </div>
      </div>

      {/* Filtro de período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>Período:</span>
        <input
          type="date" value={dataInicio}
          onChange={e => onDataInicio(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${G.border}`, background: G.cardHi,
            color: G.text, outline: 'none', cursor: 'pointer',
          }}
        />
        <span style={{ fontSize: 11, color: G.textMuted }}>até</span>
        <input
          type="date" value={dataFim}
          onChange={e => onDataFim(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${G.border}`, background: G.cardHi,
            color: G.text, outline: 'none', cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}

// ─── CentralEstatisticosPage ───────────────────────────────────────────────────
export default function CentralEstatisticosPage() {
  const schema = useAuthStore(s => s.tenantConfig?.schema);
  const rotinas = useMemo(() =>
    ROTINAS.filter(r => r.id !== 'mapa-oportunidades' || schema === 'ro_consult'),
  [schema]);

  const [rotinaAtiva, setRotinaAtiva] = useState<RotinaId>('mapa-vendas');

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  const rotinaObj = rotinas.find(r => r.id === rotinaAtiva) ?? rotinas[0]!;

  return (
    <div style={{ display: 'flex', height: '100vh', background: G.bg, overflow: 'hidden' }}>

      {/* ── Painel Esquerdo — Seletor de Rotinas ── */}
      <div style={{
        width: 260, flexShrink: 0,
        background: G.card, borderRight: `1px solid ${G.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header esquerdo */}
        <div style={{
          padding: '18px 16px 12px',
          borderBottom: `1px solid ${G.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <BarChart2 size={18} style={{ color: G.mustard }} />
            <span style={{ fontSize: 13, fontWeight: 900, color: G.text, letterSpacing: -0.2 }}>
              CENTRAL
            </span>
            <span style={{ fontSize: 13, fontWeight: 900, color: G.mustard, letterSpacing: -0.2 }}>
              ESTATÍSTICOS
            </span>
          </div>
          <p style={{ fontSize: 10, color: G.textMuted, margin: 0, letterSpacing: 0.3 }}>
            {rotinas.length} rotinas disponíveis
          </p>
        </div>

        {/* Lista de rotinas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rotinas.map(rotina => (
              <RotinaCard
                key={rotina.id}
                rotina={rotina}
                active={rotinaAtiva === rotina.id}
                onClick={() => setRotinaAtiva(rotina.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Conteúdo ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <ContentHeader
          rotina={rotinaObj}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicio={setDataInicio}
          onDataFim={setDataFim}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={rotinaAtiva}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {rotinaAtiva === 'mapa-industria'
              ? <MapaIndustria dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'mapa-vendas'
              ? <MapaVendas dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'sellout'
              ? <SelloutPeriodo dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'sellout-real'
              ? <SelloutReal dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'mapa-cli-industria'
              ? <MapaCliIndustria dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'client-insight'
              ? <ClientInsight />
              : rotinaAtiva === 'clientes-mom'
              ? <ClientesYoY />
              : rotinaAtiva === 'mapa-mensal-itens'
              ? <MapaMensalItens dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'comparativo-clientes'
              ? <ComparativoClientes dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'grupo-lojas'
              ? <GrupoLojas dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'itens-nunca-comprados'
              ? <ItensNuncaComprados dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'mapa-3-anos'
              ? <Mapa3Anos dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'ultimas-compras'
              ? <UltimasCompras dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'clientes-inativos'
              ? <ClientesInativos dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'prod-unica-compra'
              ? <ProdUnicaCompra dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'venda-mensal-industria'
              ? <VendaMensalIndustria dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'mapa-pedidos'
              ? <MapaPedidos dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'curva-abc'
              ? <CurvaABC dataInicio={dataInicio} dataFim={dataFim} />
              : rotinaAtiva === 'mapa-oportunidades'
              ? <MapaOportunidades dataInicio={dataInicio} dataFim={dataFim} />
              : <RotinaPlaceholder rotina={rotinaObj} />
            }
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
