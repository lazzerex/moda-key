import { IsString, IsInt, Min, Max, MaxLength, IsOptional, IsArray, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({
    example: 'clxy123456789',
    description: 'Product ID to review',
  })
  @IsString()
  productId: string;

  @ApiProperty({
    example: 5,
    description: 'Rating from 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    example: 'Amazing keyboard!',
    description: 'Review title',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    example: 'This keyboard exceeded my expectations. The switches are smooth and the build quality is excellent.',
    description: 'Review comment',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  comment: string;

  @ApiPropertyOptional({
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    description: 'Optional array of image URLs (max 5)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
