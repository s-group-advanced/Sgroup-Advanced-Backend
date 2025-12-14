import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BoardTemplate } from './entities/board-templates.entity';
import { Repository } from 'typeorm';

@Injectable()
export class BoardTemplatesService {
  constructor(
    @InjectRepository(BoardTemplate)
    private readonly boardTemplateRepository: Repository<BoardTemplate>,
  ) {}

  // get all board templates
  async findAll() {
    return this.boardTemplateRepository.find({
      select: ['id', 'name', 'description', 'cover_url'],
      // relations: ['lists', 'lists.cards'],
    });
  }

  // get detail a board template
  async findOne(id: string) {
    return this.boardTemplateRepository.findOne({
      where: { id },
      relations: ['lists', 'lists.cards'],
      order: {
        lists: { position: 'ASC' },
      },
    });
  }
}
