import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(id: string, userId: string) {
    return this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { include: { productVariant: { include: { product: true } } } },
        payments: true,
        history: true,
      },
    });
  }
}
