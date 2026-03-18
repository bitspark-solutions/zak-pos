# Web Authentication UI - Requirements

## Feature Overview

This feature implements a comprehensive authentication user interface for the ZakPOS web application using Next.js 15 with App Router. The UI provides secure, role-based authentication flows for three distinct user types (Owner, Manager, Cashier) with complete registration, login, session management, and protected route handling.

## Business Context

ZakPOS serves Bangladeshi shopkeepers who need:
- **Quick and secure access** to their POS system
- **Role-based interfaces** that match their responsibilities
- **Multi-device support** with consistent authentication
- **Local language support** (English/Bengali) for accessibility
- **Mobile-responsive design** for tablet/phone usage in shops

## User Types & Personas

### 1. Owner (Business Owner)
**Profile:**
- Shop owner who manages the entire business
- Needs full system access for setup, configuration, and oversight
- May operate from office/home, accessing via desktop/laptop
- Requires comprehensive reporting and user management

**Key Needs:**
- Complete system control
- User management (create/manage staff)
- System configuration
- Financial oversight
- Multi-location management (future)

### 2. Manager (Store Manager)
**Profile:**
- Day-to-day operations manager
- Handles inventory, staff scheduling, and sales oversight
- Works primarily in-store, may use tablet/desktop
- Needs operational control without system-level access

**Key Needs:**
- Product and inventory management
- Sales oversight and reporting
- Staff management (limited)
- Daily operations control
- Performance monitoring

### 3. Cashier (Sales Staff)
**Profile:**
- Front-line sales staff operating POS terminals
- Works primarily on tablets/mobile devices at checkout
- Needs fast, simple interface for sales operations
- Minimal training required

**Key Needs:**
- Quick login for shift start
- Fast access to POS interface
- Product lookup and sales processing
- Basic inventory visibility
- Simple, intuitive interface

## Functional Requirements

### 1. User Registration Flow

#### 1.1 Public Registration (Owner Only)
- **Access**: Public endpoint (no authentication required)
- **Purpose**: Allow business owners to create their ZakPOS account
- **Workflow**:
  1. User navigates to `/register`
  2. System displays registration form
  3. User enters:
     - Full name (required, 2-100 characters)
     - Email address (required, valid email format, unique)
     - Password (required, minimum 8 characters, must contain uppercase, lowercase, number)
     - Confirm password (required, must match)
     - Phone number (optional, valid format)
     - Business name (optional, for tenant creation)
  4. System validates input in real-time
  5. User submits form
  6. System creates account with default role: `owner`
  7. System creates default tenant if business name provided
  8. System generates JWT token
  9. System redirects to onboarding flow or dashboard
  10. System sends welcome email (future enhancement)

#### 1.2 Invited Registration (Manager/Cashier)
- **Access**: Via invitation link with token
- **Purpose**: Allow owners/managers to invite staff
- **Workflow**:
  1. Owner/Manager sends invitation (via user management UI - future)
  2. Invitee receives email/SMS with invitation link
  3. User clicks link: `/register?token=INVITATION_TOKEN`
  4. **SECURITY**: System validates invitation token via API (server-side validation)
  5. **SECURITY**: System retrieves role and tenant from validated token (NOT from URL parameters)
  6. **SECURITY**: System ensures role is NEVER "owner" from invitation (owner registration is public only)
  7. System pre-fills role and tenant information (from validated token response)
  8. User completes registration form (name, email, password)
  9. **SECURITY**: System sends role from validated token to API (NOT from user input or URL)
  10. System creates account with server-validated role
  11. System links user to tenant
  12. System redirects to appropriate dashboard

#### 1.3 Registration Validation Rules
- **Email**: 
  - Must be valid email format
  - Must be unique across system
  - Real-time validation with API check
- **Password**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - Special characters optional but recommended
  - Password strength indicator (weak/medium/strong)
- **Name**:
  - 2-100 characters
  - No special characters except spaces, hyphens, apostrophes
- **Phone** (optional):
  - Valid international format
  - Supports Bangladesh phone numbers (+880)

#### 1.4 Registration Error Handling
- **Duplicate Email**: Clear error message with suggestion to login
- **Weak Password**: Real-time feedback with requirements
- **Network Error**: Retry mechanism with offline detection
- **Invalid Invitation**: Clear error with contact information
- **Server Error**: User-friendly message with support contact

### 2. User Login Flow

