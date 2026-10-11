# UI-DOC-12: Invoice Management

## Document Info
- **Document ID**: UI-DOC-12
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner, Manager, Cashier
- **Page Type**: Invoice Workflow

---

## 1. Page Overview

### Page Purpose
The Invoice Management page allows businesses to create, send, track, and manage invoices for customers. It supports the full invoice lifecycle from draft creation to payment confirmation.

### Page Description
A comprehensive invoice management interface with status tracking, customer communication, and payment follow-up features. Designed for both creating new invoices and managing existing ones.

### URL Pattern
- **Development**: `http://localhost:3000/invoices`
- **Production**: `/invoices`

### Access Control
- Requires: `owner`, `manager`, or `cashier` role
- Create/Edit: `owner`, `manager`
- Send/Confirm: `owner`, `manager`, `cashier`
- Delete: `owner`

---

## 2. Invoice Workflow

### Status Flow Diagram
```
     +--------+
     | DRAFT  | (Created, editable)
     +---+----+
         |
    -----+-----
    |           |
    v           v
+-------+   +--------+
| SENT  |   |CANCELLED| (Terminal)
+-------+   +--------+
    |
    v
+-----------+
| CONFIRMED | (Customer accepted)
+-----------+
    |
    v
+--------+    +-----------+
|  PAID  |   | CANCELLED | (Terminal)
+--------+   +-----------+
```

### Status Definitions
| Status | Description | Can Transition To |
|--------|-------------|-------------------|
| draft | Invoice created but not sent | sent, cancelled |
| sent | Invoice sent to customer | confirmed, cancelled |
| confirmed | Customer confirmed acceptance | paid, cancelled |
| paid | Payment received | (terminal) |
| cancelled | Invoice cancelled | (terminal) |

---

## 3. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  HEADER                                                          |
+------------------------------------------------------------------+
|                                                                  |
|  Invoices                    [+ Create Invoice]  [Export]       |
|  Manage and track customer invoices                              |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | TABS: [All] [Draft] [Sent] [Confirmed] [Paid] [Cancelled]  |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +--------------------+  +--------------------+  +-------------+ |
|  | 🔍 Search invoices |  | Customer [All v]   |  | Sort [New] | |
|  +--------------------+  +--------------------+  +-------------+ |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  INVOICE LIST                                              |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | INV-20260320-0001           [Sent]           [⋮]    | |  |
|  |  | Fashion Store Customer                              | |  |
|  |  | $1,234.56  •  Due: Mar 25, 2026  •  Sent: Mar 20     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | INV-20260319-0001           [Confirmed]       [⋮]    | |  |
|  |  | Tech Solutions Ltd                                  | |  |
|  |  | $5,678.90  •  Due: Mar 22, 2026  •  Sent: Mar 19    | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | INV-20260318-0001           [Paid]           [⋮]    | |  |
|  |  | Restaurant ABC                                       | |  |
|  |  | $890.00  •  Paid: Mar 18, 2026                       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Page Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Draft Status | Gray | #6B7280 |
| Sent Status | Blue | #2563EB |
| Confirmed Status | Purple | #7C3AED |
| Paid Status | Green | #059669 |
| Cancelled Status | Red | #DC2626 |
| Overdue | Amber | #D97706 |

### Status Badge Colors
| Status | Background | Text |
|--------|------------|------|
| Draft | #F3F4F6 | #6B7280 |
| Sent | #EFF6FF | #2563EB |
| Confirmed | #F5F3FF | #7C3AED |
| Paid | #ECFDF5 | #059669 |
| Cancelled | #FEF2F2 | #DC2626 |
| Overdue | #FFF7ED | #D97706 |

---

## 4. Invoice List Components

### Status Tabs
| Tab | Count | Badge Color |
|-----|-------|-------------|
| All | 45 | (none) |
| Draft | 5 | Gray |
| Sent | 12 | Blue |
| Confirmed | 8 | Purple |
| Paid | 18 | Green |
| Cancelled | 2 | Red |

