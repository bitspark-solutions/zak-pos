import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { OcrService } from '../product-import/ocr.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, OcrService],
})
export class ReceiptsModule {}
