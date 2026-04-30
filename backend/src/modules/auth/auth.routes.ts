import { Router } from 'express';
import { loginHandler, logoutHandler, verifyHandler, marqueeCompaniesHandler } from './auth.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.post('/login', loginHandler);
router.post('/logout', logoutHandler);
router.get('/verify', authMiddleware, verifyHandler);
router.get('/marquee-companies', marqueeCompaniesHandler);

export default router;
