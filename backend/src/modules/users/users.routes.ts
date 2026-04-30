import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
  listGroupsHandler,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  getGroupPermissionsHandler,
  saveGroupPermissionsHandler,
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from './users.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

// Groups
router.get('/groups',                          listGroupsHandler);
router.post('/groups',                         createGroupHandler);
router.put('/groups/:id',                      updateGroupHandler);
router.delete('/groups/:id',                   deleteGroupHandler);

// Permissions per group
router.get('/groups/:groupId/permissions',     getGroupPermissionsHandler);
router.put('/groups/:groupId/permissions',     saveGroupPermissionsHandler);

// Users
router.get('/',          listUsersHandler);
router.post('/',         createUserHandler);
router.put('/:id',       updateUserHandler);
router.delete('/:id',    deleteUserHandler);

export default router;
