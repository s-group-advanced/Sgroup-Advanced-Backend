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

    const memberUserIds = members.map((m) => m.user_id);

    // find users not in memberUserIds
    const availableUsers = await userRepo
      .createQueryBuilder('user')
      .where('user.id NOT IN (:...ids)', { ids: memberUserIds.length > 0 ? memberUserIds : [''] })
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
      where: { workspace_id: workspaceId, user_id: userInfo.id },
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
  }

  // Accept invitation
  async acceptInvitation(token: string): Promise<{ message: string }> {
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

    const member = await memberRepo.findOne({
      where: {
        user: { email: userEmail },
        status: 'pending',
      },
      relations: ['workspace', 'user'],
    });

    if (!member) {
      throw new NotFoundException('Invitation not found');
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

    // Gửi email chào mừng với non-null assertion
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

    return {
      message: 'Invitation accepted successfully',
    };
  }

  // Reject invitation
  async rejectInvitation(token: string): Promise<{ message: string }> {
    // Tìm email từ token trong Redis
    const keys = await this.redis.keys('workspace_invite:*');
    let userEmail: string | null = null;

    // Duyệt qua các keys để tìm key nào có value = token
    for (const key of keys) {
      const value = await this.redis.get(key);
      if (value === token) {
        // Extract email from key: workspace_invite:email@example.com
        userEmail = key.replace('workspace_invite:', '');
        break;
      }
    }

    if (!userEmail) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const memberRepo = this.repo.manager.getRepository(WorkspaceMember);

    // Tìm member với email và status pending
    const member = await memberRepo.findOne({
      where: {
        user: { email: userEmail },
        status: 'pending',
      },
      relations: ['workspace', 'user'],
    });

    if (!member) {
      throw new NotFoundException('Invitation not found');
    }

    if (member.status !== 'pending') {
      throw new BadRequestException(`Invitation already ${member.status}`);
    }

    // Update status to rejected
    member.status = 'declined';
    await memberRepo.save(member);

    // Clear token from Redis
    const key = `workspace_invite:${userEmail}`;
    await this.redis.del(key);

    return {
      message: 'Invitation rejected successfully',
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
}
