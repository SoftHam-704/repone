import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listSellOutHandler,
  sellOutSummaryHandler,
  sellOutPendenciesHandler,
  sellOutStatsHandler,
  sellOutRankingHandler,
  createSellOutHandler,
  updateSellOutHandler,
  deleteSellOutHandler,
  importSellOutHandler,
} from './sellout.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/',            listSellOutHandler);
router.get('/summary',     sellOutSummaryHandler);
router.get('/pendencies',  sellOutPendenciesHandler);
router.get('/stats',       sellOutStatsHandler);
router.get('/ranking',     sellOutRankingHandler);
router.post('/',           createSellOutHandler);
router.put('/:id',         updateSellOutHandler);
router.delete('/:id',      deleteSellOutHandler);
router.post('/import',     importSellOutHandler);

export default router;
