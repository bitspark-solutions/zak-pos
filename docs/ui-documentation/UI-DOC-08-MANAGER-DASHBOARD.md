# UI-DOC-08: Manager Dashboard

## Document Info
- **Document ID**: UI-DOC-08
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Manager
- **Page Type**: Dashboard

---

## 1. Page Overview

### Page Purpose
The Manager Dashboard provides employees with management responsibilities access to key business metrics, daily operations overview, and quick access to product/inventory management and order processing.

### Page Description
A focused dashboard for managers showing operational metrics, recent activity, and direct shortcuts to the tasks managers need most: products, inventory, and sales management.

### URL Pattern
- **Development**: `http://localhost:3000/dashboard`
- **Production**: `/dashboard`

### Access Control
- Requires: `manager` role
- Inherited sidebar from Owner but with fewer options

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  [Sidebar]  |           HEADER BAR                              |
|             |  [Shop: Main Store v]  [🔔] [User ▼]              |
+-------------+-----------------------------------------------------+
|             |                                                     |
|  🏠 Dash    |  +---------------------------------------------+  |
|             |  |  Good morning, Jane!  👋                     |  |
|  🛒 POS     |  |  Main Store operations overview              |  |
|             |  +---------------------------------------------+  |
|  📦 Products|                                                     |
|             |  +--------+  +--------+  +--------+  +--------+  |
|  📋 Inv    |  | TODAY'S|  | PENDING|  | LOW    |  | TOTAL  |  |
|             |  | SALES  |  | ORDERS |  | STOCK  |  | PRODUCTS| |
|  💰 Sales  |  | $567   |  |   8    |  |   5    |  |   342  |  |
|             |  | +12%   |  |        |  |        |  |        |  |
|             |  +--------+  +--------+  +--------+  +--------+  |
|             |                                                     |
|  📈 Invoices|  +---------------------------------------------+  |
|             |  |  TODAY'S ACTIVITY                    [View All]|  |
|             |  +---------------------------------------------+  |
|             |  |  🛒 Sale #1234 completed - $234.56   9:30 AM |  |
|             |  |  📦 Product "Blue Shirt" updated     9:15 AM |  |
|             |  |  📋 Inventory restocked: Widget A    8:45 AM |  |
|             |  |  🛒 Sale #1233 completed - $89.00    8:30 AM |  |
|             |  +---------------------------------------------+  |
|             |                                                     |
|             |  +--------------------+  +----------------------+   |
|             |  | QUICK ACTIONS       |  | INVENTORY ALERTS     |   |
|             |  +--------------------+  +----------------------+   |
|             |  | [Process Sale]      |  | ⚠️ 5 items low stock |   |
|             |  | [Add Product]       |  | • Blue Shirt (Size M)|   |
|             |  | [Check Inventory]   |  | • Red Pants (Size L) |   |
|             |  | [View Orders]       |  | [View All]            |   |
|             |  +--------------------+  +----------------------+   |
|             |                                                     |
+-------------+-----------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Sidebar Background | Dark Blue | #1E3A5F |
| Page Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Primary Accent | Blue | #2563EB |
| Success | Green | #059669 |
| Warning | Amber | #D97706 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Welcome Text | Inter | 24px | Bold (700) |
| Stat Number | Inter | 24px | Bold (700) |
| Stat Label | Inter | 12px | Medium (500) |
| Card Title | Inter | 15px | Semibold (600) |
| List Item | Inter | 14px | Regular (400) |

---

## 3. Dashboard Components

### 3.1 Stat Cards (4 cards)

#### Card 1: Today's Sales
- Value: $567.00
- Change: +12%
- Icon: Dollar

#### Card 2: Pending Orders
- Value: 8
- Icon: Clock

#### Card 3: Low Stock Items
- Value: 5
- Icon: Warning

#### Card 4: Total Products
- Value: 342
- Icon: Box

### 3.2 Activity Feed
Shows real-time updates:
- Sales completed
- Product updates
- Inventory changes
- Each with icon, description, time

