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
import { CategoryService } from './category.service';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryTreeNode,
} from './category.service';
import type { ICategory } from './interfaces/category.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ICategory> {
    return this.categoryService.create(createCategoryDto, tenantId);
  }

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async findAll(@CurrentTenant() tenantId: string): Promise<ICategory[]> {
    return this.categoryService.findAll(tenantId);
  }

  @Get('tree')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async findTree(
    @CurrentTenant() tenantId: string,
  ): Promise<CategoryTreeNode[]> {
    return this.categoryService.findTree(tenantId);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ICategory> {
    return this.categoryService.findOne(id, tenantId);
  }

  @Put(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ICategory> {
    return this.categoryService.update(id, updateCategoryDto, tenantId);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean }> {
    return this.categoryService.remove(id, tenantId);
  }
}
