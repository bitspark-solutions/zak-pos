import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { DatabaseModule } from '../database/database.module';

/**
 * Phase F forecasting: two read-only endpoints over sales/inventory.
 * Stateless by design — every read goes through DatabaseService.withTenant
 * (DB-enforced RLS); forecasts are recomputed per request, nothing persists.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ForecastController],
  providers: [ForecastService],
})
export class ForecastingModule {}
