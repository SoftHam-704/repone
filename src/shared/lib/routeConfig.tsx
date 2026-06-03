import { lazy } from 'react';
import {
  LayoutDashboard, BarChart2, CalendarDays, Target,
  Building2, Users, Briefcase, Package, Tags, DollarSign,
  Map, MapPin, Route, Truck, FileText,
  ShoppingCart, ShoppingBag, Zap, TrendingUp,
  Wallet, PieChart, Settings, Wrench,
  MessageCircle, ClipboardCheck, ListChecks, Kanban, Activity,
  BookOpen, Gamepad2, LogOut, ChevronRight, MessageSquare, Sparkles, Mail,
  Radar, Users2,
} from 'lucide-react';

const CentralEstatisticosPage = lazy(() => import('@/modules/estatisticas/pages/CentralEstatisticosPage'))
const DashboardHome      = lazy(() => import('@/modules/dashboard/pages/HomeRouter'))
const MetasPage       = lazy(() => import('@/modules/metas/pages/MetasPage'))
const IndustriasPage  = lazy(() => import('@/modules/industrias/pages/IndustriasPage'))
const ClientesPage    = lazy(() => import('@/modules/clientes/pages/ClientesPage'))
const FichaCliente    = lazy(() => import('@/modules/clientes/pages/FichaClientePage'))
const VendedoresPage   = lazy(() => import('@/modules/vendedores/pages/VendedoresPage'))
const FichaVendedor    = lazy(() => import('@/modules/vendedores/pages/FichaVendedorPage'))
const GruposPage      = lazy(() => import('@/modules/grupos/pages/GruposPage'))
const GrupoDescPage   = lazy(() => import('@/modules/grupo-desc/pages/GrupoDescPage'))
const ProdutosPage         = lazy(() => import('@/modules/produtos/pages/ProdutosPage'))
const ImportacaoPrecosPage = lazy(() => import('@/modules/produtos/pages/ImportacaoPrecosPage'))
const TabelasPrecosPage    = lazy(() => import('@/modules/produtos/pages/TabelasPrecosPage'))
const CatalogoDigitalPage  = lazy(() => import('@/modules/produtos/pages/CatalogoDigitalPage'))
const UsuariosPage         = lazy(() => import('@/modules/usuarios/pages/UsuariosPage'))
const PedidosPage          = lazy(() => import('@/modules/pedidos/pages/PedidosPage'))
const SmartImporterPage    = lazy(() => import('@/modules/importador/pages/SmartImporterPage'))
const NfePage              = lazy(() => import('@/modules/nfe/pages/NfePage'))
const CampanhasPage        = lazy(() => import('@/modules/campanhas/pages/CampanhasPage'))
const RegioesPage          = lazy(() => import('@/modules/regioes/pages/RegioesPage'))
const SetoresPage          = lazy(() => import('@/modules/setores/pages/SetoresPage'))
const ItinerariosPage      = lazy(() => import('@/modules/itinerarios/pages/ItinerariosPage'))
const AreaAtuacaoPage      = lazy(() => import('@/modules/area-atuacao/pages/AreaAtuacaoPage'))
const TransportadorasPage  = lazy(() => import('@/modules/transportadoras/pages/TransportadorasPage'))
const ConfiguracoesPage    = lazy(() => import('@/modules/configuracoes/pages/ConfiguracoesPage'))
const ParametrosPage       = lazy(() => import('@/modules/parametros/pages/ParametrosPage'))
const SellOutPage          = lazy(() => import('@/modules/sellout/pages/SellOutPage'))
const MinhaAgendaPage      = lazy(() => import('@/modules/agenda/pages/MinhaAgendaPage'))
const EnvioEmailsPage          = lazy(() => import('@/modules/email/pages/EnvioEmailsPage'))
const EmailCentralPage         = lazy(() => import('@/modules/email-central/pages/EmailCentralPage'))
const FinanceiroDashboardPage  = lazy(() => import('@/modules/financeiro/pages/FinanceiroDashboardPage'))
const ContasReceberPage        = lazy(() => import('@/modules/financeiro/pages/ContasReceberPage'))
const ContasPagarPage          = lazy(() => import('@/modules/financeiro/pages/ContasPagarPage'))
const FluxoCaixaPage           = lazy(() => import('@/modules/financeiro/pages/FluxoCaixaPage'))
const DREPage                  = lazy(() => import('@/modules/financeiro/pages/DREPage'))
const PlanoContasPage          = lazy(() => import('@/modules/financeiro/pages/PlanoContasPage'))
const CentroCustoPage          = lazy(() => import('@/modules/financeiro/pages/CentroCustoPage'))
const FinClientesPage          = lazy(() => import('@/modules/financeiro/pages/FinClientesPage'))
const FinFornecedoresPage      = lazy(() => import('@/modules/financeiro/pages/FinFornecedoresPage'))
const CarteiraRadarPage        = lazy(() => import('@/modules/crm/pages/CarteiraRadarPage'))
const CarteiraClientesPage     = lazy(() => import('@/modules/crm/pages/CarteiraClientesPage'))
const RepCrmDashboardPage      = lazy(() => import('@/modules/crm/pages/RepCrmDashboardPage'))
const AtividadesPage           = lazy(() => import('@/modules/crm/pages/AtividadesPage'))
const RegistroRelacionamentosPage = lazy(() => import('@/modules/crm/pages/RegistroRelacionamentosPage'))
const PipelinePage             = lazy(() => import('@/modules/crm/pages/PipelinePage'))
const WhatsAppIAPage           = lazy(() => import('@/modules/crm/pages/WhatsAppIAPage'))
const VisitasPage              = lazy(() => import('@/modules/crm/pages/VisitasPage'))
const CampoAoVivoPage          = lazy(() => import('@/modules/crm/pages/CampoAoVivoPage'))
const AftermarketPage          = lazy(() => import('@/modules/crm/pages/AftermarketPage'))
const IrisVoicePage            = lazy(() => import('@/modules/nexus-ia/pages/IrisVoicePage'))
const IrisConfigPage           = lazy(() => import('@/modules/iris/pages/IrisConfigPage'))
const PergunteIrisPage         = lazy(() => import('@/modules/iris/pages/PergunteIrisPage'))
const RelatoriosPage           = lazy(() => import('@/modules/relatorios/pages/RelatoriosPage'))
const CentroAprendizadoPage    = lazy(() => import('@/modules/utilitarios/pages/CentroAprendizadoPage'))

