import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Response,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BoardsService } from '../services/boards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateListDto,
  AddBoardMemberDto,
  UpdateBoardMemberDto,
  CreateLabelDto,
  UpdateLabelDto,
  UpdateBoardVisibilityDto,
  ArchiveBoardDto,
  CreateBoardInvitationDto,
  UpdateListNameDto,
  ArchiveListDto,
  MoveListDto,
  CopyListDto,
  ReorderListDto,
} from '../dto';
import { WorkspaceRoleGuard } from 'src/common/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/common/decorators/workspace-roles.decorator';
import { RequireWorkspacePermissions } from 'src/common/decorators/workspace-permission.decorator';
import { WorkspacePermission } from 'src/common/enum/permission/workspace-permissions.enum';
import { BoardPermissionGuard } from 'src/common/guards/board-permission.guard';
import { BoardRole } from 'src/common/enum/role/board-role.enum';
import { BoardRoles } from 'src/common/decorators/board-roles.decorator';
import { CreateFromTemplateDto } from '../dto/create-from-template.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';

@ApiTags('Boards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  // ============ Boards CRUD ============
  @Post()
  // @UseGuards(CreateBoardGuard)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'member')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE_BOARD)
  @ApiOperation({ summary: 'Create a new board (workspace owner only)' })
  @ApiResponse({ status: 201, description: 'Board created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only workspace owners can create boards' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) createBoardDto: CreateBoardDto,
    @Request() req: any,
  ) {
    return this.boardsService.create(createBoardDto, req.user.sub);
  }

  @Post('template')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'member')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE_BOARD)
  @ApiOperation({ summary: 'Create a new board from template' })
  @ApiResponse({ status: 201, description: 'Board created successfully from template' })
  @ApiResponse({ status: 403, description: 'Forbidden - only workspace owners can create boards' })
  @ApiResponse({ status: 404, description: 'Workspace or Template not found' })
  async createBoardFromTemplate(
    @Request() req: any,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createFromTemplateDto: CreateFromTemplateDto,
  ) {
    return this.boardsService.createBoardFromTemplate(req.user.sub, createFromTemplateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get boards (Filter by status and workspace)' })
  @ApiQuery({
    name: 'is_closed',
    required: false,
    type: Boolean,
    description: 'Filter closed boards',
  })
  @ApiQuery({ name: 'workspace_id', required: false, type: String, description: 'Workspace ID' })
  async findAll(
    @Request() req: any,
    @Query('is_closed') isClosed?: string,
    @Query('workspace_id') workspaceId?: string,
  ) {
    const status = isClosed === 'true';

    return this.boardsService.findAll(req.user.sub, status, workspaceId);
  }

  // get boards that user is real member (board must active, not closed)
  @Get('my-boards')
  @ApiOperation({ summary: 'Get all boards that current user is a member of' })
  @ApiResponse({ status: 200, description: 'List of boards user is member of' })
  async getMyBoards(@Request() req: any) {
    return this.boardsService.findBoardsByMembership(req.user.sub);
  }

  @Get(':id')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Get board by ID' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 200, description: 'Board details' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.boardsService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Update a board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 200, description: 'Board updated' })
  @ApiResponse({ status: 403, description: 'Forbidden - only board owners can edit' })
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) updateBoardDto: UpdateBoardDto,
    @Request() req: any,
  ) {
    return this.boardsService.update(id, updateBoardDto, req.user.sub);
  }

  @Patch(':id/visibility')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Update board visibility (Public/Private)' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 200, description: 'Visibility updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Only Board Owner or Workspace Owner can perform this action',
  })
  async updateVisibility(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateBoardVisibilityDto,
    @Request() req: any,
  ) {
    return this.boardsService.updateVisibility(req.user.sub, id, dto.visibility);
  }

  @Patch(':id/archive')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Archive or Reopen a board (Owner only)' })
  @ApiResponse({ status: 200, description: 'Board status updated' })
  async archiveBoard(@Param('id') id: string, @Body() dto: ArchiveBoardDto, @Request() req: any) {
    return this.boardsService.archiveBoard(req.user.sub, id, dto.is_closed);
  }

  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @ApiOperation({ summary: 'Delete a board' })
  // @ApiParam({ name: 'id', description: 'Board ID' })
  // @ApiResponse({ status: 204, description: 'Board deleted' })
  // async remove(@Param('id') id: string, @Request() req: any) {
  //   await this.boardsService.remove(id, req.user.sub);
  // }

  @Delete(':id/permanent')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Delete board permanently' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  async deletePermanent(@Param('id') id: string, @Request() req: any) {
    await this.boardsService.deleteBoardPermanent(req.user.sub, id);
  }

  // get available members to add to board
  @Get(':id/available-members')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Get available members to add to board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 200, description: 'List of available members' })
  async getAvailableMembersForBoard(@Param('id') id: string) {
    return this.boardsService.getAvailableMembersForBoard(id);
  }
  // ============ Board Members ============
  @Get(':id/members')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Get all members of a board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 200, description: 'List of board members' })
  async getBoardMembers(@Param('id') id: string) {
    return this.boardsService.getBoardMembers(id);
  }

  @Post(':id/members')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Add a member to board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 201, description: 'Member added' })
  async addMember(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: AddBoardMemberDto,
    @Request() req: any,
  ) {
    return this.boardsService.addMember(id, dto, req.user.sub);
  }

  @Patch(':id/members/:userId')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Update board member role' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  async updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateBoardMemberDto,
    @Request() req: any,
  ) {
    return this.boardsService.updateMember(id, userId, dto, req.user.sub);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Remove member from board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    await this.boardsService.removeMember(id, userId, req.user.sub);
  }

  // change owner board
  @ApiOperation({ summary: 'Change board owner' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'newOwnerId', description: 'New Owner User ID' })
  @ApiResponse({ status: 200, description: 'Board owner changed' })
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @Patch(':boardId/change-owner')
  async changeBoardOwner(
    @Param('boardId') boardId: string,
    @Body('newOwnerId') newOwnerId: string,
    @Request() req: any,
  ) {
    return this.boardsService.changeBoardOwner(boardId, newOwnerId, req.user.sub);
  }

  // ============ Lists ============
  @Get(':id/lists')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({
    summary: 'Get all lists in a board',
    description:
      'Get lists. Use ?archived=true to get archived lists, ?archived=false for active lists (default)',
  })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiQuery({
    name: 'archived',
    required: false,
    type: Boolean,
    description: 'Filter by archived status. Default: false (show only active lists)',
  })
  @ApiResponse({ status: 200, description: 'List of lists' })
  async getBoardLists(
    @Param('id') id: string,
    @Query('archived') archived?: string,
    @Request() req?: any,
  ) {
    const isArchived = archived === 'true' ? true : archived === 'false' ? false : undefined;
    return this.boardsService.getBoardLists(id, req.user.sub, isArchived);
  }

  @Get(':id/cards')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({
    summary: 'Get all cards in a board',
    description: 'Get all cards in a board. Use ?archived=true/false to filter by archived status',
  })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiQuery({
    name: 'archived',
    required: false,
    type: Boolean,
    description: 'Filter by archived status',
  })
  @ApiResponse({ status: 200, description: 'List of cards' })
  async getBoardCards(
    @Param('id') id: string,
    @Query('archived') archived?: string,
    @Request() req?: any,
  ) {
    const archivedBool = archived === 'true' ? true : archived === 'false' ? false : undefined;
    return this.boardsService.getBoardCards(id, req.user.sub, archivedBool);
  }

  // Create list in board
  @Post(':id/lists')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Create a list in board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 201, description: 'List created' })
  async createList(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateListDto,
    // @Request() req: any,
  ) {
    return this.boardsService.createList(id, dto);
  }

  // Update list name
  @Patch(':id/lists/:listId')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Update a list name' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiResponse({ status: 200, description: 'List updated' })
  async updateList(
    @Param('id') id: string,
    @Param('listId') listId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateListNameDto,
  ) {
    return this.boardsService.updateList(id, listId, dto);
  }

  @Delete(':id/lists/:listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Delete a list' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiResponse({ status: 204, description: 'List deleted' })
  async removeList(@Param('id') id: string, @Param('listId') listId: string, @Request() req: any) {
    await this.boardsService.removeList(id, listId, req.user.sub);
  }

  @Patch(':id/lists/:listId/archive')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Archive or unarchive a list' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiResponse({ status: 200, description: 'List archived/unarchived successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not a member of the board' })
  @ApiResponse({ status: 404, description: 'List not found' })
  async archiveList(
    @Param('id') id: string,
    @Param('listId') listId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ArchiveListDto,
  ) {
    return this.boardsService.archiveList(id, listId, dto.archived);
  }

  @Patch('lists/:listId/reorder')
  @UseGuards(JwtAuthGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Reorder a list within its board' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiResponse({ status: 200, description: 'List reordered successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not a member of the board' })
  @ApiResponse({ status: 404, description: 'List not found' })
  async reorderList(
    @Param('listId') listId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: ReorderListDto,
    @Request() req: any,
  ) {
    return this.boardsService.reorderList(listId, dto.newIndex, req.user.sub);
  }

  @Patch('lists/:listId/move')
  @UseGuards(JwtAuthGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Move list to another board' })
  @ApiParam({ name: 'listId', description: 'List ID' })
  @ApiResponse({ status: 200, description: 'List moved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not a member of the board' })
  @ApiResponse({ status: 404, description: 'List or target board not found' })
  async moveList(
    @Param('listId') listId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: MoveListDto,
    @Request() req: any,
  ) {
    return this.boardsService.moveList(listId, '', dto, req.user.sub);
  }

  @Post('lists/:listId/copy')
  @UseGuards(JwtAuthGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Copy list to another board (including all cards)' })
  @ApiParam({ name: 'listId', description: 'List ID to copy' })
  @ApiResponse({ status: 201, description: 'List copied successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not a member of the board' })
  @ApiResponse({ status: 404, description: 'List or target board not found' })
  async copyList(
    @Param('listId') listId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CopyListDto,
    @Request() req: any,
  ) {
    return this.boardsService.copyList(listId, dto, req.user.sub);
  }

  // ============ Labels ============
  @Get(':id/labels')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Get all labels in a board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 200, description: 'List of labels' })
  async getBoardLabels(@Param('id') id: string) {
    return this.boardsService.getBoardLabels(id);
  }

  @Post(':id/labels')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Create a label in board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 201, description: 'Label created' })
  async createLabel(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateLabelDto,
    @Request() req: any,
  ) {
    return this.boardsService.createLabel(id, dto, req.user.sub);
  }

  @Patch(':id/labels/:labelId')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Update a label' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'labelId', description: 'Label ID' })
  @ApiResponse({ status: 200, description: 'Label updated' })
  async updateLabel(
    @Param('id') id: string,
    @Param('labelId') labelId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateLabelDto,
    @Request() req: any,
  ) {
    return this.boardsService.updateLabel(id, labelId, dto, req.user.sub);
  }

  @Delete(':id/labels/:labelId')
  @UseGuards(BoardPermissionGuard)
  @ApiOperation({ summary: 'Delete a label' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiParam({ name: 'labelId', description: 'Label ID' })
  @ApiResponse({ status: 200, description: 'Label deleted' })
  async removeLabel(
    @Param('id') id: string,
    @Param('labelId') labelId: string,
    @Request() req: any,
  ) {
    await this.boardsService.removeLabel(id, labelId, req.user.sub);
    return { message: 'Label deleted successfully' };
  }

  // ============ Board Invitations ============
  @Post(':id/invitations')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.OWNER)
  @ApiOperation({ summary: 'Create board invitation (member or owner only)' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  async createInvitation(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateBoardInvitationDto,
    @Request() req: any,
  ) {
    return this.boardsService.createInvitation(id, req.user.sub, dto);
  }

  // ============ Join Board via Invite Link ============
  @Get(':id/invite-link')
  @UseGuards(BoardPermissionGuard)
  @BoardRoles(BoardRole.MEMBER, BoardRole.OWNER)
  @ApiOperation({ summary: 'Get permanent board invite link for board' })
  @ApiParam({ name: 'id', description: 'Board ID' })
  @ApiResponse({
    status: 200,
    description: 'Board invite link',
    schema: {
      example: {
        inviteUrl: 'http://localhost:5000/boards/invite/abc123xyz...',
        token: 'abc123xyz...',
      },
    },
  })
  async getBoardInviteLink(@Param('id') id: string, @Request() req: any) {
    return this.boardsService.getBoardInviteLink(id, req.user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('invite/:token')
  @ApiOperation({ summary: 'Join board via permanent invite link' })
  @ApiParam({ name: 'token', description: 'Permanent board invite token' })
  @ApiResponse({ status: 200, description: 'Successfully joined board via permanent link' })
  async joinBoardViaLink(@Param('token') token: string, @Request() req: any, @Response() res: any) {
    const userId = req.user?.sub;

    if (!userId) {
      // user not logged in, redirect to login page with return URL
      const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';
      const backendUrl = process.env.APP_URL || 'http://localhost:5000';
      const callbackUrl = `${backendUrl}/boards/invite/${token}`;
      const redirectUrl = `${frontendUrl}/?callback=${encodeURIComponent(callbackUrl)}`;
      res.redirect(redirectUrl);
      return;
    }

    try {
      const result = await this.boardsService.joinBoardByInviteLink(token, userId);
      const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';

      res.redirect(`${frontendUrl}/board/${result.id}?joined=true`);
    } catch (error) {
      const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';

      let errorMessage = 'Failed to join board';
      let errorType = 'general';

      if (error instanceof NotFoundException) {
        errorMessage = 'Board not found or invite link is invalid';
        errorType = 'not_found';
      } else if (error instanceof ForbiddenException) {
        errorMessage = error.message;
        errorType = 'forbidden';
      } else {
        errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      }

      res.redirect(
        `${frontendUrl}/board-invite-error?type=${errorType}&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  // ============ Accept Board Invitation ============
  @Get('invitations/:token/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify invitation token (public)' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation verified' })
  async verifyInvitation(@Param('token') token: string) {
    return this.boardsService.verifyInvitation(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accept invitation and join board' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation accepted, user joined board' })
  async acceptInvitation(@Param('token') token: string, @Request() req: any) {
    return this.boardsService.acceptInvitation(token, req.user.sub);
  }
}
