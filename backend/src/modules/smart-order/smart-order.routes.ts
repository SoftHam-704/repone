import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth';
import { smartOrderUploadHandler } from './smart-order.controller';

const router = Router();

// Store file in memory (buffer) — no disk I/O needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|xlsx|xls|csv|docx|jpg|jpeg|png|webp|gif)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato não suportado. Use PDF, Excel, Word, CSV ou imagem.'));
  },
});

router.post('/upload', authMiddleware, upload.single('file'), smartOrderUploadHandler);

export default router;
