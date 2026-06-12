import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { requireLevel, LEVEL } from '../../shared/roles';
import {
  getAliquotasHandler, updateAliquotasHandler,
  listRepresentadasHandler,
  listNfseHandler, createNfseHandler, updateNfseHandler, deleteNfseHandler,
  emitirNfseHandler, previaNfseHandler,
  pdfNfseHandler, xmlNfseHandler, cancelarNfseHandler,
  listServicosHandler, createServicoHandler, updateServicoHandler, deleteServicoHandler,
} from './nfse.controller';

const router = Router();

// Controle de NFS-e / Comissões do escritório — Gerência e acima.
router.use(authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA));

// serviços (cadastro — registrado ANTES de /:id para evitar conflito)
router.get   ('/servicos',     listServicosHandler);
router.post  ('/servicos',     createServicoHandler);
router.put   ('/servicos/:id', updateServicoHandler);
router.delete('/servicos/:id', deleteServicoHandler);

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

// PDF, XML e cancelamento
router.get ('/:id/pdf',      pdfNfseHandler);
router.get ('/:id/xml',      xmlNfseHandler);
router.post('/:id/cancelar', cancelarNfseHandler);

export default router;
