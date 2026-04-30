import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import {
    parafluPreviewHandler,
    parafluImportHandler,
    uploadParaflu,
} from './portal.controller';

const router = Router();

router.use(authMiddleware, tenantMiddleware);

// PARAFLU
router.post('/paraflu/preview', uploadParaflu.single('file'), parafluPreviewHandler);
router.post('/paraflu/import',  uploadParaflu.single('file'), parafluImportHandler);

export default router;
