import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  @MinLength(5)
  street: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @MinLength(2)
  city: string;

  @ApiProperty({ example: 'NY' })
  @IsString()
  @MinLength(2)
  state: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @MinLength(3)
  zipCode: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  @MinLength(2)
  country: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
