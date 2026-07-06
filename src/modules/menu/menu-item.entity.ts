import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountPrice: number;

  @Column({ nullable: true })
  image: string;

  @Column({ type: 'text', nullable: true })
  photos: string[];

  @Column({ type: 'text', nullable: true })
  ingredients: string;

  @Column({ nullable: true })
  calories: number;

  @Column({ nullable: true })
  weight: number;

  @Column({ nullable: true })
  weightUnit: string;

  @Column({ default: false })
  isPopular: boolean;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  modifiers: Modifier[];

  @Column({ type: 'text', nullable: true })
  dietaryTags: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  estimatedPrepTime: number;

  @Column({ default: 0 })
  soldCount: number;

  @ManyToOne('MenuCategory', 'items')
  @JoinColumn({ name: 'categoryId' })
  category: import('./menu-category.entity').MenuCategory;

  @Column()
  categoryId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface Modifier {
  id: string;
  name: string;
  required: boolean;
  maxChoices: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}
