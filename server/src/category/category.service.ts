import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Category } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { ICategory } from './interfaces/category.interface';

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string;
}

export interface CategoryTreeNode extends ICategory {
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    tenantId: string,
  ): Promise<ICategory> {
    // All reads and writes share one RLS-scoped transaction.
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      // Build path
      let path = createCategoryDto.name.toLowerCase().replace(/\s+/g, '-');
      if (createCategoryDto.parentId) {
        const parent = await prisma.category.findFirst({
          where: { id: createCategoryDto.parentId, tenantId },
        });
        if (!parent) {
          throw new NotFoundException('Parent category not found');
        }
        path = `${parent.path}/${path}`;
      }

      const category = await prisma.category.create({
        data: {
          name: createCategoryDto.name,
          parentId: createCategoryDto.parentId,
          path,
          tenantId,
        },
      });

      return this.mapToCategory(category);
    });
  }

  async findAll(tenantId: string): Promise<ICategory[]> {
    const categories = await this.databaseService.withTenant(
      tenantId,
      (prisma) =>
        prisma.category.findMany({
          where: {
            tenantId,
          },
          orderBy: { path: 'asc' },
        }),
    );

    return categories.map((c) => this.mapToCategory(c));
  }

  async findTree(tenantId: string): Promise<CategoryTreeNode[]> {
    const categories = await this.findAll(tenantId);
    return this.buildTree(categories);
  }

  async findOne(id: string, tenantId: string): Promise<ICategory> {
    const category = await this.databaseService.withTenant(tenantId, (prisma) =>
      prisma.category.findFirst({
        where: { id, tenantId },
      }),
    );

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.mapToCategory(category);
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    tenantId: string,
  ): Promise<ICategory> {
    // Validation read + path rebuild + update share one RLS-scoped transaction.
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.category.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // If changing parent, rebuild path
      let path = existing.path;
      if (updateCategoryDto.parentId !== undefined) {
        if (updateCategoryDto.parentId === null) {
          // Moving to root
          path = updateCategoryDto.name
            ? updateCategoryDto.name.toLowerCase().replace(/\s+/g, '-')
            : existing.name.toLowerCase().replace(/\s+/g, '-');
        } else {
          const parent = await prisma.category.findFirst({
            where: { id: updateCategoryDto.parentId, tenantId },
          });
          if (!parent) {
            throw new NotFoundException('Parent category not found');
          }
          const name = updateCategoryDto.name || existing.name;
          path = `${parent.path}/${name.toLowerCase().replace(/\s+/g, '-')}`;
        }
      } else if (updateCategoryDto.name) {
        const parentPath = existing.path.substring(
          0,
          existing.path.lastIndexOf('/'),
        );
        path = parentPath
          ? `${parentPath}/${updateCategoryDto.name.toLowerCase().replace(/\s+/g, '-')}`
          : updateCategoryDto.name.toLowerCase().replace(/\s+/g, '-');
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          ...updateCategoryDto,
          path,
        },
      });

      return this.mapToCategory(category);
    });
  }

  async remove(id: string, tenantId: string): Promise<{ success: boolean }> {
    // Existence check + children/products guards + delete share one RLS-scoped transaction.
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.category.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // Check for children
      const children = await prisma.category.findMany({
        where: { parentId: id, tenantId },
      });

      if (children.length > 0) {
        throw new ConflictException(
          'Cannot delete category with children. Delete children first.',
        );
      }

      // Check for products
      const products = await prisma.product.count({
        where: { categoryId: id },
      });

      if (products > 0) {
        throw new ConflictException(
          'Cannot delete category with products. Remove products first.',
        );
      }

      await prisma.category.delete({ where: { id } });
      return { success: true };
    });
  }

  private buildTree(categories: ICategory[]): CategoryTreeNode[] {
    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // First pass: create nodes
    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  private mapToCategory(category: Category): ICategory {
    return {
      id: category.id,
      tenantId: category.tenantId,
      parentId: category.parentId,
      name: category.name,
      path: category.path,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
