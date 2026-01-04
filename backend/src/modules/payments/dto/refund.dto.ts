import { IsString, IsNumber, IsOptional } from 'class-validator';

export class RefundDto {
  @IsString()
  paymentId: string;

  @IsNumber()
  @IsOptional()
  amount?: number; // amount in smallest unit (optional for full refund)

  @IsString()
  @IsOptional()
  reason?: string;
}
