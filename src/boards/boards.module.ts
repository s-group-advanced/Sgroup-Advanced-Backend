import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BoardsController } from './controllers/boards.controller';
import { BoardsService } from './services/boards.service';
import { CreateBoardGuard } from './guards/create-board.guard';
import { Board } from './entities/board.entity';
import { BoardMember } from './entities/board-member.entity';
import { List } from './entities/list.entity';
import { Label } from './entities/label.entity';
import { BoardInvitation } from './entities/board-invitation.entity';
import { Card } from '../cards/entities/card.entity';

import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { User } from '../users/entities/user.entity';
import { WorkspaceRoleGuard } from 'src/common/guards/workspace-role.guard';
import { BoardPermissionGuard } from 'src/common/guards/board-permission.guard';
import { MailModule } from '../mail/mail.module';
import { BoardTemplatesModule } from 'src/board-templates/board-templates.module';
import { BoardTemplate } from 'src/board-templates/entities/board-templates.entity';
import { ListTemplate } from 'src/board-templates/entities/list-templates.entity';
import { CardTemplate } from 'src/board-templates/entities/card-templates.entity';
import { Checklist } from 'src/cards/entities/checklist.entity';
import { ChecklistItem } from 'src/cards/entities/checklist-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Board,
      BoardMember,
      List,
      Label,
      BoardInvitation,
      WorkspaceMember,
      Workspace,
      User,
      Card,
      BoardTemplate,
      ListTemplate,
      CardTemplate,
      BoardTemplatesModule,
      Checklist,
      ChecklistItem,
    ]),
    JwtModule.register({}),
    ConfigModule,
    MailModule,
  ],
  controllers: [BoardsController],
  providers: [BoardsService, CreateBoardGuard, WorkspaceRoleGuard, BoardPermissionGuard],
  exports: [BoardsService],
})
export class BoardsModule {}
