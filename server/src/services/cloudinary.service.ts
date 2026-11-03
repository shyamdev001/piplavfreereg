import { cloudinary } from '../config/cloudinary';
import { randomUUID } from 'crypto';

export interface UploadResult {
  publicId: string;
  resourceType: string;
  bytes: number;
  format: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Uploads a buffer to Cloudinary under a per-lead, per-document-type,
 * per-kind folder (`original/` for as-uploaded pages, `pdf/` for the
 * generated/passed-through PDF), using the "authenticated" delivery type so
 * assets are never publicly reachable by a guessed URL - only via signed
 * URLs we mint on demand.
 *
 * PDFs are stored under `resource_type: raw`, not `image`: Cloudinary blocks
 * delivery of PDFs uploaded as `image` by default on every account (a
 * standing mitigation for a historical Ghostscript RCE) unless the account
 * owner opts in under Settings > Security > "Allow delivery of PDF and ZIP
 * files". Using `raw` sidesteps that restriction entirely - no image
 * transformation pipeline touches these files anyway - so the feature works
 * out of the box on a stock Cloudinary account. Raw public_ids must carry
 * their own extension (Cloudinary does not infer it from content the way it
 * does for `image`), so it's appended once, here, at upload time.
 */
export function uploadDocumentBuffer(
  buffer: Buffer,
  opts: { leadId: string; documentType: string; mimeType: string; kind: 'original' | 'pdf' },
): Promise<UploadResult> {
  const folder = `solar-leads/${slugify(opts.leadId)}/${slugify(opts.documentType)}/${opts.kind}`;
  const isPdf = opts.mimeType === 'application/pdf';
  const resourceType = isPdf ? 'raw' : 'image';
  const publicId = isPdf ? `${randomUUID()}.pdf` : randomUUID();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated',
        overwrite: false,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({
          publicId: result.public_id,
          resourceType: result.resource_type,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

/**
 * `raw` public_ids already carry their extension (see uploadDocumentBuffer),
 * so `format` must never be re-applied there - Cloudinary would otherwise
 * look for a second, doubled extension and 404.
 */
export function buildSignedViewUrl(publicId: string, resourceType: string, format?: string): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: resourceType === 'raw' ? undefined : format,
  });
}

/**
 * A signed URL that forces a download with a clean, predictable filename
 * (via Cloudinary's `fl_attachment:<name>` flag) rather than exposing the
 * random UUID public_id we store assets under. `baseFilename` should already
 * be sanitized (see documentNaming.ts) and must NOT include an extension:
 * Cloudinary appends the extension itself, and a "." inside the flag value is
 * rejected with 400 "Invalid flag in transformation".
 */
export function buildSignedDownloadUrl(
  publicId: string,
  resourceType: string,
  baseFilename: string,
  format: string,
): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: resourceType === 'raw' ? undefined : format,
    flags: `attachment:${baseFilename}`,
  });
}

export async function deleteDocumentAsset(publicId: string, resourceType: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated' });
  } catch (err) {
    console.error('[cloudinary] failed to delete asset', publicId, (err as Error).message);
  }
}

interface AssetRef {
  cloudinaryPublicId: string;
  resourceType: string;
}

/**
 * Deletes every Cloudinary asset belonging to one lead document (all
 * pages, plus the generated PDF unless it happens to be the same asset as a
 * PDF-only page). Shared by "replace this document", "delete this
 * document", and "delete this whole draft lead".
 */
export async function deleteDocumentGroupAssets(doc: { pages: AssetRef[]; pdfFile?: AssetRef }): Promise<void> {
  for (const page of doc.pages) {
    await deleteDocumentAsset(page.cloudinaryPublicId, page.resourceType);
  }
  if (doc.pdfFile && !doc.pages.some((f) => f.cloudinaryPublicId === doc.pdfFile!.cloudinaryPublicId)) {
    await deleteDocumentAsset(doc.pdfFile.cloudinaryPublicId, doc.pdfFile.resourceType);
  }
}

/**
 * Pulls an authenticated asset's bytes into memory, server-to-server (never
 * exposed to the browser). Used to rebuild a multi-page PDF from its
 * already-stored original pages, and to assemble the "download all" ZIP.
 */
export async function fetchAssetBuffer(publicId: string, resourceType: string): Promise<Buffer> {
  const url = buildSignedViewUrl(publicId, resourceType);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Cloudinary asset ${publicId}: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
