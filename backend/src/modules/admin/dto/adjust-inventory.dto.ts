import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ChangeType } from '@prisma/client';

export class AdjustInventoryDto {
  @ApiProperty({
    description: 'Product variant ID',
    example: 'clx1234567890',
  })
  @IsString()
  variantId: string;

  @ApiProperty({
    description: 'Quantity change (positive for increase, negative for decrease)',
    example: 100,
  })
  @IsInt()
  quantityChange: number;

  @ApiProperty({
    description: 'Type of inventory change',
    enum: ChangeType,
    example: ChangeType.RESTOCK,
  })
  @IsEnum(ChangeType)
  changeType: ChangeType;

  @ApiProperty({
    description: 'Reason for adjustment',
    required: false,
    example: 'Received new shipment from supplier',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