#### 2.1 Standard Login (All User Types)
- **Access**: Public endpoint `/login`
- **Purpose**: Authenticate existing users
- **Workflow**:
  1. User navigates to `/login` or protected route redirects
  2. System displays login form
  3. User enters:
     - Email address
     - Password
  4. Optional: "Remember me" checkbox (extends session)
  5. User submits form
  6. System shows loading state
  7. System validates credentials via API
  8. On success:
     - System stores JWT token (localStorage/sessionStorage)
     - System stores user data (role, permissions, tenantId)
     - System redirects based on role:
       - Owner → `/dashboard` (admin dashboard)
       - Manager → `/dashboard` (operations dashboard)
       - Cashier → `/pos` (POS interface)
  9. On failure:
     - System displays error message
     - System allows retry
     - System offers "Forgot Password" link

#### 2.2 Role-Based Post-Login Routing
- **Owner**:
  - Primary: `/dashboard` (admin dashboard)
  - Alternative: Last visited page (if remembered)
- **Manager**:
  - Primary: `/dashboard` (operations dashboard)
  - Alternative: `/inventory` or `/sales` (based on preferences)
- **Cashier**:
  - Primary: `/pos` (POS checkout interface)
  - Alternative: `/sales` (if no active POS session)

#### 2.3 Login Error Handling
- **Invalid Credentials**: Generic message (security best practice)
- **Account Suspended**: Clear message with contact information
- **Network Error**: Retry with offline detection
- **Token Expired**: Automatic redirect to login
- **Account Locked**: Message with unlock instructions

#### 2.4 Session Management
- **Token Storage**: 
  - localStorage for "Remember me"
  - sessionStorage for regular sessions
- **Token Refresh**: Automatic refresh before expiration
- **Session Timeout**: Warning at 5 minutes before expiration
- **Multiple Tabs**: Synchronized session across tabs
- **Logout**: Clear all session data and redirect to login

### 3. Protected Route Handling

#### 3.1 Route Protection Levels
- **Public Routes**: `/login`, `/register`, `/forgot-password`, `/reset-password`
- **Authenticated Routes**: All routes except public (require valid JWT)
- **Role-Based Routes**: 
  - Owner-only: `/admin/*`, `/settings/*`, `/users/*`
  - Manager+: `/inventory/*`, `/reports/*`
  - Cashier+: `/pos/*`, `/sales/*`

#### 3.2 Route Guard Implementation
- **Middleware**: Next.js middleware for route protection
- **Client-Side Guards**: React components for fine-grained control
- **Permission Checks**: Component-level permission validation
- **Redirect Logic**: 
  - Unauthenticated → `/login?redirect=/requested-path`
  - Unauthorized → `/unauthorized`
  - Role mismatch → Role-appropriate dashboard

#### 3.3 Protected Route Workflow
1. User navigates to protected route
2. System checks authentication status
3. If not authenticated:
   - Store intended destination
   - Redirect to `/login`
4. If authenticated:
   - Check token validity
   - If expired: Attempt refresh, else redirect to login
   - Check role/permissions
   - If authorized: Render page
   - If unauthorized: Show error or redirect

### 4. User Profile & Settings

#### 4.1 Profile View
- **Access**: `/profile` (all authenticated users)
- **Display**:
  - Name, email, phone
  - Role and permissions
  - Tenant information
  - Account creation date
  - Last login time
- **Actions**:
  - Edit profile (name, phone)
  - Change password
  - View activity log (future)

#### 4.2 Profile Update
- **Editable Fields**: Name, phone number
- **Non-Editable**: Email (requires separate process), role (admin only)
- **Validation**: Same rules as registration
- **Success Feedback**: Toast notification with confirmation

#### 4.3 Password Change
- **Access**: `/profile/change-password` or modal
- **Requirements**:
  - Current password (required)
  - New password (same rules as registration)
  - Confirm new password
- **Security**: 
  - Rate limiting (max 5 attempts per hour)
  - Password history (prevent reuse of last 5 passwords)
- **Success**: Logout and redirect to login

### 5. Logout Flow

#### 5.1 Standard Logout
- **Access**: Logout button in navigation (all pages)
- **Workflow**:
  1. User clicks logout
  2. System shows confirmation dialog (optional)
  3. System clears:
     - JWT token
     - User data
     - Session storage
     - Local storage (if not "Remember me")
  4. System invalidates session on server (future)
  5. System redirects to `/login`
  6. System shows "Logged out successfully" message

#### 5.2 Automatic Logout
- **Token Expiration**: Automatic logout when token expires
- **Inactivity**: Logout after 30 minutes of inactivity (configurable)
- **Security**: Logout on suspicious activity (future)

