# UI-DOC-14: User Management

## Document Info
- **Document ID**: UI-DOC-14
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner
- **Page Type**: User Administration

---

## 1. Page Overview

### Page Purpose
The User Management page allows business owners to manage their team members - adding new users (managers and cashiers), editing roles and permissions, and deactivating accounts.

### Page Description
A team management interface for business owners to view all employees, change roles, reset passwords, and manage access. Shows user status, role, and last activity.

### URL Pattern
- **Development**: `http://localhost:3000/users`
- **Production**: `/users`

### Access Control
- Requires: `owner` role
- Required Permissions: `user:read`, `user:update`

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  HEADER                                                          |
+------------------------------------------------------------------+
|                                                                  |
|  Team Members                     [+ Invite Member]               |
|  Manage your team and permissions                                |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | SUMMARY CARDS                                              |  |
|  +------------------------------------------------------------+  |
|  |  +--------+  +--------+  +--------+  +--------+            |  |
|  |  | TOTAL  |  | MANAGER|  | CASHIER|  | ACTIVE |            |  |
|  |  |   5    |  |   2    |  |   3    |  |   4    |            |  |
|  |  +--------+  +--------+  +--------+  +--------+            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | 🔍 Search team members...                                   |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                                                             |  |
|  |  TEAM MEMBERS LIST                                         |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [👤]  John Doe (Owner)                               | |  |
|  |  |        john@business.com                             | |  |
|  |  |        john@business.com • +880 1712345678            | |  |
|  |  |        Role: Owner • Status: Active • Joined Jan 2024| |  |
|  |  |        [You]                                          | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [👤]  Jane Smith                                     | |  |
|  |  |        Manager • [Active]                    [⋮]    | |  |
|  |  |        jane@business.com • +880 1723456789            | |  |
|  |  |        Last active: Today at 9:30 AM                  | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [👤]  Mike Chen                                      | |  |
|  |  |        Cashier • [Active]                    [⋮]    | |  |
|  |  |        mike@business.com • +880 1734567890            | |  |
|  |  |        Last active: Yesterday                        | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [👤]  Sarah Lee                                      | |  |
|  |  |        Cashier • [Invited]                    [⋮]    | |  |
|  |  |        sarah@business.com                             | |  |
|  |  |        Invitation pending - Sent Mar 18              | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [👤]  Tom Wilson                                     | |  |
|  |  |        Cashier • [Inactive]                  [⋮]    | |  |
|  |  |        tom@business.com                              | |  |
|  |  |        Deactivated Feb 28, 2026                      | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Page Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Primary Accent | Blue | #2563EB |
| Owner Role | Purple | #7C3AED |
| Manager Role | Blue | #2563EB |
| Cashier Role | Teal | #0D9488 |
| Active Status | Green | #059669 |
| Invited Status | Amber | #D97706 |
| Inactive Status | Gray | #6B7280 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |

---

## 3. Page Components

### 3.1 Summary Cards (4 cards)

| Card | Value | Description |
|------|-------|-------------|
| Total | 5 | Team members |
| Managers | 2 | With management access |
| Cashiers | 3 | POS operators |
| Active | 4 | Currently active |

### 3.2 Search
- Placeholder: "Search team members..."
- Searches: Name, email, phone

### 3.3 User Card

```
+-------------------------------------------------------------+
| [👤]  Jane Smith                                    [⋮]     |
|        Manager • [Active]                                   |
|                                                             |
|        jane@business.com • +880 1723456789                   |
|                                                             |
|        Last active: Today at 9:30 AM                        |
+-------------------------------------------------------------+
```

**Card Elements:**
- Avatar: 48px circle with initials or photo
- Name: Bold, 16px
- Role badge: Colored pill (Owner=purple, Manager=blue, Cashier=teal)
- Status badge: Colored pill (Active=green, Invited=amber, Inactive=gray)
- Email: 14px gray
- Phone: 14px gray
- Last activity: 12px gray
- Menu: Three dots for actions
- "You" tag if current user