### Invoice Card
```
+------------------------------------------------------+
| INV-20260320-0001                      [Sent]  [⋮]  |
|                                                      |
| Fashion Store Customer                               |
|                                                      |
| $1,234.56  •  Due: Mar 25, 2026  •  Sent: Mar 20   |
+------------------------------------------------------+
```

**Card Elements:**
- Invoice number: Bold, monospace
- Status badge: Colored pill
- Customer name: Medium weight
- Amount: Large, bold
- Due date or Paid date
- Three dots menu: View, Edit (if draft), Send, Confirm, Mark Paid, Cancel, Delete

---

## 5. Create Invoice Modal

### Layout

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Create Invoice                                            |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  CUSTOMER                                                  |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Select or add customer                              | |  |
|  |  | [Fashion Store Customer                    v]        | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  SHOP / LOCATION                                           |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Main Store                                v]        | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  DUE DATE                                                  |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [March 25, 2026                             📅]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  LINE ITEMS                                                |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Item        | Qty | Price    | Tax   | Total         | |  |
|  |  |-------------|-----|----------|-------|---------------| | |  |
|  |  | Blue Shirt  |  2  | $59.98   | $3.00 | $62.98        | |  |
|  |  | White Pants |  1  | $49.99   | $2.50 | $52.49        | |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [+ Add Line Item]                                     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  NOTES                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Payment due within 30 days.....................]   | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  TOTALS                                                    |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Subtotal:                          $109.97           | |  |
|  |  | Tax (5%):                            $5.50           | |  |
|  |  | Discount:                             $0.00           | |  |
|  |  | ---------------------------------------------------- | |  |
|  |  | TOTAL:                             $115.47           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL           SAVE AS DRAFT           |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Form Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Customer | select | Yes | Searchable dropdown |
| Shop | select | Yes | Location |
| Due Date | date | Yes | Calendar picker |
| Line Items | table | Yes | Add/remove rows |
| Notes | textarea | No | Payment terms |

### Line Item Row
| Column | Type | Description |
|--------|------|-------------|
| Item | text/select | Product or description |
| Quantity | number | Min 1 |
| Price | currency | Unit price |
| Tax | percentage | Tax rate |
| Total | currency | Calculated |

---

## 6. Invoice Detail View

### Layout (Slide-over or Full Page)

```
+------------------------------------------------------------------+
|                                                                  |
|  [← Back]                    [Edit] [Send] [Print] [⋮ More]      |
|                                                                  |
|  +------------------------+  +----------------------------------+  |
|  | INVOICE                |  |                                  |  |
|  | INV-20260320-0001      |  |  STATUS BADGE                    |  |
|  | Draft / Sent / Paid    |  |  [Sent - Awaiting Response]      |  |
|  +------------------------+  +----------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | FROM                    |  TO                              |  |
|  | Fashion Store           |  Customer Name                   |  |
|  | 123 Main Street         |  Customer Address                |  |
|  | Dhaka, Bangladesh       |  City, Country                   |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | Invoice Date: March 20, 2026                                |  |
|  | Due Date: March 25, 2026                                   |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | LINE ITEMS                                                 |  |
|  +------------------------------------------------------------+  |
|  | Item        | Qty | Price    | Tax   | Total              |  |
|  | Blue Shirt |  2  | $59.99   | $3.00 | $62.98             |  |
|  | White Pants|  1  | $49.99   | $2.50 | $52.49             |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | Subtotal:                             $109.97              |  |
|  | Tax (5%):                               $5.50              |  |
|  | Discount:                              $0.00              |  |
|  | ---------------------------------------------------------- |  |
|  | TOTAL:                                $115.47              |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | NOTES                                                      |  |
|  | Payment due within 30 days. Thank you for your business!  |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | ACTIVITY TIMELINE                                          |  |
|  +------------------------------------------------------------+  |
|  | ● Mar 20, 9:00 AM - Invoice created (You)                 |  |
|  | ● Mar 20, 9:05 AM - Invoice sent to customer              |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | ACTIONS                                                    |  |
|  +------------------------------------------------------------+  |
|  | [Send Reminder]  [Mark as Paid]  [Cancel Invoice]         |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 7. Data Structure

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;         // Auto: INV-YYYYMMDD-XXXX
  tenantId: string;
  shopId: string;
  customerId?: string;
  saleId?: string;               // If created from sale
  status: InvoiceStatus;
  dueDate: Date;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  lines: InvoiceLine[];
  customer?: Customer;
  createdAt: Date;
  updatedAt: Date;
}

type InvoiceStatus = 'draft' | 'sent' | 'confirmed' | 'paid' | 'cancelled';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}
```

