import { IsString, IsOptional } from 'class-validator';

export class PaymentResponseDto {
  @IsString()
  clientSecret: string;

  @IsString()
  paymentIntentId: string;

  @IsString()
  status: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
