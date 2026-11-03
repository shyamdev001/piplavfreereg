/**
 * Builds clean, predictable, filesystem-safe filenames for customer document
 * downloads (e.g. "SOL-000124_Rajesh_Patel_Aadhaar_Card") instead of exposing
 * the random Cloudinary public_id. Customer-supplied text (name) is sanitized
 * before ever touching a filename or Cloudinary path.
 */
export function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9\s-]/g, '') // drop anything that isn't alphanumeric/space/hyphen
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return cleaned || 'Document';
}

/** The name a document is shown and downloaded under: its custom name for an
 * Other Document, otherwise its document type. */
export function documentLabel(doc: { documentType: string; customName?: string }): string {
  return doc.customName?.trim() || doc.documentType;
}

export function buildDocumentBaseName(leadId: string, customerName: string | undefined, documentType: string): string {
  return [leadId, customerName || 'Customer', documentType].map(sanitizeFilenamePart).join('_');
}
