import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  analyzeHandler,
  getDraftsHandler,
  saveDraftHandler,
  deleteDraftHandler,
  deleteAllDraftsHandler,
  checkoutHandler,
  parseBatchHandler,
  confirmBatchHandler,
} from './smart-importer.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.post('/analyze',        analyzeHandler);
router.get('/drafts',          getDraftsHandler);
router.post('/drafts',         saveDraftHandler);
router.delete('/drafts/all',   deleteAllDraftsHandler);
router.delete('/drafts/:id',   deleteDraftHandler);
router.post('/checkout',       checkoutHandler);
router.post('/parse-batch',    parseBatchHandler);
router.post('/confirm-batch',  confirmBatchHandler);

export default router;
