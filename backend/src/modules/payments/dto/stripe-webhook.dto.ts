export class StripeWebhookDto {
  // Keeping generic since Stripe sends varied event payloads
  id: string;
  type: string;
  data: any;
}
