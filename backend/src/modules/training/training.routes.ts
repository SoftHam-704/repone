import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { trainingAskHandler } from './training.controller';

const router = Router();

router.use(authMiddleware);

router.post('/ask', trainingAskHandler);

export default router;
