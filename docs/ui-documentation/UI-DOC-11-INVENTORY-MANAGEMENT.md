# UI-DOC-11: Inventory Management

## Document Info
- **Document ID**: UI-DOC-11
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner, Manager
- **Page Type**: Inventory Control

---

## 1. Page Overview

### Page Purpose
The Inventory Management page allows business owners and managers to track stock levels across products and variants, receive new inventory, adjust stock counts, and receive low-stock alerts.

### Page Description
A comprehensive inventory tracking interface showing current stock levels, movement history, and tools for stock adjustments. Features visual indicators for low stock and out-of-stock items.

### URL Pattern
- **Development**: `http://localhost:3000/inventory`
- **Production**: `/inventory`

### Access Control
- Requires: `owner` or `manager` role
- Required Permissions: `inventory:read`, `inventory:update`

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  HEADER                                                          |
+------------------------------------------------------------------+
|                                                                  |
|  Inventory                      [+ Receive Stock] [Adjust Stock]  |
|  Track and manage your stock levels                              |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  SUMMARY CARDS                                             |  |
|  +------------------------------------------------------------+  |
|  |  +--------+  +--------+  +--------+  +--------+  +--------+ |  |
|  |  | TOTAL  |  | IN     |  | LOW    |  | OUT OF |  | PENDING| |  |
|  |  | ITEMS  |  | STOCK  |  | STOCK  |  | STOCK |  | RECEIVE| |  |
|  |  |  342   |  |  285   |  |   12   |  |   5   |  |   3    | |  |
|  |  +--------+  +--------+  +--------+  +--------+  +--------+ |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +--------------------+  +--------------------+  +-------------+ |
|  | 🔍 Search inventory|  | Shop [All Shops v] |  | Filter [v]  | |
|  +--------------------+  +--------------------+  +-------------+ |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | PRODUCT          | SKU        | VARIANT | STOCK  | STATUS | |
|  +------------------------------------------------------------+  |
|  | Blue Shirt       | BLU-SHT-001| S       |   45   | ● Good | |
|  | Blue Shirt       | BLU-SHT-001| M       |   12   | ● Low  | |
|  | Blue Shirt       | BLU-SHT-001| L       |    0   | ● Out  | |
|  | White Pants      | WHT-PNT-001| M       |   23   | ● Good | |
|  | Red Dress        | RED-DRS-001| -       |    8   | ● Low  | |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | [<] Page 1 of 10 [>]               [20] per page    [Export]|  |
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
| Good Stock | Green | #059669 |
| Low Stock | Amber | #D97706 |
| Out of Stock | Red | #DC2626 |
| Pending | Purple | #7C3AED |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Inter | 28px | Bold (700) |
| Summary Number | Inter | 28px | Bold (700) |
| Table Header | Inter | 12px | Semibold (600) |
| Table Cell | Inter | 14px | Regular (400) |

---

## 3. Page Components

### 3.1 Summary Cards (5 cards)

| Card | Value | Color Indicator |
|------|-------|------------------|
| Total Items | 342 | Blue |
| In Stock | 285 | Green |
| Low Stock | 12 | Amber |
| Out of Stock | 5 | Red |
| Pending Receive | 3 | Purple |

### 3.2 Toolbar
- Search input
- Shop selector dropdown
- Filter dropdown
- Export button

### 3.3 Inventory Table

**Columns:**
| Column | Width | Description |
|--------|-------|-------------|
| Product | 30% | Product name + image thumbnail |
| SKU | 15% | Product SKU |
| Variant | 15% | Size/Color variant or "-" |
| Stock | 15% | Current quantity |
| Status | 10% | Visual indicator |
| Actions | 15% | Quick actions |

