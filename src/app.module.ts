import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { BoardsModule } from './boards/boards.module';
import { CardsModule } from './cards/cards.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { HealthController } from './health/health.controller';
import { typeormConfig } from './common/typeorm.config';
import { ActivityLog } from './common/entities/activity-log.entity';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RedisModule } from './common/redis.module';
import { BoardTemplatesModule } from './board-templates/board-templates.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(typeormConfig),
    TypeOrmModule.forFeature([ActivityLog]),
    MailModule,
    UsersModule,
    WorkspacesModule,
    BoardsModule,
    CardsModule,
    AuthModule,
    RedisModule,
    BoardTemplatesModule,
    UploadModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
