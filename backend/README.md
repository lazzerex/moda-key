# MODAKey E-Commerce Backend API

Production-grade mechanical keyboard store backend API built with NestJS, Prisma, PostgreSQL, and Redis.

## Description

A comprehensive e-commerce backend system for a mechanical keyboard store featuring JWT authentication, product management with Redis caching, shopping cart functionality, order processing with Stripe payments, product reviews, inventory management, and role-based access control. Built with modern TypeScript framework and production-ready architecture.

## Features Implemented

- ✅ **Authentication & Authorization** - JWT with refresh tokens, role-based access control (CUSTOMER, ADMIN, VENDOR)
- ✅ **Products Management** - CRUD operations, product variants, Redis caching, advanced search and filtering
- ✅ **Shopping Cart** - Add/update/remove items, stock validation, persistent carts for authenticated users
- ✅ **Orders & Payments** - Complete order processing with Stripe integration and webhook handling
- ✅ **Reviews System** - Product reviews, ratings, helpful votes, and moderation
- ✅ **Inventory Management** - Stock tracking with concurrency control
- ✅ **Admin Panel** - Dashboard with analytics and comprehensive management tools
- ✅ **Infrastructure** - PostgreSQL database, Redis caching, Bull queue for background jobs, Swagger documentation

## Documentation

Comprehensive documentation is available in the [docs/](./docs) directory:

- **[API Quick Reference](./docs/API_QUICK_REFERENCE.md)** - Complete API endpoint reference with examples
- **[Payment Testing Guide](./docs/PAYMENT_TESTING_GUIDE.md)** - How to test Stripe payment integration
- **[Payment Implementation](./docs/PAYMENTS_IMPLEMENTATION_SUMMARY.md)** - Payment module architecture details
- **[Database Reference](./docs/QUICK_DATABASE_REFERENCE.md)** - Database commands, queries, and seed data
- **[Admin Implementation](./docs/ADMIN_IMPLEMENTATION_SUMMARY.md)** - Admin features overview
- **[Admin Quick Reference](./docs/ADMIN_QUICK_REFERENCE.md)** - Admin API endpoints
- **[Admin API Documentation](./docs/admin-api.md)** - Detailed admin API documentation
- **[Backend Architecture](./docs/backend.md)** - Architecture patterns and design decisions
- **[Database Documentation](./docs/database.md)** - Database schema and relationships
- **[Reviews Implementation](./docs/reviews-implementation.md)** - Reviews system details

## Tech Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL 16 with Prisma 7 ORM
- **Caching**: Redis 7
- **Queue**: Bull
- **Authentication**: JWT with Passport
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest + Supertest
- **Containerization**: Docker & Docker Compose

## Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Docker and Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

## Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

## Running the Application

### Development Mode

```bash
# Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# Run database migrations
npx prisma migrate dev

# Start application in watch mode
npm run start:dev
```

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

### Other Commands

