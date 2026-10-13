import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Header,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  CreateInvoiceFromSaleDto,
  UpdateInvoiceDto,
  InvoiceQueryDto,
} from './dto/invoice.dto';
import type { IInvoice } from './interfaces/invoice.interface';
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

  /**
   * Cashier-friendly invoice creation from a completed sale.
   *
   * Guard choice: CASHIER / MANAGER / OWNER all carry SALE_CREATE (this mirrors
   * POST /sales/commit), and it is the permission staff already have to complete
   * a sale. CASHIER does *not* hold INVOICE_CREATE, so we require SALE_CREATE
   * instead of relaxing the INVOICE_CREATE constant or inventing a new cashier
   * invoice permission. ADMIN is intentionally excluded: it is the platform
   * (tenant-management) role and holds neither SALE_CREATE nor INVOICE_CREATE,
   * so it does not operate the POS at all. Returns 201 on first create and 200
   * when an invoice already exists for the sale (idempotent).
   */
  @Post('from-sale')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async createFromSale(
    @Body() createInvoiceFromSaleDto: CreateInvoiceFromSaleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IInvoice> {
    const { invoice, created } = await this.invoiceService.createFromSale(
      createInvoiceFromSaleDto.saleId,
      userId,
      tenantId,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return invoice;
  }

  @Get()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_READ)
  findAll(@Query() query: InvoiceQueryDto, @CurrentTenant() tenantId: string) {
    return this.invoiceService.findAll(query, tenantId);
  }

  @Get(':id/pdf')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_READ)
  @Header('Content-Type', 'application/pdf')
  async getPdf(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.invoiceService.generateInvoicePdf(
      id,
      tenantId,
    );
    // Library-mode @Res: set every header explicitly so the raw PDF bytes are
    // sent as-is instead of being JSON-serialized by Nest's response pipeline.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.status(HttpStatus.OK).send(buffer);
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
