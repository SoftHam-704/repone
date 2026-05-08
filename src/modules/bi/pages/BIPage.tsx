import { lazy, Suspense } from 'react';
import { BIShell } from '../components/BIShell';
import { useBIStore } from '../store/useBIStore';
import { BI } from '../components/biTokens';
import { SkeletonCard } from '../components/SkeletonCard';

// ─── Lazy load de cada tab ────────────────────────────────────────────────────
const VisaoGeralTab    = lazy(() => import('../tabs/VisaoGeralTab'));
const IndustriasTab    = lazy(() => import('../tabs/IndustriasTab'));
const ClientesTab      = lazy(() => import('../tabs/ClientesTab'));
const EstatisticasTab  = lazy(() => import('../tabs/EstatisticasTab'));
const CurvaAbcTab      = lazy(() => import('../tabs/CurvaAbcTab'));
const MetasTab         = lazy(() => import('../tabs/MetasTab'));
const EquipeTab        = lazy(() => import('../tabs/EquipeTab'));
const ProdutosTab      = lazy(() => import('../tabs/ProdutosTab'));
const SellInOutTab     = lazy(() => import('../tabs/SellInOutTab'));

// Placeholder para tabs ainda não implementadas
const ComingSoon = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
    <div className="text-5xl font-black" style={{ color: BI.border }}>🚧</div>
    <p className="text-lg font-black" style={{ color: BI.textMuted }}>{label}</p>
    <p className="text-xs" style={{ color: BI.textMuted }}>Em desenvolvimento — Fase 2</p>
  </div>
);

// ─── Tab Loader ───────────────────────────────────────────────────────────────
const TabLoader = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => <SkeletonCard key={i} height={120} />)}
    </div>
    <div className="grid grid-cols-3 gap-4">
      <SkeletonCard height={240} className="col-span-2" />
      <SkeletonCard height={240} />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <SkeletonCard height={280} />
      <SkeletonCard height={280} />
    </div>
  </div>
);

// ─── BIPage ───────────────────────────────────────────────────────────────────
const BIPage = () => {
  const { activeTab } = useBIStore();

  const renderTab = () => {
    switch (activeTab) {
      case 'visao-geral':  return <VisaoGeralTab />;
      case 'industrias':   return <IndustriasTab />;
      case 'clientes':     return <ClientesTab />;
      case 'estatisticas': return <EstatisticasTab />;
      case 'curva-abc':    return <CurvaAbcTab />;
      case 'metas':        return <MetasTab />;
      case 'equipe':       return <EquipeTab />;
      case 'produtos':     return <ProdutosTab />;
      case 'sell-in-out':  return <SellInOutTab />;
      default:             return <VisaoGeralTab />;
    }
  };

  return (
    <BIShell>
      <Suspense fallback={<TabLoader />}>
        {renderTab()}
      </Suspense>
    </BIShell>
  );
};

export default BIPage;
