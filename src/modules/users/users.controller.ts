import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { User } from './user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: User) {
    return { success: true, data: user };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update profile' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateData: Partial<User>,
  ) {
    const user = await this.usersService.updateProfile(userId, updateData);
    return { success: true, data: user };
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get all addresses' })
  async getAddresses(@CurrentUser('id') userId: string) {
    const addresses = await this.usersService.getAddresses(userId);
    return { success: true, data: addresses };
  }

  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add new address' })
  async addAddress(
    @CurrentUser('id') userId: string,
    @Body() address: any,
  ) {
    const addresses = await this.usersService.addAddress(userId, address);
    return { success: true, data: addresses };
  }

  @Put('addresses/:addressId')
  @ApiOperation({ summary: 'Update address' })
  async updateAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId') addressId: string,
    @Body() addressData: any,
  ) {
    const addresses = await this.usersService.updateAddress(
      userId,
      addressId,
      addressData,
    );
    return { success: true, data: addresses };
  }

  @Delete('addresses/:addressId')
  @ApiOperation({ summary: 'Delete address' })
  async deleteAddress(
    @CurrentUser('id') userId: string,
    @Param('addressId') addressId: string,
  ) {
    const addresses = await this.usersService.deleteAddress(userId, addressId);
    return { success: true, data: addresses };
  }

  @Post('favorites/:restaurantId')
  @ApiOperation({ summary: 'Toggle restaurant favorite' })
  async toggleFavorite(
    @CurrentUser('id') userId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    const result = await this.usersService.toggleFavoriteRestaurant(
      userId,
      restaurantId,
    );
    return { success: true, data: result };
  }

  @Get('bonus-points')
  @ApiOperation({ summary: 'Get bonus points balance' })
  async getBonusPoints(@CurrentUser() user: User) {
    return { success: true, data: { bonusPoints: user.bonusPoints } };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get all users (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.usersService.getAllUsers(page, limit);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin)' })
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return { success: true, data: user };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate user (admin)' })
  async deactivateUser(@Param('id') id: string) {
    const user = await this.usersService.deactivateUser(id);
    return { success: true, data: user };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate user (admin)' })
  async activateUser(@Param('id') id: string) {
    const user = await this.usersService.activateUser(id);
    return { success: true, data: user };
  }
}
