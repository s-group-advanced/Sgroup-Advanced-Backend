import { IsString, IsOptional, IsIn, IsDateString, MaxLength, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiProperty({ example: 'Implement feature X' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'Detailed description of the task' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '1' })
  @IsString()
  list_id!: string;

  @ApiPropertyOptional({ example: '0' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ example: 'high', enum: ['low', 'medium', 'high'] })
  @IsIn(['low', 'medium', 'high'])
  @IsOptional()
  priority?: 'low' | 'medium' | 'high';

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  due_at?: string;

  @ApiProperty({ description: 'Mark card as template', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_template?: boolean;
}
