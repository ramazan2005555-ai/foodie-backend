import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Equal } from 'typeorm';
import { Coupon, CouponType, CouponStatus } from './coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
  ) {}

  async create(data: Partial<Coupon>): Promise<Coupon> {
    const existing = await this.couponRepository.findOne({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException('Coupon code already exists');
    }

    const coupon = this.couponRepository.create(data);
    return this.couponRepository.save(coupon);
  }

  async validate(
    code: string,
    userId: string,
    orderAmount: number,
    restaurantId?: string,
  ): Promise<{ valid: boolean; discount: number; coupon: Coupon; message: string }> {
    const coupon = await this.couponRepository.findOne({
      where: { code },
    });

    if (!coupon) {
      return { valid: false, discount: 0, coupon: null as any, message: 'Invalid coupon code' };
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
      return { valid: false, discount: 0, coupon, message: 'Coupon is not active' };
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, discount: 0, coupon, message: 'Coupon is not yet valid' };
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { valid: false, discount: 0, coupon, message: 'Coupon has expired' };
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, coupon, message: 'Coupon usage limit reached' };
    }

    if (orderAmount < coupon.minOrder) {
      return {
        valid: false,
        discount: 0,
        coupon,
        message: `Minimum order amount is $${coupon.minOrder}`,
      };
    }

    if (coupon.isFirstOrderOnly) {
      const existingOrders = await this.couponRepository.query(
        'SELECT COUNT(*) as count FROM orders WHERE userId = $1',
        [userId],
      );
      if (parseInt(existingOrders[0]?.count || '0') > 0) {
        return { valid: false, discount: 0, coupon, message: 'Coupon is for first order only' };
      }
    }

    if (coupon.restaurantId && coupon.restaurantId !== restaurantId) {
      return { valid: false, discount: 0, coupon, message: 'Coupon not valid for this restaurant' };
    }

    let discount = 0;
    switch (coupon.type) {
      case CouponType.PERCENTAGE:
        discount = (orderAmount * coupon.value) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
        break;
      case CouponType.FIXED:
        discount = coupon.value;
        break;
      case CouponType.FREE_DELIVERY:
        discount = 0;
        break;
      case CouponType.BONUS_POINTS:
        discount = 0;
        break;
    }

    return { valid: true, discount, coupon, message: 'Coupon applied successfully' };
  }

  async applyCoupon(code: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { code } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    coupon.usedCount += 1;
    return this.couponRepository.save(coupon);
  }

  async findAll(query: any): Promise<any> {
    const { page = 1, limit = 20, status, type } = query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [coupons, total] = await this.couponRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: coupons,
      meta: {
        totalItems: total,
        itemCount: coupons.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findById(id: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async findByCode(code: string): Promise<Coupon> {
    return this.couponRepository.findOne({ where: { code } }) as Promise<Coupon>;
  }

  async update(id: string, data: Partial<Coupon>): Promise<Coupon> {
    const coupon = await this.findById(id);
    Object.assign(coupon, data);
    return this.couponRepository.save(coupon);
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.findById(id);
    await this.couponRepository.remove(coupon);
  }

  async getValidCoupons(
    userId: string,
    orderAmount: number,
    restaurantId?: string,
  ): Promise<Coupon[]> {
    const now = new Date();
    const coupons = await this.couponRepository.find({
      where: {
        status: CouponStatus.ACTIVE,
        startsAt: LessThan(now),
        expiresAt: MoreThan(now),
      },
    });

    const validCoupons: Coupon[] = [];
    for (const coupon of coupons) {
      if (orderAmount >= coupon.minOrder) {
        if (!coupon.restaurantId || coupon.restaurantId === restaurantId) {
          if (coupon.usageLimit === 0 || coupon.usedCount < coupon.usageLimit) {
            validCoupons.push(coupon);
          }
        }
      }
    }

    return validCoupons;
  }

  async toggleStatus(id: string): Promise<Coupon> {
    const coupon = await this.findById(id);
    coupon.status =
      coupon.status === CouponStatus.ACTIVE
        ? CouponStatus.DISABLED
        : CouponStatus.ACTIVE;
    return this.couponRepository.save(coupon);
  }

  async bulkCreate(coupons: Partial<Coupon>[]): Promise<Coupon[]> {
    const created: Coupon[] = [];
    for (const data of coupons) {
      const existing = await this.couponRepository.findOne({
        where: { code: data.code },
      });
      if (!existing) {
        const coupon = this.couponRepository.create(data);
        created.push(await this.couponRepository.save(coupon));
      }
    }
    return created;
  }
}
