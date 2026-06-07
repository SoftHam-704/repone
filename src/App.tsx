import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import LoginPage from '@/modules/auth/pages/LoginPage'
import OrderReportEngine from '@/modules/pedidos/pages/OrderReportEngine'
import PortalLojista from '@/modules/portal-pub/pages/PortalLojista'

import { AuthGuard } from '@/shared/components/AuthGuard'
import { MainLayout } from '@/shared/components/layout/MainLayout'

const BIPage = lazy(() => import('@/modules/bi/pages/BIPage'))
const MobileApp = lazy(() => import('@/mobile/MobileApp'))

const FORCE_KEY = 'force_mobile_view'

// Permite desligar o modo forçado via ?mobile=0 (ou ?desktop=1) em qualquer rota
try {
  const sp = new URLSearchParams(window.location.search)
  if (sp.get('mobile') === '0' || sp.get('desktop') === '1') localStorage.removeItem(FORCE_KEY)
} catch { /* ignore */ }

// Mobile quando: flag forçada (rota /app) OU largura de celular
const isMobileDevice = () => {
  try { if (localStorage.getItem(FORCE_KEY) === '1') return true } catch { /* ignore */ }
  return window.innerWidth < 1024
}

// Rota raiz: mobile vai para /mobile, desktop vai para /dashboard
const RootRedirect = () => <Navigate to={isMobileDevice() ? '/mobile' : '/dashboard'} replace />

// /mobile/*: bloqueia acesso desktop (a não ser que o modo mobile esteja forçado)
const MobileGuard = () => isMobileDevice() ? <MobileApp /> : <Navigate to="/dashboard" replace />

// /app: força o modo mobile em qualquer tela (treinamento/projeção) e entra no app.
// Persiste em localStorage; para voltar ao web abra com ?mobile=0
const ForceMobile = () => {
  try { localStorage.setItem(FORCE_KEY, '1') } catch { /* ignore */ }
  return <Navigate to="/mobile" replace />
}

function App() {
  return (
    <div className="min-h-screen bg-base">
      <Routes>
        {/* Rota especial de impressão — standalone, sem layout */}
        <Route path="/print/order/:id" element={<OrderReportEngine />} />
        {/* Portal público do lojista — sem autenticação */}
        <Route path="/portal" element={<PortalLojista />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Raiz: mobile → /mobile, desktop → /dashboard */}
        <Route path="/" element={<RootRedirect />} />

        {/* BI Intelligence — layout próprio dark, fora do MainLayout */}
        <Route path="/bi" element={<AuthGuard><BIPage /></AuthGuard>} />

        {/* Layout Protegido — MainLayout gerencia as abas internamente */}
        <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
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
          <Route path="/utilitarios/tutoriais" element={null} />
          <Route path="/utilitarios/manual" element={null} />
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
          <Route path="/financeiro/livro-caixa" element={null} />
          <Route path="/financeiro/relatorios/fluxo-caixa" element={null} />
          <Route path="/financeiro/relatorios/dre" element={null} />
          <Route path="/financeiro/plano-contas" element={null} />
          <Route path="/financeiro/centro-custo" element={null} />
          <Route path="/financeiro/fin-clientes" element={null} />
          <Route path="/financeiro/fin-fornecedores" element={null} />
          <Route path="/repcrm/radar" element={null} />
          <Route path="/repcrm/carteira" element={null} />
          <Route path="/repcrm/dashboard" element={null} />
          <Route path="/repcrm/atividades" element={null} />
          <Route path="/repcrm/relacionamentos" element={null} />
          <Route path="/repcrm/pipeline" element={null} />
          <Route path="/repcrm/aftermarket" element={null} />
          <Route path="/utilitarios/whatsapp-ia" element={null} />
          <Route path="/utilitarios/iris-config" element={null} />
          <Route path="/utilitarios/pergunte-iris" element={null} />
          <Route path="/nexus-ia" element={null} />
          <Route path="*" element={null} />
        </Route>

        {/* Força modo mobile em qualquer tela (treinamento) → /app */}
        <Route path="/app" element={<ForceMobile />} />

        <Route path="/mobile/*" element={<MobileGuard />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}

export default App
