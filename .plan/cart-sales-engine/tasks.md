# Cart & Sales Engine Implementation Plan

## Overview
Implement the server-side cart system and sales transaction engine - the core of POS functionality.

## Dependencies
- Product Catalog API (existing schema, needs endpoints)
- Inventory API (existing schema, needs endpoints)
- Auth (existing - complete)

## Implementation Order

### Phase 1: Product Catalog API (Unblock Cart)
- [ ] TASK-001: Product endpoints (CRUD)
- [ ] TASK-002: Category endpoints
- [ ] TASK-003: Barcode lookup
- [ ] TASK-004: Inventory stock check

### Phase 2: Cart System
- [ ] TASK-005: Cart service with Redis
- [ ] TASK-006: Cart DTOs and validation
- [ ] TASK-007: Cart controller (create, get, lines)
- [ ] TASK-008: Pricing engine (tax, discounts)

### Phase 3: Sales Engine
- [ ] TASK-009: Tender flow
- [ ] TASK-010: Commit sale (transactional)
- [ ] TASK-011: Inventory deduction
- [ ] TASK-012: Journal entries creation

### Phase 4: Payments & Receipts
- [ ] TASK-013: Payment recording
- [ ] TASK-014: Receipt generation
- [ ] TASK-015: Sale status management

## Success Criteria
- Cart creation and line operations work
- Sale commit creates journal entries
- Inventory deducted on sale
- All endpoints tested with Jest
