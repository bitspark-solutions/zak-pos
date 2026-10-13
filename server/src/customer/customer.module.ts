import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { Auth0Service } from '../auth/auth0.service';
import { CustomerController, BusinessController } from './customer.controller';
import { CustomerMeController } from './customer-me.controller';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerService } from './customer.service';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { MockCustomerOtpProvider } from './otp/mock-customer-otp.provider';
import { Auth0CustomerOtpProvider } from './otp/auth0-customer-otp.provider';
import { CUSTOMER_OTP_PROVIDER } from './otp/customer-otp-provider.interface';
import type { CustomerOtpProvider } from './otp/customer-otp-provider.interface';

/**
 * G2a customer platform (server side).
 *
 * JwtModule here shares JWT_SECRET with staff auth but customer tokens are
 * minted/verified with the separate 'customer-jwt' audience (see
 * CustomerJwtStrategy + the type:'customer' rejection in the staff strategy).
 * OTP delivery is env-gated: CUSTOMER_OTP_PROVIDER=mock|auth0, default mock.
 */
@Module({
  imports: [
    DatabaseModule,
    InvoiceModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ||
          '7d') as JwtSignOptions['expiresIn'],
      },
    }),
  ],
  controllers: [
    CustomerController,
    BusinessController,
    CustomerMeController,
    CustomerAuthController,
  ],
  providers: [
    CustomerService,
    CustomerAuthService,
    CustomerJwtStrategy,
    // Stateless Auth0 HTTP wrapper (AuthModule does not export it); the
    // customer social login only uses its verified /userinfo lookup.
    Auth0Service,
    MockCustomerOtpProvider,
    Auth0CustomerOtpProvider,
    {
      provide: CUSTOMER_OTP_PROVIDER,
      inject: [MockCustomerOtpProvider, Auth0CustomerOtpProvider],
      useFactory: (
        mock: MockCustomerOtpProvider,
        auth0: Auth0CustomerOtpProvider,
      ): CustomerOtpProvider =>
        process.env.CUSTOMER_OTP_PROVIDER === 'auth0' ? auth0 : mock,
    },
  ],
  exports: [CustomerService],
})
export class CustomerModule {}
