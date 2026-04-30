import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { listTransportadorasHandler, getTransportadoraHandler, createTransportadoraHandler, updateTransportadoraHandler, deleteTransportadoraHandler } from './transportadoras.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);
router.get('/',      listTransportadorasHandler);
router.get('/:id',   getTransportadoraHandler);
router.post('/',     createTransportadoraHandler);
router.put('/:id',   updateTransportadoraHandler);
router.delete('/:id', deleteTransportadoraHandler);
export default router;
