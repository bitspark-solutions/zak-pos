# UI-DOC-05: Owner Login Page

## Document Info
- **Document ID**: UI-DOC-05
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner
- **Page Type**: Authentication

---

## 1. Page Overview

### Page Purpose
The Owner Login page is the entry point for business owners to access their ZakPos dashboard. This page provides secure authentication for managing their business operations including products, inventory, sales, employees, and invoices.

### Page Description
A clean, professional login interface designed for business owners. The design balances ease of use with security, featuring a brand-focused aesthetic that showcases the business owner's store identity.

### URL Pattern
- **Development**: `http://localhost:3000/login`
- **Production**: `/login`

### Access Control
- Public access (no authentication required)
- Redirects to Dashboard if already authenticated as owner/manager
- Shows different dashboard options based on role

---

## 2. Visual Design

### Layout Structure
```
+--------------------------------------------------+
|                    [EMPTY]                       |
|                                                  |
|              [ZAKPOS LOGO/BRAND]                 |
|                                                  |
|           "Welcome Back"  (Heading)              |
|           "Sign in to your business"            |
|                                                  |
|     +--------------------------------------+     |
|     |         Email Address Field          |     |
|     |  [____________________________]     |     |
|     +--------------------------------------+     |
|                                                  |
|     +--------------------------------------+     |
|     |           Password Field              |     |
|     |  [____________________________]     |     |
|     +--------------------------------------+     |
|                                                  |
|     [ ] Remember me                               |
|                                                  |
|     +--------------------------------------+     |
|     |           SIGN IN BUTTON             |     |
|     +--------------------------------------+     |
|                                                  |
|           "Forgot password?"  (Link)            |
|                                                  |
|                    [EMPTY]                       |
|                                                  |
|  +--------------------------------------------+  |
|  |  Don't have an account? [Contact Admin]    |  |
|  +--------------------------------------------+  |
|                                                  |
+--------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Page Background | White | #FFFFFF |
| Card Background | White | #FFFFFF |
| Primary Brand | Deep Blue | #1E40AF |
| Primary Button | Blue | #2563EB |
| Button Hover | Dark Blue | #1D4ED8 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |
| Text Muted | Light Gray | #9CA3AF |
| Border | Light Gray | #E5E7EB |
| Error | Red | #DC2626 |
| Success | Green | #059669 |
| Link | Blue | #2563EB |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Logo | Inter | 36px | Bold (700) |
| Heading | Inter | 28px | Bold (700) |
| Subheading | Inter | 16px | Regular (400) |
| Input Label | Inter | 14px | Medium (500) |
| Input Text | Inter | 16px | Regular (400) |
| Button Text | Inter | 16px | Semibold (600) |
| Link Text | Inter | 14px | Medium (500) |
| Footer Text | Inter | 14px | Regular (400) |

### Spacing System
- Page padding: 24px
- Card max-width: 400px
- Section gap: 20px
- Input field gap: 16px
- Button height: 48px
- Input height: 48px
- Border radius: 10px

### Visual Effects
- Subtle card shadow: `0 4px 6px -1px rgba(0,0,0,0.1)`
- Focus ring: `0 0 0 3px rgba(37,99,235,0.3)`
- Transitions: 150ms ease

---

## 3. Form Fields

### Field 1: Email Address
| Attribute | Value |
|-----------|-------|
| Field ID | email |
| Label | Email Address |
| Type | email |
| Placeholder | owner@business.com |
| Required | Yes |
| Autocomplete | email |
| Validation | Must be valid email format |

**States:**
- Default: Gray border (#E5E7EB)
- Focus: Blue border (#2563EB) with focus ring
- Error: Red border (#DC2626) with error message
- Disabled: Gray background (#F3F4F6)

### Field 2: Password
| Attribute | Value |
|-----------|-------|
| Field ID | password |
| Label | Password |
| Type | password |
| Placeholder | Enter your password |
| Required | Yes |
| Autocomplete | current-password |
| Show/Hide Toggle | Yes (eye icon) |

**States:**
- Default: Gray border (#E5E7EB)
- Focus: Blue border (#2563EB) with focus ring
- Error: Red border (#DC2626) with error message
- Filled: Normal with visibility toggle

### Field 3: Remember Me
| Attribute | Value |
|-----------|-------|
| Field ID | rememberMe |
| Label | Remember me for 30 days |
| Type | checkbox |
| Default | Unchecked |

---

## 4. User Interactions & Flows

### Primary Flow: Owner Login
```
1. Owner navigates to /login
2. Owner enters email address
3. Owner enters password
4. Owner optionally checks "Remember me"
5. Owner clicks "Sign In"
6. System validates credentials
   - If valid: Redirect based on role
     * owner → /dashboard
     * manager → /dashboard
     * cashier → /pos
   - If invalid: Show error message
