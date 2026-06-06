import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  overviewHandler,
  monthlyHandler,
  comparativoAnualHandler,
  marketShareHandler,
  rankingIndustriasHandler,
  abcClientesHandler,
  sellersPerformanceHandler,
  equipeCockpitHandler,
  equipeCoberturaHandler,
  visitasSemRetornoHandler,
  abandonoCampoHandler,
  heatmapVisitasPedidosHandler,
  // Fase 2 — Indústrias
  metasIndustriasHandler,
  positivacaoHandler,
  ticketMedioIndustriasHandler,
  churnAlertHandler,
  mixCategoriasHandler,
  metasMensalHandler,
  atividadeClientesHandler,
  // Fase 3 — Clientes
  clientesRankingHandler,
  clientesQuedaMomHandler,
  gruposLojasHandler,
  cicloComprasHandler,
  mediaRecompraHandler,
  rankingProdutosHandler,
  vendasCategoriasHandler,
  vendasEstadosHandler,
  // Fase 4 — Estatísticas
  statsResumoHandler,
  statsCurvaAbcHandler,
  statsUltimaCompraHandler,
  statsFatIndustriaMensalHandler,
  stats3AnosIndustriaHandler,
  statsCrossSellHandler,
  statsClientesYoyHandler,
  statsClassificacaoProdutosHandler,
  statsStatusClientesHandler,
  // Fase 5 — Curva ABC
  abcOverviewHandler,
  abcTicketMedioHandler,
  abcRankingHandler,
  alertasHandler,
  alertasDetalheHandler,
  drilldownHandler,
  skusPorGrupoHandler,
  // Fase 6 — Produtos
  produtosOverviewHandler,
  produtosPorGrupoHandler,
  topSkusHandler,
  // Sell In/Out
  sellInOutKpisHandler,
  sellInOutRankingHandler,
  sellInOutCruzamentoHandler,
  // Narrative IA
  narrativeHandler,
  // Filtros — vendedores disponíveis (respeita permissão)
  sellersAvailableHandler,
} from './bi.controller';

const router = Router();
// BI: gerência+ (operador usa Estatísticos limitado, não o BI consolidado).
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA));

// Visão Geral
router.get('/overview',            overviewHandler);
router.get('/monthly',             monthlyHandler);
router.get('/comparativo-anual',   comparativoAnualHandler);
router.get('/market-share',        marketShareHandler);
router.get('/ranking-industrias',  rankingIndustriasHandler);
router.get('/abc-clientes',        abcClientesHandler);
router.get('/sellers-performance', sellersPerformanceHandler);
router.get('/equipe-cockpit',      equipeCockpitHandler);
router.get('/equipe-cobertura',    equipeCoberturaHandler);
router.get('/visitas-sem-retorno', visitasSemRetornoHandler);
router.get('/abandono-campo',      abandonoCampoHandler);
router.get('/heatmap-visitas-pedidos', heatmapVisitasPedidosHandler);

// Fase 2 — Indústrias
router.get('/metas-industrias',        metasIndustriasHandler);
router.get('/metas-mensal',            metasMensalHandler);
router.get('/positivacao',             positivacaoHandler);
router.get('/ticket-medio-industrias', ticketMedioIndustriasHandler);
router.get('/churn-alert',             churnAlertHandler);
router.get('/mix-categorias',          mixCategoriasHandler);
router.get('/ativacao-clientes',       atividadeClientesHandler);

// Fase 3 — Clientes
router.get('/clientes-ranking',        clientesRankingHandler);
router.get('/clientes-queda-mom',      clientesQuedaMomHandler);
router.get('/grupos-lojas',            gruposLojasHandler);
router.get('/ciclo-compras',           cicloComprasHandler);
router.get('/media-recompra',          mediaRecompraHandler);
router.get('/ranking-produtos',       rankingProdutosHandler);
router.get('/vendas-categorias',      vendasCategoriasHandler);
router.get('/vendas-estados',         vendasEstadosHandler);

// Fase 4 — Estatísticas
router.get('/stats-resumo',                 statsResumoHandler);
router.get('/stats-curva-abc',              statsCurvaAbcHandler);
router.get('/stats-ultima-compra',          statsUltimaCompraHandler);
router.get('/stats-fat-industria-mensal',   statsFatIndustriaMensalHandler);
router.get('/stats-3anos-industria',        stats3AnosIndustriaHandler);
router.get('/stats-cross-sell',             statsCrossSellHandler);
router.get('/stats-clientes-yoy',           statsClientesYoyHandler);
router.get('/stats-classificacao-produtos', statsClassificacaoProdutosHandler);
router.get('/stats-status-clientes',        statsStatusClientesHandler);

// Fase 5 — Curva ABC
router.get('/abc-overview',       abcOverviewHandler);
router.get('/abc-ticket-medio',   abcTicketMedioHandler);
router.get('/abc-ranking',        abcRankingHandler);

// Alertas proativos
router.get('/alertas',            alertasHandler);
router.get('/alertas/detalhe',    alertasDetalheHandler);

// Drill-down hierárquico
router.get('/drilldown',          drilldownHandler);

// SKUs por grupo de produto
router.get('/skus-por-grupo',     skusPorGrupoHandler);

// Fase 6 — Produtos
router.get('/produtos-overview',   produtosOverviewHandler);
router.get('/produtos-por-grupo',  produtosPorGrupoHandler);
router.get('/top-skus',            topSkusHandler);

// Sell In/Out
router.get('/sell-in-out/kpis',       sellInOutKpisHandler);
router.get('/sell-in-out/ranking',     sellInOutRankingHandler);
router.get('/sell-in-out/cruzamento',  sellInOutCruzamentoHandler);

// IRIS Narrative (IA)
router.post('/narrative', narrativeHandler);

// Filtros — vendedores disponíveis (lista filtrada por permissão do usuário)
router.get('/sellers-available', sellersAvailableHandler);

export default router;
