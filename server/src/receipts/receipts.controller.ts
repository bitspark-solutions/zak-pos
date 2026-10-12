import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReceiptsService } from './receipts.service';
import { CommitReceiptDto } from './dto/commit-receipt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type {
  ReceiptCommitResult,
  ReceiptDraftResponse,
  ReceiptSupplierOption,
  ReceiptsAuthUser,
} from './interfaces/receipts.interface';

/** ~10MB per uploaded receipt image/PDF. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

interface MulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post('digitize')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname
          .slice(file.originalname.lastIndexOf('.') + 1)
          .toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.originalname}`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async digitize(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptDraftResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded (field name: file)');
    }
    return this.receiptsService.digitize(file, tenantId);
  }

  @Get('draft/:draftId')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async getDraft(
    @Param('draftId') draftId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptDraftResponse> {
    return this.receiptsService.getDraft(draftId, tenantId);
  }

  @Get('suppliers')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async listSuppliers(
    @CurrentTenant() tenantId: string,
  ): Promise<ReceiptSupplierOption[]> {
    return this.receiptsService.listSuppliers(tenantId);
  }

  @Post('commit')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @HttpCode(HttpStatus.OK)
  async commit(
    @Body() commitReceiptDto: CommitReceiptDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ReceiptCommitResult> {
    // The login JWT carries an optional shopId context claim; widen AuthUser
    // to read it (undefined when the token predates the claim).
    const claims: ReceiptsAuthUser = user;
    return this.receiptsService.commit(commitReceiptDto, tenantId, {
      shopId: claims.shopId,
    });
  }
}
