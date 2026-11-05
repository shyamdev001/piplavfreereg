import { Router } from 'express';
import { documentUpload } from '../middleware/upload.middleware';
import {
  deleteDocument,
  downloadAllPdfs,
  getDocumentAccess,
  listDocuments,
  regeneratePdf,
  removePage,
  renameDocument,
  reorderPages,
  uploadDocument,
} from '../controllers/document.controller';
import { uploadLimiter } from '../middleware/rateLimit.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

// Viewers may list, view and download documents, but never change them.
const canWrite = requireRole(UserRole.AGENT, UserRole.ADMIN);

// Mounted at /api/leads/:id/documents (mergeParams to access :id)
const leadDocumentsRouter = Router({ mergeParams: true });
leadDocumentsRouter.get('/', listDocuments);
leadDocumentsRouter.post('/', canWrite, uploadLimiter, documentUpload.single('file'), uploadDocument);
leadDocumentsRouter.get('/download-all', downloadAllPdfs);

export default leadDocumentsRouter;

// Mounted at /api/documents (top-level, addressed by documentId)
export const standaloneDocumentsRouter = Router();
standaloneDocumentsRouter.get('/:documentId/access', getDocumentAccess);
standaloneDocumentsRouter.post('/:documentId/regenerate-pdf', canWrite, regeneratePdf);
standaloneDocumentsRouter.patch('/:documentId/pages/reorder', canWrite, reorderPages);
standaloneDocumentsRouter.delete('/:documentId/pages/:pageId', canWrite, removePage);
standaloneDocumentsRouter.patch('/:documentId', canWrite, renameDocument);
standaloneDocumentsRouter.delete('/:documentId', canWrite, deleteDocument);
