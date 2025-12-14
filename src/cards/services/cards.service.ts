import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from '../entities/card.entity';
import { Comment } from '../entities/comment.entity';
import { Checklist } from '../entities/checklist.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { CardLabel } from '../entities/card-label.entity';
import {
  CreateCardDto,
  UpdateCardDto,
  CreateCommentDto,
  UpdateCommentDto,
  CreateChecklistDto,
  UpdateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
  AddLabelToCardDto,
} from '../dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private readonly cardRepository: Repository<Card>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Checklist)
    private readonly checklistRepository: Repository<Checklist>,
    @InjectRepository(ChecklistItem)
    private readonly checklistItemRepository: Repository<ChecklistItem>,
    @InjectRepository(CardLabel)
    private readonly cardLabelRepository: Repository<CardLabel>,
  ) {}

  // ============ Cards CRUD ============
  async create(createCardDto: CreateCardDto, userId: string): Promise<Card> {
    const position = createCardDto.position ?? (await this.getNextPosition(createCardDto.list_id));

    const card = this.cardRepository.create({
      ...createCardDto,
      position: Number(position),
      created_by: userId,
    });
    return this.cardRepository.save(card);
  }

  async findAll(listId?: string): Promise<Card[]> {
    const where = listId ? { list_id: listId } : {};
    return this.cardRepository.find({
      where,
      order: { position: 'ASC' },
      relations: ['list', 'labels', 'checklists', 'created_by_user'],
    });
  }

  async findOne(id: string): Promise<Card> {
    const card = await this.cardRepository.findOne({
      where: { id },
      relations: [
        'list',
        'labels',
        'checklists',
        'checklists.items',
        'attachments',
        'created_by_user',
      ],
    });
    if (!card) {
      throw new NotFoundException(`Card with ID ${id} not found`);
    }
    return card;
  }

  async update(id: string, updateCardDto: UpdateCardDto): Promise<Card> {
    await this.cardRepository.update(id, {
      ...updateCardDto,
      position: updateCardDto.position !== undefined ? Number(updateCardDto.position) : undefined,
      updated_at: new Date(),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.cardRepository.delete(id);
  }

  // ============ Comments ============
  async createComment(cardId: string, dto: CreateCommentDto, userId: string): Promise<Comment> {
    const comment = this.commentRepository.create({
      card_id: cardId,
      author_id: userId,
      body: dto.body,
      parent_id: dto.parent_id,
    });
    const saved = await this.commentRepository.save(comment);

    await this.cardRepository.increment({ id: cardId }, 'comments_count', 1);

    return saved;
  }

  async updateComment(
    cardId: string,
    commentId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, card_id: cardId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.author_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    await this.commentRepository.update(commentId, {
      body: dto.body,
      edited_at: new Date(),
    });
    const updated = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!updated) {
      throw new NotFoundException('Comment not found after update');
    }
    return updated;
  }

  async removeComment(cardId: string, commentId: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, card_id: cardId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.author_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.commentRepository.delete(commentId);
    await this.cardRepository.decrement({ id: cardId }, 'comments_count', 1);
  }

  async getCardComments(cardId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { card_id: cardId },
      relations: ['author'],
      order: { created_at: 'ASC' },
    });
  }

  // ============ Checklists ============
  async createChecklist(cardId: string, dto: CreateChecklistDto): Promise<Checklist> {
    const maxPos = await this.checklistRepository
      .createQueryBuilder('checklist')
      .where('checklist.card_id = :cardId', { cardId })
      .select('MAX(checklist.position)', 'max')
      .getRawOne();
    const position = maxPos?.max ? Number(maxPos.max) + 1 : 1;

    const checklist = this.checklistRepository.create({
      card_id: cardId,
      name: dto.name,
      position: Number(position),
    });
    return this.checklistRepository.save(checklist);
  }

  async updateChecklist(
    cardId: string,
    checklistId: string,
    dto: UpdateChecklistDto,
  ): Promise<Checklist> {
    await this.checklistRepository.update({ id: checklistId, card_id: cardId }, dto);
    const updated = await this.checklistRepository.findOne({ where: { id: checklistId } });
    if (!updated) {
      throw new NotFoundException('Checklist not found');
    }
    return updated;
  }

  async removeChecklist(cardId: string, checklistId: string): Promise<void> {
    await this.checklistRepository.delete({ id: checklistId, card_id: cardId });
  }

  async getCardChecklists(cardId: string): Promise<Checklist[]> {
    return this.checklistRepository.find({
      where: { card_id: cardId },
      relations: ['items'],
      order: { position: 'ASC' },
    });
  }

  // ============ Checklist Items ============
  async createChecklistItem(
    checklistId: string,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistItem> {
    const maxPos = await this.checklistItemRepository
      .createQueryBuilder('item')
      .where('item.checklist_id = :checklistId', { checklistId })
      .select('MAX(item.position)', 'max')
      .getRawOne();
    const position = maxPos?.max ? Number(maxPos.max) + 1 : 1;

    const item = this.checklistItemRepository.create({
      checklist_id: checklistId,
      content: dto.name,
      is_checked: dto.is_completed ?? false,
      position,
    });
    return this.checklistItemRepository.save(item);
  }

  async updateChecklistItem(
    checklistId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItem> {
    const updateData: any = {};
    if (dto.name !== undefined) updateData.content = dto.name;
    if (dto.is_completed !== undefined) {
      updateData.is_checked = dto.is_completed;
      updateData.completed_at = dto.is_completed ? new Date() : null;
    }
    if (dto.position !== undefined) updateData.position = dto.position;

    await this.checklistItemRepository.update(
      { id: itemId, checklist_id: checklistId },
      updateData,
    );
    const updated = await this.checklistItemRepository.findOne({ where: { id: itemId } });
    if (!updated) {
      throw new NotFoundException('Checklist item not found');
    }
    return updated;
  }

  async removeChecklistItem(checklistId: string, itemId: string): Promise<void> {
    await this.checklistItemRepository.delete({ id: itemId, checklist_id: checklistId });
  }

  // ============ Card Labels ============
  async addLabelToCard(cardId: string, dto: AddLabelToCardDto): Promise<void> {
    const existing = await this.cardLabelRepository.findOne({
      where: { card_id: cardId, label_id: dto.label_id },
    });
    if (existing) {
      return; // Already added
    }
    await this.cardLabelRepository.save({
      card_id: cardId,
      label_id: dto.label_id,
    });
  }

  async removeLabelFromCard(cardId: string, labelId: string): Promise<void> {
    await this.cardLabelRepository.delete({ card_id: cardId, label_id: labelId });
  }

  // Helper
  private async getNextPosition(listId: string): Promise<number> {
    // ✅ Đổi từ bigint sang number
    const maxPos = await this.cardRepository
      .createQueryBuilder('card')
      .where('card.list_id = :listId', { listId })
      .select('MAX(card.position)', 'max')
      .getRawOne();
    return maxPos?.max ? Number(maxPos.max) + 1 : 1;
  }
}
