import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listAgendaHandler,
  resumoAgendaHandler,
  getAgendaByIdHandler,
  createAgendaHandler,
  updateAgendaHandler,
  updateStatusHandler,
  adiarAgendaHandler,
  deleteAgendaHandler,
  notificationsPendingHandler,
  markNotificationSentHandler,
  statsProdutividadeHandler,
  irisBriefingHandler,
} from './agenda.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/resumo',                        resumoAgendaHandler);
router.get('/iris-briefing',                 irisBriefingHandler);
router.get('/notifications/pending',         notificationsPendingHandler);
router.patch('/notifications/:id/sent',      markNotificationSentHandler);
router.get('/stats/produtividade',           statsProdutividadeHandler);

router.get('/',                              listAgendaHandler);
router.post('/',                             createAgendaHandler);
router.get('/:id',                           getAgendaByIdHandler);
router.put('/:id',                           updateAgendaHandler);
router.patch('/:id/status',                  updateStatusHandler);
router.patch('/:id/adiar',                   adiarAgendaHandler);
router.delete('/:id',                        deleteAgendaHandler);

export default router;
