import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AskService } from './ask.service';
import {
  InventoryValuationQueryDto,
  ReportRangeQueryDto,
  SalesSummaryQueryDto,
  TopProductsQueryDto,
} from './dto/report-query.dto';
import { AskReportDto } from './dto/ask.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type {
  AskReportResponse,
  InventoryValuationReport,
  PaymentMethodsReport,
  SalesByCategoryReport,
  SalesSummaryReport,
  TopProductsReport,
} from './interfaces/reports.interface';

/**
 * Read-only reports over sales/payments/inventory, plus the NL entry point.
 *
 * Access note: the ROLE_PERMISSIONS matrix grants REPORT_READ to the cashier
 * role as well (see auth/enums/permissions.enum.ts), but these endpoints are
 * deliberately pinned to OWNER/MANAGER with @Roles — mirroring the receipts
 * module's conservative role pairing on top of the permission check.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly askService: AskService,
  ) {}

  @Get('sales-summary')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async salesSummary(
    @Query() query: SalesSummaryQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<SalesSummaryReport> {
    return this.reportsService.getSalesSummary(query, tenantId);
  }

  @Get('top-products')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async topProducts(
    @Query() query: TopProductsQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<TopProductsReport> {
    return this.reportsService.getTopProducts(query, tenantId);
  }

  @Get('sales-by-category')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async salesByCategory(
    @Query() query: ReportRangeQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<SalesByCategoryReport> {
    return this.reportsService.getSalesByCategory(query, tenantId);
  }

  @Get('payment-methods')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async paymentMethods(
    @Query() query: ReportRangeQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<PaymentMethodsReport> {
    return this.reportsService.getPaymentMethods(query, tenantId);
  }

  @Get('inventory-valuation')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  async inventoryValuation(
    @Query() query: InventoryValuationQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<InventoryValuationReport> {
    return this.reportsService.getInventoryValuation(query, tenantId);
  }

  @Post('ask')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.REPORT_READ)
  @HttpCode(HttpStatus.OK)
  async ask(
    @Body() dto: AskReportDto,
    @CurrentTenant() tenantId: string,
  ): Promise<AskReportResponse> {
    return this.askService.ask(dto, tenantId);
  }
}
