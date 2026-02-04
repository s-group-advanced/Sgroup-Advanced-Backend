import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveListDto {
  @ApiProperty({
    description: 'ID of the target board where list will be moved',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  targetBoardId!: string;

  @ApiProperty({
    description: 'Optional position in the target board (defaults to end)',
    example: '0',
    required: false,
  })
  @IsOptional()
  // @IsString()
  position?: number;
}
