import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderGateway } from './order.gateway';
import { Order } from './order.entity';
import { MenuModule } from '../menu/menu.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    MenuModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderGateway],
  exports: [OrdersService],
})
export class OrdersModule {}
