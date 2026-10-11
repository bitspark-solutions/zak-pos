import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShopDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;

  @IsString()
  @IsOptional()
  taxProfileId?: string;
}

export class UpdateShopDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;

  @IsString()
  @IsOptional()
  taxProfileId?: string;
}

export class ShopQueryDto {
  @IsString()
  @IsOptional()
  search?: string;
}
