import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';


export enum OrderStatus {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  DELIVERING = 'delivering',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CARD = 'card',
  CASH = 'cash',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BONUS_POINTS = 'bonus_points',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNumber: string;

  @Column({ type: 'varchar', default: OrderStatus.CREATED })
  status: OrderStatus;

  @Column({ type: 'simple-json' })
  items: OrderItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tip: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  bonusPointsUsed: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  bonusPointsEarned: number;

  @Column({ type: 'varchar', default: PaymentMethod.CARD })
  paymentMethod: PaymentMethod;

  @Column({ type: 'simple-json', nullable: true })
  deliveryAddress: DeliveryAddress;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  couponCode: string;

  @Column({ nullable: true })
  scheduledAt: Date;

  @Column({ nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  preparingAt: Date;

  @Column({ nullable: true })
  readyAt: Date;

  @Column({ nullable: true })
  pickedUpAt: Date;

  @Column({ nullable: true })
  deliveringAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancellationReason: string;

  @Column({ default: false })
  isPaid: boolean;

  @Column({ nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  paymentId: string;

  @ManyToOne('User', 'orders')
  @JoinColumn({ name: 'userId' })
  user: import('../users/user.entity').User;

  @Column()
  userId: string;

  @ManyToOne('Restaurant', 'orders')
  @JoinColumn({ name: 'restaurantId' })
  restaurant: import('../restaurants/restaurant.entity').Restaurant;

  @Column()
  restaurantId: string;

  @ManyToOne('Delivery', 'orders')
  @JoinColumn({ name: 'deliveryId' })
  delivery: import('../delivery/delivery.entity').Delivery;

  @Column({ nullable: true })
  deliveryId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
  modifiers?: OrderItemModifier[];
  image?: string;
  notes?: string;
}

export interface OrderItemModifier {
  name: string;
  option: string;
  price: number;
}

export interface DeliveryAddress {
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
}
