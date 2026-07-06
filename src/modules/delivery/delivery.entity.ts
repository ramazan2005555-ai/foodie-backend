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


export enum DeliveryStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum DeliveryType {
  STANDARD = 'standard',
  EXPRESS = 'express',
  SCHEDULED = 'scheduled',
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: DeliveryStatus.PENDING })
  status: DeliveryStatus;

  @Column({ type: 'varchar', default: DeliveryType.STANDARD })
  type: DeliveryType;

  @Column({ type: 'simple-json', nullable: true })
  pickupAddress: DeliveryAddress;

  @Column({ type: 'simple-json' })
  deliveryAddress: DeliveryAddress;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  pickupLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  pickupLng: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLng: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLng: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  distance: number;

  @Column({ type: 'int', nullable: true })
  estimatedDuration: number;

  @Column({ type: 'int', nullable: true })
  actualDuration: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryFee: number;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  pickedUpAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  estimatedDeliveryAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  route: string[];

  @ManyToOne('User', 'deliveries')
  @JoinColumn({ name: 'courierId' })
  courier: import('../users/user.entity').User;

  @Column({ nullable: true })
  courierId: string;

  @OneToMany('Order', 'delivery')
  orders: import('../orders/order.entity').Order[];

  @Column({ nullable: true })
  orderId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface DeliveryAddress {
  street: string;
  building: string;
  apartment?: string;
  lat: number;
  lng: number;
  label?: string;
}
