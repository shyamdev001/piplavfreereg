import { PDFDocument } from 'pdf-lib';
import { toJpegForPdf } from './image.service';

/**
 * Assembles one PDF, one page per image, in the given order (front, then
 * back, then any further pages) - this is what makes a multi-image document
 * like "Aadhaar front + back" a single two-page PDF instead of two unrelated
 * files. Each page is sized to that image's own pixel dimensions (used
 * directly as PDF points), so portrait stays portrait, landscape stays
 * landscape, and the full document is always visible with no cropping.
 *
 * Deliberately plain: no headers, footers, watermarks, or metadata beyond
 * what pdf-lib sets by default - this is an official customer-document
 * artifact, not a branded export.
 */
export async function imagesToPdf(imageBuffers: Buffer[]): Promise<Buffer> {
  if (imageBuffers.length === 0) {
    throw new Error('imagesToPdf requires at least one image');
  }

  const pdfDoc = await PDFDocument.create();

  for (const original of imageBuffers) {
    const { buffer, width, height } = await toJpegForPdf(original);
    const jpegImage = await pdfDoc.embedJpg(buffer);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(jpegImage, { x: 0, y: 0, width, height });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
