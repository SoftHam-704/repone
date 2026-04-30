import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  sendOrderEmailHandler,
  testConnectionHandler,
  filterOptionsAtuacaoHandler,
  filterOptionsIndustriasHandler,
  filterClientsHandler,
  sendBulkHandler,
} from './email.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.post('/send-order',                    sendOrderEmailHandler);
router.post('/test-connection',               testConnectionHandler);
router.get('/filter-options/atuacao',         filterOptionsAtuacaoHandler);
router.get('/filter-options/industrias',      filterOptionsIndustriasHandler);
router.get('/filter-clients',                 filterClientsHandler);
router.post('/send-bulk',                     sendBulkHandler);

export default router;
