import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { DatabaseModule } from '../database/database.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [DatabaseModule, PdfModule],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
