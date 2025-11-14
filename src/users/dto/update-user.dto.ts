import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  readonly name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  readonly avatar_url?: string;

  @ApiPropertyOptional({ example: 'newemail@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  readonly email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  readonly is_active?: boolean;
}
