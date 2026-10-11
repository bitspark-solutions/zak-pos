# UI-DOC-01: Admin Login Page

## Document Info
- **Document ID**: UI-DOC-01
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Admin
- **Page Type**: Authentication

---

## 1. Page Overview

### Page Purpose
The Admin Login page is the entry point for platform administrators to access the ZakPOS management console. This page provides secure authentication for managing tenants, owners, and platform-wide settings.

### Page Description
A clean, professional login interface designed for internal platform administrators. The design emphasizes security and simplicity, allowing admins to quickly access the management dashboard.

### URL Pattern
- **Development**: `http://localhost:3000/admin-login`
- **Production**: `/admin-login`

### Access Control
- Public access (no authentication required)
- Redirects to Admin Dashboard if already authenticated

---

## 2. Visual Design

### Layout Structure
```
+--------------------------------------------------+
|                    [EMPTY]                       |
|                                                  |
|              [ZAKPOS LOGO/BRAND]                 |
|                                                  |
|           "Admin Portal"  (Heading)              |
|           "Sign in to manage platform"            |
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
|     [ ] Remember me for 30 days                  |
|                                                  |
|     +--------------------------------------+     |
|     |           SIGN IN BUTTON             |     |
|     +--------------------------------------+     |
|                                                  |
|           "Forgot password?"  (Link)              |
|                                                  |
|                    [EMPTY]                       |
|                                                  |
+--------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Primary Background | White | #FFFFFF |
| Secondary Background | Light Gray | #F8FAFC |
| Primary Brand Color | Deep Blue | #1E40AF |
| Primary Button | Blue | #2563EB |
| Button Hover | Dark Blue | #1D4ED8 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |
| Text Muted | Light Gray | #9CA3AF |
| Error | Red | #DC2626 |
| Success | Green | #059669 |
| Border | Light Gray | #E5E7EB |
| Input Background | White | #FFFFFF |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Logo/Brand | Inter | 32px | Bold (700) |
| Page Heading | Inter | 24px | Semibold (600) |
| Subheading | Inter | 14px | Regular (400) |
| Input Label | Inter | 14px | Medium (500) |
| Input Text | Inter | 16px | Regular (400) |
| Button Text | Inter | 16px | Semibold (600) |
| Link Text | Inter | 14px | Medium (500) |
| Helper Text | Inter | 12px | Regular (400) |

### Spacing System
- Page padding: 24px
- Section gap: 24px
- Input field gap: 16px
- Button height: 48px
- Input height: 48px
- Border radius (inputs): 8px
- Border radius (button): 8px

### Visual Effects
- Card shadow: `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`
- Focus ring: `0 0 0 3px rgba(37,99,235,0.3)`
- Transitions: 150ms ease-in-out

---

## 3. Form Fields

### Field 1: Email Address
| Attribute | Value |
|-----------|-------|
| Field ID | email |
| Label | Email Address |
| Type | email |
| Placeholder | admin@zakpos.com |
| Required | Yes |
| Autocomplete | email |
| Validation | Must be valid email format |

**States:**
- Default: Gray border (#E5E7EB)
- Focus: Blue border (#2563EB) with focus ring
- Error: Red border (#DC2626) with error message
- Disabled: Gray background (#F3F4F6), cursor not-allowed

### Field 2: Password
| Attribute | Value |
|-----------|-------|
| Field ID | password |
| Label | Password |
| Type | password |
| Placeholder | Enter your password |
| Required | Yes |
| Autocomplete | current-password |
| Min Length | 6 characters |
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

### Primary Flow: Admin Login
```
1. Admin navigates to /admin-login
2. Admin enters email address
3. Admin enters password
4. Admin optionally checks "Remember me"
5. Admin clicks "Sign In" button
6. System validates credentials
   - If valid: Redirect to /admin-dashboard
   - If invalid: Show error message "Invalid email or password"
7. On successful login, JWT token stored in httpOnly cookie
```

### Error States
| Scenario | Error Message | Visual Treatment |
|----------|---------------|------------------|
| Empty email | "Email address is required" | Red border, error text below field |
| Invalid email format | "Please enter a valid email address" | Red border, error text below field |
| Empty password | "Password is required" | Red border, error text below field |
| Wrong credentials | "Invalid email or password" | Red text below form, shake animation |
| Account locked | "Account temporarily locked. Try again in X minutes" | Red text below form |
| Network error | "Unable to connect. Please check your internet connection" | Red text below form |

### Loading State
- Button shows spinner icon
- Button text changes to "Signing in..."
- All inputs disabled
- Button disabled

---

## 5. Data Handling

### Form Submission
- **Endpoint**: POST /api/v1/auth/login
- **Content-Type**: application/json

### Request Payload
```json
{
  "email": "admin@zakpos.com",
  "password": "securePassword123",
  "rememberMe": false
}
```

### Success Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cuid123456789",
    "email": "admin@zakpos.com",
    "name": "Platform Admin",
    "role": "admin",
    "tenantId": "platform-admin",
    "permissions": [
      "tenant:create",
      "tenant:manage",
      "user:create",
      "user:read",
      "user:update",
      "user:delete",
      "report:read",
      "report:export",
      "system:admin"
    ]
  }
}
```

### Token Storage
- If "Remember me" checked: Store in localStorage (30 days)
- If not checked: Store in sessionStorage (session only)

---

## 6. Component Specifications

### Logo Component
- **Image**: ZakPos Logo (SVG or PNG)
- **Size**: 48px height
- **Position**: Centered above heading
- **Alt Text**: "ZakPos Admin Portal"

