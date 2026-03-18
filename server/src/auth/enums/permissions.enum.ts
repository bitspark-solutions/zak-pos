export enum Permission {
  // User Management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // Product Management
  PRODUCT_CREATE = 'product:create',
  PRODUCT_READ = 'product:read',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',
  
  // Inventory Management
  INVENTORY_CREATE = 'inventory:create',
  INVENTORY_READ = 'inventory:read',
  INVENTORY_UPDATE = 'inventory:update',
  INVENTORY_DELETE = 'inventory:delete',
  
  // Sales Management
  SALE_CREATE = 'sale:create',
  SALE_READ = 'sale:read',
  SALE_UPDATE = 'sale:update',
  SALE_DELETE = 'sale:delete',
  
  // Reporting
  REPORT_READ = 'report:read',
  REPORT_EXPORT = 'report:export',
  
  // System Administration
  SYSTEM_ADMIN = 'system:admin',
  TENANT_MANAGE = 'tenant:manage',
}

export enum Role {
  OWNER = 'owner',
  MANAGER = 'manager',
  CASHIER = 'cashier',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    // Owner has all permissions
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.INVENTORY_CREATE,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_UPDATE,
    Permission.INVENTORY_DELETE,
    Permission.SALE_CREATE,
    Permission.SALE_READ,
    Permission.SALE_UPDATE,
    Permission.SALE_DELETE,
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
    Permission.SYSTEM_ADMIN,
    Permission.TENANT_MANAGE,
  ],
  [Role.MANAGER]: [
    // Manager has most permissions except system admin
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.INVENTORY_CREATE,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_UPDATE,
    Permission.INVENTORY_DELETE,
    Permission.SALE_CREATE,
    Permission.SALE_READ,
    Permission.SALE_UPDATE,
    Permission.SALE_DELETE,
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
  ],
  [Role.CASHIER]: [
    // Cashier has limited permissions for daily operations
    Permission.PRODUCT_READ,
    Permission.INVENTORY_READ,
    Permission.SALE_CREATE,
    Permission.SALE_READ,
    Permission.REPORT_READ,
  ],
};
