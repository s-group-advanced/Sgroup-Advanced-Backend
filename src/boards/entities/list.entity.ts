import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Board } from './board.entity';
import { Card } from 'src/cards/entities/card.entity';

@Entity('lists')
export class List {
  @ApiProperty({ example: '91bbf2a1-8d84-42d0-9d5f-c7850d2feadc' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Index('idx_lists_board_id')
  @Column({ type: 'uuid' })
  board_id!: string;

  @ManyToOne(() => Board, (b) => b.lists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  // board join column is board_id
  board?: Board;

  @ApiProperty()
  @Column({ type: 'text' })
  title!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  name!: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  archived!: boolean;

  @ApiProperty()
  @ApiProperty()
  @Index('idx_lists_board_pos')
  @Column({ type: 'float', default: 0.0 })
  position!: number;

  // cover img link
  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  cover_img!: string | null;

  @OneToMany(() => Card, (card) => card.list)
  cards?: Card[];
}
