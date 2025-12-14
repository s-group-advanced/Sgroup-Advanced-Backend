import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardTemplate } from './entities/board-templates.entity';
import { ListTemplate } from './entities/list-templates.entity';
import { CardTemplate } from './entities/card-templates.entity';
import { BoardTemplatesController } from './board-templates.controller';
import { BoardTemplatesService } from './board-templates.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    // Đăng ký Entity để Service của module dùng được Repository
    TypeOrmModule.forFeature([BoardTemplate, ListTemplate, CardTemplate]),
    JwtModule.register({}),
  ],
  controllers: [BoardTemplatesController],
  providers: [BoardTemplatesService],
  exports: [TypeOrmModule, BoardTemplatesService],
})
export class BoardTemplatesModule {}
