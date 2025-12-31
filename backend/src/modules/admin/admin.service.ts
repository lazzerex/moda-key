import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [totalUsers, totalOrders, totalProducts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.product.count(),
    ]);

    return {
      totalUsers,
      totalOrders,
      totalProducts,
    };
  }
}
