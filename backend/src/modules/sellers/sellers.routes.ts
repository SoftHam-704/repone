import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listSellersHandler, getSellerHandler,
  createSellerHandler, updateSellerHandler, deleteSellerHandler,
  listSellerIndustriesHandler, addSellerIndustryHandler,
  updateSellerIndustryHandler, deleteSellerIndustryHandler,
  listSellerRegionsHandler, addSellerRegionHandler, deleteSellerRegionHandler,
  listSellerMetasHandler, createSellerMetaHandler,
  updateSellerMetaHandler, deleteSellerMetaHandler,
} from './sellers.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// ── CRUD principal ────────────────────────────────────────────────────────────
router.get('/',       listSellersHandler);
router.get('/:id',    getSellerHandler);
router.post('/',      createSellerHandler);
router.put('/:id',    updateSellerHandler);
router.delete('/:id', deleteSellerHandler);

// ── Indústrias que atende ─────────────────────────────────────────────────────
router.get('/:id/industries',                       listSellerIndustriesHandler);
router.post('/:id/industries',                      addSellerIndustryHandler);
router.put('/:id/industries/:industryId',           updateSellerIndustryHandler);
router.delete('/:id/industries/:industryId',        deleteSellerIndustryHandler);

// ── Regiões atendidas ─────────────────────────────────────────────────────────
router.get('/:id/regions',                          listSellerRegionsHandler);
router.post('/:id/regions',                         addSellerRegionHandler);
router.delete('/:id/regions/:regionId',             deleteSellerRegionHandler);

// ── Metas ─────────────────────────────────────────────────────────────────────
router.get('/:id/metas',                            listSellerMetasHandler);
router.post('/:id/metas',                           createSellerMetaHandler);
router.put('/:id/metas/:metaId',                    updateSellerMetaHandler);
router.delete('/:id/metas/:metaId',                 deleteSellerMetaHandler);

export default router;
