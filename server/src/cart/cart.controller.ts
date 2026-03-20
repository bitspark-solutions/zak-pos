import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import type { CreateCartDto, AddLineDto, UpdateLineDto } from './interfaces/cart.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('carts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCartDto: CreateCartDto) {
    return this.cartService.create(createCartDto);
  }

  @Get(':token')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async findByToken(@Param('token') token: string) {
    return this.cartService.findByToken(token);
  }

  @Post(':token/lines')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async addLine(
    @Param('token') token: string,
    @Body() addLineDto: AddLineDto,
  ) {
    return this.cartService.addLine(token, addLineDto);
  }

  @Put(':token/lines/:lineId')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async updateLine(
    @Param('token') token: string,
    @Param('lineId') lineId: string,
    @Body() updateLineDto: UpdateLineDto,
  ) {
    return this.cartService.updateLine(token, lineId, updateLineDto);
  }

  @Delete(':token/lines/:lineId')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async removeLine(
    @Param('token') token: string,
    @Param('lineId') lineId: string,
  ) {
    return this.cartService.removeLine(token, lineId);
  }

  @Post(':token/price')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async recalculatePrice(@Param('token') token: string) {
    return this.cartService.recalculatePrice(token);
  }

  @Post(':token/tender')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async tender(@Param('token') token: string) {
    return this.cartService.tender(token);
  }

  @Post(':token/complete')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async complete(@Param('token') token: string) {
    return this.cartService.complete(token);
  }

  @Post(':token/cancel')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async cancel(@Param('token') token: string) {
    return this.cartService.cancel(token);
  }

  @Delete(':token')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  @RequirePermissions(Permission.SALE_CREATE)
  async delete(@Param('token') token: string) {
    return this.cartService.delete(token);
  }
}
