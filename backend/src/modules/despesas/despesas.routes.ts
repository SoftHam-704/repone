import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listDespesasHandler, createDespesaHandler, deleteDespesaHandler,
  relatorioDespesasHandler,
} from './despesas.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/relatorio', relatorioDespesasHandler);

router.get('/',       listDespesasHandler);
router.post('/',      createDespesaHandler);
router.delete('/:id', deleteDespesaHandler);

export default router;
