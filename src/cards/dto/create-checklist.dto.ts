import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateChecklistDto {
  @ApiProperty({ example: 'Checklist Name' })
  @IsNotEmpty()
  name!: string;
}
