import { 
  Injectable, 
  ConflictException, 
  NotFoundException,
  Logger,
  BadRequestException 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeType, Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getInventory() {
    return this.prisma.inventory.findMany({
      include: { productVariant: { include: { product: true } } },
    });
  }

  /**
   * Reserve inventory with optimistic locking to prevent overselling
   * Uses Prisma transaction to ensure atomicity
   */
  async reserveInventory(
    variantId: string, 
    quantity: number, 
    userId?: string,
    reason: string = 'Order creation'
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Lock the inventory row with FOR UPDATE to prevent race conditions
        const inventory = await tx.inventory.findUnique({
          where: { productVariantId: variantId },
          include: {
            productVariant: {
              select: { sku: true, name: true }
            }
          }
        });

        if (!inventory) {
          throw new NotFoundException(
            `Inventory not found for variant ${variantId}`
          );
        }

        // 2. Calculate available stock (total - reserved)
        const availableStock = inventory.quantity - inventory.reservedQuantity;

        this.logger.debug(
          `Reserving ${quantity} units of ${inventory.productVariant.sku}. ` +
          `Available: ${availableStock}, Reserved: ${inventory.reservedQuantity}, Total: ${inventory.quantity}`
        );

        if (availableStock < quantity) {
          throw new ConflictException(
            `Insufficient stock for ${inventory.productVariant.name}. ` +
            `Requested: ${quantity}, Available: ${availableStock}`
          );
        }

        // 3. Reserve the stock atomically with optimistic locking
        // Using the current quantity as a version check
        const updated = await tx.inventory.updateMany({
          where: { 
            productVariantId: variantId,
            // Optimistic lock: ensure quantity hasn't changed since we read it
            quantity: inventory.quantity,
            reservedQuantity: inventory.reservedQuantity
          },
          data: {
            reservedQuantity: {
              increment: quantity
            }
          }
        });

        // 4. If no rows were updated, it means another transaction changed the inventory
        if (updated.count === 0) {
          throw new ConflictException(
            'Inventory was modified by another transaction. Please retry.'
          );
        }

        // 5. Log the reservation
        await tx.inventoryLog.create({
          data: {
            variantId: inventory.id,
            changeType: ChangeType.RESERVATION,
            quantityChange: quantity,
            reason,
            userId
          }
        });

        this.logger.log(
          `Reserved ${quantity} units of ${inventory.productVariant.sku} for ${reason}`
        );
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000, // 5 seconds
        timeout: 10000 // 10 seconds
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(
        `Failed to reserve inventory for variant ${variantId}`,
        error.stack
      );
      throw new ConflictException(
        'Failed to reserve inventory. Please try again.'
      );
    }
  }

  /**
   * Release reserved inventory (e.g., on order cancellation)
   */
  async releaseReservation(
    variantId: string,
    quantity: number,
    userId?: string,
    reason: string = 'Order cancellation'
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: { productVariantId: variantId },
          include: {
            productVariant: {
              select: { sku: true, name: true }
            }
          }
        });

        if (!inventory) {
          throw new NotFoundException(
            `Inventory not found for variant ${variantId}`
          );
        }

        // Ensure we don't release more than what's reserved
        if (inventory.reservedQuantity < quantity) {
          this.logger.warn(
            `Attempting to release ${quantity} but only ${inventory.reservedQuantity} reserved for ${inventory.productVariant.sku}`
          );
          // Release only what's actually reserved
          quantity = inventory.reservedQuantity;
        }

        // Release the reservation
        await tx.inventory.update({
          where: { productVariantId: variantId },
          data: {
            reservedQuantity: {
              decrement: quantity
            }
          }
        });

        // Log the release
        await tx.inventoryLog.create({
          data: {
            variantId: inventory.id,
            changeType: ChangeType.RELEASE,
            quantityChange: quantity,
            reason,
            userId
          }
        });

        this.logger.log(
          `Released ${quantity} reserved units of ${inventory.productVariant.sku} - ${reason}`
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to release inventory for variant ${variantId}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Confirm sale and reduce actual inventory (after payment confirmation)
   */
  async confirmSale(
    variantId: string,
    quantity: number,
    userId?: string,
    reason: string = 'Order confirmed'
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: { productVariantId: variantId },
          include: {
            productVariant: {
              select: { sku: true }
            }
          }
        });

        if (!inventory) {
          throw new NotFoundException(
            `Inventory not found for variant ${variantId}`
          );
        }

        // Reduce both reserved quantity and total quantity
        await tx.inventory.update({
          where: { productVariantId: variantId },
          data: {
            quantity: {
              decrement: quantity
            },
            reservedQuantity: {
              decrement: quantity
            }
          }
        });

        // Log the sale
        await tx.inventoryLog.create({
          data: {
            variantId: inventory.id,
            changeType: ChangeType.SALE,
            quantityChange: -quantity,
            reason,
            userId
          }
        });

        this.logger.log(
          `Confirmed sale of ${quantity} units of ${inventory.productVariant.sku}`
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to confirm sale for variant ${variantId}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Adjust inventory (admin only)
   */
  async adjustInventory(
    variantId: string,
    quantityChange: number,
    reason: string,
    userId?: string
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: { productVariantId: variantId },
          include: {
            productVariant: {
              select: { sku: true }
            }
          }
        });

        if (!inventory) {
          throw new NotFoundException(
            `Inventory not found for variant ${variantId}`
          );
        }

        const newQuantity = inventory.quantity + quantityChange;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Cannot adjust inventory below 0. Current: ${inventory.quantity}, Change: ${quantityChange}`
          );
        }

        await tx.inventory.update({
          where: { productVariantId: variantId },
          data: {
            quantity: newQuantity
          }
        });

        // Log the adjustment
        await tx.inventoryLog.create({
          data: {
            variantId: inventory.id,
            changeType: ChangeType.ADJUSTMENT,
            quantityChange,
            reason,
            userId
          }
        });

        this.logger.log(
          `Adjusted inventory for ${inventory.productVariant.sku} by ${quantityChange} (Reason: ${reason})`
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to adjust inventory for variant ${variantId}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Get available stock for a variant
   */
  async getAvailableStock(variantId: string): Promise<number> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productVariantId: variantId }
    });

    if (!inventory) {
      return 0;
    }

    return inventory.quantity - inventory.reservedQuantity;
  }
}
