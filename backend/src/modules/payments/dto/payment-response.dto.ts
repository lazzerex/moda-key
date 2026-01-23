import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Client secret for completing the payment on the frontend',
    example: 'pi_xxx_secret_yyy',
  })
  @IsString()
  clientSecret: string;

  @ApiProperty({
    description: 'Stripe PaymentIntent ID',
    example: 'pi_3OxxxxxxxxxxxxxxxxxxxxXX',
  })
  @IsString()
  paymentIntentId: string;

  @ApiProperty({
    description: 'Current payment intent status',
    example: 'requires_payment_method',
    enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled'],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Additional metadata attached to the payment',
    example: { orderId: 'clx7k9m0n0001abcdef123456' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
