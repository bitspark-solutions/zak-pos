import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A per-candidate edit collected on the review table and applied to the cached
 * candidate right before it is materialised into a product. Only the fields the
 * user actually touched are sent; anything omitted keeps its preview value.
 */
export interface CandidateOverride {
  candidateId: number;
  name?: string;
  sku?: string;
  basePrice?: number;
  unit?: string;
}

export class CandidateOverrideDto implements CandidateOverride {
  @IsInt()
  candidateId: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  basePrice?: number;

  @IsString()
  @IsOptional()
  unit?: string;
}

export class CommitImportDto {
  @IsString()
  uploadId: string;

  @IsArray()
  @ArrayMinSize(0)
  @IsInt({ each: true })
  candidateIds: number[];

  /**
   * Inline edits made on the review table, applied to the cached candidates
   * before commit. Optional so legacy callers keep working unchanged.
   */
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CandidateOverrideDto)
  @IsOptional()
  overrides?: CandidateOverrideDto[];
}
