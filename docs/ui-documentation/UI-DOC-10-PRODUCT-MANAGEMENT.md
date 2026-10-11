# UI-DOC-10: Product Management

## Document Info
- **Document ID**: UI-DOC-10
- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Role**: Owner, Manager
- **Page Type**: CRUD Management

---

## 1. Page Overview

### Page Purpose
The Product Management page allows business owners and managers to manage their product catalog. They can add new products, edit existing ones, organize into categories, manage variants, and set pricing.

### Page Description
A comprehensive product catalog interface with grid/list views, powerful search and filtering, bulk actions, and a full-featured product editor modal.

### URL Pattern
- **Development**: `http://localhost:3000/products`
- **Production**: `/products`

### Access Control
- Requires: `owner` or `manager` role
- Required Permissions: `product:read`, `product:create` (for adding), `product:update` (for editing)

---

## 2. Visual Design

### Layout Structure

```
+------------------------------------------------------------------+
|  HEADER                                                          |
+------------------------------------------------------------------+
|                                                                  |
|  Products                    [+ Add Product]  [Export] [Import]  |
|  Manage your product catalog                                     |
|                                                                  |
|  +--------------------+  +--------------------+  +-------------+ |
|  | 🔍 Search products |  | Category [All v]   |  | Status [All]| |
|  +--------------------+  +--------------------+  +-------------+ |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  VIEW: [Grid] [List]  |  Sort: [Newest v]  |  Showing 1-20 |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +--------+  +--------+  +--------+  +--------+  +--------+    |
|  | [Img]  |  | [Img]  |  | [Img]  |  | [Img]  |  | [Img]  |    |
|  | Blue   |  | White  |  | Red    |  | Black  |  | Navy   |    |
|  | Shirt  |  | Pants  |  | Dress  |  | Jeans  |  | Polo   |    |
|  | $29.99 |  | $49.99 |  | $79.99 |  | $39.99 |  | $34.99 |    |
|  | Stock: |  | Stock: |  | Stock: |  | Stock: |  | Stock: |    |
|  |   45   |  |   23   |  |   12   |  |   67   |  |   89   |    |
|  | [⋮]   |  | [⋮]   |  | [⋮]   |  | [⋮]   |  | [⋮]   |    |
|  +--------+  +--------+  +--------+  +--------+  +--------+    |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | [<] Page 1 of 18 [>]              [20] [50] [100] per page |  |
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
| Warning | Amber | #D97706 |
| Error | Red | #DC2626 |
| Low Stock | Amber | #D97706 |
| Out of Stock | Red | #DC2626 |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Medium Gray | #6B7280 |
| Border | Light Gray | #E5E7EB |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Inter | 28px | Bold (700) |
| Page Subtitle | Inter | 14px | Regular (400) |
| Product Name | Inter | 14px | Semibold (600) |
| Product Price | Inter | 14px | Bold (700) |
| Stock Text | Inter | 12px | Medium (500) |
| Badge | Inter | 11px | Semibold (600) |

### Spacing
- Card gap: 16px
- Card padding: 16px
- Card border radius: 10px
- Button border radius: 8px

---

## 3. Page Components

### 3.1 Toolbar
**Elements:**
- Search input (full width or flex)
- Category dropdown filter
- Status dropdown filter
- View toggle (Grid/List)

### 3.2 Product Card (Grid View)
```
+--------------------------------+
|  [Image Placeholder]      [⋮] |
|                                |
|  Blue Shirt                   |
|  SKU: BLU-SHT-001             |
|                                |
|  $29.99                        |
|                                |
|  Stock: 45                     |
|  Category: Clothing            |
+--------------------------------+
```

**Card Elements:**
- Image: 120px height, gray placeholder
- Menu: Three dots (edit, duplicate, delete)
- Product name: Truncate 2 lines
- SKU: Small gray text
- Price: Bold, primary color
- Stock: Badge (green=good, amber=low, red=out)
- Category: Small text

### 3.3 Product List (List View)
| Name | SKU | Price | Stock | Category | Status | Actions |
|------|-----|-------|-------|----------|--------|---------|
| Blue Shirt | BLU-SHT-001 | $29.99 | 45 | Clothing | Active | [⋮] |
| White Pants | WHT-PNT-001 | $49.99 | 23 | Clothing | Active | [⋮] |

### 3.4 Stock Status Badges
| Status | Condition | Background | Text |
|--------|-----------|------------|------|
| Good | > 20 | #ECFDF5 | #059669 |
| Low | 1-20 | #FFF7ED | #D97706 |
| Out | 0 | #FEF2F2 | #DC2626 |

---

## 4. Add/Edit Product Modal

### Layout

```
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  [X]                                                       |  |
|  |                                                            |  |
|  |  Add New Product / Edit Product                            |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  BASIC INFORMATION                                         |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Product Name *                                       | |  |
|  |  | [Blue Cotton Shirt.............................]     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | SKU                                                | |  |
|  |  | [BLU-SHT-001.................................]     | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Category *  [Select Category                   v]  | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Description                                           | |  |
|  |  | [Premium cotton shirt, comfortable fit............] | |  |
|  |  | [................................................] | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  PRICING                                                   |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Base Price *                          | Tax Rate      | |  |
|  |  | [$29.99...........]                  | [5% v]        | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Cost Price                                            | |  |
|  |  | [$15.00...............]                             | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  INVENTORY                                                 |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Initial Stock                      | Low Stock Alert | |  |
|  |  | [100.................]               | [10..........] | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [ ] This product has variants (sizes, colors, etc.)  | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  VARIANTS (if enabled)                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | Variant | SKU        | Price   | Stock              | |  |
|  |  |---------|------------|---------|--------------------| | |  |
|  |  | Small   | BLU-SHT-S  | $29.99  | [100]              | |  |
|  |  | Medium  | BLU-SHT-M  | $29.99  | [100]              | |  |
|  |  | Large   | BLU-SHT-L  | $29.99  | [100]              | |  |
|  |  | XL      | BLU-SHT-XL | $32.99  | [50]               | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  MEDIA                                                     |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [📷 Upload Images] or drag and drop                   | |  |
|  |  | [img1.jpg] [img2.jpg] [+ Add More]                    | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  STATUS                                                    |  |
|  |  +------------------------------------------------------+ |  |
|  |  | [●] Active    [ ] Inactive                            | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +------------------------------------------------------+ |  |
|  |  |              CANCEL            SAVE PRODUCT           | |  |
|  |  +------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### Form Fields

