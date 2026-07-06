import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, PaymentProvider } from './payment.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: any;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private configService: ConfigService,
  ) {
    if (this.configService.get<string>('app.stripeSecretKey')) {
      this.stripe = require('stripe')(
        this.configService.get<string>('app.stripeSecretKey'),
      );
    }
  }

  async createPaymentIntent(
    userId: string,
    orderId: string,
    amount: number,
    currency: string = 'usd',
    metadata?: any,
  ): Promise<any> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        metadata: {
          orderId,
          userId,
          ...metadata,
        },
      });

      const payment = this.paymentRepository.create({
        userId,
        orderId,
        amount,
        currency,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        stripePaymentIntentId: paymentIntent.id,
        metadata,
        netAmount: amount,
      });

      await this.paymentRepository.save(payment);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        amount,
        currency,
      };
    } catch (error) {
      this.logger.error(`Stripe payment intent error: ${error.message}`);
      throw new BadRequestException(
        `Payment intent creation failed: ${error.message}`,
      );
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<Payment> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const intent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId,
      );

      const payment = await this.paymentRepository.findOne({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (intent.status === 'succeeded') {
        payment.status = PaymentStatus.SUCCEEDED;
        payment.paidAt = new Date();
        payment.stripeChargeId = intent.latest_charge;
        payment.fee = intent.charges?.data[0]?.balance_transaction
          ? await this.calculateStripeFee(
              intent.charges.data[0].balance_transaction,
            )
          : 0;
        payment.netAmount = payment.amount - payment.fee;
      } else if (intent.status === 'processing') {
        payment.status = PaymentStatus.PENDING;
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.failedAt = new Date();
        payment.failureMessage =
          intent.last_payment_error?.message || 'Payment failed';
      }

      return this.paymentRepository.save(payment);
    } catch (error) {
      this.logger.error(`Payment confirmation error: ${error.message}`);
      throw new BadRequestException('Payment confirmation failed');
    }
  }

  async processRefund(
    paymentId: string,
    amount?: number,
    reason?: string,
  ): Promise<Payment> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('Payment cannot be refunded');
    }

    try {
      const refundAmount = amount
        ? Math.round(amount * 100)
        : undefined;

      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmount,
        reason: reason === 'requested_by_customer'
          ? 'requested_by_customer'
          : 'duplicate',
      });

      if (refund.status === 'succeeded') {
        if (refundAmount && refundAmount < payment.amount * 100) {
          payment.status = PaymentStatus.PARTIALLY_REFUNDED;
        } else {
          payment.status = PaymentStatus.REFUNDED;
        }
        payment.refundedAt = new Date();
        payment.refundReason = reason || '';
      }

      return this.paymentRepository.save(payment);
    } catch (error) {
      this.logger.error(`Refund error: ${error.message}`);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  async handleStripeWebhook(signature: string, payload: Buffer): Promise<any> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webhookSecret = this.configService.get<string>(
      'app.stripeWebhookSecret',
    );

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.confirmPayment(event.data.object.id);
          break;
        case 'payment_intent.payment_failed':
          await this.handleFailedPayment(event.data.object.id);
          break;
        case 'charge.refunded':
          await this.handleRefundUpdate(event.data.object);
          break;
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }

  async getPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const [payments, total] = await this.paymentRepository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: payments,
      meta: {
        totalItems: total,
        itemCount: payments.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private async handleFailedPayment(paymentIntentId: string): Promise<void> {
    await this.paymentRepository.update(
      { stripePaymentIntentId: paymentIntentId },
      {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failureMessage: 'Payment failed',
      },
    );
  }

  private async handleRefundUpdate(charge: any): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (paymentIntentId) {
      const payment = await this.paymentRepository.findOne({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (payment) {
        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAt = new Date();
        await this.paymentRepository.save(payment);
      }
    }
  }

  private async calculateStripeFee(
    balanceTransactionId: string,
  ): Promise<number> {
    try {
      const transaction = await this.stripe.balanceTransactions.retrieve(
        balanceTransactionId,
      );
      return transaction.fee / 100;
    } catch {
      return 0;
    }
  }

  async processApplePay(
    userId: string,
    orderId: string,
    amount: number,
    paymentData: any,
  ): Promise<Payment> {
    const payment = this.paymentRepository.create({
      userId,
      orderId,
      amount,
      provider: PaymentProvider.APPLE_PAY,
      status: PaymentStatus.SUCCEEDED,
      paidAt: new Date(),
      netAmount: amount,
      metadata: paymentData,
    });

    return this.paymentRepository.save(payment);
  }

  async processGooglePay(
    userId: string,
    orderId: string,
    amount: number,
    paymentData: any,
  ): Promise<Payment> {
    const payment = this.paymentRepository.create({
      userId,
      orderId,
      amount,
      provider: PaymentProvider.GOOGLE_PAY,
      status: PaymentStatus.SUCCEEDED,
      paidAt: new Date(),
      netAmount: amount,
      metadata: paymentData,
    });

    return this.paymentRepository.save(payment);
  }
}
