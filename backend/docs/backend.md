# MODAKey Backend - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Implementation Summary](#implementation-summary)
3. [Quick Start Guide](#quick-start-guide)
4. [Database Setup & Seeding](#database-setup--seeding)
5. [Implementation Checklist](#implementation-checklist)
6. [API Endpoints](#api-endpoints)
7. [Testing Guide](#testing-guide)

---

## Overview

Production-grade mechanical keyboard store backend API built with NestJS, Prisma, PostgreSQL, and Redis.

### Features Implemented

- **Authentication & Authorization** - JWT with refresh tokens, role-based access control
- **Products Management** - CRUD operations, variants, Redis caching, search and filtering
- **Shopping Cart** - Add/update/remove items, stock validation, persistent carts
- **Orders & Payments** - Order creation with atomic inventory reservation
- **Inventory Management** - Concurrency control with optimistic locking
- **Infrastructure** - PostgreSQL, Redis caching, Bull queue, Swagger documentation

### Tech Stack

- **Framework**: NestJS 11.x
- **Database**: PostgreSQL 16 with Prisma 7 ORM
- **Caching**: Redis 7
- **Queue**: Bull
- **Authentication**: JWT with Passport
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest + Supertest

---

## Implementation Summary

### ✅ Critical Features: Inventory & Order Management

#### 1. Inventory Service with Concurrency Control

**File**: `src/modules/inventory/inventory.service.ts`

##### Key Methods:

**`reserveInventory(variantId, quantity, userId?, reason?)`**
- **Purpose**: Reserve inventory with atomic transaction and optimistic locking
- **Concurrency Protection**: 
  - Uses Prisma transaction with `SERIALIZABLE` isolation level
  - Implements optimistic locking by checking quantity hasn't changed
  - Returns `ConflictException` if stock was modified by another transaction
- **Features**:
  - Validates available stock (quantity - reservedQuantity)
  - Atomically increments `reservedQuantity`
  - Creates inventory log with `RESERVATION` change type
  - Prevents overselling with race condition handling

**`releaseReservation(variantId, quantity, userId?, reason?)`**
- Releases reserved inventory (e.g., on order cancellation)
- Decrements `reservedQuantity`
- Creates inventory log with `RELEASE` change type

**`confirmSale(variantId, quantity, userId?, reason?)`**
- Confirms sale after payment and reduces actual inventory
- Decrements both `quantity` and `reservedQuantity`
- Creates inventory log with `SALE` change type

**`adjustInventory(variantId, quantityChange, reason, userId?)`**
- Admin inventory adjustments (restocking, corrections)
- Creates inventory log with `ADJUSTMENT` change type

**`getAvailableStock(variantId)`**
- Returns real-time available stock: `quantity - reservedQuantity`

#### 2. Orders Service with Atomic Operations

**File**: `src/modules/orders/orders.service.ts`

**`createOrder(userId, createOrderDto)`**
- **Purpose**: Create order from cart with atomic inventory reservation
- **Transaction Flow**:
  1. Validate user, cart, and addresses
  2. Calculate subtotal, tax, shipping, discount (with coupon support)
  3. **Inside SERIALIZABLE transaction**:
     - Reserve inventory for ALL cart items
     - Generate unique order number
     - Create order with all items
     - Store product snapshot
     - Update coupon usage
     - Clear cart
  4. Return complete order

**`cancelOrder(orderId, userId, cancelDto?)`**
- Cancels order and releases inventory
- Handles different order statuses:
  - **PENDING**: Releases reservation
  - **PAID/PROCESSING**: Returns stock + releases reservation

**`updateOrderStatus(orderId, newStatus, adminUserId, notes?)`**
- Admin function to update order status
- When marking as **PAID**, confirms sale in inventory

### 🔒 Concurrency Protection Mechanisms

#### 1. Optimistic Locking
```typescript
const updated = await tx.inventory.updateMany({
  where: { 
    productVariantId: variantId,
    quantity: inventory.quantity,        // Version check
    reservedQuantity: inventory.reservedQuantity  // Version check
  },
  data: {
    reservedQuantity: { increment: quantity }
  }
});

if (updated.count === 0) {
  throw new ConflictException('Inventory modified by another transaction');
}
```

#### 2. Transaction Isolation
```typescript
await this.prisma.$transaction(async (tx) => {
  // ... critical operations
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 10000
});
```

#### 3. Reserved Quantity Pattern
- `quantity`: Total physical stock
- `reservedQuantity`: Stock held for pending orders
- **Available** = `quantity - reservedQuantity`

### 📊 Order Lifecycle

1. **PENDING** - Inventory: `reservedQuantity` increased
2. **PAID** - Inventory: `quantity` decreased, `reservedQuantity` decreased
3. **PROCESSING** - Admin stage, inventory already reduced
4. **SHIPPED** / **DELIVERED** - Cannot be cancelled
5. **CANCELLED** - Release/return inventory based on previous status

---

## Quick Start Guide

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### Running the Application

#### Development Mode

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Run database migrations
npx prisma migrate dev

# Seed the database with sample data
npm run db:seed

# Start the application
npm run start:dev
```

The application will be available at `http://localhost:3000`

#### API Documentation

Swagger documentation is available at: `http://localhost:3000/api/docs`

---

## Database Setup & Seeding

For complete database management, seeding, monitoring, and troubleshooting documentation, see **[Database Management Guide](./database.md)**.

### Quick Start

```bash
# Run migrations
npx prisma migrate dev

# Seed database with sample data
npm run db:seed

# Open database GUI
npx prisma studio
```

### Test Credentials (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@modakey.com | password123 |
| Customer | john.doe@example.com | password123 |
| Customer | jane.smith@example.com | password123 |
| Vendor | vendor@modakey.com | password123 |

### Seeded Data Includes

- 4 Users with different roles
- 4 Keyboard products with 5 variants
- Complete inventory with warehouse locations
- 1 Shopping cart with items (John Doe)
- 1 Completed order with full lifecycle (Jane Smith)
- 2 Product reviews
- 3 Active coupons: `WELCOME10`, `SAVE20`, `FREESHIP`

**📚 For comprehensive database documentation including:**
- Database inspection with Prisma Studio and psql
- SQL queries for monitoring
- Backup and restore procedures
- Migration management
- Performance tuning
- Troubleshooting guide

**See: [docs/database.md](./database.md)**

### Complete Order Flow Example

#### 1. Register & Login
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "SecurePass123!"
  }'
```

#### 2. Create Shipping Address
```bash
curl -X POST http://localhost:3000/api/v1/profile/addresses \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "123 Main Street",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "country": "USA",
    "isDefault": true
  }'
```

#### 3. Add to Cart
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productVariantId": "VARIANT_ID",
    "quantity": 1
  }'
```

#### 4. Create Order
```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddressId": "YOUR_ADDRESS_ID",
    "paymentMethod": "CREDIT_CARD",
    "couponCode": "WELCOME10"
  }'
```

#### 5. Cancel Order (Optional)
```bash
curl -X PUT http://localhost:3000/api/v1/orders/ORDER_ID/cancel \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Changed my mind"
  }'
```

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user

### Products
- `GET /api/v1/products` - List products with filters
- `GET /api/v1/products/:slug` - Get product details
- `GET /api/v1/products/:id/variants` - Get product variants
- `GET /api/v1/products/:id/reviews` - Get product reviews

### Cart (Protected)
- `GET /api/v1/cart` - Get current cart
- `POST /api/v1/cart/items` - Add item to cart
- `PUT /api/v1/cart/items/:id` - Update cart item
- `DELETE /api/v1/cart/items/:id` - Remove from cart
- `DELETE /api/v1/cart` - Clear cart

### Orders (Protected)
- `GET /api/v1/orders` - List user orders
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders` - **Create order** (atomic inventory reservation)
- `PUT /api/v1/orders/:id/cancel` - **Cancel order** (release inventory)

### Admin
- `POST /api/v1/admin/products` - Create product
- `PUT /api/v1/admin/products/:id` - Update product
- `DELETE /api/v1/admin/products/:id` - Delete product
- `GET /api/v1/admin/inventory` - Inventory overview

---

## Testing Guide

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Specific E2E test
npm run test:e2e -- inventory-concurrency.e2e-spec.ts
```

### Concurrent Inventory Test

The E2E test verifies that the system prevents overselling when multiple users simultaneously try to purchase the last item.

**Test File**: `test/inventory-concurrency.e2e-spec.ts`

**Test Scenarios**:

1. **Prevent Overselling**: 10 concurrent requests for 1 item
   - Only 1 succeeds (201)
   - 9 fail (409 Conflict)
   - Inventory: `reservedQuantity = 1`, `available = 0`

2. **Order Cancellation**: Create and cancel order
   - Inventory reserved on creation
   - Inventory released on cancellation
   - Available stock returns to original

### Manual Testing

Use the Swagger UI at `http://localhost:3000/api/docs` for interactive API testing.

### Common Error Scenarios

#### 1. Insufficient Stock (409 Conflict)
```json
{
  "statusCode": 409,
  "message": "Insufficient stock for Product. Requested: 2, Available: 1",
  "error": "Conflict"
}
```

#### 2. Empty Cart (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Cart is empty",
  "error": "Bad Request"
}
```

#### 3. Cannot Cancel Order (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Cannot cancel order that has been shipped or delivered",
  "error": "Bad Request"
}
```

---

## Implementation Checklist

### ✅ Phase 1: Critical Features (COMPLETED)

- [x] Inventory management with concurrency control
- [x] Order creation with atomic reservation
- [x] Order cancellation with inventory release
- [x] E2E tests for concurrent scenarios
- [x] API documentation

### 🔄 Phase 2: Background Jobs (HIGH PRIORITY - NEXT)

#### Cart Management
- [ ] Create `CartProcessor` class
- [ ] Cleanup abandoned carts (older than 7 days)
- [ ] Schedule with cron: `@Cron('0 2 * * *')`

#### Reservation Timeout
- [ ] Create `OrderProcessor` class
- [ ] Release expired reservations (after 15 minutes)
- [ ] Schedule with cron: `@Cron('*/5 * * * *')`

#### Email Notifications (Optional)
- [ ] Order confirmation emails
- [ ] Order shipped notifications
- [ ] Abandoned cart reminders

**Files to Create**:
- `src/queue/processors/cart.processor.ts`
- `src/queue/processors/order.processor.ts`

### 📦 Phase 3: Admin Features

- [ ] `POST /api/v1/admin/inventory/adjust` - Inventory adjustments
- [ ] `PUT /api/v1/admin/orders/:id/status` - Update order status
- [ ] `GET /api/v1/admin/inventory/logs` - View inventory history
- [ ] `GET /api/v1/admin/orders` - List all orders with filters

### 🧪 Phase 4: Comprehensive Testing

#### Unit Tests (Target: 80% coverage)
- [ ] `inventory.service.spec.ts`
- [ ] `orders.service.spec.ts`
- [ ] `cart.service.spec.ts`

#### Additional E2E Tests
- [ ] Order flow with multiple items
- [ ] Order with partial stock
- [ ] Coupon application
- [ ] Cart persistence across sessions

### 💳 Phase 5: Payment Integration

- [ ] Stripe payment intent creation
- [ ] Webhook handler for payment confirmation
- [ ] Payment idempotency
- [ ] Refund processing

### 🗄️ Phase 6: Database Seeding

- [ ] Create `prisma/seed.ts`
- [ ] Seed brands, categories, products
- [ ] Seed inventory for all variants
- [ ] Seed test users and coupons
- [ ] Add seed script to package.json

### 🚀 Phase 7: Deployment Preparation

- [ ] Create `.env.example`
- [ ] Health check endpoint
- [ ] Graceful shutdown handling
- [ ] Production logging (Winston)
- [ ] Error tracking (Sentry)

---

## Project Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/          # Authentication & authorization
│   │   ├── products/      # Product management
│   │   ├── cart/          # Shopping cart
│   │   ├── orders/        # Order processing ⭐
│   │   ├── inventory/     # Inventory management ⭐
│   │   ├── payments/      # Payment processing
│   │   ├── reviews/       # Product reviews
│   │   └── admin/         # Admin features
│   ├── common/            # Shared utilities
│   ├── prisma/            # Prisma service
│   ├── redis/             # Redis service
│   └── queue/             # Bull queue
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── test/
│   └── inventory-concurrency.e2e-spec.ts  # Concurrency tests ⭐
└── docs/
    └── README.md          # This file

⭐ = Recently implemented/updated
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/moda_key_db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="15m"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_REFRESH_EXPIRATION="7d"

# App
PORT=3000
NODE_ENV="development"
API_PREFIX="api/v1"

# CORS
CORS_ORIGIN="http://localhost:3001"

# Cart & Orders
CART_EXPIRATION_DAYS=7
RESERVATION_TIMEOUT_MINUTES=15
```

---

## Performance Targets

- API response time: < 200ms (p95)
- Product listing: < 100ms (cached)
- Order creation: < 500ms
- Search queries: < 150ms
- Concurrent order handling: 100+ simultaneous checkouts

---

## 🔍 Monitoring Inventory

### Check Available Stock
```bash
curl http://localhost:3000/api/v1/admin/inventory \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response**:
```json
[
  {
    "quantity": 50,          // Total physical stock
    "reservedQuantity": 5,   // Reserved for pending orders
    "productVariant": { ... }
  }
]
```

**Available Stock** = `quantity - reservedQuantity` = 45

---

## 🎯 What This Solves

### ✅ Race Condition Prevention
- Multiple users buying the last item → Only 1 succeeds
- Transaction isolation prevents dirty reads

### ✅ No Overselling
- Available stock calculation always accurate
- Optimistic locking catches concurrent modifications

### ✅ Inventory Accuracy
- Full audit trail with inventory logs
- Every change logged (RESERVATION, SALE, RELEASE, etc.)

### ✅ Order Integrity
- Atomic order creation (all items reserved or none)
- Clear separation: reserved vs. sold stock

### ✅ Graceful Cancellation
- Proper inventory release on cancellation
- Different handling based on order status

---

## 🎓 Best Practices

### For Frontend Developers

1. **Show available stock**, not total stock:
   ```javascript
   const available = variant.inventory.quantity - variant.inventory.reservedQuantity;
   ```

2. **Handle 409 errors gracefully**:
   ```javascript
   try {
     const order = await createOrder(data);
   } catch (error) {
     if (error.status === 409) {
       showNotification("Item sold out! Refreshing cart...");
       refreshCart();
     }
   }
   ```

3. **Implement retry logic** for optimistic lock conflicts

4. **Show order status clearly**:
   - PENDING: "Order placed, awaiting payment"
   - PAID: "Payment received, preparing order"
   - PROCESSING: "Order being prepared"
   - SHIPPED: "Order on the way"
   - DELIVERED: "Order delivered"
   - CANCELLED: "Order cancelled"

### For Backend Developers

1. **Always use transactions** for inventory operations
2. **Log conflicts** for monitoring
3. **Set appropriate timeouts**
4. **Monitor reservation rates**
5. **Implement reservation cleanup job**

---

## 📚 Key Learnings

1. **Always use transactions** for multi-step operations
2. **Optimistic locking** is crucial for high-concurrency scenarios
3. **Reserved quantity** pattern prevents overselling elegantly
4. **SERIALIZABLE isolation** provides strongest consistency
5. **Comprehensive logging** makes debugging production issues easier

---

## 🚀 Recent Achievements

✅ Implemented critical concurrency control with optimistic locking  
✅ Created atomic order creation with inventory reservation  
✅ Added order cancellation with proper inventory release  
✅ Wrote E2E tests for concurrent scenarios  
✅ Comprehensive documentation for new features

---

## 📊 Current Status

**Overall Completion**: ~55%

| Module | Status | Completion |
|--------|--------|------------|
| Database Schema | ✅ Complete | 100% |
| Infrastructure | ✅ Complete | 100% |
| Authentication | ✅ Complete | 100% |
| Products | ✅ Complete | 95% |
| Cart | ✅ Complete | 90% |
| **Inventory** | ✅ **COMPLETE** | **100%** |
| **Orders** | ✅ **COMPLETE** | **95%** |
| Payments | 🔄 Basic | 20% |
| Reviews | 🔄 In Progress | 70% |
| Admin | 🔄 Needs Work | 30% |
| Background Jobs | ❌ Not Started | 0% |
| Testing | 🔄 Basic E2E | 25% |
| Documentation | ✅ Complete | 90% |

---

## 📞 Support & Resources

- **Swagger API Docs**: http://localhost:3000/api/docs
- **Prisma Schema**: `prisma/schema.prisma`
- **Project Prompt**: `../project-prompt.md`
- **Test Examples**: `test/*.e2e-spec.ts`

---

## License

UNLICENSED - Private project
