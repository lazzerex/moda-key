# MODAKey - E-Commerce Platform

Complete e-commerce platform for mechanical keyboards built with NestJS backend and Next.js frontend.

## Project Structure

```
moda-key/
├── backend/          # NestJS REST API
│   ├── docs/         # Backend documentation (API, database, payment guides)
│   ├── prisma/       # Database schema and migrations
│   └── src/          # Source code
├── frontend/         # Next.js web application
│   ├── docs/         # Frontend documentation
│   ├── app/          # Next.js app directory
│   └── lib/          # Utilities and API client
├── project-prompt.md # Original project specification
└── todo.md           # Development todo list
```

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker & Docker Compose
- npm or yarn

### Setup Instructions

#### 1. Start Database Services

```bash
cd backend
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379

#### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# Start backend development server
npm run start:dev
```

Backend will be available at:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

#### 3. Setup Frontend

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start frontend development server
npm run dev
```

Frontend will be available at: **http://localhost:3001**

### Stopping Services

```bash
# Stop backend and frontend servers (Ctrl+C in their terminals)

# Stop Docker services
cd backend
docker-compose down
```

## Tech Stack

### Backend
- NestJS 10.x - Progressive Node.js framework
- PostgreSQL 16 - Primary database
- Prisma 7 - Modern ORM
- Redis 7 - Caching layer
- JWT - Authentication
- Bull - Background job processing
- Swagger - API documentation

### Frontend
- Next.js 16 - React framework with App Router
- TypeScript - Type safety
- Tailwind CSS - Styling
- React Hooks - State management

## Features

### Implemented
- ✅ User authentication (register, login, JWT with refresh tokens)
- ✅ Product catalog with variants and Redis caching
- ✅ Shopping cart functionality
- ✅ Order processing with transactions
- ✅ Payment integration (Stripe) with webhook handling
- ✅ Product reviews and ratings system
- ✅ Inventory management with concurrency control
- ✅ Role-based access control (CUSTOMER, ADMIN, VENDOR)
- ✅ Admin panel with analytics and management
- ✅ API documentation (Swagger)
- ✅ Responsive UI with Tailwind CSS

### In Progress
- Order email notifications
- Advanced product search and filtering
- Coupon/discount system
- Product image upload

## Documentation

The project includes comprehensive documentation organized in dedicated `docs/` folders:

### Backend Documentation (backend/docs/)
- [API Quick Reference](backend/docs/API_QUICK_REFERENCE.md) - Complete API endpoint reference
- [Payment Testing Guide](backend/docs/PAYMENT_TESTING_GUIDE.md) - How to test Stripe integration
- [Payment Implementation Summary](backend/docs/PAYMENTS_IMPLEMENTATION_SUMMARY.md) - Payment module details
- [Quick Database Reference](backend/docs/QUICK_DATABASE_REFERENCE.md) - Database commands and queries
- [Admin Implementation Summary](backend/docs/ADMIN_IMPLEMENTATION_SUMMARY.md) - Admin features overview
- [Admin Quick Reference](backend/docs/ADMIN_QUICK_REFERENCE.md) - Admin API endpoints
- [Admin API Documentation](backend/docs/admin-api.md) - Detailed admin API docs
- [Backend Architecture](backend/docs/backend.md) - Architecture and design patterns
- [Database Documentation](backend/docs/database.md) - Database schema and relationships
- [Reviews Implementation](backend/docs/reviews-implementation.md) - Reviews system details

### Frontend Documentation (frontend/docs/)
- [Testing Guide](frontend/docs/TESTING_GUIDE.md) - Frontend testing workflows

For API documentation, visit http://localhost:3000/api/docs when the backend is running.

## Database Schema

The application uses a comprehensive schema with 20+ models including:

- Users & Authentication (User, RefreshToken, UserAddress)
- Product Catalog (Product, ProductVariant, Brand, Category)
- Shopping (Cart, CartItem, Order, OrderItem)
- Inventory Management (Inventory, InventoryLog)
- Payments (Payment)
- Reviews (Review, ReviewImage, ReviewVote)
- Promotions (Coupon, UserCoupon)

View complete schema: `backend/prisma/schema.prisma`

## Development

### Backend Commands

```bash
# Development
npm run start:dev        # Start with hot reload
npm run build            # Build for production
npm run start:prod       # Start production server

# Database
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create migration
npx prisma generate      # Generate Prisma client

# Testing
npm run test            # Unit tests
npm run test:e2e        # E2E tests
```

### Frontend Commands

```bash
npm run dev             # Development server
npm run build           # Production build
npm run start           # Start production server
npm run lint            # Run ESLint
```

## Environment Variables

### Backend (.env)

```env
DATABASE_URL="postgresql://moda_user:moda_password@localhost:5432/moda_key_db"
REDIS_HOST="localhost"
JWT_SECRET="your-secret-key"
PORT=3000
CORS_ORIGIN="http://localhost:3001"
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## Docker Services

The backend uses Docker Compose for services:

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services:
- PostgreSQL (port 5432)
- Redis (port 6379)

## Testing the API

### Register a User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Products

```bash
curl http://localhost:3000/api/v1/products?limit=10
```

## Architecture Highlights

### Backend
- Modular architecture with feature-based modules
- Prisma 7 with PostgreSQL adapter pattern
- Redis caching with 10-minute TTL for products
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Global validation pipes
- Swagger documentation with decorators

### Frontend
- Next.js App Router for modern routing
- TypeScript API client with type safety
- Client-side state management
- Responsive design with Tailwind CSS
- Loading and error states

## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT access tokens (15min) + refresh tokens (7 days)
- Role-based authorization
- Request validation with class-validator
- Rate limiting (100 requests per 60 seconds)
- CORS configuration
- SQL injection prevention via Prisma

## Performance Features

- Redis caching for product catalog
- Database connection pooling
- Efficient pagination (cursor and offset-based)
- Background job processing with Bull
- Database indexes on frequently queried fields

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Swagger API Docs](http://localhost:3000/api/docs)

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
