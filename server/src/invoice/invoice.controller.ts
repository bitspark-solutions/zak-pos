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
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.INVOICE_CREATE)
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    // TODO: Get userId from @CurrentUser() decorator
    return this.invoiceService.create(createInvoiceDto, 'system');
  }

  @Get()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_READ)
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoiceService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_READ)
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.INVOICE_UPDATE)
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoiceService.update(id, updateInvoiceDto);
  }

  @Post(':id/send')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_SEND)
  @HttpCode(HttpStatus.OK)
  send(@Param('id') id: string) {
    return this.invoiceService.send(id);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVOICE_CONFIRM)
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id') id: string) {
    return this.invoiceService.confirm(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  @RequirePermissions(Permission.INVOICE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('id') id: string) {
    return this.invoiceService.cancel(id);
  }
}
