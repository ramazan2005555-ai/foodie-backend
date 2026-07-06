import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User, Address } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async updateProfile(
    id: string,
    updateData: Partial<User>,
  ): Promise<User> {
    const user = await this.findById(id);

    if (updateData.email && updateData.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: updateData.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  async toggleFavoriteRestaurant(
    userId: string,
    restaurantId: string,
  ): Promise<any> {
    const user = await this.findById(userId);

    const favorites = user.favorites || [];
    const index = favorites.indexOf(restaurantId);

    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(restaurantId);
    }

    user.favorites = favorites;
    await this.userRepository.save(user);

    return { favorites: user.favorites };
  }

  async addAddress(userId: string, address: Omit<Address, 'id'>): Promise<Address[]> {
    const user = await this.findById(userId);

    const newAddress: Address = {
      ...address,
      id: uuidv4(),
    };

    const addresses = user.addresses || [];

    if (address.isDefault || addresses.length === 0) {
      addresses.forEach((a) => (a.isDefault = false));
      newAddress.isDefault = true;
    }

    addresses.push(newAddress);
    user.addresses = addresses;
    await this.userRepository.save(user);

    return user.addresses;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    addressData: Partial<Address>,
  ): Promise<Address[]> {
    const user = await this.findById(userId);
    const addresses = user.addresses || [];
    const index = addresses.findIndex((a) => a.id === addressId);

    if (index === -1) {
      throw new NotFoundException('Address not found');
    }

    if (addressData.isDefault) {
      addresses.forEach((a) => (a.isDefault = false));
    }

    addresses[index] = { ...addresses[index], ...addressData };
    user.addresses = addresses;
    await this.userRepository.save(user);

    return user.addresses;
  }

  async deleteAddress(userId: string, addressId: string): Promise<Address[]> {
    const user = await this.findById(userId);
    const addresses = (user.addresses || []).filter((a) => a.id !== addressId);

    if (addresses.length === (user.addresses || []).length) {
      throw new NotFoundException('Address not found');
    }

    if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
      addresses[0].isDefault = true;
    }

    user.addresses = addresses;
    await this.userRepository.save(user);

    return user.addresses;
  }

  async getAddresses(userId: string): Promise<Address[]> {
    const user = await this.findById(userId);
    return user.addresses || [];
  }

  async addBonusPoints(userId: string, points: number): Promise<number> {
    const user = await this.findById(userId);
    user.bonusPoints += points;
    await this.userRepository.save(user);
    return user.bonusPoints;
  }

  async deductBonusPoints(userId: string, points: number): Promise<number> {
    const user = await this.findById(userId);
    if (user.bonusPoints < points) {
      throw new ConflictException('Insufficient bonus points');
    }
    user.bonusPoints -= points;
    await this.userRepository.save(user);
    return user.bonusPoints;
  }

  async getAllUsers(page: number, limit: number): Promise<any> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: users,
      meta: {
        totalItems: total,
        itemCount: users.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.userRepository.save(user);
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = true;
    return this.userRepository.save(user);
  }
}