### 3.4 Role Badges
| Role | Background | Text |
|------|------------|------|
| Owner | #F5F3FF | #7C3AED |
| Manager | #EFF6FF | #2563EB |
| Cashier | #F0FDFA | #0D9488 |

### 3.5 Status Badges
| Status | Background | Text |
|--------|------------|------|
| Active | #ECFDF5 | #059669 |
| Invited | #FFF7ED | #D97706 |
| Inactive | #F3F4F6 | #6B7280 |

---

## 4. User Actions Menu

### Menu Items (⋮)
| Action | Available When | Icon |
|--------|----------------|------|
| View Profile | Always | Eye |
| Edit User | Always | Pencil |
| Reset Password | Active users | Key |
| Deactivate | Active users | Pause |
| Reactivate | Inactive users | Play |
| Delete | Never (owner only) | Trash |

### Reset Password Modal
```
+------------------------------------------------------------------+
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Reset Password                                            |  |
|  |  Send password reset instructions to Jane Smith            |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | jane@business.com                                    | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  A password reset link will be sent to this email        |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL        SEND RESET LINK           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### Deactivate Confirmation
```
+------------------------------------------------------------------+
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Deactivate User?                                          |  |
|  |                                                            |  |
|  |  Jane Smith will lose access to your business dashboard.  |  |
|  |  They can be reactivated at any time.                     |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL        DEACTIVATE                | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## 5. Edit User Modal

