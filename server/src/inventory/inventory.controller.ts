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
import { InventoryService } from './inventory.service';
import { StockQueryDto, AdjustStockDto, InventoryMovementQueryDto } from './dto/inventory.dto';
import { IInventoryWithProduct, IInventoryMovement, StockCheckResult } from './interfaces/inventory.interface';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  async getStock(@Query() query: StockQueryDto): Promise<IInventoryWithProduct[]> {
    return this.inventoryService.getStock(query);
  }

  @Post('adjust')
  async adjustStock(@Body() dto: AdjustStockDto): Promise<any> {
    return this.inventoryService.adjustStock(dto);
  }

  @Get('movements')
  async getMovements(@Query() query: InventoryMovementQueryDto): Promise<IInventoryMovement[]> {
    return this.inventoryService.getMovements(query);
  }

  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  async checkAvailability(
    @Body()
    body: {
      shopId: string;
      items: { productId: string; variantId?: string; quantity: number }[];
      tenantId?: string;
    },
  ): Promise<{ available: boolean; results: StockCheckResult[] }> {
    return this.inventoryService.checkAvailability(body.shopId, body.items);
  }
}
