import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  getCatalogHandler,
  getPriceTablesHandler,
  getPricesForOrderHandler,
  getProductsWithPricesHandler,
  getProductDetailHandler,
  saveProductHandler,
  deleteProductHandler,
  getProductPurchaseHistoryHandler,
  getProductSalesSummaryHandler,
} from './products.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/tables/:industria',      getPriceTablesHandler);
router.get('/catalog/:industria',     getCatalogHandler);
router.get('/prices-for-order',       getPricesForOrderHandler);
// tabela passada como ?tabela= para evitar problema com "/" no nome da tabela
router.get('/detail/:proId',          getProductDetailHandler);
router.post('/save',                  saveProductHandler);
router.get('/:industria',             getProductsWithPricesHandler);
router.delete('/:proId',              deleteProductHandler);
router.get('/:proId/purchase-history', getProductPurchaseHistoryHandler);
router.get('/:proId/sales-summary',    getProductSalesSummaryHandler);

export default router;
