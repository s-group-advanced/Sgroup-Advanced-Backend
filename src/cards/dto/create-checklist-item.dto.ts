import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Complete documentation' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_completed?: boolean;
}
