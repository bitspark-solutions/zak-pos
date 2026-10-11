# UI-DOC-02: Admin Dashboard

## Document Info
- **Document ID**: UI-DOC-02
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Admin
- **Page Type**: Dashboard

---

## 1. Page Overview

### Page Purpose
The Admin Dashboard is the central hub for platform administrators to monitor platform health, manage tenants (business owners), view key metrics, and access administrative functions. It provides a high-level overview of the entire ZakPos ecosystem.

### Page Description
A comprehensive dashboard displaying platform-wide statistics, recent activity, tenant management shortcuts, and system health indicators. Designed for quick decision-making and efficient navigation to common admin tasks.

### URL Pattern
- **Development**: `http://localhost:3000/admin-dashboard`
- **Production**: `/admin-dashboard`

### Access Control
- Requires: `admin` role
- Required Permissions: `report:read`, `system:admin`

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  [ZAKPOS LOGO]              ADMIN         [Notifications] [User] |
+------------------------------------------------------------------+
|                                                                   |
|  +---------------------+  +---------------------+                |
|  |  TOTAL TENANTS      |  |  ACTIVE OWNERS      |                |
|  |       127           |  |       98            |                |
|  |  +12% from last mo  |  |   +8% from last mo  |                |
|  +---------------------+  +---------------------+                |
|                                                                   |
|  +---------------------+  +---------------------+                |
|  |  TOTAL TRANSACTIONS |  |  PLATFORM REVENUE   |                |
|  |     1,234,567       |  |    $45,678.90       |                |
|  |  +23% from last mo  |  |   +15% from last mo |                |
|  +---------------------+  +---------------------+                |
|                                                                   |
|  +----------------------------------------------------------------+
|  |  RECENT ACTIVITY                          [View All]          |
|  +----------------------------------------------------------------+
|  |  [Avatar] John Doe created tenant "Fashion Store"    5m ago   |
|  |  [Avatar] Jane Smith onboarded owner "Tech Shop"      12m ago |
|  |  [Avatar] Mike Chen upgraded plan for "Food Corner"   1h ago  |
|  |  [Avatar] Sarah Lee suspended tenant "XYZ Corp"      2h ago  |
|  +----------------------------------------------------------------+
|                                                                   |
|  +------------------------+  +----------------------------------+
|  |  QUICK ACTIONS         |  |  PLATFORM HEALTH                |
|  +------------------------+  +----------------------------------+
|  |  [+ Invite New Tenant] |  |  API Status:     [OK]           |
|  |  [View All Tenants]    |  |  Database:       [OK]           |
|  |  [Generate Report]     |  |  Cache:           [OK]          |
|  |  [Platform Settings]   |  |  Email Service:  [OK]          |
|  +------------------------+  +----------------------------------+
|                                                                   |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Primary Brand | Deep Blue | #1E40AF |
| Primary Accent | Blue | #2563EB |
| Success | Green | #059669 |
| Warning | Amber | #D97706 |
| Error | Red | #DC2626 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |
| Border | Light Gray | #E5E7EB |
| Stat Card 1 | Blue tint | #EFF6FF |
| Stat Card 2 | Green tint | #ECFDF5 |
| Stat Card 3 | Purple tint | #F5F3FF |
| Stat Card 4 | Orange tint | #FFF7ED |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Inter | 28px | Bold (700) |
| Welcome Text | Inter | 16px | Regular (400) |
| Stat Number | Inter | 32px | Bold (700) |
| Stat Label | Inter | 14px | Medium (500) |
| Stat Change | Inter | 12px | Regular (400) |
| Card Title | Inter | 16px | Semibold (600) |
| List Item | Inter | 14px | Regular (400) |
| Timestamp | Inter | 12px | Regular (400) |
| Button Text | Inter | 14px | Medium (500) |

### Spacing System
- Page padding: 24px
- Card gap: 24px
- Card padding: 24px
- Card border radius: 12px
- Stat card border radius: 12px
- Button border radius: 8px

