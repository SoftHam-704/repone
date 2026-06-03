import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  // Plano de Contas
  listPlanoContasHandler, createPlanoContasHandler, updatePlanoContasHandler, deletePlanoContasHandler,
  // Centro de Custo
  listCentroCustoHandler, createCentroCustoHandler, updateCentroCustoHandler, deleteCentroCustoHandler,
  // Clientes Financeiros
  listFinClientsHandler, getFinClientHandler, createFinClientHandler, updateFinClientHandler, deleteFinClientHandler,
  // Fornecedores Financeiros
  listFinSuppliersHandler, getFinSupplierHandler, createFinSupplierHandler, updateFinSupplierHandler, deleteFinSupplierHandler,
  // Contas a Pagar
  listContasPagarHandler, getContaPagarHandler, createContaPagarHandler, updateContaPagarHandler,
  baixaContaPagarHandler, deleteContaPagarHandler,
  // Contas a Receber
  listContasReceberHandler, getContaReceberHandler, createContaReceberHandler, updateContaReceberHandler,
  baixaContaReceberHandler, deleteContaReceberHandler,
  // Relatórios
  fluxoCaixaHandler, dreHandler,
  // Dashboard
  financeiroDashboardHandler,
} from './financeiro.controller';

const router = Router();
// Financeiro inteiro: gerência+ (operador não acessa). Master vê tudo.
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA));

// Dashboard
router.get('/dashboard/summary', financeiroDashboardHandler);

// Relatórios
router.get('/relatorios/fluxo-caixa', fluxoCaixaHandler);
router.get('/relatorios/dre',          dreHandler);

// Plano de Contas
router.get   ('/plano-contas',     listPlanoContasHandler);
router.post  ('/plano-contas',     createPlanoContasHandler);
router.put   ('/plano-contas/:id', updatePlanoContasHandler);
router.delete('/plano-contas/:id', deletePlanoContasHandler);

// Centro de Custo
router.get   ('/centro-custo',     listCentroCustoHandler);
router.post  ('/centro-custo',     createCentroCustoHandler);
router.put   ('/centro-custo/:id', updateCentroCustoHandler);
router.delete('/centro-custo/:id', deleteCentroCustoHandler);

// Clientes Financeiros
router.get   ('/fin-clientes',     listFinClientsHandler);
router.post  ('/fin-clientes',     createFinClientHandler);
router.get   ('/fin-clientes/:id', getFinClientHandler);
router.put   ('/fin-clientes/:id', updateFinClientHandler);
router.delete('/fin-clientes/:id', deleteFinClientHandler);

// Fornecedores Financeiros
router.get   ('/fin-fornecedores',     listFinSuppliersHandler);
router.post  ('/fin-fornecedores',     createFinSupplierHandler);
router.get   ('/fin-fornecedores/:id', getFinSupplierHandler);
router.put   ('/fin-fornecedores/:id', updateFinSupplierHandler);
router.delete('/fin-fornecedores/:id', deleteFinSupplierHandler);

// Contas a Pagar — rotas específicas antes de /:id
router.get   ('/contas-pagar',         listContasPagarHandler);
router.post  ('/contas-pagar',         createContaPagarHandler);
router.get   ('/contas-pagar/:id',     getContaPagarHandler);
router.put   ('/contas-pagar/:id',     updateContaPagarHandler);
router.post  ('/contas-pagar/:id/baixa', baixaContaPagarHandler);
router.delete('/contas-pagar/:id',     deleteContaPagarHandler);

// Contas a Receber
router.get   ('/contas-receber',             listContasReceberHandler);
router.post  ('/contas-receber',             createContaReceberHandler);
router.get   ('/contas-receber/:id',         getContaReceberHandler);
router.put   ('/contas-receber/:id',         updateContaReceberHandler);
router.post  ('/contas-receber/:id/baixa',   baixaContaReceberHandler);
router.delete('/contas-receber/:id',         deleteContaReceberHandler);

export default router;
