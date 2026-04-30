import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { getIrisBriefingHandler } from './ia.controller';

const router = Router();

// Todas as rotas de IA exigem autenticação e tenant
router.use(authMiddleware, tenantMiddleware);

// GET /ia/briefing - Retorna o resumo matinal gerado pela Iris
router.get('/briefing', getIrisBriefingHandler);

export default router;
