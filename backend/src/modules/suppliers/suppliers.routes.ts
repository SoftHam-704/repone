import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listSuppliersHandler, getSupplierHandler,
  createSupplierHandler, updateSupplierHandler, deleteSupplierHandler,
  listContactsHandler, createContactHandler, updateContactHandler, deleteContactHandler,
  listSupplierCustomersHandler,
  getSupplierGoalsHandler, upsertSupplierGoalsHandler,
  getIaKnowledgeHandler, upsertIaKnowledgeHandler,
} from './suppliers.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

router.get('/',    listSuppliersHandler);
router.get('/:id', getSupplierHandler);
router.post('/',        createSupplierHandler);
router.put('/:id',      updateSupplierHandler);
router.delete('/:id',   deleteSupplierHandler);

// Contacts (Time de Atendimento)
router.get('/:id/contacts',                     listContactsHandler);
router.post('/:id/contacts',                    createContactHandler);
router.put('/:id/contacts/:contactId',          updateContactHandler);
router.delete('/:id/contacts/:contactId',       deleteContactHandler);

// Customers who bought from this supplier
router.get('/:id/customers',                    listSupplierCustomersHandler);

// Annual goals
router.get('/:id/goals/:year',                  getSupplierGoalsHandler);
router.put('/:id/goals/:year',                  upsertSupplierGoalsHandler);

// IA / WhatsApp knowledge
router.get('/:id/ia-knowledge',                 getIaKnowledgeHandler);
router.post('/:id/ia-knowledge',                upsertIaKnowledgeHandler);

export default router;
