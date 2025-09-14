import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { databaseConfig } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
