import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body of POST /reports/ask. The question is trimmed before validation;
 * anything that cannot be mapped to a report type answers 400 with the list
 * of supported topics (see AskService).
 */
export class AskReportDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  question: string;

  /** When present, overrides any shop named in the question. */
  @IsString()
  @IsOptional()
  shopId?: string;
}