---

## 8. User Interactions

### Create Invoice Flow
```
1. Click "+ Create Invoice"
2. Select customer
3. Select shop
4. Set due date
5. Add line items (from products or manual)
6. Add notes
7. Review totals
8. Click "Save as Draft" or "Send Now"
```

### Send Invoice Flow
```
1. Click "Send" on draft invoice
2. Confirm modal
3. System sends email/SMS to customer
4. Status changes to "Sent"
5. Activity logged
```

### Confirm Invoice Flow (Customer Side)
```
1. Customer receives invoice link
2. Views invoice online
3. Clicks "Confirm" button
4. System receives webhook/callback
5. Status changes to "Confirmed"
```

### Mark as Paid Flow
```
1. Click "Mark as Paid"
2. Select payment method
3. Enter payment details
4. Confirm
5. Status changes to "Paid"
6. Receipt generated
```

---

## 9. Google Snitch Prompts

### Prompt 1: Invoice List Page
```
Create an invoice management page for a POS system.
Header: "Invoices" title (28px bold), "Manage and track customer invoices" subtitle
Action buttons: Blue "+ Create Invoice", Outlined "Export"
Status tabs below header: All (45), Draft (5), Sent (12), Confirmed (8), Paid (18), Cancelled (2)
  - Active tab: Blue underline, bold text
  - Inactive: Gray text
  - Count in parentheses
Toolbar: Search input, Customer dropdown, Sort dropdown
Invoice cards list:
Each card:
  - Invoice number (INV-20260320-0001) bold, monospace
  - Status badge (colored pill: Draft gray, Sent blue, Confirmed purple, Paid green)
  - Customer name medium
  - Amount large bold
  - Due date or paid date
  - Three dots menu right
Cards: White bg, subtle shadow, hover effect.
Background: Light gray (#F8FAFC).
Clean modern Inter font.
```

### Prompt 2: Invoice Status Badges
```
Design invoice status badges with these variations:
1. Draft: Gray background (#F3F4F6), gray text (#6B7280), dash icon
2. Sent: Light blue background (#EFF6FF), blue text (#2563EB), send icon
3. Confirmed: Light purple background (#F5F3FF), purple text (#7C3AED), check icon
4. Paid: Light green background (#ECFDF5), green text (#059669), dollar icon
5. Cancelled: Light red background (#FEF2F2), red text (#DC2626), X icon
Badge style: Rounded pill shape, 6px vertical padding, 12px horizontal padding, small icon left of text.
```

### Prompt 3: Invoice Detail View
```
Build an invoice detail page with these sections:
1. Header: Back arrow, Invoice number (large bold), action buttons (Edit, Send, Print, More)
2. Status section: Large status badge with description "Sent - Awaiting Response"
3. Two columns: "FROM" (Business info) and "TO" (Customer info)
4. Dates: Invoice date, Due date
5. Line items table: Description, Qty, Unit Price, Tax, Total
   - Header row: Gray background
   - Data rows: Alternating backgrounds
   - Totals section: Subtotal, Tax, Discount, large TOTAL row
6. Notes section: Gray background box with invoice notes
7. Activity timeline: Vertical line with dots, showing creation and status changes
8. Action buttons: Send Reminder (blue), Mark as Paid (green), Cancel Invoice (red outline)
Clean modern design, Inter font, professional invoice style similar to Stripe/Linear.
```

---

## 10. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-09: POS Interface](./UI-DOC-09-CASHIER-POS.md)
- [UI-DOC-13: Sales History](./UI-DOC-13-SALES-HISTORY.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
