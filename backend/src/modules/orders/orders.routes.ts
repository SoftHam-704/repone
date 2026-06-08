import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  nextNumberHandler,
  listOrdersHandler,
  getOrderHandler,
  createOrderHandler,
  createMobileOrderHandler,
  updateOrderHandler,
  deleteOrderHandler,
  softDeleteOrderHandler,
  orderStatsHandler,
  cloneOrderHandler,
  consolidationStatsHandler,
  consolidateOrdersHandler,
  descartarFilaHandler,
  printDataHandler,
  statusEnvioHandler,
  enviadoIndustriaHandler,
  converterPedidoHandler,
  smartSuggestionsHandler,
  expandMixHandler,
  irisAnalisaHandler,
  irisPanelNarrativeHandler,
  createOrderFromPortalHandler,
  countWhatsappHandler,
  resolveCompradorHandler,
  clienteCurvaAbcHandler,
  clienteHistoricoMensalHandler,
} from './orders.controller';
import {
  exportStahlHandler,
  exportIguacuHandler,
  exportViemarHandler,
  exportSampelHandler,
  exportPoloHandler,
  exportOspinaHandler,
  exportTsaHandler,
  exportSinalsulHandler,
  exportPhiniaHandler,
  exportBorgHandler,
} from '../portal/portal.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

// Rotas específicas ANTES de /:id para evitar conflito
router.get('/next-number',        nextNumberHandler);
router.get('/count-whatsapp',     countWhatsappHandler);
router.get('/resolve-comprador',  resolveCompradorHandler);
router.get('/cliente-curva-abc',       clienteCurvaAbcHandler);
router.get('/cliente-historico-mensal', clienteHistoricoMensalHandler);
router.get('/stats',              orderStatsHandler);
router.get('/smart-suggestions',  smartSuggestionsHandler);
router.get('/expand-mix',          expandMixHandler);
router.post('/iris-analisa',          irisAnalisaHandler);
router.post('/iris-panel-narrative',  irisPanelNarrativeHandler);
router.get('/consolidation-stats', consolidationStatsHandler);
router.post('/consolidate',      consolidateOrdersHandler);
router.post('/descartar-fila',   descartarFilaHandler);
router.post('/from-portal',      createOrderFromPortalHandler);

router.post('/mobile',    createMobileOrderHandler);
router.get('/',       listOrdersHandler);
router.get('/:id/print-data', printDataHandler);
router.post('/:id/export/stahl',  exportStahlHandler);
router.post('/:id/export/iguacu', exportIguacuHandler);
router.post('/:id/export/viemar', exportViemarHandler);
router.get('/:id/export/sampel',  exportSampelHandler);
router.post('/:id/export/polo',   exportPoloHandler);
router.post('/:id/export/ospina', exportOspinaHandler);
router.post('/:id/export/tsa',      exportTsaHandler);
router.post('/:id/export/sinalsul', exportSinalsulHandler);
router.post('/:id/export/phinia',   exportPhiniaHandler);
router.post('/:id/export/borg',     exportBorgHandler);
router.get('/:id',         getOrderHandler);
router.post('/',           createOrderHandler);
router.post('/:id/clone',  cloneOrderHandler);
router.put('/:id',              updateOrderHandler);
router.patch('/:id/situacao',        softDeleteOrderHandler);
router.patch('/:id/status-envio',    statusEnvioHandler);
router.patch('/:id/enviado',         enviadoIndustriaHandler);
router.patch('/:id/converter-pedido', converterPedidoHandler);
router.delete('/:id',           deleteOrderHandler);

export default router;
