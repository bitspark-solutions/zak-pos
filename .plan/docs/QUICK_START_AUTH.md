# 🚀 Quick Start: User Registration & Login

## ✅ Status: READY TO USE

User registration and login are **fully implemented and ready to use**.

## 🎯 Quick Test (5 minutes)

### Step 1: Start Services
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Wait for PostgreSQL to be ready (30 seconds)
sleep 30

# Run database migrations
cd server
npx prisma migrate deploy
npx prisma generate

# Start the API server
npm run start:dev
```

### Step 2: Test Registration
```bash
curl -X POST http://localhost:39847/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "role": "owner"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "test@example.com",
    "name": "Test User",
    "role": "owner",
    "tenantId": "tenant-1",
    "permissions": [...]
  }
}
```

### Step 3: Test Login
```bash
curl -X POST http://localhost:39847/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

**Expected Response:** Same as registration (access_token + user object)

### Step 4: Test Protected Endpoint
```bash
# Replace YOUR_TOKEN with the access_token from login
curl -X GET http://localhost:39847/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📍 Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | Login user | No |
| GET | `/api/v1/auth/profile` | Get user profile | Yes |
| GET | `/api/v1/auth/health` | Auth system health | No |

## 🔧 Configuration

Make sure `.env` file has:
```bash
DATABASE_URL=postgresql://postgres:postgres123@localhost:47821/zakpos_dev
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
API_PORT=39847
API_PREFIX=api/v1
```

## ✅ What's Working

- ✅ User registration with validation
- ✅ User login with JWT token
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ Input validation (email, password length, required fields)
- ✅ Error handling (proper HTTP status codes)
- ✅ CORS configuration
- ✅ Role-based permissions
- ✅ Protected routes with JWT authentication

## 🐛 Common Issues

**Issue:** "Database connection failed"
- **Fix:** Start PostgreSQL: `docker-compose up -d postgres`
- **Fix:** Check DATABASE_URL in .env

**Issue:** "Prisma Client not generated"
- **Fix:** Run `cd server && npx prisma generate`

**Issue:** "Port already in use"
- **Fix:** Change API_PORT in .env or stop the service using the port

**Issue:** "Validation failed"
- **Fix:** Ensure email is valid format and password is at least 6 characters

## 📚 Full Documentation

See `AUTH_SETUP.md` for complete documentation.

