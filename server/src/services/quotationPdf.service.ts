import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, rgb } from 'pdf-lib';
import {
  QUOTATION_BANK,
  QUOTATION_CATEGORY_LABELS,
  QUOTATION_NOTES,
  QUOTATION_SELLER,
  QUOTATION_SYSTEM,
  QuotationCategory,
} from '../config/quotation';
import { formatIndianAmount, rupeesInWords } from '../utils/amountInWords';

export interface QuotationPdfData {
  quotationNumber: string;
  customerName: string;
  address: string;
  mobileNumber: string;
  category: QuotationCategory;
  amount: number;
  quotationDate: Date;
  expiryDate: Date;
}

// server/assets works both from src/services (tsx) and dist/services (built).
const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const LOGO_PATH = path.join(ASSETS_DIR, 'logo.png');
/** Optional: drop Mukt Patel's signature here (PNG with transparent background) and it is printed. */
const SIGNATURE_PATH = path.join(ASSETS_DIR, 'signature.png');

const ORANGE = rgb(0.93, 0.5, 0.0);
const GREEN = rgb(0.36, 0.58, 0.25);
const TEXT = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.82, 0.82, 0.82);
const TOTAL_BG = rgb(0.93, 0.97, 0.93);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LEFT = 36;
const RIGHT = PAGE_W - 36;

/** Standard PDF fonts only cover Latin text: drop anything else rather than crash. */
function latin(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, '');
}

function formatDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Dates are shown in India time regardless of the server's timezone.
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return `${String(ist.getUTCDate()).padStart(2, '0')} ${months[ist.getUTCMonth()]}, ${ist.getUTCFullYear()}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of latin(paragraph).split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

class Writer {
  constructor(
    readonly page: PDFPage,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {}

  /** Draws text with its top at `top` (distance from the top of the page). */
  text(str: string, x: number, top: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
    const font = opts.bold ? this.bold : this.regular;
    this.page.drawText(latin(str), { x, y: PAGE_H - top - size * 0.8, size, font, color: opts.color ?? TEXT });
    return font.widthOfTextAtSize(latin(str), size);
  }

  textRight(str: string, right: number, top: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
    const font = opts.bold ? this.bold : this.regular;
    this.text(str, right - font.widthOfTextAtSize(latin(str), size), top, size, opts);
  }

  /** Wrapped paragraph; returns the height used. */
  paragraph(str: string, x: number, top: number, size: number, width: number, opts: { bold?: boolean; color?: RGB; lineGap?: number } = {}) {
    const font = opts.bold ? this.bold : this.regular;
    const lineHeight = size * (opts.lineGap ?? 1.35);
    const lines = wrap(str, font, size, width);
    lines.forEach((line, i) => this.text(line, x, top + i * lineHeight, size, opts));
    return lines.length * lineHeight;
  }

  /** "Label: value" with an orange label. */
  labelValue(label: string, value: string, x: number, top: number, size: number) {
    const w = this.text(label, x, top, size, { color: ORANGE });
    this.text(value, x + w + 3, top, size);
  }

  line(x1: number, top1: number, x2: number, top2: number, color: RGB = LINE, thickness = 0.7) {
    this.page.drawLine({ start: { x: x1, y: PAGE_H - top1 }, end: { x: x2, y: PAGE_H - top2 }, color, thickness });
  }

  rect(x: number, top: number, w: number, h: number, opts: { fill?: RGB; border?: RGB }) {
    this.page.drawRectangle({
      x,
      y: PAGE_H - top - h,
      width: w,
      height: h,
      color: opts.fill,
      borderColor: opts.border,
      borderWidth: opts.border ? 0.7 : 0,
    });
  }

  /**
   * The standard fonts have no rupee glyph, so the sign is drawn as a path.
   * Returns its advance width.
   */
  rupee(x: number, top: number, size: number, color: RGB) {
    const scale = size / 16;
    this.page.drawSvgPath('M1 2 H9 M1 5.5 H9 M2.5 2 C8.6 2 8.6 9 2.5 9 H1.5 L7.5 15', {
      x,
      y: PAGE_H - top + size * 0.05,
      scale,
      borderColor: color,
      borderWidth: 1.5,
    });
    return 10.5 * scale;
  }

  /** Right-aligned "₹1,23,456.00". */
  money(amount: number, right: number, top: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
    const font = opts.bold ? this.bold : this.regular;
    const str = formatIndianAmount(amount);
    const textW = font.widthOfTextAtSize(str, size);
    const signW = 10.5 * (size / 16);
    this.rupee(right - textW - signW, top, size, opts.color ?? TEXT);
    this.text(str, right - textW, top, size, opts);
  }
}

async function embedPngIfPresent(doc: PDFDocument, file: string): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(await fs.promises.readFile(file));
  } catch {
    return null;
  }
}

export async function buildQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Quotation ${data.quotationNumber}`);
  doc.setAuthor(QUOTATION_SELLER.name);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const w = new Writer(page, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  // ---- Frame and title ----
  w.rect(LEFT, 30, RIGHT - LEFT, PAGE_H - 60, { border: LINE });
  const title = 'Quotation';
  const titleSize = 24;
  w.text(title, (PAGE_W - w.bold.widthOfTextAtSize(title, titleSize)) / 2, 62, titleSize, { bold: true, color: ORANGE });

  const logo = await embedPngIfPresent(doc, LOGO_PATH);
  if (logo) {
    const size = 72;
    page.drawImage(logo, { x: RIGHT - size - 14, y: PAGE_H - 42 - size, width: size, height: size });
  }

  // ---- From / Bill To / Meta ----
  const infoTop = 128;
  const col1 = LEFT + 14;
  const col2 = 222;
  const col3 = 392;
  w.text('From', col1, infoTop, 9, { bold: true, color: MUTED });
  let h = w.paragraph(QUOTATION_SELLER.name, col1, infoTop + 16, 9, 160, { bold: true, color: ORANGE });
  w.paragraph(QUOTATION_SELLER.address, col1, infoTop + 22 + h, 8.5, 160, { color: MUTED });

  w.text('Bill To', col2, infoTop, 9, { bold: true, color: MUTED });
  h = w.paragraph(data.customerName.toUpperCase(), col2, infoTop + 16, 9, 150, { bold: true, color: ORANGE });
  let billTop = infoTop + 22 + h;
  billTop += w.paragraph(data.address, col2, billTop, 8.5, 150, { color: MUTED });
  w.labelValue('Mobile:', data.mobileNumber, col2, billTop + 3, 8.5);
  w.labelValue('Category:', QUOTATION_CATEGORY_LABELS[data.category], col2, billTop + 16, 8.5);

  const meta: Array<[string, string]> = [
    ['Date:', formatDate(data.quotationDate)],
    ['Expiry Date:', formatDate(data.expiryDate)],
    ['Estimate#:', data.quotationNumber],
    ['Created by:', QUOTATION_SELLER.createdBy],
    ['Contact:', QUOTATION_SELLER.contact],
  ];
  meta.forEach(([label, value], i) => w.labelValue(label, value, col3, infoTop + i * 17, 8.5));

  w.line(col2 - 10, infoTop - 4, col2 - 10, infoTop + 100);
  w.line(col3 - 10, infoTop - 4, col3 - 10, infoTop + 100);

  // ---- Items table ----
  const tableTop = 250;
  const tableLeft = LEFT + 10;
  const tableRight = RIGHT - 10;
  const colQty = 330;
  const colRate = 420;
  const colGst = 470;
  w.rect(tableLeft, tableTop, tableRight - tableLeft, 24, { fill: GREEN });
  const head = { bold: true, color: rgb(1, 1, 1) };
  w.text('#', tableLeft + 10, tableTop + 8, 8.5, head);
  w.text('ITEM & DESCRIPTION', tableLeft + 32, tableTop + 8, 8.5, head);
  w.text('QTY', colQty, tableTop + 8, 8.5, head);
  w.textRight('RATE', colRate, tableTop + 8, 8.5, head);
  w.textRight('GST', colGst, tableTop + 8, 8.5, head);
  w.textRight('TOTAL', tableRight - 8, tableTop + 8, 8.5, head);

  const rowTop = tableTop + 36;
  w.text('1', tableLeft + 10, rowTop, 8.5);
  w.text(QUOTATION_SYSTEM.title, tableLeft + 32, rowTop, 9, { bold: true, color: ORANGE });
  const descH = w.paragraph(QUOTATION_SYSTEM.description, tableLeft + 32, rowTop + 16, 9, 240, { color: MUTED, lineGap: 1.45 });
  w.text('1', colQty + 4, rowTop, 8.5);
  w.textRight(formatIndianAmount(data.amount), colRate, rowTop, 8.5);
  w.money(0, colGst, rowTop, 8.5);
  w.money(data.amount, tableRight - 8, rowTop, 8.5, { bold: true, color: ORANGE });
  const rowBottom = rowTop + 16 + descH + 12;
  w.line(tableLeft, rowBottom, tableRight, rowBottom);
  w.rect(tableLeft, tableTop, tableRight - tableLeft, rowBottom - tableTop, { border: GREEN });

  // ---- Totals ----
  const totalsTop = rowBottom + 10;
  const totalsLeft = 360;
  const totals: Array<[string, number]> = [
    ['Sub Total:', data.amount],
    ['CGST:', 0],
    ['SGST:', 0],
    ['Add/Less:', 0],
  ];
  totals.forEach(([label, value], i) => {
    const top = totalsTop + i * 20;
    w.text(label, totalsLeft, top, 9, { color: MUTED });
    w.money(value, tableRight - 8, top, 9, { bold: i === 0 });
  });
  const grandTop = totalsTop + totals.length * 20 - 5;
  w.rect(totalsLeft - 8, grandTop, tableRight - totalsLeft + 8, 22, { fill: TOTAL_BG });
  w.text('Total:', totalsLeft, grandTop + 7, 9.5, { bold: true });
  w.money(data.amount, tableRight - 8, grandTop + 7, 10, { bold: true, color: ORANGE });
  w.line(totalsLeft - 18, totalsTop - 6, totalsLeft - 18, grandTop + 22);
  const words = rupeesInWords(data.amount);
  w.paragraph(words, tableLeft + 6, totalsTop + 36, 8.5, totalsLeft - tableLeft - 40, { color: ORANGE });

  // ---- Notes / Bank / Signature ----
  const footTop = grandTop + 40;
  const footH = 150;
  w.rect(tableLeft, footTop, tableRight - tableLeft, footH, { border: LINE });
  const notesX = tableLeft + 10;
  const bankX = 232;
  const signX = 418;
  w.line(bankX - 10, footTop, bankX - 10, footTop + footH);
  w.line(signX - 10, footTop, signX - 10, footTop + footH);

  w.text('Notes:', notesX, footTop + 10, 10, { bold: true, color: ORANGE });
  let top = footTop + 28;
  for (const note of QUOTATION_NOTES) top += w.paragraph(note, notesX, top, 7.5, 165, { color: TEXT, lineGap: 1.4 });

  w.text('Bank Detail :', bankX, footTop + 10, 10, { bold: true, color: ORANGE });
  top = footTop + 28;
  for (const line of QUOTATION_BANK) top += w.paragraph(line, bankX, top, 7.5, 170, { color: TEXT, lineGap: 1.4 });

  const signature = await embedPngIfPresent(doc, SIGNATURE_PATH);
  const signCenter = (signX + tableRight) / 2;
  if (signature) {
    const maxW = 110;
    const maxH = 50;
    const s = Math.min(maxW / signature.width, maxH / signature.height);
    page.drawImage(signature, {
      x: signCenter - (signature.width * s) / 2,
      y: PAGE_H - footTop - 14 - signature.height * s,
      width: signature.width * s,
      height: signature.height * s,
    });
  } else {
    w.line(signCenter - 50, footTop + 62, signCenter + 50, footTop + 62, MUTED, 0.5);
  }
  const signLabel = 'Authorized Signature';
  w.text(signLabel, signCenter - w.bold.widthOfTextAtSize(signLabel, 9) / 2, footTop + 70, 9, { bold: true, color: ORANGE });

  return Buffer.from(await doc.save());
}
