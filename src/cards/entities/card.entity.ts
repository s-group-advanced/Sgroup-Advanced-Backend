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
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { List } from '../../boards/entities/list.entity';
import { User } from '../../users/entities/user.entity';
import { Attachment } from './attachment.entity';
import { Label } from '../../boards/entities/label.entity';
import { CardLabel } from './card-label.entity';
import { Checklist } from './checklist.entity';

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

  @ManyToMany(() => Label, { cascade: false })
  @JoinTable({
    name: 'card_labels',
    joinColumn: { name: 'card_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'label_id', referencedColumnName: 'id' },
  })
  labels?: Label[];
}
