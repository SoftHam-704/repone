import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
    getBillingHandler,
    getBillingItemsHandler,
    getCommissionRatesHandler,
    createBillingHandler,
    updateBillingHandler,
    deleteBillingHandler,
    patchBillingStatusHandler,
} from './billing.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

// Rotas específicas ANTES de /:pedido para evitar conflito
router.post('/', createBillingHandler);

router.get('/:pedido',                    getBillingHandler);
router.get('/:pedido/items',              getBillingItemsHandler);
router.get('/:pedido/commission-rates',   getCommissionRatesHandler);
router.put('/:pedido/:lancto',            updateBillingHandler);
router.delete('/:pedido/:lancto',         deleteBillingHandler);
router.patch('/:pedido/status',           patchBillingStatusHandler);

export default router;
