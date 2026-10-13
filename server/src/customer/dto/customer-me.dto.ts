import { IsNotEmpty, IsString } from 'class-validator';

/** Body of POST /me/follows — the tenant (business) the customer scanned. */
export class CreateFollowDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
