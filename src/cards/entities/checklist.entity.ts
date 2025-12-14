import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Card } from './card.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('checklists')
export class Checklist {
  @ApiProperty({ example: '91bbf2a1-8d84-42d0-9d5f-c7850d2feadc' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @ApiProperty()
  @Index('idx_checklists_card_pos')
  @Column({ type: 'uuid' })
  card_id!: string;

  @ManyToOne(() => Card, (card) => card.checklists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card?: Card;

  @ApiProperty()
  @Column({ type: 'text' })
  name!: string;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  position!: number;

  @ApiProperty()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @OneToMany(() => ChecklistItem, (item) => item.checklist)
  items?: ChecklistItem[];
}
