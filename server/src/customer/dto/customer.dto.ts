import { IsOptional, IsString } from 'class-validator';

/** Query for the POS checkout customer picker (staff side). */
export class QueryCustomersDto {
  @IsString()
  @IsOptional()
  search?: string;
}

/**
 * Create a tenant-scoped contact for a walk-in sale. All fields optional:
 * a bare phone number is the normal cashier input, `name` is used as-is and
 * falls back to the phone for display when omitted.
 */
export class CreateCustomerDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;
}
