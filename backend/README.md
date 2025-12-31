# MODAKey E-Commerce Backend API

Production-grade mechanical keyboard store backend API built with NestJS, Prisma, PostgreSQL, and Redis.

## Description

A comprehensive e-commerce backend system for a mechanical keyboard store featuring JWT authentication, product management with Redis caching, shopping cart functionality, order processing, and role-based access control. Built with modern TypeScript framework and production-ready architecture.

## Features Implemented

- **Authentication & Authorization** - JWT with refresh tokens, role-based access control (CUSTOMER, ADMIN, VENDOR)
- **Products Management** - CRUD operations, product variants, Redis caching, advanced search and filtering
- **Shopping Cart** - Add/update/remove items, stock validation, persistent carts for authenticated users
- **Orders & Payments** - Order creation, tracking, and history (basic structure)
- **Infrastructure** - PostgreSQL database, Redis caching, Bull queue for background jobs, Swagger documentation

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

## API Endpoints Reference

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

## API Testing Guide

### Setting Up for Testing

1. Ensure the application is running:
```bash
docker-compose up -d
npm run start:dev
```

2. The API will be available at `http://localhost:3000/api/v1`

### Testing Authentication Flow

#### 1. Register a New User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response** (201 Created):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx123...",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CUSTOMER"
  }
}
```

#### 2. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
  }'
```

**Save the `accessToken` from the response for subsequent requests.**

#### 3. Get Current User Profile

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Refresh Access Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Testing Product Endpoints

#### 1. List Products with Filters

```bash
# Basic listing with pagination
curl -X GET "http://localhost:3000/api/v1/products?page=1&limit=20"

# With filters
curl -X GET "http://localhost:3000/api/v1/products?minPrice=50&maxPrice=200&search=keyboard"

# Filter by brand or category
curl -X GET "http://localhost:3000/api/v1/products?brandId=BRAND_ID&categoryId=CATEGORY_ID"
```

#### 2. Search Products

```bash
curl -X GET "http://localhost:3000/api/v1/products/search?q=mechanical&limit=10"
```

#### 3. Get Product Details

```bash
curl -X GET http://localhost:3000/api/v1/products/PRODUCT_ID
```

#### 4. Create Product (Admin/Vendor Only)

```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Keychron K2 Pro",
    "slug": "keychron-k2-pro",
    "description": "A premium wireless mechanical keyboard",
    "basePrice": 99.99,
    "sku": "KEY-K2-PRO",
    "brandId": "BRAND_ID",
    "categoryId": "CATEGORY_ID"
  }'
```

#### 5. Create Product Variant

```bash
curl -X POST http://localhost:3000/api/v1/products/PRODUCT_ID/variants \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gateron Brown Switches",
    "sku": "KEY-K2-PRO-GB",
    "price": 99.99,
    "stock": 50,
    "switchType": "Gateron Brown",
    "layout": "75%",
    "color": "Space Gray",
    "connection": "Wireless"
  }'
```

### Testing Shopping Cart

#### 1. Add Item to Cart

```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productVariantId": "VARIANT_ID",
    "quantity": 2
  }'
```

#### 2. Get Cart

```bash
curl -X GET http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response**:
```json
{
  "id": "cart_id",
  "userId": "user_id",
  "items": [
    {
      "id": "item_id",
      "quantity": 2,
      "priceAtAdd": 99.99,
      "productVariant": {
        "id": "variant_id",
        "name": "Gateron Brown Switches",
        "product": {
          "name": "Keychron K2 Pro"
        }
      }
    }
  ],
  "summary": {
    "itemCount": 1,
    "subtotal": 199.98
  }
}
```

#### 3. Update Cart Item Quantity

```bash
curl -X PUT http://localhost:3000/api/v1/cart/items/CART_ITEM_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3
  }'
```

#### 4. Remove Item from Cart

```bash
curl -X DELETE http://localhost:3000/api/v1/cart/items/CART_ITEM_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 5. Clear Cart

```bash
curl -X DELETE http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Testing Order Endpoints

#### 1. Get User Orders

```bash
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 2. Get Order Details

```bash
curl -X GET http://localhost:3000/api/v1/orders/ORDER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Testing Admin Endpoints

**Note**: User must have ADMIN role to access these endpoints.

```bash
curl -X GET http://localhost:3000/api/v1/admin/dashboard \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

### Common HTTP Status Codes

- `200 OK` - Successful GET, PUT, or DELETE request
- `201 Created` - Successful POST request creating a resource
- `204 No Content` - Successful DELETE request with no response body
- `400 Bad Request` - Invalid request data or validation error
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Authenticated but lacking required permissions
- `404 Not Found` - Resource does not exist
- `409 Conflict` - Resource already exists (e.g., duplicate email)
- `500 Internal Server Error` - Server-side error

### Error Response Format

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Project Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/              # Authentication & JWT
│   │   ├── products/          # Products & variants management
│   │   ├── cart/              # Shopping cart operations
│   │   ├── orders/            # Order management
│   │   ├── inventory/         # Stock management
│   │   ├── payments/          # Payment processing
│   │   ├── reviews/           # Product reviews
│   │   └── admin/             # Admin-only endpoints
│   ├── common/
│   │   ├── guards/            # Authentication & authorization guards
│   │   ├── decorators/        # Custom decorators (Roles, etc.)
│   │   ├── filters/           # Exception filters
│   │   └── pipes/             # Validation pipes
│   ├── prisma/                # Database service & client
│   ├── redis/                 # Redis cache service
│   ├── queue/                 # Bull queue configuration
│   ├── config/                # Configuration files
│   ├── app.module.ts          # Root application module
│   └── main.ts                # Application entry point
├── prisma/
│   ├── schema.prisma          # Database schema definition
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
- `Payment` - Payment transactions

### Reviews & Promotions
- `Review` - Product reviews and ratings
- `ReviewImage` - Review images
- `ReviewVote` - Helpful/not helpful votes
- `Coupon` - Discount coupons
- `UserCoupon` - Coupon usage tracking

View complete schema: [prisma/schema.prisma](./prisma/schema.prisma)

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

- Advanced inventory management with concurrency handling
- Complete order processing with database transactions
- Payment gateway integration (Stripe)
- Email notification system
- Comprehensive database seeding script
- Unit and E2E test coverage (80%+)
- Advanced product search with Elasticsearch
- Product image upload functionality
- Coupon and discount system implementation
- Review moderation system

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
