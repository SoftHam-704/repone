import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { runMigrationsHandler, migrationStatusHandler, migrateAllHandler } from './admin.controller';

const router = Router();

// migrate-all não precisa de tenantMiddleware — opera em todos os schemas
router.post('/migrate-all', authMiddleware, migrateAllHandler);

router.use(authMiddleware, tenantMiddleware);
router.post('/migrate',        runMigrationsHandler);
router.get('/migrate/status',  migrationStatusHandler);

export default router;
