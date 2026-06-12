import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  getAliquotasHandler, updateAliquotasHandler,
  listRepresentadasHandler,
  listNfseHandler, createNfseHandler, updateNfseHandler, deleteNfseHandler,
  emitirNfseHandler, previaNfseHandler,
} from './nfse.controller';

const router = Router();

// Controle de NFS-e / Comissões do escritório = dado sensível → MASTER apenas.
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.MASTER));

// matriz de alíquotas
router.get('/aliquotas', getAliquotasHandler);
router.put('/aliquotas', updateAliquotasHandler);

// representadas (combobox)
router.get('/representadas', listRepresentadasHandler);

// lançamentos
router.get   ('/',     listNfseHandler);
router.post  ('/',     createNfseHandler);
router.put   ('/:id',  updateNfseHandler);
router.delete('/:id',  deleteNfseHandler);

// emissão real (ACBr) — homologação nesta fase
router.post('/:id/emitir', emitirNfseHandler);
router.get('/:id/previa', previaNfseHandler);

export default router;
