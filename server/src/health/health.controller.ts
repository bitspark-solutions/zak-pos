import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async checkHealth() {
    const isDbConnected = await this.databaseService.isConnected();
    const connectionInfo = this.databaseService.getConnectionInfo();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: isDbConnected,
        ...connectionInfo,
      },
    };
  }

  @Get('db')
  async checkDatabase() {
    try {
      await this.databaseService.testConnection();
      return {
        status: 'connected',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
