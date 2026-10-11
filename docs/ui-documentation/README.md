# ZakPos UI/UX Documentation

This folder contains comprehensive UI/UX documentation for the ZakPos POS system. Each document is designed to be used with AI-powered UI generation tools (like Google's Snitch) to create user interfaces.

## Documentation Index

### Authentication & Login
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-01 | [ADMIN-LOGIN.md](./UI-DOC-01-ADMIN-LOGIN.md) | Admin portal login page with email/password |
| UI-DOC-05 | [OWNER-LOGIN.md](./UI-DOC-05-OWNER-LOGIN.md) | Business owner login page |

### Admin Portal
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-01 | [ADMIN-LOGIN.md](./UI-DOC-01-ADMIN-LOGIN.md) | Admin login page |
| UI-DOC-02 | [ADMIN-DASHBOARD.md](./UI-DOC-02-ADMIN-DASHBOARD.md) | Admin dashboard with platform overview |
| UI-DOC-03 | [ADMIN-ONBOARD-OWNER.md](./UI-DOC-03-ADMIN-ONBOARD-OWNER.md) | Admin onboarding new business owners |
| UI-DOC-04 | [ADMIN-MANAGE-TENANTS.md](./UI-DOC-04-ADMIN-MANAGE-TENANTS.md) | Admin managing all tenants/businesses |

### Business Owner Portal
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-05 | [OWNER-LOGIN.md](./UI-DOC-05-OWNER-LOGIN.md) | Owner login page |
| UI-DOC-06 | [OWNER-DASHBOARD.md](./UI-DOC-06-OWNER-DASHBOARD.md) | Owner business dashboard |
| UI-DOC-07 | [OWNER-ONBOARD-USER.md](./UI-DOC-07-OWNER-ONBOARD-USER.md) | Owner inviting managers/cashiers |
| UI-DOC-14 | [USER-MANAGEMENT.md](./UI-DOC-14-USER-MANAGEMENT.md) | User/team management |

### Manager Dashboard
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-08 | [MANAGER-DASHBOARD.md](./UI-DOC-08-MANAGER-DASHBOARD.md) | Manager operations dashboard |

### Point of Sale
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-09 | [CASHIER-POS.md](./UI-DOC-09-CASHIER-POS.md) | Full POS interface for transactions |

### Product & Inventory
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-10 | [PRODUCT-MANAGEMENT.md](./UI-DOC-10-PRODUCT-MANAGEMENT.md) | Product catalog management |
| UI-DOC-11 | [INVENTORY-MANAGEMENT.md](./UI-DOC-11-INVENTORY-MANAGEMENT.md) | Stock level management |

### Sales & Finance
| Doc ID | File | Description |
|--------|------|-------------|
| UI-DOC-12 | [INVOICE-MANAGEMENT.md](./UI-DOC-12-INVOICE-MANAGEMENT.md) | Invoice workflow management |
| UI-DOC-13 | [SALES-HISTORY.md](./UI-DOC-13-SALES-HISTORY.md) | Transaction history and refunds |

---

## Role-Based Access Summary

### Admin (Platform Level)
- UI-DOC-01: Login
- UI-DOC-02: Dashboard (platform stats)
- UI-DOC-03: Onboard Owner
- UI-DOC-04: Manage Tenants

### Owner (Business Level)
- UI-DOC-05: Login
- UI-DOC-06: Dashboard (business stats)
- UI-DOC-07: Invite User
- UI-DOC-14: User Management
- UI-DOC-10: Products
- UI-DOC-11: Inventory
- UI-DOC-09: POS
- UI-DOC-12: Invoices
- UI-DOC-13: Sales History

### Manager (Operations Level)
- UI-DOC-08: Dashboard
- UI-DOC-10: Products (read/update)
- UI-DOC-11: Inventory (read/update)
- UI-DOC-09: POS
- UI-DOC-12: Invoices (send/confirm)

### Cashier (POS Level)
- UI-DOC-09: POS
- UI-DOC-12: Invoices (send/confirm)
- UI-DOC-13: Sales History (view own)

---

## Document Structure

Each document contains:

1. **Document Info** - Version, author, last updated
2. **Page Overview** - Purpose, description, URL pattern, access control
3. **Visual Design** - Layout structure, color palette, typography, spacing
4. **Form Fields** - Detailed field specifications with validation
5. **User Interactions** - Primary flows, error states, loading states
6. **Data Handling** - API endpoints, request/response formats
7. **Component Specifications** - Detailed component descriptions
8. **Responsive Design** - Breakpoints and adaptations
9. **Google Snitch Prompts** - Ready-to-use prompts for UI generation
10. **Related Documents** - Cross-references

---

## Quick Start for UI Generation

### Basic Prompt Template
```
Create a [PAGE_TYPE] for ZakPos POS system.
[KEY_FEATURES]
Style: Modern SaaS, Inter font, [COLOR_SCHEME]
```

### Example Prompts from Documents

**Login Page:**
```
Create a clean, professional login page for a POS system called ZakPos.
[See UI-DOC-01-ADMIN-LOGIN.md Section 10]
```

**Dashboard:**
```
Create a business owner dashboard for a POS system called ZakPos.
[See UI-DOC-06-OWNER-DASHBOARD.md Section 10]
```

**POS Interface:**
```
Create a modern Point of Sale interface for a retail store.
[See UI-DOC-09-CASHIER-POS.md Section 10]
```

---

## Color Reference

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary Brand | Deep Blue | #1E40AF |
| Primary Accent | Blue | #2563EB |
| Success | Green | #059669 |
| Warning | Amber | #D97706 |
| Error | Red | #DC2626 |
| Owner Role | Purple | #7C3AED |
| Manager Role | Blue | #2563EB |
| Cashier Role | Teal | #0D9488 |
| Page Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Sidebar (Dark) | Navy | #1E3A5F |
| Text Primary | Dark Gray | #1F2937 |
| Text Secondary | Gray | #6B7280 |

---

## Typography

- **Font Family:** Inter
- **Headings:** Bold (700) or Semibold (600)
- **Body:** Regular (400)
- **Labels:** Medium (500)

---

## Spacing System

- Base unit: 4px
- Small: 8px
- Medium: 16px
- Large: 24px
- XL: 32px

---

## Border Radius

- Small: 6px
- Medium: 8px
- Large: 12px
- Full: 9999px (pills)

---

*Last Updated: 2026-03-20*
*Version: 1.0*
