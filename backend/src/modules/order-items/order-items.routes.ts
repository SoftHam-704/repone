import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { listOrderItemsHandler, syncOrderItemsHandler, batchLastPricesHandler, productHistoryHandler } from './order-items.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.post('/batch-last-prices',                              batchLastPricesHandler);
router.get('/product-history/:produto/:cliente/:industria',    productHistoryHandler);
router.get('/:pedido',                                         listOrderItemsHandler);
router.post('/:pedido/sync',                                   syncOrderItemsHandler);

export default router;
