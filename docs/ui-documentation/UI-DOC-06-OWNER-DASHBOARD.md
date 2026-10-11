# UI-DOC-06: Owner Dashboard

## Document Info
- **Document ID**: UI-DOC-06
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner
- **Page Type**: Dashboard

---

## 1. Page Overview

### Page Purpose
The Owner Dashboard is the central hub for business owners to monitor their business performance, view key metrics, manage products and inventory, and access all business management features. It provides a comprehensive overview of business health.

### Page Description
A feature-rich dashboard displaying sales metrics, inventory alerts, recent transactions, quick actions, and business performance indicators. Designed for quick insights and efficient navigation to common business management tasks.

### URL Pattern
- **Development**: `http://localhost:3000/dashboard`
- **Production**: `/dashboard`

### Access Control
- Requires: `owner` or `manager` role
- Required Permissions: Various (report:read, product:read, inventory:read, sale:read)

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  [Sidebar]  |           HEADER BAR                              |
|             |  [Shop Selector v]   [🔔 3] [User ▼]              |
+-------------+-----------------------------------------------------+
|             |                                                     |
|  🏠 Dash    |  +---------------------------------------------+  |
|             |  |  Good morning, John!  👋                     |  |
|  🛒 POS     |  |  Here's what's happening with Fashion Store |  |
|             |  +---------------------------------------------+  |
|  📦 Products|                                                     |
|             |  +--------+  +--------+  +--------+  +--------+  |
|  📋 Inv    |  | TODAY'S|  | WEEKLY |  | MONTHLY|  |INVENTORY| |
|             |  | SALES  |  | SALES  |  | SALES  |  | ALERTS |  |
|  💰 Sales  |  | $1,234 |  | $8,567 |  |$34,567 |  |   12   |  |
|             |  | +15%   |  | +8%    |  | +23%   |  | Low    |  |
|  📊 Reports|  +--------+  +--------+  +--------+  +--------+  |
|             |                                                     |
|  📈 Invoices|  +---------------------------------------------+  |
|             |  |  SALES THIS WEEK                    [View All]|  |
|  👥 Users   |  +---------------------------------------------+  |
|             |  |  [Line/Bar Chart showing 7-day trend]         |  |
|  ⚙️ Settings|  +---------------------------------------------+  |
|             |                                                     |
|             |  +--------------------+  +----------------------+   |
|             |  | RECENT TRANSACTIONS|  | QUICK ACTIONS        |   |
|             |  +--------------------+  +----------------------+   |
|             |  | #1234 - $56.78  👤  |  | [+ New Sale]         |   |
|             |  | #1233 - $123.45 👤  |  | [Add Product]       |   |
|             |  | #1232 - $89.00  👤  |  | [Inventory Check]   |   |
|             |  | #1231 - $234.56 👤  |  | [Create Invoice]     |   |
|             |  +--------------------+  +----------------------+   |
|             |                                                     |
|             |  +--------------------+  +----------------------+   |
|             |  | LOW STOCK ALERTS    |  | PENDING INVOICES     |   |
|             |  +--------------------+  +----------------------+   |
|             |  | ⚠️ 12 items low     |  | 📄 3 invoices pending|   |
|             |  | [View Inventory]    |  | [View Invoices]      |   |
|             |  +--------------------+  +----------------------+   |
|             |                                                     |
+-------------+-----------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Sidebar Background | Dark Blue | #1E3A5F |
| Sidebar Text | White | #FFFFFF |
| Sidebar Hover | Lighter Blue | #2D4A6F |
| Sidebar Active | Blue Accent | #2563EB |
| Page Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Primary Accent | Blue | #2563EB |
| Success | Green | #059669 |
| Warning | Amber | #D97706 |
| Error | Red | #DC2626 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |
| Border | Light Gray | #E5E7EB |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Welcome Text | Inter | 24px | Bold (700) |
| Subtitle | Inter | 14px | Regular (400) |
| Stat Number | Inter | 28px | Bold (700) |
| Stat Label | Inter | 13px | Medium (500) |
| Card Title | Inter | 16px | Semibold (600) |
| List Item | Inter | 14px | Regular (400) |
| Sidebar Item | Inter | 14px | Medium (500) |

