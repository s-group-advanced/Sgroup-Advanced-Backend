import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BoardTemplate } from './entities/board-templates.entity';
import { Repository } from 'typeorm';
import { CreateTemplateFromBoardDto } from './dto/create-template-from-board.dto';
import { Board } from 'src/boards/entities/board.entity';
import { ListTemplate } from './entities/list-templates.entity';
import { CardTemplate } from './entities/card-templates.entity';
import { Workspace } from 'src/workspaces/entities/workspace.entity';

@Injectable()
export class BoardTemplatesService {
  constructor(
    @InjectRepository(BoardTemplate)
    private readonly boardTemplateRepository: Repository<BoardTemplate>,
    @InjectRepository(Board)
    private readonly boardRepository: Repository<Board>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
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

  // create board template from board real
  async createTemplateFromBoard(dto: CreateTemplateFromBoardDto) {
    // find workspace by id
    const workspace = await this.workspaceRepository.findOne({
      where: { id: dto.workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const board = await this.boardRepository.findOne({
      where: { id: dto.boardId, workspace_id: workspace.id },
      relations: ['lists', 'lists.cards'],
    });
    if (!board) {
      throw new NotFoundException('Board not found or not belong to the workspace');
    }

    // Transaction
    const queryRunner = this.boardTemplateRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // create new template
      const newTemplate = queryRunner.manager.create(BoardTemplate, {
        name: dto.name || board.name,
        description: board.description,
        cover_url: board.cover_url,
      });

      const savedTemplate = await queryRunner.manager.save(newTemplate);

      // process list and card
      const allCardsToInsert: any[] = [];
      const sortedLists = (board.lists || []).sort((a, b) => a.position - b.position);

      for (const list of sortedLists) {
        if (list.archived) continue; // bỏ qua các list đã bị archive

        const newListTemplate = queryRunner.manager.create(ListTemplate, {
          template: savedTemplate,
          name: list.name,
          position: list.position,
        });

        const savedListTemplate = await queryRunner.manager.save(newListTemplate);

        // map card
        if (list.cards && list.cards.length > 0) {
          const validCards = list.cards.filter((card) => !card.archived); // bỏ qua các card đã bị archive

          for (const card of validCards) {
            const newCardTemplate = queryRunner.manager.create(CardTemplate, {
              list: savedListTemplate,
              title: card.title,
              description: card.description,
              position: parseFloat(card.position as any) || 0,
              priority: card.priority,
            });
            allCardsToInsert.push(newCardTemplate);
          }
        }
      }
      if (allCardsToInsert.length > 0) {
        await queryRunner.manager.insert(CardTemplate, allCardsToInsert);
      }

      await queryRunner.commitTransaction();
      return savedTemplate;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
