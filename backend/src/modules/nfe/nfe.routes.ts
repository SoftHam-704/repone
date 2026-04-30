import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { parseNFeHandler, applyNFeHandler } from './nfe.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.post('/parse', parseNFeHandler);
router.post('/apply', applyNFeHandler);

export default router;
