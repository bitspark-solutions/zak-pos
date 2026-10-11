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
  TENANT_CREATE = 'tenant:create',

  // Invoice Management
  INVOICE_CREATE = 'invoice:create',
  INVOICE_READ = 'invoice:read',
  INVOICE_UPDATE = 'invoice:update',
  INVOICE_DELETE = 'invoice:delete',
  INVOICE_SEND = 'invoice:send',
  INVOICE_CONFIRM = 'invoice:confirm',
}

export enum Role {
  ADMIN = 'admin', // Platform admin - manages tenants/owners
  OWNER = 'owner', // Business owner
  MANAGER = 'manager', // Employee - manages products/orders
  CASHIER = 'cashier', // POS operator
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    // Admin manages tenants and owners - no operational permissions
    Permission.USER_CREATE, // Can create owners
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.TENANT_CREATE, // Can create new tenants/companies
    Permission.TENANT_MANAGE,
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
    Permission.SYSTEM_ADMIN,
  ],
  [Role.OWNER]: [
    // Owner has all business permissions
    Permission.USER_CREATE, // Can create managers/cashiers
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
    Permission.INVOICE_CREATE,
    Permission.INVOICE_READ,
    Permission.INVOICE_UPDATE,
    Permission.INVOICE_DELETE,
    Permission.INVOICE_SEND,
    Permission.INVOICE_CONFIRM,
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
    Permission.TENANT_MANAGE,
  ],
  [Role.MANAGER]: [
    // Manager manages products and orders - NO user creation
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
    Permission.INVOICE_CREATE,
    Permission.INVOICE_READ,
    Permission.INVOICE_UPDATE,
    Permission.INVOICE_DELETE,
    Permission.INVOICE_SEND,
    Permission.INVOICE_CONFIRM,
    Permission.REPORT_READ,
  ],
  [Role.CASHIER]: [
    // Cashier has limited permissions - receive/confirm invoices, POS operations
    Permission.PRODUCT_READ,
    Permission.INVENTORY_READ,
    Permission.SALE_CREATE,
    Permission.SALE_READ,
    Permission.INVOICE_READ,
    Permission.INVOICE_SEND,
    Permission.INVOICE_CONFIRM,
    Permission.REPORT_READ,
  ],
};
