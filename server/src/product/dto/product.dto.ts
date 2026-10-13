import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  // Optional: when omitted/blank the service auto-generates a unique SKU
  // (same scheme as the product-import commit path).
  @IsString()
  @IsOptional()
  sku?: string;

  // Optional scanned barcode. Accepted as a single string for the common
  // "scan-to-add" flow; mirrored into `barcodes` on the service side.
  @IsString()
  @IsOptional()
  barcode?: string;

  // Optional set of barcode values. Only pure-digit values are kept
  // (matches the import pipeline's parseBarcodeList rule).
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  barcodes?: string[];

  @IsString()
  @IsOptional()
  unit?: string = 'pcs';

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  basePrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => Number(value))
  defaultCost?: number;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isWeighted?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => Number(value))
  basePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => Number(value))
  defaultCost?: number;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isWeighted?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class ProductQueryDto {
  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 20;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class BarcodeLookupDto {
  @IsString()
  barcode: string;
}

export class AttachBarcodeDto {
  @IsString()
  value: string;
}
