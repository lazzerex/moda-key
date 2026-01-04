import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Reviews E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let productId: string;
  let reviewId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup: Create test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create a test brand
    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand Reviews',
        slug: 'test-brand-reviews',
      },
    });

    // Create a test category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category Reviews',
        slug: 'test-category-reviews',
      },
    });

    // Create a test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Keyboard for Reviews',
        slug: 'test-keyboard-reviews',
        description: 'A test keyboard',
        basePrice: 99.99,
        sku: 'TEST-REVIEWS-001',
        brandId: brand.id,
        categoryId: category.id,
      },
    });
    productId = product.id;

    // Create a test user and get auth token
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reviewtester@example.com',
        password: 'Test123!@#',
        firstName: 'Review',
        lastName: 'Tester',
      });

    authToken = registerResponse.body.accessToken;
    userId = registerResponse.body.user.id;
  }

  async function cleanupTestData() {
    // Delete in correct order due to foreign key constraints
    await prisma.reviewVote.deleteMany({
      where: { review: { userId } },
    });
    await prisma.reviewImage.deleteMany({
      where: { review: { userId } },
    });
    await prisma.review.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: 'reviewtester@example.com' },
    });
    await prisma.product.deleteMany({
      where: { slug: 'test-keyboard-reviews' },
    });
    await prisma.brand.deleteMany({
      where: { slug: 'test-brand-reviews' },
    });
    await prisma.category.deleteMany({
      where: { slug: 'test-category-reviews' },
    });
  }

  describe('POST /reviews - Create Review', () => {
    it('should create a review successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          rating: 5,
          title: 'Excellent keyboard!',
          comment: 'This keyboard is amazing. Highly recommended!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.rating).toBe(5);
      expect(response.body.title).toBe('Excellent keyboard!');
      expect(response.body.isVerified).toBe(false); // No order yet
      expect(response.body.user.id).toBe(userId);

      reviewId = response.body.id;
    });

    it('should fail to create duplicate review', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          rating: 4,
          title: 'Another review',
          comment: 'Test',
        })
        .expect(409);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .send({
          productId,
          rating: 5,
          title: 'Test',
          comment: 'Test',
        })
        .expect(401);
    });

    it('should fail with invalid rating', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          rating: 6, // Invalid
          title: 'Test',
          comment: 'Test',
        })
        .expect(400);
    });
  });

  describe('GET /reviews/product/:productId - Get Product Reviews', () => {
    it('should get product reviews with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reviews/product/${productId}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.reviews).toBeInstanceOf(Array);
      expect(response.body.reviews.length).toBeGreaterThan(0);
      expect(response.body.reviews[0]).toHaveProperty('helpfulCount');
      expect(response.body.reviews[0]).toHaveProperty('notHelpfulCount');
    });

    it('should filter by rating', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reviews/product/${productId}`)
        .query({ rating: 5 })
        .expect(200);

      expect(response.body.reviews.every((r) => r.rating === 5)).toBe(true);
    });
  });

  describe('GET /reviews/product/:productId/rating - Get Rating Aggregation', () => {
    it('should return rating aggregation', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reviews/product/${productId}/rating`)
        .expect(200);

      expect(response.body).toHaveProperty('averageRating');
      expect(response.body).toHaveProperty('totalReviews');
      expect(response.body).toHaveProperty('ratingDistribution');
      expect(response.body.totalReviews).toBeGreaterThan(0);
      expect(response.body.ratingDistribution).toHaveProperty('5');
    });
  });

  describe('PUT /reviews/:id - Update Review', () => {
    it('should update review successfully', async () => {
      const response = await request(app.getHttpServer())
        .put(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rating: 4,
          title: 'Updated title',
          comment: 'Updated comment',
        })
        .expect(200);

      expect(response.body.rating).toBe(4);
      expect(response.body.title).toBe('Updated title');
      expect(response.body.comment).toBe('Updated comment');
    });

    it('should fail to update without authentication', async () => {
      await request(app.getHttpServer())
        .put(`/reviews/${reviewId}`)
        .send({
          rating: 3,
        })
        .expect(401);
    });
  });

  describe('POST /reviews/:id/vote - Vote on Review', () => {
    it('should vote helpful on review', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          voteType: 'HELPFUL',
        })
        .expect(201);

      expect(response.body).toHaveProperty('voteType');
      expect(response.body.voteType).toBe('HELPFUL');
    });

    it('should toggle vote (remove)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          voteType: 'HELPFUL',
        })
        .expect(201);

      expect(response.body.message).toBe('Vote removed');
    });

    it('should vote not helpful', async () => {
      await request(app.getHttpServer())
        .post(`/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          voteType: 'NOT_HELPFUL',
        })
        .expect(201);
    });
  });

  describe('GET /reviews/:id - Get Review by ID', () => {
    it('should get review by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reviews/${reviewId}`)
        .expect(200);

      expect(response.body.id).toBe(reviewId);
      expect(response.body).toHaveProperty('helpfulCount');
      expect(response.body).toHaveProperty('notHelpfulCount');
    });

    it('should return 404 for non-existent review', async () => {
      await request(app.getHttpServer())
        .get('/reviews/nonexistent')
        .expect(404);
    });
  });

  describe('GET /reviews/user/me - Get User Reviews', () => {
    it('should get user reviews', async () => {
      const response = await request(app.getHttpServer())
        .get('/reviews/user/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('product');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/reviews/user/me')
        .expect(401);
    });
  });

  describe('DELETE /reviews/:id - Delete Review', () => {
    it('should delete review successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Review deleted successfully');

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/reviews/${reviewId}`)
        .expect(404);
    });

    it('should fail to delete without authentication', async () => {
      // Create another review first
      const newReview = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          rating: 5,
          title: 'Test',
          comment: 'Test',
        });

      await request(app.getHttpServer())
        .delete(`/reviews/${newReview.body.id}`)
        .expect(401);

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/reviews/${newReview.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });
});
