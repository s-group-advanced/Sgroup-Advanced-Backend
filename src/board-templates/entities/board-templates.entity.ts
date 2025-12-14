import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ListTemplate } from './list-templates.entity';

@Entity('board_templates')
export class BoardTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Template name
  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // cover image url
  @Column({ type: 'text', nullable: true })
  cover_url?: string;

  @OneToMany(() => ListTemplate, (list) => list.template)
  lists?: ListTemplate[];
}
