import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class AssignTrackingDto {
  @ApiProperty({
    description: 'Tracking number',
    example: '1Z999AA10123456784',
  })
  @IsString()
  trackingNumber: string;

  @ApiProperty({
    description: 'Carrier name',
    example: 'UPS',
    required: false,
  })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiProperty({
    description: 'Tracking URL',
    example: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    required: false,
  })
  @IsOptional()
  @IsString()
  trackingUrl?: string;
}
