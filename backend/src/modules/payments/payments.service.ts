import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    const secret = this.configService.get<string>('STRIPE_SECRET');
    if (!secret) {
      throw new Error(
        'STRIPE_SECRET environment variable is required. Please set it in your .env file. ' +
        'Get your API keys from https://dashboard.stripe.com/test/apikeys'
      );
    }
    this.stripe = new Stripe(secret, { apiVersion: '2022-11-15' } as any);
  }

  /**
   * Create a Stripe PaymentIntent and persist a Payment record
   */
  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    const idempotencyKey = dto.idempotencyKey;

    if (idempotencyKey) {
      const cached = await this.redis.getCached(`payments:idemp:${idempotencyKey}`);
      if (cached) return cached;
    }

    // Create Stripe PaymentIntent
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(dto.amount),
        currency: dto.currency || 'usd',
        metadata: { orderId: dto.orderId, ...(dto.metadata || {}) },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    // Persist payment record in DB
    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        amount: dto.amount / 100, // store as decimal (assumes incoming cents)
        method: 'CREDIT_CARD',
        status: 'PENDING',
        transactionId: intent.id,
        provider: 'stripe',
        metadata: dto.metadata || {},
      },
    });

    const response = {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      status: intent.status,
      paymentId: payment.id,
    };

    // Cache idempotency result for 24h
    if (idempotencyKey) {
      await this.redis.setCached(`payments:idemp:${idempotencyKey}`, response, 24 * 3600);
    }

    return response;
  }

  /**
   * Handle Stripe webhook events (expects raw body Buffer and signature header)
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret || '');
    } catch (err) {
      this.logger.error('Stripe webhook signature verification failed', err as any);
      throw err;
    }

    this.logger.log(`Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const payment = await this.prisma.payment.findUnique({ where: { transactionId: pi.id } });
        if (payment) {
          await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });
          await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const payment = await this.prisma.payment.findUnique({ where: { transactionId: pi.id } });
        if (payment) {
          await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // attempt to find payment by transactionId (charge.payment_intent)
        const paymentIntentId = (charge.payment_intent as string) || null;
        if (paymentIntentId) {
          const payment = await this.prisma.payment.findUnique({ where: { transactionId: paymentIntentId } });
          if (payment) {
            await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
            await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'REFUNDED' } });
          }
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }
}
