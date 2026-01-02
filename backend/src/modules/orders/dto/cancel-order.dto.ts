import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'Changed my mind',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
