import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';
import type {
  ForecastListResponse,
  ProductForecastResponse,
} from './interfaces/forecast.interface';

describe('ForecastController', () => {
  let controller: ForecastController;

  const listResponse: ForecastListResponse = {
    horizonDays: 14,
    shopId: null,
    generatedAt: '2026-10-12T00:00:00.000Z',
    rows: [],
    totals: { products: 0, outOfStock: 0, low: 0 },
  };

  const detailResponse: ProductForecastResponse = {
    productId: 'p-1',
    name: 'Tea Powder',
    sku: 'TEA-1',
    unit: 'pcs',
    avgDailyQty: 0.35,
    forecastQty: 4.9,
    currentStock: 7,
    daysOfCover: 20,
    risk: 'low',
    suggestedOrderQty: 0,
    history: [],
    forecastSeries: [],
  };

  const mockService = {
    getForecast: jest.fn(),
    getProductForecast: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [{ provide: ForecastService, useValue: mockService }],
    }).compile();

    controller = module.get<ForecastController>(ForecastController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('is guarded by JwtAuthGuard, RolesGuard and PermissionsGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ForecastController) as
      | unknown[]
      | undefined;
    expect(guards).toEqual(
      expect.arrayContaining([JwtAuthGuard, RolesGuard, PermissionsGuard]),
    );
    expect(guards).toHaveLength(3);
  });

  it('every route is owner/manager-only and report:read-gated', () => {
    // Read handler metadata through the property descriptor (avoids an
    // unbound-method reference) — SetMetadata stores it on the handler fn.
    const handlerMetadata = (key: string, method: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(
        ForecastController.prototype,
        method,
      );
      return Reflect.getMetadata(key, descriptor?.value as object);
    };

    expect(handlerMetadata(ROLES_KEY, 'forecast')).toEqual([
      Role.OWNER,
      Role.MANAGER,
    ]);
    expect(handlerMetadata(ROLES_KEY, 'productForecast')).toEqual([
      Role.OWNER,
      Role.MANAGER,
    ]);
    expect(handlerMetadata(PERMISSIONS_KEY, 'forecast')).toEqual([
      Permission.REPORT_READ,
    ]);
    expect(handlerMetadata(PERMISSIONS_KEY, 'productForecast')).toEqual([
      Permission.REPORT_READ,
    ]);
  });

  it('forecast delegates to the service with the query and tenant id', async () => {
    mockService.getForecast.mockResolvedValue(listResponse);

    const query = { shopId: 'shop-1', horizonDays: 30, risk: 'low' as const };
    const result = await controller.forecast(query, 'tenant-1');

    expect(result).toEqual(listResponse);
    expect(mockService.getForecast).toHaveBeenCalledWith(query, 'tenant-1');
  });

  it('productForecast delegates with the id, query and tenant id', async () => {
    mockService.getProductForecast.mockResolvedValue(detailResponse);

    const result = await controller.productForecast(
      'p-1',
      { horizonDays: 21 },
      'tenant-1',
    );

    expect(result).toEqual(detailResponse);
    expect(mockService.getProductForecast).toHaveBeenCalledWith(
      'p-1',
      { horizonDays: 21 },
      'tenant-1',
    );
  });
});
