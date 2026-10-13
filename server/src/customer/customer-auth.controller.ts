import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import {
  RequestOtpDto,
  SocialLoginDto,
  VerifyOtpDto,
} from './dto/customer-auth.dto';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { CurrentAccountId } from './decorators/current-account-id.decorator';
import type {
  CustomerLoginResult,
  ICustomerProfile,
} from './interfaces/customer.interface';

/**
 * Customer-side auth endpoints. request-otp / verify-otp / social are public
 * (they CREATE the customer session); GET /auth/me runs behind the customer
 * JWT. These live under the same /auth prefix as the staff AuthController but
 * on a separate controller so the two audiences' guards never mix — there is
 * no route-path collision (staff side exposes login/register/profile/...).
 */
@Controller('auth')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  /** Rate-limited by the OTP attempt cap in Redis; returns 200 with a generic message. */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.customerAuthService.requestOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<CustomerLoginResult> {
    return this.customerAuthService.verifyOtp(dto.phone, dto.code);
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  social(@Body() dto: SocialLoginDto): Promise<CustomerLoginResult> {
    return this.customerAuthService.socialLogin(dto.accessToken);
  }

  @Get('me')
  @UseGuards(CustomerJwtAuthGuard)
  me(@CurrentAccountId() accountId: string): Promise<ICustomerProfile> {
    return this.customerAuthService.me(accountId);
  }
}
