import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dto';
import { User } from 'src/users/entities/user.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { MailService } from 'src/mail/mail.service';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/redis.module';
import { getInvitationAcceptedTemplate } from '../mail/invitationAcceptedTemplate';
import { getInvitationRejectedTemplate } from '../mail/invitationRejectedTemplate';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly repo: Repository<Workspace>,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(dto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    const entity = this.repo.create({ ...dto });
    // archive default false
    entity.archive = false;
    const savedWorkspace = await this.repo.save(entity);
    // Trước khi lưu workspace thì lưu workspace member với vai trò là owner, chính là người tạo
    const ownerMember = new WorkspaceMember();
    ownerMember.workspace_id = savedWorkspace.id;
    // userid lấy từ token lưu ở cookies
    ownerMember.user_id = userId;
    ownerMember.role = 'owner';
    ownerMember.status = 'accepted'; // Creator tự động accepted
    savedWorkspace.members = [...(savedWorkspace.members || []), ownerMember];
    // save to db
    await this.repo.manager.getRepository(WorkspaceMember).save(ownerMember);
    return savedWorkspace;
  }

  async findAll(): Promise<Workspace[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: string): Promise<Workspace> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Workspace not found');
    return found;
  }

  async update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }

  // get list user not in workspace
  async getAvailableUsersForWorkspace(workspaceId: string): Promise<User[]> {
    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);
    const userRepo = this.repo.manager.getRepository(User);

    const members = await memberRepo.find({
      where: { workspace_id: workspaceId },
      relations: ['user'],
    });

    const acceptedMemberUserIds = members
      .filter((m) => m.status !== 'declined') // lọc những người đã từ chối
      .map((m) => m.user_id)
      .filter((id) => id !== null && id !== undefined);

    if (acceptedMemberUserIds.length === 0) {
      return userRepo.find({ order: { name: 'ASC' } });
    }

    // find users not in memberUserIds
    const availableUsers = await userRepo
      .createQueryBuilder('user')
      .where('user.id NOT IN (:...ids)', {
        ids: acceptedMemberUserIds.length > 0 ? acceptedMemberUserIds : [''],
      })
      .getMany();

    return availableUsers;
  }

  // add member to workspace
  async addMember(workspaceId: string, email: string, inviterId: string): Promise<void> {
    // ensure workspace exists
    const workspace = await this.repo.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);
    const userRepo = this.repo.manager.getRepository(User);

    // ensure user exists
    const userInfo = await userRepo.findOne({ where: { email } });
    if (!userInfo) {
      throw new NotFoundException('User not found');
    }
    // check existing membership directly in member repo
    const memberExists = await memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userInfo.id, status: 'accepted' },
    });
    if (memberExists) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    const inviter = await userRepo.findOne({ where: { id: inviterId } });
    if (!inviter) {
      throw new NotFoundException('Inviter not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    // save token in redis has expired 3 days
    const key = `workspace_invite:${userInfo.email}`;
    const value = token;
    await this.redis.setex(key, 3 * 24 * 60 * 60, value);

    const newMember = new WorkspaceMember();
    newMember.workspace_id = workspaceId;
    newMember.user_id = userInfo.id;
    newMember.role = 'member'; // default role
    newMember.status = 'pending';

    await memberRepo.save(newMember);

    // optionally send notification mail
    await this.mailService.sendNotificationAddWorkspace(
      userInfo.email,
      userInfo.name,
      workspace.name,
      // owner name
      inviter.name || 'Team',
      token,
    );

    console.log(`Invitation sent to ${userInfo.email} to join workspace ${workspace.name}`);
  }

  // Accept invitation
  async acceptInvitation(token: string): Promise<{ html: string }> {
    // Tìm email từ token trong Redis
    const keys = await this.redis.keys('workspace_invite:*');
    let userEmail: string | null = null;

    for (const key of keys) {
      const value = await this.redis.get(key);
      if (value === token) {
        userEmail = key.replace('workspace_invite:', '');
        break;
      }
    }

    if (!userEmail) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);
    const userRepo = this.repo.manager.getRepository(User);

    // Tìm user theo email
    const user = await userRepo.findOne({ where: { email: userEmail } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Tìm member với user_id và status pending
    const member = await memberRepo.findOne({
      where: {
        user_id: user.id,
        status: 'pending',
      },
      relations: ['workspace', 'user'],
    });

    if (!member) {
      throw new NotFoundException('Invitation not found or already processed');
    }

    if (member.status !== 'pending') {
      throw new BadRequestException(`Invitation already ${member.status}`);
    }

    // Update status to accepted
    member.status = 'accepted';
    await memberRepo.save(member);

    // Tìm owner
    const ownerMember = await memberRepo.findOne({
      where: {
        workspace_id: member.workspace!.id,
        role: 'owner',
      },
      relations: ['user'],
    });

    // Gửi email chào mừng
    try {
      await this.mailService.sendWelcomeToWorkspace(
        member.user!.email,
        member.user!.name,
        member.workspace!.name,
        member.role,
        ownerMember?.user?.name || 'Team',
        member.workspace!.id,
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Clear token from Redis
    const key = `workspace_invite:${userEmail}`;
    await this.redis.del(key);

    const frontendUrl = process.env.FE_URL || 'http://localhost:5173/react-app';

    return {
      html: getInvitationAcceptedTemplate({
        workspaceName: member.workspace!.name,
        inviterName: ownerMember?.user?.name || 'Team',
        acceptedAt: new Date().toISOString(),
        workspaceId: member.workspace!.id,
        frontendUrl,
      }),
    };
  }

  // Reject invitation
  async rejectInvitation(token: string): Promise<{ html: string }> {
    // Tìm email từ token trong Redis
    const keys = await this.redis.keys('workspace_invite:*');
    let userEmail: string | null = null;

    for (const key of keys) {
      const value = await this.redis.get(key);
      if (value === token) {
        userEmail = key.replace('workspace_invite:', '');
        break;
      }
    }

    if (!userEmail) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);
    const userRepo = this.repo.manager.getRepository(User);

    // Tìm user theo email
    const user = await userRepo.findOne({ where: { email: userEmail } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Tìm member với user_id và status pending
    const member = await memberRepo.findOne({
      where: {
        user_id: user.id,
        status: 'pending',
      },
      relations: ['workspace'],
    });

    if (!member) {
      throw new NotFoundException('Invitation not found');
    }

    if (member.status !== 'pending') {
      throw new BadRequestException(`Invitation already ${member.status}`);
    }

    // Update status to declined
    member.status = 'declined';
    await memberRepo.save(member);

    // Clear token from Redis
    const key = `workspace_invite:${userEmail}`;
    await this.redis.del(key);

    // Tìm owner
    const ownerMember = await memberRepo.findOne({
      where: {
        workspace_id: member.workspace!.id,
        role: 'owner',
      },
      relations: ['user'],
    });

    return {
      html: getInvitationRejectedTemplate({
        workspaceName: member.workspace!.name,
        inviterName: ownerMember?.user?.name || 'the team',
      }),
    };
  }

  // Lấy các workspace mà user hiện tại tham gia
  async findWorkspacesForUser(userId: string): Promise<Workspace[]> {
    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);

    const memberships = await memberRepo.find({
      where: { user_id: userId, status: 'accepted' },
      relations: ['workspace', 'workspace.members', 'workspace.members.user'],
    });

    return memberships
      .map((m) => m.workspace)
      .filter((w) => w !== undefined)
      .filter((workspace) => workspace.is_deleted === false)
      .map((workspace): any => {
        const acceptedMembers = workspace.members?.filter((m) => m.status === 'accepted') || [];
        const owner = acceptedMembers.find((m) => m.role === 'owner');
        return {
          ...workspace,
          owner: owner?.user
            ? {
                id: owner.user.id,
                name: owner.user.name,
                email: owner.user.email,
                avatar_url: owner.user.avatar_url,
              }
            : null,
          members:
            acceptedMembers.map((member) => ({
              id: member.user?.id,
              name: member.user?.name,
              email: member.user?.email,
              avatar_url: member.user?.avatar_url,
              role: member.role,
            })) || [],
        };
      });
  }

  // Chuyển đổi trạng thái của workspace (active/inactive)
  async toggleWorkspaceStatus(workspaceId: string): Promise<Workspace> {
    // find workspace by id
    const workspaceFound = await this.repo.findOne({ where: { id: workspaceId } });
    if (!workspaceFound) throw new NotFoundException('Workspace not found');

    // toggle status
    workspaceFound.archive = !workspaceFound.archive;

    // save changes
    const saveChanges = await this.repo.save(workspaceFound);
    if (!saveChanges) throw new BadRequestException('Failed to toggle workspace status');

    return saveChanges;
  }

  // change member role in workspace
  async changeMemberRole(
    workspaceId: string,
    userId: string,
    newRole: string,
  ): Promise<{ message: string; success: true }> {
    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);

    const validRoles = ['owner', 'admin', 'member'] as const;
    if (!validRoles.includes(newRole as any)) {
      throw new BadRequestException('Invalid role');
    }

    // ensure user is a member of the workspace
    const foundMember = await memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId, status: 'accepted' },
    });

    if (!foundMember) {
      throw new NotFoundException('User is not a member of the workspace');
    }

    // update role
    foundMember.role = newRole as (typeof validRoles)[number];
    await memberRepo.save(foundMember);

    return { message: 'Member role updated successfully', success: true };
  }

  // owner assign "Create Board" permission in workspace
  async assignPermissionsToMember(
    workspaceId: string,
    userId: string,
    permissions: string[],
  ): Promise<WorkspaceMember> {
    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);

    // ensure user is a member of the workspace
    const foundMember = await memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId, status: 'accepted' },
    });

    if (!foundMember) {
      throw new NotFoundException('User is not a member of the workspace');
    }

    // ensure permission array is not empty
    if (permissions.length === 0) {
      throw new BadRequestException('Permissions array cannot be empty');
    }
    // kiểm tra quyền không trùng lặp
    const existingPermissions = foundMember.permissions || [];
    const duplicatePermissions = permissions.filter((perm) => existingPermissions.includes(perm));
    if (duplicatePermissions.length > 0) {
      throw new BadRequestException(`Duplicate permissions: ${duplicatePermissions.join(', ')}`);
    }

    // validate permission: quyền có dạng là 'action:resource' ví dụ 'create:board'
    const isValidPermission = permissions.every((perm) => /^(\w+):(\w+)$/.test(perm));
    if (!isValidPermission) {
      throw new BadRequestException('Invalid permission format');
    }

    // assign permission
    foundMember.permissions = Array.from(
      new Set([...(foundMember.permissions || []), ...permissions]),
    );
    return memberRepo.save(foundMember);
  }

  // Generate permantent invite link
  async generateInviteLink(workspaceId: string): Promise<{ inviteUrl: string; token: string }> {
    const workspace = await this.repo.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Save token in Redis (permantent, no expiry)
    const key = `workspace_invite_link:${token}`;
    await this.redis.set(key, workspaceId);

    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const inviteUrl = `${baseUrl}/api/workspaces/invite/link/${token}`;

    return { inviteUrl, token };
  }

  // Join workspace via invite link
  async joinViaInviteLink(
    token: string,
    userId: string,
  ): Promise<{ success: true; message: string; workspace: any }> {
    // Get workspace id from redis
    const key = `workspace_invite_link:${token}`;
    const workspaceId = await this.redis.get(key);

    if (!workspaceId) {
      throw new BadRequestException('Invalid or expired invite link');
    }

    const workspace = await this.repo.findOne({
      where: { id: workspaceId },
      relations: ['members', 'members.user'],
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);
    const userRepo = this.repo.manager.getRepository(User);

    // ensure user exists
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // check if already a member
    const existingMember = await memberRepo.findOne({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        status: 'accepted',
      },
    });

    if (existingMember) {
      return {
        success: true,
        message: 'You are already a member of this workspace',
        workspace: {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
        },
      };
    }

    // Add user as member
    const newMember = new WorkspaceMember();
    newMember.workspace_id = workspaceId;
    newMember.user_id = userId;
    newMember.role = 'member';
    newMember.status = 'accepted';

    await memberRepo.save(newMember);

    // Find owner for welcome email
    const ownerMember = await memberRepo.findOne({
      where: { workspace_id: workspaceId, role: 'owner' },
      relations: ['user'],
    });

    // Send welcome email
    try {
      this.mailService.sendWelcomeToWorkspace(
        user.email,
        user.name,
        workspace.name,
        newMember.role,
        ownerMember?.user?.name || 'Team',
        workspace.id,
      );
    } catch (err) {
      console.error('Failed to send welcome email:', err);
    }

    return {
      success: true,
      message: `Successfully joined workspace ${workspace.name}`,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
      },
    };
  }

  // Revoke invite link
  async revokeInviteLink(
    token: string,
    workspaceId: string,
  ): Promise<{ success: true; message: string }> {
    const key = `workspace_invite_link:${token}`;
    const storedWorkspaceId = await this.redis.get(key);

    if (!storedWorkspaceId || storedWorkspaceId !== workspaceId) {
      throw new BadRequestException('Invalid invite link token for the specified workspace');
    }

    await this.redis.del(key);

    return { success: true, message: 'Invite link revoked successfully' };
  }

  // Get current invitation link
  async getInvitationLink(
    workspaceId: string,
  ): Promise<{ exists: boolean; inviteUrl?: string; token?: string; createdAt?: Date }> {
    const workspace = await this.repo.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const pattern = 'workspace_invite_link:*';
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const storedWorkspaceId = await this.redis.get(key);

      if (storedWorkspaceId === workspaceId) {
        const token = key.replace('workspace_invite_link:', '');

        const ttl = await this.redis.ttl(key);
        const baseUrl = process.env.APP_URL || 'http://localhost:5000';
        const inviteUrl = `${baseUrl}/api/workspaces/invite/link/${token}`;

        return {
          exists: true,
          inviteUrl,
          token,
          createdAt:
            ttl > 0 ? new Date(Date.now() - (3 * 24 * 60 * 60 * 1000 - ttl * 1000)) : undefined,
        };
      }
    }

    return { exists: false };
  }
}
