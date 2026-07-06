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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CouponsService } from './coupons.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { User } from '../users/user.entity';
import { Coupon } from './coupon.entity';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a coupon code' })
  async validate(
    @CurrentUser() user: User,
    @Body('code') code: string,
    @Body('orderAmount') orderAmount: number,
    @Body('restaurantId') restaurantId?: string,
  ) {
    const result = await this.couponsService.validate(
      code,
      user.id,
      orderAmount,
      restaurantId,
    );
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('valid')
  @ApiOperation({ summary: 'Get valid coupons for user' })
  async getValidCoupons(
    @CurrentUser() user: User,
    @Query('orderAmount') orderAmount: number,
    @Query('restaurantId') restaurantId?: string,
  ) {
    const coupons = await this.couponsService.getValidCoupons(
      user.id,
      orderAmount || 0,
      restaurantId,
    );
    return { success: true, data: coupons };
  }

  @Public()
  @Get('check/:code')
  @ApiOperation({ summary: 'Check coupon by code' })
  async findByCode(@Param('code') code: string) {
    const coupon = await this.couponsService.findByCode(code);
    return { success: true, data: coupon };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get all coupons (admin)' })
  async findAll(@Query() query: any) {
    return this.couponsService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get coupon by ID (admin)' })
  async findById(@Param('id') id: string) {
    const coupon = await this.couponsService.findById(id);
    return { success: true, data: coupon };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create coupon (admin)' })
  async create(@Body() data: Partial<Coupon>) {
    const coupon = await this.couponsService.create(data);
    return { success: true, data: coupon };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk create coupons (admin)' })
  async bulkCreate(@Body('coupons') coupons: Partial<Coupon>[]) {
    const created = await this.couponsService.bulkCreate(coupons);
    return { success: true, data: created };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Update coupon (admin)' })
  async update(@Param('id') id: string, @Body() data: Partial<Coupon>) {
    const coupon = await this.couponsService.update(id, data);
    return { success: true, data: coupon };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete coupon (admin)' })
  async remove(@Param('id') id: string) {
    await this.couponsService.remove(id);
    return { success: true, message: 'Coupon deleted' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle coupon status (admin)' })
  async toggleStatus(@Param('id') id: string) {
    const coupon = await this.couponsService.toggleStatus(id);
    return { success: true, data: coupon };
  }
}
