import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  ManyToMany,
  JoinTable,
  AfterLoad,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { List } from '../../boards/entities/list.entity';
import { Board } from '../../boards/entities/board.entity';
import { User } from '../../users/entities/user.entity';
import { Attachment } from './attachment.entity';
import { Label } from '../../boards/entities/label.entity';
import { CardLabel } from './card-label.entity';
import { Checklist } from './checklist.entity';
import { CardMember } from './card-member.entity';

export enum CardStatus {
  COMPLETE = 'complete',
  OVERDUE = 'overdue',
  DUE_SOON = 'due soon',
  NORMAL = 'normal',
  NO_DATE = 'no date',
}

@Entity('cards')
export class Card {
  @ApiProperty({ example: '91bbf2a1-8d84-42d0-9d5f-c7850d2feadc' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Index('idx_cards_list_id')
  @Column({ type: 'uuid' })
  list_id!: string;

  @ManyToOne(() => List, (l) => l, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list?: List;

  @ApiProperty()
  @Index('idx_cards_board_id')
  @Column({ type: 'uuid', nullable: false })
  board_id!: string;

  @ManyToOne(() => Board, (b) => b, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board?: Board;

  @ApiProperty()
  @Column({ type: 'text' })
  title!: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty()
  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  position!: number;

  // composite index list_id + position for fast ordering
  @Index('idx_cards_list_pos1', ['list_id', 'position'])
  @ApiProperty()
  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @ManyToOne(() => User, (u) => u.cardsCreated, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_user?: User;

  @ApiProperty()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @ApiProperty()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at!: Date;

  @ApiProperty()
  @Column({ type: 'uuid', nullable: true })
  cover_attachment_id?: string;

  @ManyToOne(() => Attachment, (a) => a, {
    onDelete: 'SET NULL',
    deferrable: 'INITIALLY DEFERRED' as any,
  })
  @JoinColumn({ name: 'cover_attachment_id' })
  cover_attachment?: Attachment;

  @ApiProperty()
  @Column({ type: 'integer', default: 0 })
  comments_count!: number;

  //cover_color
  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  cover_color?: string;

  @ApiProperty()
  @Column({ type: 'integer', default: 0 })
  attachments_count!: number;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  priority?: 'low' | 'medium' | 'high';

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  archived!: boolean;

  @Index('idx_cards_archived')
  @ApiProperty()
  @Index('idx_cards_due_at')
  @Column({ type: 'timestamptz', nullable: true })
  due_at?: Date;

  @OneToMany(() => Attachment, (a) => a.card)
  attachments?: Attachment[];

  @OneToMany(() => CardLabel, (cl) => cl.card)
  cardLabels?: CardLabel[];

  @OneToMany(() => Checklist, (checklist) => checklist.card)
  checklists?: Checklist[];

  @OneToMany(() => CardMember, (cm) => cm.card)
  cardMembers?: CardMember[];

  @ManyToMany(() => Label, { cascade: false })
  @JoinTable({
    name: 'card_labels',
    joinColumn: { name: 'card_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'label_id', referencedColumnName: 'id' },
  })
  labels?: Label[];

  // start date
  @ApiProperty()
  @Column({ type: 'timestamptz', nullable: true })
  start_date?: Date | null;

  // end date
  @ApiProperty()
  @Column({ type: 'timestamptz', nullable: true })
  end_date?: Date | null;

  // status completed
  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  is_completed?: boolean;

  status?: CardStatus;

  @AfterLoad()
  calculateStatus() {
    if (!this.end_date) {
      this.status = CardStatus.NO_DATE; // không có ngày kết thúc
      return;
    }

    if (this.is_completed) {
      this.status = CardStatus.COMPLETE; // đã hoàn thành
      return;
    }

    const now = new Date();
    const end = new Date(this.end_date);
    const timeDiff = end.getTime() - now.getTime();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    if (timeDiff < 0) {
      this.status = CardStatus.OVERDUE; // quá hạn
    } else if (timeDiff < oneDayInMs) {
      this.status = CardStatus.DUE_SOON; // sắp hạn
    } else {
      this.status = CardStatus.NORMAL; // bình thường
    }
  }
}
