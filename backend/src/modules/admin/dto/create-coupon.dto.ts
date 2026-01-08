import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({
    description: 'Coupon code (must be unique)',
    example: 'SUMMER2026',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Type of coupon discount',
    enum: CouponType,
    example: CouponType.PERCENTAGE,
  })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({
    description: 'Discount value (percentage 0-100 or fixed amount)',
    example: 20,
  })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({
    description: 'Minimum purchase amount required',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchase?: number;

  @ApiProperty({
    description: 'Maximum discount amount (for percentage coupons)',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiProperty({
    description: 'Coupon start date (ISO 8601)',
    example: '2026-06-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Coupon end date (ISO 8601)',
    example: '2026-08-31T23:59:59Z',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Maximum number of times coupon can be used (null for unlimited)',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @ApiProperty({
    description: 'Whether coupon is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
