import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres123@localhost:47821/zakpos_dev';
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Test suite completed');
});

// Global test utilities
global.testUtils = {
  generateTestUser: (overrides = {}) => ({
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    name: 'Test User',
    role: 'cashier',
    tenantId: 'tenant-1',
    ...overrides,
  }),

  generateTestLogin: (overrides = {}) => ({
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    ...overrides,
  }),

  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  generateRandomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
};

// Extend Jest matchers
expect.extend({
  toBeValidJWT(received) {
    const parts = received.split('.');
    const pass = parts.length === 3 && parts.every(part => part.length > 0);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toBeValidEmail(): R;
    }
  }
}
