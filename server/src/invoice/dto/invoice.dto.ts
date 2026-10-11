import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { InvoiceStatus } from '../interfaces/invoice.interface';

export class CreateInvoiceDto {
  @IsString()
  shopId: string;

  @IsString()
  @IsOptional()
  saleId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateInvoiceDto {
  @IsEnum(['draft', 'sent', 'confirmed', 'paid', 'cancelled'])
  @IsOptional()
  status?: InvoiceStatus;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SendInvoiceDto {
  @IsString()
  customerEmail: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  message?: string;
}

export class InvoiceQueryDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(['draft', 'sent', 'confirmed', 'paid', 'cancelled'])
  @IsOptional()
  status?: InvoiceStatus;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  limit?: number = 20;
}
