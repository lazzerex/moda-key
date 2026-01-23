import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order ID to create payment for',
    example: 'clx7k9m0n0001abcdef123456',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Payment amount in smallest currency unit (e.g., cents for USD)',
    example: 9999,
    minimum: 1,
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: 'Three-letter ISO currency code (lowercase)',
    example: 'usd',
    default: 'usd',
  })
  @IsString()
  @IsOptional()
  currency?: string = 'usd';

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate payment creation. Cached for 24 hours.',
    example: 'idem_12345_67890',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata to attach to the payment',
    example: { source: 'web', customerNote: 'Rush delivery' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
