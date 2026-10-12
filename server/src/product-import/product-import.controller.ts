import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductImportService } from './product-import.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type {
  CommitResult,
  ImportCachePayload,
  PreviewResult,
} from './interfaces/product-import.interface';

/** ~10MB per uploaded file. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const ACCEPTED_EXTENSIONS = [
  'csv',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
];

interface MulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Controller('product-import')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductImportController {
  constructor(private readonly productImportService: ProductImportService) {}

  @Post('preview')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
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
  async preview(
    @UploadedFiles() files: MulterFile[] | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<PreviewResult> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded (field name: files)');
    }
    return this.productImportService.preview(files, tenantId);
  }

  @Get('preview/:uploadId')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_READ)
  async getPreview(
    @Param('uploadId') uploadId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ImportCachePayload> {
    return this.productImportService.getPreview(uploadId, tenantId);
  }

  @Post('commit')
  @Roles(Role.OWNER, Role.MANAGER)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @HttpCode(HttpStatus.OK)
  async commit(
    @Body() commitImportDto: CommitImportDto,
    @CurrentTenant() tenantId: string,
  ): Promise<CommitResult> {
    return this.productImportService.commit(
      commitImportDto.uploadId,
      commitImportDto.candidateIds,
      tenantId,
      commitImportDto.overrides ?? [],
    );
  }
}
