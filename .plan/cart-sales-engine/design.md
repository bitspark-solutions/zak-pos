# Cart & Sales Engine - Design

## Architecture

### Module Structure
```
server/src/
├── cart/
│   ├── cart.module.ts
│   ├── cart.service.ts
│   ├── cart.controller.ts
│   ├── dto/
│   │   ├── create-cart.dto.ts
│   │   ├── add-line.dto.ts
│   │   └── tender.dto.ts
│   └── interfaces/
│       └── cart.interface.ts
├── sales/
│   ├── sales.module.ts
│   ├── sales.service.ts
│   ├── sales.controller.ts
│   ├── dto/
│   └── interfaces/
├── pricing/
│   ├── pricing.service.ts
│   └── tax.service.ts
├── inventory/
│   ├── inventory.module.ts
│   ├── inventory.service.ts
│   └── inventory.controller.ts
└── product/
    ├── product.module.ts
    ├── product.service.ts
    ├── product.controller.ts
    └── category.controller.ts
```

## Data Flow

### Cart Lifecycle
1. POST /carts → Create cart, return cartToken (Redis)
2. POST /carts/{cartToken}/lines → Add/update/remove items
3. GET /carts/{cartToken} → Get cart with calculated totals
4. POST /carts/{cartToken}/price → Recalculate (tax, discounts)
5. POST /carts/{cartToken}/tender → Start payment
6. POST /carts/{cartToken}/commit → Finalize sale

### Sale Commit Flow
1. Validate cart and stock availability
2. Start database transaction
3. Create Sale record
4. Create SaleLine records
5. Deduct inventory
6. Create Journal entries (COGS, Revenue, VAT, Cash)
7. Create Payment record
8. Commit transaction

## Redis Cart Structure
```json
{
  "cartToken": "uuid",
  "tenantId": "uuid",
  "shopId": "uuid",
  "customerId": "uuid|null",
  "cashierId": "uuid",
  "lines": [
    {
      "productId": "uuid",
      "variantId": "uuid|null",
      "qty": 2,
      "unitPrice": 100.00,
      "discount": 0,
      "taxId": "uuid|null",
      "taxAmount": 15.00,
      "lineTotal": 215.00
    }
  ],
  "subtotal": 200.00,
  "discount": 0,
  "tax": 15.00,
  "total": 215.00,
  "createdAt": "timestamp",
  "expiresAt": "timestamp"
}
```

## Journal Entry Rules

### Sale (Cash)
| Account | Debit | Credit |
|---------|-------|--------|
| Cash | 215.00 | |
| Sales Revenue | | 200.00 |
| VAT Payable | | 15.00 |

### Sale (Credit)
| Account | Debit | Credit |
|---------|-------|--------|
| Accounts Receivable | 215.00 | |
| Sales Revenue | | 200.00 |
| VAT Payable | | 15.00 |

### COGS Entry
| Account | Debit | Credit |
|---------|-------|--------|
| COGS | 80.00 | |
| Inventory | | 80.00 |

## API Endpoints

### Products
- GET /products - List products (paginated)
- GET /products/:id - Get product details
- GET /products/barcode/:code - Lookup by barcode
- POST /products - Create product
- PUT /products/:id - Update product
- DELETE /products/:id - Soft delete

### Categories
- GET /categories - List categories
- POST /categories - Create category
- PUT /categories/:id - Update category
- DELETE /categories/:id - Delete category

### Inventory
- GET /inventory/stock?shopId=&productId= - Get stock
- POST /inventory/adjust - Adjust stock
- GET /inventory/movements - List movements

### Cart
- POST /carts - Create cart
- GET /carts/:token - Get cart
- POST /carts/:token/lines - Add/update line
- DELETE /carts/:token/lines/:lineId - Remove line
- POST /carts/:token/price - Recalculate
- POST /carts/:token/tender - Start payment
- POST /carts/:token/commit - Commit sale

### Sales
- GET /sales - List sales
- GET /sales/:id - Get sale details
- POST /sales/:id/refund - Process refund

## Testing Strategy
- Unit tests for services
- Integration tests for API endpoints
- Jest as test framework
