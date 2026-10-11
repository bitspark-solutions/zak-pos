import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceQueryDto } from './dto/invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.INVOICE_CREATE)
  create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentTenant() tenantId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.invoiceService.create(createInvoiceDto, userId, tenantId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_READ)
  findAll(@Query() query: InvoiceQueryDto, @CurrentTenant() tenantId: string) {
    return this.invoiceService.findAll(query, tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_READ)
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.invoiceService.findOne(id, tenantId);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.INVOICE_UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.invoiceService.update(id, updateInvoiceDto, tenantId);
  }

  @Post(':id/send')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_SEND)
  @HttpCode(HttpStatus.OK)
  send(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.invoiceService.send(id, tenantId);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_CONFIRM)
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.invoiceService.confirm(id, tenantId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  @RequirePermissions(Permission.INVOICE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.invoiceService.cancel(id, tenantId);
  }
}
