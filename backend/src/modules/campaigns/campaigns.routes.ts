import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listCampaignsHandler,
  simulateCampaignHandler,
  createCampaignHandler,
  updateCampaignHandler,
  getTrackingHandler,
  addTrackingHandler,
  deleteTrackingHandler,
} from './campaigns.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/',                        listCampaignsHandler);
router.post('/simulate',               simulateCampaignHandler);
router.post('/',                       createCampaignHandler);
router.put('/:id',                     updateCampaignHandler);
router.get('/:id/tracking',            getTrackingHandler);
router.post('/:id/tracking',           addTrackingHandler);
router.delete('/tracking/:tid',        deleteTrackingHandler);

export default router;