#### Basic Information
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product Name | text | Yes | Max 200 chars |
| SKU | text | No | Auto-generated if empty |
| Category | select | Yes | Dropdown with existing |
| Description | textarea | No | Max 1000 chars |

#### Pricing
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Base Price | number | Yes | Min 0 |
| Cost Price | number | No | For profit calculation |
| Tax Rate | select | No | Dropdown (0%, 5%, 10%, 15%) |

#### Inventory
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Initial Stock | number | No | For first stock entry |
| Low Stock Alert | number | No | Default 10 |
| Variants | checkbox | No | Enable size/color variants |

#### Media
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Images | file | No | Max 5 images, 5MB each |

---

## 5. Product Data Structure

```typescript
interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  categoryId: string;
  basePrice: number;
  costPrice?: number;
  taxRate: number;
  initialStock?: number;
  lowStockAlert: number;
  hasVariants: boolean;
  images: string[];
  isActive: boolean;
  variants?: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProductVariant {
  id: string;
  productId: string;
  name: string;          // "Small", "Medium", "Large"
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;  // { size: "M", color: "Blue" }
}
```

---

## 6. User Interactions

### Add Product Flow
```
1. Click "+ Add Product"
2. Modal opens
3. Fill form fields
4. Optionally enable variants
5. Add variant details if enabled
6. Upload images
7. Click "Save Product"
8. Success: Modal closes, toast, product appears in list
```

### Edit Product Flow
```
1. Click product card or ⋮ menu
2. Select "Edit"
3. Modal opens with pre-filled data
4. Modify fields
5. Save changes
```

### Delete Product Flow
```
1. Click ⋮ menu on card
2. Select "Delete"
3. Confirmation: "Delete Blue Shirt? This cannot be undone."
4. Confirm → Product removed
```

