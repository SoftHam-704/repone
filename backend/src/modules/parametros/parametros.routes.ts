import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listParametrosHandler,
  listUsersHandler,
  getParametrosHandler,
  upsertParametrosHandler,
  deleteParametrosHandler,
} from './parametros.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get ('/',            listParametrosHandler);
router.get ('/users',       listUsersHandler);
router.get ('/:userId',     getParametrosHandler);
router.post('/',            upsertParametrosHandler);
router.delete('/:userId',   deleteParametrosHandler);

export default router;
