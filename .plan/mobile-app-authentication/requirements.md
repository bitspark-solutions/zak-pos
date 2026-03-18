# Mobile App Authentication - Requirements

## Feature Overview
Implement secure login and registration functionality for the ZakPOS mobile app using React Native/Expo, integrating with the existing NestJS backend API.

## Functional Requirements

### Login
- User can log in with email and password
- Validate email format and password requirements
- Display loading state during authentication
- Show error messages for invalid credentials
- Store JWT token securely after successful login
- Redirect to main app after successful login

### Registration
- User can register with name, email, password, and optional phone
- Validate all required fields
- Display loading state during registration
- Show error messages for validation failures or existing users
- Auto-login after successful registration
- Store JWT token securely

### Authentication State Management
- Maintain authentication state across app restarts
- Check token validity on app launch
- Provide logout functionality
- Clear stored tokens on logout

### Security
- Store tokens using Expo SecureStore
- Include JWT token in API requests
- Handle token expiration gracefully
- Secure password input fields

## Non-Functional Requirements

### Performance
- Login/registration should complete within 2 seconds
- Smooth UI transitions without blocking

### Usability
- Clear error messages
- Loading indicators during async operations
- Form validation with real-time feedback
- Accessible UI components

### Security
- No sensitive data in logs
- Secure token storage
- HTTPS API communication (production)

## Technical Stack

### Mobile App
- **Framework**: React Native 0.81.4
- **Platform**: Expo SDK 54
- **Navigation**: Expo Router 6.0.0
- **State Management**: React Context API
- **Secure Storage**: expo-secure-store
- **HTTP Client**: Native fetch API
- **Form Validation**: Custom validation or react-hook-form

### Backend Integration
- **API Base URL**: `http://localhost:39847/api/v1` (development)
- **Login Endpoint**: `POST /auth/login`
- **Register Endpoint**: `POST /auth/register`
- **Profile Endpoint**: `GET /auth/profile` (protected)

## API Contracts

### Login Request
```typescript
POST /api/v1/auth/login
Body: {
  email: string;
  password: string;
}
```

### Login Response
```typescript
{
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    permissions: string[];
  }
}
```

### Register Request
```typescript
POST /api/v1/auth/register
Body: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  tenantId?: string;
  role?: string;
}
```

### Register Response
```typescript
{
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    permissions: string[];
  }
}
```

## User Stories

1. **As a cashier**, I want to log in with my email and password so I can access the POS system.
2. **As a new business owner**, I want to register an account so I can start using ZakPOS.
3. **As a user**, I want to stay logged in across app restarts so I don't have to log in repeatedly.
4. **As a user**, I want clear error messages when login fails so I know what went wrong.
5. **As a user**, I want to log out securely so my account remains protected.

## Acceptance Criteria

- [ ] User can successfully log in with valid credentials
- [ ] User sees error message for invalid credentials
- [ ] User can register a new account
- [ ] User sees error message if email already exists
- [ ] Token is stored securely and persists across app restarts
- [ ] User is automatically logged in if valid token exists
- [ ] User can log out and is redirected to login screen
- [ ] All form fields are validated before submission
- [ ] Loading states are shown during API calls
- [ ] Error messages are user-friendly and actionable

## Constraints

- Must work on both iOS and Android
- Must integrate with existing NestJS backend
- Must use Expo Router for navigation
- Must follow existing code style and patterns
- No offline authentication (requires network connection)

