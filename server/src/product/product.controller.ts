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
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { IProductWithDetails, PaginatedResult } from './interfaces/product.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IProductWithDetails> {
    return this.productService.create(createProductDto, tenantId);
  }

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async findAll(
    @Query() query: ProductQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<PaginatedResult<IProductWithDetails>> {
    return this.productService.findAll(query, tenantId);
  }

  @Get('barcode/:code')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async findByBarcode(
    @Param('code') code: string,
    @CurrentTenant() tenantId: string,
  ): Promise<IProductWithDetails | null> {
    return this.productService.findByBarcode(code, tenantId);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<IProductWithDetails> {
    return this.productService.findOne(id, tenantId);
  }

  @Put(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentTenant() tenantId: string,
  ): Promise<IProductWithDetails> {
    return this.productService.update(id, updateProductDto, tenantId);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean }> {
    return this.productService.remove(id, tenantId);
  }
}
