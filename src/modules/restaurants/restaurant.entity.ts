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
import { User } from '../users/user.entity';

export enum RestaurantStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ nullable: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  cover: string;

  @Column({ type: 'text', nullable: true })
  photos: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewsCount: number;

  @Column({ type: 'int', nullable: true })
  deliveryTimeMin: number;

  @Column({ type: 'int', nullable: true })
  deliveryTimeMax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minOrder: number;

  @Column({ type: 'simple-json', nullable: true })
  workingHours: WorkingHours;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number;

  @Column({ type: 'text', nullable: true })
  categories: string[];

  @Column({ type: 'text', nullable: true })
  cuisines: string[];

  @Column({ type: 'varchar', default: RestaurantStatus.PENDING })
  status: RestaurantStatus;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionRate: number;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  email: string;

  @ManyToOne(() => User, (user) => user.restaurants)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ nullable: true })
  ownerId: string;

  @OneToMany('MenuCategory', 'restaurant')
  menuCategories: import('../menu/menu-category.entity').MenuCategory[];

  @OneToMany('Order', 'restaurant')
  orders: import('../orders/order.entity').Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface WorkingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
  isOpen: boolean;
}
