export interface ICategory {
  id: string;
  tenantId: string;
  parentId?: string | null;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryTreeNode extends ICategory {
  children: CategoryTreeNode[];
}
