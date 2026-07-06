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
import { MenuService } from './menu.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { MenuCategory } from './menu-category.entity';
import { MenuItem } from './menu-item.entity';

@ApiTags('Menu')
@Controller()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Public()
  @Get('restaurants/:restaurantId/menu')
  @ApiOperation({ summary: 'Get full menu for a restaurant' })
  async getFullMenu(@Param('restaurantId') restaurantId: string) {
    const menu = await this.menuService.getFullMenu(restaurantId);
    return { success: true, data: menu };
  }

  @Public()
  @Get('restaurants/:restaurantId/menu/categories')
  @ApiOperation({ summary: 'Get menu categories' })
  async getCategories(@Param('restaurantId') restaurantId: string) {
    const categories = await this.menuService.getCategories(restaurantId);
    return { success: true, data: categories };
  }

  @Public()
  @Get('restaurants/:restaurantId/menu/popular')
  @ApiOperation({ summary: 'Get popular items' })
  async getPopularItems(@Param('restaurantId') restaurantId: string) {
    const items = await this.menuService.getPopularItems(restaurantId);
    return { success: true, data: items };
  }

  @Public()
  @Get('restaurants/:restaurantId/menu/search')
  @ApiOperation({ summary: 'Search menu items' })
  @ApiQuery({ name: 'q', required: true })
  async searchItems(
    @Param('restaurantId') restaurantId: string,
    @Query('q') q: string,
  ) {
    const items = await this.menuService.searchItems(restaurantId, q);
    return { success: true, data: items };
  }

  @Public()
  @Get('menu-items/:id')
  @ApiOperation({ summary: 'Get menu item by ID' })
  async getItemById(@Param('id') id: string) {
    const item = await this.menuService.getItemById(id);
    return { success: true, data: item };
  }

  @Get('categories/:categoryId/items')
  @ApiOperation({ summary: 'Get items by category' })
  async getItemsByCategory(@Param('categoryId') categoryId: string) {
    const items = await this.menuService.getItemsByCategory(categoryId);
    return { success: true, data: items };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post('restaurants/:restaurantId/menu/categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create menu category' })
  async createCategory(
    @Param('restaurantId') restaurantId: string,
    @Body() data: Partial<MenuCategory>,
  ) {
    data.restaurantId = restaurantId;
    const category = await this.menuService.createCategory(data);
    return { success: true, data: category };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Put('menu/categories/:id')
  @ApiOperation({ summary: 'Update menu category' })
  async updateCategory(
    @Param('id') id: string,
    @Body() data: Partial<MenuCategory>,
  ) {
    const category = await this.menuService.updateCategory(id, data);
    return { success: true, data: category };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete('menu/categories/:id')
  @ApiOperation({ summary: 'Delete menu category' })
  async deleteCategory(@Param('id') id: string) {
    await this.menuService.deleteCategory(id);
    return { success: true, message: 'Category deleted' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post('menu/categories/:categoryId/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create menu item' })
  async createItem(
    @Param('categoryId') categoryId: string,
    @Body() data: Partial<MenuItem>,
  ) {
    data.categoryId = categoryId;
    const item = await this.menuService.createItem(data);
    return { success: true, data: item };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Put('menu-items/:id')
  @ApiOperation({ summary: 'Update menu item' })
  async updateItem(
    @Param('id') id: string,
    @Body() data: Partial<MenuItem>,
  ) {
    const item = await this.menuService.updateItem(id, data);
    return { success: true, data: item };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete('menu-items/:id')
  @ApiOperation({ summary: 'Delete menu item' })
  async deleteItem(@Param('id') id: string) {
    await this.menuService.deleteItem(id);
    return { success: true, message: 'Item deleted' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post('menu-items/:id/toggle-availability')
  @ApiOperation({ summary: 'Toggle item availability' })
  async toggleAvailability(@Param('id') id: string) {
    const item = await this.menuService.toggleAvailability(id);
    return { success: true, data: item };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post('menu-items/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate menu item' })
  async duplicateItem(@Param('id') id: string) {
    const item = await this.menuService.duplicateItem(id);
    return { success: true, data: item };
  }
}
