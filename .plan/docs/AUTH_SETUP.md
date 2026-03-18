# User Registration & Login - Setup Guide

## ✅ What's Been Implemented

1. **Authentication Endpoints**
   - `POST /api/v1/auth/register` - User registration
   - `POST /api/v1/auth/login` - User login
   - `GET /api/v1/auth/profile` - Get user profile (protected)
   - `GET /api/v1/auth/health` - Auth system health check

2. **Features**
   - Password hashing with bcrypt (12 rounds)
   - JWT token generation
   - Input validation with class-validator
   - Proper error handling
   - CORS configuration
   - Role-based permissions (owner, manager, cashier)

## 🚀 Quick Start

### 1. Prerequisites

Make sure you have:
- Docker and Docker Compose installed
- Node.js 20+ installed (if running locally)
- PostgreSQL running (via Docker Compose)

### 2. Environment Setup

Copy the environment file:
```bash
cp env.example .env
```

Key environment variables for auth:
```bash
DATABASE_URL=postgresql://postgres:postgres123@localhost:47821/zakpos_dev
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
API_PORT=39847
API_PREFIX=api/v1
```

### 3. Database Setup

#### Option A: Using Docker Compose
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations (inside server container or locally)
cd server
npx prisma migrate deploy
npx prisma generate
```

#### Option B: Local Development
```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
```

### 4. Start the Server

#### Option A: Using Docker Compose
```bash
docker-compose up -d api
docker-compose logs -f api
```

#### Option B: Local Development
```bash
cd server
npm install
npm run start:dev
```

The server will start on `http://localhost:39847` (or port specified in API_PORT)

## 📝 API Usage

### Register a New User

**Endpoint:** `POST /api/v1/auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "owner"  // optional: "owner", "manager", "cashier" (default: "cashier")
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1234567890",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "owner",
    "tenantId": "tenant-1",
    "permissions": ["user:create", "user:read", ...]
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:39847/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "owner"
  }'
```

### Login

**Endpoint:** `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1234567890",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "owner",
    "tenantId": "tenant-1",
    "permissions": ["user:create", "user:read", ...]
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:39847/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get User Profile (Protected)

**Endpoint:** `GET /api/v1/auth/profile`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567890",
  "email": "john@example.com",
  "tenantId": "tenant-1",
  "role": "owner"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:39847/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Health Check

**Endpoint:** `GET /api/v1/auth/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "authentication": {
    "local": {
      "enabled": true,
      "userCount": 1,
      "registration": true,
      "login": true
    },
    "auth0": {
      "enabled": false,
      "domain": "not configured"
    }
  },
  "jwt": {
    "enabled": true,
    "secret": "configured",
    "expiresIn": "7d"
  },
  "database": {
    "connected": true,
    "users": 1
  }
}
```

## 🔒 Security Features

1. **Password Security**
   - Passwords are hashed using bcrypt with 12 rounds
   - Passwords are never returned in API responses

2. **JWT Tokens**
   - Tokens include user ID, email, role, tenantId, and permissions
   - Default expiration: 7 days (configurable via JWT_EXPIRES_IN)
   - Secret key should be changed in production

3. **Input Validation**
   - Email format validation
   - Password minimum length: 6 characters
   - Required fields validation
   - Whitelist validation (strips unknown properties)

4. **Error Handling**
   - Proper HTTP status codes
   - Clear error messages
   - No sensitive information in error responses

## 🧪 Testing

### Using cURL

1. **Register a user:**
```bash
curl -X POST http://localhost:39847/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test123","role":"owner"}'
```

2. **Login:**
```bash
curl -X POST http://localhost:39847/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

3. **Get profile (replace TOKEN with actual token):**
```bash
curl -X GET http://localhost:39847/api/v1/auth/profile \
  -H "Authorization: Bearer TOKEN"
```

### Using Postman/Insomnia

1. Import the endpoints from the examples above
2. Set the base URL to `http://localhost:39847/api/v1`
3. For protected endpoints, add `Authorization: Bearer <token>` header

## 🐛 Troubleshooting

### Database Connection Issues
- Check if PostgreSQL is running: `docker-compose ps postgres`
- Verify DATABASE_URL in .env file
- Check database logs: `docker-compose logs postgres`

### Migration Issues
- Run: `cd server && npx prisma migrate deploy`
- Generate Prisma client: `npx prisma generate`

### Port Already in Use
- Change API_PORT in .env file
- Or stop the service using the port

### Validation Errors
- Ensure all required fields are provided
- Check email format
- Password must be at least 6 characters

## 📋 User Roles & Permissions

### Owner
- Full system access
- User management
- Product management
- Inventory management
- Sales management
- Reports
- System settings
- Tenant management

### Manager
- Product management
- Inventory management
- Sales management
- Reports
- Limited user management

### Cashier
- Product viewing
- Inventory viewing
- Sales creation
- Basic reports

## 🎯 Next Steps

1. ✅ User registration - **COMPLETE**
2. ✅ User login - **COMPLETE**
3. ⏭️ Auth0 integration (optional)
4. ⏭️ Multi-factor authentication
5. ⏭️ Password reset functionality
6. ⏭️ Email verification

## 📞 Support

If you encounter any issues:
1. Check the server logs: `docker-compose logs api`
2. Check the health endpoint: `GET /api/v1/auth/health`
3. Verify environment variables are set correctly
4. Ensure database migrations are applied

