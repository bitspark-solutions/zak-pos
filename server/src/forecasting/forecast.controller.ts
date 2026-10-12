import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import {
  ForecastQueryDto,
  ProductForecastQueryDto,
} from './dto/forecast-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type {
  ForecastListResponse,
  ProductForecastResponse,
} from './interfaces/forecast.interface';

/**
 * Phase F demand forecasting — read-only, computed on the fly from sales
 * history plus current stock (no forecast tables, no cron).
 *
 * Access note: there is no dedicated forecast permission; the endpoints
 * reuse REPORT_READ and stay pinned to OWNER/MANAGER — mirroring the
 * reports module's guard stack.
 */
@Controller('forecast')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('product/:productId')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async productForecast(
    @Param('productId') productId: string,
    @Query() query: ProductForecastQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductForecastResponse> {
    return this.forecastService.getProductForecast(productId, query, tenantId);
  }

  @Get()
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async forecast(
    @Query() query: ForecastQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ForecastListResponse> {
    return this.forecastService.getForecast(query, tenantId);
  }
}
