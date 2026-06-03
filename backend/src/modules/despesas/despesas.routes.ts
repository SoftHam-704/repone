import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  uploadComprovante,
  listDespesasHandler, createDespesaHandler, deleteDespesaHandler,
  relatorioDespesasHandler, comprovanteHandler,
} from './despesas.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/relatorio',            relatorioDespesasHandler);
router.get('/comprovante/:arquivo', comprovanteHandler);

router.get('/',       listDespesasHandler);
router.post('/',      uploadComprovante.single('comprovante'), createDespesaHandler);
router.delete('/:id', deleteDespesaHandler);

export default router;
