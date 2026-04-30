import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  nextNumberHandler,
  listOrdersHandler,
  getOrderHandler,
  createOrderHandler,
  updateOrderHandler,
  deleteOrderHandler,
  softDeleteOrderHandler,
  orderStatsHandler,
  cloneOrderHandler,
  consolidationStatsHandler,
  consolidateOrdersHandler,
  printDataHandler,
  statusEnvioHandler,
  smartSuggestionsHandler,
  expandMixHandler,
  irisAnalisaHandler,
  irisPanelNarrativeHandler,
  createOrderFromPortalHandler,
} from './orders.controller';
import {
  exportStahlHandler,
  exportIguacuHandler,
  exportViemarHandler,
  exportSampelHandler,
  exportPoloHandler,
  exportOspinaHandler,
} from '../portal/portal.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

// Rotas específicas ANTES de /:id para evitar conflito
router.get('/next-number',        nextNumberHandler);
router.get('/stats',              orderStatsHandler);
router.get('/smart-suggestions',  smartSuggestionsHandler);
router.get('/expand-mix',          expandMixHandler);
router.post('/iris-analisa',          irisAnalisaHandler);
router.post('/iris-panel-narrative',  irisPanelNarrativeHandler);
router.get('/consolidation-stats', consolidationStatsHandler);
router.post('/consolidate',      consolidateOrdersHandler);
router.post('/from-portal',      createOrderFromPortalHandler);

router.get('/',       listOrdersHandler);
router.get('/:id/print-data', printDataHandler);
router.post('/:id/export/stahl',  exportStahlHandler);
router.post('/:id/export/iguacu', exportIguacuHandler);
router.post('/:id/export/viemar', exportViemarHandler);
router.get('/:id/export/sampel',  exportSampelHandler);
router.post('/:id/export/polo',   exportPoloHandler);
router.post('/:id/export/ospina', exportOspinaHandler);
router.get('/:id',         getOrderHandler);
router.post('/',           createOrderHandler);
router.post('/:id/clone',  cloneOrderHandler);
router.put('/:id',              updateOrderHandler);
router.patch('/:id/situacao',     softDeleteOrderHandler);
router.patch('/:id/status-envio', statusEnvioHandler);
router.delete('/:id',           deleteOrderHandler);

export default router;
