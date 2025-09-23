import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication Performance Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Registration Performance', () => {
    it('should handle 100 concurrent registrations within acceptable time', async () => {
      const startTime = Date.now();
      
      const registerPromises = Array.from({ length: 100 }, (_, i) =>
        request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `perfuser${i}@example.com`,
            password: 'password123',
            name: `Performance User ${i}`,
          })
      );

      const responses = await Promise.all(registerPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Should complete within 10 seconds (100ms per request average)
      expect(totalTime).toBeLessThan(10000);
      console.log(`100 concurrent registrations completed in ${totalTime}ms`);
    });

    it('should handle rapid sequential registrations', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              email: `sequser${i}@example.com`,
              password: 'password123',
              name: `Sequential User ${i}`,
            })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      expect(totalTime).toBeLessThan(5000);
      console.log(`50 sequential registrations completed in ${totalTime}ms`);
    });
  });

  describe('Login Performance', () => {
    beforeEach(async () => {
      // Create test users for login performance tests
      const createPromises = Array.from({ length: 20 }, (_, i) =>
        request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `loginperf${i}@example.com`,
            password: 'password123',
            name: `Login Perf User ${i}`,
          })
      );

      await Promise.all(createPromises);
    });

    it('should handle 50 concurrent logins within acceptable time', async () => {
      const startTime = Date.now();
      
      const loginPromises = Array.from({ length: 50 }, (_, i) =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: `loginperf${i % 20}@example.com`, // Use existing users
            password: 'password123',
          })
      );

      const responses = await Promise.all(loginPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('access_token');
      });

      // Should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);
      console.log(`50 concurrent logins completed in ${totalTime}ms`);
    });
  });

  describe('Profile Access Performance', () => {
    let accessTokens: string[] = [];

    beforeEach(async () => {
      // Create users and get their tokens
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `profileperf${i}@example.com`,
            password: 'password123',
            name: `Profile Perf User ${i}`,
          })
      );

      const responses = await Promise.all(createPromises);
      accessTokens = responses.map(response => response.body.access_token);
    });

    it('should handle 100 concurrent profile requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const profilePromises = Array.from({ length: 100 }, (_, i) =>
        request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${accessTokens[i % 10]}`) // Cycle through tokens
      );

      const responses = await Promise.all(profilePromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('email');
      });

      // Should complete within 3 seconds
      expect(totalTime).toBeLessThan(3000);
      console.log(`100 concurrent profile requests completed in ${totalTime}ms`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory with repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let batch = 0; batch < 10; batch++) {
        const promises = Array.from({ length: 10 }, (_, i) =>
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              email: `memorytest${batch}${i}@example.com`,
              password: 'password123',
              name: `Memory Test User ${batch}${i}`,
            })
        );

        await Promise.all(promises);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      console.log(`Memory increase after 100 operations: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid requests efficiently', async () => {
      const startTime = Date.now();
      
      const errorPromises = Array.from({ length: 100 }, (_, i) =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: `nonexistent${i}@example.com`,
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.all(errorPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should fail with 401
      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });

      // Should complete within 3 seconds
      expect(totalTime).toBeLessThan(3000);
      console.log(`100 invalid login attempts handled in ${totalTime}ms`);
    });
  });

  describe('Token Validation Performance', () => {
    let validToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'tokenperf@example.com',
          password: 'password123',
          name: 'Token Perf User',
        });

      validToken = response.body.access_token;
    });

    it('should validate tokens efficiently', async () => {
      const startTime = Date.now();
      
      const validationPromises = Array.from({ length: 200 }, () =>
        request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(validationPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within 2 seconds
      expect(totalTime).toBeLessThan(2000);
      console.log(`200 token validations completed in ${totalTime}ms`);
    });
  });
});
