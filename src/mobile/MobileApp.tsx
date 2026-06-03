import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate }  from 'react-router-dom';
import { useAuthStore }              from '@/shared/stores/useAuthStore';
import { MobileLayout }              from './MobileLayout';
import { autoSync }                  from './db/sync';
import './mobile.css';

const LoginPage        = lazy(() => import('./pages/LoginPage'));
const HomePage         = lazy(() => import('./pages/HomePage'));
const ClientesPage     = lazy(() => import('./pages/ClientesPage'));
const BriefingPage     = lazy(() => import('./pages/BriefingPage'));
const ClienteEditPage  = lazy(() => import('./pages/ClienteEditPage'));
const PedidosPage      = lazy(() => import('./pages/PedidosPage'));
const PedidoPage       = lazy(() => import('./pages/PedidoPage'));
const TabelaPrecosPage = lazy(() => import('./pages/TabelaPrecosPage'));
const SellOutPage      = lazy(() => import('./pages/SellOutPage'));
const CampanhasPage    = lazy(() => import('./pages/CampanhasPage'));
const AgendaPage       = lazy(() => import('./pages/AgendaPage'));
const BIPage           = lazy(() => import('./pages/BIPage'));
const AftermarketPage  = lazy(() => import('./pages/AftermarketPage'));
const RotasPage        = lazy(() => import('./pages/RotasPage'));
const RotaMapaPage     = lazy(() => import('./pages/RotaMapaPage'));
const DespesasPage     = lazy(() => import('./pages/DespesasPage'));

function AuthRequired({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/mobile/login" replace />;
  return <>{children}</>;
}

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#E8E1D4' }}>
    <div style={{ width: 28, height: 28, border: '3px solid #28374A',
      borderTopColor: 'transparent', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite' }} />
  </div>
);

export default function MobileApp() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && navigator.onLine) autoSync();
  }, [isAuthenticated]);

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<AuthRequired><MobileLayout /></AuthRequired>}>
          <Route index      element={<Navigate to="home" replace />} />
          <Route path="home"         element={<HomePage />} />
          <Route path="clientes"     element={<ClientesPage />} />
          <Route path="clientes/:id"        element={<BriefingPage />} />
          <Route path="clientes/:id/editar" element={<ClienteEditPage />} />
          <Route path="pedidos"      element={<PedidosPage />} />
          <Route path="pedido"       element={<PedidoPage />} />
          <Route path="precos"       element={<TabelaPrecosPage />} />
          <Route path="sellout"      element={<SellOutPage />} />
          <Route path="campanhas"    element={<CampanhasPage />} />
          <Route path="agenda"       element={<AgendaPage />} />
          <Route path="bi"           element={<BIPage />} />
          <Route path="aftermarket"  element={<AftermarketPage />} />
          <Route path="rotas"        element={<RotasPage />} />
          <Route path="rotas/:id"    element={<RotaMapaPage />} />
          <Route path="despesas"     element={<DespesasPage />} />
        </Route>
        <Route path="*" element={<Navigate to="home" replace />} />
      </Routes>
    </Suspense>
  );
}
