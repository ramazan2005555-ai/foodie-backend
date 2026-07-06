import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { User } from '../users/user.entity';
import { Order, OrderStatus } from './order.entity';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  async create(
    @CurrentUser() user: User,
    @Body() createData: Partial<Order>,
  ) {
    const order = await this.ordersService.create(user.id, createData);
    return { success: true, data: order };
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(@Query() query: any, @CurrentUser() user: User) {
    if (user.role === UserRole.USER) {
      query.userId = user.id;
    }
    return this.ordersService.findAll(query);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my orders' })
  async getMyOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.ordersService.findByUser(userId, page, limit);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active orders' })
  async getActiveOrders(@CurrentUser('id') userId: string) {
    const orders = await this.ordersService.getActiveOrders(userId);
    return { success: true, data: orders };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get order history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getOrderHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.ordersService.getOrderHistory(userId, page, limit);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get order statistics' })
  async getStats(@Query('restaurantId') restaurantId?: string) {
    return this.ordersService.getOrderStats(restaurantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findById(@Param('id') id: string) {
    const order = await this.ordersService.findById(id);
    return { success: true, data: order };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('reason') reason?: string,
  ) {
    const order = await this.ordersService.cancelOrder(id, user.id, reason);
    return { success: true, data: order };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status (owner/admin)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Body() additionalData?: any,
  ) {
    const order = await this.ordersService.updateStatus(
      id,
      status,
      additionalData,
    );
    return { success: true, data: order };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/assign-delivery/:deliveryId')
  @ApiOperation({ summary: 'Assign delivery to order' })
  async assignDelivery(
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
  ) {
    const order = await this.ordersService.assignDelivery(id, deliveryId);
    return { success: true, data: order };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Get('restaurant/:restaurantId')
  @ApiOperation({ summary: 'Get orders by restaurant' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.ordersService.findByRestaurant(restaurantId, page, limit);
  }
}