**Row Colors:**
- Normal: White
- Low Stock: Light amber tint (#FFF7ED)
- Out of Stock: Light red tint (#FEF2F2)

### 3.4 Stock Status Indicators
| Status | Stock Level | Color | Dot |
|--------|-------------|-------|-----|
| Good | > 20 | Green | ● |
| Low | 1-20 | Amber | ● |
| Out | 0 | Red | ● |
| Pending | N/A | Purple | ◐ |

---

## 4. Modals

### 4.1 Receive Stock Modal

```
+------------------------------------------------------------------+
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Receive Stock                                             |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  PRODUCT SELECTION                                          |  |
|  |  +------------------------------------------------------+ |  |
|  |  | 🔍 Search or select product                        | |  |
|  |  | [Blue Shirt (BLU-SHT-001)                     v]   | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  VARIANT (if applicable)                                   |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Variant: [Small                          v]          | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  CURRENT STOCK                                             |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Current: 12 units                                    | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  RECEIVE QUANTITY *                                       |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [50] units                                           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  SUPPLIER                                                  |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Select supplier (optional)                          | |  |
|  |  | [Select Supplier                             v]     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  NOTES                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Delivery from warehouse.........................]  | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  NEW TOTAL: 62 units                                      |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL            RECEIVE STOCK           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.2 Adjust Stock Modal

```
+------------------------------------------------------------------+
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Adjust Stock                                              |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  PRODUCT                                                   |  |
|  |  Blue Shirt (Small)                                        |  |
|  |  Current Stock: 12 units                                   |  |
|  |                                                            |  |
|  |  ADJUSTMENT TYPE                                           |  |
|  |  +------------------------------------------------------+ |  |
|  |  | (●) Set exact quantity                               | |  |
|  |  | ( ) Add to stock (+/–)                               | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  NEW QUANTITY / ADJUSTMENT                                 |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [15] units                                           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  REASON                                                   |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Select reason                                       | |  |
|  |  | [Cycle count                                v]       | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Damaged      - Lost       - Found        - Other     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  NOTES                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [Physical count差异....]                            | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL            ADJUST STOCK           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

**Adjustment Reasons:**
- Cycle count
- Damaged
- Lost
- Found
- Theft
- Return to supplier
- Other

---

## 5. Data Structure

```typescript
interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  variantName?: string;
  shopId: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;  // quantityOnHand - quantityReserved
  lowStockAlert: number;
  status: 'good' | 'low' | 'out' | 'pending';
  lastUpdated: Date;
}

interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  shopId: string;
  type: 'receive' | 'adjust' | 'sale' | 'return';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string;  // PO number, receipt number
  notes?: string;
  createdBy: string;
  createdAt: Date;
}
```

---

## 6. User Interactions

### Receive Stock Flow
```
1. Click "+ Receive Stock"
2. Select product
3. Select variant (if applicable)
4. Enter quantity to receive
5. Optionally select supplier
6. Add notes
7. Click "Receive Stock"
8. Stock updated, movement recorded
```

### Adjust Stock Flow
```
1. Click "Adjust Stock" on row or from ⋮ menu
2. Select adjustment type (set exact or add/subtract)
3. Enter new quantity or adjustment amount
4. Select reason
5. Add notes
6. Click "Adjust Stock"
7. Stock updated, movement recorded
```

---

## 7. API Endpoints

### GET Inventory
```
GET /api/v1/inventory
Authorization: Bearer <token>
Query: ?shopId=&search=&status=&page=1&limit=20
```

### POST Receive Stock
```
POST /api/v1/inventory/receive
Body: { productId, variantId, shopId, quantity, supplierId?, notes? }
```

### POST Adjust Stock
```
POST /api/v1/inventory/adjust
Body: { productId, variantId, shopId, adjustment, reason, notes? }
```

---

## 8. Google Snitch Prompts

### Prompt 1: Inventory Dashboard
```
Create an inventory management dashboard for a POS system.
Header: "Inventory" title (28px bold), "Track and manage your stock levels" subtitle
Action buttons: Blue "+ Receive Stock", Outlined "Adjust Stock"
Summary cards in a row:
  - Total Items: 342 (blue)
  - In Stock: 285 (green)
  - Low Stock: 12 (amber)
  - Out of Stock: 5 (red)
  - Pending Receive: 3 (purple)
Each card: White bg, colored icon circle on left, large number, label below.
Toolbar: Search input, Shop dropdown, Filter dropdown, Export button.
Inventory table below:
  - Columns: Product (with small image), SKU, Variant, Stock (number), Status (colored dot), Actions
  - Low stock rows: Light amber background
  - Out of stock rows: Light red background
  - Zebra striping optional
Table header: Gray background, bold labels.
Pagination at bottom.
Background: Light gray (#F8FAFC), white cards.
Clean modern Inter font style.
```

### Prompt 2: Receive Stock Modal
```
Design a receive stock modal for inventory management.
Modal: 500px max width, white, centered, shadow.
Header: "Receive Stock" title, X close button.
Form fields:
  - Product search/select dropdown with search icon
  - Variant dropdown (if applicable)
  - Current stock display (read only, gray text)
  - "Receive Quantity *" number input, large
  - Supplier dropdown (optional)
  - Notes textarea
Preview: "New Total: 62 units" shown below inputs.
Bottom: Cancel (gray) and "Receive Stock" (blue) buttons.
Input styling: 48px height, 8px radius, Inter font.
```

### Prompt 3: Stock Status Table
```
Build an inventory table with stock status visualization.
Table layout:
Product | SKU | Variant | Stock | Status | Actions
With these features:
- Product column: Small 40px thumbnail, product name bold
- SKU: Gray monospace-style text
- Variant: Size/color or "-"
- Stock: Large number, right aligned
- Status: Colored dot + text (● Good in green, ● Low in amber, ● Out in red)
- Actions: Three dots menu (Adjust, History, Edit)
Row highlighting:
- Low stock: Light amber row background (#FFF7ED)
- Out of stock: Light red row background (#FEF2F2)
Header: Light gray background (#F3F4F6), uppercase small labels.
Clean modern design, Inter font.
```

---

## 9. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-10: Product Management](./UI-DOC-10-PRODUCT-MANAGEMENT.md)
- [UI-DOC-12: Invoice Management](./UI-DOC-12-INVOICE-MANAGEMENT.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
