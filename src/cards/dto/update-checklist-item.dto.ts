import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

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
