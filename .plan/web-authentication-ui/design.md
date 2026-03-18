# Web Authentication UI - Design Document

## Architecture Overview

### Technology Stack
- **Framework**: Next.js 15.5.3 (App Router)
- **Language**: TypeScript 5.x
- **UI Library**: React 19.1.0
- **Styling**: CSS Modules + Tailwind CSS (optional)
- **State Management**: React Context API + Zustand (for complex state)
- **Form Handling**: React Hook Form + Zod validation
- **HTTP Client**: Axios or native Fetch API
- **Routing**: Next.js App Router with middleware
- **Authentication**: JWT tokens stored in localStorage/sessionStorage

### Project Structure
```
client/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Auth route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/         # Protected route group
│   │   │   ├── dashboard/       # Owner/Manager dashboard
│   │   │   ├── pos/              # Cashier POS interface
│   │   │   ├── profile/
│   │   │   └── layout.tsx        # Protected layout
│   │   ├── unauthorized/
│   │   │   └── page.tsx
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx              # Home/landing page
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   └── ResetPasswordForm.tsx
│   │   ├── forms/
│   │   │   ├── Input.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── PasswordInput.tsx
│   │   │   └── FormError.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── Footer.tsx
│   │   ├── feedback/
│   │   │   ├── Toast.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorMessage.tsx
│   │   └── guards/
│   │       ├── AuthGuard.tsx
│   │       ├── RoleGuard.tsx
│   │       └── PermissionGuard.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── AuthProvider.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProtectedRoute.ts
│   │   └── useApi.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   └── interceptors.ts
│   │   ├── auth/
│   │   │   ├── token.ts
│   │   │   ├── storage.ts
│   │   │   └── permissions.ts
│   │   ├── validation/
│   │   │   ├── auth.schema.ts
│   │   │   └── schemas.ts
│   │   └── utils/
│   │       ├── errors.ts
│   │       └── constants.ts
│   ├── middleware.ts            # Next.js middleware for route protection
│   └── types/
│       ├── auth.ts
│       ├── user.ts
│       └── api.ts
├── public/
│   ├── images/
│   └── icons/
└── styles/
    └── globals.css
```

## Component Architecture

### 1. Authentication Context

