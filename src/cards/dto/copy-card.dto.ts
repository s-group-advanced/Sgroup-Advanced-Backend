import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CopyCardDto {
  @ApiProperty({ description: 'Target list ID (same or different board)' })
  @IsUUID()
  targetListId!: string;

  @ApiProperty({ description: 'Override card title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Position in target list', required: false })
  @IsOptional()
  newIndex?: number;

  @ApiProperty({ description: 'Copy all checklists', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeChecklists?: boolean;

  @ApiProperty({ description: 'Copy all labels', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeLabels?: boolean;

  @ApiProperty({ description: 'Copy all members', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeMembers?: boolean;
}
