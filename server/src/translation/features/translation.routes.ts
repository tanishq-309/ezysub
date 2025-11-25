import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.ts';
import { validate } from '../../middleware/validate.ts';
import { 
  getUploadUrlSchema, 
  confirmUploadSchema 
} from './translation.schema.js';
import { 
  getUploadUrl, 
  confirmUpload, 
  getJobStatus 
} from './translation.controller.js';

const router = Router();

// All translation routes require login
router.use(authMiddleware);

// POST /api/translate/upload-url
// 1. Validate Body (filename, language, model)
// 2. Generate Presigned URL
router.post(
  '/upload-url', 
  validate(getUploadUrlSchema), 
  getUploadUrl
);

// POST /api/translate/confirm
// 1. Validate Body (jobId)
// 2. Push to BullMQ
router.post(
  '/confirm', 
  validate(confirmUploadSchema), 
  confirmUpload
);

// GET /api/translate/:id
// Poll for status
router.get(
  '/:id', 
  getJobStatus
);

export const translationRoutes = router;