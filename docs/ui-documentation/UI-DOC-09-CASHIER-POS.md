# UI-DOC-09: Point of Sale (POS) Interface

## Document Info
- **Document ID**: UI-DOC-09
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Cashier, Manager, Owner
- **Page Type**: Transaction Interface

---

## 1. Page Overview

### Page Purpose
The POS Interface is the core sales terminal for processing customer transactions. It allows cashiers and managers to add products to a cart, apply discounts, process payments, and complete sales quickly and efficiently.

### Page Description
A high-performance, touch-friendly interface optimized for fast checkout. Features product search, barcode scanning, cart management, multiple payment methods, and instant receipt generation.

### URL Pattern
- **Development**: `http://localhost:3000/pos`
- **Production**: `/pos`

### Access Control
- Requires: `cashier`, `manager`, or `owner` role
- Required Permissions: `sale:create`

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  HEADER: [Shop: Main Store v]  [Cashier: John]  [🔔]  [⚙️]     |
+------------------------------------------------------------------+
|                                                                  |
|  +----------------------------+  +----------------------------+  |
|  |                            |  |                            |  |
|  |   PRODUCT SEARCH / SCAN    |  |      CURRENT CART          |  |
|  |   [🔍 Search or scan...]  |  |                            |  |
|  |                            |  |  +----------------------+ |  |
|  +----------------------------+  |  | Blue Shirt (M)       | |  |
|                                   |  | Qty: 2    $29.99 ea  | |  |
|  +----------------------------+  |  |         $59.98       | |  |
|  | CATEGORIES                  |  |  | [−] [2] [+] [🗑️]    | |  |
|  | [All][👕Clothing][👟Shoes]  |  |  +----------------------+ |  |
|  | [🧴Beauty][🏠Home][📱Elec] |  |  |                      | |  |
|  +----------------------------+  |  | White Pants (L)      | |  |
|                                   |  | Qty: 1    $49.99 ea  | |  |
|  +----------------------------+  |  |         $49.99       | |  |
|  | PRODUCT GRID               |  |  | [−] [1] [+] [🗑️]    | |  |
|  | +-------+ +-------+ +------+ |  |                      | |  |
|  | | Blue  | | White | | Red  | |  +----------------------+ |  |
|  | | Shirt | | Pants | | Dress| |  |                      |  |
|  | | $29.99| | $49.99| |$79.99| |  |  Subtotal:    $109.97 |  |
|  | | [+]   | | [+]   | | [+]  | |  |  Discount:      $0.00 |  |
|  | +-------+ +-------+ +------+ |  |  Tax (5%):      $5.50 |  |
|  | +-------+ +-------+ +------+ |  |  ------------------------ |  |
|  | | Black | | Gray  | | Navy | |  |  TOTAL:       $115.47   |  |
|  | | Jeans | | Shoes  | | Polo | |  |                            |  |
|  | | $39.99| | $89.99| |$34.99| |  +----------------------------+  |
|  | | [+]   | | [+]   | | [+]  | |                                |
|  | +-------+ +-------+ +------+ |  +----------------------------+  |
|  |                            |  |  |      PAYMENT OPTIONS        |  |
|  +----------------------------+  |  +----------------------------+  |
|                                   |  | [💵 Cash] [💳 Card]        |  |
|                                   |  | [📱 bKash] [📱 Nagad]     |  |
|                                   |  +----------------------------+  |
|                                   |                                |
|                                   |  +----------------------------+  |
|                                   |  |     💵 COMPLETE SALE       |  |
|                                   |  |         $115.47            |  |
|                                   |  +----------------------------+  |
|                                   |                                |
+------------------------------------------------------------------+
```

### Color Palette
| Element | Color | Hex Code |
|---------|-------|----------|
| Background | Off-White | #F8F9FA |
| Header | Dark Blue | #1E3A5F |
| Primary Accent | Blue | #2563EB |
| Success | Green | #059669 |
| Warning | Amber | #D97706 |
| Cart Background | White | #FFFFFF |
| Product Card | White | #FFFFFF |
| Product Hover | Light Blue | #EFF6FF |
| Total Section | Dark | #1F2937 |
| Button Primary | Blue | #2563EB |
| Button Success | Green | #059669 |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Header Text | Inter | 16px | Medium (500) |
| Search Input | Inter | 16px | Regular (400) |
| Category Pill | Inter | 13px | Medium (500) |
| Product Name | Inter | 14px | Semibold (600) |
| Product Price | Inter | 14px | Bold (700) |
| Cart Item Name | Inter | 14px | Medium (500) |
| Cart Item Price | Inter | 14px | Regular (400) |
| Total Label | Inter | 16px | Semibold (600) |
| Total Amount | Inter | 24px | Bold (700) |

### Spacing System
- Page padding: 0 (edge-to-edge)
- Product card gap: 12px
- Cart padding: 16px
- Cart item gap: 12px
- Button height: 56px (large touch target)
- Product card: 100px x 120px

---

## 3. Page Components

### 3.1 Header Bar
**Elements:**
- Shop selector (if multiple shops)
- Cashier name display
- Notification bell
- Settings gear

### 3.2 Product Search
**Input Specifications:**
- Placeholder: "Search products or scan barcode..."
- Icon: Magnifying glass + barcode icon
- Auto-focus on page load
- Keyboard shortcut: Focus with "/"

### 3.3 Category Pills
**Categories:**
| Category | Icon | Products |
|----------|------|----------|
| All | Grid | All products |
| Clothing | 👕 | Shirts, Pants, Dresses |
| Shoes | 👟 | Sneakers, Sandals |
| Beauty | 🧴 | Cosmetics, Skincare |
| Home | 🏠 | Furniture, Decor |
| Electronics | 📱 | Gadgets, Accessories |

**Behavior:**
- Horizontal scrollable
- Active category: Blue background
- Inactive: Gray background

### 3.4 Product Grid
**Product Card:**
- Image/Color swatch (60px)
- Product name (truncate if long)
- Price
- Quick add button (+)
- Stock indicator (if low)

**Interactions:**
- Click card: Add to cart (qty 1)
- Click + button: Add to cart with qty picker
- Hover: Light blue background

### 3.5 Cart Panel

#### Cart Header
- "Current Cart" title
- Item count badge
- Clear cart button (trash icon)

#### Cart Item Row
```
+------------------------------------------+
| Blue Shirt (Size M)              $29.99  |
| Qty: [-] [2] [+]        Subtotal: $59.98 |
| [🗑️ Remove]                                |
+------------------------------------------+
```

**Item Controls:**
- Quantity: - / + buttons
- Remove: Trash icon
- Line discount: Edit icon

#### Cart Summary
| Line | Amount |
|------|--------|
| Subtotal | $109.97 |
| Discount | -$0.00 |
| Tax (5%) | $5.50 |
| **TOTAL** | **$115.47** |

**Discount Input:**
- Click to add discount
- Options: Percentage or Fixed amount

### 3.6 Payment Options
**Methods:**
| Method | Icon | Shortcut |
|--------|------|----------|
| Cash | 💵 | F1 |
| Card | 💳 | F2 |
| bKash | 📱 | F3 |
| Nagad | 📱 | F4 |
| Bank Transfer | 🏦 | F5 |

**Button Style:**
- Grid of 2x2 or row of buttons
- Large touch targets (56px height)
- Icon + Label

### 3.7 Complete Sale Button
- Large green button
- Shows total amount
- "COMPLETE SALE" text
- Keyboard shortcut: Enter

---

## 4. User Interactions & Flows

### Primary Flow: Complete a Sale
```
1. Cashier opens POS
2. Search or browse products
3. Click product to add to cart
4. Adjust quantity if needed
5. Apply discounts if applicable
6. Select payment method
7. Click "Complete Sale"
8. System processes:
   - If Cash: Show cash received input, calculate change
   - If Card: Show "Waiting for card..." then confirmation
