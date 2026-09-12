import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service';
import { DatabaseService } from '../database/database.service';

describe('DeviceService', () => {
  let service: DeviceService;

  const mockDatabaseService = {
    getPrisma: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerDevice', () => {
    it('should register a device and return device info', async () => {
      const result = await service.registerDevice('u1', {
        deviceName: 'Pixel 8',
        deviceType: 'mobile',
        fingerprint: 'fp-123',
      });

      expect(result.userId).toBe('u1');
      expect(result.deviceName).toBe('Pixel 8');
      expect(result.deviceType).toBe('mobile');
      expect(result.fingerprint).toBe('fp-123');
      expect(result.isActive).toBe(true);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate a base64 fingerprint from userAgent and IP', () => {
      const fp = service.generateFingerprint('Mozilla', '127.0.0.1');
      expect(fp).toBe(Buffer.from('Mozilla-127.0.0.1').toString('base64'));
    });
  });

  describe('revokeDevice', () => {
    it('should return true when revoking device', async () => {
      const result = await service.revokeDevice('d1');
      expect(result).toBe(true);
    });
  });
});
