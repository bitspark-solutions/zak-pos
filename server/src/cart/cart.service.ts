import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { PricingService } from '../pricing/pricing.service';
import { ProductService } from '../product/product.service';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../redis/redis.service';
import type { IProductWithDetails } from '../product/interfaces/product.interface';
import {
  Cart,
  CartLine,
  CreateCartDto,
  AddLineDto,
  UpdateLineDto,
} from './interfaces/cart.interface';

const CART_TTL_SECONDS = 3600; // 1 hour

@Injectable()
export class CartService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pricingService: PricingService,
    private readonly productService: ProductService,
    private readonly inventoryService: InventoryService,
    private readonly redis: RedisService,
  ) {}

  private cartKey(token: string): string {
    return `cart:${token}`;
  }

  private async loadCart(token: string): Promise<Cart | null> {
    const raw = await this.redis.getJson<Cart>(this.cartKey(token));
    if (!raw) return null;
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      expiresAt: new Date(raw.expiresAt),
    };
  }

  private async saveCart(cart: Cart): Promise<void> {
    const ttl = Math.max(
      1,
      Math.floor((cart.expiresAt.getTime() - Date.now()) / 1000),
    );
    await this.redis.setJson(this.cartKey(cart.token), cart, ttl);
  }

  async create(
    createCartDto: CreateCartDto,
    tenantId: string,
    cashierId: string,
  ): Promise<Cart> {
    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CART_TTL_SECONDS * 1000);

    const cart: Cart = {
      id: randomUUID(),
      token,
      tenantId,
      shopId: createCartDto.shopId,
      customerId: createCartDto.customerId,
      cashierId,
      status: 'active',
      lines: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    await this.saveCart(cart);
    return cart;
  }

  async findByToken(token: string, tenantId: string): Promise<Cart> {
    const cart = await this.loadCart(token);

    if (!cart || cart.tenantId !== tenantId) {
      throw new NotFoundException('Cart not found');
    }

    // Check expiration
    if (new Date() > cart.expiresAt) {
      await this.redis.del(this.cartKey(token));
      throw new NotFoundException('Cart expired');
    }

    return cart;
  }

  async addLine(
    token: string,
    addLineDto: AddLineDto,
    tenantId: string,
  ): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);

    if (cart.status !== 'active') {
      throw new BadRequestException('Cannot modify tendered or completed cart');
    }

    // Get product details
    let product: IProductWithDetails | null;
    if (addLineDto.barcode) {
      product = await this.productService.findByBarcode(
        addLineDto.barcode,
        cart.tenantId,
      );
    } else {
      product = await this.productService.findOne(
        addLineDto.productId,
        cart.tenantId,
      );
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Determine price
    let unitPrice: number;
    if (addLineDto.unitPrice !== undefined) {
      unitPrice = addLineDto.unitPrice;
    } else if (addLineDto.variantId && product.variants) {
      const variant = product.variants.find(
        (v) => v.id === addLineDto.variantId,
      );
      unitPrice = variant?.priceOverride
        ? Number(variant.priceOverride)
        : Number(product.basePrice);
    } else {
      unitPrice = Number(product.basePrice);
    }

    // Check stock availability
    const stockCheck = await this.inventoryService.checkAvailability(
      cart.shopId,
      [
        {
          productId: product.id,
          variantId: addLineDto.variantId,
          quantity: addLineDto.qty,
        },
      ],
      cart.tenantId,
    );

    if (!stockCheck.available) {
      throw new BadRequestException('Insufficient stock');
    }

    // Check if line already exists
    const existingLineIndex = cart.lines.findIndex(
      (l) =>
        l.productId === product.id &&
        l.variantId === (addLineDto.variantId || undefined),
    );

    if (existingLineIndex >= 0) {
      // Update existing line
      const existingLine = cart.lines[existingLineIndex];
      existingLine.qty += addLineDto.qty;

      // Recalculate line totals
      const priceCalc = await this.pricingService.calculateLinePrice(
        existingLine.unitPrice,
        existingLine.qty,
        existingLine.discount,
        addLineDto.taxId || product.taxId || undefined,
        cart.tenantId,
      );
      existingLine.lineTotal = priceCalc.lineTotal;
      existingLine.taxAmount = priceCalc.taxAmount;
    } else {
      // Add new line
      const taxId = addLineDto.taxId || product.taxId || undefined;
      const priceCalc = await this.pricingService.calculateLinePrice(
        unitPrice,
        addLineDto.qty,
        addLineDto.discount || 0,
        taxId,
        cart.tenantId,
      );

      const newLine: CartLine = {
        id: randomUUID(),
        productId: product.id,
        variantId: addLineDto.variantId,
        productName: product.name,
        sku: product.sku,
        barcode: addLineDto.barcode,
        qty: addLineDto.qty,
        unitPrice,
        discount: addLineDto.discount || 0,
        taxId,
        taxRate: product.tax ? Number(product.tax.ratePercent) : undefined,
        taxAmount: priceCalc.taxAmount,
        lineTotal: priceCalc.lineTotal,
      };

      cart.lines.push(newLine);
    }

    // Recalculate cart totals
    await this.recalculateCart(cart);

    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async updateLine(
    token: string,
    lineId: string,
    updateLineDto: UpdateLineDto,
    tenantId: string,
  ): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);

    if (cart.status !== 'active') {
      throw new BadRequestException('Cannot modify tendered or completed cart');
    }

    const lineIndex = cart.lines.findIndex((l) => l.id === lineId);
    if (lineIndex < 0) {
      throw new NotFoundException('Line not found');
    }

    const line = cart.lines[lineIndex];
    let lineWasRemoved = false;

    if (updateLineDto.qty !== undefined) {
      if (updateLineDto.qty <= 0) {
        // Remove line
        cart.lines.splice(lineIndex, 1);
        lineWasRemoved = true;
      } else {
        line.qty = updateLineDto.qty;
      }
    }

    if (updateLineDto.unitPrice !== undefined) {
      line.unitPrice = updateLineDto.unitPrice;
    }

    if (updateLineDto.discount !== undefined) {
      line.discount = updateLineDto.discount;
    }

    // Only recalculate line price if line was not removed
    if (!lineWasRemoved) {
      // Recalculate line
      const priceCalc = await this.pricingService.calculateLinePrice(
        line.unitPrice,
        line.qty,
        line.discount,
        line.taxId,
        cart.tenantId,
      );
      line.lineTotal = priceCalc.lineTotal;
      line.taxAmount = priceCalc.taxAmount;
    }

    // Recalculate cart totals
    await this.recalculateCart(cart);

    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async removeLine(
    token: string,
    lineId: string,
    tenantId: string,
  ): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);

    if (cart.status !== 'active') {
      throw new BadRequestException('Cannot modify tendered or completed cart');
    }

    const lineIndex = cart.lines.findIndex((l) => l.id === lineId);
    if (lineIndex < 0) {
      throw new NotFoundException('Line not found');
    }

    cart.lines.splice(lineIndex, 1);

    // Recalculate cart totals
    await this.recalculateCart(cart);

    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async recalculatePrice(token: string, tenantId: string): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);
    await this.recalculateCart(cart);

    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async tender(token: string, tenantId: string): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);

    if (cart.status !== 'active') {
      throw new BadRequestException('Cart already tendered');
    }

    if (cart.lines.length === 0) {
      throw new BadRequestException('Cannot tender empty cart');
    }

    cart.status = 'tendered';
    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async cancel(token: string, tenantId: string): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);

    if (cart.status === 'completed') {
      throw new BadRequestException('Cannot cancel completed cart');
    }

    cart.status = 'cancelled';
    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async complete(token: string, tenantId: string): Promise<Cart> {
    const cart = await this.findByToken(token, tenantId);

    if (cart.status !== 'tendered') {
      throw new BadRequestException('Cart must be tendered before completion');
    }

    cart.status = 'completed';
    cart.updatedAt = new Date();
    await this.saveCart(cart);

    return cart;
  }

  async delete(token: string, tenantId: string): Promise<{ success: boolean }> {
    const cart = await this.loadCart(token);
    if (!cart || cart.tenantId !== tenantId) {
      throw new NotFoundException('Cart not found');
    }

    await this.redis.del(this.cartKey(token));
    return { success: true };
  }

  private async recalculateCart(cart: Cart): Promise<void> {
    const lineItems = cart.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      productName: line.productName,
      sku: line.sku,
      qty: line.qty,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxId: line.taxId,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
    }));

    const priceCalc = await this.pricingService.calculatePrice(
      lineItems,
      cart.tenantId,
    );

    cart.subtotal = priceCalc.subtotal;
    cart.discount = priceCalc.discount;
    cart.tax = priceCalc.tax;
    cart.total = priceCalc.total;
  }
}