7. On success:
   - JWT token stored appropriately
   - User data stored in context
   - Redirect to role-appropriate page
```

### Redirect Logic (Post-Login)
| Role | Redirect Destination |
|------|---------------------|
| admin | /admin-dashboard |
| owner | /dashboard |
| manager | /dashboard |
| cashier | /pos |

### Error States
| Scenario | Error Message | Visual Treatment |
|----------|---------------|------------------|
| Empty email | "Email address is required" | Red border, error text below field |
| Invalid email | "Please enter a valid email address" | Red border, error text below field |
| Empty password | "Password is required" | Red border, error text below field |
| Wrong credentials | "Invalid email or password" | Red text below form, subtle shake |
| Account locked | "Account locked. Try again in X minutes" | Red text below form |
| Network error | "Connection error. Please check your internet." | Red text below form |

### Loading State
- Button shows spinner icon
- Button text: "Signing in..."
- Inputs disabled
- Button disabled

---

## 5. Data Handling

### Form Submission
- **Endpoint**: POST /api/v1/auth/login
- **Content-Type**: application/json

### Request Payload
```json
{
  "email": "owner@fashionstore.com",
  "password": "securePassword123",
  "rememberMe": false
}
```

### Success Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_456def",
    "email": "owner@fashionstore.com",
    "name": "John Doe",
    "phone": "+8801712345678",
    "role": "owner",
    "tenantId": "tnant_123abc",
    "tenant": {
      "id": "tnant_123abc",
      "name": "Fashion Store",
      "plan": "pro"
    },
    "permissions": [
      "product:create",
      "product:read",
      "product:update",
      "product:delete",
      "inventory:create",
      "inventory:read",
      "inventory:update",
      "sale:create",
      "sale:read",
      "sale:update",
      "invoice:create",
      "invoice:read",
      "invoice:update",
      "invoice:send",
      "invoice:confirm",
      "user:create",
      "user:read",
      "user:update",
      "report:read",
      "report:export",
      "tenant:manage"
    ]
  }
}
```

### Token Storage
- If "Remember me" checked: localStorage (30 days)
- If not checked: sessionStorage (session only)

---

## 6. Component Specifications

### Logo Component
- **Image**: ZakPos Logo (SVG/PNG)
- **Size**: 48px height
- **Position**: Centered above heading

### Heading Component
- **Text**: "Welcome Back"
- **Style**: 28px, Bold, #1F2937
- **Alignment**: Center

### Subheading Component
- **Text**: "Sign in to your business"
- **Style**: 16px, Regular, #6B7280
- **Alignment**: Center

### Input Field Component
- **Height**: 48px
- **Padding**: 12px 16px
- **Border**: 1px solid #E5E7EB
- **Border Radius**: 10px
- **Font Size**: 16px
- **Focus**: Border #2563EB, Ring 3px #2563EB/30%

### Password Toggle
- **Icon**: Eye (show) / Eye-off (hide)
- **Position**: Right inside input
- **Size**: 20px
- **Color**: #6B7280
- **Click**: Toggle visibility

### Primary Button
- **Height**: 48px
- **Width**: 100%
- **Background**: #2563EB
- **Text**: "Sign In" (white, 16px, semibold)
- **Border Radius**: 10px
- **Hover**: #1D4ED8
- **Loading**: Spinner + "Signing in..."

### Checkbox
- **Size**: 18px x 18px
- **Border**: 2px solid #D1D5DB
- **Checked**: #2563EB fill with white checkmark
- **Label Gap**: 10px

