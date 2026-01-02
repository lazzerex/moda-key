import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  ConflictException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus, Order, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { 
        items: {
          include: {
            productVariant: {
              include: {
                product: true
              }
            }
          }
        }, 
        payments: true,
        shippingAddress: true 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { 
          include: { 
            productVariant: { 
              include: { product: true } 
            } 
          } 
        },
        payments: true,
        history: {
          orderBy: { createdAt: 'desc' }
        },
        shippingAddress: true,
        billingAddress: true
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Create order with atomic inventory reservation
   * This is the critical transaction that prevents overselling
   */
  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto
  ): Promise<Order> {
    const { shippingAddressId, billingAddressId, paymentMethod, couponCode } = createOrderDto;

    // 1. Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Get user's cart with items
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                inventory: true
              }
            }
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 3. Validate shipping address
    const shippingAddress = await this.prisma.userAddress.findFirst({
      where: { id: shippingAddressId, userId }
    });

    if (!shippingAddress) {
      throw new NotFoundException('Shipping address not found');
    }

    // 4. Validate billing address if provided
    let validatedBillingAddressId = billingAddressId;
    if (billingAddressId) {
      const billingAddress = await this.prisma.userAddress.findFirst({
        where: { id: billingAddressId, userId }
      });
      if (!billingAddress) {
        throw new NotFoundException('Billing address not found');
      }
    } else {
      validatedBillingAddressId = shippingAddressId;
    }

    // 5. Calculate order totals
    let subtotal = 0;
    for (const item of cart.items) {
      subtotal += item.productVariant.price * item.quantity;
    }

    // 6. Apply coupon if provided
    let discount = 0;
    if (couponCode) {
      const coupon = await this.prisma.coupon.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      if (coupon) {
        if (subtotal >= coupon.minPurchase) {
          if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            throw new BadRequestException('Coupon usage limit reached');
          }

          if (coupon.type === 'PERCENTAGE') {
            discount = (subtotal * coupon.value) / 100;
            if (coupon.maxDiscount) {
              discount = Math.min(discount, coupon.maxDiscount);
            }
          } else if (coupon.type === 'FIXED_AMOUNT') {
            discount = coupon.value;
          }
        }
      }
    }

    // 7. Calculate tax and shipping (simplified - would be more complex in production)
    const tax = subtotal * 0.1; // 10% tax
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const total = subtotal + tax + shipping - discount;

    // 8. Create order with inventory reservation in a transaction
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Reserve inventory for all items FIRST
        for (const item of cart.items) {
          await this.inventoryService.reserveInventory(
            item.productVariantId,
            item.quantity,
            userId,
            'Order creation'
          );
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create the order
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: OrderStatus.PENDING,
            subtotal,
            tax,
            shipping,
            discount,
            total,
            shippingAddressId,
            billingAddressId: validatedBillingAddressId,
            items: {
              create: cart.items.map(item => ({
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                priceAtPurchase: item.productVariant.price,
                productSnapshot: {
                  name: item.productVariant.product.name,
                  variantName: item.productVariant.name,
                  sku: item.productVariant.sku,
                  price: item.productVariant.price,
                  switchType: item.productVariant.switchType,
                  layout: item.productVariant.layout,
                  color: item.productVariant.color
                }
              }))
            },
            history: {
              create: {
                status: OrderStatus.PENDING,
                notes: 'Order created',
                createdBy: userId
              }
            }
          },
          include: {
            items: {
              include: {
                productVariant: {
                  include: {
                    product: true
                  }
                }
              }
            },
            shippingAddress: true,
            billingAddress: true
          }
        });

        // Update coupon usage if applied
        if (couponCode) {
          await tx.coupon.updateMany({
            where: { code: couponCode },
            data: {
              usedCount: { increment: 1 }
            }
          });

          await tx.userCoupon.create({
            data: {
              userId,
              couponId: (await tx.coupon.findUnique({ where: { code: couponCode } }))!.id,
              usedAt: new Date()
            }
          });
        }

        // Clear the cart
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id }
        });

        this.logger.log(
          `Order ${orderNumber} created for user ${userId} with ${cart.items.length} items. Total: $${total.toFixed(2)}`
        );

        return newOrder;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000
      });

      return order;

    } catch (error) {
      this.logger.error('Order creation failed', error.stack);
      
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to create order. Please try again.');
    }
  }

  /**
   * Cancel order and release reserved inventory
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    cancelDto?: CancelOrderDto
  ): Promise<Order> {
    // 1. Get the order with items
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 2. Check if order can be cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot cancel order that has been shipped or delivered'
      );
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Order has already been refunded');
    }

    // 3. Cancel order and release inventory in transaction
    try {
      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        // Release inventory for all items
        for (const item of order.items) {
          if (order.status === OrderStatus.PENDING) {
            // If order was pending, just release the reservation
            await this.inventoryService.releaseReservation(
              item.productVariantId,
              item.quantity,
              userId,
              `Order ${order.orderNumber} cancelled`
            );
          } else if (order.status === OrderStatus.PAID || order.status === OrderStatus.PROCESSING) {
            // If order was paid/processing, return stock to inventory
            await tx.inventory.update({
              where: { productVariantId: item.productVariantId },
              data: {
                quantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity }
              }
            });

            await tx.inventoryLog.create({
              data: {
                variantId: (await tx.inventory.findUnique({
                  where: { productVariantId: item.productVariantId }
                }))!.id,
                changeType: 'RETURN',
                quantityChange: item.quantity,
                reason: `Order ${order.orderNumber} cancelled`,
                userId
              }
            });
          }
        }

        // Update order status
        const cancelled = await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            history: {
              create: {
                status: OrderStatus.CANCELLED,
                notes: cancelDto?.reason || 'Order cancelled by customer',
                createdBy: userId
              }
            }
          },
          include: {
            items: {
              include: {
                productVariant: {
                  include: {
                    product: true
                  }
                }
              }
            },
            shippingAddress: true,
            history: true
          }
        });

        this.logger.log(
          `Order ${order.orderNumber} cancelled. Inventory released for ${order.items.length} items.`
        );

        return cancelled;
      });

      return updatedOrder;

    } catch (error) {
      this.logger.error(`Failed to cancel order ${orderId}`, error.stack);
      throw new BadRequestException('Failed to cancel order. Please try again.');
    }
  }

  /**
   * Admin: Update order status
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    adminUserId: string,
    notes?: string
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // If marking as PAID, confirm the sale in inventory
    if (newStatus === OrderStatus.PAID && order.status === OrderStatus.PENDING) {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const item of order.items) {
            await this.inventoryService.confirmSale(
              item.productVariantId,
              item.quantity,
              adminUserId,
              `Order ${order.orderNumber} paid`
            );
          }

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: newStatus,
              history: {
                create: {
                  status: newStatus,
                  notes: notes || `Order marked as ${newStatus}`,
                  createdBy: adminUserId
                }
              }
            }
          });
        });
      } catch (error) {
        this.logger.error(`Failed to update order status to PAID`, error.stack);
        throw error;
      }
    } else {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          history: {
            create: {
              status: newStatus,
              notes: notes || `Order status updated to ${newStatus}`,
              createdBy: adminUserId
            }
          }
        }
      });
    }

    this.logger.log(`Order ${order.orderNumber} status updated to ${newStatus}`);

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true
              }
            }
          }
        },
        shippingAddress: true,
        billingAddress: true,
        history: true
      }
    });

    if (!updatedOrder) {
      throw new NotFoundException('Order not found after update');
    }

    return updatedOrder;
  }
}