### Layout

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Edit Team Member                                          |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  FULL NAME                                                 |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Jane Smith.................................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  EMAIL                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [jane@business.com...........................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  PHONE                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [+880 1723456789............................]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  ROLE                                                      |  |
|  |  +------------------------------------------------------+ |  |
|  |  | (●) Manager                                          | |  |
|  |  | ( ) Cashier                                          | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  STATUS                                                    |  |
|  |  +------------------------------------------------------+ |  |
|  |  | (●) Active                                           | |  |
|  |  | ( ) Inactive                                         | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  PERMISSIONS (view only)                                   |  |
|  |  +------------------------------------------------------+ |  |
|  |  | ✓ View dashboard                                     | |  |
|  |  | ✓ Manage products                                    | |  |
|  |  | ✓ Manage inventory                                   | |  |
|  |  | ✓ Process sales                                      | |  |
|  |  | ✓ View reports                                       | |  |
|  |  | ✗ Manage users                                       | |  |
|  |  | ✗ Business settings                                  | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL            SAVE CHANGES           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Editable Fields
| Field | Type | Editable By Owner |
|-------|------|-------------------|
| Full Name | text | Yes |
| Email | email | Yes |
| Phone | tel | Yes |
| Role | radio | Yes |
| Status | radio | Yes |
| Permissions | display | No (based on role) |

---

## 6. Data Structure

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'owner' | 'manager' | 'cashier';
  status: 'active' | 'invited' | 'inactive';
  tenantId: string;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserWithPermissions extends User {
  permissions: Permission[];
}

type Permission =
  | 'product:create' | 'product:read' | 'product:update' | 'product:delete'
  | 'inventory:create' | 'inventory:read' | 'inventory:update'
  | 'sale:create' | 'sale:read' | 'sale:update'
  | 'invoice:create' | 'invoice:read' | 'invoice:update' | 'invoice:send' | 'invoice:confirm'
  | 'user:create' | 'user:read' | 'user:update'
  | 'report:read' | 'report:export'
  | 'tenant:manage';
```

---

## 7. User Interactions

### Invite User Flow
```
1. Click "+ Invite Member"
2. Fill: Name, Email, Phone (optional), Role
3. Click "Send Invitation"
4. User created with "invited" status
5. Email sent with setup instructions
```

### Edit User Flow
```
1. Click ⋮ menu on user card
2. Select "Edit User"
3. Modal opens with current data
4. Modify fields
5. Click "Save Changes"
6. User updated
```

### Deactivate User Flow
```
1. Click ⋮ menu on user card
2. Select "Deactivate"
3. Confirmation modal appears
4. Confirm deactivation
5. User status → "inactive"
6. User loses access
```

### Reactivate User Flow
```
1. Click ⋮ menu on inactive user
2. Select "Reactivate"
3. User status → "active"
4. User regains access
```

---

## 8. API Endpoints

### GET Users
```
GET /api/v1/users
Authorization: Bearer <owner_token>

Response:
{
  "data": [
    {
      "id": "usr_123",
      "name": "Jane Smith",
      "email": "jane@business.com",
      "phone": "+8801723456789",
      "role": "manager",
      "status": "active",
      "lastActiveAt": "2026-03-20T09:30:00Z",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 5
}
```

### POST Create User
```
POST /api/v1/users
Body: { name, email, phone?, role }
```

### PATCH Update User
```
PATCH /api/v1/users/:id
Body: { name?, email?, phone?, role?, status? }
```

### POST Reset Password
```
POST /api/v1/users/:id/reset-password
```

---

## 9. Google Snitch Prompts

### Prompt 1: User Management Page
```
Create a user management page for a POS system.
Header: "Team Members" title (28px bold), "Manage your team and permissions" subtitle
Action button top right: Blue "+ Invite Member"
Summary cards row (4 cards):
  - Total: 5 (blue)
  - Managers: 2 (blue)
  - Cashiers: 3 (teal)
  - Active: 4 (green)
Search bar: "Search team members..." with magnifying glass
User cards list (vertical):
Each card:
  - Left: 48px avatar circle with user initial (colored based on role)
  - User name bold
  - Role badge: Owner (purple), Manager (blue), Cashier (teal)
  - Status badge: Active (green), Invited (amber), Inactive (gray)
  - Email and phone in gray
  - "Last active: Today at 9:30 AM" or "Invited Mar 18" or "Deactivated Feb 28"
  - Three dots menu right side
  - "You" tag if current user
Cards: White bg, shadow, hover effect, 12px radius.
Background: Light gray (#F8FAFC).
Inter font, modern SaaS style.
```

### Prompt 2: User Role Badges
```
Design role badges for different user types:
Owner badge:
  - Purple background (#F5F3FF), purple text (#7C3AED)
  - Icon: Crown or user icon
Manager badge:
  - Blue background (#EFF6FF), blue text (#2563EB)
  - Icon: Briefcase or gear
Cashier badge:
  - Teal background (#F0FDFA), teal text (#0D9488)
  - Icon: Cash register or dollar
Badge style: Pill shape, 6px padding, small icon left of text, 12px font.
```

### Prompt 3: Complete User Management Interface
```
Build a complete team management interface.
Header: "Team Members" bold, "Invite Member" blue button right
4 stat cards: Total 5 (gray bg), Managers 2 (blue), Cashiers 3 (teal), Active 4 (green)
Search input full width
User list with 4 example users:
1. John Doe (Owner) - "You" tag, no menu
2. Jane Smith (Manager) - Active, "Last active today 9:30 AM", three dots menu
3. Mike Chen (Cashier) - Active, "Last active yesterday", three dots menu
4. Sarah Lee (Cashier) - "Invited" amber badge, "Invitation pending", three dots menu
Each user shows: Avatar circle (initials), name, role badge, status badge, email, last activity
Three dots menu options: View Profile, Edit User, Reset Password, Deactivate
Cards: White background, bottom border, shadow on hover.
Clean Inter font, professional dashboard aesthetic.
```

---

## 10. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-07: Owner Onboard User](./UI-DOC-07-OWNER-ONBOARD-USER.md)
- [UI-DOC-09: POS Interface](./UI-DOC-09-CASHIER-POS.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
