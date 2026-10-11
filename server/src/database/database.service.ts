import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private prisma: PrismaClient;
  private appPrisma: PrismaClient;

  constructor() {
    // Admin client: connects as the postgres table owner — intentionally BYPASSES RLS.
    // Used only for auth/login/registration, tenant provisioning, and health checks.
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // App client: connects as the non-superuser zakpos_app role so RLS policies apply.
    const appUrl = process.env.DATABASE_APP_URL;
    if (!appUrl) {
      throw new Error(
        'DATABASE_APP_URL is required — the RLS-enforced app client connects as the non-superuser zakpos_app role',
      );
    }
    this.appPrisma = new PrismaClient({
      datasources: {
        db: {
          url: appUrl,
        },
      },
    });
  }

  // admin client — bypasses RLS; auth/provisioning only
  getPrisma() {
    return { prisma: this.prisma };
  }

  // RLS-scoped; always prefer this
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!tenantId) {
      throw new Error('withTenant requires a tenantId');
    }
    return this.appPrisma.$transaction(async (tx) => {
      // set_config(..., true) = SET LOCAL: the GUC is scoped to this transaction,
      // making it safe to reuse the pooled connection afterwards.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  async findUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
    tenantId: string;
    externalId?: string;
  }) {
    return await this.prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role || 'cashier',
        tenantId: userData.tenantId,
        externalId: userData.externalId,
        status: 'active',
        locale: 'en',
      },
    });
  }

  async updateUser(
    id: string,
    userData: Partial<{
      email: string;
      password: string;
      name: string;
      role: string;
      tenantId: string;
      externalId: string;
      status: string;
    }>,
  ) {
    return await this.prisma.user.update({
      where: { id },
      data: userData,
    });
  }

  async deleteUser(id: string) {
    return await this.prisma.user.delete({
      where: { id },
    });
  }

  async findAllUsers() {
    return await this.prisma.user.findMany();
  }

  async findUsersByTenant(tenantId: string) {
    return await this.prisma.user.findMany({
      where: { tenantId },
    });
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  getConnectionInfo() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
    };
  }

  async testConnection() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'connected', message: 'Database connection successful' };
    } catch (error) {
      throw new Error(
        `Database connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    await this.appPrisma.$disconnect();
  }
}
