import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
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

export class CreateChecklistDto {
  @ApiProperty({ example: 'Tasks' })
  @IsString()
  name!: string;
}

export class UpdateChecklistDto {
  @ApiProperty({ example: 'Updated Tasks' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsOptional()
  position?: number;
}

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Complete documentation' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_completed?: boolean;
}

export class UpdateChecklistItemDto {
  @ApiProperty({ example: 'Updated item name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  is_completed?: boolean;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsOptional()
  position?: number;
}

export class AddLabelToCardDto {
  @ApiProperty({ example: '1' })
  @IsString()
  label_id!: string;
}