export interface RouteItem {
  id: string;
  label: string;
  path: string;
  icon: any;
  element: React.ReactNode;
}

export const ROUTE_CONFIG: Record<string, RouteItem> = {
  '/dashboard': { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, element: <DashboardHome /> },
  '/bi': { id: 'bi', label: 'BI Intelligence', path: '/bi', icon: PieChart, element: null },
  '/estatisticas': { id: 'estatisticas', label: 'Central Estatísticos', path: '/estatisticas', icon: BarChart2, element: <CentralEstatisticosPage /> },
  '/relatorios': { id: 'relatorios', label: 'Relatórios', path: '/relatorios', icon: FileText, element: <RelatoriosPage /> },
  '/metas': { id: 'metas', label: 'Metas', path: '/metas', icon: Target, element: <MetasPage /> },
  '/industrias': { id: 'industrias', label: 'Indústrias', path: '/industrias', icon: Building2, element: <IndustriasPage /> },
  '/clientes': { id: 'clientes', label: 'Clientes', path: '/clientes', icon: Users, element: <ClientesPage /> },
  '/clientes/novo': { id: 'ficha-cliente-novo', label: 'Novo Cliente', path: '/clientes/novo', icon: Users, element: <FichaCliente /> },
  '/vendedores': { id: 'vendedores', label: 'Vendedores', path: '/vendedores', icon: Briefcase, element: <VendedoresPage /> },
  '/vendedores/novo': { id: 'ficha-vendedor-novo', label: 'Novo Vendedor', path: '/vendedores/novo', icon: Briefcase, element: <FichaVendedor /> },
  '/cadastros/grupos-produtos': { id: 'grupos-produtos', label: 'Grupos de Produtos', path: '/cadastros/grupos-produtos', icon: Tags, element: <GruposPage /> },
  '/cadastros/grupos-descontos': { id: 'grupos-descontos', label: 'Grupos Descontos', path: '/cadastros/grupos-descontos', icon: DollarSign, element: <GrupoDescPage /> },
  '/cadastros/regioes': { id: 'regioes', label: 'Regiões', path: '/cadastros/regioes', icon: Map, element: <RegioesPage /> },
  '/cadastros/setores': { id: 'setores', label: 'Setores / Bairros', path: '/cadastros/setores', icon: MapPin, element: <SetoresPage /> },
  '/cadastros/itinerarios': { id: 'itinerarios', label: 'Itinerários de Visita', path: '/cadastros/itinerarios', icon: Route, element: <ItinerariosPage /> },
  '/cadastros/area-atuacao': { id: 'area-atuacao', label: 'Área de Atuação', path: '/cadastros/area-atuacao', icon: Map, element: <AreaAtuacaoPage /> },
  '/cadastros/transportadoras': { id: 'transportadoras', label: 'Transportadoras', path: '/cadastros/transportadoras', icon: Truck, element: <TransportadorasPage /> },
  '/pedidos': { id: 'pedidos', label: 'Pedidos de Venda', path: '/pedidos', icon: ShoppingCart, element: <PedidosPage /> },
  '/movimentacoes/importador': { id: 'importador', label: 'Carrinho em Lote', path: '/movimentacoes/importador', icon: ShoppingBag, element: <SmartImporterPage /> },
  '/movimentacoes/baixa-xml': { id: 'baixa-xml', label: 'Baixa via XML', path: '/movimentacoes/baixa-xml', icon: FileText, element: <NfePage /> },
  '/vendas/campanhas': { id: 'campanhas', label: 'Campanhas', path: '/vendas/campanhas', icon: Zap, element: <CampanhasPage /> },
  '/movimentacoes/sell-out': { id: 'sell-out', label: 'Sell-Out', path: '/movimentacoes/sell-out', icon: TrendingUp, element: <SellOutPage /> },
  '/produtos': { id: 'tabelas-precos', label: 'Tabela de Preços', path: '/produtos', icon: Package, element: <ProdutosPage /> },
  '/utilitarios/importacao-precos': { id: 'importacao-precos', label: 'Importação de Preços', path: '/utilitarios/importacao-precos', icon: Package, element: <ImportacaoPrecosPage /> },
  '/cadastros/tabelas-precos': { id: 'config-tabelas-precos', label: 'Config. Tabelas Preços', path: '/cadastros/tabelas-precos', icon: Settings, element: <TabelasPrecosPage /> },
  '/utilitarios/catalogo-produtos': { id: 'catalogo-digital', label: 'Catálogo Digital', path: '/utilitarios/catalogo-produtos', icon: Package, element: <CatalogoDigitalPage /> },
  '/utilitarios/usuarios': { id: 'usuarios', label: 'Usuários', path: '/utilitarios/usuarios', icon: Users, element: <UsuariosPage /> },
  '/utilitarios/parametros': { id: 'parametros', label: 'Parâmetros', path: '/utilitarios/parametros', icon: Settings, element: <ParametrosPage /> },
  '/utilitarios/configuracoes': { id: 'configuracoes', label: 'Configurações', path: '/utilitarios/configuracoes', icon: Settings, element: <ConfiguracoesPage /> },
  '/agenda': { id: 'agenda', label: 'Minha Agenda', path: '/agenda', icon: CalendarDays, element: <MinhaAgendaPage /> },
  '/utilitarios/envio-emails':   { id: 'envio-emails',    label: 'Envio de Emails',    path: '/utilitarios/envio-emails',   icon: MessageSquare, element: <EnvioEmailsPage /> },
  '/utilitarios/email-central': { id: 'email-central',   label: 'Central de Emails',  path: '/utilitarios/email-central',  icon: Mail,          element: <EmailCentralPage /> },
  '/financeiro/dashboard':              { id: 'fin-dashboard', label: 'Dashboard Financeiro',  path: '/financeiro/dashboard',              icon: Wallet,       element: <FinanceiroDashboardPage /> },
  '/financeiro/receber':               { id: 'fin-receber',   label: 'Contas a Receber',       path: '/financeiro/receber',                icon: DollarSign,   element: <ContasReceberPage /> },
  '/financeiro/pagar':                 { id: 'fin-pagar',     label: 'Contas a Pagar',         path: '/financeiro/pagar',                  icon: DollarSign,   element: <ContasPagarPage /> },
  '/financeiro/relatorios/fluxo-caixa':{ id: 'fin-fluxo',     label: 'Fluxo de Caixa',         path: '/financeiro/relatorios/fluxo-caixa', icon: TrendingUp,   element: <FluxoCaixaPage /> },
  '/financeiro/relatorios/dre':        { id: 'fin-dre',       label: 'DRE Gerencial',           path: '/financeiro/relatorios/dre',         icon: PieChart,     element: <DREPage /> },
  '/financeiro/plano-contas':          { id: 'fin-plano',     label: 'Plano de Contas',         path: '/financeiro/plano-contas',           icon: Settings,     element: <PlanoContasPage /> },
  '/financeiro/centro-custo':          { id: 'fin-centro',    label: 'Centro de Custo',          path: '/financeiro/centro-custo',           icon: Building2,    element: <CentroCustoPage /> },
  '/financeiro/fin-clientes':          { id: 'fin-clientes',  label: 'Clientes Financeiros',     path: '/financeiro/fin-clientes',           icon: Users,        element: <FinClientesPage /> },
  '/financeiro/fin-fornecedores':      { id: 'fin-fornecedores', label: 'Fornecedores Financeiros', path: '/financeiro/fin-fornecedores',     icon: Building2,    element: <FinFornecedoresPage /> },
  '/repcrm/radar':                     { id: 'crm-radar',         label: 'Radar do Rep',         path: '/repcrm/radar',                      icon: Radar,           element: <CarteiraRadarPage /> },
  '/repcrm/carteira':                  { id: 'crm-carteira',      label: 'Carteira de Clientes', path: '/repcrm/carteira',                   icon: Users2,          element: <CarteiraClientesPage /> },
  '/repcrm/dashboard':                 { id: 'crm-dashboard',    label: 'Dashboard CRM',        path: '/repcrm/dashboard',                  icon: LayoutDashboard, element: <RepCrmDashboardPage /> },
  '/repcrm/atividades':                { id: 'crm-atividades',    label: 'Atividades',           path: '/repcrm/atividades',                 icon: Activity,        element: <AtividadesPage /> },
  '/repcrm/relacionamentos':          { id: 'crm-relacionamentos', label: 'Relacionamentos',      path: '/repcrm/relacionamentos',            icon: ClipboardCheck,  element: <RegistroRelacionamentosPage /> },
  '/repcrm/pipeline':                  { id: 'crm-pipeline',      label: 'Pipeline Kanban',      path: '/repcrm/pipeline',                   icon: Kanban,          element: <PipelinePage /> },
  '/repcrm/visitas':                   { id: 'crm-visitas',        label: 'Visitas',              path: '/repcrm/visitas',                    icon: CalendarDays,    element: <VisitasPage /> },
  '/repcrm/campo':                     { id: 'crm-campo',          label: 'Campo Ao Vivo',        path: '/repcrm/campo',                      icon: MapPin,          element: <CampoAoVivoPage /> },
  '/repcrm/aftermarket':               { id: 'crm-aftermarket',    label: 'Aftermarket',          path: '/repcrm/aftermarket',                icon: Wrench,          element: <AftermarketPage /> },
  '/utilitarios/whatsapp-ia':          { id: 'whatsapp-ia',       label: 'WhatsApp IA',          path: '/utilitarios/whatsapp-ia',           icon: MessageCircle,   element: <WhatsAppIAPage /> },
  '/nexus-ia':                         { id: 'nexus-ia',          label: 'Iris — Sua Assistente', path: '/nexus-ia',             icon: Sparkles,        element: <IrisVoicePage /> },
  '/utilitarios/iris-config':          { id: 'iris-config',       label: 'IRIS — Configuração',   path: '/utilitarios/iris-config', icon: Sparkles,      element: <IrisConfigPage /> },
  '/utilitarios/pergunte-iris':        { id: 'pergunte-iris',     label: 'IRIS Dev',              path: '/utilitarios/pergunte-iris', icon: Sparkles,    element: <PergunteIrisPage /> },
  '/utilitarios/tutoriais':            { id: 'centro-aprendizado', label: 'Centro de Aprendizado', path: '/utilitarios/tutoriais',   icon: BookOpen,      element: <CentroAprendizadoPage /> },
};

