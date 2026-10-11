import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private databaseService: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // ADMIN-PATH (RLS-bypassing) methods — used by auth.service.ts / auth.controller.ts
  // for login + registration, which are cross-tenant by design (no tenant context
  // exists yet on those flows). Do NOT route these through withTenant.
  // ---------------------------------------------------------------------------

  async create(createUserDto: CreateUserDto, tenantId: string) {
    const user = await this.databaseService.createUser({
      email: createUserDto.email,
      password: createUserDto.password,
      name: createUserDto.name,
      role: createUserDto.role,
      tenantId,
      externalId: createUserDto.externalId,
    });

    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string) {
    return await this.databaseService.findUserByEmail(email);
  }

  async count() {
    const users = await this.databaseService.findAllUsers();
    return users.length;
  }

  // ---------------------------------------------------------------------------
  // TENANT-PATH (RLS via withTenant) methods — staff management from UsersController.
  // tenantId filters stay in the where clauses as defense in depth.
  // ---------------------------------------------------------------------------

  async createForTenant(createUserDto: CreateUserDto, tenantId: string) {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: createUserDto.email,
          password: createUserDto.password,
          name: createUserDto.name,
          phone: createUserDto.phone,
          role: createUserDto.role || 'cashier',
          tenantId,
          externalId: createUserDto.externalId,
          status: 'active',
          locale: 'en',
        },
      });

      const { password, ...result } = user;
      return result;
    });
  }

  async findAll(tenantId: string) {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const users = await prisma.user.findMany({ where: { tenantId } });
      return users.map(({ password, ...user }) => user);
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const user = await prisma.user.findFirst({ where: { id, tenantId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      const { password, ...result } = user;
      return result;
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId: string) {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.user.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
      const { password, ...result } = user;
      return result;
    });
  }

  async remove(id: string, tenantId: string) {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.user.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const user = await prisma.user.delete({ where: { id } });
      const { password, ...result } = user;
      return result;
    });
  }
}
