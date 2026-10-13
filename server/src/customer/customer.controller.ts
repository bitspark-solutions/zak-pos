import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, QueryCustomersDto } from './dto/customer.dto';
import type {
  ICustomerContact,
  IPublicBusiness,
} from './interfaces/customer.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

/**
 * Staff-facing tenant-scoped customer contacts (POS checkout picker).
 *
 * Guard choice: SALE_CREATE — the picker + walk-in creation only ever run as
 * part of completing a sale, and CASHIER/MANAGER/OWNER all hold SALE_CREATE
 * (mirrors POST /sales/commit and POST /invoices/from-sale from G1a).
 * INVOICE_READ was the alternative, but cashier-side customer creation happens
 * at checkout before any invoice exists, so SALE_CREATE is the honest gate.
 * ADMIN is intentionally excluded (platform role, never operates the POS).
 */
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  findMany(
    @Query() query: QueryCustomersDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ICustomerContact[]> {
    return this.customerService.findTenantCustomers(query, tenantId);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ICustomerContact> {
    return this.customerService.createTenantCustomer(dto, tenantId);
  }
}

/**
 * Public pre-follow lookup for the QR landing screen: "who am I about to
 * follow?" Returns only safe fields (no plan/status/shops/financials), so it
 * needs no auth. Idempotent read; 404 for an unknown tenant id.
 */
@Controller('businesses')
export class BusinessController {
  constructor(private readonly customerService: CustomerService) {}

  @Get(':tenantId')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('tenantId') tenantId: string): Promise<IPublicBusiness> {
    return this.customerService.findPublicBusiness(tenantId);
  }
}
