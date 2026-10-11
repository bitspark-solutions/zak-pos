import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

/**
 * RedisModule is @Global, so RedisService needs no explicit import here.
 * AuthModule is intentionally NOT imported: guards are referenced by class
 * (same pattern as UsersModule), which keeps AuthModule -> InvitationsModule
 * (register consumes invitations) acyclic.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
