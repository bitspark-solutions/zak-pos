import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import type {
  CreatedInvitation,
  InvitationListItem,
  VerifyInvitationResult,
} from './interfaces/invitation.interface';

/**
 * Tenant user invitations. Only roles that can create users may manage
 * invitations — in this codebase that is ADMIN and OWNER (MANAGER has no
 * user:* permissions), mirroring users.controller's create/delete guards.
 * `GET /invitations/verify` is public: the invitee has no account yet.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @RequirePermissions(Permission.USER_CREATE)
  @Post()
  async create(
    @Body() createInvitationDto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CreatedInvitation> {
    return this.invitationsService.create(createInvitationDto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @RequirePermissions(Permission.USER_CREATE)
  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<InvitationListItem[]> {
    return this.invitationsService.list(user.tenantId);
  }

  @Get('verify')
  async verify(
    @Query('token') token?: string,
  ): Promise<VerifyInvitationResult> {
    return this.invitationsService.verify(token ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @RequirePermissions(Permission.USER_CREATE)
  @Delete(':token')
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<{ message: string }> {
    return this.invitationsService.revoke(user.tenantId, token);
  }
}
