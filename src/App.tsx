import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import LoginPage from '@/modules/auth/pages/LoginPage'
import OrderReportEngine from '@/modules/pedidos/pages/OrderReportEngine'

import { AuthGuard } from '@/shared/components/AuthGuard'
import { MainLayout } from '@/shared/components/layout/MainLayout'

const BIPage = lazy(() => import('@/modules/bi/pages/BIPage'))
const MobileApp = lazy(() => import('@/mobile/MobileApp'))

// Se o dispositivo NÃO for móvel, redireciona /mobile/* para /dashboard
const MobileGuard = () => {
  const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0
  return isMobile ? <MobileApp /> : <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <div className="min-h-screen bg-base">
      <Routes>
        {/* Rota especial de impressão — standalone, sem layout */}
        <Route path="/print/order/:id" element={<OrderReportEngine />} />
        <Route path="/login" element={<LoginPage />} />

        {/* BI Intelligence — layout próprio dark, fora do MainLayout */}
        <Route path="/bi" element={<AuthGuard><BIPage /></AuthGuard>} />
        
        {/* Layout Protegido — MainLayout gerencia as abas internamente */}
        <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={null} />
          <Route path="/metas" element={null} />
          <Route path="/industrias" element={null} />
          <Route path="/clientes" element={null} />
          <Route path="/clientes/:id" element={null} />
          <Route path="/vendedores" element={null} />
          <Route path="/vendedores/:id" element={null} />
          <Route path="/cadastros/grupos-produtos" element={null} />
          <Route path="/cadastros/grupos-descontos" element={null} />
          <Route path="/produtos" element={null} />
          <Route path="/utilitarios/importacao-precos" element={null} />
          <Route path="/utilitarios/catalogo-produtos" element={null} />
          <Route path="/utilitarios/usuarios" element={null} />
          <Route path="/cadastros/tabelas-precos" element={null} />
          <Route path="/pedidos" element={null} />
          <Route path="/cadastros/regioes" element={null} />
          <Route path="/cadastros/setores" element={null} />
          <Route path="/cadastros/itinerarios" element={null} />
          <Route path="/cadastros/area-atuacao" element={null} />
          <Route path="/cadastros/transportadoras" element={null} />
          <Route path="/agenda" element={null} />
          <Route path="/utilitarios/envio-emails" element={null} />
          <Route path="/financeiro/dashboard" element={null} />
          <Route path="/financeiro/receber" element={null} />
          <Route path="/financeiro/pagar" element={null} />
          <Route path="/financeiro/relatorios/fluxo-caixa" element={null} />
          <Route path="/financeiro/relatorios/dre" element={null} />
          <Route path="/financeiro/plano-contas" element={null} />
          <Route path="/financeiro/centro-custo" element={null} />
          <Route path="/repcrm/radar" element={null} />
          <Route path="/repcrm/carteira" element={null} />
          <Route path="/repcrm/dashboard" element={null} />
          <Route path="/repcrm/atividades" element={null} />
          <Route path="/repcrm/relacionamentos" element={null} />
          <Route path="/repcrm/pipeline" element={null} />
          <Route path="/utilitarios/whatsapp-ia" element={null} />
          <Route path="/nexus-ia" element={null} />
          <Route path="*" element={null} />
        </Route>

        <Route path="/mobile/*" element={<MobileGuard />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}

export default App
