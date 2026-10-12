import { Module } from '@nestjs/common';
import { ProductImportController } from './product-import.controller';
import { ProductImportService } from './product-import.service';
import { OcrService } from './ocr.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductImportController],
  providers: [ProductImportService, OcrService],
  exports: [ProductImportService],
})
export class ProductImportModule {}
