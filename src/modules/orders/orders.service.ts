import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from './order.entity';
import { OrderGateway } from './order.gateway';
import { MenuService } from '../menu/menu.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private orderGateway: OrderGateway,
    private menuService: MenuService,
    private usersService: UsersService,
  ) {}

  async create(
    userId: string,
    createData: Partial<Order>,
  ): Promise<Order> {
    const orderNumber = await this.generateOrderNumber();

    let subtotal = 0;
    for (const item of createData.items || []) {
      const itemTotal = item.price * item.quantity;
      let modifiersTotal = 0;
      if (item.modifiers) {
        modifiersTotal = item.modifiers.reduce(
          (sum, mod) => sum + mod.price,
          0,
        );
      }
      item.totalPrice = itemTotal + modifiersTotal;
      subtotal += item.totalPrice;

      await this.menuService.incrementSoldCount(item.id, item.quantity);
    }

    const deliveryCost = createData.deliveryCost || 0;
    const discount = createData.discount || 0;
    const tip = createData.tip || 0;
    const tax = subtotal * 0.1;
    const bonusPointsUsed = createData.bonusPointsUsed || 0;
    const bonusDiscount = bonusPointsUsed * 0.01;
    const total = subtotal + deliveryCost + tip + tax - discount - bonusDiscount;

    let bonusPointsEarned = Math.floor(subtotal * 0.05);

    const order = this.orderRepository.create({
      orderNumber,
      userId,
      restaurantId: createData.restaurantId,
      items: createData.items,
      subtotal,
      deliveryCost,
      discount,
      tip,
      tax,
      total: Math.max(total, 0),
      bonusPointsUsed,
      bonusPointsEarned,
      paymentMethod: createData.paymentMethod || PaymentMethod.CARD,
      deliveryAddress: createData.deliveryAddress,
      notes: createData.notes,
      couponCode: createData.couponCode,
      scheduledAt: createData.scheduledAt,
      status: OrderStatus.CREATED,
      isPaid: false,
    });

    const savedOrder = await this.orderRepository.save(order);

    if (bonusPointsUsed > 0) {
      await this.usersService.deductBonusPoints(userId, bonusPointsUsed);
    }

    this.orderGateway.sendOrderUpdate(savedOrder);

    return savedOrder;
  }

  async findAll(query: any): Promise<any> {
    const {
      page = 1,
      limit = 20,
      status,
      userId,
      restaurantId,
      startDate,
      endDate,
    } = query;

    const where: any = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (restaurantId) where.restaurantId = restaurantId;
    if (startDate && endDate) {
      where.createdAt = {
        $between: [new Date(startDate), new Date(endDate)],
      };
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user', 'restaurant', 'delivery'],
    });

    return {
      items: orders,
      meta: {
        totalItems: total,
        itemCount: orders.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'restaurant', 'delivery'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findByUser(userId: string, page: number = 1, limit: number = 20): Promise<any> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['restaurant', 'delivery'],
    });

    return {
      items: orders,
      meta: {
        totalItems: total,
        itemCount: orders.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findByRestaurant(
    restaurantId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { restaurantId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user', 'delivery'],
    });

    return {
      items: orders,
      meta: {
        totalItems: total,
        itemCount: orders.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    additionalData?: any,
  ): Promise<Order> {
    const order = await this.findById(id);

    if (!this.isValidTransition(order.status, status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    order.status = status;

    const timestampField = this.getStatusTimestampField(status);
    if (timestampField) {
      order[timestampField] = new Date();
    }

    if (status === OrderStatus.DELIVERED) {
      order.isPaid = true;
      order.paidAt = new Date();
      if (order.bonusPointsEarned > 0) {
        await this.usersService.addBonusPoints(
          order.userId,
          order.bonusPointsEarned,
        );
      }
    }

    if (status === OrderStatus.CANCELLED && additionalData?.reason) {
      order.cancellationReason = additionalData.reason;
    }

    if (additionalData?.deliveryId) {
      order.deliveryId = additionalData.deliveryId;
    }

    const updated = await this.orderRepository.save(order);
    this.orderGateway.sendOrderUpdate(updated);

    return updated;
  }

  async cancelOrder(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.findById(id);

    if (order.userId !== userId) {
      throw new ForbiddenException('Not authorized to cancel this order');
    }

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel order in ${order.status} status`,
      );
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by user';

    if (order.bonusPointsUsed > 0) {
      await this.usersService.addBonusPoints(
        userId,
        order.bonusPointsUsed,
      );
    }

    const updated = await this.orderRepository.save(order);
    this.orderGateway.sendOrderUpdate(updated);

    return updated;
  }

  async getActiveOrders(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: {
        userId,
        status: In([
          OrderStatus.CREATED,
          OrderStatus.CONFIRMED,
          OrderStatus.PREPARING,
          OrderStatus.READY,
          OrderStatus.PICKED_UP,
          OrderStatus.DELIVERING,
        ]),
      },
      order: { createdAt: 'DESC' },
      relations: ['restaurant', 'delivery'],
    });
  }

  async getOrderHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: {
        userId,
        status: In([OrderStatus.DELIVERED, OrderStatus.CANCELLED]),
      },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['restaurant'],
    });

    return {
      items: orders,
      meta: {
        totalItems: total,
        itemCount: orders.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async assignDelivery(id: string, deliveryId: string): Promise<Order> {
    const order = await this.findById(id);
    order.deliveryId = deliveryId;
    order.status = OrderStatus.PICKED_UP;
    order.pickedUpAt = new Date();
    const updated = await this.orderRepository.save(order);
    this.orderGateway.sendOrderUpdate(updated);
    return updated;
  }

  private isValidTransition(
    current: OrderStatus,
    next: OrderStatus,
  ): boolean {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.CREATED]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
      [OrderStatus.PICKED_UP]: [OrderStatus.DELIVERING],
      [OrderStatus.DELIVERING]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    return transitions[current]?.includes(next) || false;
  }

  private getStatusTimestampField(
    status: OrderStatus,
  ): string | null {
    const map = {
      [OrderStatus.CONFIRMED]: 'confirmedAt',
      [OrderStatus.PREPARING]: 'preparingAt',
      [OrderStatus.READY]: 'readyAt',
      [OrderStatus.PICKED_UP]: 'pickedUpAt',
      [OrderStatus.DELIVERING]: 'deliveringAt',
      [OrderStatus.DELIVERED]: 'deliveredAt',
      [OrderStatus.CANCELLED]: 'cancelledAt',
    };
    return map[status] || null;
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const prefix = `FD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const lastOrder = await this.orderRepository.findOne({
      where: { orderNumber: Like(`${prefix}%`) },
      order: { orderNumber: 'DESC' },
    });

    let seq = 1;
    if (lastOrder) {
      seq = parseInt(lastOrder.orderNumber.slice(-4), 10) + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async getOrderStats(restaurantId?: string): Promise<any> {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;

    const totalOrders = await this.orderRepository.count({ where });
    const totalRevenue = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'total')
      .where(where)
      .getRawOne();

    const statusCounts = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('order.status')
      .getRawMany();

    return {
      totalOrders,
      totalRevenue: totalRevenue?.total || 0,
      statusCounts: statusCounts.reduce((acc, curr) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      }, {}),
    };
  }
}
