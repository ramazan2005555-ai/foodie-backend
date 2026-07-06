import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
@Entity('menu_categories')
export class MenuCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  image: string;

  @ManyToOne('Restaurant', 'menuCategories')
  @JoinColumn({ name: 'restaurantId' })
  restaurant: import('../restaurants/restaurant.entity').Restaurant;

  @Column()
  restaurantId: string;

  @OneToMany('MenuItem', 'category')
  items: import('./menu-item.entity').MenuItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
