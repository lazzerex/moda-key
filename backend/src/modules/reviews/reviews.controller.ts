import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { VoteReviewDto } from './dto/vote-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new review (requires authentication)' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 409,
    description: 'Review already exists for this product',
  })
  async createReview(@Request() req, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.userId, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your review' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not your review',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  async updateReview(
    @Request() req,
    @Param('id') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(req.user.userId, reviewId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your review (or any review if admin)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not your review and not admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  async deleteReview(@Request() req, @Param('id') reviewId: string) {
    return this.reviewsService.deleteReview(
      req.user.userId,
      req.user.role,
      reviewId,
    );
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote on a review (helpful/not helpful)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  async voteReview(
    @Request() req,
    @Param('id') reviewId: string,
    @Body() dto: VoteReviewDto,
  ) {
    return this.reviewsService.voteReview(req.user.userId, reviewId, dto);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get product reviews with pagination and filters' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated reviews',
  })
  async getProductReviews(
    @Param('productId') productId: string,
    @Query() query: QueryReviewsDto,
  ) {
    return this.reviewsService.getProductReviews(productId, query);
  }

  @Get('product/:productId/rating')
  @ApiOperation({
    summary: 'Get rating aggregation for a product',
  })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns average rating and distribution',
  })
  async getProductRatingAggregation(@Param('productId') productId: string) {
    return this.reviewsService.getProductRatingAggregation(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by ID' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns review details',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  async getReviewById(@Param('id') reviewId: string) {
    return this.reviewsService.getReviewById(reviewId);
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your reviews' })
  @ApiResponse({
    status: 200,
    description: 'Returns all reviews by the authenticated user',
  })
  async getUserReviews(@Request() req) {
    return this.reviewsService.getUserReviews(req.user.userId);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all reviews with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns all reviews (admin only)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin only',
  })
  async getAllReviews(@Query() query: QueryReviewsDto) {
    return this.reviewsService.getAllReviews(query);
  }
}
