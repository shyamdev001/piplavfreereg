import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { imagesToPdf } from '../src/services/pdf.service';

const PDF_MAGIC = '%PDF';

async function makeJpeg(width: number, height: number, color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();
}

/** A JPEG with an EXIF orientation tag claiming a 90-degree rotation, to
 * verify the pipeline actually applies EXIF orientation rather than trusting
 * raw pixel dimensions - the exact "rotated EXIF image" case field agents hit
 * constantly with phone camera photos. */
async function makeRotatedJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    .withMetadata({ orientation: 6 }) // 6 = rotate 90deg CW on display
    .jpeg()
    .toBuffer();
}

describe('pdf.service imagesToPdf', () => {
  it('produces a valid single-page PDF from one portrait image', async () => {
    const portrait = await makeJpeg(600, 900, { r: 255, g: 0, b: 0 });
    const pdfBuffer = await imagesToPdf([portrait]);

    expect(pdfBuffer.subarray(0, 4).toString('utf-8')).toBe(PDF_MAGIC);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    expect(pdfDoc.getPageCount()).toBe(1);
    const { width, height } = pdfDoc.getPages()[0].getSize();
    expect(height).toBeGreaterThan(width); // portrait stays portrait
  });

  it('produces a valid single-page PDF from one landscape image', async () => {
    const landscape = await makeJpeg(900, 600, { r: 0, g: 255, b: 0 });
    const pdfBuffer = await imagesToPdf([landscape]);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    expect(pdfDoc.getPageCount()).toBe(1);
    const { width, height } = pdfDoc.getPages()[0].getSize();
    expect(width).toBeGreaterThan(height); // landscape stays landscape
  });

  it('combines multiple images into one multi-page PDF, in order (front + back = 2 pages, not 2 PDFs)', async () => {
    const front = await makeJpeg(500, 800, { r: 255, g: 0, b: 0 });
    const back = await makeJpeg(500, 800, { r: 0, g: 0, b: 255 });

    const pdfBuffer = await imagesToPdf([front, back]);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    expect(pdfDoc.getPageCount()).toBe(2);
  });

  it('supports a longer multi-page document (e.g. a multi-page bank passbook)', async () => {
    const pages = await Promise.all([
      makeJpeg(600, 900, { r: 10, g: 10, b: 10 }),
      makeJpeg(600, 900, { r: 20, g: 20, b: 20 }),
      makeJpeg(600, 900, { r: 30, g: 30, b: 30 }),
    ]);

    const pdfBuffer = await imagesToPdf(pages);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    expect(pdfDoc.getPageCount()).toBe(3);
  });

  it('applies EXIF orientation before sizing the PDF page (rotated phone camera photo)', async () => {
    // A 900x600 source with a 90-degree EXIF rotation tag should render as a
    // 600x900 (portrait) page once orientation is honored - if the pipeline
    // ignored EXIF, the page would incorrectly come out 900x600.
    const rotated = await makeRotatedJpeg(900, 600);
    const pdfBuffer = await imagesToPdf([rotated]);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const { width, height } = pdfDoc.getPages()[0].getSize();
    expect(height).toBeGreaterThan(width);
  });

  it('rejects an empty input rather than silently producing a blank PDF', async () => {
    await expect(imagesToPdf([])).rejects.toThrow();
  });
});
