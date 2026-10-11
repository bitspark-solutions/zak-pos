# UI-DOC-04: Admin Manage Tenants

## Document Info
- **Document ID**: UI-DOC-04
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Admin
- **Page Type**: List/Management Page

---

## 1. Page Overview

### Page Purpose
The Admin Manage Tenants page allows platform administrators to view, search, filter, and manage all tenant (business) accounts on the ZakPos platform. Admins can see tenant status, owner information, plan details, and take actions like suspending or upgrading tenants.

### Page Description
A comprehensive list view with powerful search and filtering capabilities. Shows all tenants with key information at a glance, and provides detailed tenant views for deeper management operations.

### URL Pattern
- **Development**: `http://localhost:3000/admin/tenants`
- **Production**: `/admin/tenants`

### Access Control
- Requires: `admin` role
- Required Permissions: `tenant:manage`, `user:read`

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  [ZAKPOS LOGO]              ADMIN         [Notifications] [User] |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  | [<- Back to Dashboard]                                      |  |
|  |                                                            |  |
|  |  Tenants                                    [+ Invite New] |  |
|  |  Manage all business accounts                                 |  |
|  |                                                            |  |
|  |  +--------------------+  +-----------------------+         |  |
|  |  | 🔍 Search tenants  |  | Filter [v]  Sort [v]  |         |  |
|  |  +--------------------+  +-----------------------+         |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  TENANT LIST                   Showing 1-10 of 127 tenants |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Logo] Fashion Store              [Active]    [⋮]   | |  |
|  |  |         Retail Store                                 | |  |
|  |  |         Owner: John Doe                              | |  |
|  |  |         john@fashionstore.com                         | |  |
|  |  |         Pro Plan • 2 shops • Created Jan 15, 2026     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Logo] Tech Shop                    [Active]    [⋮]   | |  |
|  |  |         Electronics                                   | |  |
|  |  |         Owner: Jane Smith                            | |  |
|  |  |         jane@techshop.com                            | |  |
|  |  |         Enterprise Plan • 5 shops • Created Feb 2, 2026| |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Logo] Food Corner                 [Pending]    [⋮]   | |  |
|  |  |         Restaurant                                     | |  |
|  |  |         Owner: Mike Chen                               | |  |
|  |  |         mike@foodcorner.com                           | |  |
|  |  |         Basic Plan • 1 shop • Created Mar 18, 2026     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Logo] XYZ Corporation               [Suspended][⋮]    | |  |
|  |  |         Other                                           | |  |
|  |  |         Owner: Sarah Lee                                | |  |
|  |  |         sarah@xyzcorp.com                               | |  |
|  |  |         Basic Plan • 1 shop • Created Dec 1, 2025       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [<] Page 1 of 13 [>]          [10] [25] [50] per page    |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Primary Brand | Deep Blue | #1E40AF |
| Primary Accent | Blue | #2563EB |
| Active Status | Green | #059669 |
| Pending Status | Amber | #D97706 |
| Suspended Status | Red | #DC2626 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |
| Text Muted | Light Gray | #9CA3AF |
| Border | Light Gray | #E5E7EB |
| Search Background | White | #FFFFFF |
| Hover Background | Gray Tint | #F9FAFB |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Inter | 28px | Bold (700) |
| Page Subtitle | Inter | 14px | Regular (400) |
| Search Input | Inter | 16px | Regular (400) |
| Tenant Name | Inter | 16px | Semibold (600) |
| Tenant Type | Inter | 14px | Regular (400) |
| Owner Name | Inter | 14px | Medium (500) |
| Owner Email | Inter | 14px | Regular (400) |
| Meta Text | Inter | 12px | Regular (400) |
| Status Badge | Inter | 12px | Medium (500) |

### Spacing System
- Page padding: 24px
- Card padding: 16px
- Card gap: 12px
- Card border radius: 8px
- Button border radius: 8px
- Input border radius: 8px

### Visual Effects
- Card shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Card hover: Background #F9FAFB
- Row hover: Background #F9FAFB

---

## 3. Page Components

### 3.1 Header Section
**Elements:**
- Back to Dashboard link with arrow
- Page title: "Tenants"
- Page subtitle: "Manage all business accounts"
- Primary action button: "[+ Invite New]"

### 3.2 Toolbar
**Elements:**
- Search input (left)
- Filter dropdown (center-left)
- Sort dropdown (center-right)

**Search Input:**
- Placeholder: "Search tenants..."
- Icon: Magnifying glass
- Searches: Business name, owner name, owner email
- Debounced: 300ms

**Filter Dropdown:**
- Options: All Status, Active, Pending, Suspended
- Default: All Status

**Sort Dropdown:**
- Options: Newest First, Oldest First, Name A-Z, Name Z-A, Plan (High-Low), Plan (Low-High)
- Default: Newest First

### 3.3 Tenant List

#### Tenant Card Structure
```
+----------------------------------------------------------+
| [Logo]  Tenant Name                     [Status Badge] [⋮]|
|         Business Type                                      |
|         Owner: Owner Name                                  |
|         owner@email.com                                    |
|         Plan • X shops • Created Date                      |
+----------------------------------------------------------+
```

