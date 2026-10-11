import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  StockQueryDto,
  AdjustStockDto,
  InventoryMovementQueryDto,
} from './dto/inventory.dto';
import {
  IInventoryWithProduct,
  IInventoryMovement,
  StockCheckResult,
} from './interfaces/inventory.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVENTORY_READ)
  async getStock(
    @Query() query: StockQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IInventoryWithProduct[]> {
    return this.inventoryService.getStock(query, tenantId);
  }

  @Post('adjust')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.INVENTORY_UPDATE)
  @HttpCode(HttpStatus.OK)
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @CurrentTenant() tenantId: string,
    @CurrentUserId() userId: string,
  ): Promise<any> {
    return this.inventoryService.adjustStock(dto, tenantId, userId);
  }

  @Get('movements')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.INVENTORY_READ)
  async getMovements(
    @Query() query: InventoryMovementQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IInventoryMovement[]> {
    return this.inventoryService.getMovements(query, tenantId);
  }

  @Post('check-availability')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.INVENTORY_READ)
  @HttpCode(HttpStatus.OK)
  async checkAvailability(
    @Body()
    body: {
      shopId: string;
      items: { productId: string; variantId?: string; quantity: number }[];
    },
    @CurrentTenant() tenantId: string,
  ): Promise<{ available: boolean; results: StockCheckResult[] }> {
    return this.inventoryService.checkAvailability(
      body.shopId,
      body.items,
      tenantId,
    );
  }
}
