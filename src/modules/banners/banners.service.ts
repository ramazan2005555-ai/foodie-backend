import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Banner } from './banner.entity';

@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
  ) {}

  async create(data: Partial<Banner>): Promise<Banner> {
    const banner = this.bannerRepository.create(data);
    return this.bannerRepository.save(banner);
  }

  async findAll(query: any): Promise<any> {
    const { page = 1, limit = 20, isActive } = query;
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [banners, total] = await this.bannerRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { sortOrder: 'ASC' },
    });

    return {
      items: banners,
      meta: {
        totalItems: total,
        itemCount: banners.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findById(id: string): Promise<Banner> {
    const banner = await this.bannerRepository.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  async getActiveBanners(): Promise<Banner[]> {
    const now = new Date();
    return this.bannerRepository.find({
      where: {
        isActive: true,
        startDate: LessThan(now),
        endDate: MoreThan(now),
      },
      order: { sortOrder: 'ASC' },
    });
  }

  async update(id: string, data: Partial<Banner>): Promise<Banner> {
    const banner = await this.findById(id);
    Object.assign(banner, data);
    return this.bannerRepository.save(banner);
  }

  async remove(id: string): Promise<void> {
    const banner = await this.findById(id);
    await this.bannerRepository.remove(banner);
  }

  async reorder(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.bannerRepository.update(ids[i], { sortOrder: i + 1 });
    }
  }

  async toggleActive(id: string): Promise<Banner> {
    const banner = await this.findById(id);
    banner.isActive = !banner.isActive;
    return this.bannerRepository.save(banner);
  }
}
