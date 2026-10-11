import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import type { CommitSaleDto, RefundSaleDto } from './interfaces/sales.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('commit')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async commit(
    @Body() commitSaleDto: CommitSaleDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.salesService.commitSale(commitSaleDto, tenantId);
  }

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_READ)
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.salesService.findAll(tenantId, shopId);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_READ)
  async findById(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.salesService.findById(id, tenantId);
  }

  @Get(':id/details')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_READ)
  async findByIdWithLines(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.salesService.findByIdWithLines(id, tenantId);
  }

  @Post(':id/refund')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.SALE_UPDATE)
  async refund(
    @Param('id') id: string,
    @Body() refundSaleDto: RefundSaleDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.salesService.refund(id, refundSaleDto, tenantId);
  }
}
