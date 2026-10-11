import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShopsService } from './shops.service';
import { CreateShopDto, ShopQueryDto, UpdateShopDto } from './dto/shop.dto';
import { IShop, PaginatedShopsResult } from './interfaces/shop.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('shops')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_READ)
  async findAll(
    @Query() query: ShopQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<PaginatedShopsResult> {
    return this.shopsService.findAll(tenantId, query.search);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.SALE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createShopDto: CreateShopDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IShop> {
    return this.shopsService.create(createShopDto, tenantId);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_READ)
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<IShop> {
    return this.shopsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.SALE_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() updateShopDto: UpdateShopDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IShop> {
    return this.shopsService.update(id, updateShopDto, tenantId);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.SALE_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean }> {
    return this.shopsService.remove(id, tenantId);
  }
}
