import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AskService } from './ask.service';
import { LlmClient } from './llm-client';
import { DatabaseModule } from '../database/database.module';

/**
 * Phase E reports: five read-only aggregate endpoints plus the NL ask entry.
 * Stateless by design — every read goes through DatabaseService.withTenant
 * (DB-enforced RLS); the LLM client is optional (OPENAI_API_KEY unset =>
 * keyword parser only).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService, AskService, LlmClient],
})
export class ReportsModule {}
