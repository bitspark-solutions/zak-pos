import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DatabaseConnectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DatabaseConnectionMiddleware.name);
  private connectionChecked = false;

  constructor(private readonly databaseService: DatabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Only check connection once on startup
    if (!this.connectionChecked) {
      try {
        const isConnected = await this.databaseService.isConnected();
        if (isConnected) {
          this.logger.log('🔗 Database connection middleware: Connected to DB');
          const connectionInfo = this.databaseService.getConnectionInfo();
          this.logger.log(`📊 Database: ${connectionInfo.database}@${connectionInfo.host}:${connectionInfo.port}`);
        } else {
          this.logger.warn('⚠️ Database connection middleware: Not connected to DB');
        }
        this.connectionChecked = true;
      } catch (error) {
        this.logger.error('❌ Database connection middleware: Connection failed', error.message);
        this.connectionChecked = true;
      }
    }

    next();
  }
}