### Sidebar
- Width: 240px (collapsible to 64px)
- Dark blue background (#1E3A5F)
- White text and icons
- Active item: Blue accent background
- Hover: Lighter blue background

---

## 3. Dashboard Components

### 3.1 Header Bar
**Elements:**
- Shop selector dropdown (if multiple shops)
- Notification bell with badge
- User avatar dropdown

### 3.2 Welcome Section
- Greeting: "Good morning, John!" with wave emoji
- Business name: "Here's what's happening with Fashion Store"

### 3.3 Stat Cards (4 cards)

#### Card 1: Today's Sales
| Attribute | Value |
|-----------|-------|
| Label | TODAY'S SALES |
| Value | $1,234.00 |
| Change | "+15% from yesterday" (green) |
| Icon | Dollar (💵) |

#### Card 2: Weekly Sales
| Attribute | Value |
|-----------|-------|
| Label | WEEKLY SALES |
| Value | $8,567.00 |
| Change | "+8% from last week" (green) |
| Icon | Calendar (📅) |

#### Card 3: Monthly Sales
| Attribute | Value |
|-----------|-------|
| Label | MONTHLY SALES |
| Value | $34,567.00 |
| Change | "+23% from last month" (green) |
| Icon | Chart (📈) |

#### Card 4: Inventory Alerts
| Attribute | Value |
|-----------|-------|
| Label | INVENTORY ALERTS |
| Value | 12 |
| Subtext | "items low" |
| Icon | Warning (⚠️) |
| Color | Amber for warning |

### 3.4 Sales Chart Section
**Card Title:** "Sales This Week"
**Action:** "View All" link

**Chart Type:** Line chart or Bar chart (7-day trend)
**Y-Axis:** Sales amount
**X-Axis:** Days (Mon-Sun)
**Colors:**
- Line/Fill: Blue (#2563EB)
- Grid lines: Light gray

### 3.5 Recent Transactions
**Card Title:** "Recent Transactions"
**Action:** "View All" link

**Transaction Item:**
- Receipt number (#1234)
- Amount ($56.78)
- Customer icon (👤)
- Payment method badge (Cash/Card)

### 3.6 Quick Actions
**Card Title:** "Quick Actions"

**Buttons (2x2 grid):**
1. **[+ New Sale]** - Primary blue
2. **[Add Product]** - Secondary outlined
3. **[Inventory Check]** - Secondary outlined
4. **[Create Invoice]** - Secondary outlined

### 3.7 Low Stock Alerts
**Card Title:** "Low Stock Alerts"
**Icon:** Warning triangle
**Count:** 12 items low
**CTA:** "View Inventory"

### 3.8 Pending Invoices
**Card Title:** "Pending Invoices"
**Icon:** Document
**Count:** 3 invoices pending
**CTA:** "View Invoices"

---

## 4. Data Structure

### Dashboard Stats
```typescript
interface DashboardStats {
  todaySales: number;
  todayChange: number;
  weekSales: number;
  weekChange: number;
  monthSales: number;
  monthChange: number;
  lowStockCount: number;
}
```

### Recent Transaction
```typescript
interface Transaction {
  id: string;
  receiptNumber: string;
  amount: number;
  customer?: string;
  paymentMethod: 'cash' | 'card' | 'mobile';
  createdAt: Date;
}
```

### Sales Chart Data
```typescript
interface SalesChartData {
  labels: string[];  // Days
  data: number[];    // Sales amounts
}
```

---

## 5. User Interactions & Flows

### Primary Flow: Owner Views Dashboard
```
1. Owner logs in
2. System redirects to /dashboard
3. Dashboard loads with:
   - User's shops loaded
   - Stats fetched for selected shop
   - Recent transactions loaded
   - Alerts loaded
4. Owner views overview
5. Owner can click cards to drill down
```

### Shop Switching
```
1. Owner clicks shop selector
2. Dropdown shows all shops
3. Owner selects different shop
4. Dashboard refreshes with new shop's data
5. Selection persists in localStorage
```

### Quick Action Flows

#### New Sale
```
1. Owner clicks "[+ New Sale]"
2. Redirects to /pos
3. POS interface opens for new transaction
```

#### View Inventory
```
1. Owner clicks "[View Inventory]" or low stock card
2. Redirects to /inventory?filter=low
3. Shows inventory with low stock filter
```

---

## 6. API Endpoints

### GET Dashboard Data
```
GET /api/v1/dashboard
Authorization: Bearer <owner_token>
Query: ?shopId=shop_123

Response:
{
  "stats": {
    "todaySales": 1234.00,
    "todayChange": 15,
    "weekSales": 8567.00,
    "weekChange": 8,
    "monthSales": 34567.00,
    "monthChange": 23,
    "lowStockCount": 12,
    "pendingInvoices": 3
  },
  "recentTransactions": [
    {
      "id": "txn_123",
      "receiptNumber": "#1234",
      "amount": 56.78,
      "paymentMethod": "cash",
      "createdAt": "2026-03-20T09:30:00Z"
    }
  ],
  "salesChart": {
    "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "data": [1200, 1500, 1100, 1800, 2000, 2500, 967]
  }
}
```

---

## 7. Responsive Design

### Desktop (>1200px)
- Full sidebar visible (240px)
- 4 stat cards in row
- Chart full width
- Side-by-side sections below

### Tablet (768px - 1200px)
- Collapsed sidebar (64px icons only)
- 4 stat cards in 2x2
- Stacked sections

### Mobile (<768px)
- Hidden sidebar (hamburger menu)
- 4 stat cards stacked
- Full-width sections
- Bottom navigation bar

---

## 8. Google Snitch Prompts

### Prompt 1: Owner Dashboard Layout
```
Create a business owner dashboard for a POS system called ZakPos.
Layout: Left sidebar (dark blue #1E3A5F, 240px wide) with icon+text menu items.
Sidebar items: Dashboard (active blue), POS, Products, Inventory, Sales, Reports, Invoices, Users, Settings.
Main content area: Light gray (#F8FAFC) background.
Top header: Shop selector dropdown (if multiple shops), notification bell with red badge "3", user avatar with dropdown.
Welcome section: "Good morning, John! 👋" in large bold text, "Here's what's happening with Fashion Store" subtitle.
4 stat cards in a row:
  1. "TODAY'S SALES" - $1,234 with "+15% from yesterday" in green
  2. "WEEKLY SALES" - $8,567 with "+8% from last week"
  3. "MONTHLY SALES" - $34,567 with "+23% from last month"
  4. "INVENTORY ALERTS" - "12 items low" in amber with warning icon
Each card: White background, subtle shadow, icon on left, number large bold, label small gray.
Sales chart below: "Sales This Week" card with 7-day bar chart in blue.
Recent transactions list and Quick Actions cards side by side below.
Quick action buttons: Blue "+ New Sale" and outlined "Add Product", "Inventory Check", "Create Invoice".
Modern Inter font, clean professional look.
```

### Prompt 2: Dashboard Stat Cards
```
Design 4 metric cards for a business dashboard:
Card 1: "TODAY'S SALES"
  - Left side: Dollar icon in blue circle
  - Value: "$1,234" (28px bold)
  - Label: "Today's Sales" (13px gray)
  - Change: "+15%" in green with up arrow
Card 2: "WEEKLY SALES"
  - Similar layout
  - Value: "$8,567"
  - Change: "+8%"
Card 3: "MONTHLY SALES"
  - Value: "$34,567"
  - Change: "+23%"
Card 4: "INVENTORY ALERTS"
  - Warning icon in amber circle
  - Value: "12" (bold)
  - Label: "items low"
  - No percentage
Cards: White bg, 1px border, 12px border radius, 20px padding, subtle shadow.
Hover: Slight lift with shadow increase.
```

### Prompt 3: Complete Owner Dashboard
```
Build a complete owner dashboard with sidebar navigation.
Sidebar: Dark blue (#1E3A5F), 240px width, ZakPos logo at top, nav items with icons:
  - Dashboard (grid icon) - highlighted/active
  - POS (shopping cart)
  - Products (box)
  - Inventory (clipboard)
  - Sales (dollar)
  - Reports (chart)
  - Invoices (document)
  - Users (people)
  - Settings (gear)
Each nav item: Icon left, text right, 44px height, white text, hover lightens bg.
Main area:
  - Header bar with shop dropdown, notifications (bell with "3" badge), user avatar
  - Welcome banner: "Good morning, John! 👋" bold, "Fashion Store overview" gray
  - 4 stat cards in row (sales metrics + alerts)
  - Full-width sales chart card
  - 2-column layout: Recent Transactions list + Quick Actions buttons
  - 2-column layout: Low Stock Alerts + Pending Invoices
Colors: Dark sidebar, light gray page, white cards, blue accents (#2563EB), green success, amber warnings.
Typography: Inter font family, modern clean SaaS aesthetic.
```

---

## 9. Related Documents

- [UI-DOC-05: Owner Login](./UI-DOC-05-OWNER-LOGIN.md)
- [UI-DOC-07: Owner Onboard User](./UI-DOC-07-OWNER-ONBOARD-USER.md)
- [UI-DOC-09: POS Interface](./UI-DOC-09-CASHIER-POS.md)
- [UI-DOC-10: Product Management](./UI-DOC-10-PRODUCT-MANAGEMENT.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
