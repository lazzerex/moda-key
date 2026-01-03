import { PrismaClient, UserRole, ChangeType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma with adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  // Clear existing data (in reverse order of dependencies)
  console.log('Cleaning existing data...');
  await prisma.reviewVote.deleteMany({});
  await prisma.reviewImage.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.userCoupon.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.orderHistory.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.inventoryLog.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.userAddress.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@modakey.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isVerified: true,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
      isVerified: true,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'jane.smith@example.com',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.CUSTOMER,
      isVerified: true,
    },
  });

  const vendor = await prisma.user.create({
    data: {
      email: 'vendor@modakey.com',
      password: hashedPassword,
      firstName: 'Vendor',
      lastName: 'Manager',
      role: UserRole.VENDOR,
      isVerified: true,
    },
  });

  console.log(`Created ${4} users`);

  
  console.log('Seeding addresses...');
  const customer1Address = await prisma.userAddress.create({
    data: {
      userId: customer1.id,
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
      isDefault: true,
    },
  });

  const customer2Address = await prisma.userAddress.create({
    data: {
      userId: customer2.id,
      street: '456 Oak Avenue',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA',
      isDefault: true,
    },
  });

  console.log(`Created ${2} addresses`);

  console.log('Seeding brands...');
  const brands = await Promise.all([
    prisma.brand.create({
      data: {
        name: 'Keychron',
        slug: 'keychron',
        description: 'Wireless mechanical keyboards for Mac, Windows, and Linux',
        logoUrl: 'https://example.com/keychron-logo.png',
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Ducky',
        slug: 'ducky',
        description: 'Premium mechanical keyboards and gaming peripherals',
        logoUrl: 'https://example.com/ducky-logo.png',
      },
    }),
    prisma.brand.create({
      data: {
        name: 'GMMK',
        slug: 'gmmk',
        description: 'Glorious Modular Mechanical Keyboards',
        logoUrl: 'https://example.com/gmmk-logo.png',
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Drop',
        slug: 'drop',
        description: 'Community-driven mechanical keyboards',
        logoUrl: 'https://example.com/drop-logo.png',
      },
    }),
  ]);

  console.log(`Created ${brands.length} brands`);

  
  console.log('Seeding categories...');
  const keyboardsCategory = await prisma.category.create({
    data: {
      name: 'Keyboards',
      slug: 'keyboards',
    },
  });

  const mechanicalCategory = await prisma.category.create({
    data: {
      name: 'Mechanical Keyboards',
      slug: 'mechanical-keyboards',
      parentId: keyboardsCategory.id,
    },
  });

  const wirelessCategory = await prisma.category.create({
    data: {
      name: 'Wireless Keyboards',
      slug: 'wireless-keyboards',
      parentId: keyboardsCategory.id,
    },
  });

  const keycapsCategory = await prisma.category.create({
    data: {
      name: 'Keycaps',
      slug: 'keycaps',
    },
  });

  const switchesCategory = await prisma.category.create({
    data: {
      name: 'Switches',
      slug: 'switches',
    },
  });

  console.log(`Created ${5} categories`);

  
  console.log('Seeding products...');
  const product1 = await prisma.product.create({
    data: {
      name: 'Keychron K2 V2',
      slug: 'keychron-k2-v2',
      description: '75% compact wireless mechanical keyboard with RGB backlight and hot-swappable switches',
      basePrice: 89.99,
      sku: 'KEY-K2-V2',
      brandId: brands[0].id,
      categoryId: mechanicalCategory.id,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Ducky One 3',
      slug: 'ducky-one-3',
      description: 'Full-size mechanical keyboard with premium PBT keycaps and Cherry MX switches',
      basePrice: 139.99,
      sku: 'DUCK-ONE3',
      brandId: brands[1].id,
      categoryId: mechanicalCategory.id,
    },
  });

  const product3 = await prisma.product.create({
    data: {
      name: 'GMMK PRO',
      slug: 'gmmk-pro',
      description: '75% gasket-mounted keyboard with rotary encoder and customizable RGB',
      basePrice: 169.99,
      sku: 'GMMK-PRO',
      brandId: brands[2].id,
      categoryId: mechanicalCategory.id,
    },
  });

  const product4 = await prisma.product.create({
    data: {
      name: 'Drop ALT',
      slug: 'drop-alt',
      description: '65% compact keyboard with aluminum frame and hot-swappable switches',
      basePrice: 149.99,
      sku: 'DROP-ALT',
      brandId: brands[3].id,
      categoryId: mechanicalCategory.id,
    },
  });

  console.log(`Created ${4} products`);

  
  console.log('Seeding product images...');
  await Promise.all([
    prisma.productImage.create({
      data: {
        productId: product1.id,
        url: 'https://example.com/keychron-k2-1.jpg',
        altText: 'Keychron K2 V2 Front View',
        order: 0,
        isMain: true,
      },
    }),
    prisma.productImage.create({
      data: {
        productId: product1.id,
        url: 'https://example.com/keychron-k2-2.jpg',
        altText: 'Keychron K2 V2 Side View',
        order: 1,
        isMain: false,
      },
    }),
    prisma.productImage.create({
      data: {
        productId: product2.id,
        url: 'https://example.com/ducky-one3-1.jpg',
        altText: 'Ducky One 3 Front View',
        order: 0,
        isMain: true,
      },
    }),
    prisma.productImage.create({
      data: {
        productId: product3.id,
        url: 'https://example.com/gmmk-pro-1.jpg',
        altText: 'GMMK PRO Front View',
        order: 0,
        isMain: true,
      },
    }),
    prisma.productImage.create({
      data: {
        productId: product4.id,
        url: 'https://example.com/drop-alt-1.jpg',
        altText: 'Drop ALT Front View',
        order: 0,
        isMain: true,
      },
    }),
  ]);

  console.log(`Created ${5} product images`);

  
  console.log('Seeding product variants...');
  const variant1 = await prisma.productVariant.create({
    data: {
      productId: product1.id,
      name: 'Gateron Brown',
      sku: 'KEY-K2-V2-BROWN',
      price: 89.99,
      stock: 50,
      switchType: 'Gateron Brown',
      layout: '75%',
      color: 'Black',
      connection: 'Wireless/Wired',
      specifications: {
        dimensions: '31.5 x 12.7 x 3.4 cm',
        weight: '680g',
        battery: '4000mAh',
      },
    },
  });

  const variant2 = await prisma.productVariant.create({
    data: {
      productId: product1.id,
      name: 'Gateron Red',
      sku: 'KEY-K2-V2-RED',
      price: 89.99,
      stock: 35,
      switchType: 'Gateron Red',
      layout: '75%',
      color: 'Black',
      connection: 'Wireless/Wired',
      specifications: {
        dimensions: '31.5 x 12.7 x 3.4 cm',
        weight: '680g',
        battery: '4000mAh',
      },
    },
  });

  const variant3 = await prisma.productVariant.create({
    data: {
      productId: product2.id,
      name: 'Cherry MX Brown',
      sku: 'DUCK-ONE3-BROWN',
      price: 139.99,
      stock: 25,
      switchType: 'Cherry MX Brown',
      layout: 'Full Size',
      color: 'White',
      connection: 'Wired',
      specifications: {
        dimensions: '43.6 x 13.2 x 4.1 cm',
        weight: '1100g',
      },
    },
  });

  const variant4 = await prisma.productVariant.create({
    data: {
      productId: product3.id,
      name: 'Glorious Panda',
      sku: 'GMMK-PRO-PANDA',
      price: 169.99,
      stock: 15,
      switchType: 'Glorious Panda',
      layout: '75%',
      color: 'Black',
      connection: 'Wired',
      specifications: {
        dimensions: '32.5 x 13.5 x 3.2 cm',
        weight: '1330g',
        rotaryEncoder: true,
      },
    },
  });

  const variant5 = await prisma.productVariant.create({
    data: {
      productId: product4.id,
      name: 'Halo True',
      sku: 'DROP-ALT-HALO',
      price: 149.99,
      stock: 20,
      switchType: 'Halo True',
      layout: '65%',
      color: 'Space Gray',
      connection: 'Wired',
      specifications: {
        dimensions: '31 x 10.5 x 3 cm',
        weight: '650g',
      },
    },
  });

  console.log(`Created ${5} product variants`);

 
  console.log('Seeding inventory...');
  const [inventory1, inventory2, inventory3, inventory4, inventory5] = await Promise.all([
    prisma.inventory.create({
      data: {
        productVariantId: variant1.id,
        quantity: 50,
        reservedQuantity: 0,
        warehouseLocation: 'A-01-15',
      },
    }),
    prisma.inventory.create({
      data: {
        productVariantId: variant2.id,
        quantity: 35,
        reservedQuantity: 0,
        warehouseLocation: 'A-01-16',
      },
    }),
    prisma.inventory.create({
      data: {
        productVariantId: variant3.id,
        quantity: 25,
        reservedQuantity: 0,
        warehouseLocation: 'A-02-10',
      },
    }),
    prisma.inventory.create({
      data: {
        productVariantId: variant4.id,
        quantity: 15,
        reservedQuantity: 0,
        warehouseLocation: 'B-01-05',
      },
    }),
    prisma.inventory.create({
      data: {
        productVariantId: variant5.id,
        quantity: 20,
        reservedQuantity: 0,
        warehouseLocation: 'B-01-08',
      },
    }),
  ]);

  console.log(`Created ${5} inventory records`);

  
  console.log('Seeding inventory logs...');
  await Promise.all([
    prisma.inventoryLog.create({
      data: {
        variantId: inventory1.id,
        changeType: ChangeType.RESTOCK,
        quantityChange: 50,
        reason: 'Initial stock',
        userId: vendor.id,
      },
    }),
    prisma.inventoryLog.create({
      data: {
        variantId: inventory2.id,
        changeType: ChangeType.RESTOCK,
        quantityChange: 35,
        reason: 'Initial stock',
        userId: vendor.id,
      },
    }),
  ]);

  console.log(`Created inventory logs`);

  
  console.log('Seeding carts...');
  const customer1Cart = await prisma.cart.create({
    data: {
      userId: customer1.id,
    },
  });

  await prisma.cartItem.create({
    data: {
      cartId: customer1Cart.id,
      productVariantId: variant1.id,
      quantity: 1,
      priceAtAdd: 89.99,
    },
  });

  await prisma.cartItem.create({
    data: {
      cartId: customer1Cart.id,
      productVariantId: variant3.id,
      quantity: 1,
      priceAtAdd: 139.99,
    },
  });

  console.log(`Created cart with ${2} items`);

  
  console.log('Seeding orders...');
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-20260101-0001',
      userId: customer2.id,
      status: OrderStatus.DELIVERED,
      subtotal: 169.99,
      tax: 13.60,
      shipping: 10.00,
      discount: 0,
      total: 193.59,
      shippingAddressId: customer2Address.id,
      billingAddressId: customer2Address.id,
      createdAt: new Date('2026-01-01T10:00:00Z'),
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order1.id,
      productVariantId: variant4.id,
      quantity: 1,
      priceAtPurchase: 169.99,
      productSnapshot: {
        productName: 'GMMK PRO',
        variantName: 'Glorious Panda',
        brandName: 'GMMK',
        switchType: 'Glorious Panda',
        layout: '75%',
        color: 'Black',
      },
    },
  });

  await prisma.orderHistory.create({
    data: {
      orderId: order1.id,
      status: OrderStatus.PENDING,
      notes: 'Order placed',
      createdBy: customer2.id,
      createdAt: new Date('2026-01-01T10:00:00Z'),
    },
  });

  await prisma.orderHistory.create({
    data: {
      orderId: order1.id,
      status: OrderStatus.PAID,
      notes: 'Payment received',
      createdAt: new Date('2026-01-01T10:05:00Z'),
    },
  });

  await prisma.orderHistory.create({
    data: {
      orderId: order1.id,
      status: OrderStatus.PROCESSING,
      notes: 'Order is being prepared',
      createdBy: vendor.id,
      createdAt: new Date('2026-01-01T14:00:00Z'),
    },
  });

  await prisma.orderHistory.create({
    data: {
      orderId: order1.id,
      status: OrderStatus.SHIPPED,
      notes: 'Order shipped with tracking number 1Z999AA10123456784',
      createdBy: vendor.id,
      createdAt: new Date('2026-01-02T09:00:00Z'),
    },
  });

  await prisma.orderHistory.create({
    data: {
      orderId: order1.id,
      status: OrderStatus.DELIVERED,
      notes: 'Order delivered',
      createdAt: new Date('2026-01-03T15:30:00Z'),
    },
  });

  console.log(`Created ${1} order with history`);

  
  console.log('Seeding payments...');
  await prisma.payment.create({
    data: {
      orderId: order1.id,
      amount: 193.59,
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.COMPLETED,
      transactionId: 'txn_1234567890abcdef',
      provider: 'Stripe',
      metadata: {
        cardLast4: '4242',
        cardBrand: 'Visa',
      },
    },
  });

  console.log(`Created payment record`);

  
  
  console.log('Seeding reviews...');
  const review1 = await prisma.review.create({
    data: {
      productId: product3.id,
      userId: customer2.id,
      rating: 5,
      title: 'Amazing keyboard!',
      comment: 'The GMMK PRO is absolutely fantastic. The build quality is superb, and the gasket mount makes typing feel amazing. The rotary encoder is a nice touch. Highly recommended!',
      isVerified: true,
      createdAt: new Date('2026-01-03T18:00:00Z'),
    },
  });

  await prisma.reviewImage.create({
    data: {
      reviewId: review1.id,
      url: 'https://example.com/review-gmmk-pro-1.jpg',
    },
  });

  const review2 = await prisma.review.create({
    data: {
      productId: product1.id,
      userId: customer2.id,
      rating: 4,
      title: 'Great value wireless keyboard',
      comment: 'The Keychron K2 is a solid wireless keyboard with good battery life. The Gateron switches feel nice, though not as smooth as Cherry MX. Great for the price!',
      isVerified: false,
      createdAt: new Date('2025-12-28T12:00:00Z'),
    },
  });

  await prisma.reviewVote.create({
    data: {
      reviewId: review1.id,
      userId: customer1.id,
      voteType: 'HELPFUL',
    },
  });

  console.log(`Created ${2} reviews`);

 
  console.log('Seeding coupons...');
  const coupon1 = await prisma.coupon.create({
    data: {
      code: 'WELCOME10',
      type: 'PERCENTAGE',
      value: 10,
      minPurchase: 50,
      maxDiscount: 50,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
    },
  });

  const coupon2 = await prisma.coupon.create({
    data: {
      code: 'SAVE20',
      type: 'FIXED_AMOUNT',
      value: 20,
      minPurchase: 100,
      maxDiscount: null,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T23:59:59Z'),
      usageLimit: 50,
      usedCount: 0,
      isActive: true,
    },
  });

  const coupon3 = await prisma.coupon.create({
    data: {
      code: 'FREESHIP',
      type: 'FREE_SHIPPING',
      value: 0,
      minPurchase: 75,
      maxDiscount: null,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-06-30T23:59:59Z'),
      usageLimit: null,
      usedCount: 0,
      isActive: true,
    },
  });

  console.log(`Created ${3} coupons`);

  
  console.log('\nDatabase seeding completed successfully!\n');
  console.log('Summary:');
  console.log(`   - Users: 4 (1 admin, 2 customers, 1 vendor)`);
  console.log(`   - Addresses: 2`);
  console.log(`   - Brands: ${brands.length}`);
  console.log(`   - Categories: 5`);
  console.log(`   - Products: 4`);
  console.log(`   - Product Variants: 5`);
  console.log(`   - Product Images: 5`);
  console.log(`   - Inventory Records: 5`);
  console.log(`   - Cart with Items: 1`);
  console.log(`   - Orders: 1 (with complete history)`);
  console.log(`   - Payments: 1`);
  console.log(`   - Reviews: 2`);
  console.log(`   - Coupons: 3`);
  console.log('\nTest Credentials:');
  console.log(`   - Admin: admin@modakey.com / password123`);
  console.log(`   - Customer: john.doe@example.com / password123`);
  console.log(`   - Customer: jane.smith@example.com / password123`);
  console.log(`   - Vendor: vendor@modakey.com / password123`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
