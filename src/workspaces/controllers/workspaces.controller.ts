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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';

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
  // @Roles(Role.ADMIN) // Only ADMIN or SUPERADMIN can update
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
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

  // generate invitation link
  @ApiOperation({ summary: 'Generate permanent invitation link foe workspace' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @Post(':workspaceId/generate-invitation-link')
  async generateInvitationLink(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ inviteUrl: string; token: string }> {
    return this.service.generateInviteLink(workspaceId);
  }

  // join workspace via invitation link
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Join workspace via invitation link' })
  @Get('invite/link/:token')
  async joinViaInvitationLink(
    @Param('token') token: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    const userId = req.user?.sub;

    if (!userId) {
      // Chưa đăng nhập -> redirect
      const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';
      const backendUrl = process.env.APP_URL || 'http://localhost:5000';
      const callbackUrl = `${backendUrl}/api/workspaces/invite/link/${token}`;
      const redirectUrl = `${frontendUrl}/?callback=${encodeURIComponent(callbackUrl)}`;
      res.redirect(redirectUrl);
      return;
    }
    try {
      const result = await this.service.joinViaInviteLink(token, userId);
      const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';

      res.redirect(`${frontendUrl}/workspaces/${result.workspace.id}?joined=true`);
    } catch (error: any) {
      const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';

      let errorMessage = 'Failed to join workspace';
      let errorType = 'general';

      if (error instanceof BadRequestException) {
        if (error.message.includes('Invalid or expired')) {
          errorMessage =
            'This invitation link is no longer valid. Please contact the workspace owner for a new invite.';
          errorType = 'expired';
        } else if (error.message.includes('already a member')) {
          errorMessage = 'You are already a member of this workspace';
          errorType = 'already_member';
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof NotFoundException) {
        errorMessage = 'Workspace not found. It may have been deleted.';
        errorType = 'not_found';
      } else {
        errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      }

      const redirectUrl = `${frontendUrl}/invite-error?type=${errorType}&message=${encodeURIComponent(errorMessage)}`;
      console.error('Join failed:', errorMessage);
      res.redirect(redirectUrl);
    }
  }

  // Revoke invitation link
  @ApiOperation({ summary: 'Revoke invitation link for workspace' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @Delete(':workspaceId/invite-link/:token')
  async revokeInvitationLink(
    @Param('workspaceId') workspaceId: string,
    @Param('token') token: string,
  ): Promise<{ success: true; message: string }> {
    return this.service.revokeInviteLink(token, workspaceId);
  }

  // Get current invitation link for workspace
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  @ApiResponse({
    status: 200,
    description: 'Returns current invitation link if exists',
    schema: {
      example: {
        exists: true,
        inviteUrl: 'http://localhost:5000/api/workspaces/invite/link/abc123...',
        token: 'abc123...',
        createdAt: '2024-02-06T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No invitation link found',
  })
  @Get(':workspaceId/invitation-link')
  async getInvitationLink(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ exists: boolean; inviteUrl?: string; token?: string; createdAt?: Date }> {
    return await this.service.getInvitationLink(workspaceId);
  }
}
