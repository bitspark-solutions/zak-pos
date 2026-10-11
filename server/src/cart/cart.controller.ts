import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import type {
  CreateCartDto,
  AddLineDto,
  UpdateLineDto,
} from './interfaces/cart.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('carts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCartDto: CreateCartDto,
    @CurrentTenant() tenantId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.cartService.create(createCartDto, tenantId, userId);
  }

  @Get(':token')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async findByToken(
    @Param('token') token: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.findByToken(token, tenantId);
  }

  @Post(':token/lines')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async addLine(
    @Param('token') token: string,
    @Body() addLineDto: AddLineDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.addLine(token, addLineDto, tenantId);
  }

  @Put(':token/lines/:lineId')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async updateLine(
    @Param('token') token: string,
    @Param('lineId') lineId: string,
    @Body() updateLineDto: UpdateLineDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.updateLine(token, lineId, updateLineDto, tenantId);
  }

  @Delete(':token/lines/:lineId')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async removeLine(
    @Param('token') token: string,
    @Param('lineId') lineId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.removeLine(token, lineId, tenantId);
  }

  @Post(':token/price')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async recalculatePrice(
    @Param('token') token: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.recalculatePrice(token, tenantId);
  }

  @Post(':token/tender')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async tender(
    @Param('token') token: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.tender(token, tenantId);
  }

  @Post(':token/complete')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async complete(
    @Param('token') token: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.complete(token, tenantId);
  }

  @Post(':token/cancel')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async cancel(
    @Param('token') token: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.cancel(token, tenantId);
  }

  @Delete(':token')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async delete(
    @Param('token') token: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cartService.delete(token, tenantId);
  }
}