### 3.3 Quick Actions
1. **[Process Sale]** - Primary
2. **[Add Product]** - Secondary
3. **[Check Inventory]** - Secondary
4. **[View Orders]** - Secondary

### 3.4 Inventory Alerts
- List of low stock items
- Product name + variant
- "View All" link

---

## 4. User Interactions

### Primary Flow: Manager Views Dashboard
```
1. Manager logs in
2. Redirects to /dashboard
3. Dashboard loads with:
   - Shop context (default shop)
   - Today's metrics
   - Recent activity
   - Quick action shortcuts
4. Manager can:
   - Switch shops (if multiple assigned)
   - Click any card for details
   - Use quick actions
```

---

## 5. Data Structure

```typescript
interface ManagerDashboardData {
  shop: {
    id: string;
    name: string;
  };
  stats: {
    todaySales: number;
    salesChange: number;
    pendingOrders: number;
    lowStockCount: number;
    totalProducts: number;
  };
  recentActivity: {
    id: string;
    type: 'sale' | 'product' | 'inventory';
    description: string;
    amount?: number;
    timestamp: Date;
  }[];
  lowStockItems: {
    id: string;
    name: string;
    variant?: string;
    quantity: number;
  }[];
}
```

---

## 6. API Endpoints

### GET Manager Dashboard
```
GET /api/v1/dashboard/manager
Authorization: Bearer <manager_token>
Query: ?shopId=shop_123

Response:
{
  "shop": { "id": "shop_1", "name": "Main Store" },
  "stats": {
    "todaySales": 567.00,
    "salesChange": 12,
    "pendingOrders": 8,
    "lowStockCount": 5,
    "totalProducts": 342
  },
  "recentActivity": [...],
  "lowStockItems": [...]
}
```

---

## 7. Comparison: Owner vs Manager Dashboard

| Feature | Owner | Manager |
|---------|-------|---------|
| Today's Sales | ✓ | ✓ |
| Weekly Sales | ✓ | ✗ |
| Monthly Sales | ✓ | ✗ |
| Pending Orders | ✓ | ✓ |
| Low Stock Alerts | ✓ | ✓ |
| Total Products | ✓ | ✓ |
| Reports Access | ✓ | ✓ |
| User Management | ✓ | ✗ |
| Settings Access | ✓ | ✗ |
| Financial Reports | ✓ | View only |

---

## 8. Google Snitch Prompts

### Prompt 1: Manager Dashboard
```
Create a manager dashboard for a POS system with simplified navigation.
Sidebar (240px dark blue): Dashboard, POS, Products, Inventory, Sales, Invoices.
(No Users or Settings - those are owner only)
Main content: "Good morning, Jane! 👋" with shop name "Main Store operations overview"
4 stat cards in a row:
  - Today's Sales: $567 (+12%)
  - Pending Orders: 8
  - Low Stock: 5 items
  - Total Products: 342
Today's Activity feed showing recent sales and updates.
Quick Actions: Process Sale, Add Product, Check Inventory, View Orders.
Inventory Alerts card showing low stock items list.
Clean modern design, Inter font, blue primary accents.
```

### Prompt 2: Manager Overview Cards
```
Design stat cards specifically for a store manager:
Card 1: "TODAY'S SALES" - $567 in bold, "+12% from yesterday" in small green text
Card 2: "PENDING ORDERS" - "8" in bold, "awaiting processing" in small gray text
Card 3: "LOW STOCK" - "5" in bold amber, "items need restocking" in small text
Card 4: "TOTAL PRODUCTS" - "342" in bold, "in catalog" in small gray text
Each card: White bg, subtle shadow, 40px icon area on left with colored background, 12px radius.
```

---

## 9. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-09: POS Interface](./UI-DOC-09-CASHIER-POS.md)
- [UI-DOC-10: Product Management](./UI-DOC-10-PRODUCT-MANAGEMENT.md)
- [UI-DOC-11: Inventory Management](./UI-DOC-11-INVENTORY-MANAGEMENT.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
