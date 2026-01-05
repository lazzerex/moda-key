import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  street?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  state?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  zipCode?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  country?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
