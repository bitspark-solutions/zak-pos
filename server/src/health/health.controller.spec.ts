import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockDatabaseService = {
    isConnected: jest.fn(),
    getConnectionInfo: jest.fn(),
    testConnection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: mockDatabaseService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return health payload with db info', async () => {
      mockDatabaseService.isConnected.mockResolvedValue(true);
      mockDatabaseService.getConnectionInfo.mockReturnValue({
        database: 'zakpos_dev',
      });

      const result = await controller.checkHealth();
      expect(result.status).toBe('ok');
      expect(result.database.connected).toBe(true);
      expect(result.database.database).toBe('zakpos_dev');
    });
  });

  describe('checkDatabase', () => {
    it('should return connected status on success', async () => {
      mockDatabaseService.testConnection.mockResolvedValue(undefined);

      const result = await controller.checkDatabase();
      expect(result.status).toBe('connected');
      expect(result.message).toBe('Database connection successful');
    });

    it('should return error status on failure', async () => {
      mockDatabaseService.testConnection.mockRejectedValue(
        new Error('Conn refused'),
      );

      const result = await controller.checkDatabase();
      expect(result.status).toBe('error');
      expect(result.message).toBe('Database connection failed');
      expect(result.error).toBe('Conn refused');
    });
  });
});