```bash
# Start in debug mode
npm run start:debug

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

## Application URLs

Once the application is running, you can access:

- **API Base URL**: http://localhost:3000/api/v1
- **Swagger Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

## Quick API Reference

For detailed API documentation with request/response examples, see [docs/API_QUICK_REFERENCE.md](./docs/API_QUICK_REFERENCE.md).

### Key Endpoints Overview

### Authentication Endpoints

**Base Path**: `/api/v1/auth`

- `POST /register` - Register a new user account
- `POST /login` - Authenticate user and receive JWT tokens
- `POST /refresh` - Refresh access token using refresh token
- `POST /logout` - Invalidate refresh token (requires authentication)
- `GET /me` - Get current authenticated user profile

### Product Endpoints

**Base Path**: `/api/v1/products`

**Public Endpoints:**
- `GET /products` - List all products with pagination and filters
- `GET /products/search?q={query}` - Search products by name or description
- `GET /products/:id` - Get detailed product information by ID
- `GET /products/slug/:slug` - Get product by URL slug
- `GET /products/:id/variants` - Get all variants for a specific product

**Admin/Vendor Endpoints** (requires authentication + role):
- `POST /products` - Create new product
- `PUT /products/:id` - Update existing product
- `DELETE /products/:id` - Delete product (Admin only)
- `POST /products/:id/variants` - Add variant to product
- `PUT /products/variants/:variantId` - Update product variant

### Shopping Cart Endpoints

**Base Path**: `/api/v1/cart` (all endpoints require authentication)

- `GET /cart` - Get current user's cart with items
- `POST /cart/items` - Add product variant to cart
- `PUT /cart/items/:cartItemId` - Update cart item quantity
- `DELETE /cart/items/:cartItemId` - Remove item from cart
- `DELETE /cart` - Clear entire cart

### Order Endpoints

**Base Path**: `/api/v1/orders` (all endpoints require authentication)

- `GET /orders` - List all orders for current user
- `GET /orders/:id` - Get detailed order information

### Admin Endpoints

**Base Path**: `/api/v1/admin` (requires ADMIN role)

- `GET /admin/dashboard` - Get dashboard statistics (users, orders, products counts)

For more details, see:
- [API Quick Reference](./docs/API_QUICK_REFERENCE.md) - Complete endpoint documentation
- [Admin API Documentation](./docs/admin-api.md) - Admin-specific endpoints
- [Payment Testing Guide](./docs/PAYMENT_TESTING_GUIDE.md) - Payment flow testing

## Database Schema

## Database Schema

The application uses a comprehensive schema with 20+ models including:

- Users & Authentication (User, RefreshToken, UserAddress)
- Product Catalog (Product, ProductVariant, Brand, Category)
- Shopping (Cart, CartItem, Order, OrderItem)
- Inventory Management (Inventory, InventoryLog)
- Payments (Payment)
- Reviews (Review, ReviewImage, ReviewVote)
- Promotions (Coupon, UserCoupon)

View complete schema: [prisma/schema.prisma](./prisma/schema.prisma)

For database management commands and queries, see [docs/QUICK_DATABASE_REFERENCE.md](./docs/QUICK_DATABASE_REFERENCE.md).

## Project Structure

```
backend/
├── docs/                      # Documentation files
│   ├── API_QUICK_REFERENCE.md
│   ├── PAYMENT_TESTING_GUIDE.md
│   ├── PAYMENTS_IMPLEMENTATION_SUMMARY.md
│   ├── QUICK_DATABASE_REFERENCE.md
│   ├── ADMIN_IMPLEMENTATION_SUMMARY.md
│   ├── ADMIN_QUICK_REFERENCE.md
│   ├── admin-api.md
│   ├── backend.md
│   ├── database.md
│   └── reviews-implementation.md
├── src/
│   ├── modules/
│   │   ├── auth/              # Authentication & JWT
│   │   ├── products/          # Products & variants management
│   │   ├── cart/              # Shopping cart operations
│   │   ├── orders/            # Order management
│   │   ├── inventory/         # Stock management
│   │   ├── payments/          # Payment processing (Stripe)
│   │   ├── reviews/           # Product reviews
│   │   ├── users/             # User management
│   │   └── admin/             # Admin-only endpoints
│   ├── common/
│   │   ├── guards/            # Authentication & authorization guards
│   │   ├── decorators/        # Custom decorators (Roles, etc.)
│   │   ├── filters/           # Exception filters
│   │   └── pipes/             # Validation pipes
│   ├── prisma/                # Database service & client
│   ├── redis/                 # Redis cache service
│   ├── queue/                 # Bull queue configuration
│   ├── app.module.ts          # Root application module
│   └── main.ts                # Application entry point
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── seed.ts                # Database seeding script
│   └── migrations/            # Database migration files
├── test/                      # E2E test files
├── docker-compose.yml         # Docker services configuration
├── Dockerfile                 # Production Docker image
├── .env                       # Environment variables
└── package.json               # Project dependencies
```

## Database Schema Overview

The application uses the following main database models:

### Users & Authentication
- `User` - User accounts with roles
- `RefreshToken` - JWT refresh tokens
- `UserAddress` - User shipping/billing addresses

### Product Catalog
- `Product` - Main product information
- `ProductVariant` - Product variants (switches, colors, layouts)
- `ProductImage` - Product images
- `Brand` - Product brands
- `Category` - Product categories

### Shopping & Orders
- `Cart` - User shopping carts
- `CartItem` - Items in cart
- `Order` - Customer orders
- `OrderItem` - Products in orders
- `OrderHistory` - Order status tracking

### Inventory
- `Inventory` - Stock levels and reserved quantities
- `InventoryLog` - Inventory change history

### Payments
- `Payment` - Payment transactions (Stripe integration)

### Reviews & Promotions
- `Review` - Product reviews and ratings
- `ReviewImage` - Review images
- `ReviewVote` - Helpful/not helpful votes
- `Coupon` - Discount coupons
- `UserCoupon` - Coupon usage tracking

View complete schema: [prisma/schema.prisma](./prisma/schema.prisma)

For database management, see [docs/QUICK_DATABASE_REFERENCE.md](./docs/QUICK_DATABASE_REFERENCE.md).

## Docker Services

The application uses Docker Compose to run required services:

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Restart services
docker-compose restart

# Remove all volumes (WARNING: deletes all data)
docker-compose down -v
```

### Available Services

- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Caching and session storage

## Environment Variables

Key environment variables (see `.env` file):

```env
# Database
DATABASE_URL="postgresql://moda_user:moda_password@localhost:5432/moda_key_db?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"

# Application
PORT=3000
NODE_ENV="development"
API_PREFIX="api/v1"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

**Important**: Change all secret keys before deploying to production!

## Database Management

### Prisma Studio

Open Prisma Studio (GUI for database):

```bash
npx prisma studio
```

Access at: http://localhost:5555

### Migrations

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply pending migrations
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Performance Features

- **Redis Caching**: Product catalog cached with 10-minute TTL
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: PostgreSQL connection pooling via Prisma
- **Pagination**: Efficient cursor-based and offset pagination
- **Background Jobs**: Async processing with Bull queue

## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT access tokens (15min expiry) and refresh tokens (7 days)
- Role-based access control (RBAC)
- Request validation with class-validator
- Rate limiting and throttling
- CORS configuration
- Helmet security headers
- SQL injection prevention via Prisma

## Upcoming Features

- Email notification system with Bull queue
- Advanced product search with Elasticsearch
- Product image upload and optimization
- Complete coupon/discount system implementation
- Enhanced review moderation tools
- Shipping integration (FedEx, UPS, USPS)
- Wishlist functionality
- Product comparison tool

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Redis Documentation](https://redis.io/documentation)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Swagger/OpenAPI](https://swagger.io/specification/)

## Support

For questions, issues, or contributions, please open an issue on the project repository.

## License

This project is licensed under the MIT License.
