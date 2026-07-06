import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Delivery, DeliveryStatus, DeliveryType } from './delivery.entity';
import { DeliveryGateway } from './delivery.gateway';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(Delivery)
    private deliveryRepository: Repository<Delivery>,
    private deliveryGateway: DeliveryGateway,
  ) {}

  async create(data: Partial<Delivery>): Promise<Delivery> {
    const delivery = this.deliveryRepository.create({
      ...data,
      status: DeliveryStatus.PENDING,
    });
    return this.deliveryRepository.save(delivery);
  }

  async findAll(query: any): Promise<any> {
    const {
      page = 1,
      limit = 20,
      status,
      courierId,
      startDate,
      endDate,
    } = query;

    const where: any = {};

    if (status) where.status = status;
    if (courierId) where.courierId = courierId;
    if (startDate && endDate) {
      where.createdAt = {
        $between: [new Date(startDate), new Date(endDate)],
      };
    }

    const [deliveries, total] = await this.deliveryRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['courier', 'orders'],
    });

    return {
      items: deliveries,
      meta: {
        totalItems: total,
        itemCount: deliveries.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findById(id: string): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id },
      relations: ['courier', 'orders'],
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    return delivery;
  }

  async findByCourier(courierId: string): Promise<Delivery[]> {
    return this.deliveryRepository.find({
      where: { courierId },
      order: { createdAt: 'DESC' },
      relations: ['orders'],
    });
  }

  async getAvailableDeliveries(): Promise<Delivery[]> {
    return this.deliveryRepository.find({
      where: { status: DeliveryStatus.PENDING },
      order: { createdAt: 'ASC' },
      relations: ['orders'],
    });
  }

  async assignCourier(
    deliveryId: string,
    courierId: string,
  ): Promise<Delivery> {
    const delivery = await this.findById(deliveryId);

    if (delivery.status !== DeliveryStatus.PENDING) {
      throw new BadRequestException('Delivery is not available for assignment');
    }

    delivery.courierId = courierId;
    delivery.status = DeliveryStatus.ASSIGNED;
    delivery.startedAt = new Date();

    const updated = await this.deliveryRepository.save(delivery);

    this.deliveryGateway.sendDeliveryUpdate(updated);

    return updated;
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    locationData?: { lat: number; lng: number },
  ): Promise<Delivery> {
    const delivery = await this.findById(id);

    if (!this.isValidTransition(delivery.status, status)) {
      throw new BadRequestException(
        `Cannot transition from ${delivery.status} to ${status}`,
      );
    }

    delivery.status = status;

    if (status === DeliveryStatus.PICKED_UP) {
      delivery.pickedUpAt = new Date();
    }

    if (status === DeliveryStatus.DELIVERED) {
      delivery.deliveredAt = new Date();
      delivery.currentLat = locationData?.lat || delivery.deliveryLat;
      delivery.currentLng = locationData?.lng || delivery.deliveryLng;
    }

    if (status === DeliveryStatus.IN_TRANSIT && locationData) {
      delivery.currentLat = locationData.lat;
      delivery.currentLng = locationData.lng;
    }

    const updated = await this.deliveryRepository.save(delivery);
    this.deliveryGateway.sendDeliveryUpdate(updated);

    return updated;
  }

  async updateLocation(
    id: string,
    lat: number,
    lng: number,
  ): Promise<Delivery> {
    const delivery = await this.findById(id);

    delivery.currentLat = lat;
    delivery.currentLng = lng;

    const updated = await this.deliveryRepository.save(delivery);
    this.deliveryGateway.sendCourierLocation(updated);

    return updated;
  }

  async completeDelivery(id: string): Promise<Delivery> {
    const delivery = await this.findById(id);
    delivery.status = DeliveryStatus.DELIVERED;
    delivery.deliveredAt = new Date();

    const updated = await this.deliveryRepository.save(delivery);
    this.deliveryGateway.sendDeliveryUpdate(updated);

    return updated;
  }

  async cancelDelivery(id: string, reason?: string): Promise<Delivery> {
    const delivery = await this.findById(id);
    delivery.status = DeliveryStatus.CANCELLED;
    delivery.notes = reason || '';

    const updated = await this.deliveryRepository.save(delivery);
    this.deliveryGateway.sendDeliveryUpdate(updated);

    return updated;
  }

  async getCourierActiveDelivery(courierId: string): Promise<Delivery | null> {
    return this.deliveryRepository.findOne({
      where: {
        courierId,
        status: In([
          DeliveryStatus.ASSIGNED,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.IN_TRANSIT,
        ]),
      },
      relations: ['orders', 'orders.restaurant'],
    });
  }

  async getDeliveryStats(courierId?: string): Promise<any> {
    const where: any = {};
    if (courierId) where.courierId = courierId;

    const totalDeliveries = await this.deliveryRepository.count({
      where: { ...where, status: DeliveryStatus.DELIVERED },
    });

    const totalDistance = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .select('SUM(delivery.distance)', 'total')
      .where({ ...where, status: DeliveryStatus.DELIVERED })
      .getRawOne();

    const averageTime = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .select(
        'AVG(EXTRACT(EPOCH FROM (delivery.deliveredAt - delivery.startedAt)))',
        'avg',
      )
      .where({ ...where, status: DeliveryStatus.DELIVERED })
      .getRawOne();

    return {
      totalDeliveries,
      totalDistance: totalDistance?.total || 0,
      averageDeliveryTimeSeconds: averageTime?.avg || 0,
    };
  }

  private isValidTransition(
    current: DeliveryStatus,
    next: DeliveryStatus,
  ): boolean {
    const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [
        DeliveryStatus.ASSIGNED,
        DeliveryStatus.CANCELLED,
      ],
      [DeliveryStatus.ASSIGNED]: [
        DeliveryStatus.PICKED_UP,
        DeliveryStatus.CANCELLED,
      ],
      [DeliveryStatus.PICKED_UP]: [
        DeliveryStatus.IN_TRANSIT,
        DeliveryStatus.FAILED,
      ],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [],
      [DeliveryStatus.CANCELLED]: [],
    };

    return transitions[current]?.includes(next) || false;
  }
}
