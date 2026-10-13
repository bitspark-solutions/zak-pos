import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

/**
 * Loose E.164-ish phone rule: optional leading +, then digits/spaces/dashes,
 * 6-20 chars total. Normalisation to a canonical form is intentionally NOT
 * done server-side yet — the raw trimmed string is the identity key, so the
 * mobile app must send a consistent format (documented behaviour).
 */
export class RequestOtpDto {
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{4,18}[0-9]$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{4,18}[0-9]$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @IsString()
  @Length(4, 10)
  code: string;
}

/**
 * Exchanges an Auth0 access token obtained from a social login
 * (Google/Apple/SMS on the customer connection) for a customer JWT.
 */
export class SocialLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
