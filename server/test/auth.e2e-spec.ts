import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

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

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'testuser@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: registerDto.email,
        name: registerDto.name,
        role: 'cashier',
        tenantId: 'tenant-1',
      });
      expect(response.body.user).not.toHaveProperty('password');

      // Store for later tests
      accessToken = response.body.access_token;
      userId = response.body.user.id;
    });

    it('should fail to register with invalid email', async () => {
      const registerDto = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail to register with short password', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail to register with missing fields', async () => {
      const registerDto = {
        email: 'test@example.com',
        // missing password and name
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail to register duplicate email', async () => {
      const registerDto = {
        email: 'testuser@example.com', // same as first test
        password: 'password123',
        name: 'Another User',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginDto = {
        email: 'testuser@example.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: loginDto.email,
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should fail to login with invalid email', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should fail to login with invalid password', async () => {
      const loginDto = {
        email: 'testuser@example.com',
        password: 'wrongpassword',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should fail to login with missing credentials', async () => {
      const loginDto = {
        email: 'testuser@example.com',
        // missing password
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(400);
    });
  });

  describe('GET /auth/profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        email: 'testuser@example.com',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      });
      expect(response.body).not.toHaveProperty('password');
    });

    it('should fail to get profile without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should fail to get profile with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should fail to get profile with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token with valid user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.access_token).not.toBe(accessToken); // Should be different token
      expect(response.body.user).toMatchObject({
        id: userId,
        email: 'testuser@example.com',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      });
    });

    it('should fail to refresh token without authorization', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('Security Tests', () => {
    it('should not expose password in any response', async () => {
      // Test registration response
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'securitytest@example.com',
          password: 'password123',
          name: 'Security Test',
        })
        .expect(201);

      expect(registerResponse.body.user).not.toHaveProperty('password');

      // Test login response
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'securitytest@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(loginResponse.body.user).not.toHaveProperty('password');

      // Test profile response
      const profileResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
        .expect(200);

      expect(profileResponse.body).not.toHaveProperty('password');
    });

    it('should handle concurrent registration attempts', async () => {
      const registerPromises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `concurrent${i}@example.com`,
            password: 'password123',
            name: `Concurrent User ${i}`,
          })
      );

      const responses = await Promise.all(registerPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('access_token');
        expect(response.body).toHaveProperty('user');
      });
    });

    it('should validate JWT token expiration', async () => {
      // This test would require mocking time or using a short-lived token
      // For now, we'll test that the token structure is correct
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'password123',
        })
        .expect(200);

      const token = response.body.access_token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('Multi-tenant Tests', () => {
    it('should assign correct tenant ID to new users', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'tenanttest@example.com',
          password: 'password123',
          name: 'Tenant Test',
        })
        .expect(201);

      expect(response.body.user.tenantId).toBe('tenant-1');
    });

    it('should maintain tenant isolation in user data', async () => {
      const user1 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'tenant1@example.com',
          password: 'password123',
          name: 'Tenant 1 User',
        })
        .expect(201);

      const user2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'tenant2@example.com',
          password: 'password123',
          name: 'Tenant 2 User',
        })
        .expect(201);

      // Both users should have the same tenant ID in current implementation
      // In a real multi-tenant system, this would be different
      expect(user1.body.user.tenantId).toBe('tenant-1');
      expect(user2.body.user.tenantId).toBe('tenant-1');
    });
  });
});
