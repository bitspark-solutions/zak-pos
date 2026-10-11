# UI-DOC-13: Sales History

## Document Info
- **Document ID**: UI-DOC-13
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner, Manager, Cashier
- **Page Type**: Reports/History

---

## 1. Page Overview

### Page Purpose
The Sales History page provides a complete record of all completed sales transactions. It allows users to view past sales, filter by date/customer/payment method, and access receipt details.

### Page Description
A comprehensive sales transaction log with powerful filtering, search, and export capabilities. Shows transaction details including items sold, payment information, and associated receipts.

### URL Pattern
- **Development**: `http://localhost:3000/sales`
- **Production**: `/sales`

### Access Control
- Requires: `owner`, `manager`, or `cashier` role
- Required Permissions: `sale:read`

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  HEADER                                                          |
+------------------------------------------------------------------+
|                                                                  |
|  Sales History                [Export] [Print] [Reports]         |
|  View and manage past transactions                                |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | SUMMARY CARDS                                               |  |
|  +------------------------------------------------------------+  |
|  | +--------+  +--------+  +--------+  +--------+             |  |
|  | | TODAY  |  | WEEK   |  | MONTH  |  | AVG    |             |  |
|  | | $1,234 |  | $8,567 |  |$34,567 |  | $78.50 |             |  |
|  | |  15 txns|  |  112 txns|  |  456 txns|  | per txn|             |  |
|  | +--------+  +--------+  +--------+  +--------+             |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | FILTERS                                                    |  |
|  +------------------------------------------------------------+  |
|  | Date Range: [Mar 1, 2026] to [Mar 20, 2026] [📅]           |  |
|  | Shop: [All Shops v]  Status: [All v]  Payment: [All v]     |  |
|  | [🔍 Search by receipt # or customer...]                     |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                                                             |  |
|  |  TRANSACTION LIST                                          |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | #1234  | Mar 20, 2:30 PM  | $115.47  | [Cash] [👤]  | |  |
|  |  | 3 items - John D.                                     | |  |
|  |  | [View] [Receipt] [Refund]                             | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | #1233  | Mar 20, 1:15 PM  | $89.00   | [Card] [👤]  | |  |
|  |  | 2 items - Jane S.                                      | |  |
|  |  | [View] [Receipt] [Refund]                             | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | #1232  | Mar 20, 11:00 AM | $234.56 | [bKash] [👤] | |  |
|  |  | 5 items - Guest                                        | |  |
|  |  | [View] [Receipt] [Refund]                             | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                             |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | [<] Page 1 of 45 [>]               [20] per page  [Export] |  |
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
| Success | Green | #059669 |
| Cash Payment | Green | #059669 |
| Card Payment | Purple | #7C3AED |
| Mobile Payment | Blue | #2563EB |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Inter | 28px | Bold (700) |
| Stat Number | Inter | 24px | Bold (700) |
| Transaction ID | Inter | 14px | Semibold (600) |
| Amount | Inter | 16px | Bold (700) |
| Meta Text | Inter | 12px | Regular (400) |

---

## 3. Page Components

### 3.1 Summary Cards (4 cards)

| Card | Value | Subtext |
|------|-------|---------|
| Today | $1,234.00 | 15 transactions |
| This Week | $8,567.00 | 112 transactions |
| This Month | $34,567.00 | 456 transactions |
| Average | $78.50 | per transaction |

### 3.2 Filters

**Date Range Picker:**
- Start date input
- End date input
- Calendar icon
- Preset buttons: Today, This Week, This Month, Last 7 Days, Last 30 Days

**Dropdown Filters:**
- Shop: All Shops, Main Store, Branch 2
- Status: All, Completed, Refunded
- Payment: All, Cash, Card, Mobile (bKash/Nagad)

**Search:**
- Placeholder: "Search by receipt # or customer..."
- Searches: receipt number, customer name

### 3.3 Transaction Row

```
+-------------------------------------------------------------+
| #1234  | Mar 20, 2:30 PM  |  $115.47  |  [Cash]  [👤]       |
| 3 items - John D.                                         |
| [View Details] [Receipt] [Issue Refund]                   |
+-------------------------------------------------------------+
```

**Row Elements:**
- Receipt number: Bold, monospace (#1234)
- Date/time: Gray, formatted
- Amount: Large, bold, right-aligned
- Payment badge: Colored pill (Cash=green, Card=purple, Mobile=blue)
- Customer indicator: Person icon if logged in
- Item count + name: "3 items - John D." or "2 items - Guest"
- Action buttons: View Details, Receipt, Issue Refund

### 3.4 Payment Method Badges
| Method | Background | Text |
|--------|------------|------|
| Cash | #ECFDF5 | #059669 |
| Card | #F5F3FF | #7C3AED |
| bKash | #EFF6FF | #2563EB |
| Nagad | #EFF6FF | #2563EB |
| Bank Transfer | #F3F4F6 | #6B7280 |

---

## 4. Transaction Detail Modal

### Layout

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Transaction #1234                                          |  |
|  |  Completed - March 20, 2026 at 2:30 PM                     |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  SHOP: Main Store                                          |  |
|  |  CASHIER: John Doe                                         |  |
|  |  CUSTOMER: John D. (if logged in)                          |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  ITEMS PURCHASED                                           |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  Blue Shirt (Size M)                          x2   $59.98 |  |
|  |  White Pants (Size L)                          x1   $49.99 |  |
|  |  Tax (5%)                                         $5.50   |  |
|  |                                                        ------- |  |
|  |  TOTAL                                      $115.47        |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  PAYMENT                                                   |  |
|  |  Method: Cash                                              |  |
|  |  Amount Tendered: $150.00                                  |  |
|  |  Change Given: $34.53                                     |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  RECEIPT                                                   |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  [👁️ View Receipt]  [🖨️ Print Receipt]  [📧 Email Receipt] |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  ACTIONS                                                   |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  [Issue Refund]  (Opens refund modal)                      |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 5. Refund Modal

### Layout

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Issue Refund                                              |  |
|  |  Transaction #1234 - $115.47                               |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  REFUND TYPE                                               |  |
|  |  +------------------------------------------------------+ |  |
|  |  | (●) Full refund - $115.47                           | |  |
|  |  | ( ) Partial refund                                   | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  ITEMS TO REFUND                                          |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [✓] Blue Shirt (M) - $59.98                         | |  |
|  |  | [✓] White Pants (L) - $49.99                        | |  |
|  |  | Tax - $5.50                                         | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  REFUND AMOUNT                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [$115.47]                                            | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  REASON                                                   |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Select reason                                  v]   | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Customer damaged     - Defective        - Wrong item | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  NOTES                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Customer requested exchange for size L...........] | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL            PROCESS REFUND        | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Refund Reasons
- Customer damaged
- Defective product
- Wrong item
- Customer changed mind
- Size/fit issue
- Other

