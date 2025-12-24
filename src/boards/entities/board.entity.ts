import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntityTimestamps } from '../../entities/base.entity';
import { BoardMember } from './board-member.entity';
import { List } from './list.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { BoardInvitation } from './board-invitation.entity';

export enum BoardVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

@Entity('boards')
export class Board extends BaseEntityTimestamps {
  @ApiProperty({ example: '91bbf2a1-8d84-42d0-9d5f-c7850d2feadc' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Index('idx_boards_workspace_id')
  @Column({ type: 'uuid', nullable: true })
  workspace_id?: string;

  @ManyToOne(() => Workspace, (w) => w.boards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @ApiProperty()
  @Column({ type: 'text' })
  name!: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  cover_url?: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  is_closed!: boolean;

  @ApiProperty({ description: 'Permanent invite token for joining the board' })
  @Column({ type: 'text', unique: true, nullable: true })
  invite_link_token?: string;

  @ApiProperty({ example: '91bbf2a1-8d84-42d0-9d5f-c7850d2feadc' })
  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @OneToMany(() => BoardMember, (bm) => bm.board)
  members?: BoardMember[];

  @OneToMany(() => List, (l) => l.board)
  lists?: List[];

  @OneToMany(() => BoardInvitation, (inv) => inv.board)
  invitations?: BoardInvitation[];

  // // ManyToMany convenience accessor to users via board_members join table
  // @ManyToMany(() => User, { cascade: false })
  // @JoinTable({
  //   name: 'board_members',
  //   joinColumn: { name: 'board_id', referencedColumnName: 'id' },
  //   inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  // })
  // users?: any[];

  @ApiProperty({ enum: BoardVisibility, example: BoardVisibility.PUBLIC })
  @Column({
    type: 'enum',
    enum: BoardVisibility,
    default: BoardVisibility.PUBLIC,
  })
  visibility!: BoardVisibility;
}
