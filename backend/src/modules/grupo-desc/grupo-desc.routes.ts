import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listGrupoDescHandler,
  getGrupoDescHandler,
  createGrupoDescHandler,
  updateGrupoDescHandler,
  deleteGrupoDescHandler,
} from './grupo-desc.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/',     listGrupoDescHandler);
router.get('/:id',  getGrupoDescHandler);
router.post('/',    createGrupoDescHandler);
router.put('/:id',  updateGrupoDescHandler);
router.delete('/:id', deleteGrupoDescHandler);

export default router;
