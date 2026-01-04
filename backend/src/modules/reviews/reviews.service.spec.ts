import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { VoteReviewDto, VoteType } from './dto/vote-review.dto';
import { QueryReviewsDto, ReviewSortBy } from './dto/query-reviews.dto';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
    },
    reviewImage: {
      deleteMany: jest.fn(),
    },
    reviewVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CUSTOMER',
  };

  const mockProduct = {
    id: 'product123',
    name: 'Test Keyboard',
    slug: 'test-keyboard',
  };

  const mockReview = {
    id: 'review123',
    productId: 'product123',
    userId: 'user123',
    rating: 5,
    title: 'Great keyboard',
    comment: 'Love it!',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user123',
      firstName: 'John',
      lastName: 'Doe',
    },
    images: [],
    votes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const createDto: CreateReviewDto = {
      productId: 'product123',
      rating: 5,
      title: 'Great keyboard',
      comment: 'Love it!',
    };

    it('should create a review successfully with verified purchase', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findFirst.mockResolvedValue(null);
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'order123',
        status: 'DELIVERED',
      });
      mockPrismaService.review.create.mockResolvedValue(mockReview);

      const result = await service.createReview('user123', createDto);

      expect(result).toEqual(mockReview);
      expect(mockPrismaService.review.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          productId: createDto.productId,
          rating: createDto.rating,
          title: createDto.title,
          comment: createDto.comment,
          isVerified: true,
          images: undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          images: true,
          votes: true,
        },
      });
    });

    it('should create a review without verified purchase', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findFirst.mockResolvedValue(null);
      mockPrismaService.order.findFirst.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue({
        ...mockReview,
        isVerified: false,
      });

      const result = await service.createReview('user123', createDto);

      expect(result.isVerified).toBe(false);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.createReview('user123', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if user already reviewed the product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findFirst.mockResolvedValue(mockReview);

      await expect(service.createReview('user123', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if more than 5 images', async () => {
      const dtoWithImages: CreateReviewDto = {
        ...createDto,
        images: [
          'url1',
          'url2',
          'url3',
          'url4',
          'url5',
          'url6',
        ],
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findFirst.mockResolvedValue(null);

      await expect(
        service.createReview('user123', dtoWithImages),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create review with images', async () => {
      const dtoWithImages: CreateReviewDto = {
        ...createDto,
        images: ['url1', 'url2'],
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findFirst.mockResolvedValue(null);
      mockPrismaService.order.findFirst.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue({
        ...mockReview,
        images: [
          { id: '1', url: 'url1', reviewId: 'review123' },
          { id: '2', url: 'url2', reviewId: 'review123' },
        ],
      });

      const result = await service.createReview('user123', dtoWithImages);

      expect(result.images).toHaveLength(2);
      expect(mockPrismaService.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: {
              create: [{ url: 'url1' }, { url: 'url2' }],
            },
          }),
        }),
      );
    });
  });

  describe('updateReview', () => {
    const updateDto: UpdateReviewDto = {
      rating: 4,
      title: 'Updated title',
      comment: 'Updated comment',
    };

    it('should update review successfully', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.update.mockResolvedValue({
        ...mockReview,
        ...updateDto,
      });

      const result = await service.updateReview(
        'user123',
        'review123',
        updateDto,
      );

      expect(result.rating).toBe(4);
      expect(result.title).toBe('Updated title');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(
        service.updateReview('user123', 'review123', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.updateReview('otherUser', 'review123', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update images if provided', async () => {
      const updateDtoWithImages: UpdateReviewDto = {
        ...updateDto,
        images: ['newUrl1', 'newUrl2'],
      };

      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.reviewImage.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaService.review.update.mockResolvedValue({
        ...mockReview,
        images: [
          { id: '1', url: 'newUrl1', reviewId: 'review123' },
          { id: '2', url: 'newUrl2', reviewId: 'review123' },
        ],
      });

      const result = await service.updateReview(
        'user123',
        'review123',
        updateDtoWithImages,
      );

      expect(mockPrismaService.reviewImage.deleteMany).toHaveBeenCalledWith({
        where: { reviewId: 'review123' },
      });
      expect(result.images).toHaveLength(2);
    });
  });

  describe('deleteReview', () => {
    it('should delete review as owner', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.delete.mockResolvedValue(mockReview);

      const result = await service.deleteReview('user123', 'CUSTOMER', 'review123');

      expect(result.message).toBe('Review deleted successfully');
      expect(mockPrismaService.review.delete).toHaveBeenCalledWith({
        where: { id: 'review123' },
      });
    });

    it('should delete review as admin', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.review.delete.mockResolvedValue(mockReview);

      const result = await service.deleteReview('otherUser', 'ADMIN', 'review123');

      expect(result.message).toBe('Review deleted successfully');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteReview('user123', 'CUSTOMER', 'review123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner and not admin', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.deleteReview('otherUser', 'CUSTOMER', 'review123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('voteReview', () => {
    const voteDto: VoteReviewDto = {
      voteType: VoteType.HELPFUL,
    };

    it('should create a new vote', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.reviewVote.findUnique.mockResolvedValue(null);
      mockPrismaService.reviewVote.create.mockResolvedValue({
        id: 'vote123',
        reviewId: 'review123',
        userId: 'user123',
        voteType: 'HELPFUL',
      });

      const result = await service.voteReview('user123', 'review123', voteDto);

      expect(result).toHaveProperty('voteType');
      expect((result as any).voteType).toBe('HELPFUL');
      expect(mockPrismaService.reviewVote.create).toHaveBeenCalled();
    });

    it('should update existing vote if different', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.reviewVote.findUnique.mockResolvedValue({
        id: 'vote123',
        reviewId: 'review123',
        userId: 'user123',
        voteType: 'NOT_HELPFUL',
      });
      mockPrismaService.reviewVote.update.mockResolvedValue({
        id: 'vote123',
        reviewId: 'review123',
        userId: 'user123',
        voteType: 'HELPFUL',
      });

      const result = await service.voteReview('user123', 'review123', voteDto);

      expect(result).toHaveProperty('voteType');
      expect((result as any).voteType).toBe('HELPFUL');
      expect(mockPrismaService.reviewVote.update).toHaveBeenCalled();
    });

    it('should remove vote if same vote type (toggle)', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);
      mockPrismaService.reviewVote.findUnique.mockResolvedValue({
        id: 'vote123',
        reviewId: 'review123',
        userId: 'user123',
        voteType: 'HELPFUL',
      });
      mockPrismaService.reviewVote.delete.mockResolvedValue({});

      const result = await service.voteReview('user123', 'review123', voteDto);

      expect(result).toHaveProperty('message');
      expect((result as any).message).toBe('Vote removed');
      expect(mockPrismaService.reviewVote.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(
        service.voteReview('user123', 'review123', voteDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductReviews', () => {
    it('should return paginated reviews', async () => {
      const query: QueryReviewsDto = {
        page: 1,
        limit: 10,
      };

      mockPrismaService.review.findMany.mockResolvedValue([mockReview]);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getProductReviews('product123', query);

      expect(result.reviews).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by rating', async () => {
      const query: QueryReviewsDto = {
        page: 1,
        limit: 10,
        rating: 5,
      };

      mockPrismaService.review.findMany.mockResolvedValue([mockReview]);
      mockPrismaService.review.count.mockResolvedValue(1);

      await service.getProductReviews('product123', query);

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rating: 5,
          }),
        }),
      );
    });

    it('should filter verified only', async () => {
      const query: QueryReviewsDto = {
        page: 1,
        limit: 10,
        verifiedOnly: true,
      };

      mockPrismaService.review.findMany.mockResolvedValue([mockReview]);
      mockPrismaService.review.count.mockResolvedValue(1);

      await service.getProductReviews('product123', query);

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isVerified: true,
          }),
        }),
      );
    });

    it('should calculate vote counts', async () => {
      const reviewWithVotes = {
        ...mockReview,
        votes: [
          { voteType: 'HELPFUL' },
          { voteType: 'HELPFUL' },
          { voteType: 'NOT_HELPFUL' },
        ],
      };

      mockPrismaService.review.findMany.mockResolvedValue([reviewWithVotes]);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getProductReviews('product123', {
        page: 1,
        limit: 10,
      });

      expect(result.reviews[0].helpfulCount).toBe(2);
      expect(result.reviews[0].notHelpfulCount).toBe(1);
    });
  });

  describe('getProductRatingAggregation', () => {
    it('should return rating aggregation', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findMany.mockResolvedValue([
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
      ]);

      const result = await service.getProductRatingAggregation('product123');

      expect(result.averageRating).toBe(4.25);
      expect(result.totalReviews).toBe(4);
      expect(result.ratingDistribution[5]).toBe(2);
      expect(result.ratingDistribution[4]).toBe(1);
      expect(result.ratingDistribution[3]).toBe(1);
    });

    it('should return zero values if no reviews', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProductRatingAggregation('product123');

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
      expect(result.ratingDistribution[5]).toBe(0);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.getProductRatingAggregation('product123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReviewById', () => {
    it('should return review by ID', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      const result = await service.getReviewById('review123');

      expect(result.id).toBe('review123');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(service.getReviewById('review123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserReviews', () => {
    it('should return user reviews', async () => {
      const reviewWithProduct = {
        ...mockReview,
        product: {
          id: 'product123',
          name: 'Test Keyboard',
          slug: 'test-keyboard',
        },
      };

      mockPrismaService.review.findMany.mockResolvedValue([reviewWithProduct]);

      const result = await service.getUserReviews('user123');

      expect(result).toHaveLength(1);
      expect(result[0].product.name).toBe('Test Keyboard');
    });
  });
});
