import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BoardTemplatesService } from './board-templates.service';

@ApiTags('Board Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('board-templates')
export class BoardTemplatesController {
  constructor(private readonly boardTemplatesService: BoardTemplatesService) {}

  // Get all board templates
  @Get()
  @ApiOperation({ summary: 'Get all board templates' })
  async findAll() {
    return {
      statusCode: 200,
      message: 'Get all board templates successfully',
      data: await this.boardTemplatesService.findAll(),
    };
  }

  // Get detail a board template
  @Get(':id')
  @ApiOperation({ summary: 'Get detail a board template' })
  async findOne(@Param('id') id: string) {
    return this.boardTemplatesService.findOne(id);
  }
}