**Tenant Logo:**
- Size: 40px x 40px
- Shape: Rounded square (8px radius)
- Content: Business initials or uploaded logo
- Fallback: Colored background with business type icon

**Tenant Info:**
- Business name: 16px semibold
- Business type: 14px gray text
- Owner name: 14px medium
- Owner email: 14px regular, gray
- Meta line: 12px, shows Plan, shops count, created date

**Status Badge:**
| Status | Background | Text Color | Label |
|--------|------------|------------|-------|
| Active | #ECFDF5 | #059669 | Active |
| Pending | #FFF7ED | #D97706 | Pending |
| Suspended | #FEF2F2 | #DC2626 | Suspended |
| Cancelled | #F3F4F6 | #6B7280 | Cancelled |

**Action Menu (⋮):**
- View Details
- Edit Tenant
- Manage Owner
- Upgrade/Downgrade Plan
- Suspend Tenant
- Delete Tenant

### 3.4 Pagination

**Elements:**
- Previous/Next buttons
- Page numbers (1, 2, 3... 13)
- Per page selector: [10] [25] [50]
- Info text: "Showing 1-10 of 127 tenants"

---

## 4. Data Structure

### Tenant Object
```typescript
interface Tenant {
  id: string;                    // "tnant_123abc"
  name: string;                  // "Fashion Store"
  type: string;                  // "retail"
  typeLabel: string;              // "Retail Store"
  logo?: string;                 // URL or null
  status: 'active' | 'pending' | 'suspended' | 'cancelled';
  plan: 'basic' | 'pro' | 'enterprise';
  owner: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  shops: number;                 // Count of shops
  createdAt: Date;
  updatedAt: Date;
}
```

### Filter Options
```typescript
interface TenantFilters {
  search?: string;
  status?: 'all' | 'active' | 'pending' | 'suspended' | 'cancelled';
  plan?: 'all' | 'basic' | 'pro' | 'enterprise';
  sortBy?: 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'plan_asc' | 'plan_desc';
  page?: number;
  limit?: 10 | 25 | 50;
}
```

---

## 5. User Interactions & Flows

### Primary Flow: View and Manage Tenants
```
1. Admin navigates to /admin/tenants
2. Page loads with default view (newest first, all statuses)
3. Admin can:
   a. Search for specific tenant
   b. Filter by status
   c. Sort list
   d. Click tenant card to view details
   e. Click action menu for specific actions
```

### Search Flow
```
1. Admin types in search box
2. After 300ms debounce, search executes
3. Results filter in real-time
4. Clear button (X) appears when text entered
5. Empty search: Show all tenants
```

### Filter Flow
```
1. Admin clicks Filter dropdown
2. Selects status (e.g., "Active")
3. List immediately updates to show only active tenants
4. Filter badge shows active filter
5. Click again to change/remove filter
```

### Tenant Detail Flow
```
1. Admin clicks on tenant card
2. Slide-over panel opens with full tenant details
3. Shows: Full business info, owner info, usage stats, activity log
4. Actions available: Edit, Suspend, Delete
```

### Action Menu Flows

#### Suspend Tenant
```
1. Admin clicks ⋮ on tenant card
2. Selects "Suspend Tenant"
3. Confirmation modal: "Are you sure you want to suspend Fashion Store?"
4. Optional reason field
5. Confirm → Tenant status changes to "Suspended"
6. Toast: "Tenant suspended successfully"
```

#### Delete Tenant
```
1. Admin clicks ⋮ on tenant card
2. Selects "Delete Tenant"
3. Warning modal: "This action cannot be undone"
4. Type tenant name to confirm
5. Delete → Tenant removed from list
6. Toast: "Tenant deleted successfully"
```

---

## 6. API Endpoints

### GET Tenants List
```
GET /api/v1/admin/tenants
Authorization: Bearer <admin_token>
Query Params: ?search=&status=&plan=&sort=newest&page=1&limit=10

Response:
{
  "data": [
    {
      "id": "tnant_123",
      "name": "Fashion Store",
      "type": "fashion",
      "typeLabel": "Fashion/Clothing",
      "logo": null,
      "status": "active",
      "plan": "pro",
      "owner": {
        "id": "usr_456",
        "name": "John Doe",
        "email": "john@fashionstore.com",
        "phone": "+8801712345678"
      },
      "shops": 2,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "total": 127,
  "page": 1,
  "limit": 10,
  "totalPages": 13
}
```

### GET Single Tenant
```
GET /api/v1/admin/tenants/:id
Authorization: Bearer <admin_token>

Response:
{
  "id": "tnant_123",
  "name": "Fashion Store",
  "type": "fashion",
  "typeLabel": "Fashion/Clothing",
  "logo": null,
  "status": "active",
  "plan": "pro",
  "address": "123 Commerce St, Dhaka",
  "phone": "+8801712345678",
  "owner": {
    "id": "usr_456",
    "name": "John Doe",
    "email": "john@fashionstore.com",
    "phone": "+8801712345678",
    "status": "active"
  },
  "shops": [
    { "id": "shop_1", "name": "Main Store", "status": "active" },
    { "id": "shop_2", "name": "Branch", "status": "active" }
  ],
  "stats": {
    "totalUsers": 5,
    "totalProducts": 342,
    "totalSales": 15432,
    "monthlyRevenue": 45678.90
  },
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-03-20T09:00:00Z"
}
```

