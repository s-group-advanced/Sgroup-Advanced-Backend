import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCardFromTemplateDto {
  @ApiProperty({ description: 'Target list ID' })
  @IsUUID()
  list_id!: string;

  @ApiProperty({ description: 'Override card title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Clone all checklists from template (default: false)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  include_checklists?: boolean;

  @ApiProperty({
    description: 'Clone all labels from template (default: false)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  include_labels?: boolean;

  @ApiProperty({
    description: 'Clone all members from template (default: false)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  include_members?: boolean;
}
