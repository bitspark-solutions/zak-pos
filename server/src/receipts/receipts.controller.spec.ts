import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ReceiptDraftResponse } from './interfaces/receipts.interface';

describe('ReceiptsController', () => {
  let controller: ReceiptsController;

  const draftResponse: ReceiptDraftResponse = {
    draftId: 'dr-1',
    vendor: 'Acme Suppliers',
    documentDate: '2026-10-01',
    currency: 'BDT',
    subtotal: 100,
    discount: 0,
    tax: 0,
    total: 100,
    engine: 'paddleocr',
    lines: [
      {
        lineId: 0,
        name: 'Tea Powder',
        qty: 2,
        unitPrice: 50,
        lineTotal: 100,
        matchedProductId: 'p-1',
        matchedProductName: 'Tea Powder',
      },
    ],
    supplierSuggestions: [{ id: 's-1', name: 'Acme Suppliers' }],
  };

  const mockService = {
    digitize: jest.fn(),
    getDraft: jest.fn(),
    listSuppliers: jest.fn(),
    commit: jest.fn(),
  };

  const user = {
    id: 'user-1',
    email: 'owner@test.dev',
    name: 'Owner',
    tenantId: 'tenant-1',
    role: 'owner',
    permissions: [],
    shopId: 'shop-7',
  } as AuthUser & { shopId?: string };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [{ provide: ReceiptsService, useValue: mockService }],
    }).compile();

    controller = module.get<ReceiptsController>(ReceiptsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('is guarded by JwtAuthGuard, RolesGuard and PermissionsGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ReceiptsController) as
      | unknown[]
      | undefined;
    expect(guards).toEqual(
      expect.arrayContaining([JwtAuthGuard, RolesGuard, PermissionsGuard]),
    );
    expect(guards).toHaveLength(3);
  });

  it('every route is owner/manager-only and permission-gated', () => {
    // Read handler metadata through the property descriptor (avoids an
    // unbound-method reference) — SetMetadata stores it on the handler fn.
    const handlerMetadata = (key: string, method: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(
        ReceiptsController.prototype,
        method,
      );
      return Reflect.getMetadata(key, descriptor?.value as object);
    };

    expect(handlerMetadata(ROLES_KEY, 'digitize')).toEqual([
      Role.OWNER,
      Role.MANAGER,
    ]);
    expect(handlerMetadata(ROLES_KEY, 'getDraft')).toEqual([
      Role.OWNER,
      Role.MANAGER,
    ]);
    expect(handlerMetadata(PERMISSIONS_KEY, 'digitize')).toEqual([
      Permission.PRODUCT_CREATE,
    ]);
    expect(handlerMetadata(PERMISSIONS_KEY, 'getDraft')).toEqual([
      Permission.PRODUCT_READ,
    ]);
    expect(handlerMetadata(PERMISSIONS_KEY, 'listSuppliers')).toEqual([
      Permission.PRODUCT_READ,
    ]);
    expect(handlerMetadata(PERMISSIONS_KEY, 'commit')).toEqual([
      Permission.PRODUCT_CREATE,
    ]);
  });

  it('digitize delegates to the service with the file and tenant id', async () => {
    mockService.digitize.mockResolvedValue(draftResponse);
    const file = {
      originalname: 'receipt.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('x'),
    };

    const result = await controller.digitize(file, 'tenant-1');

    expect(result).toEqual(draftResponse);
    expect(mockService.digitize).toHaveBeenCalledWith(file, 'tenant-1');
  });

  it('digitize rejects when no file is uploaded', async () => {
    await expect(
      controller.digitize(undefined, 'tenant-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const noBuffer = {
      originalname: 'receipt.pdf',
      mimetype: 'application/pdf',
      buffer: undefined as unknown as Buffer,
    };
    await expect(
      controller.digitize(noBuffer, 'tenant-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getDraft and listSuppliers pass the tenant id through', async () => {
    mockService.getDraft.mockResolvedValue(draftResponse);
    mockService.listSuppliers.mockResolvedValue([]);

    await expect(controller.getDraft('dr-1', 'tenant-1')).resolves.toEqual(
      draftResponse,
    );
    expect(mockService.getDraft).toHaveBeenCalledWith('dr-1', 'tenant-1');

    await expect(controller.listSuppliers('tenant-1')).resolves.toEqual([]);
    expect(mockService.listSuppliers).toHaveBeenCalledWith('tenant-1');
  });

  it('commit delegates with the dto, tenant id and authenticated user', async () => {
    const commitResult = {
      purchaseId: 'pur-1',
      status: 'draft',
      linesCreated: 1,
      total: 100,
    };
    mockService.commit.mockResolvedValue(commitResult);
    const dto = {
      draftId: 'dr-1',
      lines: [{ lineId: 0, productId: 'p-1', qty: 2, unitCost: 50 }],
    };

    const result = await controller.commit(dto, 'tenant-1', user);

    expect(result).toEqual(commitResult);
    // The controller forwards the shopId context claim to the service.
    expect(mockService.commit).toHaveBeenCalledWith(dto, 'tenant-1', {
      shopId: 'shop-7',
    });
  });
});
