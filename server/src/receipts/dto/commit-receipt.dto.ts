import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** One user-confirmed receipt line; the only source of truth for amounts. */
export class ReceiptLineDto {
  @IsInt()
  lineId: number;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  qty: number;

  @IsNumber()
  @Min(0)
  unitCost: number;
}

/**
 * Commit payload for the receipts module. `supplierId` (existing supplier) or
 * `newSupplierName` (create-on-commit) must resolve to a supplier, otherwise
 * the request is rejected. OCR amounts from the draft are NEVER used — the
 * server recomputes subtotal/total from these lines.
 */
export class CommitReceiptDto {
  @IsString()
  draftId: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  newSupplierName?: string;

  /** ISO date string; parsed defensively, used as the purchase dueDate. */
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** When true the purchase is created as `received` and stock is restocked. */
  @IsBoolean()
  @IsOptional()
  receive?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines: ReceiptLineDto[];
}