### PATCH Update Tenant
```
PATCH /api/v1/admin/tenants/:id
Authorization: Bearer <admin_token>
Body: { "name": "New Name", "status": "suspended" }
```

### DELETE Tenant
```
DELETE /api/v1/admin/tenants/:id
Authorization: Bearer <admin_token>
```

---

## 7. Empty & Loading States

### Loading State
- Skeleton cards (gray animated placeholders)
- 10 skeleton rows
- Pulse animation

### Empty State (No Tenants)
- Illustration: Empty folder or building icon
- Title: "No tenants yet"
- Subtitle: "Start by inviting your first business"
- CTA Button: "[+ Invite First Tenant]"

### Empty Search Results
- Illustration: Magnifying glass
- Title: "No tenants found"
- Subtitle: "Try adjusting your search or filters"
- CTA: "Clear filters"

---

## 8. Responsive Design

### Desktop (>1024px)
- Full table/card layout
- All columns visible
- Action menu visible

### Tablet (768px - 1024px)
- Condensed card layout
- Some columns hidden (phone)
- Action menu via tap

### Mobile (<768px)
- Stacked card layout
- Essential info only (name, status, owner)
- Swipe actions for quick suspend/delete
- Bottom sheet for filters

---

## 9. Accessibility

- List items are keyboard navigable
- ARIA labels on all interactive elements
- Screen reader announces: tenant name, status, plan
- Focus visible on all elements
- Filter changes announced to screen readers

---

## 10. Google Snitch Prompts

### Prompt 1: Tenant List Page
```
Create an admin tenant management page for a B2B SaaS POS platform.
Header: ZakPos logo left, page title "Tenants" center-left, blue "Invite New" button right.
Below header: Subtitle "Manage all business accounts", gray text.
Toolbar row: Search input with magnifying glass icon and placeholder "Search tenants...",
two dropdowns for Filter (All Status) and Sort (Newest First).
Main content: List of tenant cards stacked vertically.
Each card: Left side has 40px rounded square logo placeholder with business initial,
business name (bold), business type (gray), owner name with "Owner:" prefix, owner email,
and bottom line showing Plan badge, shops count, and creation date.
Status badge in top right: Green "Active", Yellow "Pending", Red "Suspended".
Three dots menu icon far right.
Cards: White background, subtle shadow, 8px border radius, hover shows gray background.
Pagination at bottom: Previous/Next arrows, page numbers, per page selector (10, 25, 50).
Background: Light gray (#F8FAFC), cards white.
Typography: Inter font family.
```

### Prompt 2: Tenant Card Component
```
Design a tenant card component for admin dashboard:
Layout: Horizontal card with logo left, info center, status and menu right.
Left: 48px square with rounded corners (8px), gray background, business initial in center (bold, 20px).
Center info:
  - Business name: 16px bold dark gray (#1F2937)
  - Business type: 14px regular gray (#6B7280)
  - Owner: John Doe in medium weight
  - Email: john@example.com in regular gray
  - Bottom row: Blue "Pro" badge pill, "2 shops" text, "• Created Jan 15, 2026" gray text
Right side:
  - Status badge: Rounded pill (6px padding horizontal), green bg (#ECFDF5) + green text (#059669) for Active
  - Menu icon: Three vertical dots
Card: White background, 1px gray border, 8px radius, 16px padding.
Hover: Light gray background (#F9FAFB).
```

### Prompt 3: Complete Tenants Management Interface
```
Build a complete tenant management interface for SaaS admin panel.
Structure:
1. Top header bar: "Tenants" title (28px bold), subtitle (14px gray), "Invite New Tenant" blue button
2. Filter bar: Full width search input (gray border, magnifying glass icon, placeholder "Search by name, owner, email..."),
   Filter dropdown button, Sort dropdown button
3. Results info: "Showing 1-10 of 127 tenants" gray text
4. List of 3 example tenant cards with realistic data:
   - Fashion Store (Active, Pro, 2 shops)
   - Tech Shop Electronics (Active, Enterprise, 5 shops)
   - Food Corner Restaurant (Pending, Basic, 1 shop)
5. Pagination: Left arrows, "1 2 3 ... 13" page numbers, right arrows, "10 per page" dropdown
Colors: Light gray page bg (#F8FAFC), white cards, blue primary (#2563EB), status colors green/amber/red.
Style: Clean modern SaaS dashboard look with Inter font.
```

---

## 11. Related Documents

- [UI-DOC-02: Admin Dashboard](./UI-DOC-02-ADMIN-DASHBOARD.md)
- [UI-DOC-03: Admin Onboard Owner](./UI-DOC-03-ADMIN-ONBOARD-OWNER.md)
- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
