import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Order, OrderStatus } from '../orders/order.entity';
import { MenuItem } from '../menu/menu-item.entity';
import { Restaurant } from '../restaurants/restaurant.entity';
import { User } from '../users/user.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getRecommendations(
    userId: string,
    lat?: number,
    lng?: number,
    limit: number = 20,
  ): Promise<any[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    const recentOrders = await this.orderRepository.find({
      where: { userId, status: OrderStatus.DELIVERED },
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['restaurant'],
    });

    const favoriteCuisines = this.extractFavoriteCuisines(recentOrders);
    const favoriteRestaurantIds = user?.favorites || [];

    const scores = new Map<string, number>();

    const restaurants = await this.restaurantRepository.find({
      where: { isActive: true },
    });

    for (const restaurant of restaurants) {
      let score = 0;

      if (favoriteRestaurantIds.includes(restaurant.id)) {
        score += 30;
      }

      if (restaurant.cuisines) {
        const matchingCuisines = restaurant.cuisines.filter((c) =>
          favoriteCuisines.includes(c),
        );
        score += matchingCuisines.length * 10;
      }

      score += restaurant.rating * 5;

      if (restaurant.isFeatured) {
        score += 15;
      }

      if (restaurant.deliveryCost === 0) {
        score += 10;
      }

      score += Math.min(restaurant.reviewsCount * 0.1, 10);

      scores.set(restaurant.id, score);
    }

    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const recommended: any[] = [];
    for (const [id] of sorted) {
      const restaurant = restaurants.find((r) => r.id === id);
      if (restaurant) {
        recommended.push({
          restaurant,
          recommendationScore: scores.get(id),
          reason: this.getRecommendationReason(
            restaurant,
            favoriteCuisines,
            favoriteRestaurantIds.includes(restaurant.id),
          ),
        });
      }
    }

    return recommended;
  }

  async getPersonalizedSuggestions(
    userId: string,
    restaurantId: string,
  ): Promise<any[]> {
    const userOrders = await this.orderRepository.find({
      where: { userId, restaurantId, status: OrderStatus.DELIVERED },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const orderedItemIds = new Set<string>();
    const itemFrequency = new Map<string, number>();

    for (const order of userOrders) {
      for (const item of order.items) {
        orderedItemIds.add(item.id);
        itemFrequency.set(
          item.id,
          (itemFrequency.get(item.id) || 0) + item.quantity,
        );
      }
    }

    const menuItems = await this.menuItemRepository.find({
      where: { isActive: true },
      relations: ['category'],
    });

    const filtered = menuItems.filter((item) => {
      if (item.category?.restaurantId !== restaurantId) return false;
      return true;
    });

    const suggestions = filtered.map((item) => {
      let score = 0;

      if (orderedItemIds.has(item.id)) {
        score += (itemFrequency.get(item.id) || 0) * 10;
      }

      if (item.isPopular) score += 20;
      if (item.discountPrice > 0 && item.discountPrice < item.price) {
        score += 15;
      }
      if (item.soldCount > 50) score += 10;

      return { item, score };
    });

    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.slice(0, 10);
  }

  async smartSearch(
    query: string,
    lat?: number,
    lng?: number,
    userId?: string,
  ): Promise<any> {
    const searchTerms = query.toLowerCase().split(' ');

    const restaurantResults = await this.restaurantRepository
      .createQueryBuilder('restaurant')
      .where('restaurant.isActive = :isActive', { isActive: true })
      .andWhere(
        `(${searchTerms
          .map(
            (_, i) =>
              `LOWER(restaurant.name) LIKE :term${i} OR LOWER(restaurant.description) LIKE :term${i} OR LOWER(restaurant.cuisines) LIKE :term${i}`,
          )
          .join(' OR ')})`,
      )
      .getMany();

    searchTerms.forEach((term, i) => {
      restaurantResults.forEach((r) => {
        (r as any)[`_term${i}`] = `%${term}%`;
      });
    });

    const menuResults = await this.menuItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .where('item.isActive = :isActive', { isActive: true })
      .andWhere(
        `(${searchTerms
          .map(
            (_, i) =>
              `LOWER(item.name) LIKE :term${i} OR LOWER(item.description) LIKE :term${i} OR LOWER(item.ingredients) LIKE :term${i}`,
          )
          .join(' OR ')})`,
      )
      .getMany();

    return {
      restaurants: restaurantResults,
      menuItems: menuResults,
      query,
      totalResults: restaurantResults.length + menuResults.length,
    };
  }

  async getUserPreferences(userId: string): Promise<any> {
    const orders = await this.orderRepository.find({
      where: { userId, status: OrderStatus.DELIVERED },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: ['restaurant'],
    });

    const cuisineCount = new Map<string, number>();
    const restaurantCount = new Map<string, { name: string; count: number }>();
    const averageCheck: number[] = [];
    const preferredOrderTimes: string[] = [];

    for (const order of orders) {
      if (order.restaurant?.cuisines) {
        for (const cuisine of order.restaurant.cuisines) {
          cuisineCount.set(cuisine, (cuisineCount.get(cuisine) || 0) + 1);
        }
      }

      if (order.restaurant) {
        const existing = restaurantCount.get(order.restaurantId) || {
          name: order.restaurant.name,
          count: 0,
        };
        existing.count++;
        restaurantCount.set(order.restaurantId, existing);
      }

      averageCheck.push(order.total);

      const hour = new Date(order.createdAt).getHours();
      if (hour < 12) preferredOrderTimes.push('morning');
      else if (hour < 17) preferredOrderTimes.push('afternoon');
      else if (hour < 21) preferredOrderTimes.push('evening');
      else preferredOrderTimes.push('night');
    }

    const favoriteCuisine = Array.from(cuisineCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const favoriteRestaurants = Array.from(restaurantCount.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const avgCheck =
      averageCheck.length > 0
        ? averageCheck.reduce((a, b) => a + b, 0) / averageCheck.length
        : 0;

    const preferredTime = this.getMostFrequent(preferredOrderTimes);

    return {
      favoriteCuisines: favoriteCuisine.map(([cuisine, count]) => ({
        cuisine,
        count,
      })),
      favoriteRestaurants: favoriteRestaurants.map(([id, data]) => ({
        id,
        name: data.name,
        orderCount: data.count,
      })),
      averageCheck: avgCheck,
      preferredOrderTime: preferredTime,
      totalOrders: orders.length,
      averageItemsPerOrder: orders.length > 0
        ? orders.reduce((sum, o) => sum + o.items.length, 0) / orders.length
        : 0,
    };
  }

  async getPopularCombinations(restaurantId: string): Promise<any[]> {
    const orders = await this.orderRepository.find({
      where: { restaurantId, status: OrderStatus.DELIVERED },
      take: 200,
    });

    const combinationMap = new Map<string, { items: string[]; count: number }>();

    for (const order of orders) {
      const itemIds = order.items.map((i) => i.id).sort();
      const key = itemIds.join(',');

      if (combinationMap.has(key)) {
        combinationMap.get(key)!.count++;
      } else {
        combinationMap.set(key, {
          items: order.items.map((i) => i.name),
          count: 1,
        });
      }
    }

    return Array.from(combinationMap.entries())
      .map(([key, value]) => ({
        combination: value.items,
        count: value.count,
        frequency: value.count / orders.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private extractFavoriteCuisines(orders: Order[]): string[] {
    const cuisineCount = new Map<string, number>();
    for (const order of orders) {
      if (order.restaurant?.cuisines) {
        for (const cuisine of order.restaurant.cuisines) {
          cuisineCount.set(cuisine, (cuisineCount.get(cuisine) || 0) + 1);
        }
      }
    }
    return Array.from(cuisineCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);
  }

  private getRecommendationReason(
    restaurant: Restaurant,
    favoriteCuisines: string[],
    isFavorite: boolean,
  ): string {
    if (isFavorite) return 'One of your favorite restaurants';
    if (restaurant.cuisines?.some((c) => favoriteCuisines.includes(c))) {
      return `Matches your preferred cuisine: ${restaurant.cuisines.filter((c) => favoriteCuisines.includes(c)).join(', ')}`;
    }
    if (restaurant.isFeatured) return 'Featured restaurant';
    if (restaurant.rating >= 4.5) return 'Highly rated by customers';
    if (restaurant.deliveryCost === 0) return 'Free delivery';
    return 'Popular in your area';
  }

  private getMostFrequent(arr: string[]): string {
    const freq = new Map<string, number>();
    let maxFreq = 0;
    let mostFrequent = arr[0] || 'afternoon';
    for (const item of arr) {
      const count = (freq.get(item) || 0) + 1;
      freq.set(item, count);
      if (count > maxFreq) {
        maxFreq = count;
        mostFrequent = item;
      }
    }
    return mostFrequent;
  }
}