### Duplicate Product Flow
```
1. Click ⋮ menu
2. Select "Duplicate"
3. New product created with "Copy of..." name
4. Opens edit modal
```

---

## 7. API Endpoints

### GET Products
```
GET /api/v1/products
Authorization: Bearer <token>
Query: ?search=&category=&status=&page=1&limit=20

Response:
{
  "data": [...],
  "total": 342,
  "page": 1,
  "limit": 20
}
```

### POST Create Product
```
POST /api/v1/products
Body: { name, sku, categoryId, basePrice, ... }
```

### PATCH Update Product
```
PATCH /api/v1/products/:id
Body: { name, price, ... }
```

### DELETE Product
```
DELETE /api/v1/products/:id
```

---

## 8. Google Snitch Prompts

### Prompt 1: Product Catalog Grid
```
Create a product catalog page for a POS system.
Header: "Products" title (28px bold), subtitle "Manage your product catalog"
Action buttons top right: Blue "+ Add Product", Outlined "Export", Outlined "Import"
Toolbar: Full width search input with magnifying glass, Category dropdown (All Categories), Status dropdown (All), View toggle (Grid icon / List icon)
Product grid: 4-5 columns of product cards
Each card:
  - Top: Product image placeholder (gray rectangle, 120px height)
  - Three dots menu icon top right corner
  - Product name (bold, truncate 2 lines)
  - SKU in small gray text
  - Price in bold blue
  - Stock badge: Green "In Stock (45)" or Amber "Low (5)" or Red "Out of Stock"
  - Category in small text at bottom
Cards: White background, subtle shadow, 10px border radius, 16px padding.
Background: Light gray (#F8FAFC)
Pagination at bottom: Page numbers, per page selector.
Clean Inter font, modern SaaS style.
```

### Prompt 2: Add Product Form Modal
```
Design a comprehensive add/edit product modal.
Modal: 600px max width, white background, large shadow, 32px padding.
Header: "Add New Product" title, X close button.
Form sections with labels:
1. BASIC INFORMATION:
   - Product Name * (full width input)
   - SKU (full width input)
   - Category * (dropdown)
   - Description (full width textarea)
2. PRICING:
   - Base Price * (input with $ prefix)
   - Cost Price (input with $ prefix)
   - Tax Rate (dropdown: None, 5%, 10%, 15%)
3. INVENTORY:
   - Initial Stock (number input)
   - Low Stock Alert (number input, default 10)
   - Checkbox: "This product has variants"
4. VARIANTS (if checked):
   - Table with Size, SKU, Price, Stock columns
   - Rows for S, M, L, XL with editable fields
5. MEDIA:
   - Upload area with dashed border "Drop images here or click to upload"
   - Image thumbnails with X to remove
6. STATUS:
   - Radio: Active / Inactive
Bottom buttons: Gray "Cancel", Blue "Save Product"
All inputs: 48px height, 8px border radius, Inter font.
```

### Prompt 3: Product List View
```
Build a product list table view with columns:
| □ | Image | Product Name | SKU | Price | Stock | Category | Status | Actions |
Checkbox for bulk select.
Image: Small 40px thumbnail or placeholder.
Product Name: Bold, with name and variant info below.
SKU: Gray text.
Price: Bold, formatted $XX.XX.
Stock: Number with status color (green/amber/red).
Category: Label pill.
Status: Green "Active" or Gray "Inactive" badge.
Actions: Three dots menu with Edit, Duplicate, Delete.
Table rows: Hover light gray background, alternating row colors optional.
Header: Gray background, bold labels, sortable columns (arrows).
Pagination: Bottom right, page numbers + "Showing 1-20 of 342".
```

---

## 9. Related Documents

- [UI-DOC-06: Owner Dashboard](./UI-DOC-06-OWNER-DASHBOARD.md)
- [UI-DOC-11: Inventory Management](./UI-DOC-11-INVENTORY-MANAGEMENT.md)
- [UI-DOC-09: POS Interface](./UI-DOC-09-CASHIER-POS.md)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Claude | Initial document creation |
