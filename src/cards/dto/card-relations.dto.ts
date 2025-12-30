import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'This looks good!' })
  @IsString()
  body!: string;

  @ApiPropertyOptional({ example: '1' })
  @IsString()
  @IsOptional()
  parent_id?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text' })
  @IsString()
  body!: string;
}

export class AddLabelToCardDto {
  @ApiProperty({ example: '1' })
  @IsString()
  label_id!: string;
}
