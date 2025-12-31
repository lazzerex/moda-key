import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductVariantDto {
  @ApiProperty({
    example: 'Gateron Brown Switches',
    description: 'Variant name',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'KEY-K2-PRO-GB',
    description: 'Variant SKU',
  })
  @IsString()
  sku: string;

  @ApiProperty({
    example: 99.99,
    description: 'Variant price',
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 50,
    description: 'Stock quantity',
  })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({
    example: 'Gateron',
    description: 'Switch type',
    required: false,
  })
  @IsOptional()
  @IsString()
  switchType?: string;

  @ApiProperty({
    example: '75%',
    description: 'Keyboard layout',
    required: false,
  })
  @IsOptional()
  @IsString()
  layout?: string;

  @ApiProperty({
    example: 'Space Gray',
    description: 'Color',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    example: 'Wireless',
    description: 'Connection type (wired/wireless/both)',
    required: false,
  })
  @IsOptional()
  @IsString()
  connection?: string;

  @ApiProperty({
    example: { weight: '500g', material: 'Aluminum' },
    description: 'Additional specifications',
    required: false,
  })
  @IsOptional()
  specifications?: Record<string, any>;
}

export class UpdateProductVariantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  stock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  switchType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;
}
