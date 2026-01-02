import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Inventory Concurrency E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let productVariantId: string;
  let shippingAddressId: string;
  
  // Track created resources for cleanup
  let testBrandIds: string[] = [];
  let testCategoryIds: string[] = [];
  let testProductIds: string[] = [];
  let testUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Set global prefix like in main.ts
    app.setGlobalPrefix('api/v1');
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test data
    for (const id of testProductIds) {
      await prisma.product.deleteMany({ where: { id } }).catch(() => {});
    }
    for (const id of testBrandIds) {
      await prisma.brand.deleteMany({ where: { id } }).catch(() => {});
    }
    for (const id of testCategoryIds) {
      await prisma.category.deleteMany({ where: { id } }).catch(() => {});
    }
    
    await app.close();
  });

  describe('Concurrent Order Creation - Prevent Overselling', () => {
    beforeEach(async () => {
      // Setup: Create test data with unique identifiers
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      
      // 1. Create a brand
      const brand = await prisma.brand.create({
        data: {
          name: `Test Brand ${timestamp}-${random}`,
          slug: `test-brand-${timestamp}-${random}`,
        },
      });
      testBrandIds.push(brand.id);

      // 2. Create a category
      const category = await prisma.category.create({
        data: {
          name: `Test Category ${timestamp}-${random}`,
          slug: `test-category-${timestamp}-${random}`,
        },
      });
      testCategoryIds.push(category.id);

      // 3. Create a product
      const product = await prisma.product.create({
        data: {
          name: `Test Keyboard ${timestamp}-${random}`,
          slug: `test-keyboard-${timestamp}-${random}`,
          description: 'Test keyboard for concurrent testing',
          basePrice: 100,
          sku: `TEST-SKU-${timestamp}-${random}`,
          brandId: brand.id,
          categoryId: category.id,
        },
      });
      testProductIds.push(product.id);

      // 4. Create a variant with only 1 stock
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: 'Blue Switch',
          sku: `TEST-VARIANT-SKU-${timestamp}-${random}`,
          price: 100,
          stock: 1,
          switchType: 'Blue',
          layout: '75%',
        },
      });

      productVariantId = variant.id;

      // 5. Create inventory with only 1 item
      await prisma.inventory.create({
        data: {
          productVariantId: variant.id,
          quantity: 1,
          reservedQuantity: 0,
        },
      });

      // 6. Register a user and get token
      const userEmail = `concurrent-test-${timestamp}-${random}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: userEmail,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      // Extract token and user ID from registration response
      authToken = registerResponse.body.accessToken;
      userId = registerResponse.body.user.id;
      testUserIds.push(userId);

      // 7. Create a shipping address
      const address = await prisma.userAddress.create({
        data: {
          userId,
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US',
          isDefault: true,
        },
      });

      shippingAddressId = address.id;

      // 8. Add item to cart
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productVariantId,
          quantity: 1,
        })
        .expect(201);
    });

    it('should prevent overselling when 10 concurrent requests try to buy the last item', async () => {
      // Create 9 additional users who will also try to buy
      const additionalUsers: Array<{
        token: string;
        userId: string;
        addressId: string;
      }> = [];
      
      const timestamp = Date.now();
      
      for (let i = 0; i < 9; i++) {
        const email = `concurrent-user-${i}-${timestamp}-${Math.random().toString(36).substring(7)}@example.com`;
        
        // Register and get token directly
        const registerResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email,
            password: 'Password123!',
            firstName: 'Concurrent',
            lastName: `User${i}`,
          })
          .expect(201);

        const token = registerResponse.body.accessToken;
        const uid = registerResponse.body.user.id;
        testUserIds.push(uid);

        // Create address
        const addr = await prisma.userAddress.create({
          data: {
            userId: uid,
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US',
          },
        });

        // Add to cart
        await request(app.getHttpServer())
          .post('/api/v1/cart/items')
          .set('Authorization', `Bearer ${token}`)
          .send({
            productVariantId,
            quantity: 1,
          });

        additionalUsers.push({
          token,
          userId: uid,
          addressId: addr.id,
        });
      }

      // Execute: 10 concurrent order creation requests
      const allUsers = [
        { token: authToken, addressId: shippingAddressId },
        ...additionalUsers.map(u => ({ token: u.token, addressId: u.addressId })),
      ];

      const orderPromises = allUsers.map(user =>
        request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            shippingAddressId: user.addressId,
            paymentMethod: 'CREDIT_CARD',
          })
          .then(res => ({ status: res.status, body: res.body }))
          .catch(err => ({ 
            status: err.response?.status || 500, 
            body: err.response?.body 
          }))
      );

      const results = await Promise.all(orderPromises);

      // Assert: Only 1 should succeed (201), 9 should fail (409 or 400)
      const successful = results.filter(r => r.status === 201);
      const failed = results.filter(r => r.status >= 400);

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(9);

      // Verify inventory state
      const inventory = await prisma.inventory.findUnique({
        where: { productVariantId },
      });

      // After one successful order, we should have:
      // - quantity: 1 (unchanged until payment confirmed)
      // - reservedQuantity: 1 (reserved for the successful order)
      expect(inventory!.quantity).toBe(1);
      expect(inventory!.reservedQuantity).toBe(1);

      // Available stock should be 0
      const availableStock = inventory!.quantity - inventory!.reservedQuantity;
      expect(availableStock).toBe(0);
    }, 30000); // 30 second timeout for this test

    it('should allow order cancellation and release inventory', async () => {
      // Create an order
      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shippingAddressId,
          paymentMethod: 'CREDIT_CARD',
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Verify inventory is reserved
      let inventory = await prisma.inventory.findUnique({
        where: { productVariantId },
      });
      expect(inventory!.reservedQuantity).toBe(1);

      // Cancel the order
      await request(app.getHttpServer())
        .put(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed my mind',
        })
        .expect(200);

      // Verify inventory is released
      inventory = await prisma.inventory.findUnique({
        where: { productVariantId },
      });
      expect(inventory!.reservedQuantity).toBe(0);

      // Available stock should be back to 1
      const availableStock = inventory!.quantity - inventory!.reservedQuantity;
      expect(availableStock).toBe(1);
    });
  });
});
