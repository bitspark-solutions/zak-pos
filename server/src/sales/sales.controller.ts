import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import type { CommitSaleDto, RefundSaleDto } from './interfaces/sales.interface';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('commit')
  @HttpCode(HttpStatus.CREATED)
  async commit(@Body() commitSaleDto: CommitSaleDto) {
    return this.salesService.commitSale(commitSaleDto);
  }

  @Get()
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.salesService.findAll(tenantId, shopId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.salesService.findById(id);
  }

  @Get(':id/details')
  async findByIdWithLines(@Param('id') id: string) {
    return this.salesService.findByIdWithLines(id);
  }

  @Post(':id/refund')
  async refund(
    @Param('id') id: string,
    @Body() refundSaleDto: RefundSaleDto,
  ) {
    return this.salesService.refund(id, refundSaleDto);
  }
}