**AuthContext.tsx**
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}
```

**Responsibilities:**
- Manage authentication state globally
- Provide authentication methods
- Handle token storage and retrieval
- Manage user permissions and roles
- Sync state across components

### 2. API Client

**api/client.ts**
- Axios instance with base configuration
- Request/response interceptors
- Automatic token injection
- Error handling and retry logic
- Request/response logging (dev mode)

**api/auth.ts**
- `register(email, password, name, ...)`
- `login(email, password)`
- `getProfile()`
- `updateProfile(data)`
- `changePassword(currentPassword, newPassword)`
- `forgotPassword(email)`
- `resetPassword(token, newPassword)`

### 3. Route Protection

**Middleware (middleware.ts)**
- Runs on every request
- Checks authentication status
- Validates JWT token
- Redirects unauthenticated users
- Handles token refresh

**Route Guards (components/guards/)**
- `AuthGuard`: Requires authentication
- `RoleGuard`: Requires specific role
- `PermissionGuard`: Requires specific permission

## UI/UX Design

### Design Principles
1. **Simplicity**: Clean, uncluttered interfaces
2. **Speed**: Fast loading and interactions
3. **Clarity**: Clear feedback and error messages
4. **Accessibility**: WCAG 2.1 AA compliant
5. **Responsiveness**: Works on all device sizes
6. **Consistency**: Unified design language

### Color Scheme
- **Primary**: #006A4E (Bangladesh green)
- **Secondary**: #FF6B35 (Accent orange)
- **Success**: #10B981 (Green)
- **Error**: #EF4444 (Red)
- **Warning**: #F59E0B (Amber)
- **Info**: #3B82F6 (Blue)
- **Background**: #F9FAFB (Light gray)
- **Text**: #111827 (Dark gray)

### Typography
- **Font Family**: Inter, system-ui, sans-serif
- **Headings**: 24px, 20px, 18px, 16px
- **Body**: 16px (desktop), 14px (mobile)
- **Labels**: 14px, medium weight
- **Small Text**: 12px

### Spacing System
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64px

### Component Design

#### Login Page
**Layout:**
```
┌─────────────────────────────────────┐
│         [Logo] ZakPOS               │
│                                     │
│    ┌─────────────────────────┐    │
│    │   Welcome Back           │    │
│    │                          │    │
│    │   Email: [___________]   │    │
│    │   Password: [________]   │    │
│    │   [ ] Remember me        │    │
│    │                          │    │
│    │   [    Login Button    ] │    │
│    │                          │    │
│    │   Forgot password?      │    │
│    │   Don't have account?   │    │
│    └─────────────────────────┘    │
│                                     │
│         [Footer Links]              │
└─────────────────────────────────────┘
```

**Features:**
- Centered card layout
- Email and password inputs
- "Remember me" checkbox
- "Forgot password" link
- "Register" link for new owners
- Loading state during authentication
- Error message display
- Mobile-responsive design

#### Registration Page
**Layout:**
```
┌─────────────────────────────────────┐
│         [Logo] ZakPOS               │
│                                     │
│    ┌─────────────────────────┐    │
│    │   Create Account        │    │
│    │                          │    │
│    │   Name: [___________]    │    │
│    │   Email: [___________]   │    │
│    │   Phone: [___________]    │    │
│    │   Password: [________]    │    │
│    │   [Strength Indicator]   │    │
│    │   Confirm: [________]     │    │
│    │   Business: [________]    │    │
│    │                          │    │
│    │   [  Create Account  ]   │    │
│    │                          │    │
│    │   Already have account?  │    │
│    └─────────────────────────┘    │
└─────────────────────────────────────┘
```

**Features:**
- Multi-step form (optional, for better UX)
- Real-time validation
- Password strength indicator
- Field-level error messages
- Success state with redirect
- Invitation token handling (for managers/cashiers)

#### Dashboard (Role-Based)
**Owner Dashboard:**
- Full navigation menu
- Overview cards (sales, inventory, users)
- Quick actions
- Recent activity
- System status

**Manager Dashboard:**
- Operations-focused menu
- Sales and inventory overview
- Staff management (limited)
- Reports access

**Cashier Dashboard:**
- Minimal navigation
- Direct POS access
- Quick product search
- Recent sales

### Form Components

#### Input Component
```typescript
interface InputProps {
  label: string;
  type: 'text' | 'email' | 'password' | 'tel';
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}
```

**Features:**
- Label with required indicator
- Error message display
- Focus states
- Disabled states
- Accessibility attributes

#### Password Input Component
**Features:**
- Show/hide password toggle
- Strength indicator (weak/medium/strong)
- Real-time validation feedback
- Password requirements checklist

#### Button Component
```typescript
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}
```

**States:**
- Default
- Hover
- Active
- Disabled
- Loading (with spinner)

### Feedback Components

#### Toast Notification
- Success, error, warning, info variants
- Auto-dismiss after 5 seconds
- Manual dismiss option
- Stack multiple toasts
- Position: top-right (desktop), top-center (mobile)

#### Loading Spinner
- Full-page overlay for route transitions
- Inline spinner for form submissions
- Button-integrated spinner

#### Error Message
- Inline form errors
- Page-level error banners
- Network error handling
- Retry mechanisms

## Data Flow

### Registration Flow
```
User Input → Form Validation → API Call → Success Response
                ↓                    ↓
            Validation Error    Network Error
                ↓                    ↓
            Show Error          Show Error + Retry
```

### Login Flow
```
User Input → Form Validation → API Call → Token Received
                ↓                    ↓           ↓
            Validation Error    Network Error  Store Token
                ↓                    ↓           ↓
            Show Error          Show Error   Store User Data
                                         ↓
                                    Redirect (Role-Based)
```

### Protected Route Flow
```
Route Access → Check Auth → Valid Token? → Check Role/Permission
                    ↓            ↓              ↓
                No Token    Invalid Token   Unauthorized
                    ↓            ↓              ↓
                Redirect    Refresh Token   Show Error
                to Login        ↓
                          Success? → Allow Access
                              ↓
                          Fail → Redirect to Login
