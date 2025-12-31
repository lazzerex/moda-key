import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({
    description: 'Product variant ID',
  })
  @IsString()
  productVariantId: string;

  @ApiProperty({
    description: 'Quantity to add',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'New quantity',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}
