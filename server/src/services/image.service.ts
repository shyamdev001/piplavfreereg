import sharp from 'sharp';

const MAX_DIMENSION = 2400; // px - generous enough to keep document text legible
const JPEG_QUALITY = 85;

/**
 * Lightly compresses phone-camera images: caps the longest edge and
 * re-encodes at a high quality setting. This keeps document text readable
 * while preventing 10-20MB camera originals from being stored as-is.
 * PDFs are passed through untouched - they are not re-processed here.
 */
export async function optimizeImageBuffer(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (!mimeType.startsWith('image/')) {
    return buffer;
  }

  const image = sharp(buffer, { failOn: 'none' }).rotate(); // auto-orient using EXIF, then strip it
  const metadata = await image.metadata();

  const needsResize =
    (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;

  let pipeline = image;
  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (mimeType === 'image/png') {
    return pipeline.png({ compressionLevel: 8 }).toBuffer();
  }
  if (mimeType === 'image/webp') {
    return pipeline.webp({ quality: JPEG_QUALITY }).toBuffer();
  }
  // Default: jpeg/jpg
  return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

/**
 * Re-encodes any supported raster image (already-optimized or freshly fetched
 * from storage) to a plain sRGB JPEG suitable for embedding as a PDF page:
 * pdf-lib can only embed JPEG or PNG, so normalizing everything to JPEG keeps
 * pdf.service.ts simple. `.rotate()` re-applies EXIF auto-orientation in case
 * the source buffer still carries an orientation tag (a defensive no-op when
 * it has already been stripped by optimizeImageBuffer), and the returned
 * width/height are read from the actual encoded output - not a separate
 * metadata pass - so a PDF page built from them is guaranteed to match.
 */
export async function toJpegForPdf(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}
