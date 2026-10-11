# UI-DOC-03: Admin Onboard Owner (Invite New Tenant)

## Document Info
- **Document ID**: UI-DOC-03
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Admin
- **Page Type**: Modal / Onboarding Flow

---

## 1. Page Overview

### Page Purpose
This modal/screen allows platform administrators to invite new business owners (tenants) to the ZakPos platform. Admins can create a new tenant account and send an invitation email to the business owner to set up their password and complete onboarding.

### Page Description
A multi-step or single-form modal that collects essential business information and owner details, then sends an invitation to get the new business started on the platform. Features form validation, business plan selection, and email notification.

### URL Pattern
- **Trigger**: Opens as modal from Admin Dashboard "Invite New Tenant" button
- **Direct**: `/admin/tenants/new` (fallback page)

### Access Control
- Requires: `admin` role
- Required Permissions: `tenant:create`

---

## 2. Visual Design

### Layout Structure (Modal)

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Invite New Tenant                                         |  |
|  |  Create a new business account on ZakPos                   |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  BUSINESS INFORMATION                                      |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Business Name *                                     | |  |
|  |  | [Fashion Store..............................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Business Type *                                       | |  |
|  |  | [Retail Store.............................. v]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Business Phone                                       | |  |
|  |  | [+880 1XXX-XXXXXX.........................]          | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Business Address                                     | |  |
|  |  | [123 Commerce Street, Dhaka, Bangladesh...........] | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  OWNER INFORMATION                                         |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Owner Name *                                          | |  |
|  |  | [John Doe.................................]           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Owner Email *                                         | |  |
|  |  | [john.doe@example.com...........................]     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Owner Phone                                           | |  |
|  |  | [+880 1XXX-XXXXXX.........................]          | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  PLAN SELECTION                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [o] Basic    - Free - 1 shop, 2 users               | |  |
|  |  | [o] Pro      - $29/mo - 3 shops, 10 users           | |  |
|  |  | [o] Enterprise - $99/mo - Unlimited                 | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------------+
|  |  |                  SEND INVITATION                           |
|  |  +------------------------------------------------------------+
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Modal Background | White | #FFFFFF |
| Overlay | Black 50% | rgba(0,0,0,0.5) |
| Section Divider | Light Gray | #E5E7EB |
| Section Label | Dark Gray | #374151 |
| Required Asterisk | Red | #DC2626 |
| Primary Button | Blue | #2563EB |
| Button Hover | Dark Blue | #1D4ED8 |
| Success | Green | #059669 |
| Error | Red | #DC2626 |
| Border | Gray | #D1D5DB |
| Input Background | White | #FFFFFF |
| Placeholder | Light Gray | #9CA3AF |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Modal Title | Inter | 20px | Bold (700) |
| Modal Subtitle | Inter | 14px | Regular (400) |
| Section Label | Inter | 14px | Semibold (600) |
| Field Label | Inter | 14px | Medium (500) |
| Required Asterisk | Inter | 14px | Bold (700) |
| Input Text | Inter | 16px | Regular (400) |
| Placeholder | Inter | 16px | Regular (400) |
| Button Text | Inter | 16px | Semibold (600) |
| Error Text | Inter | 12px | Regular (400) |
| Helper Text | Inter | 12px | Regular (400) |

### Spacing System
- Modal padding: 32px
- Section gap: 24px
- Field gap: 16px
- Input height: 48px
- Button height: 48px
- Modal max-width: 560px
- Border radius: 8px

### Visual Effects
- Modal shadow: `0 25px 50px -12px rgba(0,0,0,0.25)`
- Overlay: Semi-transparent black
- Input focus: Blue ring
- Button transitions: 150ms ease

---

## 3. Form Fields

### Section 1: Business Information

#### Field 1.1: Business Name
| Attribute | Value |
|-----------|-------|
| Field ID | businessName |
| Label | Business Name |
| Type | text |
| Placeholder | e.g., Fashion Store |
| Required | Yes |
| Max Length | 100 characters |
| Validation | Required, min 2 characters |

**States:**
- Default: Gray border
- Focus: Blue border with ring
- Error: Red border with error message below
- Filled: Normal

#### Field 1.2: Business Type
| Attribute | Value |
|-----------|-------|
| Field ID | businessType |
| Label | Business Type |
| Type | select dropdown |
| Required | Yes |
| Default | "" (empty, placeholder shown) |

**Options:**
| Value | Label |
|-------|-------|
| retail | Retail Store |
| restaurant | Restaurant/Cafe |
| grocery | Grocery/Supermarket |
| pharmacy | Pharmacy |
| electronics | Electronics |
| fashion | Fashion/Clothing |
| furniture | Furniture |
| other | Other |

#### Field 1.3: Business Phone
| Attribute | Value |
|-----------|-------|
| Field ID | businessPhone |
| Label | Business Phone |
| Type | tel |
| Placeholder | +880 1XXX-XXXXXX |
| Required | No |
| Validation | Valid phone format |

#### Field 1.4: Business Address
| Attribute | Value |
|-----------|-------|
| Field ID | businessAddress |
| Label | Business Address |
| Type | textarea |
| Placeholder | Full address including city, country |
| Required | No |
| Max Length | 255 characters |
| Rows | 2 |

---

### Section 2: Owner Information

#### Field 2.1: Owner Name
| Attribute | Value |
|-----------|-------|
| Field ID | ownerName |
| Label | Owner Name |
| Type | text |
| Placeholder | Full name |
| Required | Yes |
| Validation | Required, min 2 characters |

#### Field 2.2: Owner Email
| Attribute | Value |
|-----------|-------|
| Field ID | ownerEmail |
| Label | Owner Email |
| Type | email |
| Placeholder | john.doe@example.com |
| Required | Yes |
| Validation | Required, valid email format |
| Help Text | Invitation will be sent to this email |

#### Field 2.3: Owner Phone
| Attribute | Value |
|-----------|-------|
| Field ID | ownerPhone |
| Label | Owner Phone |
| Type | tel |
| Placeholder | +880 1XXX-XXXXXX |
| Required | No |
| Validation | Valid phone format |

---

### Section 3: Plan Selection

#### Field 3.1: Plan Selection (Radio Buttons)
| Attribute | Value |
|-----------|-------|
| Field ID | plan |
| Label | Select Plan |
| Type | radio group |
| Required | Yes |
| Default | "basic" |

**Options:**

| Value | Label | Price | Features |
|-------|-------|-------|----------|
| basic | Basic | Free | 1 shop, 2 users, 500 products |
| pro | Pro | $29/month | 3 shops, 10 users, 5000 products |
| enterprise | Enterprise | $99/month | Unlimited shops, users, products |

**Visual Treatment:**
- Radio cards with border
- Selected state: Blue border, blue background tint, filled radio
- Unselected state: Gray border, white background
- Hover: Light blue background tint

---

## 4. User Interactions & Flows

### Primary Flow: Invite New Tenant
```
1. Admin clicks "Invite New Tenant" on dashboard
2. Modal opens with empty form
3. Admin fills Business Information section
4. Admin fills Owner Information section
5. Admin selects plan
6. Admin clicks "Send Invitation"
7. System validates all fields
   - If valid: Create tenant record, send invitation email
   - If invalid: Show error messages, focus first error field
8. On success:
   - Modal closes
   - Success toast: "Invitation sent to john@example.com"
   - Activity feed updates
   - Tenant appears in tenants list
```

### Validation Rules
| Field | Rules |
|-------|-------|
| Business Name | Required, 2-100 chars |
| Business Type | Required, must be from list |
| Owner Name | Required, 2-100 chars |
| Owner Email | Required, valid email format, unique |
| Owner Phone | Optional, valid phone format |
| Plan | Required, must be valid plan |

### Error Handling
| Error | Message |
|-------|---------|
| Empty required field | "This field is required" |
| Invalid email | "Please enter a valid email address" |
| Email already exists | "This email is already registered" |
| Network error | "Unable to send invitation. Please try again." |

### Success State
- Button shows checkmark
- Text: "Invitation Sent!"
- Auto-close after 2 seconds
- Success toast notification

---

## 5. Data Handling

### Form Submission
- **Endpoint**: POST /api/v1/admin/tenants
- **Content-Type**: application/json

### Request Payload
```json
{
  "business": {
    "name": "Fashion Store",
    "type": "fashion",
    "phone": "+880 1712345678",
    "address": "123 Commerce Street, Dhaka, Bangladesh"
  },
  "owner": {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+880 1712345678"
  },
  "plan": "pro"
}
```

### Success Response
```json
{
  "tenant": {
    "id": "tnant_123abc",
    "name": "Fashion Store",
    "type": "fashion",
    "status": "pending_invitation",
    "plan": "pro",
    "createdAt": "2026-03-20T09:00:00Z"
  },
  "owner": {
    "id": "usr_456def",
    "email": "john.doe@example.com",
    "status": "invitation_sent"
  },
  "message": "Invitation sent successfully"
}
```

---

## 6. Component Specifications

### Modal Container
- Max width: 560px
- Max height: 90vh (scrollable)
- Background: White
- Border radius: 12px
- Padding: 32px
- Shadow: Large shadow for elevation
- Close button: X icon top-right

### Close Button
- Position: Top-right corner
- Size: 32px x 32px
- Icon: X (close)
- Hover: Gray background
- Click: Close modal, discard changes (with confirmation if form dirty)

### Section Divider
- Text label: ALL CAPS
- Font size: 12px
- Font weight: 600
- Color: #6B7280
- Letter spacing: 0.05em
- Margin bottom: 12px

### Input Field
- Height: 48px
- Padding: 12px 16px
- Border: 1px solid #D1D5DB
- Border radius: 8px
- Font size: 16px
- Focus: Border #2563EB, Ring 3px #2563EB/20%

### Select Dropdown
- Same styling as input
- Dropdown arrow icon right side
- Options: White background, hover blue tint

### Textarea
- Min height: 80px
- Resize: Vertical only
- Same border styling as input

### Radio Card Group
- Container: Flex row (desktop), Stack (mobile)
- Card padding: 16px
- Card border: 2px solid
- Selected border: #2563EB (blue)
- Selected background: #EFF6FF (blue tint)
- Radio dot: 20px, centered left

### Primary Button
- Height: 48px
- Width: 100%
- Background: #2563EB
- Text: White, 16px, semibold
- Border radius: 8px
- Hover: #1D4ED8
- Active: #1E40AF
- Loading: Spinner + "Sending..."
- Success: Green background + checkmark

---

## 7. Responsive Design

### Desktop (>768px)
- Modal max-width: 560px
- Centered vertically and horizontally
- Full form visible with scroll

### Mobile (<768px)
- Modal: Full screen (100vw x 100vh)
- Border radius: 0
- Padding: 24px
- Close button: Top-left (back arrow)
- Form: Single column, full width
- Plan selection: Stack vertically

---

## 8. Accessibility

- Modal has focus trap
- ESC key closes modal
- Tab navigation through fields
- Error messages linked with aria-describedby
- Required fields marked with aria-required
- Success/Error states announced to screen readers

---

## 9. Confirmation Dialog

### Discard Changes
When user tries to close modal with unsaved changes:
```
Title: "Discard changes?"
Message: "You have unsaved changes. Are you sure you want to close?"
Buttons: [Cancel] [Discard Changes]
```

---

## 10. Google Snitch Prompts

### Prompt 1: Basic Invite Tenant Modal
```
Create a modal popup for inviting a new tenant to a B2B SaaS POS platform.
Modal header: "Invite New Tenant" with X close button top right.
Below header: "Create a new business account on ZakPos" subtitle.
Form fields in two sections:
Section 1 "BUSINESS INFORMATION":
  - Business Name (required, text input)
  - Business Type (required, dropdown with options: Retail Store, Restaurant, Grocery, Pharmacy, Electronics, Fashion, Furniture, Other)
  - Business Phone (optional, tel input)
  - Business Address (optional, textarea)
Section 2 "OWNER INFORMATION":
  - Owner Name (required, text input)
  - Owner Email (required, email input with helper text "Invitation will be sent to this email")
  - Owner Phone (optional, tel input)
Section 3 "PLAN SELECTION":
  - Three radio card options side by side:
    * Basic (Free) - 1 shop, 2 users
    * Pro ($29/mo) - 3 shops, 10 users (highlight as recommended)
    * Enterprise ($99/mo) - Unlimited
Full width blue "Send Invitation" button at bottom.
White modal on semi-transparent black overlay.
Clean modern design with Inter font, blue (#2563EB) primary color.
```

### Prompt 2: Plan Selection Radio Cards
```
Design three selectable plan cards for a SaaS platform:
Card 1: Basic (Free)
  - Unselected: Gray border, white background
  - Selected: Blue border (#2563EB), light blue background (#EFF6FF)
  - Radio dot on left, "Basic" bold, "Free" in green, features list below in gray text
Card 2: Pro ($29/month) - RECOMMENDED badge
  - Same styling as Basic
  - "Most Popular" or "Recommended" badge in top right corner
Card 3: Enterprise ($99/month)
  - Same styling as Basic
Each card: 1px border, 8px border radius, 16px padding.
Radio button: 20px circle, blue fill when selected, white center dot.
On hover: Light blue background tint.
Cards should be in a horizontal row on desktop, stacked on mobile.
```

### Prompt 3: Complete Onboarding Modal
```
Create a complete tenant onboarding modal for ZakPos admin:
Style: Clean, modern SaaS aesthetic similar to Stripe or Linear.
Colors: White modal, light gray (#F8FAFC) page background, blue (#2563EB) accents.
Layout:
1. Top: "Invite New Tenant" title (20px bold), subtitle (14px gray), X close button
2. Divider + "BUSINESS INFORMATION" label
3. Business Name input (full width)
4. Business Type dropdown (full width)
5. Business Phone input (full width)
6. Business Address textarea (full width)
7. Divider + "OWNER INFORMATION" label
8. Owner Name input (full width)
9. Owner Email input (full width) with small helper text below
10. Owner Phone input (full width)
11. Divider + "SELECT PLAN" label
12. Three radio cards for Basic/Pro/Enterprise plans side by side
13. Full width blue "Send Invitation" button at bottom
Inputs: 48px height, 8px border radius, 16px padding, subtle border, blue focus ring.
Modal: 560px max width, centered, large shadow, 32px padding, 12px border radius.
```

---

## 11. Related Documents

- [UI-DOC-02: Admin Dashboard](./UI-DOC-02-ADMIN-DASHBOARD.md)
- [UI-DOC-04: Admin Manage Tenants](./UI-DOC-04-ADMIN-MANAGE-TENANTS.md)
- [UI-DOC-05: Owner Login](./UI-DOC-05-OWNER-LOGIN.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
