import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CustomerService } from './customer.service';
import { CreateFollowDto } from './dto/customer-me.dto';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { CurrentAccountId } from './decorators/current-account-id.decorator';
import type {
  ICustomerFollowSummary,
  ICustomerPortalInvoice,
} from './interfaces/customer.interface';

/**
 * Everything the logged-in customer sees about themselves. Guarded by the
 * CUSTOMER audience JWT (CustomerJwtAuthGuard); staff tokens are rejected by
 * CustomerJwtStrategy, so the INVOICE_READ staff guard is never reachable
 * here — hence the customer-scoped PDF route below.
 */
@Controller('me')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerMeController {
  constructor(private readonly customerService: CustomerService) {}

  // --- follows ---

  /** Idempotent follow (QR scan). Re-scanning an already-followed business returns 200 with the same shape. */
  @Post('follows')
  @HttpCode(HttpStatus.OK)
  follow(
    @CurrentAccountId() accountId: string,
    @Body() dto: CreateFollowDto,
  ): Promise<ICustomerFollowSummary> {
    return this.customerService.followBusiness(accountId, dto.tenantId);
  }

  @Get('follows')
  listFollows(
    @CurrentAccountId() accountId: string,
  ): Promise<ICustomerFollowSummary[]> {
    return this.customerService.listFollows(accountId);
  }

  /** Unfollow = deactivate (not hard-delete); 404 when not currently followed. */
  @Delete('follows/:tenantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(
    @CurrentAccountId() accountId: string,
    @Param('tenantId') tenantId: string,
  ): Promise<void> {
    return this.customerService.unfollowBusiness(accountId, tenantId);
  }

  // --- shared invoices portal ---

  @Get('invoices')
  listInvoices(
    @CurrentAccountId() accountId: string,
  ): Promise<ICustomerPortalInvoice[]> {
    return this.customerService.listSharedInvoices(accountId);
  }

  // Register the pdf route BEFORE ':id' so the suffix is not swallowed as an id.
  @Get('invoices/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async invoicePdf(
    @CurrentAccountId() accountId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.customerService.getSharedInvoicePdf(
      accountId,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('invoices/:id')
  invoice(
    @CurrentAccountId() accountId: string,
    @Param('id') id: string,
  ): Promise<ICustomerPortalInvoice> {
    return this.customerService.getSharedInvoice(accountId, id);
  }
}
