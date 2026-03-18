import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
