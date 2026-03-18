import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ICategory } from './interfaces/category.interface';

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  tenantId?: string;
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

  async create(createCategoryDto: CreateCategoryDto): Promise<ICategory> {
    const { prisma } = this.databaseService.getPrisma();
    const tenantId = createCategoryDto.tenantId || 'tenant-1';

    // Build path
    let path = createCategoryDto.name.toLowerCase().replace(/\s+/g, '-');
    if (createCategoryDto.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: createCategoryDto.parentId },
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
  }

  async findAll(tenantId?: string): Promise<ICategory[]> {
    const { prisma } = this.databaseService.getPrisma();

    const categories = await prisma.category.findMany({
      where: {
        tenantId: tenantId || 'tenant-1',
      },
      orderBy: { path: 'asc' },
    });

    return categories.map((c) => this.mapToCategory(c));
  }

  async findTree(tenantId?: string): Promise<CategoryTreeNode[]> {
    const categories = await this.findAll(tenantId);
    return this.buildTree(categories);
  }

  async findOne(id: string): Promise<ICategory> {
    const { prisma } = this.databaseService.getPrisma();

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.mapToCategory(category);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<ICategory> {
    const { prisma } = this.databaseService.getPrisma();

    const existing = await prisma.category.findUnique({ where: { id } });
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
        const parent = await prisma.category.findUnique({
          where: { id: updateCategoryDto.parentId },
        });
        if (!parent) {
          throw new NotFoundException('Parent category not found');
        }
        const name = updateCategoryDto.name || existing.name;
        path = `${parent.path}/${name.toLowerCase().replace(/\s+/g, '-')}`;
      }
    } else if (updateCategoryDto.name) {
      const parentPath = existing.path.substring(0, existing.path.lastIndexOf('/'));
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
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const { prisma } = this.databaseService.getPrisma();

    // Check for children
    const children = await prisma.category.findMany({
      where: { parentId: id },
    });

    if (children.length > 0) {
      throw new ConflictException('Cannot delete category with children. Delete children first.');
    }

    // Check for products
    const products = await prisma.product.count({
      where: { categoryId: id },
    });

    if (products > 0) {
      throw new ConflictException('Cannot delete category with products. Remove products first.');
    }

    await prisma.category.delete({ where: { id } });
    return { success: true };
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

  private mapToCategory(category: any): ICategory {
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
