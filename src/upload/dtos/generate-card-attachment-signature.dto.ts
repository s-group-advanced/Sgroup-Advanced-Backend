import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export class GenerateCardAttachmentSignatureDto {
  @ApiProperty()
  @IsUUID()
  cardId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1048576 })
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024) // Max 20 MB
  fileSize!: number;
}
