import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  getCatalogHandler,
  getPriceTablesHandler,
  getProductsWithPricesHandler,
  getProductDetailHandler,
  saveProductHandler,
  deleteProductHandler,
} from './products.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/tables/:industria',      getPriceTablesHandler);
router.get('/catalog/:industria',     getCatalogHandler);
// tabela passada como ?tabela= para evitar problema com "/" no nome da tabela
router.get('/detail/:proId',          getProductDetailHandler);
router.post('/save',                  saveProductHandler);
router.get('/:industria',             getProductsWithPricesHandler);
router.delete('/:proId',              deleteProductHandler);

export default router;