9. Success:
   - Receipt generated
   - Cart cleared
   - Sale recorded
10. Option to print receipt or send digital receipt
```

### Barcode Scanning Flow
```
1. Focus on search input (auto or manual)
2. Scan barcode with scanner
3. System matches product
4. Product added to cart automatically
5. Continue scanning or proceed to checkout
```

### Cash Payment Flow
```
1. Cashier selects "Cash" payment
2. Cash tendered input appears:
   "Cash Received: [$115.47]"
3. Cashier enters amount given by customer
4. System calculates change
5. "Change: $84.53"
6. Complete button
7. Sale finalized
```

### Void/Edit Cart Flow
```
1. Cashier can adjust quantities
2. Click - to decrease
3. Click + to increase
4. Click trash to remove item
5. Click "Clear Cart" to start over
6. Confirmation for clear cart
```

---

## 5. Data Handling

### Add to Cart
```
POST /api/v1/carts/:token/lines
Body: { productId: "prod_123", quantity: 2 }
```

### Update Line
```
PUT /api/v1/carts/:token/lines/:lineId
Body: { quantity: 3 }
```

### Tender (Select Payment)
```
POST /api/v1/carts/:token/tender
Body: { method: "cash", amount: 150.00 }
```

### Complete Sale
```
POST /api/v1/carts/:token/complete
```

### Sale Object
```typescript
interface Sale {
  id: string;
  receiptNumber: string;
  shopId: string;
  cashierId: string;
  customerId?: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
  amountTendered: number;
  changeGiven: number;
  status: 'completed' | 'refunded';
  createdAt: Date;
}
```

---

## 6. Touch Optimization

### Large Touch Targets
- All buttons: Minimum 44px
- Product grid items: 100px x 100px
- Quantity buttons: 40px x 40px

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| / | Focus search |
| Enter | Complete sale |
| Esc | Clear selection |
| F1 | Cash payment |
| F2 | Card payment |
| F3 | bKash payment |

---

## 7. Receipt Generation

### Receipt Format
```
================================
         ZAKPOS RECEIPT
