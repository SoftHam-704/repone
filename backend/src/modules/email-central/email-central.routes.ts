import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  syncHandler,
  resumoHandler,
  listLeadsHandler,
  getLeadHandler,
  atualizarEstadoHandler,
  responderHandler,
  getConfigHandler,
  updateConfigHandler,
  testImapConnectionHandler,
  inboxRawHandler,
  toggleFlagHandler,
  deleteRawEmailHandler,
  downloadAttachmentHandler,
} from './email-central.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.post  ('/sync',                   syncHandler);
router.get   ('/resumo',                 resumoHandler);
router.get   ('/leads',                  listLeadsHandler);
router.get   ('/leads/:id',              getLeadHandler);
router.patch ('/leads/:id/estado',       atualizarEstadoHandler);
router.post  ('/leads/:id/responder',    responderHandler);
router.get   ('/config',                 getConfigHandler);
router.patch ('/config',                 updateConfigHandler);
router.get   ('/inbox-raw',                           inboxRawHandler);
router.get   ('/inbox-raw/:uid/attachment/:index',    downloadAttachmentHandler);
router.patch ('/inbox-raw/:uid/flags',                toggleFlagHandler);
router.delete('/inbox-raw/:uid',                      deleteRawEmailHandler);
router.post  ('/test-connection',       testImapConnectionHandler);

export default router;
