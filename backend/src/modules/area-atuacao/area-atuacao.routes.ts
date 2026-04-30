import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { listAreaAtuacaoHandler, getAreaAtuacaoHandler, createAreaAtuacaoHandler, updateAreaAtuacaoHandler, deleteAreaAtuacaoHandler } from './area-atuacao.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);
router.get('/',      listAreaAtuacaoHandler);
router.get('/:id',   getAreaAtuacaoHandler);
router.post('/',     createAreaAtuacaoHandler);
router.put('/:id',   updateAreaAtuacaoHandler);
router.delete('/:id', deleteAreaAtuacaoHandler);
export default router;
