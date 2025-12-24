import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BoardTemplatesService } from './board-templates.service';
import { CreateTemplateFromBoardDto } from './dto/create-template-from-board.dto';
import { WorkspaceRoleGuard } from 'src/common/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/common/decorators/workspace-roles.decorator';

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

  // create board template from board
  @Post('create-from-board')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @ApiOperation({ summary: 'Create board template from board' })
  async createTemplateFromBoard(@Body() dto: CreateTemplateFromBoardDto) {
    const response = await this.boardTemplatesService.createTemplateFromBoard(dto);
    return {
      statusCode: 201,
      message: 'Create template board from board successfully',
      data: response,
    };
  }
}
