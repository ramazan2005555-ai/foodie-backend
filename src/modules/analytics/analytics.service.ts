import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../orders/order.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { User } from '../users/user.entity';
import { MenuItem } from '../menu/menu-item.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
  ) {}

  async getDashboardStats(
    restaurantId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orderWhere: any = {
      createdAt: Between(start, end),
    };
    if (restaurantId) orderWhere.restaurantId = restaurantId;

    const totalOrders = await this.orderRepository.count({
      where: { ...orderWhere },
    });

    const completedOrders = await this.orderRepository.count({
      where: { ...orderWhere, status: OrderStatus.DELIVERED },
    });

    const revenueResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'total')
      .where({
        ...orderWhere,
        status: OrderStatus.DELIVERED,
      })
      .getRawOne();

    const totalRevenue = parseFloat(revenueResult?.total) || 0;

    const avgCheck = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    const totalUsers = await this.userRepository.count();

    const newUsers = await this.userRepository.count({
      where: { createdAt: Between(start, end) },
    });

    const popularItems = await this.getPopularItems(restaurantId, start, end);

    const ordersByDay = await this.getOrdersByDay(
      restaurantId,
      start,
      end,
    );

    const revenueByDay = await this.getRevenueByDay(
      restaurantId,
      start,
      end,
    );

    const statusDistribution = await this.getStatusDistribution(
      restaurantId,
      start,
      end,
    );

    return {
      period: { start, end },
      totalOrders,
      completedOrders,
      totalRevenue,
      averageCheck: avgCheck,
      totalUsers,
      newUsers,
      popularItems,
      ordersByDay,
      revenueByDay,
      statusDistribution,
    };
  }

  async getPopularItems(
    restaurantId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 10,
  ): Promise<any[]> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select('order.items', 'items')
      .where('order.status = :status', { status: OrderStatus.DELIVERED });

    if (restaurantId) {
      query.andWhere('order.restaurantId = :restaurantId', { restaurantId });
    }
    if (startDate && endDate) {
      query.andWhere('order.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    const orders = await query.getMany();

    const itemCountMap = new Map<string, { name: string; count: number; revenue: number; image?: string }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemCountMap.get(item.id) || {
          name: item.name,
          count: 0,
          revenue: 0,
          image: item.image,
        };
        existing.count += item.quantity;
        existing.revenue += item.totalPrice;
        itemCountMap.set(item.id, existing);
      }
    }

    return Array.from(itemCountMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getOrdersByDay(
    restaurantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('order.status = :status', { status: OrderStatus.DELIVERED });

    if (restaurantId) {
      query.andWhere('order.restaurantId = :restaurantId', { restaurantId });
    }
    if (startDate && endDate) {
      query.andWhere('order.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    return query
      .groupBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();
  }

  async getRevenueByDay(
    restaurantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('SUM(order.total)', 'revenue')
      .where('order.status = :status', { status: OrderStatus.DELIVERED });

    if (restaurantId) {
      query.andWhere('order.restaurantId = :restaurantId', { restaurantId });
    }
    if (startDate && endDate) {
      query.andWhere('order.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    return query
      .groupBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();
  }

  async getStatusDistribution(
    restaurantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (restaurantId) {
      query.andWhere('order.restaurantId = :restaurantId', { restaurantId });
    }
    if (startDate && endDate) {
      query.andWhere('order.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    const results = await query
      .groupBy('order.status')
      .getRawMany();

    return results.reduce((acc, curr) => {
      acc[curr.status] = parseInt(curr.count);
      return acc;
    }, {});
  }

  async getRestaurantRanking(
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.orderRepository
      .createQueryBuilder('order')
      .select('order.restaurantId', 'restaurantId')
      .addSelect('COUNT(*)', 'totalOrders')
      .addSelect('SUM(order.total)', 'totalRevenue')
      .addSelect('AVG(order.total)', 'avgOrderValue')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('order.createdAt BETWEEN :start AND :end', {
        start,
        end,
      })
      .groupBy('order.restaurantId')
      .orderBy('totalRevenue', 'DESC')
      .limit(20)
      .getRawMany();
  }

  async getUserAnalytics(): Promise<any> {
    const totalUsers = await this.userRepository.count();

    const roleDistribution = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    const usersByDay = await this.userRepository
      .createQueryBuilder('user')
      .select("TO_CHAR(user.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where(
        'user.createdAt >= :start',
        { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      )
      .groupBy("TO_CHAR(user.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const premiumUsers = await this.userRepository.count({
      where: { isPremium: true },
    });

    return {
      totalUsers,
      premiumUsers,
      premiumPercentage:
        totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0,
      roleDistribution: roleDistribution.reduce((acc, curr) => {
        acc[curr.role] = parseInt(curr.count);
        return acc;
      }, {}),
      usersByDay,
    };
  }

  async getFinancialReport(
    restaurantId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const where: any = {
      createdAt: Between(start, end),
      status: OrderStatus.DELIVERED,
    };
    if (restaurantId) where.restaurantId = restaurantId;

    const revenueData = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.subtotal)', 'subtotal')
      .addSelect('SUM(order.deliveryCost)', 'deliveryRevenue')
      .addSelect('SUM(order.tip)', 'tipRevenue')
      .addSelect('SUM(order.tax)', 'tax')
      .addSelect('SUM(order.discount)', 'discounts')
      .addSelect('SUM(order.total)', 'netRevenue')
      .where(where)
      .getRawOne();

    const paymentFees = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.fee)', 'totalFees')
      .where('payment.status = :status', {
        status: PaymentStatus.SUCCEEDED,
      })
      .andWhere('payment.createdAt BETWEEN :start AND :end', {
        start,
        end,
      })
      .getRawOne();

    const subtotal = parseFloat(revenueData?.subtotal) || 0;
    const deliveryRevenue = parseFloat(revenueData?.deliveryRevenue) || 0;
    const tipRevenue = parseFloat(revenueData?.tipRevenue) || 0;
    const grossRevenue = subtotal + deliveryRevenue + tipRevenue;

    const netRevenue = parseFloat(revenueData?.netRevenue) || 0;
    const totalFees = parseFloat(paymentFees?.totalFees) || 0;

    return {
      period: { start, end },
      grossRevenue,
      netRevenue,
      subtotal: parseFloat(revenueData?.subtotal) || 0,
      deliveryRevenue: parseFloat(revenueData?.deliveryRevenue) || 0,
      tipRevenue: parseFloat(revenueData?.tipRevenue) || 0,
      tax: parseFloat(revenueData?.tax) || 0,
      discounts: parseFloat(revenueData?.discounts) || 0,
      paymentFees: totalFees,
      profit: netRevenue - totalFees,
    };
  }
}