### Heading Component
- **Text**: "Admin Portal"
- **Style**: 24px, Semibold, #1F2937
- **Alignment**: Center

### Subheading Component
- **Text**: "Sign in to manage platform"
- **Style**: 14px, Regular, #6B7280
- **Alignment**: Center

### Input Field Component
- **Height**: 48px
- **Padding**: 12px 16px
- **Border**: 1px solid #E5E7EB
- **Border Radius**: 8px
- **Font Size**: 16px
- **Placeholder Color**: #9CA3AF
- **Focus State**: Border #2563EB, Ring 3px #2563EB/30%

### Primary Button Component
- **Height**: 48px
- **Width**: 100% (full width of form)
- **Background**: #2563EB
- **Text**: "Sign In" (white, 16px, Semibold)
- **Border Radius**: 8px
- **Hover**: #1D4ED8
- **Active**: #1E40AF
- **Disabled**: #93C5FD, cursor not-allowed
- **Loading**: Show spinner, "Signing in..."

### Checkbox Component
- **Size**: 20px x 20px
- **Border**: 2px solid #D1D5DB
- **Checked Background**: #2563EB
- **Checked Border**: #2563EB
- **Check Icon**: White checkmark
- **Label Gap**: 8px

### Link Component
- **Text**: "Forgot password?"
- **Color**: #2563EB
- **Hover**: #1D4ED8, underline
- **Cursor**: Pointer

### Error Message Component
- **Background**: #FEF2F2
- **Border**: 1px solid #FECACA
- **Border Radius**: 8px
- **Padding**: 12px 16px
- **Icon**: Red exclamation circle
- **Text Color**: #DC2626
- **Font Size**: 14px

---

## 7. Responsive Design

### Desktop (>1024px)
- Max width: 400px
- Centered in viewport
- Padding: 24px

### Tablet (768px - 1024px)
- Max width: 400px
- Centered in viewport
- Padding: 24px

### Mobile (<768px)
- Full width with 16px padding
- Button: Full width
- Inputs: Full width
- Logo: 40px height

---

## 8. Accessibility

### WCAG 2.1 AA Compliance
- All inputs have visible labels
- Error messages announced to screen readers
- Focus indicators visible (3px blue ring)
- Color contrast ratio minimum 4.5:1
- Form fields in logical tab order
- Keyboard navigation support (Tab, Enter)

### ARIA Attributes
- `aria-label` on logo for screen readers
- `aria-invalid` on error fields
- `aria-describedby` linking to error messages
- `aria-disabled` on disabled buttons

---

## 9. Security Considerations

### Password Field
- Masked by default
- Show/hide toggle available
- No password autofill from browser (use autocomplete="new-password" if needed)

### Remember Me
- When enabled, extends session to 30 days
- Uses secure, httpOnly cookie

### Failed Login Attempts
- Track attempts per IP/email
- Lock after 5 failed attempts for 15 minutes
- Show countdown timer when locked

### CSRF Protection
- Token validation on form submission

---

## 10. Google Snitch Prompts

### Prompt 1: Basic Admin Login
```
Create a clean, professional admin login page for a POS system called ZakPos.
The page should have:
- ZakPos logo centered at top (use a simple geometric "Z" shape or text logo)
- Heading: "Admin Portal" in large bold text
- Subheading: "Sign in to manage platform"
- Email input field with placeholder "admin@zakpos.com"
- Password field with show/hide toggle
- "Remember me for 30 days" checkbox
- Full-width blue "Sign In" button
- "Forgot password?" link below button
- White background with subtle shadow on the form card
- Error message area below form (hidden by default)
- Modern, minimal design with Inter font family
- Blue primary color (#2563EB) for buttons and links
- Gray tones for text and borders
- 8px border radius on all elements
- Smooth hover and focus transitions
```

### Prompt 2: Admin Login with Validation States
```
Create an admin login form with these validation states:
- Default state: Gray borders on inputs
- Focus state: Blue border with soft blue glow ring
- Error state: Red border and red error text below field
- Success state: Green checkmark inside input
- Loading state: Spinner in button, disabled inputs
Include:
- Email field with label "Email Address"
- Password field with label "Password" and eye icon for visibility toggle
- Checkbox: "Remember me for 30 days"
- Primary button: "Sign In" (blue, full width)
- Error message component with red background and exclamation icon
- Form validation messages in small red text
- Smooth 150ms transitions on all state changes
```

### Prompt 3: Complete Admin Authentication Page
```
Design a complete admin login page for a B2B SaaS POS platform.
Style: Modern, enterprise SaaS aesthetic similar to Stripe or Linear.
Color scheme: Blue (#2563EB) primary, white background, dark text.
Layout:
- Centered card (max 400px wide) with subtle shadow
- Logo at top inside card
- "Admin Portal" heading centered
- Email input with label, icon, and placeholder
- Password input with label, eye toggle icon
- "Remember me" checkbox aligned left
- Full-width "Sign In" button at bottom
- "Forgot password?" link centered below button
- Error messages appear above button with slide-down animation
Mobile responsive: Full width on mobile with 16px padding.
Include loading spinner state for button during form submission.
```

---

## 11. Related Documents

- [UI-DOC-02: Admin Dashboard](./UI-DOC-02-ADMIN-DASHBOARD.md)
- [UI-DOC-03: Admin Onboard Owner](./UI-DOC-03-ADMIN-ONBOARD-OWNER.md)
- [System Architecture](../architecture/SYSTEM-ARCHITECTURE.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
