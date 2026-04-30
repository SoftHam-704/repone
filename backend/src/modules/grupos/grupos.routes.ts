import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listGruposHandler,
  getGrupoHandler,
  createGrupoHandler,
  updateGrupoHandler,
  deleteGrupoHandler,
} from './grupos.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/',     listGruposHandler);
router.get('/:id',  getGrupoHandler);
router.post('/',    createGrupoHandler);
router.put('/:id',  updateGrupoHandler);
router.delete('/:id', deleteGrupoHandler);

export default router;