### Link
- **Text**: "Forgot password?"
- **Color**: #2563EB
- **Hover**: #1D4ED8, underline

### Footer
- **Text**: "Don't have an account?"
- **Link**: "Contact Admin"
- **Style**: 14px, centered

### Error Alert
- **Background**: #FEF2F2
- **Border**: 1px solid #FECACA
- **Border Radius**: 8px
- **Padding**: 12px 16px
- **Icon**: Red exclamation
- **Text**: #DC2626, 14px

---

## 7. Additional Features

### OAuth Options (Optional)
**Divider Text:** "or continue with"
**Buttons:**
- Google (Google G logo)
- Auth0 (if configured)

### Branding Element
- Optional: Display tenant/business logo if known
- Show "Signing in to [Business Name]" subtitle

---

## 8. Responsive Design

### Desktop (>768px)
- Max width: 400px
- Centered in viewport
- Padding: 48px

### Mobile (<768px)
- Full width with 24px padding
- Button: Full width
- Logo: 40px height

---

## 9. Accessibility

- All inputs have visible labels (or aria-label)
- Error messages linked with aria-describedby
- Focus indicators visible
- Keyboard navigation (Tab, Enter)
- Screen reader announcements for errors

---

## 10. Google Snitch Prompts

### Prompt 1: Basic Owner Login
```
Create a clean, professional login page for a business owner POS system.
Center card layout (max 400px) on white background.
At top: ZakPos logo centered (text "ZakPos" in bold blue or simple geometric logo).
Heading: "Welcome Back" (28px bold, dark gray).
Subtitle: "Sign in to your business" (16px, gray).
Email input: Full width, 48px height, 10px border radius, placeholder "owner@business.com".
Password input: Same styling with eye icon toggle for show/hide.
"Remember me for 30 days" checkbox below.
Full width blue "Sign In" button (48px height, 10px radius).
"Forgot password?" link centered below button in blue.
Bottom text: "Don't have an account? Contact Admin" with link.
Clean modern design, Inter font, blue (#2563EB) primary color.
Error messages appear above button in red alert box.
```

### Prompt 2: Business Login with OAuth Options
```
Design a business login page with these elements:
1. ZakPos logo at top (geometric Z shape or text logo, blue #2563EB)
2. "Welcome Back" heading centered below logo
3. Email input field (full width, 48px height, rounded corners)
4. Password field with visibility toggle (eye icon)
5. "Remember me" checkbox aligned left
6. Blue "Sign In" button (full width)
7. "Forgot password?" link below button
8. Divider: "or continue with" with line
9. OAuth buttons: Google (red "G") and Auth0 options side by side
10. Bottom text: "New business? Contact Admin to get started"
Style: Modern SaaS login like Stripe/Linear.
Colors: White bg, blue primary, gray text hierarchy.
Typography: Inter font throughout.
```

### Prompt 3: Complete Owner Login Interface
```
Create a polished login page for a retail POS platform called ZakPos.
Layout: Centered card on white background, max 400px width.
Top section: ZakPos brand logo centered (48px), subtle shadow.
Center section:
  - "Welcome Back" title (28px bold)
  - "Sign in to manage your business" subtitle (14px gray)
  - Email input with mail icon prefix
  - Password input with lock icon prefix and eye toggle suffix
  - Small "Remember me" checkbox
  - Full width blue "Sign In" button (16px semibold white text)
  - "Forgot your password?" text link below (blue)
Bottom section:
  - Divider with "or"
  - "Contact Admin" link for new accounts
Form validation: Red border and error text below field for invalid input.
Loading state: Button shows spinner, "Signing in..." text.
Success state: Green checkmark, redirect to dashboard.
Responsive: Full width on mobile with 24px padding.
Modern clean aesthetic with subtle shadows and rounded corners (10px).
```

---

## 11. Related Documents

- [UI-DOC-01: Admin Login](./UI-DOC-01-ADMIN-LOGIN.md)
- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-07: Owner Onboard User](./UI-DOC-07-OWNER-ONBOARD-USER.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
