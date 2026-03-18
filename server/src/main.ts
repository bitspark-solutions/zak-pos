import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin === '*'
    ? true // Allow all origins
    : corsOrigin?.split(',').map(o => o.trim()) || ['http://localhost:41923', 'http://localhost:96140'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Set global API prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Test database connection on startup
  const databaseService = app.get(DatabaseService);
  try {
    await databaseService.testConnection();
    logger.log('🚀 Application started successfully with database connection!');
  } catch (error) {
    logger.error('❌ Application started but database connection failed:', error.message);
  }

  const port = process.env.API_PORT || process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🌐 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`);
}
bootstrap();
