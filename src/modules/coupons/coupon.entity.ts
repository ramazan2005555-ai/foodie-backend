import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  FREE_DELIVERY = 'free_delivery',
  BONUS_POINTS = 'bonus_points',
}

export enum CouponStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ type: 'varchar', default: CouponType.FIXED })
  type: CouponType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minOrder: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscount: number;

  @Column({ default: 0 })
  usageLimit: number;

  @Column({ default: 0 })
  usedCount: number;

  @Column({ nullable: true })
  perUserLimit: number;

  @Column({ type: 'varchar', default: CouponStatus.ACTIVE })
  status: CouponStatus;

  @Column({ nullable: true })
  restaurantId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  startsAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isFirstOrderOnly: boolean;

  @Column({ type: 'text', nullable: true })
  applicableUserIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