```

## State Management

### Global State (AuthContext)
- `user`: Current user object
- `token`: JWT access token
- `isAuthenticated`: Boolean flag
- `isLoading`: Loading state
- `error`: Error message

### Local State (Components)
- Form inputs
- Validation errors
- UI states (modals, dropdowns)
- Loading states

### Storage Strategy
- **localStorage**: Token (if "Remember me"), user preferences
- **sessionStorage**: Token (if not "Remember me"), temporary data
- **Cookies**: Future CSRF tokens, session IDs

## Security Considerations

### Client-Side Security
1. **Token Storage**: Secure storage, no XSS vulnerabilities
2. **Input Validation**: Client and server-side validation
3. **HTTPS Only**: Enforce HTTPS in production
4. **CSP Headers**: Content Security Policy
5. **XSS Protection**: Sanitize all user inputs
6. **CSRF Protection**: Token-based protection (future)

### Authentication Security
1. **Token Expiration**: Handle token expiration gracefully
2. **Token Refresh**: Automatic refresh before expiration
3. **Secure Logout**: Clear all stored data
4. **Session Management**: Track and manage active sessions
5. **Rate Limiting**: Limit login attempts (handled by API)

## API Integration

### Endpoint Mapping
| UI Action | API Endpoint | Method | Request | Response |
|-----------|--------------|--------|---------|----------|
| Register | `/api/v1/auth/register` | POST | `{name, email, password, role?}` | `{access_token, user}` |
| Login | `/api/v1/auth/login` | POST | `{email, password}` | `{access_token, user}` |
| Get Profile | `/api/v1/auth/profile` | GET | Headers: `Authorization: Bearer TOKEN` | `{id, email, name, role, tenantId}` |
| Update Profile | `/api/v1/users/:id` | PATCH | `{name, phone}` | `{id, email, name, ...}` |
| Change Password | `/api/v1/auth/change-password` | POST | `{currentPassword, newPassword}` | `{message}` |

### Request/Response Handling
- **Request Interceptor**: Add auth token to headers
- **Response Interceptor**: Handle 401 (unauthorized) → refresh/logout
- **Error Handling**: Transform API errors to user-friendly messages
- **Retry Logic**: Automatic retry for network errors

## Error Handling Strategy

### Error Types
1. **Validation Errors**: Field-level errors from form validation
2. **API Errors**: Server-side validation and business logic errors
3. **Network Errors**: Connection issues, timeouts
4. **Authentication Errors**: Invalid credentials, expired tokens
5. **Authorization Errors**: Insufficient permissions

### Error Display
- **Form Errors**: Inline, below input fields
- **API Errors**: Toast notification + inline if form
- **Network Errors**: Toast with retry button
- **Auth Errors**: Redirect to login with message
- **Authz Errors**: Show unauthorized page

## Performance Optimization

### Code Splitting
- Route-based code splitting (automatic with App Router)
- Component lazy loading for heavy components
- Dynamic imports for non-critical features

### Caching Strategy
- Static assets: Long-term caching
- API responses: Short-term caching (user data)
- Token: Stored in memory + storage

### Loading Optimization
- Skeleton screens for initial load
- Progressive enhancement
- Optimistic UI updates
- Prefetching for likely next routes

## Testing Strategy

### Unit Tests
- Form validation logic
- Permission checking functions
- Token management utilities
- API client methods

### Integration Tests
- Authentication flow
- Route protection
- API integration
- Error handling

### E2E Tests (Future)
- Complete registration flow
- Login and logout
- Protected route access
- Role-based navigation

## Accessibility Features

### Keyboard Navigation
- Tab order: Logical flow through form
- Enter: Submit forms
- Escape: Close modals, cancel actions
- Arrow keys: Navigate dropdowns

### Screen Reader Support
- ARIA labels on all interactive elements
- Form field associations
- Error announcements
- Status updates

### Visual Accessibility
- High contrast mode support
- Focus indicators
- Text scaling support
- Color-blind friendly palette

## Responsive Design Breakpoints

### Mobile (< 768px)
- Single column layout
- Stacked form inputs
- Full-width buttons
- Bottom navigation (optional)
- Touch-optimized targets (44px minimum)

### Tablet (768px - 1024px)
- Two-column layout (where appropriate)
- Side-by-side form inputs
- Medium-sized buttons
- Side navigation (collapsible)

### Desktop (> 1024px)
- Multi-column layouts
- Sidebar navigation
- Hover states
- Keyboard shortcuts (future)

## Deployment Considerations

### Environment Variables
- `NEXT_PUBLIC_API_URL`: API base URL
- `NEXT_PUBLIC_APP_ENV`: Environment (dev/staging/prod)
- `NEXT_PUBLIC_APP_NAME`: Application name

### Build Configuration
- Production optimizations enabled
- Source maps disabled in production
- Error tracking integration (Sentry, future)
- Analytics integration (future)

### Docker Integration
- Multi-stage build
- Optimized production image
- Health check endpoint
- Environment variable injection

## Future Enhancements

### Phase 2 Features
- Multi-factor authentication UI
- Social login buttons
- Biometric authentication
- Session management UI
- Activity log viewer
- Advanced security settings

### Phase 3 Features
- Passwordless authentication
- Single Sign-On (SSO)
- Account recovery via SMS
- Email verification flow
- Device management UI

