# ZakPOS - Multi-Tenant SaaS POS Platform for Bangladeshi Shopkeepers

<div align="center">

[![Bangladesh](https://img.shields.io/badge/Bangladesh-🇧🇩-006A4E?style=for-the-badge)](https://en.wikipedia.org/wiki/Bangladesh)
[![SaaS](https://img.shields.io/badge/SaaS-💰-FF6B35?style=for-the-badge)](https://en.wikipedia.org/wiki/Software_as_a_service)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Kafka](https://img.shields.io/badge/Apache%20Kafka-000?style=for-the-badge&logo=apachekafka)](https://kafka.apache.org)

*A modern, multi-tenant SaaS POS platform designed for Bangladeshi shopkeepers and scalable globally*

[Quick Start](#quick-start) • [Features](#features) • [User Journey](#user-journey--execution-flow) • [Business Model](#business-model--monetization) • [Market Strategy](#target-market--strategic-positioning) • [Development](#development) • [API Documentation](#api-documentation)

</div>

---

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [User Journey & Execution Flow](#user-journey--execution-flow)
- [Business Model & Monetization](#business-model--monetization)
- [Target Market & Strategic Positioning](#target-market--strategic-positioning)
- [Strategic Roadmap & Vision](#strategic-roadmap--vision)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Contributing](#contributing)
- [License](#license)

## 🎯 About

ZakPOS is a **multi-tenant SaaS POS platform** designed for **Bangladeshi shopkeepers** and scalable globally. It integrates **accounting, inventory, and online-only POS** with future expansion into **Shopify integration, OCR-powered product entry, and billing automation**.

### 🚀 Vision & Core Purpose

ZakPOS serves **three distinct user groups**:

- **🛒 Shopkeepers & Staff (End Users)** → Daily operators of the POS
- **👨‍💼 Admins (Business Owners & Platform Operators)** → Manage tenants, compliance, and system health
- **👥 Consumers (Customers of Shops)** → Indirect users benefiting from receipts, invoices, and digital interactions

**ZakPOS isn't just a POS—it's a retail operating system** that transforms informal retail into structured, compliant, and scalable digital workflows.

## ✨ Features

### 🛒 End User Level (Shopkeepers & Staff)

#### A. Onboarding & Setup
- **Account Creation**: Shopkeeper registers via mobile/web, selects shop type (grocery, pharmacy, clothing, etc.)
- **Shop Profile Setup**: Business name, logo, tax ID, payment gateway preferences
- **Inventory Import**: CSV upload, manual entry, or OCR-based scanning of invoices/products
- **Hardware Integration**: Connect barcode scanners, receipt printers, cash drawers, and mobile devices

#### B. Daily Operations
- **Sales Processing**
  - Quick product lookup (barcode, search, or OCR auto-fill)
  - Multiple payment methods (cash, card, mobile wallets, bKash/Nagad)
  - Split payments and partial credit sales
- **Inventory Management**
  - Real-time stock updates on each sale
  - Low-stock alerts with supplier re-order suggestions
  - Batch/expiry tracking (critical for pharmacies)
- **Accounting & Finance**
  - Automated ledger entries for each transaction
  - Daily/weekly/monthly sales reports
  - Expense logging (rent, utilities, salaries)
- **Multi-User Roles**
  - Cashier, Manager, Owner roles with permissions
  - Activity logs to prevent fraud

#### C. Advanced Features
- **Shopify Integration**: Sync products, orders, and invoices
- **Mobile OCR**: Scan product labels to auto-populate fields
- **Offline Mode**: Transactions cached locally, synced when online
- **Customer Loyalty**: Points, discounts, and digital receipts via SMS/WhatsApp

### 🛠️ Admin Level (Platform Operators & Business Owners)

#### A. Tenant Management
- **Multi-Tenant Architecture**: Each shop runs in isolated space with shared infrastructure
- **Subscription Plans**: Free tier (basic POS), paid tiers (advanced reporting, Shopify integration, OCR)
- **Billing & Invoicing**: Automated subscription billing with local payment gateways

#### B. System Oversight
- **User Management**: Add/remove shop accounts, reset credentials
- **Data Security**: Role-based access, encryption, audit trails
- **Compliance**: VAT/GST reporting aligned with Bangladesh regulations

#### C. Analytics & Insights
- **Global Dashboard**: Track active shops, transaction volumes, churn rate
- **Usage Metrics**: Which features are most used (e.g., OCR vs manual entry)
- **Fraud Detection**: Flag unusual sales spikes or refund patterns

#### D. Growth & Scaling
- **Marketplace Integration**: Shopify, Daraz, WooCommerce
- **API Layer**: Allow third-party developers to build add-ons
- **Localization**: Multi-language, multi-currency support for expansion

### 👥 Consumer Level (Customers of Shops)

#### A. Purchase Experience
- **Checkout**: Faster billing with accurate receipts
- **Digital Receipts**: SMS/WhatsApp/email receipts with QR codes
- **Loyalty Programs**: Earn/redeem points, personalized offers

#### B. Post-Purchase
- **Invoice Access**: Customers can retrieve past invoices via QR code or portal
- **Returns & Refunds**: Streamlined process with digital record
- **Feedback Loop**: Option to rate service, feeding analytics back to shopkeepers

#### C. Future Enhancements
- **Consumer App**: Track loyalty points, receipts, and offers across multiple ZakPOS-powered shops
- **BNPL (Buy Now, Pay Later)**: Integration with fintech partners
- **Cross-Shop Network**: Customers discover other ZakPOS shops nearby

### 🔐 Security & Authentication
- **JWT Authentication**: Secure token-based authentication
- **Auth0 Integration**: Enterprise-grade identity management
- **Role-based Access Control**: Granular permissions system
- **Rate Limiting**: API protection against abuse
- **CORS Configuration**: Secure cross-origin requests

### 📱 Multi-Platform Interface
- **Responsive Web App**: Modern Next.js interface
- **Native Mobile Apps**: React Native with Expo
- **RESTful API**: Comprehensive API for integrations
- **WebSocket Support**: Real-time updates and notifications

### 🚀 Performance & Scalability
- **Microservices Architecture**: Independent, scalable services
- **Event-driven Design**: Kafka-based message queuing
- **Redis Caching**: High-performance data caching
- **Database Optimization**: PostgreSQL with optimized queries
- **Container Orchestration**: Docker-based deployment

### 🛠 Development Tools
- **Development Environment**: Complete Docker Compose setup
- **Database Management**: pgAdmin for PostgreSQL
- **Cache Monitoring**: Redis Insight
- **Message Queue UI**: Kafka UI
- **Email Testing**: Mailhog for development
- **File Management**: Integrated file browser

## 🔄 User Journey & Execution Flow

### 🏪 Customer Purchase Flow

#### 1. 📱 Product Scanning & Cart Building
- Customer selects products in the shop
- Vendor opens **ZakPOS app** (mobile/tablet/desktop)
- Each product is **scanned** via:
  - Barcode scanner
  - Mobile camera (OCR/barcode)
  - Manual search (if needed)
- ZakPOS automatically:
  - Identifies product name, SKU, price
  - Adds it to the **cart list**
  - Updates **quantity** if multiple units are scanned
- Cart view shows:
  - Itemized list (product, qty, price)
  - Subtotal, tax, discounts (if any)

#### 2. 💳 Billing & Checkout
- Vendor confirms the cart is correct
- ZakPOS generates **final bill summary**
- Vendor selects **payment method**:
  - **Cash** → Mark as paid
  - **Card** → Integrated card reader
  - **Mobile Wallets (bKash, Nagad, Rocket, etc.)** → QR code generated
  - **Embedded Checkout Vendors** (SSLCommerz, Adyen, Stripe, Unit, etc.) → Redirect or in-app checkout

#### 3. 🧾 Invoice Generation & Delivery
- Once payment is confirmed, ZakPOS generates an **invoice** with:
  - Shop details (logo, name, address, tax ID)
  - Customer details (if provided)
  - Itemized purchase list
  - Total amount paid
  - Payment method
  - **QR code** for digital verification or future payments

#### 4. 📤 Invoice Delivery Options
Vendor asks customer how they want the invoice:

- **Digital Delivery**
  - Email (PDF invoice)
  - WhatsApp / Messenger / SMS (link or image/PDF)
  - Facebook Messenger (if integrated)
- **Printed Copy**
  - Connected thermal printer prints receipt instantly

#### 5. 🔗 QR Code & Payment Integration
- Invoice includes a **QR code** that can be:
  - Scanned by customer to pay via **bKash/Nagad**
  - Linked to **SSLCommerz/Adyen/Unit** checkout page
  - Used later for **invoice lookup** or **return/refund validation**

#### 6. 📊 Post-Sale Processing
- ZakPOS automatically:
  - Updates **inventory stock**
  - Logs transaction in **accounting ledger**
  - Syncs data with **cloud dashboard** for reporting
- Customer leaves with products + invoice (digital or printed)

## 💰 Business Model & Monetization

### A. Market Fit
- **Bangladesh Context**: Many shopkeepers lack structured accounting; ZakPOS bridges informal retail with digital compliance
- **Global Potential**: Shopify integration positions ZakPOS as a **value-add billing layer** for international merchants

### B. Monetization Strategy
- **Tiered SaaS Pricing**:
  - **Free** → Basic POS
  - **Pro** → Inventory + Accounting
  - **Premium** → Shopify + OCR + Loyalty
- **Add-On Marketplace**: Paid modules (e.g., pharmacy compliance, restaurant table management)

### C. Adoption Strategy
- **Local Agents**: Partner with hardware vendors to bundle ZakPOS
- **Training & Support**: Video tutorials, WhatsApp support groups
- **Trust Building**: Transparent pricing, no hidden fees

### D. Long-Term Scalability
- **AI-Powered Forecasting**: Predict demand, optimize stock
- **Blockchain Receipts**: Immutable transaction records for compliance
- **Regional Expansion**: Adapt for South Asia, then global rollout

## 🎯 Target Market & Strategic Positioning

### A. Market Opportunity
- **Primary Market**: Bangladesh retail sector (grocery stores, pharmacies, clothing shops, restaurants)
- **Market Size**: 1M+ small-medium retail shops in Bangladesh alone
- **Pain Points**:
  - Manual accounting and inventory tracking
  - Compliance challenges with VAT/GST regulations
  - Lack of digital payment integration
  - Limited access to business analytics

### B. Competitive Advantages
- **Local Payment Integration**: Native support for bKash, Nagad, Rocket, and other local wallets
- **Multi-tenant SaaS Model**: Cost-effective for small shopkeepers
- **OCR Technology**: Eliminates manual product entry
- **Shopify Integration**: Connects traditional retail with e-commerce
- **Bangladesh Compliance**: Built-in VAT/GST reporting aligned with local regulations

### C. Go-to-Market Strategy
- **Partnership Model**: Hardware vendors, payment providers, local distributors
- **Free Tier**: Lower barrier to entry for small shopkeepers
- **Training Program**: Video tutorials, WhatsApp support, local workshops
- **Regional Focus**: Start in Dhaka, expand to other major cities, then nationally

### D. Growth Metrics & KPIs
- **Customer Acquisition**: Monthly active shops, churn rate
- **Revenue**: Subscription tiers, transaction fees, add-on modules
- **Engagement**: Daily transactions per shop, feature adoption rates
- **Expansion**: New cities, new verticals, international markets

## 📈 Strategic Roadmap & Vision

### A. Phase 1: Bangladesh Market Domination (Months 1-12)
- **Core POS Launch**: Basic functionality for small shops
- **Local Payment Integration**: bKash, Nagad, Rocket, card payments
- **OCR Implementation**: Mobile scanning for product entry
- **Compliance Features**: VAT/GST reporting for Bangladesh

### B. Phase 2: Advanced Features & Integration (Months 13-24)
- **Shopify Integration**: Connect traditional shops with e-commerce
- **Loyalty Programs**: Customer retention and engagement
- **Advanced Analytics**: Business intelligence dashboard
- **Multi-location Support**: Chain store management

### C. Phase 3: Regional Expansion & Enterprise (Months 25-36)
- **South Asia Expansion**: India, Pakistan, Sri Lanka markets
- **Enterprise Features**: Multi-tenant admin portals
- **API Marketplace**: Third-party developer ecosystem
- **AI/ML Integration**: Predictive inventory and sales forecasting

### D. Phase 4: Global Platform (Months 37+)
- **International Payment Gateways**: Stripe, Adyen, local variants
- **Multi-currency Support**: Global merchant adoption
- **Advanced Compliance**: GDPR, PCI-DSS, regional regulations
- **Platform Ecosystem**: App store, integrations marketplace

## 🎯 Final Takeaway

**ZakPOS isn't just a POS—it's a retail operating system.**

- **For Shopkeepers**: It simplifies daily chaos into structured workflows
- **For Admins**: It ensures compliance, scalability, and monetization
- **For Consumers**: It creates trust, loyalty, and digital convenience

This layered approach makes ZakPOS **investor-ready** and **scalable beyond Bangladesh**, while staying deeply relevant to local shopkeepers' pain points.

## 🏗 Tech Stack

### Backend
- **Framework**: NestJS 11.x (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL 17.x
- **ORM**: TypeORM + Prisma
- **Authentication**: Passport.js, JWT, Auth0
- **Message Queue**: Apache Kafka
- **Cache**: Redis
- **Validation**: class-validator, class-transformer

### Frontend
- **Framework**: Next.js 15.x
- **UI Library**: React 19.x
- **Language**: TypeScript
- **Build Tool**: Turbopack
- **Styling**: CSS Modules, Tailwind CSS (planned)

### Mobile
- **Framework**: React Native 0.81.x
- **Platform**: Expo SDK 54
- **Navigation**: React Navigation 7
- **Language**: TypeScript

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **Database**: PostgreSQL 17.x Alpine
- **Cache**: Redis 7.x Alpine
- **Message Queue**: Kafka 7.x with Zookeeper

## 🏛 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Mobile App    │    │   Third-party   │
│   (Next.js)     │    │  (React Native) │    │   Integrations  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Nginx Proxy   │
                    │   (Load Balancer)│
                    └─────────┬───────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   API Server    │ │   WebSocket     │ │   File Upload   │
│   (NestJS)      │ │   Server        │ │   Service       │
└─────────┬───────┘ └─────────┬───────┘ └─────────┬───────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     Redis       │ │   Kafka +       │
│   Database      │ │     Cache       │ │   Zookeeper     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Service Architecture
- **API Layer**: RESTful endpoints with OpenAPI documentation
- **Business Logic**: Domain-driven design with clean architecture
- **Data Layer**: Repository pattern with TypeORM/Prisma
- **Event Layer**: Event sourcing and CQRS patterns
- **Cache Layer**: Multi-level caching strategy
- **Message Layer**: Event-driven communication via Kafka

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Make (optional, for convenience commands)
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd zakpos
```

### 2. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your configuration
nano .env
```

### 3. Start Development Environment
```bash
# Using Make (recommended)
make dev

# Or using Docker Compose directly
docker-compose up -d
```

### 4. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Web App** | http://localhost:41923 | Main web interface |
| **API** | http://localhost:39847/api/v1 | REST API endpoints |
| **Mobile** | http://localhost:53851 | Mobile web version |
| **API Docs** | http://localhost:39847/api/v1/docs | Swagger documentation |

### 5. Development Tools

| Tool | URL | Credentials |
|------|-----|-------------|
| **pgAdmin** | http://localhost:58050 | admin@zakpos.com / admin123 |
| **Redis Insight** | http://localhost:58001 | - |
| **Kafka UI** | http://localhost:58080 | - |
| **Mailhog** | http://localhost:58026 | Email testing |
| **File Browser** | http://localhost:58082 | File management |

## 💻 Development

### Available Make Commands

#### Environment Management
```bash
make dev          # Start development environment
make dev-build    # Build and start development environment
make dev-stop     # Stop development environment
make dev-restart  # Restart development environment
make dev-logs     # View development logs
```

#### Testing
```bash
make test         # Run all tests
make test-unit    # Run unit tests only
make test-e2e     # Run end-to-end tests
make test-cov     # Run tests with coverage
make test-watch   # Run tests in watch mode
```

#### Building
```bash
make build        # Build all services
make build-api    # Build API service only
make build-web    # Build web service only
make build-mobile # Build mobile service only
```

#### Database Operations
```bash
make shell-db     # Open PostgreSQL shell
make db-backup    # Backup database
make db-restore   # Restore database
make db-reset     # Reset database (⚠️ destroys data)
```

#### Monitoring & Logs
```bash
make status       # Show service status
make logs         # Show all logs
make logs-api     # Show API logs only
make logs-web     # Show web logs only
make stats        # Show resource usage
```

#### Development Tools
```bash
make shell-api    # Open shell in API container
make shell-web    # Open shell in web container
make shell-redis  # Open Redis CLI
make lint         # Run linting on all services
make format       # Format code in all services
```

### Project Structure

```
zakpos/
├── 📁 server/              # NestJS API server
│   ├── 📁 src/
│   │   ├── 📁 modules/     # Feature modules
│   │   ├── 📁 common/      # Shared utilities
│   │   └── 📁 config/      # Configuration
│   ├── 📁 test/           # Test files
│   └── 📁 docker/         # Docker configuration
├── 📁 client/              # Next.js web application
│   ├── 📁 app/            # Next.js app directory
│   ├── 📁 components/     # React components
│   ├── 📁 lib/            # Utilities and configurations
│   └── 📁 public/         # Static assets
├── 📁 mobile-app/          # React Native mobile app
│   ├── 📁 app/            # App screens
│   ├── 📁 components/     # Mobile components
│   └── 📁 assets/         # Mobile assets
├── 📁 docker/              # Docker configurations
│   ├── 📁 nginx/          # Nginx configuration
│   ├── 📁 postgres/       # PostgreSQL setup
│   └── 📁 redis/          # Redis configuration
├── 📁 data/               # Persistent data
│   ├── 📁 postgres/       # Database files
│   ├── 📁 redis/         # Cache files
│   └── 📁 uploads/       # File uploads
└── 📁 scripts/            # Utility scripts
```

### Environment Variables

Key environment variables (see `env.example` for complete list):

```bash
# Application
NODE_ENV=development
VERSION=1.0.0

# Database
POSTGRES_DB=zakpos_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password

# Redis
REDIS_PASSWORD=your-redis-password

# Authentication
JWT_SECRET=your-super-secret-jwt-key
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id

# API Configuration
API_PORT=39847
API_PREFIX=api/v1

# Web Configuration
WEB_PORT=41923
NEXT_PUBLIC_API_URL=http://localhost:39847/api/v1
```

## 📚 API Documentation

### REST API

The API follows RESTful conventions and includes:

- **Authentication**: JWT-based auth with Auth0 integration
- **Rate Limiting**: Configurable rate limiting per endpoint
- **Validation**: Request/response validation with class-validator
- **Documentation**: OpenAPI/Swagger documentation
- **Error Handling**: Standardized error responses

#### Base URL
```
http://localhost:39847/api/v1
```

#### Authentication
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:39847/api/v1/protected-endpoint
```

#### Common Endpoints
- `GET /health` - Health check
- `POST /auth/login` - User authentication
- `GET /products` - List products
- `POST /orders` - Create order
- `GET /analytics/sales` - Sales analytics

### WebSocket API

Real-time features via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:39847');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates
};
```

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
```bash
cp env.example .env
# Edit .env with production values
nano .env
```

2. **Production Build**
```bash
make prod-build
```

3. **Start Production Services**
```bash
make prod
```

### Docker Commands

```bash
# Build specific services
docker-compose build api
docker-compose build web
docker-compose build mobile

# Scale services
docker-compose up -d --scale api=3

# View logs
docker-compose logs -f api
docker-compose logs -f web

# Execute commands in containers
docker-compose exec api npm run migration:run
docker-compose exec postgres psql -U postgres -d zakpos_prod
```

### Environment Configurations

- **Development**: `docker-compose.yml` + `docker-compose.dev.yml`
- **Production**: `docker-compose.yml` + `docker-compose.prod.yml`
- **Testing**: `docker-compose.test.yml`

## 📊 Monitoring

### Health Checks
All services include health check endpoints:
- API: `http://localhost:39847/health`
- Web: `http://localhost:41923/health`
- Database: PostgreSQL health checks
- Cache: Redis health checks
- Message Queue: Kafka health checks

### Logging
- Centralized logging in `./data/logs/`
- Structured JSON logging
- Log rotation and retention
- Integration with monitoring systems

### Metrics
- Service performance metrics
- Database query performance
- Cache hit/miss ratios
- API response times
- Error rates and patterns

## 🔧 Configuration

### Development Tools Setup

The development environment includes:

1. **pgAdmin 4** - PostgreSQL database management
2. **Redis Insight** - Redis cache management
3. **Kafka UI** - Message queue management
4. **Mailhog** - Email testing
5. **File Browser** - File management

### SSL/TLS Configuration

For production HTTPS:
```bash
# Generate SSL certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./docker/nginx/ssl/private.key \
  -out ./docker/nginx/ssl/certificate.crt

# Update nginx configuration
# Edit ./docker/nginx/conf.d/default.conf
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Run the test suite**: `make test`
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Use conventional commits
- Update documentation
- Follow the existing code style
- Ensure all tests pass

## 📝 Scripts

### Server Scripts
```bash
cd server
npm run start:dev    # Development mode
npm run test         # Run tests
npm run test:cov     # Test with coverage
npm run lint         # Code linting
npm run format       # Code formatting
```

### Client Scripts
```bash
cd client
npm run dev          # Development mode
npm run build        # Production build
npm run lint         # Code linting
```

### Mobile Scripts
```bash
cd mobile-app
npx expo start       # Start development
npx expo build:ios   # Build for iOS
npx expo build:android # Build for Android
```

## 📄 License

This project is licensed under the UNLICENSED license. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Internal Wiki](docs/)
- **Issues**: [GitHub Issues](issues/)
- **Discussions**: [GitHub Discussions](discussions/)
- **Email**: support@zakpos.com

## 🔄 Version History

### v1.0.0 (Current)
- Complete POS system implementation
- Multi-platform support (Web, Mobile, API)
- Microservices architecture
- Comprehensive testing suite
- Production-ready deployment

### Roadmap
- [ ] Advanced inventory management
- [ ] Multi-store synchronization
- [ ] Advanced analytics dashboard
- [ ] Payment gateway integrations
- [ ] Mobile app store releases
- [ ] API marketplace
- [ ] Plugin system
- [ ] Advanced reporting

---

<div align="center">

**Built with ❤️ for modern businesses**

[⭐ Star us on GitHub](https://github.com/your-org/zakpos) •
[🐛 Report Issues](https://github.com/your-org/zakpos/issues) •
[💬 Join Discussions](https://github.com/your-org/zakpos/discussions)

</div>
