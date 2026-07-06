import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../../common/guards/roles.guard';


@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Exclude()
  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true, unique: true })
  phone: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ default: 0 })
  bonusPoints: number;

  @Column({ nullable: true })
  googleId: string;

  @Column({ nullable: true })
  appleId: string;

  @Exclude()
  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'simple-json', nullable: true })
  addresses: Address[];

  @Column({ type: 'text', nullable: true })
  favorites: string[];

  @Column({ nullable: true })
  deviceToken: string;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Order', 'user')
  orders: import('../orders/order.entity').Order[];

  @OneToMany('Restaurant', 'owner')
  restaurants: import('../restaurants/restaurant.entity').Restaurant[];

  @OneToMany('Delivery', 'courier')
  deliveries: import('../delivery/delivery.entity').Delivery[];

  @ManyToMany('Restaurant')
  @JoinTable({ name: 'user_favorite_restaurants' })
  favoriteRestaurants: import('../restaurants/restaurant.entity').Restaurant[];
}

export interface Address {
  id: string;
  label: string;
  street: string;
  building: string;
  apartment?: string;
  entrance?: string;
  floor?: number;
  intercom?: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}
