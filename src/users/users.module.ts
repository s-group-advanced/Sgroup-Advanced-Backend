import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { User } from './entities/user.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { BoardMember } from '../boards/entities/board-member.entity';
import { CardMember } from '../cards/entities/card-member.entity';
import { Card } from '../cards/entities/card.entity';
import { Attachment } from '../cards/entities/attachment.entity';
import { Comment } from '../cards/entities/comment.entity';
import { CardLabel } from '../cards/entities/card-label.entity';
import { Checklist } from '../cards/entities/checklist.entity';
import { Label } from '../boards/entities/label.entity';
import { List } from '../boards/entities/list.entity';
import { Board } from '../boards/entities/board.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UploadService } from 'src/upload/upload.service';

@Module({
  imports: [
    // Register User and related entities so TypeORM can build relation metadata
    TypeOrmModule.forFeature([
      User,
      WorkspaceMember,
      BoardMember,
      CardMember,
      Card,
      Attachment,
      Comment,
      CardLabel,
      Checklist,
      Label,
      List,
      Board,
      Workspace,
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UploadService],
  exports: [UsersService],
})
export class UsersModule {}
