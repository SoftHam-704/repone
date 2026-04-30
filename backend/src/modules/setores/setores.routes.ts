import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { listSetoresHandler, getSetorHandler, createSetorHandler, updateSetorHandler, deleteSetorHandler } from './setores.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);
router.get('/',      listSetoresHandler);
router.get('/:id',   getSetorHandler);
router.post('/',     createSetorHandler);
router.put('/:id',   updateSetorHandler);
router.delete('/:id', deleteSetorHandler);
export default router;
