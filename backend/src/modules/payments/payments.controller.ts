import { Controller, Post, Body, Get, Param, Req, Res, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  async createIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Req() req: any, @Res() res: any) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    try {
      await this.paymentsService.handleWebhook(req.body, signature || '');
      res.send({ received: true });
    } catch (err: any) {
      res.status(400).send({ error: err?.message || 'Webhook handling error' });
    }
  }
}
