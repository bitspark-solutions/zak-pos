import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private databaseService: DatabaseService) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.databaseService.createUser({
      email: createUserDto.email,
      password: createUserDto.password,
      name: createUserDto.name,
      role: createUserDto.role,
      tenantId: createUserDto.tenantId,
    });
    
    const { password, ...result } = user;
    return result;
  }

  async findAll() {
    return await this.databaseService.findAllUsers();
  }

  async findOne(id: string) {
    const user = await this.databaseService.findUserById(id);
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async findByEmail(email: string) {
    return await this.databaseService.findUserByEmail(email);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.databaseService.updateUser(id, updateUserDto);
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async remove(id: string) {
    const user = await this.databaseService.deleteUser(id);
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async count() {
    const users = await this.databaseService.findAllUsers();
    return users.length;
  }
}

