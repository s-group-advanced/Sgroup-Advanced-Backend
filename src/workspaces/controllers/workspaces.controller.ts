import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspacesService } from '../services/workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dto';
import { Workspace } from '../entities/workspace.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enum/role/roles.enum';
import { AddMemberDto } from '../dto/add-member.dto';
import { WorkspaceRoles } from 'src/common/decorators/workspace-roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from 'src/common/guards/workspace-role.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { Response } from 'express';

@ApiTags('Workspaces')
@Controller('api/workspaces')
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}

  // api test role
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Get('test-role/:workspaceId')
  @WorkspaceRoles('member')
  async testRoleGuard(): Promise<{ message: string }> {
    return { message: 'You have access based on your workspace role' };
  }

  // Accept invitation
  @Public()
  @ApiOperation({ summary: 'Accept invitation to workspace' })
  @Get('accept-invitation')
  async acceptInvitation(@Query('token') token: string, @Res() res: Response): Promise<void> {
    const result = await this.service.acceptInvitation(token);

    if (result.html) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.send(result.html);
    } else {
      res.json(result);
    }
  }

  // Reject invitation
  @Public()
  @ApiOperation({ summary: 'Reject invitation to workspace' })
  @Get('reject-invitation')
  async rejectInvitation(@Query('token') token: string, @Res() res: Response): Promise<void> {
    const result = await this.service.rejectInvitation(token);
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(result.html);
  }

  @ApiOperation({ summary: 'Create workspace' })
  @ApiOkResponse({ type: Workspace })
  @Post()
  create(@Body() dto: CreateWorkspaceDto, @Req() req: any): Promise<Workspace> {
    const userId = req.user?.sub;
    return this.service.create(dto, userId);
  }

  // Lấy các workspace mà user hiện tại tham gia
  @ApiOperation({ summary: 'Get workspaces for current user' })
  @Get('my-workspaces')
  async getWorkspacesForCurrentUser(@Req() req: any): Promise<Workspace[]> {
    const userId = req.user?.sub;
    return this.service.findWorkspacesForUser(userId);
  }

  // Lấy danh sách người dùng có thể thêm vào workspace (những người chưa phải là thành viên)
  @ApiOperation({ summary: 'Get available users for workspace' })
  @ApiOkResponse({ type: [Workspace] })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @Get(':id/available-users')
  async getAvailableUsersForWorkspace(@Param('id') workspaceId: string) {
    return this.service.getAvailableUsersForWorkspace(workspaceId);
  }

  @ApiOperation({ summary: 'List workspaces' })
  @ApiOkResponse({ type: [Workspace] })
  @Get()
  findAll(): Promise<Workspace[]> {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Get workspace by id' })
  @ApiOkResponse({ type: Workspace })
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Workspace> {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Update workspace' })
  @ApiOkResponse({ type: Workspace })
  @Roles(Role.ADMIN) // Only ADMIN or SUPERADMIN can update
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto): Promise<Workspace> {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete workspace' })
  @Roles(Role.ADMIN) // Only ADMIN or SUPERADMIN can delete
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.service.remove(id);
    return { success: true };
  }

  // Add member to workspace
  @ApiOperation({ summary: 'Add member to workspace' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @Post('members/:workspaceId')
  async addMember(
    @Param('workspaceId') workspaceId: string,
    @Body() body: AddMemberDto,
    @Req() req: any,
  ): Promise<{ success: true; message: string }> {
    const inviterId = req.user?.sub;
    await this.service.addMember(workspaceId, body.email, inviterId);
    return { success: true, message: 'Invitation sent if the user exists' };
  }

  @ApiOperation({ summary: 'Toggle status workspace' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('member', 'owner')
  @Patch('status/:id')
  async toggleStatus(@Param('id') id: string): Promise<Workspace> {
    return this.service.toggleWorkspaceStatus(id);
  }

  // change member role (E.g., from member to owner)
  @ApiOperation({ summary: 'Change member role in workspace' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @Patch('members/:workspaceId/role')
  async changeMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { memberId: string; newRole: 'member' | 'owner' },
  ): Promise<{ message: string; success: true }> {
    return this.service.changeMemberRole(workspaceId, body.memberId, body.newRole);
  }

  // assign permission to member in workspace
  @ApiOperation({ summary: 'Assign permissions to member in workspace' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @Patch('members/:workspaceId/permissions')
  async assignPermissionsToMember(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { memberId: string; permissions: string[] },
  ): Promise<WorkspaceMember> {
    return this.service.assignPermissionsToMember(workspaceId, body.memberId, body.permissions);
  }
}
