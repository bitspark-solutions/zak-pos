import { Test, TestingModule } from '@nestjs/testing';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

describe('TenantSettingsController', () => {
  let controller: TenantSettingsController;

  const mockService = {
    getCurrent: jest.fn(),
    updateCurrent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantSettingsController],
      providers: [{ provide: TenantSettingsService, useValue: mockService }],
    }).compile();

    controller = module.get<TenantSettingsController>(TenantSettingsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCurrent', () => {
    it('should delegate to tenantSettingsService.getCurrent', async () => {
      mockService.getCurrent.mockResolvedValue({ id: 'tenant-1' });

      const result = await controller.getCurrent('tenant-1');

      expect(result).toEqual({ id: 'tenant-1' });
      expect(mockService.getCurrent).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('updateCurrent', () => {
    it('should delegate to tenantSettingsService.updateCurrent', async () => {
      mockService.updateCurrent.mockResolvedValue({
        id: 'tenant-1',
        name: 'Renamed',
      });

      const result = await controller.updateCurrent(
        { name: 'Renamed' },
        'tenant-1',
      );

      expect(result).toEqual({ id: 'tenant-1', name: 'Renamed' });
      expect(mockService.updateCurrent).toHaveBeenCalledWith('tenant-1', {
        name: 'Renamed',
      });
    });
  });
});
