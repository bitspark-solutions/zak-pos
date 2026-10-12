import { IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import type {
  GroupByPeriod,
  TopProductsSortBy,
} from '../interfaces/reports.interface';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared 'from'/'to'/'shopId' query shape; defaults are resolved server-side. */
export class ReportRangeQueryDto {
  @IsString()
  @Matches(ISO_DATE_RE, { message: 'from must be YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @IsString()
  @Matches(ISO_DATE_RE, { message: 'to must be YYYY-MM-DD' })
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  shopId?: string;
}

/** GET /reports/sales-summary query params. */
export class SalesSummaryQueryDto extends ReportRangeQueryDto {
  @IsIn(['day', 'week', 'month'])
  @IsOptional()
  groupBy?: GroupByPeriod;
}

/**
 * GET /reports/top-products query params. `limit` is CLAMPED to 1..50 by the
 * service (out-of-range values never 400) — the contract pins clamping.
 */
export class TopProductsQueryDto extends ReportRangeQueryDto {
  @IsInt()
  @IsOptional()
  limit?: number;

  @IsIn(['revenue', 'qty'])
  @IsOptional()
  sortBy?: TopProductsSortBy;
}

/** GET /reports/inventory-valuation query params (no date range). */
export class InventoryValuationQueryDto {
  @IsString()
  @IsOptional()
  shopId?: string;
}
