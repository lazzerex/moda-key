import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Shipping address ID',
    example: 'clx1234567890',
  })
  @IsString()
  @IsNotEmpty()
  shippingAddressId: string;

  @ApiPropertyOptional({
    description: 'Billing address ID (defaults to shipping address)',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  billingAddressId?: string;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: 'CREDIT_CARD',
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Coupon code to apply',
    example: 'SUMMER20',
  })
  @IsString()
  @IsOptional()
  couponCode?: string;
}
