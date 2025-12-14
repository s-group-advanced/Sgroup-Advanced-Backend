import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateFromTemplateDto {
  @ApiProperty({ description: 'ID of Workspace want to create board in' })
  @IsUUID()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiProperty({ description: 'ID of Board Template' })
  @IsUUID()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({ description: 'Name of the new board (optional)', required: false })
  boardName?: string;
}
