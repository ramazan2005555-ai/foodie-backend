import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RestaurantsService } from './restaurants.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { User } from '../users/user.entity';
import { Restaurant } from './restaurant.entity';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all restaurants with filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'cuisine', required: false })
  @ApiQuery({ name: 'rating', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  async findAll(@Query() query: any) {
    return this.restaurantsService.findAll(query);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured restaurants' })
  async getFeatured() {
    const restaurants = await this.restaurantsService.getFeatured();
    return { success: true, data: restaurants };
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby restaurants' })
  @ApiQuery({ name: 'lat', required: true })
  @ApiQuery({ name: 'lng', required: true })
  @ApiQuery({ name: 'radius', required: false })
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    const restaurants = await this.restaurantsService.getNearby(
      lat,
      lng,
      radius || 5,
    );
    return { success: true, data: restaurants };
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search restaurants by name' })
  @ApiQuery({ name: 'q', required: true })
  async search(@Query('q') q: string) {
    const restaurants = await this.restaurantsService.searchByName(q);
    return { success: true, data: restaurants };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant by ID' })
  async findById(@Param('id') id: string) {
    const restaurant = await this.restaurantsService.findById(id);
    return { success: true, data: restaurant };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create restaurant' })
  async create(
    @CurrentUser() user: User,
    @Body() createData: Partial<Restaurant>,
  ) {
    createData.ownerId = user.id;
    const restaurant = await this.restaurantsService.create(createData);
    return { success: true, data: restaurant };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  @ApiOperation({ summary: 'Update restaurant' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<Restaurant>,
    @CurrentUser() user: User,
  ) {
    const restaurant = await this.restaurantsService.findById(id);
    if (restaurant.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      return { success: false, message: 'Not authorized' };
    }
    const updated = await this.restaurantsService.update(id, updateData);
    return { success: true, data: updated };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete restaurant' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const restaurant = await this.restaurantsService.findById(id);
    if (restaurant.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      return { success: false, message: 'Not authorized' };
    }
    await this.restaurantsService.remove(id);
    return { success: true, message: 'Restaurant removed' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve restaurant (admin)' })
  async approve(@Param('id') id: string) {
    const restaurant = await this.restaurantsService.approveRestaurant(id);
    return { success: true, data: restaurant };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject restaurant (admin)' })
  async reject(@Param('id') id: string, @Body('reason') reason?: string) {
    const restaurant = await this.restaurantsService.rejectRestaurant(id, reason);
    return { success: true, data: restaurant };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend restaurant (admin)' })
  async suspend(@Param('id') id: string) {
    const restaurant = await this.restaurantsService.suspendRestaurant(id);
    return { success: true, data: restaurant };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/pending')
  @ApiOperation({ summary: 'Get pending restaurants (admin)' })
  async getPending() {
    const restaurants = await this.restaurantsService.getPendingRestaurants();
    return { success: true, data: restaurants };
  }
}
