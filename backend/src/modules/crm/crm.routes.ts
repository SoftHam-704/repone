import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  // Pipeline
  getPipelineHandler, createOportunidadeHandler, updateOportunidadeHandler,
  moveOportunidadeHandler, deleteOportunidadeHandler,
  // Interações
  listInteracoesHandler, createInteracaoHandler, updateInteracaoHandler, deleteInteracaoHandler,
  // Follow-ups
  listFollowupsHandler, countFollowupsHandler, createFollowupHandler,
  updateFollowupHandler, deleteFollowupHandler,
  // Lookups
  listTiposHandler, listCanaisHandler, listResultadosHandler,
  // Dashboard
  crmDashboardHandler,
  // Carteira Viva
  carteiraRadarHandler, carteiraClientesHandler, carteiraFichaHandler,
  criarVisitaHandler, listarVisitasHandler, deletarVisitaHandler,
  // WhatsApp
  whatsappStatusHandler, whatsappSendHandler, whatsappInstancesHandler,
  whatsappConnectHandler, whatsappConnectAutoHandler,
  // Relatório
  relatorioRelacionamentosHandler,
} from './crm.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// Dashboard
router.get('/dashboard', crmDashboardHandler);

// Pipeline
router.get ('/pipeline',                getPipelineHandler);
router.post('/oportunidades',           createOportunidadeHandler);
router.put ('/oportunidades/:id',       updateOportunidadeHandler);
router.put ('/oportunidades/:id/move',  moveOportunidadeHandler);
router.delete('/oportunidades/:id',     deleteOportunidadeHandler);

// Interações — específicas antes de /:id
router.get   ('/interacoes',          listInteracoesHandler);
router.post  ('/interacoes',          createInteracaoHandler);
router.put   ('/interacoes/:id',      updateInteracaoHandler);
router.delete('/interacoes/:id',      deleteInteracaoHandler);

// Follow-ups — específicas antes de /:id
router.get   ('/followups/count',     countFollowupsHandler);
router.get   ('/followups',           listFollowupsHandler);
router.post  ('/followups',           createFollowupHandler);
router.patch ('/followups/:id',       updateFollowupHandler);
router.delete('/followups/:id',       deleteFollowupHandler);

// Carteira Viva
router.get   ('/carteira/radar',              carteiraRadarHandler);
router.get   ('/carteira/clientes',           carteiraClientesHandler);
router.get   ('/carteira/clientes/:id/ficha', carteiraFichaHandler);
router.get   ('/carteira/visitas',            listarVisitasHandler);
router.post  ('/carteira/visitas',            criarVisitaHandler);
router.delete('/carteira/visitas/:id',        deletarVisitaHandler);

// Lookups
router.get('/tipos',      listTiposHandler);
router.get('/canais',     listCanaisHandler);
router.get('/resultados', listResultadosHandler);

// Relatório
router.get('/relatorio/relacionamentos', relatorioRelacionamentosHandler);

// WhatsApp
router.get ('/whatsapp/status',            whatsappStatusHandler);
router.get ('/whatsapp/instances',         whatsappInstancesHandler);
router.get ('/whatsapp/connect-auto',      whatsappConnectAutoHandler);
router.get ('/whatsapp/connect/:instance', whatsappConnectHandler);
router.post('/whatsapp/send',              whatsappSendHandler);

export default router;
