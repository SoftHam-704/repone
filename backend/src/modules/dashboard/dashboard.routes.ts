import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  metricsHandler,
  projecaoHandler,
  auraInsightsHandler,
  industryRevenueHandler,
  industriesListHandler,
  salesComparisonHandler,
  quantitiesComparisonHandler,
  topClientsHandler,
  metasIndustriasHandler,
  salesPerformanceHandler,
  insightDetailHandler,
  mobileSummaryHandler,
  mobileClientHandler,
  irisPortfolioAnalysisHandler,
  irisEventosHandler,
} from './dashboard.controller';

const router = Router();

// Todos os endpoints de dashboard requerem autenticação + tenant
router.use(authMiddleware, tenantMiddleware);

router.get('/metrics',                metricsHandler);
router.get('/projecao',               projecaoHandler);
router.get('/aura-insights',          auraInsightsHandler);
router.get('/industry-revenue',       industryRevenueHandler);
router.get('/industries-list',        industriesListHandler);
router.get('/sales-comparison',       salesComparisonHandler);
router.get('/quantities-comparison',  quantitiesComparisonHandler);
router.get('/top-clients',            topClientsHandler);
router.get('/metas-industrias',       metasIndustriasHandler);
router.get('/sales-performance',      salesPerformanceHandler);
router.get('/insight-detail',         insightDetailHandler);
router.get('/mobile-summary',         mobileSummaryHandler);
router.get('/mobile-client/:id',             mobileClientHandler);
router.get('/iris-portfolio-analysis',       irisPortfolioAnalysisHandler);
router.get('/iris-eventos',                  irisEventosHandler);

export default router;
