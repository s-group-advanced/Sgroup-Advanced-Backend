// src/common/guards/workspace-role.guard.ts
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import { WORKSPACE_PERMISSION_KEY } from '../decorators/workspace-permission.decorator';
import { WorkspaceMember } from '../../workspaces/entities/workspace-member.entity';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException('User not authenticated');

    // Bypass cho Admin hệ thống
    if (user.roles && user.roles.includes('admin')) return true;

    const workspaceId =
      req.params.workspaceId || req.body?.workspaceId || req.query?.workspaceId || req.params.id;
    if (!workspaceId) throw new BadRequestException('Workspace ID is required');

    // Query DB lấy member
    const repo = this.dataSource.getRepository(WorkspaceMember);
    const userId = user.sub ?? user.id ?? user;
    const membership = await repo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    const allowedRoles =
      this.reflector.getAllAndOverride<string[]>(WORKSPACE_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []; // ?? [] để đảm bảo luôn là mảng, tránh null

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(WORKSPACE_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // 1. Check Role (Nếu API có yêu cầu role cụ thể)
    if (allowedRoles.length > 0) {
      if (!allowedRoles.includes(membership.role)) {
        throw new ForbiddenException('Insufficient workspace role');
      }
    }

    // 2. Ưu tiên Owner
    if (membership.role === 'owner') {
      return true;
    }

    // 3. Check Permission
    if (requiredPermissions.length > 0) {
      const userPermissions = membership.permissions || [];

      // Logic: User phải có TẤT CẢ các quyền được yêu cầu
      // Ví dụ: Yêu cầu ['A', 'B'] thì User phải có cả 'A' và 'B'
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (hasAllPermissions) {
        return true;
      }

      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
