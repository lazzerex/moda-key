import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ReviewSortBy {
  RECENT = 'RECENT',
  HELPFUL = 'HELPFUL',
  RATING_HIGH = 'RATING_HIGH',
  RATING_LOW = 'RATING_LOW',
}

export class QueryReviewsDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (starts from 1)',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of reviews per page',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 5,
    description: 'Filter by rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    example: 'RECENT',
    description: 'Sort order',
    enum: ReviewSortBy,
  })
  @IsOptional()
  @IsEnum(ReviewSortBy)
  sortBy?: ReviewSortBy = ReviewSortBy.RECENT;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter only verified purchases',
  })
  @IsOptional()
  @Type(() => Boolean)
  verifiedOnly?: boolean;
}
