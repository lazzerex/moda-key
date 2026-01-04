import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { VoteReviewDto } from './dto/vote-review.dto';
import { QueryReviewsDto, ReviewSortBy } from './dto/query-reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new review with verified purchase check
   */
  async createReview(userId: string, dto: CreateReviewDto) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user has already reviewed this product
    const existingReview = await this.prisma.review.findFirst({
      where: {
        userId,
        productId: dto.productId,
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    // Check if user has purchased this product (verified purchase)
    const hasPurchased = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { in: ['DELIVERED'] },
        items: {
          some: {
            productVariant: {
              productId: dto.productId,
            },
          },
        },
      },
    });

    const isVerified = !!hasPurchased;

    // Validate image count (max 5)
    if (dto.images && dto.images.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed per review');
    }

    // Create review with images
    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        isVerified,
        images: dto.images
          ? {
              create: dto.images.map((url) => ({ url })),
            }
          : undefined,
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

    return review;
  }

  /**
   * Update review - only by review owner
   */
  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    // Validate image count (max 5)
    if (dto.images && dto.images.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed per review');
    }

    // If images are provided, replace existing images
    const updateData: any = {
      ...(dto.rating && { rating: dto.rating }),
      ...(dto.title && { title: dto.title }),
      ...(dto.comment && { comment: dto.comment }),
    };

    if (dto.images) {
      // Delete existing images and create new ones
      await this.prisma.reviewImage.deleteMany({
        where: { reviewId },
      });
      updateData.images = {
        create: dto.images.map((url) => ({ url })),
      };
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: updateData,
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

    return updatedReview;
  }

  /**
   * Delete review - only by owner or admin
   */
  async deleteReview(userId: string, userRole: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user is owner or admin
    if (review.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException(
        'You can only delete your own reviews or be an admin',
      );
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    return { message: 'Review deleted successfully' };
  }

  /**
   * Vote on a review (helpful/not helpful)
   */
  async voteReview(userId: string, reviewId: string, dto: VoteReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user has already voted
    const existingVote = await this.prisma.reviewVote.findUnique({
      where: {
        reviewId_userId: {
          reviewId,
          userId,
        },
      },
    });

    if (existingVote) {
      // Update existing vote if different
      if (existingVote.voteType !== dto.voteType) {
        const updatedVote = await this.prisma.reviewVote.update({
          where: {
            reviewId_userId: {
              reviewId,
              userId,
            },
          },
          data: { voteType: dto.voteType },
        });
        return updatedVote;
      }
      // Same vote type - remove vote (toggle)
      await this.prisma.reviewVote.delete({
        where: {
          reviewId_userId: {
            reviewId,
            userId,
          },
        },
      });
      return { message: 'Vote removed' };
    }

    // Create new vote
    const vote = await this.prisma.reviewVote.create({
      data: {
        userId,
        reviewId,
        voteType: dto.voteType,
      },
    });

    return vote;
  }

  /**
   * Get product reviews with pagination, filtering, and sorting
   */
  async getProductReviews(productId: string, query: QueryReviewsDto) {
    const { page = 1, limit = 10, rating, sortBy, verifiedOnly } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { productId };
    if (rating) {
      where.rating = rating;
    }
    if (verifiedOnly) {
      where.isVerified = true;
    }

    // Build orderBy clause
    let orderBy: any = {};
    switch (sortBy) {
      case ReviewSortBy.RECENT:
        orderBy = { createdAt: 'desc' };
        break;
      case ReviewSortBy.RATING_HIGH:
        orderBy = { rating: 'desc' };
        break;
      case ReviewSortBy.RATING_LOW:
        orderBy = { rating: 'asc' };
        break;
      case ReviewSortBy.HELPFUL:
        // This requires a subquery or computed field - we'll handle it differently
        orderBy = { createdAt: 'desc' }; // Fallback to recent
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
      this.prisma.review.count({ where }),
    ]);

    // Calculate vote counts for each review
    const reviewsWithCounts = reviews.map((review) => {
      const helpfulCount = review.votes.filter(
        (v) => v.voteType === 'HELPFUL',
      ).length;
      const notHelpfulCount = review.votes.filter(
        (v) => v.voteType === 'NOT_HELPFUL',
      ).length;

      return {
        ...review,
        helpfulCount,
        notHelpfulCount,
        votes: undefined, // Don't expose all votes
      };
    });

    // If sorting by helpful, sort in memory
    if (sortBy === ReviewSortBy.HELPFUL) {
      reviewsWithCounts.sort((a, b) => b.helpfulCount - a.helpfulCount);
    }

    return {
      reviews: reviewsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get rating aggregation for a product
   */
  async getProductRatingAggregation(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const reviews = await this.prisma.review.findMany({
      where: { productId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };
    }

    // Calculate average
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = parseFloat((totalRating / reviews.length).toFixed(2));

    // Calculate distribution
    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    return {
      averageRating,
      totalReviews: reviews.length,
      ratingDistribution,
    };
  }

  /**
   * Get a single review by ID
   */
  async getReviewById(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
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

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const helpfulCount = review.votes.filter(
      (v) => v.voteType === 'HELPFUL',
    ).length;
    const notHelpfulCount = review.votes.filter(
      (v) => v.voteType === 'NOT_HELPFUL',
    ).length;

    return {
      ...review,
      helpfulCount,
      notHelpfulCount,
      votes: undefined,
    };
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: true,
        votes: true,
      },
    });

    return reviews.map((review) => {
      const helpfulCount = review.votes.filter(
        (v) => v.voteType === 'HELPFUL',
      ).length;
      const notHelpfulCount = review.votes.filter(
        (v) => v.voteType === 'NOT_HELPFUL',
      ).length;

      return {
        ...review,
        helpfulCount,
        notHelpfulCount,
        votes: undefined,
      };
    });
  }

  /**
   * Admin: Get all reviews with moderation info
   */
  async getAllReviews(query: QueryReviewsDto) {
    const { page = 1, limit = 10, rating } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (rating) {
      where.rating = rating;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: true,
          votes: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const reviewsWithCounts = reviews.map((review) => {
      const helpfulCount = review.votes.filter(
        (v) => v.voteType === 'HELPFUL',
      ).length;
      const notHelpfulCount = review.votes.filter(
        (v) => v.voteType === 'NOT_HELPFUL',
      ).length;

      return {
        ...review,
        helpfulCount,
        notHelpfulCount,
      };
    });

    return {
      reviews: reviewsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
