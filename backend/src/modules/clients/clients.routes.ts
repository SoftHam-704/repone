import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listClientsHandler,
  getClientHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler,
  listContactsHandler,
  createContactHandler,
  updateContactHandler,
  deleteContactHandler,
  listIndustriesHandler,
  upsertIndustryHandler,
  deleteIndustryHandler,
  listDiscountsHandler,
  upsertDiscountHandler,
  deleteDiscountHandler,
  listProspeccaoHandler,
  upsertProspeccaoHandler,
  listAreasHandler,
  upsertAreasHandler,
  vincularRegioesHandler,
  generatePortalTokenHandler,
  clienteHistoricoHandler,
} from './clients.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/',      listClientsHandler);
router.post('/vincular-regioes', vincularRegioesHandler);
router.get('/:id',   getClientHandler);
router.post('/',     createClientHandler);
router.put('/:id',   updateClientHandler);
router.delete('/:id', deleteClientHandler);

// ── cli_aniv — contatos aniversariantes ──────────────────────────────────────
router.get('/:id/contacts',              listContactsHandler);
router.post('/:id/contacts',             createContactHandler);
router.put('/:id/contacts/:lancto',      updateContactHandler);
router.delete('/:id/contacts/:lancto',   deleteContactHandler);

// ── cli_ind — condições comerciais por indústria ──────────────────────────────
router.get('/:id/industries',                  listIndustriesHandler);
router.post('/:id/industries',                 upsertIndustryHandler);
router.delete('/:id/industries/:lancamento',   deleteIndustryHandler);

// ── cli_descpro — descontos por grupo de produto ─────────────────────────────
router.get('/:id/discounts',                             listDiscountsHandler);
router.post('/:id/discounts',                            upsertDiscountHandler);
router.delete('/:id/discounts/:industryId/:groupId',     deleteDiscountHandler);

// ── indclientes — indústrias de prospecção (opt-in) ──────────────────────────
router.get('/:id/prospeccao',  listProspeccaoHandler);
router.put('/:id/prospeccao',  upsertProspeccaoHandler);

// ── atua_cli — áreas de atuação (opt-in) ─────────────────────────────────────
router.get('/:id/areas',  listAreasHandler);
router.put('/:id/areas',  upsertAreasHandler);

// ── portal_clientes — token de acesso do lojista ─────────────────────────────
router.post('/:id/portal-token', generatePortalTokenHandler);

// ── historico — indústrias e pedidos do cliente ───────────────────────────────
router.get('/:id/historico', clienteHistoricoHandler);

export default router;
