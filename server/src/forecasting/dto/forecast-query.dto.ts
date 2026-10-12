import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { FORECAST_RISKS } from '../interfaces/forecast.interface';
import type { ForecastRisk } from '../interfaces/forecast.interface';

/**
 * GET /forecast query params. `horizonDays` is CLAMPED to 3..90 by the
 * service (out-of-range values never 400) — the contract pins clamping.
 * `risk` filters computed rows AFTER the forecast pass.
 */
export class ForecastQueryDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsInt()
  @IsOptional()
  horizonDays?: number;

  @IsIn(FORECAST_RISKS)
  @IsOptional()
  risk?: ForecastRisk;

  @IsString()
  @IsOptional()
  search?: string;
}

/** GET /forecast/product/:productId query params (tenant-wide, no shopId). */
export class ProductForecastQueryDto {
  @IsInt()
  @IsOptional()
  horizonDays?: number;
}
