import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get or create cart for user
   */
  async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                inventory: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  product: true,
                  inventory: true,
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  /**
   * Add item to cart
   */
  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { productVariantId, quantity } = addToCartDto;

    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Verify variant exists and has stock
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: productVariantId },
      include: { inventory: true, product: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const availableStock =
      (variant.inventory?.quantity || 0) - (variant.inventory?.reservedQuantity || 0);

    if (availableStock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${availableStock} available.`,
      );
    }

    // Check if item already in cart
    let cartItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productVariantId,
      },
    });

    if (cartItem) {
      // Update quantity
      cartItem = await this.prisma.cartItem.update({
        where: { id: cartItem.id },
        data: {
          quantity: cartItem.quantity + quantity,
        },
        include: {
          productVariant: {
            include: {
              product: true,
              inventory: true,
            },
          },
        },
      });
    } else {
      // Create new cart item
      cartItem = await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId,
          quantity,
          priceAtAdd: variant.price,
        },
        include: {
          productVariant: {
            include: {
              product: true,
              inventory: true,
            },
          },
        },
      });
    }

    // Update cart timestamp
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Item added to cart for user ${userId}`);
    return cartItem;
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId: string, cartItemId: string, updateDto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
      include: {
        productVariant: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Verify stock availability
    const availableStock =
      (cartItem.productVariant.inventory?.quantity || 0) -
      (cartItem.productVariant.inventory?.reservedQuantity || 0);

    if (availableStock < updateDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${availableStock} available.`,
      );
    }

    const updated = await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: updateDto.quantity },
      include: {
        productVariant: {
          include: {
            product: true,
            inventory: true,
          },
        },
      },
    });

    // Update cart timestamp
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return updated;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string, cartItemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    // Update cart timestamp
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Item removed from cart for user ${userId}`);
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // Update cart timestamp
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Cart cleared for user ${userId}`);
  }

  /**
   * Get cart with items
   */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    // Calculate totals
    let subtotal = 0;
    cart.items.forEach((item) => {
      subtotal += item.priceAtAdd * item.quantity;
    });

    return {
      ...cart,
      summary: {
        itemCount: cart.items.length,
        subtotal,
      },
    };
  }
}
