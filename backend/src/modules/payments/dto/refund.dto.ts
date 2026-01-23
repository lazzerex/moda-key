import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundDto {
  @ApiProperty({
    description: 'Payment ID to refund',
    example: 'clx7k9m0n0000abcdef123456',
  })
  @IsString()
  paymentId: string;

  @ApiPropertyOptional({
    description: 'Refund amount in cents (smallest currency unit). If not provided, full refund will be issued',
    example: 5000,
    minimum: 1,
  })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Customer requested cancellation',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
