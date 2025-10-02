-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'cashier',
ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 'tenant-1';
