import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { User } from '../users/user.entity';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('recommendations')
  @ApiOperation({ summary: 'Get personalized restaurant recommendations' })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getRecommendations(
    @CurrentUser() user: User,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
    @Query('limit') limit?: number,
  ) {
    const recommendations = await this.aiService.getRecommendations(
      user.id,
      lat,
      lng,
      limit || 20,
    );
    return { success: true, data: recommendations };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('suggestions/:restaurantId')
  @ApiOperation({ summary: 'Get personalized menu suggestions' })
  async getSuggestions(
    @CurrentUser() user: User,
    @Param('restaurantId') restaurantId: string,
  ) {
    const suggestions = await this.aiService.getPersonalizedSuggestions(
      user.id,
      restaurantId,
    );
    return { success: true, data: suggestions };
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Smart search across restaurants and menu items' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  async smartSearch(
    @Query('q') q: string,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
    @Query('userId') userId?: string,
  ) {
    const results = await this.aiService.smartSearch(q, lat, lng, userId);
    return { success: true, data: results };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences and insights' })
  async getUserPreferences(@CurrentUser() user: User) {
    const preferences = await this.aiService.getUserPreferences(user.id);
    return { success: true, data: preferences };
  }

  @Public()
  @Get('popular-combinations/:restaurantId')
  @ApiOperation({ summary: 'Get popular item combinations' })
  async getPopularCombinations(
    @Param('restaurantId') restaurantId: string,
  ) {
    const combinations = await this.aiService.getPopularCombinations(
      restaurantId,
    );
    return { success: true, data: combinations };
  }
}
