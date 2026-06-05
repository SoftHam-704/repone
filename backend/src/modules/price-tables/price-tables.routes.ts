import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  listAllPriceTablesHandler,
  getPriceTablesByIndustriaHandler,
  getPriceTableItemsHandler,
  deletePriceTableHandler,
  deletePriceTableProductHandler,
  updateIpiHandler,
  updateStHandler,
  clearPrecoHandler,
  setDiscountGroupHandler,
  removeDiscountGroupHandler,
  importPriceTableHandler,
  deleteCatalogHandler,
  renamePriceTableHandler,
  adjustLinearHandler,
  setPriceTableStatusHandler,
  desativarTabelasVencidasHandler,
} from './price-tables.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/',                      listAllPriceTablesHandler);
router.get('/:industria/items',      getPriceTableItemsHandler);
router.get('/:industria',            getPriceTablesByIndustriaHandler);

// Tabela sempre como ?tabela= para evitar problema com "/" no nome
router.delete('/product/:industria/:productId',  deletePriceTableProductHandler);
// Excluir TODO o catálogo da indústria (produtos + tabelas) — só Master
router.delete('/catalog/:industria',             requireLevel(LEVEL.MASTER), deleteCatalogHandler);
router.delete('/:industria',                     deletePriceTableHandler);
router.put('/rename/:industria',                 renamePriceTableHandler);
router.put('/adjust-linear/:industria',          adjustLinearHandler);
router.put('/update-ipi/:industria',             updateIpiHandler);
router.put('/update-st/:industria',              updateStHandler);
router.put('/clear-preco/:industria',            clearPrecoHandler);
router.put('/set-discount-group/:industria',     setDiscountGroupHandler);
router.put('/remove-discount-group/:industria',  removeDiscountGroupHandler);
router.post('/import',                           importPriceTableHandler);

// Status — desativar/reativar tabela inteira
router.patch('/:industria/status',               setPriceTableStatusHandler);
router.post('/desativar-vencidas',               desativarTabelasVencidasHandler);

export default router;
