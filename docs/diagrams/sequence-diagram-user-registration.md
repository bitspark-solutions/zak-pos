# User Registration Sequence Diagram

## Overview

This document shows the sequence diagram for the user registration flow in ZakPos. The registration supports both **public registration** (creates Owner) and **invited registration** (creates Cashier/Manager within a tenant).

---

## Sequence Diagram: User Registration

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 User
    participant FE as 🌐 Frontend<br/>(Next.js)
    participant API as 🖥️ API Server<br/>(NestJS)
    participant Auth0 as 🔐 Auth0<br/>(Optional)
    participant DB as 🗄️ PostgreSQL<br/>(Prisma)
    participant JWT as 🎫 JWT Service

    %% Registration Initiation
    User->>FE: Fill registration form<br/>(name, email, password, phone?)
    Note over User,FE: Fields: name, email, password (min 6 chars), phone (optional)
    User->>FE: Click "Register" button

    %% Frontend submits to API
    FE->>API: POST /auth/register<br/>{name, email, password, phone?, tenantId?, role?}
    Note right of FE: tenantId present = invited user<br/>tenantId absent = public registration

    %% API Validation
    API->>API: Validate RegisterDto<br/>(@IsEmail, @MinLength, etc.)
    alt Validation Failed
        API-->>FE: 400 Bad Request<br/>(validation errors)
    end

    %% Check Existing User
    API->>DB: UsersService.findByEmail(email)
    DB-->>API: User | null

    alt User Already Exists
        API-->>FE: 409 Conflict<br/>("User with this email already exists")
    end

    %% Determine Role
    Note over API: No tenantId → defaultRole = 'owner'<br/>With tenantId → defaultRole = 'cashier'

    %% Auth0 Registration (Optional)
    API->>Auth0: Auth0Service.createUser()<br/>{email, password, name, role, tenantId}
    Auth0-->>API: Success | Error

    alt Auth0 Success
        Note over API: useAuth0Password = true
    else Auth0 Unavailable/Error
        Note over API: Falls back to local password storage
        alt Error is "already exists"
            API-->>FE: 409 Conflict<br/>("User with this email already exists")
        end
    end

    %% Password Hashing
    alt Local Password Storage
        API->>API: bcrypt.hash(password, 10)
        Note over API: Password hashed with salt rounds = 10
    else Auth0-Managed
        Note over API: Store 'auth0-managed' placeholder
    end

    %% Create User in Database
    API->>DB: UsersService.create()<br/>{email, name, hashedPassword, role, tenantId, phone}
    DB->>DB: Create User record
    DB-->>API: User object (without password)

    %% Get Permissions
    API->>API: getUserPermissions(role)
    Note over API: Returns array of permission strings<br/>based on role (owner/manager/cashier)

    %% Generate JWT
    API->>JWT: JwtService.sign(payload)
    Note over JWT: Payload: {sub, email, tenantId, role, permissions}
    JWT-->>API: JWT Token

    %% Return Response
    API-->>FE: 201 Created<br/>{access_token, user: {id, email, name, role, tenantId, permissions}}

    %% Frontend Navigation
    FE->>FE: Store token in localStorage/sessionStorage
    alt role === 'admin'
        FE->>FE: Redirect to /admin-dashboard
    else role === 'owner' || role === 'manager'
        FE->>FE: Redirect to /dashboard
    else role === 'cashier'
        FE->>FE: Redirect to /pos
    end
    FE-->>User: Show dashboard

```

---

## Registration Flow Steps

### Step 1: User Fills Form
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Full name |
| email | email | Yes | Unique email address |
| password | string | Yes | Min 6 characters |
| phone | string | No | Phone number |
| tenantId | string | No | For invited users |
| role | string | No | Override default role |

### Step 2: API Validation
- NestJS class-validator validates DTO
- Returns 400 if validation fails

### Step 3: Duplicate Check
- Checks `UsersService.findByEmail(email)`
- Returns 409 if user exists

### Step 4: Role Assignment Logic
```typescript
const defaultRole = registerDto.tenantId ? 'cashier' : 'owner';
const userRole = registerDto.role || defaultRole;
```

| Scenario | tenantId | Resulting Role |
|----------|----------|----------------|
| Public registration | undefined | owner |
| Invited by owner | "tenant-123" | cashier (or provided role) |

### Step 5: User Creation
- Attempts Auth0 creation first (if configured)
- Falls back to local bcrypt-hashed password
- Creates user in PostgreSQL via Prisma

### Step 6: JWT Generation
```typescript
const payload = {
  email: localUser.email,
  sub: localUser.id,
  tenantId: localUser.tenantId,
  role: localUser.role,
  permissions: permissions,
};
return {
  access_token: jwtService.sign(payload),
  user: { id, email, name, role, tenantId, permissions }
};
```

---

## API Response

### Success (201 Created)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "owner",
    "tenantId": "tenant-1",
    "permissions": [
      "user:create", "user:read", "user:update", "user:delete",
      "product:create", "product:read", "product:update", "product:delete",
      "inventory:create", "inventory:read", "inventory:update", "inventory:delete",
      "sale:create", "sale:read", "sale:update", "sale:delete",
      "report:read", "report:export",
      "tenant:manage"
    ]
  }
}
```

### Error Responses

| Status | Error | When |
|--------|-------|------|
| 400 | Bad Request | Validation failed |
| 409 | Conflict | Email already exists |

---

## Frontend Redirect Logic

```typescript
if (response.user.role === 'admin') {
  router.push(ROUTES.ADMIN_DASHBOARD);
} else if (response.user.role === 'owner' || response.user.role === 'manager') {
  router.push(ROUTES.DASHBOARD);
} else if (response.user.role === 'cashier') {
  router.push(ROUTES.POS);
} else {
  router.push(ROUTES.DASHBOARD);
}
```

| Role | Redirect To |
|------|-------------|
| admin | /admin-dashboard |
| owner | /dashboard |
| manager | /dashboard |
| cashier | /pos |

---

## Permission Matrix by Role

| Permission | Owner | Manager | Cashier |
|------------|-------|---------|---------|
| user:create | ✅ | ❌ | ❌ |
| user:read | ✅ | ✅ | ❌ |
| user:update | ✅ | ✅ | ❌ |
| user:delete | ✅ | ❌ | ❌ |
| product:create | ✅ | ✅ | ❌ |
| product:read | ✅ | ✅ | ✅ |
| product:update | ✅ | ✅ | ❌ |
| product:delete | ✅ | ✅ | ❌ |
| inventory:* | ✅ | ✅ | read only |
| sale:* | ✅ | ✅ | create, read |
| invoice:* | ✅ | ✅ | read, send, confirm |
| report:read | ✅ | ✅ | ✅ |
| report:export | ✅ | ❌ | ❌ |
| tenant:manage | ✅ | ❌ | ❌ |

---

## Related Documents

- [UI-DOC-05: Owner Login](./UI-DOC-05-OWNER-LOGIN.md)
- [UI-DOC-01: Admin Login](./UI-DOC-01-ADMIN-LOGIN.md)
- [UI-DOC-14: User Management](./UI-DOC-14-USER-MANAGEMENT.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-23 | Claude | Initial diagram creation |
