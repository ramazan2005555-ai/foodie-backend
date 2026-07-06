import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { User } from '../users/user.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe device to push notifications' })
  async subscribe(
    @CurrentUser() user: User,
    @Body('deviceToken') deviceToken: string,
  ) {
    return { success: true, message: 'Device subscribed' };
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe device from push notifications' })
  async unsubscribe(@CurrentUser() user: User) {
    return { success: true, message: 'Device unsubscribed' };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send test notification (admin)' })
  async testNotification(
    @Body('deviceToken') deviceToken: string,
    @Body('title') title: string,
    @Body('body') body: string,
  ) {
    const result = await this.notificationsService.sendPushNotification(
      deviceToken,
      { title, body },
    );
    return { success: result, message: result ? 'Notification sent' : 'Failed to send' };
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Broadcast notification to topic (admin)' })
  async broadcast(
    @Body('topic') topic: string,
    @Body('title') title: string,
    @Body('body') body: string,
  ) {
    const result = await this.notificationsService.sendToTopic(topic, {
      title,
      body,
      priority: 'high',
    });
    return { success: result };
  }
}
