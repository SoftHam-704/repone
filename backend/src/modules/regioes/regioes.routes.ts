import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listRegioesHandler, getRegiaoHandler, createRegiaoHandler,
  updateRegiaoHandler, deleteRegiaoHandler,
  listCidadesRegiaoHandler, addCidadeRegiaoHandler, removeCidadeRegiaoHandler,
  searchCidadesHandler,
} from './regioes.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/',      listRegioesHandler);
router.get('/:id',   getRegiaoHandler);
router.post('/',     createRegiaoHandler);
router.put('/:id',   updateRegiaoHandler);
router.delete('/:id', deleteRegiaoHandler);

// Cidades da região (pai/filho)
router.get('/:id/cidades',            listCidadesRegiaoHandler);
router.post('/:id/cidades',           addCidadeRegiaoHandler);
router.delete('/:id/cidades/:cidId',  removeCidadeRegiaoHandler);

export default router;