================================
Shop: Main Store
Date: Mar 20, 2026 2:30 PM
Cashier: John Doe
================================

Blue Shirt (M)          x2   $59.98
White Pants (L)         x1   $49.99

Subtotal:             $109.97
Discount:               $0.00
Tax (5%):               $5.50
--------------------------------
TOTAL:                 $115.47
--------------------------------
Payment: CASH
Tendered:              $150.00
Change:                 $34.53
================================
    Thank you for shopping!
         www.zakpos.com
================================
```

---

## 8. Responsive Design

### Desktop/Large Screen
- Side-by-side layout
- 60% products, 40% cart

### Tablet
- Same layout, slightly smaller grid
- Touch-optimized

### Mobile (Not Recommended)
- Stacked layout
- Products on top, cart below
- Bottom-fixed complete button

---

## 9. Google Snitch Prompts

### Prompt 1: Full POS Interface
```
Create a modern Point of Sale interface for a retail store.
Layout: Split screen - products on left (60%), cart on right (40%).
Left header: Search bar with magnifying glass and barcode icon, "Search products or scan..." placeholder.
Below: Horizontal scrolling category pills (All, Clothing 👕, Shoes 👟, Beauty 🧴, Home 🏠, Electronics 📱).
Product grid: 3-4 columns of product cards.
Each product card: Image area (gray placeholder), product name, price, blue "+" add button.
Product card hover: Light blue background.
Right panel (Cart):
  - Header: "Current Cart" title, item count badge, trash icon to clear
  - Cart items list with product name, qty controls (- [qty] +), line total
  - Summary: Subtotal, Discount, Tax, TOTAL (large bold)
  - Payment buttons row: Cash 💵, Card 💳, Mobile 📱
  - Large green "COMPLETE SALE $115.47" button at bottom
Colors: Off-white bg (#F8F9FA), white cards, blue accents (#2563EB), green complete button.
Touch-friendly large buttons (56px height). Inter font.
```

### Prompt 2: POS Product Grid
```
Design a product grid for POS with large touch-friendly cards.
Card layout: Square aspect ratio, white background, subtle border.
Contents:
  - Top 60%: Product image placeholder (light gray) or color swatch
  - Product name (14px semibold, truncate 2 lines)
  - Price (14px bold, blue color)
  - Add button: Blue circle with white "+" icon at bottom right
Card hover: Light blue background (#EFF6FF), slight scale up (1.02)
Card active/pressed: Darker blue background
Grid: Responsive 3-4 columns, 12px gap between cards.
Low stock indicator: Small red dot or "Low stock" text in corner.
```

### Prompt 3: Cart Panel for POS
```
Build a cart panel for point of sale checkout.
White background, full height on right side (40% width).
Header: "Current Cart" bold, red badge showing "3 items", trash icon far right.
Cart items list:
  - Each item: Product name + variant (bold), unit price, quantity stepper, line total
  - Quantity stepper: [-] [2] [+] buttons, gray borders
  - Trash icon to remove item
  - Light gray divider between items
Bottom section (sticky):
  - Subtotal row: "Subtotal" left, "$109.97" right
  - Discount row: "Discount" left, "- $0.00" right, clickable to add
  - Tax row: "Tax (5%)" left, "$5.50" right
  - Divider line
  - TOTAL row: "TOTAL" bold large, "$115.47" extra large bold blue
  - Payment methods: 2x2 grid of large buttons (Cash, Card, bKash, Nagad)
  - Complete button: Full width, green (#059669), "COMPLETE SALE" + amount, 56px height
```

---

## 10. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-08: Manager Dashboard](./UI-DOC-08-MANAGER-DASHBOARD.md)
- [UI-DOC-13: Sales History](./UI-DOC-13-SALES-HISTORY.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
