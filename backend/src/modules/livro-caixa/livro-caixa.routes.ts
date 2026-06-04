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
// Base: gerência+ (operador não acessa). A baixa de CP/CR — nível gerência — precisa LISTAR
// caixas e ler o teto, então esses dois GETs ficam em gerência.
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA));
// O Livro Caixa em si (dashboard, lançamentos, transferências, gestão de contas) é do MASTER —
// faz parte do Dashboard Hub.
const MASTER = requireLevel(LEVEL.MASTER);

router.get   ('/contas',             listContasCaixaHandler);   // gerência — baixa CP/CR escolhe o caixa
router.post  ('/contas',     MASTER, createContaCaixaHandler);
router.put   ('/contas/:id', MASTER, updateContaCaixaHandler);
router.delete('/contas/:id', MASTER, deleteContaCaixaHandler);

router.get   ('/resumo',     MASTER, resumoCaixaHandler);
router.get   ('/config',             configCaixaHandler);       // gerência — baixa lê o teto de imposto

router.get   ('/lancamentos',     MASTER, listLancamentosHandler);
router.post  ('/lancamentos',     MASTER, createLancamentoHandler);
router.put   ('/lancamentos/:id', MASTER, updateLancamentoHandler);
router.delete('/lancamentos/:id', MASTER, deleteLancamentoHandler);

router.post  ('/transferencia',   MASTER, transferenciaHandler);

export default router;