### Visual Effects
- Card shadow: `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`
- Hover shadow: `0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)`
- Stat card hover: Subtle lift with increased shadow

---

## 3. Dashboard Components

### 3.1 Header Bar
**Elements:**
- Logo (left)
- Page title: "Admin Dashboard"
- Notifications bell icon with badge count
- User avatar dropdown (right)

**User Dropdown Menu:**
- Profile
- Settings
- Sign Out

### 3.2 Stat Cards (4 cards in 2x2 grid)

#### Card 1: Total Tenants
| Attribute | Value |
|-----------|-------|
| Icon | Building (🏢) |
| Icon Color | Blue (#2563EB) |
| Background Tint | #EFF6FF |
| Value | Number (e.g., 127) |
| Label | "Total Tenants" |
| Change | "+12% from last month" |
| Change Color | Green if positive, Red if negative |

#### Card 2: Active Owners
| Attribute | Value |
|-----------|-------|
| Icon | User (👤) |
| Icon Color | Green (#059669) |
| Background Tint | #ECFDF5 |
| Value | Number (e.g., 98) |
| Label | "Active Owners" |
| Change | "+8% from last month" |
| Change Color | Green if positive |

#### Card 3: Total Transactions
| Attribute | Value |
|-----------|-------|
| Icon | Receipt (🧾) |
| Icon Color | Purple (#7C3AED) |
| Background Tint | #F5F3FF |
| Value | Number with formatting (e.g., 1,234,567) |
| Label | "Total Transactions" |
| Change | "+23% from last month" |
| Change Color | Green if positive |

#### Card 4: Platform Revenue
| Attribute | Value |
|-----------|-------|
| Icon | Dollar (💰) |
| Icon Color | Orange (#EA580C) |
| Background Tint | #FFF7ED |
| Value | Currency (e.g., $45,678.90) |
| Label | "Platform Revenue" |
| Change | "+15% from last month" |
| Change Color | Green if positive |

### 3.3 Recent Activity Section
**Card Title:** "Recent Activity"
**Action:** "View All" link

**Activity Item Structure:**
- Avatar (32px, circular)
- Activity description text
- Timestamp (relative: "5m ago", "12m ago", "1h ago")
- Item border-bottom (last item has none)

**Sample Activity Items:**
1. "[Avatar] John Doe created tenant 'Fashion Store' [5m ago]"
2. "[Avatar] Jane Smith onboarded owner 'Tech Shop' [12m ago]"
3. "[Avatar] Mike Chen upgraded plan for 'Food Corner' [1h ago]"
4. "[Avatar] Sarah Lee suspended tenant 'XYZ Corp' [2h ago]"

### 3.4 Quick Actions Section
**Card Title:** "Quick Actions"

**Buttons:**
1. **[+ Invite New Tenant]**
   - Type: Primary (filled blue)
   - Icon: Plus icon
   - Action: Opens invite tenant modal

2. **[View All Tenants]**
   - Type: Secondary (outlined)
   - Icon: Building icon
   - Action: Navigate to tenants list

3. **[Generate Report]**
   - Type: Secondary (outlined)
   - Icon: Document icon
   - Action: Opens report generation modal

4. **[Platform Settings]**
   - Type: Secondary (outlined)
   - Icon: Settings gear icon
   - Action: Navigate to settings page

### 3.5 Platform Health Section
**Card Title:** "Platform Health"
**Card Subtitle:** "All systems operational"

**Status Indicators (4 items):**
| Service | Status | Indicator |
|---------|--------|-----------|
| API Status | OK | Green dot + "Operational" |
| Database | OK | Green dot + "Operational" |
| Cache | OK | Green dot + "Operational" |
| Email Service | OK | Green dot + "Operational" |

**Status Colors:**
- OK: Green (#059669) with green dot
- Degraded: Yellow (#D97706) with yellow dot
- Down: Red (#DC2626) with red dot

---

## 4. Data Display

### Stat Card Data Structure
```typescript
interface StatCard {
  id: string;
  icon: string;
  iconColor: string;
  backgroundTint: string;
  value: number | string;
  label: string;
  change: {
    value: string;      // e.g., "+12%"
    direction: 'up' | 'down' | 'neutral';
    period: string;     // e.g., "from last month"
  };
}
```

### Activity Item Data Structure
```typescript
interface ActivityItem {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;        // e.g., "created tenant"
  target: string;        // e.g., "Fashion Store"
  timestamp: Date;
  type: 'create' | 'update' | 'delete' | 'suspend' | 'upgrade';
}
```

### Platform Health Data Structure
```typescript
interface PlatformHealth {
  services: {
    name: string;
    status: 'ok' | 'degraded' | 'down';
    responseTime?: number;  // ms
    lastChecked: Date;
  }[];
  overall: 'operational' | 'degraded' | 'down';
}
```

---

## 5. User Interactions & Flows

### Primary Flow: Admin Views Dashboard
```
1. Admin logs in at /admin-login
2. System redirects to /admin-dashboard
3. Dashboard loads with:
   - Fetching stat cards data
   - Fetching recent activities
   - Fetching platform health
4. Admin views overview
5. Admin clicks on stat card → navigates to detailed view
6. Admin clicks "View All" → navigates to full list
```

### Quick Action Flows

#### Flow: Invite New Tenant
```
1. Admin clicks "[+ Invite New Tenant]"
2. Modal opens with invite tenant form
3. Admin fills: Business name, Owner name, Owner email
4. Admin clicks "Send Invite"
5. System sends invitation email
6. Modal closes with success toast
7. Activity feed updates
```

#### Flow: View Tenants
```
1. Admin clicks "[View All Tenants]"
2. Page navigates to /admin/tenants
3. Shows paginated list of all tenants
```

### Hover & Click States
- Stat cards: Hover shows subtle lift + shadow increase
- Activity items: Hover shows light gray background
- Buttons: Hover darkens, click shows press effect
- Links: Hover shows underline

---

## 6. API Endpoints

### GET Dashboard Stats
```
GET /api/v1/admin/dashboard/stats
Authorization: Bearer <admin_token>

Response:
{
  "totalTenants": 127,
  "activeOwners": 98,
  "totalTransactions": 1234567,
  "platformRevenue": 45678.90,
  "changes": {
    "tenants": { "value": "+12%", "direction": "up" },
    "owners": { "value": "+8%", "direction": "up" },
    "transactions": { "value": "+23%", "direction": "up" },
    "revenue": { "value": "+15%", "direction": "up" }
  }
}
```

### GET Recent Activity
```
GET /api/v1/admin/dashboard/activity?limit=5
Authorization: Bearer <admin_token>

Response:
{
  "data": [
    {
      "id": "act_123",
      "user": { "id": "usr_1", "name": "John Doe", "avatar": null },
      "action": "created tenant",
      "target": "Fashion Store",
      "timestamp": "2026-03-20T09:00:00Z",
      "type": "create"
    }
  ],
  "total": 150
}
```

### GET Platform Health
```
GET /api/v1/admin/dashboard/health
Authorization: Bearer <admin_token>

Response:
{
  "overall": "operational",
  "services": [
    { "name": "API", "status": "ok", "responseTime": 45, "lastChecked": "2026-03-20T09:05:00Z" },
    { "name": "Database", "status": "ok", "responseTime": 12, "lastChecked": "2026-03-20T09:05:00Z" },
    { "name": "Cache", "status": "ok", "responseTime": 3, "lastChecked": "2026-03-20T09:05:00Z" },
    { "name": "Email", "status": "ok", "responseTime": 120, "lastChecked": "2026-03-20T09:05:00Z" }
  ]
}
```

---

## 7. Responsive Design

### Desktop (>1200px)
- 4 stat cards in 2x2 grid
- Activity and Quick Actions side by side
- Full sidebar

### Tablet (768px - 1200px)
- 4 stat cards in 2x2 grid (smaller)
- Activity and Quick Actions stacked
- Collapsible sidebar

### Mobile (<768px)
- 4 stat cards stacked vertically (full width)
- Quick Actions as horizontal scroll or 2x2 grid
- Bottom navigation for primary actions
- Hamburger menu for sidebar

---

## 8. Accessibility

- All stat cards have aria-labels
- Status indicators have text alternatives
- Keyboard navigation for all buttons
- Focus visible on all interactive elements
- Color is not the only indicator of status (icons + text)

---

## 9. Loading & Error States

### Loading State
- Skeleton cards for stat values
- Skeleton lines for activity items
- Skeleton placeholders for health indicators
- Pulse animation on skeletons

### Error State
- Error banner at top of page
- "Failed to load dashboard" message
- "Retry" button

### Empty State
- "No recent activity" message
- Illustration or icon
- Prompt to take action

---

## 10. Google Snitch Prompts

### Prompt 1: Admin Dashboard Overview
```
Create a modern admin dashboard for a B2B SaaS POS platform called ZakPos.
Layout: Top header bar with logo, title, notifications, and user avatar.
Below: 4 stat cards in a 2x2 grid showing:
  - Total Tenants (blue, 127)
  - Active Owners (green, 98)
  - Total Transactions (purple, 1,234,567)
  - Platform Revenue (orange, $45,678.90)
Each card has: Icon in colored circle, large bold number, label, and small percentage change text.
Below cards: Two-column layout with Recent Activity on left and Quick Actions + Platform Health on right.
Activity items show avatar, user name, action text, and relative timestamp.
Quick action buttons: Blue primary "Invite New Tenant" and outlined secondary buttons.
Platform health shows 4 services with green dots and "Operational" status.
Colors: White cards on light gray (#F8FAFC) background, blue (#2563EB) primary accent.
Typography: Inter font family, clean modern look similar to Stripe dashboard.
```

### Prompt 2: Admin Dashboard Cards
```
Design 4 stat cards for an admin dashboard:
Card 1: "Total Tenants" - Building icon in blue circle, "127" in large bold text, "+12% from last month" in green small text
Card 2: "Active Owners" - User icon in green circle, "98" in large bold text, "+8% from last month" in green small text
Card 3: "Total Transactions" - Receipt icon in purple circle, "1,234,567" formatted with commas, "+23% from last month" in green
Card 4: "Platform Revenue" - Dollar icon in orange circle, "$45,678.90" formatted as currency, "+15% from last month" in green
Each card: White background, rounded corners (12px), subtle shadow, 24px padding, colored left border accent.
Hover effect: Slight lift with increased shadow.
Numbers should use bold 32px font, labels use 14px medium gray text.
```

### Prompt 3: Complete Admin Dashboard
```
Create a complete admin dashboard interface with:
1. Header: ZakPos logo (left), "Admin Dashboard" title (center-left), notification bell with red badge showing "3", user avatar dropdown (right)
2. Stats row: 4 cards in responsive grid - Total Tenants (blue), Active Owners (green), Total Transactions (purple), Platform Revenue (orange)
3. Main content (2 columns):
   Left column (60%): "Recent Activity" card with 4 activity items, each showing user avatar, description, timestamp. "View All" link top right.
   Right column (40%): "Quick Actions" card with 4 buttons stacked vertically, plus "Platform Health" card showing 4 services with green status dots.
4. All cards: White background, 12px border radius, subtle shadow, 24px padding.
5. Color scheme: Light gray page background (#F8FAFC), white cards, blue primary (#2563EB), gray text hierarchy.
6. Responsive: Cards stack on mobile, sidebar becomes hamburger menu.
```

---

## 11. Related Documents

- [UI-DOC-01: Admin Login](./UI-DOC-01-ADMIN-LOGIN.md)
- [UI-DOC-03: Admin Onboard Owner](./UI-DOC-03-ADMIN-ONBOARD-OWNER.md)
- [UI-DOC-04: Admin Manage Tenants](./UI-DOC-04-ADMIN-MANAGE-TENANTS.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
