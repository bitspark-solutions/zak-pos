import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import {
  barcodeTypeFor,
  slugify,
} from '../product-import/product-import.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from './dto/product.dto';
import {
  IProductWithDetails,
  IBarcode,
  PaginatedResult,
} from './interfaces/product.interface';

/**
 * Product row returned by every query in this service: the `Product` model
 * plus the `category` / `tax` / `variants` / `barcodes` includes.
 */
type ProductWithDetailsRow = Prisma.ProductGetPayload<{
  include: {
    category: true;
    tax: true;
    variants: true;
    barcodes: true;
  };
}>;

@Injectable()
export class ProductService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    createProductDto: CreateProductDto,
    tenantId: string,
  ): Promise<IProductWithDetails> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      // Normalise barcodes: trim, keep only pure-digit values, de-duplicate
      // while preserving the primary-first order (mirrors the import path).
      const barcodes = this.normalizeBarcodes(createProductDto);

      // Resolve SKU: a supplied SKU is conflict-checked, a blank/absent one is
      // generated with the same uniqueness-guaranteed scheme import uses.
      const suppliedSku = createProductDto.sku?.trim();
      let sku: string;
      if (suppliedSku) {
        const existing = await prisma.product.findFirst({
          where: {
            tenantId,
            sku: suppliedSku,
          },
        });

        if (existing) {
          throw new ConflictException(
            `Product with SKU ${suppliedSku} already exists`,
          );
        }

        sku = suppliedSku;
      } else {
        const generated = await this.generateUniqueSku(
          prisma,
          tenantId,
          createProductDto.name,
        );
        if (!generated) {
          throw new ConflictException(
            'Could not generate a unique SKU for this product',
          );
        }
        sku = generated;
      }

      // Reject barcodes already registered to another product in THIS tenant
      // up front, so the caller can open the existing product. The DB only
      // enforces [productId, value] uniqueness, so the tenant-wide check must
      // be explicit.
      for (const value of barcodes) {
        const existingBarcode = await prisma.barcode.findFirst({
          where: { value, product: { tenantId } },
        });
        if (existingBarcode) {
          throw new ConflictException(
            `Barcode ${value} is already assigned to another product`,
          );
        }
      }

      await this.validateTenantRefs(
        prisma,
        tenantId,
        createProductDto.categoryId,
        createProductDto.taxId,
      );

      const product = await prisma.product.create({
        data: {
          name: createProductDto.name,
          sku,
          unit: createProductDto.unit || 'pcs',
          basePrice: createProductDto.basePrice,
          defaultCost: createProductDto.defaultCost || 0,
          categoryId: createProductDto.categoryId,
          taxId: createProductDto.taxId,
          isWeighted: createProductDto.isWeighted || false,
          tenantId,
        },
        include: {
          category: true,
          tax: true,
          variants: true,
          barcodes: true,
        },
      });

      // Create barcode rows within the SAME transaction (atomic + RLS-scoped).
      // The first value is the primary; type is inferred from digit length.
      for (let i = 0; i < barcodes.length; i += 1) {
        const created = await prisma.barcode.create({
          data: {
            productId: product.id,
            type: barcodeTypeFor(barcodes[i]),
            value: barcodes[i],
            isPrimary: i === 0,
          },
        });
        product.barcodes.push(created);
      }

      return this.mapToProductWithDetails(product);
    });
  }

  /**
   * Collect barcode candidates from the single `barcode` field and the
   * `barcodes` array, keeping only pure-digit values in first-seen order.
   */
  private normalizeBarcodes(dto: CreateProductDto): string[] {
    const raw = [
      ...(dto.barcode ? [dto.barcode] : []),
      ...(dto.barcodes ?? []),
    ];

    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of raw) {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }
    return result;
  }

  /**
   * Generate a unique SKU for the tenant using the same scheme as the
   * product-import commit path: `{slugify(name)}-{6 hex chars}`, retried up
   * to 10 times against existing products.
   */
  private async generateUniqueSku(
    prisma: Prisma.TransactionClient,
    tenantId: string,
    name: string,
  ): Promise<string | null> {
    const slug = slugify(name);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(3).toString('hex').toUpperCase();
      const candidate = `${slug}-${suffix}`.slice(0, 64);
      const existing = await prisma.product.findFirst({
        where: { tenantId, sku: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    return null;
  }

  async findAll(
    query: ProductQueryDto,
    tenantId: string,
  ): Promise<PaginatedResult<IProductWithDetails>> {
    const { page = 1, limit = 20, search, categoryId, isActive } = query;

    const where: Prisma.ProductWhereInput = {
      tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        {
          barcodes: {
            some: { value: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.databaseService.withTenant(tenantId, async (prisma) => {
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
    });
  }

  async findOne(id: string, tenantId: string): Promise<IProductWithDetails> {
    const product = await this.databaseService.withTenant(tenantId, (prisma) =>
      prisma.product.findFirst({
        where: { id, tenantId },
        include: {
          category: true,
          tax: true,
          variants: true,
          barcodes: true,
        },
      }),
    );

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.mapToProductWithDetails(product);
  }

  async findByBarcode(
    barcode: string,
    tenantId: string,
  ): Promise<IProductWithDetails | null> {
    const barcodeRecord = await this.databaseService.withTenant(
      tenantId,
      (prisma) =>
        prisma.barcode.findFirst({
          where: {
            value: barcode,
            product: { tenantId },
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
        }),
    );

    if (!barcodeRecord) {
      return null;
    }

    return this.mapToProductWithDetails(barcodeRecord.product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    tenantId: string,
  ): Promise<IProductWithDetails> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.product.findFirst({
        where: { id, tenantId },
      });
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
          throw new ConflictException(
            `Product with SKU ${updateProductDto.sku} already exists`,
          );
        }
      }

      await this.validateTenantRefs(
        prisma,
        tenantId,
        updateProductDto.categoryId,
        updateProductDto.taxId,
      );

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
    });
  }

  /**
   * Attach an additional barcode to an existing product. The value is treated
   * like the create path (pure digits only); a value already registered to any
   * product in this tenant, or already on this product, yields a
   * ConflictException so the caller can act on the existing barcode.
   */
  async attachBarcode(
    id: string,
    rawValue: string,
    tenantId: string,
  ): Promise<IBarcode> {
    const value = rawValue.trim();
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('Barcode must contain digits only');
    }

    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const product = await prisma.product.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      const existing = await prisma.barcode.findFirst({
        where: { value, product: { tenantId } },
      });
      if (existing) {
        throw new ConflictException(
          `Barcode ${value} is already assigned to a product`,
        );
      }

      try {
        const created = await prisma.barcode.create({
          data: {
            productId: product.id,
            type: barcodeTypeFor(value),
            value,
            isPrimary: false,
          },
        });

        return {
          id: created.id,
          productId: created.productId,
          variantId: created.variantId,
          type: created.type,
          value: created.value,
          isPrimary: created.isPrimary,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            `Barcode ${value} is already assigned to this product`,
          );
        }
        throw error;
      }
    });
  }

  async remove(id: string, tenantId: string): Promise<{ success: boolean }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.product.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      // Soft delete
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      return { success: true };
    });
  }

  private async validateTenantRefs(
    prisma: Prisma.TransactionClient,
    tenantId: string,
    categoryId?: string,
    taxId?: string,
  ): Promise<void> {
    if (categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: categoryId, tenantId },
      });
      if (!cat) {
        throw new BadRequestException(
          `Category ${categoryId} does not belong to this tenant`,
        );
      }
    }
    if (taxId) {
      const tax = await prisma.tax.findFirst({
        where: { id: taxId, tenantId },
      });
      if (!tax) {
        throw new BadRequestException(
          `Tax ${taxId} does not belong to this tenant`,
        );
      }
    }
  }

  private mapToProductWithDetails(
    product: ProductWithDetailsRow,
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
        attributes: v.attributes as Record<string, string>,
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
}
