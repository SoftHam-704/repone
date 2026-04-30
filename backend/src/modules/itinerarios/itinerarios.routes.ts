import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listItinerariosHandler, getItinerarioHandler, createItinerarioHandler,
  updateItinerarioHandler, deleteItinerarioHandler,
  listParadasHandler, addParadaHandler, reorderParadasHandler, removeParadaHandler,
  clientesRotaHandler,
} from './itinerarios.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// Rota especial antes de /:id para não conflitar
router.get('/clientes-rota', clientesRotaHandler);

router.get('/',       listItinerariosHandler);
router.get('/:id',    getItinerarioHandler);
router.post('/',      createItinerarioHandler);
router.put('/:id',    updateItinerarioHandler);
router.delete('/:id', deleteItinerarioHandler);

// Paradas (clientes do itinerário)
router.get('/:id/paradas',           listParadasHandler);
router.post('/:id/paradas',          addParadaHandler);
router.put('/:id/paradas/reorder',   reorderParadasHandler);
router.delete('/:id/paradas/:cliId', removeParadaHandler);

export default router;
