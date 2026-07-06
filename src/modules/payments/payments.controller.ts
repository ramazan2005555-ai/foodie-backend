import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard, UserRole } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { User } from '../users/user.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('create-intent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Stripe payment intent' })
  async createPaymentIntent(
    @CurrentUser() user: User,
    @Body() data: { orderId: string; amount: number; currency?: string; metadata?: any },
  ) {
    const result = await this.paymentsService.createPaymentIntent(
      user.id,
      data.orderId,
      data.amount,
      data.currency || 'usd',
      data.metadata,
    );
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('confirm/:paymentIntentId')
  @ApiOperation({ summary: 'Confirm payment' })
  async confirmPayment(@Param('paymentIntentId') paymentIntentId: string) {
    const payment = await this.paymentsService.confirmPayment(paymentIntentId);
    return { success: true, data: payment };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund payment' })
  async refundPayment(
    @Param('id') id: string,
    @Body('amount') amount?: number,
    @Body('reason') reason?: string,
  ) {
    const payment = await this.paymentsService.processRefund(
      id,
      amount,
      reason,
    );
    return { success: true, data: payment };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    return this.paymentsService.handleStripeWebhook(
      signature,
      req.body,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('history')
  @ApiOperation({ summary: 'Get payment history' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.paymentsService.getPaymentHistory(userId, page, limit);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  async findById(@Param('id') id: string) {
    const payment = await this.paymentsService.findById(id);
    return { success: true, data: payment };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('apple-pay')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Process Apple Pay payment' })
  async applePay(
    @CurrentUser() user: User,
    @Body() data: { orderId: string; amount: number; paymentData: any },
  ) {
    const payment = await this.paymentsService.processApplePay(
      user.id,
      data.orderId,
      data.amount,
      data.paymentData,
    );
    return { success: true, data: payment };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('google-pay')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Process Google Pay payment' })
  async googlePay(
    @CurrentUser() user: User,
    @Body() data: { orderId: string; amount: number; paymentData: any },
  ) {
    const payment = await this.paymentsService.processGooglePay(
      user.id,
      data.orderId,
      data.amount,
      data.paymentData,
    );
    return { success: true, data: payment };
  }
}
