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

// Mounted at /api/leads/:id/documents (mergeParams to access :id)
const leadDocumentsRouter = Router({ mergeParams: true });
leadDocumentsRouter.get('/', listDocuments);
leadDocumentsRouter.post('/', uploadLimiter, documentUpload.single('file'), uploadDocument);
leadDocumentsRouter.get('/download-all', downloadAllPdfs);

export default leadDocumentsRouter;

// Mounted at /api/documents (top-level, addressed by documentId)
export const standaloneDocumentsRouter = Router();
standaloneDocumentsRouter.get('/:documentId/access', getDocumentAccess);
standaloneDocumentsRouter.post('/:documentId/regenerate-pdf', regeneratePdf);
standaloneDocumentsRouter.patch('/:documentId/pages/reorder', reorderPages);
standaloneDocumentsRouter.delete('/:documentId/pages/:pageId', removePage);
standaloneDocumentsRouter.patch('/:documentId', renameDocument);
standaloneDocumentsRouter.delete('/:documentId', deleteDocument);
