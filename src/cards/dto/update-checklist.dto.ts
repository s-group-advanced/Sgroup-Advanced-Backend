import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  // @ApiPropertyOptional()
  // @IsOptional() @IsBoolean()
  // is_checked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  due_at?: string; // Nhận ISO string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  position?: number;
}
