import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listAllPriceTablesHandler,
  getPriceTablesByIndustriaHandler,
  getPriceTableItemsHandler,
  deletePriceTableHandler,
  deletePriceTableProductHandler,
  updateIpiHandler,
  updateStHandler,
  setDiscountGroupHandler,
  removeDiscountGroupHandler,
  importPriceTableHandler,
  renamePriceTableHandler,
  adjustLinearHandler,
} from './price-tables.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/',                      listAllPriceTablesHandler);
router.get('/:industria/items',      getPriceTableItemsHandler);
router.get('/:industria',            getPriceTablesByIndustriaHandler);

// Tabela sempre como ?tabela= para evitar problema com "/" no nome
router.delete('/product/:industria/:productId',  deletePriceTableProductHandler);
router.delete('/:industria',                     deletePriceTableHandler);
router.put('/rename/:industria',                 renamePriceTableHandler);
router.put('/adjust-linear/:industria',          adjustLinearHandler);
router.put('/update-ipi/:industria',             updateIpiHandler);
router.put('/update-st/:industria',              updateStHandler);
router.put('/set-discount-group/:industria',     setDiscountGroupHandler);
router.put('/remove-discount-group/:industria',  removeDiscountGroupHandler);
router.post('/import',                           importPriceTableHandler);

export default router;
