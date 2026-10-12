import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';
import { DatabaseConnectionMiddleware } from './middleware/database-connection.middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { InventoryModule } from './inventory/inventory.module';
import { CartModule } from './cart/cart.module';
import { SalesModule } from './sales/sales.module';
import { InvoiceModule } from './invoice/invoice.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ShopsModule } from './shops/shops.module';
import { TenantSettingsModule } from './tenant-settings/tenant-settings.module';
import { ProductImportModule } from './product-import/product-import.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProductModule,
    CategoryModule,
    InventoryModule,
    CartModule,
    SalesModule,
    InvoiceModule,
    InvitationsModule,
    ShopsModule,
    TenantSettingsModule,
    ProductImportModule,
    ReceiptsModule,
    ReportsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DatabaseConnectionMiddleware).forRoutes('*');
  }
}
