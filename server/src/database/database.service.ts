import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async findUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email }
    });
  }

  async findUserById(id: string) {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
    tenantId?: string;
  }) {
    return await this.prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role || 'cashier',
        tenantId: userData.tenantId || 'tenant-1',
        status: 'active',
        locale: 'en',
      }
    });
  }

  async updateUser(id: string, userData: Partial<{
    email: string;
    password: string;
    name: string;
    role: string;
    tenantId: string;
  }>) {
    return await this.prisma.user.update({
      where: { id },
      data: userData
    });
  }

  async deleteUser(id: string) {
    return await this.prisma.user.delete({
      where: { id }
    });
  }

  async findAllUsers() {
    return await this.prisma.user.findMany();
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
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
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }
}