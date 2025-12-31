import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventory() {
    return this.prisma.inventory.findMany({
      include: { productVariant: { include: { product: true } } },
    });
  }
}
