import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  listContasCaixaHandler, createContaCaixaHandler, updateContaCaixaHandler, deleteContaCaixaHandler,
  resumoCaixaHandler, configCaixaHandler,
  listLancamentosHandler, createLancamentoHandler, updateLancamentoHandler, deleteLancamentoHandler,
  transferenciaHandler,
} from './livro-caixa.controller';

const router = Router();
// Livro Caixa: gerência+ (igual ao Financeiro). Master vê tudo.
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA));

router.get   ('/contas',         listContasCaixaHandler);
router.post  ('/contas',         createContaCaixaHandler);
router.put   ('/contas/:id',     updateContaCaixaHandler);
router.delete('/contas/:id',     deleteContaCaixaHandler);

router.get   ('/resumo',         resumoCaixaHandler);
router.get   ('/config',         configCaixaHandler);

router.get   ('/lancamentos',     listLancamentosHandler);
router.post  ('/lancamentos',     createLancamentoHandler);
router.put   ('/lancamentos/:id', updateLancamentoHandler);
router.delete('/lancamentos/:id', deleteLancamentoHandler);

router.post  ('/transferencia',   transferenciaHandler);

export default router;
