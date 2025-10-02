import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Auth0 configuration moved to environment variables
  // Use auth0.config.ts for proper configuration

  // Test database connection on startup
  const databaseService = app.get(DatabaseService);
  try {
    await databaseService.testConnection();
    logger.log('🚀 Application started successfully with database connection!');
  } catch (error) {
    logger.error('❌ Application started but database connection failed:', error.message);
  }

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`🌐 Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
