import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BoardTemplate } from './board-templates.entity';
import { CardTemplate } from './card-templates.entity';

@Entity('list_templates')
export class ListTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string; // Mapping with name and title of real lists

  @Column({ type: 'float', default: 0.0 })
  position!: number;

  // cover img link
  @Column({ type: 'text', nullable: true })
  cover_img?: string;

  @ManyToOne(() => BoardTemplate, (bt) => bt.lists, { onDelete: 'CASCADE' })
  template!: BoardTemplate;

  @OneToMany(() => CardTemplate, (ct) => ct.list)
  cards?: CardTemplate[];
}
