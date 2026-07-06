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
import { DeliveryService } from './delivery.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { User } from '../users/user.entity';
import { Delivery, DeliveryStatus } from './delivery.entity';

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a delivery' })
  async create(@Body() data: Partial<Delivery>) {
    const delivery = await this.deliveryService.create(data);
    return { success: true, data: delivery };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all deliveries (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(@Query() query: any) {
    return this.deliveryService.findAll(query);
  }

  @Get('available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get available deliveries for couriers' })
  async getAvailable() {
    const deliveries = await this.deliveryService.getAvailableDeliveries();
    return { success: true, data: deliveries };
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COURIER)
  @ApiOperation({ summary: 'Get my deliveries (courier)' })
  async getMyDeliveries(@CurrentUser('id') courierId: string) {
    const deliveries = await this.deliveryService.findByCourier(courierId);
    return { success: true, data: deliveries };
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COURIER)
  @ApiOperation({ summary: 'Get my active delivery (courier)' })
  async getActiveDelivery(@CurrentUser('id') courierId: string) {
    const delivery = await this.deliveryService.getCourierActiveDelivery(
      courierId,
    );
    return { success: true, data: delivery };
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get delivery stats' })
  async getStats(@CurrentUser('id') courierId?: string) {
    return this.deliveryService.getDeliveryStats(courierId);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COURIER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign courier to delivery' })
  async assignCourier(
    @Param('id') id: string,
    @CurrentUser('id') courierId: string,
  ) {
    const delivery = await this.deliveryService.assignCourier(id, courierId);
    return { success: true, data: delivery };
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update delivery status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: DeliveryStatus,
    @Body('lat') lat?: number,
    @Body('lng') lng?: number,
  ) {
    const delivery = await this.deliveryService.updateStatus(id, status, {
      lat: lat!,
      lng: lng!,
    });
    return { success: true, data: delivery };
  }

  @Post(':id/location')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COURIER)
  @ApiOperation({ summary: 'Update courier location' })
  async updateLocation(
    @Param('id') id: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    const delivery = await this.deliveryService.updateLocation(id, lat, lng);
    return { success: true, data: delivery };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete delivery' })
  async complete(@Param('id') id: string) {
    const delivery = await this.deliveryService.completeDelivery(id);
    return { success: true, data: delivery };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel delivery' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const delivery = await this.deliveryService.cancelDelivery(id, reason);
    return { success: true, data: delivery };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery by ID' })
  async findById(@Param('id') id: string) {
    const delivery = await this.deliveryService.findById(id);
    return { success: true, data: delivery };
  }
}
