import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { runMigrationsHandler, migrationStatusHandler } from './admin.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.post('/migrate',        runMigrationsHandler);
router.get('/migrate/status',  migrationStatusHandler);

export default router;
