import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ListTemplate } from './list-templates.entity';

@Entity('card_templates')
export class CardTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'float', default: 0.0 })
  position!: number;

  @ManyToOne(() => ListTemplate, (lt) => lt.cards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list!: ListTemplate;

  @Column({ type: 'text', nullable: true })
  priority?: 'low' | 'medium' | 'high';

  @Column({ type: 'text', nullable: true })
  cover_img?: string;
}
