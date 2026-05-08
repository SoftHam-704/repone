import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  webhookEvolutionHandler,
  listConversasHandler, getConversaHandler,
  takeoverHandler, devolverIAHandler, encerrarConversaHandler,
  wppDashboardHandler, listContatosHandler,
  wppResumoPortalHandler,
} from './whatsapp.controller';
import { getIrisCartaHandler, saveIrisCartaHandler } from './iris-config.controller';

const router = Router();

// ─── Webhook público (sem auth — Evolution API chama diretamente) ─────────────
// Registrado em app.ts como: app.use('/webhook', whatsappRoutes)
router.post('/evolution', webhookEvolutionHandler);

// ─── Rotas autenticadas de gestão (via /api/whatsapp) ────────────────────────
const authRouter = Router();
authRouter.use(authMiddleware, tenantMiddleware);

authRouter.get ('/dashboard',                  wppDashboardHandler);
authRouter.get ('/resumo-portal',              wppResumoPortalHandler);
authRouter.get ('/conversas',                  listConversasHandler);
authRouter.get ('/conversas/:id',              getConversaHandler);
authRouter.post('/conversas/:id/takeover',     takeoverHandler);
authRouter.post('/conversas/:id/devolver-ia',  devolverIAHandler);
authRouter.post('/conversas/:id/encerrar',     encerrarConversaHandler);
authRouter.get ('/contatos',                   listContatosHandler);
authRouter.get ('/iris-carta',                 getIrisCartaHandler);
authRouter.put ('/iris-carta',                 saveIrisCartaHandler);

export { router as webhookRouter, authRouter as whatsappAuthRouter };
