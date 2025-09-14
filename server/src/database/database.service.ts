import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async isConnected(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database connection failed:', error.message);
      return false;
    }
  }

  async testConnection(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log('✅ Connected to PostgreSQL database successfully!');
      
      const options = this.dataSource.options as any;
      this.logger.log(`📊 Database: ${options.database || 'unknown'}`);
      this.logger.log(`🏠 Host: ${options.host || 'unknown'}:${options.port || 'unknown'}`);
    } catch (error) {
      this.logger.error('❌ Failed to connect to PostgreSQL database:', error.message);
      throw error;
    }
  }

  getConnectionInfo() {
    const options = this.dataSource.options as any;
    return {
      host: options.host || 'unknown',
      port: options.port || 'unknown',
      database: options.database || 'unknown',
      username: options.username || 'unknown',
    };
  }
}
