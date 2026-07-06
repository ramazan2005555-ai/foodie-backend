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
import { BannersService } from './banners.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { Banner } from './banner.entity';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Get active banners' })
  async getActive() {
    const banners = await this.bannersService.getActiveBanners();
    return { success: true, data: banners };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all banners' })
  async findAll(@Query() query: any) {
    return this.bannersService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get banner by ID' })
  async findById(@Param('id') id: string) {
    const banner = await this.bannersService.findById(id);
    return { success: true, data: banner };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create banner (admin)' })
  async create(@Body() data: Partial<Banner>) {
    const banner = await this.bannersService.create(data);
    return { success: true, data: banner };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Update banner (admin)' })
  async update(@Param('id') id: string, @Body() data: Partial<Banner>) {
    const banner = await this.bannersService.update(id, data);
    return { success: true, data: banner };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete banner (admin)' })
  async remove(@Param('id') id: string) {
    await this.bannersService.remove(id);
    return { success: true, message: 'Banner deleted' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('reorder')
  @ApiOperation({ summary: 'Reorder banners (admin)' })
  async reorder(@Body('ids') ids: string[]) {
    await this.bannersService.reorder(ids);
    return { success: true, message: 'Banners reordered' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle banner active status (admin)' })
  async toggleActive(@Param('id') id: string) {
    const banner = await this.bannersService.toggleActive(id);
    return { success: true, data: banner };
  }
}
