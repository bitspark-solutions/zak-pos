import { Module } from '@nestjs/common';
import { ReceiptPdfService } from './receipt-pdf.service';

/**
 * Standalone renderer module. `ReceiptPdfService` is a pure PDF builder (no
 * database access), so this module has no imports; it is imported by the
 * invoice and sales modules so both can render the same thermal-slip PDF.
 */
@Module({
  providers: [ReceiptPdfService],
  exports: [ReceiptPdfService],
})
export class PdfModule {}
