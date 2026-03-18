import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface TaxCalculation {
  taxId: string;
  taxName: string;
  rate: number;
  inclusive: boolean;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface PriceCalculation {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  taxBreakdown: TaxCalculation[];
}

export interface CartLineItem {
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxId?: string;
  lineTotal: number;
  taxAmount: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async calculatePrice(
    lines: CartLineItem[],
    tenantId: string,
  ): Promise<PriceCalculation> {
    const { prisma } = this.databaseService.getPrisma();

    // Get all tax IDs from lines
    const taxIds = [...new Set(lines.filter((l) => l.taxId).map((l) => l.taxId))] as string[];

    // Fetch taxes
    const taxes = await prisma.tax.findMany({
      where: {
        id: { in: taxIds },
        tenantId,
        isActive: true,
      },
    });

    const taxMap = new Map(taxes.map((t) => [t.id, t]));

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const taxBreakdown: TaxCalculation[] = [];

    // Process each line
    for (const line of lines) {
      const lineSubtotal = line.unitPrice * line.qty;
      subtotal += lineSubtotal;
      totalDiscount += line.discount;

      // Calculate tax
      if (line.taxId && taxMap.has(line.taxId)) {
        const tax = taxMap.get(line.taxId)!;
        const taxableAmount = lineSubtotal - line.discount;

        let taxAmount: number;
        let baseAmount: number;

        if (tax.inclusive) {
          // Tax included in price
          baseAmount = taxableAmount / (1 + Number(tax.ratePercent) / 100);
          taxAmount = taxableAmount - baseAmount;
        } else {
          // Tax added on top
          baseAmount = taxableAmount;
          taxAmount = taxableAmount * (Number(tax.ratePercent) / 100);
        }

        totalTax += taxAmount;

        // Update line with calculated tax
        line.taxAmount = taxAmount;
        line.lineTotal = taxableAmount + taxAmount;

        // Add to breakdown
        const existingTax = taxBreakdown.find((t) => t.taxId === tax.id);
        if (existingTax) {
          existingTax.baseAmount += baseAmount;
          existingTax.taxAmount += taxAmount;
          existingTax.totalAmount += baseAmount + taxAmount;
        } else {
          taxBreakdown.push({
            taxId: tax.id,
            taxName: tax.name,
            rate: Number(tax.ratePercent),
            inclusive: tax.inclusive,
            baseAmount,
            taxAmount,
            totalAmount: baseAmount + taxAmount,
          });
        }
      } else {
        line.lineTotal = lineSubtotal - line.discount;
        line.taxAmount = 0;
      }
    }

    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total,
      taxBreakdown,
    };
  }

  async calculateLinePrice(
    unitPrice: number,
    qty: number,
    discount: number,
    taxId?: string,
  ): Promise<{ lineTotal: number; taxAmount: number }> {
    if (!taxId) {
      return {
        lineTotal: unitPrice * qty - discount,
        taxAmount: 0,
      };
    }

    const { prisma } = this.databaseService.getPrisma();

    const tax = await prisma.tax.findUnique({
      where: { id: taxId },
    });

    if (!tax) {
      return {
        lineTotal: unitPrice * qty - discount,
        taxAmount: 0,
      };
    }

    const taxableAmount = unitPrice * qty - discount;

    if (tax.inclusive) {
      const baseAmount = taxableAmount / (1 + Number(tax.ratePercent) / 100);
      const taxAmount = taxableAmount - baseAmount;
      return {
        lineTotal: taxableAmount,
        taxAmount,
      };
    } else {
      const taxAmount = taxableAmount * (Number(tax.ratePercent) / 100);
      return {
        lineTotal: taxableAmount + taxAmount,
        taxAmount,
      };
    }
  }
}
