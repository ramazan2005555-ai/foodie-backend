import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Order } from '../orders/order.entity';
import { Payment } from '../payments/payment.entity';
import { User } from '../users/user.entity';
import { Restaurant } from '../restaurants/restaurant.entity';
import { MenuItem } from '../menu/menu-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment, User, Restaurant, MenuItem]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
