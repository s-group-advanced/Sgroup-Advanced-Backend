import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, DataSource } from 'typeorm';
import { Board, BoardVisibility } from '../entities/board.entity';
import { BoardMember } from '../entities/board-member.entity';
import { List } from '../entities/list.entity';
import { Label } from '../entities/label.entity';
import { BoardInvitation } from '../entities/board-invitation.entity';
import { Card } from '../../cards/entities/card.entity';

import { WorkspaceMember } from '../../workspaces/entities/workspace-member.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';

import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateListDto,
  UpdateListDto,
  AddBoardMemberDto,
  UpdateBoardMemberDto,
  CreateLabelDto,
  UpdateLabelDto,
  CreateBoardInvitationDto,
  MoveListDto,
  CopyListDto,
} from '../dto';
import { BoardRole } from 'src/common/enum/role/board-role.enum';
import { MailService } from '../../mail/mail.service';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis.module';
import { CreateFromTemplateDto } from '../dto/create-from-template.dto';
import { BoardTemplate } from 'src/board-templates/entities/board-templates.entity';
import { Checklist } from 'src/cards/entities/checklist.entity';
import { ChecklistItem } from 'src/cards/entities/checklist-item.entity';

// dữ liệu lưu trong Redis cho email invitation token
interface InvitationCachePayload {
  invitationId: string;
  boardId: string;
  invitedEmail?: string;
  invitedUserId?: string;
  createdBy: string;
  boardName: string;
  inviterName: string;
  expiresAt: string;
}

export interface InvitationVerificationResult {
  invitationId: string;
  boardId: string;
  boardName: string;
  inviterName: string;
  invitedEmail?: string;
  invitedUserId?: string;
  expiresAt: string;
}

