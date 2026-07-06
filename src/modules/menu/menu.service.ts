import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MenuCategory } from './menu-category.entity';
import { MenuItem } from './menu-item.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private categoryRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private itemRepository: Repository<MenuItem>,
  ) {}

  async createCategory(data: Partial<MenuCategory>): Promise<MenuCategory> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async getCategories(restaurantId: string): Promise<MenuCategory[]> {
    return this.categoryRepository.find({
      where: { restaurantId, isActive: true },
      relations: ['items'],
      order: { sortOrder: 'ASC' },
    });
  }

  async getCategoryById(id: string): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async updateCategory(
    id: string,
    data: Partial<MenuCategory>,
  ): Promise<MenuCategory> {
    const category = await this.getCategoryById(id);
    Object.assign(category, data);
    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);
    await this.itemRepository.update(
      { categoryId: id },
      { isActive: false },
    );
    category.isActive = false;
    await this.categoryRepository.save(category);
  }

  async createItem(data: Partial<MenuItem>): Promise<MenuItem> {
    const category = await this.categoryRepository.findOne({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    const item = this.itemRepository.create(data);
    return this.itemRepository.save(item);
  }

  async getItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    return this.itemRepository.find({
      where: { categoryId, isActive: true, isAvailable: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async getItemById(id: string): Promise<MenuItem> {
    const item = await this.itemRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }

  async updateItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    const item = await this.getItemById(id);
    Object.assign(item, data);
    return this.itemRepository.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.getItemById(id);
    item.isActive = false;
    await this.itemRepository.save(item);
  }

  async getPopularItems(restaurantId: string): Promise<MenuItem[]> {
    const categories = await this.categoryRepository.find({
      where: { restaurantId },
    });
    const categoryIds = categories.map((c) => c.id);

    return this.itemRepository.find({
      where: {
        categoryId: categoryIds.length > 0 ? In(categoryIds) : undefined,
        isPopular: true,
        isActive: true,
        isAvailable: true,
      },
      order: { soldCount: 'DESC' },
      take: 20,
    });
  }

  async searchItems(
    restaurantId: string,
    query: string,
  ): Promise<MenuItem[]> {
    const categories = await this.categoryRepository.find({
      where: { restaurantId },
    });
    const categoryIds = categories.map((c) => c.id);

    if (categoryIds.length === 0) return [];

    const items = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .where('item.categoryId IN (:...categoryIds)', { categoryIds })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .andWhere(
        '(item.name ILIKE :query OR item.description ILIKE :query)',
        { query: `%${query}%` },
      )
      .orderBy('item.sortOrder', 'ASC')
      .getMany();

    return items;
  }

  async toggleAvailability(id: string): Promise<MenuItem> {
    const item = await this.getItemById(id);
    item.isAvailable = !item.isAvailable;
    return this.itemRepository.save(item);
  }

  async incrementSoldCount(id: string, quantity: number): Promise<void> {
    await this.itemRepository.increment({ id }, 'soldCount', quantity);
  }

  async getFullMenu(restaurantId: string): Promise<any> {
    const categories = await this.categoryRepository.find({
      where: { restaurantId, isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const menu: any[] = [];
    for (const category of categories) {
      const items = await this.itemRepository.find({
        where: {
          categoryId: category.id,
          isActive: true,
          isAvailable: true,
        },
        order: { sortOrder: 'ASC' },
      });
      menu.push({
        ...category,
        items,
      });
    }

    return menu;
  }

  async duplicateItem(id: string): Promise<MenuItem> {
    const item = await this.getItemById(id);
    const { id: _, createdAt, updatedAt, soldCount, ...itemData } = item;
    const newItem = this.itemRepository.create({
      ...itemData,
      name: `${item.name} (copy)`,
      isActive: true,
    });
    return this.itemRepository.save(newItem);
  }

  async bulkUpdateAvailability(
    categoryId: string,
    isAvailable: boolean,
  ): Promise<void> {
    await this.itemRepository.update(
      { categoryId },
      { isAvailable },
    );
  }
}
