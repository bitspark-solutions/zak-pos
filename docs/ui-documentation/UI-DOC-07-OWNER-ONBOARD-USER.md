# UI-DOC-07: Owner Onboard User (Invite Team Member)

## Document Info
- **Document ID**: UI-DOC-07
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner
- **Page Type**: Modal / Onboarding Flow

---

## 1. Page Overview

### Page Purpose
This modal/screen allows business owners to invite team members (managers and cashiers) to join their business on ZakPos. Owners can assign roles, set permissions, and send invitations to new employees.

### Page Description
A streamlined onboarding flow for adding team members. Features role selection, permission preview, and email invitation functionality. Designed to be simple for owners while maintaining proper security controls.

### URL Pattern
- **Trigger**: Opens as modal from Users page "Invite User" button
- **Direct**: `/users/invite` (fallback page)

### Access Control
- Requires: `owner` or `manager` role
- Required Permissions: `user:create` (owner only, managers cannot create users)

---

## 2. Visual Design

### Layout Structure (Modal)

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Invite Team Member                                        |  |
|  |  Add a new manager or cashier to your team                 |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  TEAM MEMBER INFORMATION                                    |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Full Name *                                          | |  |
|  |  | [John Smith.................................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Email Address *                                       | |  |
|  |  | [john.smith@business.com...................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Phone Number                                          | |  |
|  |  | [+880 1XXX-XXXXXX..........................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  ROLE SELECTION                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [ MANAGER ]    [ CASHIER ]                          | |  |
|  |  |                                                       | |  |
|  |  | (i) Manager can manage products, inventory,          | |  |
|  |  |     and orders. Cannot create users.                 | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  PERMISSIONS PREVIEW                                      |  |
|  |  +------------------------------------------------------+ |  |
|  |  | ✓ View dashboard                                     | |  |
|  |  | ✓ View products                                      | |  |
|  |  | ✓ Manage products (create, update)                   | |  |
|  |  | ✓ View inventory                                     | |  |
|  |  | ✓ Process sales                                      | |  |
|  |  | ✓ View reports                                       | |  |
|  |  | ✗ Manage users                                       | |  |
|  |  | ✗ Delete products                                    | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |                 SEND INVITATION                       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Modal Background | White | #FFFFFF |
| Section Label | Dark Gray | #374151 |
| Primary Button | Blue | #2563EB |
| Role Selected BG | Blue Tint | #EFF6FF |
| Role Selected Border | Blue | #2563EB |
| Role Unselected Border | Gray | #D1D5DB |
| Permission Check | Green | #059669 |
| Permission Denied | Gray | #9CA3AF |
| Error | Red | #DC2626 |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Modal Title | Inter | 20px | Bold (700) |
| Modal Subtitle | Inter | 14px | Regular (400) |
| Section Label | Inter | 12px | Semibold (600) |
| Field Label | Inter | 14px | Medium (500) |
| Input Text | Inter | 16px | Regular (400) |
| Button Text | Inter | 16px | Semibold (600) |
| Permission Text | Inter | 14px | Regular (400) |

### Spacing System
- Modal padding: 32px
- Section gap: 24px
- Field gap: 16px
- Input height: 48px
- Button height: 48px
- Modal max-width: 520px

---

## 3. Form Fields

### Section 1: Team Member Information

#### Field 1.1: Full Name
| Attribute | Value |
|-----------|-------|
| Field ID | name |
| Label | Full Name |
| Type | text |
| Placeholder | e.g., John Smith |
| Required | Yes |
| Validation | Required, min 2 characters |

#### Field 1.2: Email Address
| Attribute | Value |
|-----------|-------|
| Field ID | email |
| Label | Email Address |
| Type | email |
| Placeholder | john.smith@business.com |
| Required | Yes |
| Validation | Required, valid email format |
| Help Text | Invitation will be sent to this email |

#### Field 1.3: Phone Number
| Attribute | Value |
|-----------|-------|
| Field ID | phone |
| Label | Phone Number |
| Type | tel |
| Placeholder | +880 1XXX-XXXXXX |
| Required | No |
| Validation | Valid phone format |

---

### Section 2: Role Selection

#### Field 2.1: Role (Toggle/Pills)
| Attribute | Value |
|-----------|-------|
| Field ID | role |
| Type | toggle/pill buttons |
| Required | Yes |
| Default | Manager (first option) |

**Options:**

| Role | Description |
|------|-------------|
| Manager | Can manage products, inventory, and orders. Cannot create users. |
| Cashier | Can process sales and handle POS operations. Limited access. |

**Visual Treatment:**
- Two pill/button toggle
- Unselected: White background, gray border
- Selected: Blue background (#EFF6FF), blue border, blue text
- Hover on unselected: Light gray background

---

### Section 3: Permissions Preview

**Purpose:** Shows the invited user what they can/cannot do based on selected role.

### Manager Permissions
| Permission | Allowed |
|------------|---------|
| View dashboard | ✓ |
| View products | ✓ |
| Create products | ✓ |
| Update products | ✓ |
| Delete products | ✗ |
| View inventory | ✓ |
| Manage inventory | ✓ |
| Process sales (POS) | ✓ |
| View reports | ✓ |
| Manage orders | ✓ |
| Manage users | ✗ |
| Manage settings | ✗ |

### Cashier Permissions
| Permission | Allowed |
|------------|---------|
| View dashboard | ✓ |
| View products | ✓ |
| Create products | ✗ |
| Update products | ✗ |
| Delete products | ✗ |
| View inventory | ✓ |
| Manage inventory | ✗ |
| Process sales (POS) | ✓ |
| View reports | ✗ |
| Manage orders | ✗ |
| Manage users | ✗ |
| Manage settings | ✗ |

---

## 4. User Interactions & Flows

### Primary Flow: Invite Team Member
```
1. Owner clicks "Invite User" on Users page
2. Modal opens with empty form
3. Owner fills Name
4. Owner fills Email
5. Owner optionally fills Phone
6. Owner selects role (Manager or Cashier)
7. Permissions preview updates based on role
8. Owner clicks "Send Invitation"
9. System validates:
   - If valid: Create user record, send invitation email
   - If invalid: Show error messages
10. Success:
    - Modal closes
    - Toast: "Invitation sent to john@..."
    - User appears in pending state in Users list
```

### Role Switching
```
1. Owner clicks "Manager" pill
2. Permissions preview updates to show Manager permissions
3. Owner clicks "Cashier" pill
4. Permissions preview updates to show Cashier permissions
```

---

## 5. Data Handling

### Form Submission
- **Endpoint**: POST /api/v1/users
- **Content-Type**: application/json

### Request Payload
```json
{
  "name": "John Smith",
  "email": "john.smith@business.com",
  "phone": "+8801712345678",
  "role": "manager"
}
```

### Success Response
```json
{
  "user": {
    "id": "usr_789ghi",
    "name": "John Smith",
    "email": "john.smith@business.com",
    "phone": "+8801712345678",
    "role": "manager",
    "status": "pending_invitation",
    "tenantId": "tnant_123abc",
    "createdAt": "2026-03-20T09:00:00Z"
  },
  "message": "Invitation sent successfully"
}
```

---

## 6. Component Specifications

### Role Toggle
- Two buttons side by side
- Selected: Blue bg (#EFF6FF), blue border, blue text
- Unselected: White bg, gray border, gray text
- Icons: Manager (user with gear), Cashier (user with cash)

### Permissions List
- Checkmark (✓) in green for allowed
- Dash (✗) in gray for denied
- Compact list format
- 8px gap between items

### Primary Button
- Height: 48px
- Width: 100%
- Background: #2563EB
- Text: White, "Send Invitation"
- Hover: #1D4ED8
- Loading: Spinner + "Sending..."
- Success: Green + checkmark

---

## 7. Responsive Design

### Desktop (>768px)
- Modal max-width: 520px
- Centered in viewport
- Full form visible

### Mobile (<768px)
- Full screen modal
- Stacked role pills
- Full width inputs

---

## 8. Google Snitch Prompts

### Prompt 1: Invite Team Member Modal
```
Create a modal for business owners to invite team members.
Header: "Invite Team Member" title, X close button top right, subtitle "Add a new manager or cashier".
Form fields:
  - Full Name input (required)
  - Email input (required) with helper text "Invitation will be sent to this email"
  - Phone input (optional)
Role selection: Two toggle buttons side by side "Manager" and "Cashier"
  - Manager selected by default (blue highlight)
  - Cashier has lighter styling when not selected
Permissions preview box showing what the selected role can do:
  - Green checkmarks for allowed actions
  - Gray dashes for denied actions
  - Compact list format
Full width blue "Send Invitation" button at bottom.
White modal on semi-transparent black overlay.
Modern Inter font, blue primary color, clean SaaS style.
```

### Prompt 2: Role Selection with Permissions
```
Design role selection UI with permission preview for a team invite form.
Two role option cards side by side:
Manager card:
  - Icon: User with briefcase
  - Title: "Manager"
  - Description: "Can manage products, inventory, and orders"
  - Selected state: Blue border, light blue background
Cashier card:
  - Icon: User with cash register
  - Title: "Cashier"
  - Description: "Can process sales and handle POS operations"
  - Selected state: Blue border, light blue background
Below role selection, show permissions preview:
  "Permissions for Manager:"
  ✓ View dashboard
  ✓ Manage products
  ✓ Process sales
  ✓ View reports
  ✗ Manage users
  ✗ Delete products
Checkmarks in green, X marks in gray.
Cards have rounded corners (8px), subtle shadow on hover.
```

### Prompt 3: Complete User Invite Form
```
Build a complete team member invitation modal for ZakPos admin.
Style: Modern SaaS modal, white card on dark overlay, 520px max width.
Top: "Invite Team Member" (20px bold), "Add a new member to your team" (14px gray), X close button.
Form:
  - "Full Name *" label, full width input (48px height)
  - "Email Address *" label, full width input
  - "Phone Number" label, full width input (optional)
Role Selection section header:
  Two toggle buttons "Manager" / "Cashier" with icons
  Manager selected (blue) by default
Permissions Preview box:
  "This role can:"
  with list of allowed/denied permissions
Full width blue "Send Invitation" button.
Colors: Blue primary (#2563EB), white card bg, gray text, green checks, gray X marks.
Inter font, 150ms transitions, focus rings on inputs.
```

---

## 9. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-08: Manager Dashboard](./UI-DOC-08-MANAGER-DASHBOARD.md)
- [UI-DOC-14: User Management](./UI-DOC-14-USER-MANAGEMENT.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
