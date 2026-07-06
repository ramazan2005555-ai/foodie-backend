import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getDashboard(
    @Query('restaurantId') restaurantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.analyticsService.getDashboardStats(
      restaurantId,
      startDate,
      endDate,
    );
    return { success: true, data: stats };
  }

  @Get('popular-items')
  @ApiOperation({ summary: 'Get popular menu items' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getPopularItems(
    @Query('restaurantId') restaurantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const items = await this.analyticsService.getPopularItems(
      restaurantId,
      start,
      end,
      limit || 10,
    );
    return { success: true, data: items };
  }

  @Get('orders-by-day')
  @ApiOperation({ summary: 'Get orders grouped by day' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getOrdersByDay(
    @Query('restaurantId') restaurantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const data = await this.analyticsService.getOrdersByDay(
      restaurantId,
      start,
      end,
    );
    return { success: true, data };
  }

  @Get('revenue-by-day')
  @ApiOperation({ summary: 'Get revenue grouped by day' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getRevenueByDay(
    @Query('restaurantId') restaurantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const data = await this.analyticsService.getRevenueByDay(
      restaurantId,
      start,
      end,
    );
    return { success: true, data };
  }

  @Get('restaurant-ranking')
  @ApiOperation({ summary: 'Get restaurant ranking by revenue' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getRestaurantRanking(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.analyticsService.getRestaurantRanking(
      startDate,
      endDate,
    );
    return { success: true, data };
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user analytics (admin)' })
  async getUserAnalytics() {
    const data = await this.analyticsService.getUserAnalytics();
    return { success: true, data };
  }

  @Get('financial-report')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get financial report (admin)' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getFinancialReport(
    @Query('restaurantId') restaurantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.analyticsService.getFinancialReport(
      restaurantId,
      startDate,
      endDate,
    );
    return { success: true, data };
  }
}
