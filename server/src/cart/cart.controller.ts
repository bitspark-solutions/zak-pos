import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import type { CreateCartDto, AddLineDto, UpdateLineDto } from './interfaces/cart.interface';

@Controller('carts')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCartDto: CreateCartDto) {
    return this.cartService.create(createCartDto);
  }

  @Get(':token')
  async findByToken(@Param('token') token: string) {
    return this.cartService.findByToken(token);
  }

  @Post(':token/lines')
  async addLine(
    @Param('token') token: string,
    @Body() addLineDto: AddLineDto,
  ) {
    return this.cartService.addLine(token, addLineDto);
  }

  @Put(':token/lines/:lineId')
  async updateLine(
    @Param('token') token: string,
    @Param('lineId') lineId: string,
    @Body() updateLineDto: UpdateLineDto,
  ) {
    return this.cartService.updateLine(token, lineId, updateLineDto);
  }

  @Delete(':token/lines/:lineId')
  async removeLine(
    @Param('token') token: string,
    @Param('lineId') lineId: string,
  ) {
    return this.cartService.removeLine(token, lineId);
  }

  @Post(':token/price')
  async recalculatePrice(@Param('token') token: string) {
    return this.cartService.recalculatePrice(token);
  }

  @Post(':token/tender')
  async tender(@Param('token') token: string) {
    return this.cartService.tender(token);
  }

  @Post(':token/complete')
  async complete(@Param('token') token: string) {
    return this.cartService.complete(token);
  }

  @Post(':token/cancel')
  async cancel(@Param('token') token: string) {
    return this.cartService.cancel(token);
  }

  @Delete(':token')
  async delete(@Param('token') token: string) {
    return this.cartService.delete(token);
  }
}
