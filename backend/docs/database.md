# Database Management Guide

Complete guide for database setup, management, seeding, and monitoring for the MODAKey e-commerce platform.

## Table of Contents

1. [Database Overview](#database-overview)
2. [Quick Start](#quick-start)
3. [Database Management](#database-management)
4. [Seeding Guide](#seeding-guide)
5. [Monitoring & Inspection](#monitoring--inspection)
6. [Migrations](#migrations)
7. [Backup & Restore](#backup--restore)
8. [Troubleshooting](#troubleshooting)

---

## Database Overview

### Technology Stack

- **Database**: PostgreSQL 16
- **ORM**: Prisma 7.2.0
- **Container**: Docker Compose
- **Tools**: Prisma Studio, psql CLI

### Database Schema

The database includes the following domain models:

#### User Management
- **users** - User accounts with roles (CUSTOMER, ADMIN, VENDOR)
- **refresh_tokens** - JWT refresh token storage
- **user_addresses** - Shipping and billing addresses

#### Product Catalog
- **brands** - Keyboard manufacturers
- **categories** - Hierarchical product categories
- **products** - Base product information
- **product_variants** - Product variations (switches, colors, layouts)
- **product_images** - Product image gallery

#### Inventory Management
- **inventory** - Stock levels and warehouse locations
- **inventory_logs** - Audit trail of inventory changes

#### Shopping & Orders
- **carts** - Shopping carts (user and guest sessions)
- **cart_items** - Items in shopping carts
- **orders** - Customer orders
- **order_items** - Products in orders with snapshots
- **order_history** - Order status timeline

#### Payments
- **payments** - Payment transactions and status

#### Reviews & Ratings
- **reviews** - Product reviews with ratings
- **review_images** - Review photos
- **review_votes** - Helpful/not helpful votes

#### Promotions
- **coupons** - Discount codes
- **user_coupons** - Coupon usage tracking

---

## Quick Start

### 1. Start Database
```bash
# Start PostgreSQL and Redis containers
docker-compose up -d

# Verify containers are running
docker-compose ps
```

### 2. Run Migrations
```bash
# Apply database schema
npx prisma migrate dev
```

### 3. Seed Database
```bash
# Populate with sample data
npm run db:seed
```

### 4. Verify Setup
```bash
# Open Prisma Studio
npx prisma studio
```

---

## Database Management

### Using Prisma Studio (GUI)

Prisma Studio provides a web-based GUI for viewing and editing database records.

```bash
# Start Prisma Studio
npx prisma studio
```

Access at: `http://localhost:5555`

**Features:**
- Browse all tables
- View/edit/delete records
- Filter and search data
- View relationships
- Export data

### Using psql (CLI)

Connect directly to PostgreSQL:

```bash
# Connect to database
docker exec -it backend-postgres-1 psql -U postgres -d modakey

# Or from host (if PostgreSQL client installed)
psql postgresql://postgres:postgres@localhost:5432/modakey
```

**Common psql Commands:**
```sql
-- List all tables
\dt

-- Describe table structure
\d users

-- View table with relationships
\d+ products

-- List all schemas
\dn

-- Exit psql
\q
```

### Database Queries

#### Check Record Counts
```sql
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL
SELECT 'coupons', COUNT(*) FROM coupons;
```

#### View Users by Role
```sql
SELECT id, email, "firstName", "lastName", role, "isVerified"
FROM users
ORDER BY role, email;
```

#### Check Inventory Levels
```sql
SELECT 
  pv.name as variant,
  p.name as product,
  i.quantity,
  i."reservedQuantity",
  (i.quantity - i."reservedQuantity") as available,
  i."warehouseLocation"
FROM inventory i
JOIN product_variants pv ON pv.id = i."productVariantId"
JOIN products p ON p.id = pv."productId"
ORDER BY available;
```

#### View Recent Orders
```sql
SELECT 
  o."orderNumber",
  u.email as customer,
  o.status,
  o.total,
  o."createdAt"
FROM orders o
JOIN users u ON u.id = o."userId"
ORDER BY o."createdAt" DESC
LIMIT 10;
```

#### Product Reviews Summary
```sql
SELECT 
  p.name as product,
  COUNT(r.id) as review_count,
  ROUND(AVG(r.rating), 2) as avg_rating,
  COUNT(CASE WHEN r."isVerified" THEN 1 END) as verified_reviews
FROM products p
LEFT JOIN reviews r ON r."productId" = p.id
GROUP BY p.id, p.name
ORDER BY avg_rating DESC NULLS LAST;
```

### Database Performance

#### View Table Sizes
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;
```

#### Check Active Connections
```sql
SELECT 
  datname,
  COUNT(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

#### View Slow Queries (if pg_stat_statements enabled)
```sql
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Seeding Guide

### Overview

The seed script populates the database with realistic sample data for development and testing.

### What Gets Seeded

#### Users (4 total)
| Role | Email | Password | Verified |
|------|-------|----------|----------|
| Admin | admin@modakey.com | password123 | ✅ Yes |
| Customer | john.doe@example.com | password123 | ✅ Yes |
| Customer | jane.smith@example.com | password123 | ✅ Yes |
| Vendor | vendor@modakey.com | password123 | ✅ Yes |

#### Product Catalog
- **4 Brands**: Keychron, Ducky, GMMK, Drop
- **5 Categories**: Keyboards (parent), Mechanical Keyboards, Wireless Keyboards, Keycaps, Switches
- **4 Products**: Premium mechanical keyboards
- **5 Product Variants**: Different switches (Gateron Brown/Red, Cherry MX Brown, Glorious Panda, Halo True)
- **5 Product Images**: Main and additional images for products
- **Specifications**: Layout sizes (60%, 65%, 75%, Full), colors, connection types

#### Inventory
- **5 Inventory Records**: 15-50 units per variant
- **Warehouse Locations**: A-01-15, A-01-16, A-02-10, B-01-05, B-01-08
- **Inventory Logs**: Initial restock records

#### Sample Data
- **2 Addresses**: Customer shipping/billing addresses
- **1 Shopping Cart**: John Doe's cart with 2 items
- **1 Completed Order**: Jane Smith's order with full lifecycle
  - Status progression: PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
  - Complete order history with timestamps
  - Payment record with transaction ID
- **2 Product Reviews**: 4-5 star ratings with detailed comments
- **3 Active Coupons**:
  - `WELCOME10`: 10% off (min $50 purchase, max $50 discount)
  - `SAVE20`: $20 off (min $100 purchase)
  - `FREESHIP`: Free shipping (min $75 purchase)

### Running the Seed Script

#### Seed Database (Preserves Existing Data)
```bash
npm run db:seed
```

Or using Prisma directly:
```bash
npx prisma db seed
```

**Note:** The seed script clears existing data before seeding to avoid conflicts.

#### Reset and Reseed (Fresh Start)
```bash
npm run db:reset
```

This command will:
1. Drop all tables
2. Recreate tables from migrations
3. Run the seed script automatically

**⚠️ Warning:** This deletes ALL data in your database!

#### Manual Approach
```bash
# Drop and recreate database
npx prisma migrate reset --force

# Generate Prisma client
npx prisma generate

# Run seed
npm run db:seed
```

### Seed Script Implementation

**Location:** `prisma/seed.ts`

The script uses TypeScript with Prisma Client and includes:

- **Data Integrity**: Cleans existing data in correct order (respecting foreign keys)
- **Realistic Data**: Real product descriptions, proper price calculations, timestamp progression
- **Password Security**: bcrypt hashing for all user passwords
- **Error Handling**: Proper exit codes and error messages
- **Console Output**: Clear progress indicators with emojis
- **Summary Statistics**: Shows what was created at the end

### Customizing Seed Data

Edit `prisma/seed.ts` to modify:

1. **Add More Products**
```typescript
const newProduct = await prisma.product.create({
  data: {
    name: 'Your Keyboard',
    slug: 'your-keyboard',
    description: 'Description here',
    basePrice: 99.99,
    sku: 'YOUR-SKU',
    brandId: brands[0].id,
    categoryId: mechanicalCategory.id,
  },
});
```

2. **Add More Users**
```typescript
const newUser = await prisma.user.create({
  data: {
    email: 'user@example.com',
    password: await bcrypt.hash('password123', 10),
    firstName: 'First',
    lastName: 'Last',
    role: UserRole.CUSTOMER,
    isVerified: true,
  },
});
```

3. **Modify Stock Levels**
```typescript
// In the variant creation section
stock: 100, // Change from default 50
```

4. **Add More Coupons**
```typescript
await prisma.coupon.create({
  data: {
    code: 'NEWCOUPON',
    type: 'PERCENTAGE',
    value: 15,
    minPurchase: 0,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
  },
});
```

After making changes:
```bash
npm run db:reset  # Or just db:seed if you don't need fresh start
```

### Seed Data Summary

```
📊 Total Records Created:
   - Users:              4
   - Addresses:          2
   - Brands:             4
   - Categories:         5 (hierarchical)
   - Products:           4
   - Product Variants:   5
   - Product Images:     5
   - Inventory Records:  5
   - Inventory Logs:     2
   - Carts:              1
   - Cart Items:         2
   - Orders:             1
   - Order Items:        1
   - Order History:      5
   - Payments:           1
   - Reviews:            2
   - Review Images:      1
   - Review Votes:       1
   - Coupons:            3
```

### Testing Scenarios Enabled

With the seeded data, you can immediately test:

1. **Authentication**
   - Login with different roles (admin, customer, vendor)
   - Test role-based access control
   - Refresh token flow

2. **Product Catalog**
   - Browse products by brand/category
   - View product variants and specifications
   - Search and filter products

3. **Shopping Cart**
   - John's pre-populated cart
   - Add/remove items
   - Update quantities
   - Stock validation

4. **Orders**
   - View Jane's completed order
   - Order history timeline
   - Payment details
   - Order status transitions

5. **Inventory Management**
   - Check stock levels
   - View inventory logs
   - Test reservation/release flow
   - Concurrency control

6. **Reviews**
   - View product ratings
   - Read review comments
   - Vote helpful/not helpful

7. **Promotions**
   - Apply coupon codes
   - Validate coupon rules
   - Test discount calculations

---

## Monitoring & Inspection

### Docker Container Management

#### Check Container Status
```bash
# View running containers
docker-compose ps

# View container logs
docker-compose logs postgres
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f postgres
```

#### Container Resource Usage
```bash
# View resource usage
docker stats backend-postgres-1
```

#### Restart Containers
```bash
# Restart specific service
docker-compose restart postgres

# Restart all services
docker-compose restart
```

### Database Health Checks

#### Connection Test
```bash
# Test database connection
docker exec backend-postgres-1 pg_isready -U postgres
```

#### Database Size
```sql
SELECT 
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'modakey';
```

#### Current Activity
```sql
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query,
  query_start
FROM pg_stat_activity
WHERE datname = 'modakey'
ORDER BY query_start DESC;
```

### Prisma Client Management

#### Generate Client
```bash
# Generate after schema changes
npx prisma generate
```

#### Format Schema
```bash
# Format schema.prisma file
npx prisma format
```

#### Validate Schema
```bash
# Check for schema errors
npx prisma validate
```

---

## Migrations

### Creating Migrations

#### After Schema Changes
```bash
# Create and apply migration
npx prisma migrate dev --name describe_your_change
```

Example migration names:
- `add_user_phone_field`
- `create_wishlist_table`
- `add_product_rating_index`
- `update_order_status_enum`

#### Migration Files

Migrations are stored in: `prisma/migrations/`

Each migration includes:
- `migration.sql` - SQL commands
- Timestamp-based folder naming

### Applying Migrations

#### Development
```bash
# Apply pending migrations
npx prisma migrate dev
```

#### Production
```bash
# Apply migrations (no prompts)
npx prisma migrate deploy
```

#### Check Migration Status
```bash
# View migration status
npx prisma migrate status
```

### Migration Operations

#### View Migration History
```sql
SELECT * FROM _prisma_migrations
ORDER BY finished_at DESC;
```

#### Resolve Failed Migration
```bash
# Mark migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Or mark as applied
npx prisma migrate resolve --applied MIGRATION_NAME
```

#### Reset Migrations
```bash
# ⚠️ Deletes all data and reapplies migrations
npx prisma migrate reset
```

### Best Practices

1. **Always Create Named Migrations**
   ```bash
   npx prisma migrate dev --name add_feature_x
   ```

2. **Review Generated SQL**
   - Check `migrations/[timestamp]_[name]/migration.sql`
   - Verify it matches your intentions

3. **Test Migrations Locally First**
   ```bash
   # Test on local database copy
   npm run db:reset
   npx prisma migrate dev
   npm run db:seed
   ```

4. **Backup Before Production Migration**
   ```bash
   # Create backup first
   docker exec backend-postgres-1 pg_dump -U postgres modakey > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Then deploy
   npx prisma migrate deploy
   ```

---

## Backup & Restore

### Manual Backup

#### Full Database Backup
```bash
# Backup to file
docker exec backend-postgres-1 pg_dump -U postgres modakey > backup_$(date +%Y%m%d_%H%M%S).sql

# Or with compression
docker exec backend-postgres-1 pg_dump -U postgres modakey | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Backup Specific Tables
```bash
# Backup only products and related tables
docker exec backend-postgres-1 pg_dump -U postgres -t products -t product_variants -t product_images modakey > products_backup.sql
```

#### Backup Schema Only
```bash
# Structure without data
docker exec backend-postgres-1 pg_dump -U postgres --schema-only modakey > schema_backup.sql
```

### Restore from Backup

#### Restore Full Database
```bash
# Stop application first
docker-compose stop backend

# Drop and recreate database
docker exec -i backend-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS modakey;"
docker exec -i backend-postgres-1 psql -U postgres -c "CREATE DATABASE modakey;"

# Restore from backup
docker exec -i backend-postgres-1 psql -U postgres modakey < backup_20260103_120000.sql

# Or from compressed backup
gunzip -c backup_20260103_120000.sql.gz | docker exec -i backend-postgres-1 psql -U postgres modakey

# Restart application
docker-compose start backend
```

#### Restore Specific Tables
```bash
# Restore only specific tables
docker exec -i backend-postgres-1 psql -U postgres modakey < products_backup.sql
```

### Automated Backup Script

Create `backup.sh`:
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/modakey_$DATE.sql.gz"
CONTAINER="backend-postgres-1"
DB_USER="postgres"
DB_NAME="modakey"
KEEP_DAYS=7

# Create backup
echo "Creating backup: $BACKUP_FILE"
docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Remove old backups
echo "Removing backups older than $KEEP_DAYS days"
find $BACKUP_DIR -name "modakey_*.sql.gz" -mtime +$KEEP_DAYS -delete

echo "Backup completed: $BACKUP_FILE"
```

Make executable and run:
```bash
chmod +x backup.sh
./backup.sh
```

### Backup to Remote Storage

#### AWS S3
```bash
# Install AWS CLI first
# aws configure

# Backup and upload
docker exec backend-postgres-1 pg_dump -U postgres modakey | gzip | aws s3 cp - s3://your-bucket/backups/modakey_$(date +%Y%m%d).sql.gz
```

---

## Troubleshooting

### Common Issues

#### 1. Cannot Connect to Database

**Symptoms:**
```
Error: Can't reach database server at `localhost:5432`
```

**Solutions:**
```bash
# Check if container is running
docker-compose ps

# Start containers if stopped
docker-compose up -d

# Check container logs
docker-compose logs postgres

# Restart containers
docker-compose restart postgres
```

#### 2. Prisma Client Not Generated

**Symptoms:**
```
Cannot find module '@prisma/client'
```

**Solutions:**
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

#### 3. Migration Conflicts

**Symptoms:**
```
Error: P3006
Migration `20260101_name` failed to apply cleanly
```

**Solutions:**
```bash
# View migration status
npx prisma migrate status

# Reset migrations (⚠️ deletes data)
npx prisma migrate reset

# Or resolve specific migration
npx prisma migrate resolve --rolled-back 20260101_name
```

#### 4. Seed Script Fails

**Symptoms:**
```
P2002: Unique constraint failed on the fields: (`email`)
```

**Solutions:**
```bash
# Reset database and reseed
npm run db:reset

# Or manually clean and reseed
docker exec -i backend-postgres-1 psql -U postgres -c "DROP DATABASE modakey;"
docker exec -i backend-postgres-1 psql -U postgres -c "CREATE DATABASE modakey;"
npx prisma migrate dev
npm run db:seed
```

#### 5. Port Already in Use

**Symptoms:**
```
Error: Port 5432 is already allocated
```

**Solutions:**
```bash
# Find process using port
lsof -i :5432

# Kill process (if safe)
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "5433:5432"  # Host:Container
```

#### 6. Out of Disk Space

**Symptoms:**
```
ERROR: could not extend file: No space left on device
```

**Solutions:**
```bash
# Check disk usage
df -h

# Clean Docker system
docker system prune -a

# Clean old backups
find /path/to/backups -mtime +30 -delete

# Vacuum database
docker exec -i backend-postgres-1 psql -U postgres modakey -c "VACUUM FULL;"
```

### Database Connection Issues

#### Check Environment Variables
```bash
# View current DATABASE_URL
cat .env | grep DATABASE_URL

# Test connection string
docker exec -i backend-postgres-1 psql "postgresql://postgres:postgres@localhost:5432/modakey" -c "SELECT version();"
```

#### Connection Pooling
If experiencing connection issues:

```typescript
// In prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool settings
  // postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=10
}
```

### Performance Issues

#### Slow Queries

1. **Enable Query Logging**
```typescript
// In main.ts or service
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

2. **Add Indexes**
```prisma
model Product {
  name String
  basePrice Float
  
  @@index([name])
  @@index([basePrice])
}
```

3. **Use Query Optimization**
```typescript
// Include only needed fields
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    basePrice: true,
  },
});
```

### Getting Help

#### Prisma Documentation
- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

#### Check Logs
```bash
# Application logs
npm run start:dev

# Database logs
docker-compose logs -f postgres

# Container status
docker-compose ps
```

#### Database Status
```sql
-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Check for long-running queries
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
AND now() - query_start > interval '5 minutes';
```

---

## Production Considerations

### Security

1. **Never use default passwords in production**
   ```env
   # Use strong, unique passwords
   DATABASE_URL="postgresql://user:STRONG_PASSWORD@host:5432/modakey"
   ```

2. **Restrict database access**
   - Use firewall rules
   - Enable SSL/TLS connections
   - Limit connection sources

3. **Don't run seed script in production**
   ```bash
   # Remove from production package.json or use NODE_ENV check
   if (process.env.NODE_ENV === 'production') {
     throw new Error('Cannot seed production database');
   }
   ```

### Monitoring

1. **Set up database monitoring**
   - CloudWatch (AWS)
   - DataDog
   - New Relic
   - Prometheus + Grafana

2. **Configure alerts**
   - Connection pool exhaustion
   - Slow queries (> 1 second)
   - High disk usage (> 80%)
   - Failed backups

3. **Enable query logging**
   - Log slow queries
   - Monitor query patterns
   - Identify N+1 problems

### Scaling

1. **Connection pooling**
   ```typescript
   // Use PgBouncer or Prisma Data Proxy
   DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"
   ```

2. **Read replicas**
   - Configure read-only replicas
   - Route read queries to replicas
   - Use Prisma's replica support

3. **Database optimization**
   - Regular VACUUM
   - Index optimization
   - Query optimization
   - Partition large tables

---

## Quick Reference

### Essential Commands

```bash
# Start/Stop
docker-compose up -d              # Start containers
docker-compose down               # Stop containers
docker-compose restart            # Restart all services

# Migrations
npx prisma migrate dev            # Create and apply migration
npx prisma migrate deploy         # Deploy to production
npx prisma migrate status         # Check migration status

# Seeding
npm run db:seed                   # Seed database
npm run db:reset                  # Reset and reseed

# Tools
npx prisma studio                 # Open GUI
npx prisma generate               # Generate client
npx prisma format                 # Format schema
npx prisma validate               # Validate schema

# Backup
docker exec backend-postgres-1 pg_dump -U postgres modakey > backup.sql

# Restore
docker exec -i backend-postgres-1 psql -U postgres modakey < backup.sql
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@modakey.com | password123 |
| Customer | john.doe@example.com | password123 |
| Customer | jane.smith@example.com | password123 |
| Vendor | vendor@modakey.com | password123 |

### Active Coupons

| Code | Type | Value | Min Purchase |
|------|------|-------|--------------|
| WELCOME10 | Percentage | 10% | $50 |
| SAVE20 | Fixed Amount | $20 | $100 |
| FREESHIP | Free Shipping | N/A | $75 |

---

## Next Steps

1. **Start Development**
   ```bash
   npm run start:dev
   ```

2. **Explore API**
   - Swagger Docs: http://localhost:3000/api/docs
   - Test endpoints with seeded data

3. **Monitor Database**
   ```bash
   npx prisma studio
   ```

4. **Set Up Backups**
   - Create backup script
   - Schedule regular backups
   - Test restore procedure

5. **Optimize Queries**
   - Enable query logging
   - Monitor slow queries
   - Add indexes as needed
