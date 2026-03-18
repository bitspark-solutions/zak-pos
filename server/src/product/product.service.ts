import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { IProductWithDetails, PaginatedResult } from './interfaces/product.interface';

@Injectable()
export class ProductService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createProductDto: CreateProductDto): Promise<IProductWithDetails> {
    const { prisma } = this.databaseService.getPrisma();

    // Check for duplicate SKU
    const existing = await prisma.product.findFirst({
      where: {
        tenantId: createProductDto.tenantId || 'tenant-1',
        sku: createProductDto.sku,
      },
    });

    if (existing) {
      throw new ConflictException(`Product with SKU ${createProductDto.sku} already exists`);
    }

    const product = await prisma.product.create({
      data: {
        name: createProductDto.name,
        sku: createProductDto.sku,
        unit: createProductDto.unit || 'pcs',
        basePrice: createProductDto.basePrice,
        defaultCost: createProductDto.defaultCost || 0,
        categoryId: createProductDto.categoryId,
        taxId: createProductDto.taxId,
        isWeighted: createProductDto.isWeighted || false,
        tenantId: createProductDto.tenantId || 'tenant-1',
      },
      include: {
        category: true,
        tax: true,
        variants: true,
        barcodes: true,
      },
    });

    return this.mapToProductWithDetails(product);
  }

  async findAll(query: ProductQueryDto, tenantId?: string): Promise<PaginatedResult<IProductWithDetails>> {
    const { prisma } = this.databaseService.getPrisma();
    const { page = 1, limit = 20, search, categoryId, isActive } = query;

    const where: Prisma.ProductWhereInput = {
      tenantId: tenantId || 'tenant-1',
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcodes: { some: { value: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          tax: true,
          variants: true,
          barcodes: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: data.map((p) => this.mapToProductWithDetails(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<IProductWithDetails> {
    const { prisma } = this.databaseService.getPrisma();

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        tax: true,
        variants: true,
        barcodes: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.mapToProductWithDetails(product);
  }

  async findByBarcode(barcode: string, tenantId?: string): Promise<IProductWithDetails | null> {
    const { prisma } = this.databaseService.getPrisma();

    const barcodeRecord = await prisma.barcode.findFirst({
      where: {
        value: barcode,
        ...(tenantId && { product: { tenantId } }),
      },
      include: {
        product: {
          include: {
            category: true,
            tax: true,
            variants: true,
            barcodes: true,
          },
        },
        variant: true,
      },
    });

    if (!barcodeRecord) {
      return null;
    }

    return this.mapToProductWithDetails(barcodeRecord.product);
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<IProductWithDetails> {
    const { prisma } = this.databaseService.getPrisma();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Check for duplicate SKU if changing
    if (updateProductDto.sku && updateProductDto.sku !== existing.sku) {
      const duplicate = await prisma.product.findFirst({
        where: {
          tenantId: existing.tenantId,
          sku: updateProductDto.sku,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(`Product with SKU ${updateProductDto.sku} already exists`);
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: {
        category: true,
        tax: true,
        variants: true,
        barcodes: true,
      },
    });

    return this.mapToProductWithDetails(product);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const { prisma } = this.databaseService.getPrisma();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Soft delete
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  private mapToProductWithDetails(
    product: Product & {
      category?: any;
      tax?: any;
      variants?: any[];
      barcodes?: any[];
    },
  ): IProductWithDetails {
    return {
      id: product.id,
      tenantId: product.tenantId,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      basePrice: Number(product.basePrice),
      defaultCost: Number(product.defaultCost),
      categoryId: product.categoryId,
      taxId: product.taxId,
      isWeighted: product.isWeighted,
      variantGroupId: product.variantGroupId,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: product.category
        ? {
            id: product.category.id,
            tenantId: product.category.tenantId,
            parentId: product.category.parentId,
            name: product.category.name,
            path: product.category.path,
            createdAt: product.category.createdAt,
            updatedAt: product.category.updatedAt,
          }
        : null,
      tax: product.tax
        ? {
            id: product.tax.id,
            tenantId: product.tax.tenantId,
            name: product.tax.name,
            ratePercent: Number(product.tax.ratePercent),
            inclusive: product.tax.inclusive,
            isActive: product.tax.isActive,
          }
        : null,
      variants: product.variants?.map((v) => ({
        id: v.id,
        productId: v.productId,
        attributes: v.attributes,
        barcode: v.barcode,
        priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
        costOverride: v.costOverride ? Number(v.costOverride) : null,
        isActive: v.isActive,
      })),
      barcodes: product.barcodes?.map((b) => ({
        id: b.id,
        productId: b.productId,
        variantId: b.variantId,
        type: b.type,
        value: b.value,
        isPrimary: b.isPrimary,
      })),
    };
  }

  // Helper to get Prisma client for transactions
  getPrismaClient() {
    return this.databaseService.getPrisma();
  }
}
