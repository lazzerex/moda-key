import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { RefundDto } from './dto/refund.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly PAYMENT_TIMEOUT_MINUTES = 30;

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

    // Check idempotency cache
    if (idempotencyKey) {
      const cached = await this.redis.getCached(`payments:idemp:${idempotencyKey}`);
      if (cached) {
        this.logger.log(`Returning cached payment intent for idempotency key: ${idempotencyKey}`);
        return cached;
      }
    }

    // Validate order exists and get order total
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate payment amount matches order total (fraud prevention)
    const expectedAmount = Math.round(order.total * 100); // convert to cents
    if (Math.abs(dto.amount - expectedAmount) > 1) { // allow 1 cent difference for rounding
      this.logger.error(
        `Payment amount mismatch for order ${dto.orderId}: ` +
        `requested=${dto.amount}, expected=${expectedAmount}`
      );
      throw new BadRequestException(
        'Payment amount does not match order total'
      );
    }

    // Create Stripe PaymentIntent with metadata for fraud detection
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(dto.amount),
        currency: dto.currency || 'usd',
        metadata: { 
          orderId: dto.orderId,
          userId: order.userId,
          orderTotal: order.total.toString(),
          ...(dto.metadata || {}) 
        },
        // Automatic payment methods for fraud detection
        automatic_payment_methods: {
          enabled: true,
        },
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
        metadata: {
          ...(dto.metadata || {}),
          createdAt: new Date().toISOString(),
          amountValidated: true,
        },
      },
    });

    // Log payment creation for audit
    this.logger.log(
      `Payment intent created: ${intent.id} for order ${dto.orderId}, ` +
      `amount: ${dto.amount / 100} ${dto.currency || 'usd'}`
    );

    // Set payment timeout (auto-cancel after 30 minutes)
    await this.schedulePaymentTimeout(payment.id, intent.id);

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

    // Log all webhook events for audit
    this.logger.log(
      `Received Stripe webhook event: ${event.type}, ID: ${event.id}`
    );

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        }
        case 'payment_intent.payment_failed': {
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        }
        case 'charge.refunded': {
          await this.handleRefundWebhook(event.data.object as Stripe.Charge);
          break;
        }
        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
      }

      // Log successful webhook processing
      this.logger.log(`Successfully processed webhook event: ${event.type}`);
      
      return { received: true };
    } catch (error) {
      // Log webhook processing errors for audit
      this.logger.error(
        `Error processing webhook ${event.type}: ${(error as Error).message}`,
        (error as Error).stack
      );
      // Stripe will retry webhooks that return non-2xx status
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(pi: Stripe.PaymentIntent) {
    const payment = await this.prisma.payment.findUnique({ 
      where: { transactionId: pi.id },
      include: { order: true }
    });
    
    if (!payment) {
      this.logger.warn(`Payment not found for PaymentIntent: ${pi.id}`);
      return;
    }

    // Cancel timeout check
    await this.cancelPaymentTimeout(payment.id);

    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({ 
        where: { id: payment.id }, 
        data: { 
          status: 'COMPLETED',
          metadata: {
            ...(payment.metadata as any || {}),
            completedAt: new Date().toISOString(),
            stripeChargeId: typeof pi.latest_charge === 'string' ? pi.latest_charge : null,
          } as any
        } 
      });

      // Update order status
      await tx.order.update({ 
        where: { id: payment.orderId }, 
        data: { status: 'PAID' } 
      });

      // Create order history entry
      await tx.orderHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'PAID',
          notes: `Payment completed via Stripe. Payment ID: ${payment.id}`,
        }
      });

      this.logger.log(
        `Payment completed: ${payment.id}, Order: ${payment.orderId}, ` +
        `Amount: ${payment.amount}`
      );
    });

    // TODO: Queue order confirmation email
    // TODO: Convert inventory reservation to sale
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(pi: Stripe.PaymentIntent) {
    const payment = await this.prisma.payment.findUnique({ 
      where: { transactionId: pi.id },
      include: { order: true }
    });
    
    if (!payment) {
      this.logger.warn(`Payment not found for PaymentIntent: ${pi.id}`);
      return;
    }

    // Cancel timeout check
    await this.cancelPaymentTimeout(payment.id);

    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({ 
        where: { id: payment.id }, 
        data: { 
          status: 'FAILED',
          metadata: {
            ...(payment.metadata as any || {}),
            failedAt: new Date().toISOString(),
            failureReason: pi.last_payment_error?.message || 'Unknown error',
          } as any
        }
      });

      // Create order history entry
      await tx.orderHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'PENDING',
          notes: `Payment failed: ${pi.last_payment_error?.message || 'Unknown error'}`,
        }
      });

      this.logger.warn(
        `Payment failed: ${payment.id}, Order: ${payment.orderId}, ` +
        `Reason: ${pi.last_payment_error?.message || 'Unknown'}`
      );
    });

    // TODO: Release inventory reservation
    // TODO: Queue failure notification email
  }

  /**
   * Handle refund webhook
   */
  private async handleRefundWebhook(charge: Stripe.Charge) {
    const paymentIntentId = (charge.payment_intent as string) || null;
    if (!paymentIntentId) {
      this.logger.warn('No payment_intent in charge.refunded event');
      return;
    }

    const payment = await this.prisma.payment.findUnique({ 
      where: { transactionId: paymentIntentId } 
    });
    
    if (!payment) {
      this.logger.warn(`Payment not found for PaymentIntent: ${paymentIntentId}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({ 
        where: { id: payment.id }, 
        data: { 
          status: 'REFUNDED',
          metadata: {
            ...(payment.metadata as any || {}),
            refundedAt: new Date().toISOString(),
            refundAmount: charge.amount_refunded / 100,
          } as any
        }
      });

      // Update order status
      await tx.order.update({ 
        where: { id: payment.orderId }, 
        data: { status: 'REFUNDED' } 
      });

      // Create order history entry
      await tx.orderHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'REFUNDED',
          notes: `Order refunded. Refund amount: ${charge.amount_refunded / 100}`,
        }
      });

      this.logger.log(
        `Refund processed: Payment ${payment.id}, Order: ${payment.orderId}, ` +
        `Amount: ${charge.amount_refunded / 100}`
      );
    });

    // TODO: Restore inventory
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(dto: RefundDto, adminUserId: string) {
    // 1. Find and validate payment
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { order: { include: { items: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // 2. Validate payment is refundable
    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Payment cannot be refunded. Current status: ${payment.status}`
      );
    }

    if (payment.provider !== 'stripe') {
      throw new BadRequestException(
        `Refunds not supported for payment provider: ${payment.provider}`
      );
    }

    // 3. Calculate refund amount
    const maxRefundAmount = Math.round(payment.amount * 100); // convert to cents
    const refundAmount = dto.amount ? Math.round(dto.amount) : maxRefundAmount;

    // 4. Validate refund amount
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    if (refundAmount > maxRefundAmount) {
      throw new BadRequestException(
        `Refund amount (${refundAmount / 100}) exceeds payment amount (${payment.amount})`
      );
    }

    const isPartialRefund = refundAmount < maxRefundAmount;

    this.logger.log(
      `Creating ${isPartialRefund ? 'partial' : 'full'} refund: ` +
      `Payment ${payment.id}, Amount: ${refundAmount / 100}, ` +
      `Reason: ${dto.reason || 'Not specified'}`
    );

    try {
      // 5. Create Stripe refund
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.transactionId as string,
        amount: refundAmount,
        reason: this.mapRefundReason(dto.reason),
        metadata: {
          paymentId: payment.id,
          orderId: payment.orderId,
          adminUserId,
          refundReason: dto.reason || 'Admin initiated',
        },
      });

      // 6. Update payment and order in transaction
      await this.prisma.$transaction(async (tx) => {
        // Update payment status
        const newStatus = (isPartialRefund ? 'PARTIAL_REFUND' : 'REFUNDED') as any;
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: newStatus,
            metadata: {
              ...(payment.metadata as any || {}),
              refundedAt: new Date().toISOString(),
              refundAmount: refundAmount / 100,
              refundId: refund.id,
              refundReason: dto.reason,
              isPartialRefund,
            } as any,
          },
        });

        // Update order status if full refund
        if (!isPartialRefund) {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'REFUNDED' },
          });
        }

        // Create order history entry
        await tx.orderHistory.create({
          data: {
            orderId: payment.orderId,
            status: isPartialRefund ? 'PAID' : 'REFUNDED',
            notes: `${isPartialRefund ? 'Partial' : 'Full'} refund issued: ${refundAmount / 100} ${(payment.metadata as any)?.currency || 'USD'}. Reason: ${dto.reason || 'Not specified'}`,
            createdBy: adminUserId,
          },
        });
      });

      this.logger.log(
        `Refund created successfully: ${refund.id}, Payment: ${payment.id}, ` +
        `Amount: ${refundAmount / 100}`
      );

      // TODO: Restore inventory for refunded items
      // TODO: Queue refund confirmation email

      return {
        refundId: refund.id,
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: refundAmount / 100,
        status: refund.status,
        isPartialRefund,
      };
    } catch (error) {
      this.logger.error(
        `Stripe refund failed for payment ${payment.id}: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw new BadRequestException(
        `Failed to create refund: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  /**
   * Get payment intent status from Stripe
   */
  async getPaymentIntent(paymentIntentId: string) {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        id: intent.id,
        status: intent.status,
        amount: intent.amount / 100,
        currency: intent.currency,
        clientSecret: intent.client_secret,
        metadata: intent.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve PaymentIntent ${paymentIntentId}: ${(error as Error).message}`
      );
      throw new NotFoundException('Payment intent not found');
    }
  }

  /**
   * Schedule payment timeout check
   * Payment will be cancelled if not completed within timeout period
   */
  private async schedulePaymentTimeout(paymentId: string, paymentIntentId: string) {
    const timeoutKey = `payment:timeout:${paymentId}`;
    const timeoutSeconds = this.PAYMENT_TIMEOUT_MINUTES * 60;
    
    // Store payment info with expiration
    await this.redis.setCached(
      timeoutKey,
      { paymentId, paymentIntentId, scheduledAt: new Date().toISOString() },
      timeoutSeconds
    );

    this.logger.log(
      `Payment timeout scheduled: ${paymentId}, expires in ${this.PAYMENT_TIMEOUT_MINUTES} minutes`
    );
  }

  /**
   * Cancel payment timeout (called when payment succeeds or fails)
   */
  private async cancelPaymentTimeout(paymentId: string) {
    const timeoutKey = `payment:timeout:${paymentId}`;
    // Redis service doesn't have delete method, just let it expire
    this.logger.log(`Payment timeout will auto-expire: ${paymentId}`);
  }

  /**
   * Check for expired payments and cancel them
   * This should be called periodically by a cron job
   */
  async processExpiredPayments() {
    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: new Date(Date.now() - this.PAYMENT_TIMEOUT_MINUTES * 60 * 1000),
        },
      },
      include: { order: true },
    });

    this.logger.log(`Found ${expiredPayments.length} expired payments to process`);

    for (const payment of expiredPayments) {
      try {
        // Cancel payment intent in Stripe
        if (payment.transactionId) {
          await this.stripe.paymentIntents.cancel(payment.transactionId);
        }

        // Update payment status
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'CANCELLED' as any,
              metadata: {
                ...(payment.metadata as any || {}),
                cancelledAt: new Date().toISOString(),
                cancelReason: 'Payment timeout',
              } as any,
            },
          });

          // Create order history entry
          await tx.orderHistory.create({
            data: {
              orderId: payment.orderId,
              status: 'PENDING',
              notes: 'Payment cancelled due to timeout (30 minutes)',
            },
          });
        });

        this.logger.log(`Cancelled expired payment: ${payment.id}`);
        
        // TODO: Release inventory reservation
      } catch (error) {
        this.logger.error(
          `Failed to cancel expired payment ${payment.id}: ${(error as Error).message}`
        );
      }
    }

    return { processedCount: expiredPayments.length };
  }

  /**
   * Map refund reason to Stripe enum
   */
  private mapRefundReason(reason?: string): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
    if (!reason) return 'requested_by_customer';
    
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('duplicate')) return 'duplicate';
    if (lowerReason.includes('fraud')) return 'fraudulent';
    
    return 'requested_by_customer';
  }

  /**
   * Fraud detection hook - to be implemented with external service
   * This is a placeholder for future fraud detection integration
   */
  private async detectFraud(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
    // TODO: Integrate with fraud detection service (e.g., Stripe Radar, Sift)
    // Check for:
    // - Unusual purchase patterns
    // - Multiple failed attempts
    // - Mismatched billing/shipping addresses
    // - High-risk countries
    // - Velocity checks (multiple orders in short time)
    
    this.logger.log(`Fraud check for payment intent: ${paymentIntent.id} - Not implemented`);
    return false; // No fraud detected (placeholder)
  }
}