---

## 6. Data Structure

```typescript
interface Sale {
  id: string;
  receiptNumber: string;
  tenantId: string;
  shopId: string;
  cashierId: string;
  customerId?: string;
  status: 'completed' | 'refunded' | 'cancelled';
  lines: SaleLine[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
  amountTendered: number;
  changeGiven: number;
  refundedAmount?: number;
  createdAt: Date;
}

interface SaleLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}
```

---

## 7. API Endpoints

### GET Sales
```
GET /api/v1/sales
Authorization: Bearer <token>
Query: ?shopId=&startDate=&endDate=&status=&payment=&search=&page=1&limit=20
```

### GET Single Sale
```
GET /api/v1/sales/:id
Authorization: Bearer <token>
```

### POST Refund
```
POST /api/v1/sales/:id/refund
Body: { type: 'full' | 'partial', lines?: [...], amount: number, reason: string, notes?: string }
```

---

## 8. Google Snitch Prompts

### Prompt 1: Sales History Page
```
Create a sales history page for a POS system.
Header: "Sales History" title (28px bold), "View and manage past transactions" subtitle
Action buttons top right: Export, Print, Reports
Summary cards row:
  - Today: $1,234 (15 transactions) - blue
  - This Week: $8,567 (112 transactions) - green
  - This Month: $34,567 (456 transactions) - purple
  - Average: $78.50 per transaction - gray
Filter section:
  - Date range picker with calendar icon
  - Shop dropdown, Status dropdown, Payment dropdown
  - Search input with magnifying glass
Transaction list:
Each row:
  - Receipt number #1234 bold
  - Date/time Mar 20, 2:30 PM gray
  - Amount $115.47 large bold
  - Payment badge: Cash (green), Card (purple), bKash (blue)
  - Customer: "3 items - John D." or "3 items - Guest"
  - Action links: View Details, Receipt, Issue Refund
Rows: White background, bottom border, hover gray background.
Background: Light gray (#F8FAFC).
Clean modern Inter font, professional dashboard look.
```

### Prompt 2: Transaction Detail Modal
```
Design a transaction detail view modal.
Header: Transaction #1234 bold, status "Completed" green badge, date/time
Info section: Shop name, Cashier name, Customer name (if available)
Items table:
  - Product name + variant
  - Quantity x unit price
  - Line totals
  - Subtotal, Tax, Total
Payment info box:
  - Method: Cash
  - Amount tendered: $150.00
  - Change given: $34.53
Action buttons: View Receipt, Print Receipt, Email Receipt (row of outlined buttons)
Bottom: "Issue Refund" red outlined button
Modal: 500px width, white background, shadow, 24px padding.
Clean professional styling, Inter font.
```

### Prompt 3: Refund Modal
```
Build a refund modal for POS sales.
Header: "Issue Refund" title, original transaction info "#1234 - $115.47"
Refund type radio:
  - Full refund (selected by default)
  - Partial refund
Items checklist (for partial):
  - Checkbox + item name + price
  - Blue Shirt (M) - $59.98 [✓]
  - White Pants (L) - $49.99 [✓]
  - Tax - $5.50 [✓]
Refund amount input (large, for partial)
Reason dropdown: Customer damaged, Defective, Wrong item, Changed mind, Other
Notes textarea
Bottom: Cancel (gray), "Process Refund" (red) buttons
Modal styling: White card, centered, shadow, Inter font.
```

---

## 9. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-09: POS Interface](./UI-DOC-09-CASHIER-POS.md)
- [UI-DOC-12: Invoice Management](./UI-DOC-12-INVOICE-MANAGEMENT.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
