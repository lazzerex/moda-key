import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VoteType {
  HELPFUL = 'HELPFUL',
  NOT_HELPFUL = 'NOT_HELPFUL',
}

export class VoteReviewDto {
  @ApiProperty({
    example: 'HELPFUL',
    description: 'Vote type',
    enum: VoteType,
  })
  @IsEnum(VoteType)
  voteType: VoteType;
}
