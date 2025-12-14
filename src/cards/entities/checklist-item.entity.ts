import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Checklist } from './checklist.entity';

@Entity('checklist_items')
export class ChecklistItem {
  @ApiProperty({ example: '91bbf2a1-8d84-42d0-9d5f-c7850d2feadc' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @ApiProperty()
  @Index('idx_items_checklist_pos')
  @Column({ type: 'uuid' })
  checklist_id!: string;

  @ManyToOne(() => Checklist, (checklist) => checklist.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_id' })
  checklist?: Checklist;

  @ApiProperty()
  @Column({ type: 'text' })
  content!: string;

  @ApiProperty()
  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  position!: number;

  @ApiProperty()
  @ApiProperty()
  @Index('idx_items_checked')
  @Column({ type: 'boolean', default: false })
  is_checked!: boolean;

  @ApiProperty()
  @Index('idx_items_due')
  @Column({ type: 'timestamptz', nullable: true })
  due_at?: Date;

  @ApiProperty()
  @Column({ type: 'timestamptz', nullable: true })
  completed_at?: Date;
}
