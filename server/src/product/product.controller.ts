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
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { IProductWithDetails, PaginatedResult } from './interfaces/product.interface';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProductDto: CreateProductDto): Promise<IProductWithDetails> {
    return this.productService.create(createProductDto);
  }

  @Get()
  async findAll(@Query() query: ProductQueryDto): Promise<PaginatedResult<IProductWithDetails>> {
    return this.productService.findAll(query, query.tenantId);
  }

  @Get('barcode/:code')
  async findByBarcode(
    @Param('code') code: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<IProductWithDetails | null> {
    return this.productService.findByBarcode(code, tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IProductWithDetails> {
    return this.productService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<IProductWithDetails> {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.productService.remove(id);
  }
}
