import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNumber()
  amount: number; // amount in smallest currency unit (e.g., cents)

  @IsString()
  @IsOptional()
  currency?: string = 'usd';

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