// Dynamic routes — factory + cache for unique elements per path
interface DynamicRouteDef {
  prefix: string;
  label: string;
  icon: any;
  createElement: (id: string) => React.ReactNode;
}

const DYNAMIC_ROUTES: DynamicRouteDef[] = [
  {
    prefix: '/clientes/',
    label: 'Ficha Cliente',
    icon: Users,
    createElement: (id) => <FichaCliente overrideId={id} />,
  },
  {
    prefix: '/vendedores/',
    label: 'Ficha Vendedor',
    icon: Briefcase,
    createElement: (id) => <FichaVendedor overrideId={id} />,
  },
];

// Cache so the same path always returns the same React element (stable reference)
const dynamicRouteCache: Record<string, RouteItem> = {};

// Function to find a route item by path (handling exact matches or dynamic paths)
export function findRouteByPath(path: string): RouteItem | undefined {
  // 1. Exact match
  if (ROUTE_CONFIG[path]) return ROUTE_CONFIG[path];

  // 2. Cached dynamic route
  if (dynamicRouteCache[path]) return dynamicRouteCache[path];

  // 3. Create new dynamic route
  for (const route of DYNAMIC_ROUTES) {
    if (path.startsWith(route.prefix)) {
      const id = path.slice(route.prefix.length);
      if (!id) continue; // Skip empty IDs (would match the base path)

      const item: RouteItem = {
        id: path,
        label: route.label,
        path: path,
        icon: route.icon,
        element: route.createElement(id),
      };
      dynamicRouteCache[path] = item;
      return item;
    }
  }

  return undefined;
}
