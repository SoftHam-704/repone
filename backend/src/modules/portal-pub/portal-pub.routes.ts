import { Router } from 'express';
import {
  validatePortalTokenHandler,
  portalOrdersHandler,
  portalPolicyHandler,
  portalCotacaoCreateHandler,
  portalCotacaoStatusHandler,
  portalCotacaoAddItemsHandler,
  portalCotacaoConfirmHandler,
  portalInsightsHandler,
  portalProdutosHandler,
} from './portal-pub.controller';

const router = Router();

// Rotas públicas — sem authMiddleware / tenantMiddleware
router.get('/validate',                          validatePortalTokenHandler);
router.get('/orders',                            portalOrdersHandler);
router.get('/policy',                            portalPolicyHandler);
router.post('/cotacao',                          portalCotacaoCreateHandler);
router.get('/cotacao/:pedNumero',                portalCotacaoStatusHandler);
router.post('/cotacao/:pedNumero/itens',         portalCotacaoAddItemsHandler);
router.post('/cotacao/:pedNumero/confirmar',     portalCotacaoConfirmHandler);
router.get('/insights',                          portalInsightsHandler);
router.get('/produtos',                          portalProdutosHandler);

export default router;
