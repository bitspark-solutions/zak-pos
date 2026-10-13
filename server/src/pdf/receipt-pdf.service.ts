import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type {
  ReceiptPdfLine,
  ReceiptPdfPayload,
} from './interfaces/receipt-pdf.interface';

/** PDF points per millimetre (72 pt / 25.4 mm). */
const POINTS_PER_MM = 72 / 25.4;
/** Default slip width for an 80mm thermal roll. */
const DEFAULT_WIDTH_MM = 80;
/** Side/top/bottom padding of the printable area, in points. */
const SIDE_MARGIN = 10;
/** Vertical advance used for a single non-wrapping row, in points. */
const ROW_HEIGHT = 12;
/** Base body font size. */
const BODY_FONT_SIZE = 8;

type SlipDocument = InstanceType<typeof PDFDocument>;

/**
 * Renders a normalized {@link ReceiptPdfPayload} into compact PDF bytes using
 * pdfkit (MIT, pure JS — no headless browser). Deliberately free of Prisma and
 * HTTP: the invoice and sale services assemble the payload and hand this
 * service plain values, so a single renderer backs every slip.
 */
@Injectable()
export class ReceiptPdfService {
  /**
   * Build a narrow thermal-slip PDF and resolve with the full document as a
   * single Buffer. pdfkit emits bytes over a Readable stream, so we collect the
   * chunks and concatenate once the stream ends.
   */
  async render(payload: ReceiptPdfPayload): Promise<Buffer> {
    const widthMm = payload.widthMm ?? DEFAULT_WIDTH_MM;
    const pageWidth = Math.round(widthMm * POINTS_PER_MM);

    const doc = new PDFDocument({
      size: [pageWidth, this.estimateHeight(payload)],
      margins: {
        left: SIDE_MARGIN,
        right: SIDE_MARGIN,
        top: SIDE_MARGIN,
        bottom: SIDE_MARGIN,
      },
      info: { Title: payload.documentTitle, Author: payload.shopName },
      autoFirstPage: true,
    });

    const contentWidth = pageWidth - SIDE_MARGIN * 2;

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      doc.once('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.once('error', (error: Error) => {
        reject(error);
      });
    });

    this.draw(doc, payload, contentWidth);

    doc.end();

    return done;
  }

  private draw(
    doc: SlipDocument,
    payload: ReceiptPdfPayload,
    contentWidth: number,
  ): void {
    // Header -------------------------------------------------------------
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(payload.shopName, SIDE_MARGIN, doc.y, {
        width: contentWidth,
        align: 'center',
      });

    if (payload.shopAddress) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .text(payload.shopAddress, SIDE_MARGIN, doc.y, {
          width: contentWidth,
          align: 'center',
        });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(payload.documentTitle.toUpperCase(), SIDE_MARGIN, doc.y, {
        width: contentWidth,
        align: 'center',
      });

    this.dashedRule(doc, contentWidth);

    // Meta ----------------------------------------------------------------
    this.row(doc, 'No:', payload.documentNumber, contentWidth, 0.24);
    this.row(doc, 'Date:', this.formatDate(payload.date), contentWidth, 0.24);
    if (payload.customerName) {
      this.row(doc, 'Customer:', payload.customerName, contentWidth, 0.3);
    }
    if (payload.customerPhone) {
      this.row(doc, 'Phone:', payload.customerPhone, contentWidth, 0.24);
    }

    this.dashedRule(doc, contentWidth);

    // Line items ----------------------------------------------------------
    doc.font('Helvetica-Bold').fontSize(BODY_FONT_SIZE);
    this.row(doc, 'Item', 'Amount', contentWidth, 0.55);
    this.dottedRule(doc, contentWidth);

    for (const line of payload.lines) {
      this.drawLine(doc, line, contentWidth, payload.currency);
    }

    if (payload.lines.length === 0) {
      doc
        .font('Helvetica')
        .text('(no items)', SIDE_MARGIN, doc.y, { width: contentWidth });
    }

    this.dashedRule(doc, contentWidth);

    // Totals --------------------------------------------------------------
    doc.font('Helvetica').fontSize(BODY_FONT_SIZE);
    this.totalsRow(
      doc,
      'Subtotal',
      payload.subtotal,
      contentWidth,
      payload.currency,
    );
    if (payload.discount) {
      this.totalsRow(
        doc,
        'Discount',
        -payload.discount,
        contentWidth,
        payload.currency,
      );
    }
    if (payload.tax) {
      this.totalsRow(doc, 'Tax', payload.tax, contentWidth, payload.currency);
    }

    this.dottedRule(doc, contentWidth);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        `Total ${this.money(payload.total, payload.currency)}`,
        SIDE_MARGIN,
        doc.y,
        {
          width: contentWidth,
          align: 'right',
        },
      );

    // Payment + notes -----------------------------------------------------
    if (payload.paymentMethod) {
      this.dottedRule(doc, contentWidth);
      doc
        .font('Helvetica')
        .fontSize(BODY_FONT_SIZE)
        .text(
          `Payment: ${this.titleCase(payload.paymentMethod)}`,
          SIDE_MARGIN,
          doc.y,
          {
            width: contentWidth,
            align: 'left',
          },
        );
    }

    if (payload.notes) {
      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(BODY_FONT_SIZE)
        .text(payload.notes, SIDE_MARGIN, doc.y, { width: contentWidth });
    }

    // Footer --------------------------------------------------------------
    doc.moveDown(1.2);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('Thank you!', SIDE_MARGIN, doc.y, {
        width: contentWidth,
        align: 'center',
      });
  }

  private drawLine(
    doc: SlipDocument,
    line: ReceiptPdfLine,
    contentWidth: number,
    currency?: string | null,
  ): void {
    doc.font('Helvetica-Bold').fontSize(BODY_FONT_SIZE);
    doc.text(line.name, SIDE_MARGIN, doc.y, {
      width: contentWidth,
      align: 'left',
    });

    doc.font('Helvetica').fontSize(BODY_FONT_SIZE);
    const qtyLabel = `${this.formatQty(line.qty)} x ${this.money(line.unitPrice, currency)}`;
    this.row(
      doc,
      qtyLabel,
      this.money(line.amount, currency),
      contentWidth,
      0.55,
    );
  }

  /**
   * Print `left` and `right` on the same baseline: left flows in the first
   * column, right is pinned to the right edge of a narrower second column.
   */
  private row(
    doc: SlipDocument,
    left: string,
    right: string,
    contentWidth: number,
    leftWidthRatio: number,
  ): void {
    const y = doc.y;
    const leftWidth = Math.max(contentWidth * leftWidthRatio, 1);
    const rightWidth = Math.max(contentWidth - leftWidth, 1);

    doc.text(left, SIDE_MARGIN, y, {
      width: leftWidth,
      align: 'left',
      lineBreak: false,
    });
    doc.text(right, SIDE_MARGIN + leftWidth, y, {
      width: rightWidth,
      align: 'right',
      lineBreak: false,
    });

    doc.y = y + ROW_HEIGHT;
    doc.x = SIDE_MARGIN;
  }

  private totalsRow(
    doc: SlipDocument,
    label: string,
    value: number,
    contentWidth: number,
    currency?: string | null,
  ): void {
    this.row(doc, label, this.money(value, currency), contentWidth, 0.5);
  }

  private dashedRule(doc: SlipDocument, contentWidth: number): void {
    const y = doc.y + 2;
    doc.moveTo(SIDE_MARGIN, y).lineTo(SIDE_MARGIN + contentWidth, y);
    doc.dash(2, { space: 2 });
    doc.stroke();
    doc.undash();
    doc.y = y + 4;
    doc.x = SIDE_MARGIN;
  }

  private dottedRule(doc: SlipDocument, contentWidth: number): void {
    const y = doc.y + 1;
    doc.moveTo(SIDE_MARGIN, y).lineTo(SIDE_MARGIN + contentWidth, y);
    doc.dash(1, { space: 1 });
    doc.stroke();
    doc.undash();
    doc.y = y + 3;
    doc.x = SIDE_MARGIN;
  }

  /**
   * A tall-enough single page for the slip, estimated from the payload so short
   * receipts stay compact while long ones avoid needless blank space. pdfkit
   * paginates if the content ever exceeds the estimate.
   */
  private estimateHeight(payload: ReceiptPdfPayload): number {
    const rows =
      6 +
      payload.lines.length * 2 +
      (payload.shopAddress ? 1 : 0) +
      (payload.customerName ? 1 : 0) +
      (payload.customerPhone ? 1 : 0) +
      (payload.discount ? 1 : 0) +
      (payload.tax ? 1 : 0) +
      (payload.paymentMethod ? 1 : 0) +
      (payload.notes ? 1 : 0);
    return Math.max(280, rows * ROW_HEIGHT + SIDE_MARGIN * 2 + 40);
  }

  private money(value: number, currency?: string | null): string {
    const amount = Number.isFinite(value) ? value : 0;
    return `${currency ? `${currency} ` : ''}${amount.toFixed(2)}`;
  }

  private formatQty(qty: number): string {
    if (!Number.isFinite(qty)) return '0';
    return Number.isInteger(qty) ? String(qty) : qty.toFixed(3);
  }

  private formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return String(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  private titleCase(value: string): string {
    return value
      .split(/[\s_-]+/)
      .map((word) =>
        word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word,
      )
      .join(' ');
  }
}
