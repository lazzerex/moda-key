import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('MODAKey E-Commerce API')
    .setDescription('Production-grade mechanical keyboard store backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('products', 'Product management')
    .addTag('cart', 'Shopping cart operations')
    .addTag('orders', 'Order management')
    .addTag('inventory', 'Inventory management')
    .addTag('reviews', 'Product reviews and ratings')
    .addTag('admin', 'Admin operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Configure raw body parsing for Stripe webhooks only
  // The webhook route will be: <apiPrefix>/payments/webhook
  app.use(`${apiPrefix}/payments/webhook`, express.raw({ type: 'application/json' }));

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  
  logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
