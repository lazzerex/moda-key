import { Controller, Post, Body, Get, Param, Req, Res, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { RefundDto } from './dto/refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create a payment intent for an order',
    description: 'Creates a Stripe PaymentIntent and returns the client secret for completing payment. ' +
                 'Includes idempotency support and validates payment amount matches order total. ' +
                 'Payment will auto-cancel after 30 minutes if not completed.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Payment intent created successfully',
    schema: {
      example: {
        clientSecret: 'pi_xxx_secret_yyy',
        paymentIntentId: 'pi_xxx',
        status: 'requires_payment_method',
        paymentId: 'clx7k9m0n0000abcdef123456'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data, amount mismatch, or validation failed' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT token' })
  async createIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Stripe webhook endpoint (internal use only)',
    description: 'Receives and processes Stripe webhook events. Handles payment_intent.succeeded, ' +
                 'payment_intent.payment_failed, and charge.refunded events. ' +
                 'Webhook signature is verified for security. This endpoint should only be called by Stripe.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    schema: { example: { received: true } }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid webhook signature or processing error',
    schema: { example: { error: 'Webhook signature verification failed' } }
  })
  async handleWebhook(@Req() req: any, @Res() res: any) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    try {
      await this.paymentsService.handleWebhook(req.body, signature || '');
      res.send({ received: true });
    } catch (err: any) {
      res.status(400).send({ error: err?.message || 'Webhook handling error' });
    }
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create a refund for a payment (Admin only)',
    description: 'Initiates a full or partial refund for a completed payment. ' +
                 'Creates Stripe refund, updates payment status, and logs in order history. ' +
                 'Partial refunds are supported by specifying an amount less than the original payment.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Refund created successfully',
    schema: {
      example: {
        refundId: 're_xxx',
        paymentId: 'clx7k9m0n0000abcdef123456',
        orderId: 'clx7k9m0n0001abcdef123456',
        amount: 99.99,
        status: 'succeeded',
        isPartialRefund: false
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Payment not refundable (wrong status), invalid amount, or Stripe API error' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires ADMIN role' })
  async createRefund(@Body() dto: RefundDto, @Req() req: any) {
    const adminUserId = req.user?.id;
    return this.paymentsService.createRefund(dto, adminUserId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get payment details by ID',
    description: 'Retrieves complete payment information including order details, status, and metadata.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment details retrieved successfully',
    schema: {
      example: {
        id: 'clx7k9m0n0000abcdef123456',
        orderId: 'clx7k9m0n0001abcdef123456',
        amount: 99.99,
        method: 'CREDIT_CARD',
        status: 'COMPLETED',
        transactionId: 'pi_xxx',
        provider: 'stripe',
        metadata: { amountValidated: true },
        createdAt: '2026-01-24T00:00:00.000Z',
        order: {
          id: 'clx7k9m0n0001abcdef123456',
          orderNumber: 'ORD-001',
          status: 'PAID',
          total: 99.99
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT token' })
  async getPayment(@Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  @Get('intent/:paymentIntentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get payment intent status from Stripe',
    description: 'Retrieves the current status of a Stripe PaymentIntent. ' +
                 'Useful for checking payment status in real-time without querying the database.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment intent retrieved successfully',
    schema: {
      example: {
        id: 'pi_xxx',
        status: 'succeeded',
        amount: 9999,
        currency: 'usd',
        clientSecret: 'pi_xxx_secret_yyy',
        metadata: { orderId: 'clx7k9m0n0001abcdef123456' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Payment intent not found in Stripe' })
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT token' })
  async getPaymentIntent(@Param('paymentIntentId') paymentIntentId: string) {
    return this.paymentsService.getPaymentIntent(paymentIntentId);
  }

  @Post('process-expired')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Process and cancel expired payments (Admin only)',
    description: 'Cancels all pending payments older than 30 minutes. ' +
                 'Updates payment status to CANCELLED and cancels payment intent in Stripe. ' +
                 'This endpoint should be called periodically by a cron job.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Expired payments processed successfully',
    schema: {
      example: {
        processedCount: 3
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires ADMIN role' })
  async processExpiredPayments() {
    return this.paymentsService.processExpiredPayments();
  }
}
