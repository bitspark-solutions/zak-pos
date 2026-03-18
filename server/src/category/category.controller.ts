import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoryService, CreateCategoryDto, UpdateCategoryDto, CategoryTreeNode } from './category.service';
import { ICategory } from './interfaces/category.interface';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<ICategory> {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  async findAll(@Query('tenantId') tenantId?: string): Promise<ICategory[]> {
    return this.categoryService.findAll(tenantId);
  }

  @Get('tree')
  async findTree(@Query('tenantId') tenantId?: string): Promise<CategoryTreeNode[]> {
    return this.categoryService.findTree(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ICategory> {
    return this.categoryService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<ICategory> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.categoryService.remove(id);
  }
}
