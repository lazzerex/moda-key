import { IsString, IsNumber, IsOptional, MinLength, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    example: 'Keychron K2 Pro',
    description: 'Product name',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    example: 'keychron-k2-pro',
    description: 'URL-friendly slug',
  })
  @IsString()
  @MinLength(3)
  slug: string;

  @ApiProperty({
    example: 'A mechanical keyboard with wireless capabilities',
    description: 'Detailed product description',
  })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    example: 99.99,
    description: 'Base price',
  })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    example: 'KEY-K2-PRO',
    description: 'Product SKU',
  })
  @IsString()
  sku: string;

  @ApiProperty({
    example: 'brand-id',
    description: 'Brand ID',
  })
  @IsString()
  brandId: string;

  @ApiProperty({
    example: 'category-id',
    description: 'Category ID',
  })
  @IsString()
  categoryId: string;
}

export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
