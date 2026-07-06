import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, FindOptionsWhere } from 'typeorm';
import { Restaurant, RestaurantStatus } from './restaurant.entity';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
  ) {}

  async create(createData: Partial<Restaurant>): Promise<Restaurant> {
    const restaurant = this.restaurantRepository.create({
      ...createData,
      status: RestaurantStatus.PENDING,
      isActive: true,
      rating: 0,
      reviewsCount: 0,
    });
    return this.restaurantRepository.save(restaurant);
  }

  async findAll(query: any): Promise<any> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      cuisine,
      lat,
      lng,
      radius,
      rating,
      isOpen,
      sort = 'rating',
      order = 'DESC',
    } = query;

    const where: FindOptionsWhere<Restaurant> = {
      isActive: true,
      status: RestaurantStatus.ACTIVE,
    };

    if (search) {
      where.name = Like(`%${search}%`);
    }

    if (category) {
      where.categories = Like(`%${category}%`);
    }

    if (cuisine) {
      where.cuisines = Like(`%${cuisine}%`);
    }

    if (rating) {
      where.rating = Between(parseFloat(rating), 5);
    }

    let orderBy: any = {};
    if (sort === 'rating') orderBy.rating = order;
    else if (sort === 'deliveryCost') orderBy.deliveryCost = order;
    else if (sort === 'deliveryTimeMin') orderBy.deliveryTimeMin = order;
    else if (sort === 'name') orderBy.name = order;
    else orderBy.rating = 'DESC';

    const [restaurants, total] = await this.restaurantRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: orderBy,
      relations: ['owner'],
    });

    return {
      items: restaurants,
      meta: {
        totalItems: total,
        itemCount: restaurants.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findById(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['owner', 'menuCategories', 'menuCategories.items'],
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  async findByOwner(ownerId: string): Promise<Restaurant[]> {
    return this.restaurantRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateData: Partial<Restaurant>,
  ): Promise<Restaurant> {
    const restaurant = await this.findById(id);
    Object.assign(restaurant, updateData);
    return this.restaurantRepository.save(restaurant);
  }

  async remove(id: string): Promise<void> {
    const restaurant = await this.findById(id);
    restaurant.isActive = false;
    await this.restaurantRepository.save(restaurant);
  }

  async approveRestaurant(id: string): Promise<Restaurant> {
    const restaurant = await this.findById(id);
    restaurant.status = RestaurantStatus.ACTIVE;
    restaurant.isVerified = true;
    return this.restaurantRepository.save(restaurant);
  }

  async rejectRestaurant(id: string, reason?: string): Promise<Restaurant> {
    const restaurant = await this.findById(id);
    restaurant.status = RestaurantStatus.REJECTED;
    return this.restaurantRepository.save(restaurant);
  }

  async suspendRestaurant(id: string): Promise<Restaurant> {
    const restaurant = await this.findById(id);
    restaurant.status = RestaurantStatus.SUSPENDED;
    restaurant.isActive = false;
    return this.restaurantRepository.save(restaurant);
  }

  async getFeatured(): Promise<Restaurant[]> {
    return this.restaurantRepository.find({
      where: {
        isFeatured: true,
        isActive: true,
        status: RestaurantStatus.ACTIVE,
      },
      take: 10,
    });
  }

  async getNearby(
    lat: number,
    lng: number,
    radiusKm: number = 5,
  ): Promise<Restaurant[]> {
    const restaurants = await this.restaurantRepository.find({
      where: {
        isActive: true,
        status: RestaurantStatus.ACTIVE,
      },
    });

    return restaurants.filter((r) => {
      if (!r.lat || !r.lng) return false;
      const distance = this.calculateDistance(lat, lng, r.lat, r.lng);
      return distance <= radiusKm;
    });
  }

  async updateRating(id: string): Promise<void> {
    const restaurant = await this.findById(id);
    const result = await this.restaurantRepository.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
       FROM reviews WHERE restaurantId = $1 AND isActive = true`,
      [id],
    );

    if (result.length > 0) {
      restaurant.rating = parseFloat(result[0].avg_rating) || 0;
      restaurant.reviewsCount = parseInt(result[0].review_count) || 0;
      await this.restaurantRepository.save(restaurant);
    }
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async getPendingRestaurants(): Promise<Restaurant[]> {
    return this.restaurantRepository.find({
      where: { status: RestaurantStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async searchByName(query: string): Promise<Restaurant[]> {
    return this.restaurantRepository.find({
      where: [
        { name: Like(`%${query}%`), isActive: true, status: RestaurantStatus.ACTIVE },
        { description: Like(`%${query}%`), isActive: true, status: RestaurantStatus.ACTIVE },
      ],
      take: 20,
    });
  }
}