@Injectable()
export class BoardsService {
  private static readonly INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Board)
    private readonly boardRepository: Repository<Board>,
    @InjectRepository(BoardMember)
    private readonly boardMemberRepository: Repository<BoardMember>,
    @InjectRepository(List)
    private readonly listRepository: Repository<List>,
    @InjectRepository(Label)
    private readonly labelRepository: Repository<Label>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(BoardInvitation)
    private readonly boardInvitationRepository: Repository<BoardInvitation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Card)
    private readonly cardRepository: Repository<Card>,
    @InjectRepository(Checklist)
    private readonly checklistRepository: Repository<Checklist>,
    @InjectRepository(ChecklistItem)
    private readonly checklistItemRepository: Repository<ChecklistItem>,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    @InjectRepository(BoardTemplate)
    private readonly boardTemplateRepository: Repository<BoardTemplate>,
  ) {}

  // Boards CRUD
  async create(createBoardDto: CreateBoardDto, userId: string): Promise<Board> {
    const board = this.boardRepository.create({
      ...createBoardDto,
      workspace_id: createBoardDto.workspaceId,
      created_by: userId,
      invite_link_token: this.generateToken(),
    });
    const savedBoard = await this.boardRepository.save(board);

    // tự động thêm người tạo làm owner của board
    await this.boardMemberRepository.save({
      board_id: savedBoard.id,
      user_id: userId,
      role: BoardRole.OWNER,
    });

    return savedBoard;
  }

  async findAll(userId: string, isClosed: boolean = false, workspaceId?: string): Promise<Board[]> {
    const query = this.boardRepository
      .createQueryBuilder('board')
      // 1. Join với bảng board_members: check quyen
      .leftJoin('board.members', 'bm', 'bm.user_id = :userId', { userId })

      // 2. Join với workspace -> workspace_members: check quyen
      .leftJoin('board.workspace', 'w')
      .leftJoin('w.members', 'wm', 'wm.user_id = :userId', { userId })

      // 3. Logic lọc điều kiện OR
      .where(
        new Brackets((qb) => {
          // Điều kiện A: User là thành viên Board
          qb.where('bm.user_id IS NOT NULL')

            // Điều kiện B: Board Public VÀ User thuộc Workspace
            // Truyền biến publicStatus NGAY TẠI ĐÂY
            .orWhere('(board.visibility = :publicStatus AND wm.user_id IS NOT NULL)', {
              publicStatus: BoardVisibility.PUBLIC,
            });
        }),
      )

      // 4. Lọc board chưa đóng
      .andWhere('board.is_closed = :status', { status: isClosed });
    if (workspaceId) {
      // Nếu có gửi ID thì lọc, không thì thôi
      query.andWhere('board.workspace_id = :workspaceId', { workspaceId });
    }
    return query.orderBy('board.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, userId: string): Promise<Board> {
    await this.checkBoardAccess(id, userId);
    const board = await this.boardRepository.findOne({
      where: { id },
    });
    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found`);
    }
    return board;
  }

  // Get board invite link
  async getBoardInviteLink(
    boardId: string,
    userId: string,
  ): Promise<{ inviteUrl: string; token: string }> {
    const board = await this.boardRepository.findOne({
      where: { id: boardId },
      select: ['id', 'invite_link_token', 'name'],
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    // Check if user is member of the board
    const isMember = await this.boardMemberRepository.findOne({
      where: { board_id: boardId, user_id: userId },
    });
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this board');
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const inviteUrl = `${baseUrl}/boards/invite/${board.invite_link_token}`;

    return {
      inviteUrl,
      token: board.invite_link_token || '',
    };
  }

  async update(id: string, updateBoardDto: UpdateBoardDto, userId: string): Promise<Board> {
    await this.checkBoardAccess(id, userId, BoardRole.OWNER);
    await this.boardRepository.update(id, updateBoardDto);
    const updatedBoard = await this.boardRepository.findOne({
      where: { id },
    });
    if (!updatedBoard) {
      throw new NotFoundException(`Board with ID ${id} not found`);
    }
    return updatedBoard;
  }

  async updateVisibility(
    userId: string,
    boardId: string,
    visibility: BoardVisibility,
  ): Promise<Board> {
    const board = await this.boardRepository.findOne({
      where: { id: boardId },
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }
    await this.boardRepository.update(boardId, { visibility });
    return { ...board, visibility };
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.checkBoardAccess(id, userId, BoardRole.OWNER);
    await this.boardRepository.delete(id);
  }

  // get user in workspace but not in board
  async getAvailableMembersForBoard(boardId: string) {
    // ensure board exists
    const board = await this.boardRepository.findOne({
      where: { id: boardId },
      relations: ['workspace'],
    });

    if (!board) throw new NotFoundException('Board not found');

    // get all member of workspace
    const workspaceMembers = await this.workspaceMemberRepository.find({
      where: { workspace_id: board.workspace_id },
      relations: ['user'],
      order: { joined_at: 'DESC' },
    });

    // get all current members of board
    const boardMembers = await this.boardMemberRepository.find({
      where: { board_id: boardId },
      select: ['user_id'],
    });

    const boardMemberIds = boardMembers.map((bm) => bm.user_id);

    // filter workspace members to exclude those already in board and only get 3 users newest
    const availableMembers = workspaceMembers
      .filter((wm) => !boardMemberIds.includes(wm.user_id))
      .slice(0, 3)
      .map((wm) => ({
        id: wm.user_id,
        email: wm.user?.email,
        name: wm.user?.name,
        avatar_url: wm.user?.avatar_url,
        roles: wm.user?.roles,
        permissions: wm.permissions,
      }));

    return availableMembers;
  }

  // Board Members
  async addMember(boardId: string, dto: AddBoardMemberDto, userId: string): Promise<BoardMember> {
    await this.checkBoardAccess(boardId, userId, BoardRole.OWNER);
    const member = this.boardMemberRepository.create({
      board_id: boardId,
      user_id: dto.user_id,
      role: dto.role,
    });
    return this.boardMemberRepository.save(member);
  }

  async updateMember(
    boardId: string,
    memberId: string,
    dto: UpdateBoardMemberDto,
    userId: string,
  ): Promise<BoardMember> {
    await this.checkBoardAccess(boardId, userId, BoardRole.OWNER);
    await this.boardMemberRepository.update(
      { board_id: boardId, user_id: memberId },
      { role: dto.role },
    );
    const updated = await this.boardMemberRepository.findOne({
      where: { board_id: boardId, user_id: memberId },
      relations: ['user'],
    });
    if (!updated) {
      throw new NotFoundException('Member not found');
    }
    return updated;
  }

  async removeMember(boardId: string, memberId: string, userId: string): Promise<void> {
    await this.checkBoardAccess(boardId, userId, BoardRole.OWNER);
    await this.boardMemberRepository.delete({ board_id: boardId, user_id: memberId });
  }

  async getBoardMembers(boardId: string): Promise<BoardMember[]> {
    // await this.checkBoardAccess(boardId, userId);
    return this.boardMemberRepository.find({
      where: { board_id: boardId },
      relations: ['user'],
    });
  }

  // Lists
  async createList(boardId: string, dto: CreateListDto): Promise<List> {
    // Tính position cho list mới
    const maxPost = await this.listRepository
      .createQueryBuilder('list')
      .where('list.board_id = :boardId', { boardId })
      .select('MAX(list.position)', 'max')
      .getRawOne();
    const currentMax = maxPost?.max ? parseFloat(maxPost.max) : 0;
    const position = currentMax + 1;

    const list = this.listRepository.create({
      board_id: boardId,
      title: dto.title,
      name: dto.name,
      position,
      cover_img: dto.cover_img || null,
    });
    return this.listRepository.save(list);
  }

  async updateList(boardId: string, listId: string, dto: UpdateListDto): Promise<List> {
    await this.listRepository.update({ id: listId, board_id: boardId }, dto);
    const updated = await this.listRepository.findOne({ where: { id: listId } });
    if (!updated) {
      throw new NotFoundException('List not found');
    }
    return updated;
  }

  async removeList(boardId: string, listId: string, userId: string): Promise<void> {
    await this.checkBoardAccess(boardId, userId);
    await this.listRepository.delete({ id: listId, board_id: boardId });
  }

  async archiveList(boardId: string, listId: string, archived: boolean): Promise<List> {
    await this.listRepository.update({ id: listId, board_id: boardId }, { archived });
    const updated = await this.listRepository.findOne({ where: { id: listId } });
    if (!updated) {
      throw new NotFoundException('List not found');
    }
    return updated;
  }

  async reorderList(listId: string, newIndex: number, userId: string): Promise<List> {
    const list = await this.listRepository.findOne({ where: { id: listId } });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    await this.checkBoardAccess(list.board_id, userId);

    const activeLists = await this.listRepository.find({
      where: { board_id: list.board_id, archived: false },
      order: { position: 'ASC' },
    });

    const currentIndex = activeLists.findIndex((item) => item.id === listId);
    if (currentIndex === -1) {
      throw new BadRequestException('Cannot reorder an archived list');
    }

    activeLists.splice(currentIndex, 1);
    const boundedIndex = Math.max(0, Math.min(newIndex, activeLists.length));
    activeLists.splice(boundedIndex, 0, list);

    const prev = activeLists[boundedIndex - 1];
    const next = activeLists[boundedIndex + 1];

    let newPosition: number;
    if (prev && next) {
      newPosition = (prev.position + next.position) / 2;
    } else if (!prev && next) {
      newPosition = next.position - 1;
    } else if (prev && !next) {
      newPosition = prev.position + 1;
    } else {
      newPosition = 0;
    }

    await this.listRepository.update({ id: listId }, { position: newPosition });

    const updated = await this.listRepository.findOne({ where: { id: listId } });
    if (!updated) {
      throw new NotFoundException('List not found');
    }
    return updated;
  }

  async getBoardLists(boardId: string, userId: string, archived?: boolean): Promise<List[]> {
    await this.checkBoardAccess(boardId, userId);
    const whereCondition: any = { board_id: boardId };

    // If archived param is provided, filter by it. Otherwise, default to non-archived only
    if (archived !== undefined) {
      whereCondition.archived = archived;
    } else {
      whereCondition.archived = false;
    }

    return this.listRepository.find({
      where: whereCondition,
      order: { position: 'ASC' },
    });
  }

  async getBoardCards(boardId: string, userId: string, archived?: boolean): Promise<Card[]> {
    await this.checkBoardAccess(boardId, userId);
    const whereCondition: any = { board_id: boardId };

    // Filter by archived status if provided
    if (archived !== undefined) {
      whereCondition.archived = archived;
    }

    return this.cardRepository.find({
      where: whereCondition,
      order: { position: 'ASC' },
      relations: ['list', 'labels', 'checklists', 'created_by_user', 'cardMembers'],
    });
  }

  async moveList(
    listId: string,
    sourceBoardId: string,
    dto: MoveListDto,
    userId: string,
  ): Promise<List> {
    const list = await this.listRepository.findOne({
      where: { id: listId },
    });
    if (!list) {
      throw new NotFoundException('List not found');
    }

    const actualSourceBoardId = list.board_id;

    const [sourceBoard, targetBoard, sourceBoardAccessCheck, targetBoardAccessCheck] =
      await Promise.all([
        this.boardRepository.findOne({ where: { id: actualSourceBoardId } }),
        this.boardRepository.findOne({ where: { id: dto.targetBoardId } }),
        this.checkBoardAccess(actualSourceBoardId, userId).catch((e) => ({ error: e })),
        this.checkBoardAccess(dto.targetBoardId, userId).catch((e) => ({ error: e })),
      ]);

    if (sourceBoardAccessCheck?.error) throw sourceBoardAccessCheck.error;
    if (targetBoardAccessCheck?.error) throw targetBoardAccessCheck.error;

    if (!sourceBoard) {
      throw new NotFoundException('Source board not found');
    }
    if (!targetBoard) {
      throw new NotFoundException('Target board not found');
    }

    if (actualSourceBoardId === dto.targetBoardId) {
      throw new ForbiddenException('Cannot move list to the same board');
    }

    let newPosition = dto.position;
    if (!newPosition) {
      const maxPos = await this.listRepository
        .createQueryBuilder('list')
        .where('list.board_id = :boardId', { boardId: dto.targetBoardId })
        .select('MAX(list.position)', 'max')
        .getRawOne();
      newPosition = maxPos?.max ? parseFloat(maxPos.max) + 1 : 0;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Update list board_id và position
      await queryRunner.manager.update(
        List,
        { id: listId },
        { board_id: dto.targetBoardId, position: newPosition },
      );

      await queryRunner.manager.update(Card, { list_id: listId }, { board_id: dto.targetBoardId });

      // Lấy tất cả card_ids trong list
      const cards = await queryRunner.manager.find(Card, {
        where: { list_id: listId },
        select: ['id'],
      });
      const cardIds = cards.map((c) => c.id);

      if (cardIds.length > 0) {
        // Lấy user_ids là members của target board
        const targetBoardMembers = await queryRunner.manager.find(BoardMember, {
          where: { board_id: dto.targetBoardId },
          select: ['user_id'],
        });
        const validUserIds = targetBoardMembers.map((m) => m.user_id);

        // Xóa card members không thuộc target board
        if (validUserIds.length > 0) {
          await queryRunner.manager
            .createQueryBuilder()
            .delete()
            .from('card_members') // tên bảng card_members
            .where('card_id IN (:...cardIds)', { cardIds })
            .andWhere('user_id NOT IN (:...validUserIds)', { validUserIds })
            .execute();
        } else {
          // Nếu target board không có member nào → xóa tất cả card members
          await queryRunner.manager
            .createQueryBuilder()
            .delete()
            .from('card_members')
            .where('card_id IN (:...cardIds)', { cardIds })
            .execute();
        }
      }

      await queryRunner.commitTransaction();

      const updatedList = await this.listRepository.findOne({ where: { id: listId } });
      if (!updatedList) {
        throw new NotFoundException('Failed to update list');
      }

      return updatedList;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error moving list:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async copyList(
    listId: string,
    dto: CopyListDto,
    userId: string,
  ): Promise<{ copiedList: List; copiedCards: Card[] }> {
    // Get source list
    const sourceList = await this.listRepository.findOne({
      where: { id: listId },
    });
    if (!sourceList) {
      throw new NotFoundException('Source list not found');
    }

    const sourceBoardId = sourceList.board_id;

    // Check user has access to source board
    await this.checkBoardAccess(sourceBoardId, userId);

    // Get target board
    const targetBoard = await this.boardRepository.findOne({
      where: { id: dto.targetBoardId },
    });
    if (!targetBoard) {
      throw new NotFoundException('Target board not found');
    }

    // Check user has access to target board
    await this.checkBoardAccess(dto.targetBoardId, userId);

    const [sourceCards, targetLists, maxPos, targetBoardMembers, targetBoardLabels] =
      await Promise.all([
        this.cardRepository.find({
          where: { list_id: listId },
          order: { position: 'ASC' },
          relations: [
            'cardMembers',
            'cardMembers.user',
            'labels',
            'checklists',
            'checklists.items',
          ],
        }),
        this.listRepository.find({
          where: { board_id: dto.targetBoardId },
        }),
        this.listRepository
          .createQueryBuilder('list')
          .where('list.board_id = :boardId', { boardId: dto.targetBoardId })
          .select('MAX(list.position)', 'max')
          .getRawOne(),
        this.boardMemberRepository.find({
          where: { board_id: dto.targetBoardId },
          select: ['user_id'],
        }),
        this.labelRepository.find({
          where: { board_id: dto.targetBoardId },
        }),
      ]);

    // Generate new list name with duplicate checking
    let newListName: string;
    let newListTitle: string;

    if (dto.newName) {
      newListName = dto.newName;
      newListTitle = dto.newName;
    } else {
      const baseName = sourceList.name;
      const baseTitle = sourceList.title;
      const copyPrefix = `(copy`;

      const existingCopies = targetLists.filter((list) => list.name.includes(copyPrefix));

      if (existingCopies.length === 0) {
        newListName = `${baseName} (copy)`;
        newListTitle = `${baseTitle} (copy)`;
      } else {
        let maxCopyNumber = 1;
        existingCopies.forEach((list) => {
          const match = list.name.match(/\(copy (\d+)\)/);
          if (match) {
            maxCopyNumber = Math.max(maxCopyNumber, parseInt(match[1], 10));
          }
        });

        const nextCopyNumber = maxCopyNumber + 1;
        newListName = `${baseName} (copy ${nextCopyNumber})`;
        newListTitle = `${baseTitle} (copy ${nextCopyNumber})`;
      }
    }

    // Calculate position for new list in target board
    const newListPosition = maxPos?.max ? parseFloat(maxPos.max) + 1 : 0;

    // Create new list in target board
    const newList = this.listRepository.create({
      board_id: dto.targetBoardId,
      title: newListTitle,
      name: newListName,
      position: newListPosition,
      archived: sourceList.archived,
      cover_img: sourceList.cover_img,
    });

    const savedList = await this.listRepository.save(newList);

    // Copy cards với members, labels, checklists
    const copiedCards: Card[] = [];
    const validUserIds = new Set(targetBoardMembers.map((m) => m.user_id));
    const labelColorMap = new Map(targetBoardLabels.map((l) => [l.color, l]));

    // Use transaction for data consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const sourceCard of sourceCards) {
        // 1. Create card
        const newCard = queryRunner.manager.create(Card, {
          list_id: savedList.id,
          board_id: dto.targetBoardId,
          title: sourceCard.title,
          description: sourceCard.description,
          position: sourceCard.position,
          created_by: userId,
          comments_count: 0,
          due_date: sourceCard.due_at,
          priority: sourceCard.priority,
          cover_color: sourceCard.cover_color,
          archived: sourceCard.archived,
          start_date: sourceCard.start_date,
        });

        const savedCard = await queryRunner.manager.save(Card, newCard);

        // 2. Copy card members
        if (sourceCard.cardMembers && sourceCard.cardMembers.length > 0) {
          const cardMembersToInsert = sourceCard.cardMembers
            .filter((cm) => validUserIds.has(cm.user_id))
            .map((cm) => ({
              card_id: savedCard.id,
              user_id: cm.user_id,
            }));

          if (cardMembersToInsert.length > 0) {
            await queryRunner.manager
              .createQueryBuilder()
              .insert()
              .into('card_members')
              .values(cardMembersToInsert)
              .orIgnore()
              .execute();
          }
        }

        // 3. Copy labels
        if (sourceCard.labels && sourceCard.labels.length > 0) {
          const cardLabelsToInsert = [];

          for (const sourceLabel of sourceCard.labels) {
            const targetLabel = labelColorMap.get(sourceLabel.color);
            if (targetLabel) {
              cardLabelsToInsert.push({
                card_id: savedCard.id,
                label_id: targetLabel.id,
              });
            } else {
              // Tạo label mới nếu chưa tồn tại
              const newLabel = await queryRunner.manager.save(Label, {
                board_id: dto.targetBoardId,
                name: sourceLabel.name,
                color: sourceLabel.color,
              });
              cardLabelsToInsert.push({
                card_id: savedCard.id,
                label_id: newLabel.id,
              });
              labelColorMap.set(newLabel.color, newLabel);
            }
          }

          if (cardLabelsToInsert.length > 0) {
            await queryRunner.manager
              .createQueryBuilder()
              .insert()
              .into('card_labels')
              .values(cardLabelsToInsert)
              .orIgnore()
              .execute();
          }
        }

        // Copy checklists
        if (sourceCard.checklists && sourceCard.checklists.length > 0) {
          for (const sourceChecklist of sourceCard.checklists) {
            const newChecklist = queryRunner.manager.create(Checklist, {
              card_id: savedCard.id,
              name: sourceChecklist.name,
              position: sourceChecklist.position,
            });

            const savedChecklist = await queryRunner.manager.save(Checklist, newChecklist);

            // Copy checklist items
            if (sourceChecklist.items && sourceChecklist.items.length > 0) {
              const itemsToInsert = sourceChecklist.items.map((item) => ({
                checklist_id: savedChecklist.id,
                content: item.content,
                position: item.position,
                is_checked: item.is_checked,
              }));

              await queryRunner.manager
                .createQueryBuilder()
                .insert()
                .into('checklist_items')
                .values(itemsToInsert)
                .execute();
            }
          }
        }

        copiedCards.push(savedCard);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error copying list:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }

    return {
      copiedList: savedList,
      copiedCards,
    };
  }

  async createLabel(boardId: string, dto: CreateLabelDto, userId: string): Promise<Label> {
    await this.checkBoardAccess(boardId, userId);
    const label = this.labelRepository.create({
      board_id: boardId,
      name: dto.name,
      color: dto.color,
    });
    return this.labelRepository.save(label);
  }

  async updateLabel(
    boardId: string,
    labelId: string,
    dto: UpdateLabelDto,
    userId: string,
  ): Promise<Label> {
    await this.checkBoardAccess(boardId, userId);
    await this.labelRepository.update({ id: labelId, board_id: boardId }, dto);
    const updated = await this.labelRepository.findOne({ where: { id: labelId } });
    if (!updated) {
      throw new NotFoundException('Label not found');
    }
    return updated;
  }

  async removeLabel(boardId: string, labelId: string, userId: string): Promise<void> {
    await this.checkBoardAccess(boardId, userId);
    await this.labelRepository.delete({ id: labelId, board_id: boardId });
  }

  async getBoardLabels(boardId: string): Promise<Label[]> {
    // await this.checkBoardAccess(boardId, userId);
    return this.labelRepository.find({ where: { board_id: boardId } });
  }

  private async checkBoardAccess(
    boardId: string,
    userId: string,
    requiredRole?: BoardRole,
  ): Promise<void> {
    const member = await this.boardMemberRepository.findOne({
      where: { board_id: boardId, user_id: userId },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this board');
    }
    if (requiredRole === BoardRole.OWNER && member.role !== BoardRole.OWNER) {
      throw new ForbiddenException('Owner access required');
    }
  }

  // change owner board
  async changeBoardOwner(
    boardId: string,
    newOwnerId: string,
    currentOwnerId: string,
  ): Promise<{ message: string; success: boolean }> {
    // ensure new owner is a member of the board
    const newOwner = await this.boardMemberRepository.findOne({
      where: { board_id: boardId, user_id: newOwnerId },
    });
    if (!newOwner) throw new NotFoundException('New owner must be a member of the board');

    // ensure new owner is not already the owner
    if (newOwner.role === 'owner') throw new ForbiddenException('User is already the owner');

    if (currentOwnerId === newOwnerId) {
      throw new ForbiddenException('You are already the owner of this board');
    }

    // update roles
    await this.boardMemberRepository.update(
      { board_id: boardId, user_id: newOwnerId },
      { role: BoardRole.OWNER },
    );
    await this.boardMemberRepository.update(
      { board_id: boardId, user_id: currentOwnerId },
      { role: BoardRole.MEMBER },
    );

    return { message: 'Board owner changed successfully', success: true };
  }

  //Check quyen owner
  private async checkOwnerAccess(userId: string, board: Board): Promise<void> {
    let hasPermission = board.created_by === userId;
    if (!hasPermission && board.workspace_id) {
      const workspaceMember = await this.workspaceMemberRepository.findOne({
        where: { workspace_id: board.workspace_id, user_id: userId },
      });
      if (workspaceMember && workspaceMember.role === 'owner') {
        hasPermission = true;
      }
    }
    if (!hasPermission) {
      throw new ForbiddenException('Only Board Owner or Workspce Owner can perform');
    }
  }

  //Archive/ Reopen board
  async archiveBoard(userId: string, boardId: string, isClosed: boolean): Promise<Board> {
    const board = await this.boardRepository.findOne({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException(`Board not found`);

    await this.checkOwnerAccess(userId, board);

    board.is_closed = isClosed;
    return this.boardRepository.save(board);
  }

  //delete Permanetly
  async deleteBoardPermanent(useId: string, boardId: string): Promise<void> {
    const board = await this.boardRepository.findOne({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException(`Board not found`);
    await this.checkOwnerAccess(useId, board);
    await this.boardRepository.delete(boardId);
  }

  // Invitation methods
  async createInvitation(
    boardId: string,
    userId: string,
    dto: CreateBoardInvitationDto,
  ): Promise<{ token: string; link: string; expires_at: Date }> {
    // giữ checkBoardAccess phòng khi service được gọi ngoài controller
    await this.checkBoardAccess(boardId, userId);

    const board = await this.boardRepository.findOne({
      where: { id: boardId },
    });
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    // Gen token
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

    const invitation = this.boardInvitationRepository.create({
      board_id: boardId,
      created_by: userId,
      invited_email: dto.invited_email,
      invited_user_id: dto.invited_user_id,
      expires_at: expiresAt,
    });

    const [savedInvitation, inviter] = await Promise.all([
      this.boardInvitationRepository.save(invitation),
      this.userRepository.findOne({
        where: { id: userId },
      }),
    ]);
    const inviterName = inviter?.name || 'A user';

    const payload: InvitationCachePayload = {
      invitationId: savedInvitation.id,
      boardId,
      invitedEmail: dto.invited_email,
      invitedUserId: dto.invited_user_id,
      createdBy: userId,
      boardName: board.name,
      inviterName,
      expiresAt: expiresAt.toISOString(),
    };

    // lưu payload vào Redis, không còn lưu token trong DB
    await this.redisClient.set(
      this.getInvitationRedisKey(token),
      JSON.stringify(payload),
      'EX',
      BoardsService.INVITE_TOKEN_TTL_SECONDS,
    );
    // const invitationLink = `${this.getAppUrl()}/boards/invitations/${token}/verify`;
    // const invitationLink = `${this.getAppUrl()}/boards/invitations/${token}/accept`;
    const invitationLink = `${process.env.FE_URL || 'http://localhost:5173/react-app'}/boards/invitations/${token}/accept`;

    // gửi email mời nếu có cung cấp email
    if (dto.invited_email) {
      this.mailService.sendBoardInvitation({
        board_name: board.name,
        invited_email: dto.invited_email,
        inviter_name: inviterName,
        invitation_link: invitationLink,
      });
    }

    return {
      token,
      link: invitationLink,
      expires_at: expiresAt,
    };
  }

  async verifyInvitation(token: string): Promise<InvitationVerificationResult> {
    const redisKey = this.getInvitationRedisKey(token);
    const cachedPayload = await this.redisClient.get(redisKey);

    if (!cachedPayload) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    // parse JSON string thành object
    let payload: InvitationCachePayload;
    try {
      payload = JSON.parse(cachedPayload) as InvitationCachePayload;
    } catch (error) {
      await this.redisClient.del(redisKey);
      throw new NotFoundException('Invalid or expired invitation');
    }

    return {
      invitationId: payload.invitationId,
      boardId: payload.boardId,
      boardName: payload.boardName,
      inviterName: payload.inviterName,
      invitedEmail: payload.invitedEmail,
      invitedUserId: payload.invitedUserId,
      expiresAt: payload.expiresAt,
    };
  }

  async acceptInvitation(token: string, userId: string): Promise<Board> {
    const redisKey = this.getInvitationRedisKey(token);
    const invitation = await this.verifyInvitation(token);

    const invitationRecord = await this.boardInvitationRepository.findOne({
      where: { id: invitation.invitationId },
    });

    if (!invitationRecord) {
      await this.redisClient.del(redisKey);
      throw new NotFoundException('Invalid or expired invitation');
    }

    if (invitationRecord.is_used || invitationRecord.isExpired()) {
      await this.redisClient.del(redisKey);
      throw new NotFoundException('Invalid or expired invitation');
    }

    // Check if user is already a member
    const existingMember = await this.boardMemberRepository.findOne({
      where: { board_id: invitation.boardId, user_id: userId },
    });

    // If not a member yet, add them as board member
    if (!existingMember) {
      await this.boardMemberRepository.save({
        board_id: invitation.boardId,
        user_id: userId,
        role: BoardRole.MEMBER,
      });
    }

    // Mark invitation as used
    await this.boardInvitationRepository.update(
      { id: invitation.invitationId },
      { is_used: true, used_by: userId },
    );

    await this.redisClient.del(redisKey);

    const board = await this.boardRepository.findOne({
      where: { id: invitation.boardId },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    return board;
  }

  async joinBoardByInviteLink(token: string, userId: string) {
    // Find board by invite token
    const board = await this.boardRepository.findOne({
      where: { invite_link_token: token },
      relations: ['workspace'],
    });

    if (!board) {
      throw new NotFoundException('Invalid invite link');
    }

    // Check if user already a member
    const existingMember = await this.boardMemberRepository.findOne({
      where: { board_id: board.id, user_id: userId },
    });

    if (existingMember) {
      return {
        id: board.id,
        name: board.name,
        description: board.description,
        message: 'You are already a member of this board',
      };
    }

    // If board belongs to workspace, check workspace membership
    if (board.workspace_id) {
      const workspaceMember = await this.dataSource.getRepository(WorkspaceMember).findOne({
        where: {
          workspace_id: board.workspace_id,
          user_id: userId,
          status: 'accepted',
        },
      });

      if (!workspaceMember) {
        throw new ForbiddenException('You must be a workspace member to join this board');
      }
    }

    // Add user as board member
    const newMember = this.boardMemberRepository.create({
      board_id: board.id,
      user_id: userId,
      role: BoardRole.MEMBER,
    });

    await this.boardMemberRepository.save(newMember);

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      message: 'Successfully joined board',
    };
  }

  private generateToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  // tạo key
  private getInvitationRedisKey(token: string): string {
    return `board:invite:${token}`;
  }

  private getAppUrl(): string {
    return process.env.APP_URL || 'http://localhost:5000';
  }

  // Board Template Methods
  async createBoardFromTemplate(userId: string, dto: CreateFromTemplateDto) {
    // Get data from board template
    const template = await this.boardTemplateRepository.findOne({
      where: { id: dto.templateId },
      relations: ['lists', 'lists.cards'],
      order: {
        lists: { position: 'ASC' },
      },
    });
    if (!template) throw new NotFoundException('Board template not found');

    // Initialize Transaction
    const queryRunner = this.dataSource.createQueryRunner(); // createQueryRunner() dùng để khởi tạo một query runner mới
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create new board
      const newBoard = queryRunner.manager.create(Board, {
        name: dto.boardName || template.name,
        description: template.description,
        cover_url: template.cover_url,
        workspace_id: dto.workspaceId,
        created_by: userId,
        is_closed: false,
        invite_link_token: this.generateToken(),
        visibility: BoardVisibility.PUBLIC,
      });
      if (!newBoard) throw new BadRequestException('Failed to create board from template');
      const savedBoard = await queryRunner.manager.save(newBoard);

      // 2. Add Board Owner
      const ownerMember = queryRunner.manager.create(BoardMember, {
        board_id: savedBoard.id,
        user_id: userId,
        role: BoardRole.OWNER,
      });
      await queryRunner.manager.save(ownerMember);

      // 3. Process Lists and Cards from template
      const allCardsToInsert: any[] = [];

      for (const templateList of template.lists || []) {
        // a. Create Real List
        const newList = queryRunner.manager.create(List, {
          board_id: savedBoard.id,
          title: templateList.name,
          name: templateList.name,
          position: templateList.position,
          cover_img: templateList.cover_img || null,
          archived: false,
        });
        const savedList = await queryRunner.manager.save(newList);

        // b. Map Cards
        if (templateList.cards && templateList.cards.length > 0) {
          const mappedCards = templateList.cards.map((templateCard) => ({
            board_id: savedBoard.id,
            list_id: savedList.id,
            title: templateCard.title,
            description: templateCard.description,
            position: templateCard.position,
            priority: templateCard.priority,
            created_by: userId,
            created_at: new Date(),
            updated_at: new Date(),
          }));

          allCardsToInsert.push(...mappedCards);
        }
      }

      // throw new InternalServerErrorException('Test rollback transaction'); // test rollback

      // 4. Bulk Insert all cards
      if (allCardsToInsert.length > 0) {
        await queryRunner.manager.insert(Card, allCardsToInsert);
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      return savedBoard;
    } catch (err) {
      // have any error => ROLLBACK transaction
      await queryRunner.rollbackTransaction();
      console.error('Error creating board from template:', err);
      throw err;
    } finally {
      // Giải phóng kết nối
      await queryRunner.release();
    }
  }
}
