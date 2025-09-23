# ZakPOS Authentication Test Suite

This comprehensive test suite validates all aspects of the ZakPOS authentication system, including unit tests, integration tests, and performance tests.

## Test Structure

### Unit Tests (`*.spec.ts`)
- **`auth.service.spec.ts`** - Tests for AuthService business logic
- **`auth.controller.spec.ts`** - Tests for AuthController endpoints
- **`users.service.spec.ts`** - Tests for UsersService data operations

### Integration Tests (`*.e2e-spec.ts`)
- **`auth.e2e-spec.ts`** - End-to-end API testing with real HTTP requests

### Performance Tests (`*.performance.spec.ts`)
- **`auth.performance.spec.ts`** - Load testing and performance validation

## Test Categories

### 🔐 Authentication Tests
- ✅ User registration with validation
- ✅ User login with credential verification
- ✅ JWT token generation and validation
- ✅ Protected route access control
- ✅ Token refresh functionality
- ✅ Logout functionality

### 🛡️ Security Tests
- ✅ Password hashing verification
- ✅ JWT token structure validation
- ✅ Input validation and sanitization
- ✅ Error handling without information leakage
- ✅ Concurrent request handling

### 🏢 Multi-tenant Tests
- ✅ Tenant ID assignment
- ✅ Tenant isolation verification
- ✅ Role-based access control

### ⚡ Performance Tests
- ✅ Concurrent user registration (100 users)
- ✅ Concurrent login requests (50 users)
- ✅ Profile access performance (100 requests)
- ✅ Memory usage validation
- ✅ Error handling performance

## Running Tests

### Prerequisites
1. Ensure PostgreSQL is running on port 47821
2. Ensure Redis is running on port 58392
3. Test database `zakpos_test` should be available

### Test Commands

```bash
# Run all tests
npm run test:all

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:e2e

# Run performance tests only
npm run test:performance

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Run tests for CI/CD
npm run test:ci
```

### Individual Test Files

```bash
# Run specific test file
npm test -- auth.service.spec.ts
npm test -- auth.e2e-spec.ts
npm test -- auth.performance.spec.ts
```

## Test Configuration

### Environment Variables
Tests use `.env.test` file with test-specific configurations:
- Test database: `zakpos_test`
- Test JWT secret: `test-jwt-secret-key-for-testing-only`
- Test ports: 3001 (API), 47821 (PostgreSQL), 58392 (Redis)

### Jest Configuration
- **Config file**: `test/jest.config.js`
- **Setup file**: `test/setup.ts`
- **Coverage threshold**: 80% for all metrics
- **Timeout**: 30 seconds per test

## Test Coverage

The test suite aims for comprehensive coverage:

### AuthService (100% coverage target)
- ✅ `validateUser()` - Credential validation
- ✅ `login()` - User authentication
- ✅ `register()` - User registration
- ✅ `getProfile()` - Profile retrieval
- ✅ `refreshToken()` - Token refresh

### AuthController (100% coverage target)
- ✅ `POST /auth/register` - User registration endpoint
- ✅ `POST /auth/login` - User login endpoint
- ✅ `GET /auth/profile` - Protected profile endpoint
- ✅ `POST /auth/refresh` - Token refresh endpoint
- ✅ `POST /auth/logout` - Logout endpoint

### UsersService (100% coverage target)
- ✅ `create()` - User creation with password hashing
- ✅ `findByEmail()` - User lookup by email
- ✅ `findById()` - User lookup by ID
- ✅ `findAll()` - All users retrieval
- ✅ `update()` - User data updates
- ✅ `remove()` - User deletion

## Performance Benchmarks

### Registration Performance
- ✅ 100 concurrent registrations: < 10 seconds
- ✅ 50 sequential registrations: < 5 seconds

### Login Performance
- ✅ 50 concurrent logins: < 5 seconds

### Profile Access Performance
- ✅ 100 concurrent profile requests: < 3 seconds
- ✅ 200 token validations: < 2 seconds

### Memory Usage
- ✅ Memory increase after 100 operations: < 50MB

## Test Data Management

### Test User Generation
Tests use dynamic email generation to avoid conflicts:
```typescript
email: `test${Date.now()}@example.com`
```

### Cleanup
- Each test runs in isolation
- No shared state between tests
- Automatic cleanup after test completion

## Custom Jest Matchers

### `toBeValidJWT(token)`
Validates JWT token structure (3 parts separated by dots)

### `toBeValidEmail(email)`
Validates email format using regex

## Debugging Tests

### Debug Mode
```bash
npm run test:debug
```

### Verbose Output
```bash
npm test -- --verbose
```

### Specific Test Pattern
```bash
npm test -- --testNamePattern="should register a new user"
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Tests
  run: npm run test:ci
```

### Coverage Reports
- HTML coverage report: `coverage/index.html`
- LCOV coverage report: `coverage/lcov.info`

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running on port 47821
   - Check test database `zakpos_test` exists

2. **Port Conflicts**
   - Ensure test port 3001 is available
   - Check Redis port 58392 is available

3. **Memory Issues**
   - Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`

4. **Timeout Issues**
   - Increase Jest timeout in `jest.config.js`
   - Check for slow database operations

### Test Environment Setup

```bash
# Create test database
docker exec zakpos-postgres psql -U postgres -c "CREATE DATABASE zakpos_test;"

# Verify test environment
npm run test:unit -- --verbose
```

## Contributing

When adding new tests:

1. Follow the existing naming convention
2. Add appropriate test categories
3. Update this README with new test descriptions
4. Ensure 80%+ coverage for new code
5. Add performance benchmarks if applicable

## Test Results Example

```
 PASS  src/auth/auth.service.spec.ts
 PASS  src/auth/auth.controller.spec.ts
 PASS  src/users/users.service.spec.ts
 PASS  test/auth.e2e-spec.ts
 PASS  test/auth.performance.spec.ts

Test Suites: 5 passed, 5 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        12.345 s
Coverage:    85.2% (target: 80%)
```
