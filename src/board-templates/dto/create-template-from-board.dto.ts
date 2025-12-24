import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTemplateFromBoardDto {
  @IsUUID()
  @IsNotEmpty()
  boardId!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsNotEmpty()
  workspaceId!: string;
}