### 6. Password Recovery

#### 6.1 Forgot Password Flow
- **Access**: `/forgot-password` or link from login
- **Workflow**:
  1. User enters email address
  2. System validates email exists
  3. System generates reset token (secure, time-limited)
  4. System sends reset email (future: SMS option)
  5. System shows success message (don't reveal if email exists)
  6. User checks email for reset link

#### 6.2 Reset Password Flow
- **Access**: `/reset-password?token=RESET_TOKEN`
- **Workflow**:
  1. User clicks reset link from email
  2. System validates reset token
  3. If valid:
     - System displays password reset form
     - User enters new password (twice)
     - System validates password strength
     - User submits
     - System updates password
     - System invalidates reset token
     - System redirects to login
  4. If invalid/expired:
     - System shows error message
     - System offers to request new reset link

### 7. Multi-Device & Session Management

#### 7.1 Device Recognition
- **Device Fingerprinting**: Browser/device identification
- **Device List**: View active devices in profile
- **Device Management**: Revoke access from specific devices (Owner/Manager)

#### 7.2 Concurrent Sessions
- **Multiple Devices**: Allow login from multiple devices
- **Session Limit**: Configurable per role (Owner: unlimited, Manager: 3, Cashier: 1)
- **Session Monitoring**: Active sessions display in profile

### 8. Error States & Edge Cases

#### 8.1 Network Errors
- **Offline Detection**: Detect when API is unreachable
- **Retry Mechanism**: Automatic retry with exponential backoff
- **Offline Queue**: Queue requests when offline (future)
- **User Feedback**: Clear error messages with retry options

#### 8.2 Token Expiration
- **Automatic Refresh**: Refresh token before expiration
- **Refresh Failure**: Redirect to login with message
- **Expired Token**: Clear session and redirect

#### 8.3 Invalid States
- **Corrupted Token**: Clear and redirect to login
- **Missing Permissions**: Show unauthorized page
- **Account Suspended**: Show suspension message with contact info

## Non-Functional Requirements

### 1. Performance
- **Initial Load**: < 2 seconds for login page
- **API Response**: < 500ms for authentication requests
- **Form Validation**: Real-time, < 100ms feedback
- **Route Transitions**: Smooth, < 300ms navigation

### 2. Security
- **Password Storage**: Never stored in plain text (handled by API)
- **Token Security**: Secure storage, HTTP-only cookies (future)
- **XSS Protection**: Input sanitization, CSP headers
- **CSRF Protection**: Token-based CSRF protection
- **Rate Limiting**: Login attempts limited (5 per 15 minutes)
- **Password Policy**: Enforced client and server-side

### 3. Accessibility
- **WCAG 2.1 AA Compliance**: Full keyboard navigation
- **Screen Reader Support**: ARIA labels, semantic HTML
- **Color Contrast**: Minimum 4.5:1 ratio
- **Focus Management**: Clear focus indicators
- **Error Announcements**: Screen reader accessible errors

### 4. Responsive Design
- **Mobile**: 320px - 768px (primary for cashiers)
- **Tablet**: 768px - 1024px (common in shops)
- **Desktop**: 1024px+ (owners/managers)
- **Touch Targets**: Minimum 44x44px on mobile
- **Layout Adaptation**: Responsive forms and navigation

### 5. Internationalization
- **Languages**: English (default), Bengali (future)
- **Date/Time**: Locale-aware formatting
- **Currency**: BDT formatting for Bangladesh
- **RTL Support**: Ready for RTL languages (future)

### 6. Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Graceful Degradation**: Basic functionality on older browsers

## Integration Points

### 1. API Integration
- **Base URL**: `http://localhost:39847/api/v1` (configurable)
- **Endpoints**:
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login
  - `GET /auth/profile` - Get user profile
  - `POST /auth/refresh` - Refresh token (future)
  - `POST /auth/logout` - Logout (future)
  - `POST /auth/forgot-password` - Request password reset (future)
  - `POST /auth/reset-password` - Reset password (future)

### 2. State Management
- **Authentication State**: React Context or Zustand
- **User Data**: Stored in context, synced with API
- **Token Management**: Secure storage with automatic refresh
- **Route State**: Next.js router for navigation state

### 3. UI Components
- **Form Components**: Reusable input, button, validation components
- **Layout Components**: Header, sidebar, footer
- **Feedback Components**: Toast notifications, loading states, error messages
- **Navigation**: Role-based navigation menu

## User Stories

### Owner User Stories

**US-O-1: Registration**
> As an **Owner**, I want to register my business account so that I can start using ZakPOS to manage my shop.

**Acceptance Criteria:**
- Owner can access public registration page
- Owner can enter business and personal information
- System creates owner account with full permissions
- Owner is redirected to onboarding/dashboard after registration

**US-O-2: Login & Dashboard Access**
> As an **Owner**, I want to login and access the admin dashboard so that I can manage my business operations.

**Acceptance Criteria:**
- Owner can login with email and password
- Owner is redirected to admin dashboard after login
- Owner sees all available features and menus
- Owner can access user management, settings, and reports

**US-O-3: User Management**
> As an **Owner**, I want to manage staff accounts so that I can control who has access to the system.

**Acceptance Criteria:**
- Owner can view all users in their tenant
- Owner can create new user accounts (Manager/Cashier)
- Owner can edit user roles and permissions
- Owner can suspend/activate user accounts

### Manager User Stories

**US-M-1: Invited Registration**
> As a **Manager**, I want to register via invitation link so that I can access the system with appropriate permissions.

**Acceptance Criteria:**
- Manager receives invitation link via email/SMS
- Manager can complete registration with pre-filled role
- Manager is linked to correct tenant
- Manager is redirected to operations dashboard

**US-M-2: Operations Dashboard**
> As a **Manager**, I want to access the operations dashboard so that I can manage daily operations.

**Acceptance Criteria:**
- Manager can login and access dashboard
- Manager sees inventory, sales, and reports sections
- Manager cannot access admin/settings sections
- Manager can manage products and inventory

**US-M-3: Staff Management (Limited)**
> As a **Manager**, I want to view and update staff information so that I can manage my team.

**Acceptance Criteria:**
- Manager can view all users in tenant
- Manager can update user information (name, phone)
- Manager cannot change roles or delete users
- Manager can see user activity logs

### Cashier User Stories

**US-C-1: Quick Login**
> As a **Cashier**, I want to quickly login to the POS system so that I can start processing sales.

**Acceptance Criteria:**
- Cashier can login with email and password
- Cashier is redirected directly to POS interface
- Login process is fast (< 3 seconds)
- Cashier can use "Remember me" for faster subsequent logins

**US-C-2: POS Access**
> As a **Cashier**, I want to access only the POS interface so that I can focus on sales.

**Acceptance Criteria:**
- Cashier is redirected to POS after login
- Cashier cannot access admin or management sections
- Cashier can view products and inventory (read-only)
- Cashier can process sales transactions

**US-C-3: Simple Interface**
> As a **Cashier**, I want a simple, intuitive interface so that I can work efficiently without training.

**Acceptance Criteria:**
- Interface is clean and uncluttered
- Navigation is minimal and clear
- Error messages are user-friendly
- Mobile/tablet optimized for touch

## Acceptance Criteria Summary

### Registration
- ✅ Public registration available for owners
- ✅ Invitation-based registration for managers/cashiers
- ✅ Real-time form validation
- ✅ Password strength indicator
- ✅ Clear error messages
- ✅ Success redirect to appropriate dashboard

### Login
- ✅ Email/password authentication
- ✅ "Remember me" functionality
- ✅ Role-based post-login routing
- ✅ Token management and refresh
- ✅ Error handling with retry
- ✅ Forgot password link

### Protected Routes
- ✅ Authentication required for all protected routes
- ✅ Role-based access control
- ✅ Permission-based component rendering
- ✅ Unauthorized access handling
- ✅ Token expiration handling

### User Experience
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Loading states and feedback
- ✅ Error messages and recovery
- ✅ Smooth navigation and transitions
- ✅ Accessibility compliance

## Constraints & Assumptions

### Constraints
- Must work with existing NestJS API
- Must use Next.js 15 App Router
- Must support existing JWT token structure
- Must work with current role/permission system
- Must be compatible with Docker deployment

### Assumptions
- API endpoints are stable and won't change
- JWT token structure includes role and permissions
- Users have modern browsers with JavaScript enabled
- Network connectivity is generally available
- Email service for password reset will be implemented later

## Out of Scope (Future Enhancements)
- Multi-factor authentication (2FA)
- Social login (Google, Facebook)
- Biometric authentication
- Single Sign-On (SSO)
- Passwordless authentication
- Account recovery via SMS
- Email verification
- Session management UI (view/revoke sessions)
- Activity logging UI
- Advanced security settings

