import { DatabaseConnectionMiddleware } from './database-connection.middleware';
import { DatabaseService } from '../database/database.service';

describe('DatabaseConnectionMiddleware', () => {
  let middleware: DatabaseConnectionMiddleware;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    isConnected: jest.fn(),
    getConnectionInfo: jest.fn().mockReturnValue({ database: 'zakpos_dev', host: 'localhost', port: 5432 }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.isConnected.mockResolvedValue(true);
    mockDatabaseService.getConnectionInfo.mockReturnValue({ database: 'zakpos_dev', host: 'localhost', port: 5432 });
    databaseService = mockDatabaseService as any;
    middleware = new DatabaseConnectionMiddleware(databaseService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call next() and check connection on first request', async () => {
    mockDatabaseService.isConnected.mockResolvedValue(true);
    const req = {} as any;
    const res = {} as any;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(mockDatabaseService.isConnected).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should only check connection once across multiple requests', async () => {
    mockDatabaseService.isConnected.mockResolvedValue(true);
    const req = {} as any;
    const res = {} as any;
    const next = jest.fn();

    await middleware.use(req, res, next);
    await middleware.use(req, res, next);

    expect(mockDatabaseService.isConnected).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
