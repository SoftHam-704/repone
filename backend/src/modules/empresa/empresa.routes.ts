import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { getEmpresaHandler, updateEmpresaHandler } from './empresa.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);
router.get('/', getEmpresaHandler);
router.put('/', updateEmpresaHandler);
export default router;
