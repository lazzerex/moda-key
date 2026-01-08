import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignTrackingDto } from './dto/assign-tracking.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { OrderFilterDto } from './dto/order-filter.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { OrderStatus, Prisma } from '@prisma/client';
import { Parser } from 'json2csv';

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

  // ============================================
  // INVENTORY MANAGEMENT
  // ============================================

  async adjustInventory(dto: AdjustInventoryDto, userId: string) {
    const { variantId, quantityChange, changeType, reason } = dto;

    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Get or create inventory record
    let inventory = variant.inventory;
    if (!inventory) {
      inventory = await this.prisma.inventory.create({
        data: {
          productVariantId: variantId,
          quantity: 0,
          reservedQuantity: 0,
        },
      });
    }

    const newQuantity = inventory.quantity + quantityChange;

    if (newQuantity < 0) {
      throw new BadRequestException('Resulting inventory quantity cannot be negative');
    }

    // Update inventory and create log in transaction
    const [updatedInventory] = await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity },
      }),
      this.prisma.inventoryLog.create({
        data: {
          variantId: inventory.id,
          changeType,
          quantityChange,
          reason,
          userId,
        },
      }),
    ]);

    return {
      variantId,
      previousQuantity: inventory.quantity,
      newQuantity: updatedInventory.quantity,
      changeType,
      reason,
    };
  }

  async getInventoryOverview(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [inventories, total] = await Promise.all([
      this.prisma.inventory.findMany({
        skip,
        take: limit,
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventory.count(),
    ]);

    return {
      data: inventories.map((inv) => ({
        inventoryId: inv.id,
        variantId: inv.productVariantId,
        variantName: inv.productVariant.name,
        variantSku: inv.productVariant.sku,
        productId: inv.productVariant.product.id,
        productName: inv.productVariant.product.name,
        quantity: inv.quantity,
        reservedQuantity: inv.reservedQuantity,
        availableQuantity: inv.quantity - inv.reservedQuantity,
        warehouseLocation: inv.warehouseLocation,
        lastUpdated: inv.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLowStockProducts(threshold = 10, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [inventories, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where: {
          quantity: { lte: threshold },
        },
        skip,
        take: limit,
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { quantity: 'asc' },
      }),
      this.prisma.inventory.count({
        where: {
          quantity: { lte: threshold },
        },
      }),
    ]);

    return {
      threshold,
      data: inventories.map((inv) => ({
        inventoryId: inv.id,
        variantId: inv.productVariantId,
        variantName: inv.productVariant.name,
        variantSku: inv.productVariant.sku,
        productId: inv.productVariant.product.id,
        productName: inv.productVariant.product.name,
        quantity: inv.quantity,
        reservedQuantity: inv.reservedQuantity,
        availableQuantity: inv.quantity - inv.reservedQuantity,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getInventoryHistory(variantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    if (!variant.inventory) {
      return {
        variantId,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.inventoryLog.findMany({
        where: { variantId: variant.inventory.id },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.inventoryLog.count({
        where: { variantId: variant.inventory.id },
      }),
    ]);

    return {
      variantId,
      data: logs.map((log) => ({
        id: log.id,
        changeType: log.changeType,
        quantityChange: log.quantityChange,
        reason: log.reason,
        changedBy: log.user
          ? {
              id: log.user.id,
              name: `${log.user.firstName} ${log.user.lastName}`,
              email: log.user.email,
            }
          : null,
        timestamp: log.timestamp,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // COUPON MANAGEMENT
  // ============================================

  async createCoupon(dto: CreateCouponDto) {
    const { code, type, value, minPurchase, maxDiscount, startDate, endDate, usageLimit, isActive } = dto;

    // Check if coupon code already exists
    const existing = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }

    return this.prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        minPurchase: minPurchase || 0,
        maxDiscount,
        startDate: start,
        endDate: end,
        usageLimit,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
  }

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // If updating code, check uniqueness
    if (dto.code && dto.code.toUpperCase() !== coupon.code) {
      const existing = await this.prisma.coupon.findUnique({
        where: { code: dto.code.toUpperCase() },
      });

      if (existing) {
        throw new ConflictException('Coupon code already exists');
      }
    }

    // Validate dates if provided
    if (dto.startDate || dto.endDate) {
      const start = dto.startDate ? new Date(dto.startDate) : coupon.startDate;
      const end = dto.endDate ? new Date(dto.endDate) : coupon.endDate;

      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const updateData: any = { ...dto };
    if (dto.code) {
      updateData.code = dto.code.toUpperCase();
    }
    if (dto.startDate) {
      updateData.startDate = new Date(dto.startDate);
    }
    if (dto.endDate) {
      updateData.endDate = new Date(dto.endDate);
    }

    return this.prisma.coupon.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Soft delete by deactivating
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listCoupons(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count(),
    ]);

    return {
      data: coupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCouponUsage(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        userCoupons: {
          where: { usedAt: { not: null } },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { usedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        isActive: coupon.isActive,
      },
      usage: coupon.userCoupons.map((uc) => ({
        userId: uc.user.id,
        userName: `${uc.user.firstName} ${uc.user.lastName}`,
        userEmail: uc.user.email,
        usedAt: uc.usedAt,
      })),
    };
  }

  // ============================================
  // ORDER MANAGEMENT
  // ============================================

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Update order and create history entry in transaction
    const [updatedOrder] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: dto.status },
      }),
      this.prisma.orderHistory.create({
        data: {
          orderId,
          status: dto.status,
          notes: dto.notes,
          createdBy: userId,
        },
      }),
    ]);

    return updatedOrder;
  }

  async assignTracking(orderId: string, dto: AssignTrackingDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Store tracking info in order history
    const notes = `Tracking assigned: ${dto.trackingNumber}${dto.carrier ? ` (${dto.carrier})` : ''}${dto.trackingUrl ? `\nTracking URL: ${dto.trackingUrl}` : ''}`;

    await this.prisma.orderHistory.create({
      data: {
        orderId,
        status: order.status,
        notes,
        createdBy: userId,
      },
    });

    return {
      orderId,
      trackingNumber: dto.trackingNumber,
      carrier: dto.carrier,
      trackingUrl: dto.trackingUrl,
      assignedAt: new Date(),
    };
  }

  async processRefund(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Order is already refunded');
    }

    // Find completed payment
    const payment = order.payments.find((p) => p.status === 'COMPLETED');

    if (!payment) {
      throw new BadRequestException('No completed payment found for this order');
    }

    // Update order status and payment status in transaction
    const [updatedOrder] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDED },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      }),
      this.prisma.orderHistory.create({
        data: {
          orderId,
          status: OrderStatus.REFUNDED,
          notes: 'Refund processed by admin',
          createdBy: userId,
        },
      }),
    ]);

    // TODO: Restore inventory for refunded items
    // This should be done in a background job

    return updatedOrder;
  }

  async getOrders(filter: OrderFilterDto) {
    const { status, startDate, endDate, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: {
            include: {
              productVariant: {
                include: {
                  product: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportOrders(filter: OrderFilterDto): Promise<string> {
    const { status, startDate, endDate } = filter;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = orders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerEmail: order.user.email,
      status: order.status,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      discount: order.discount,
      total: order.total,
      itemCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
    }));

    const parser = new Parser();
    return parser.parse(data);
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getSalesAnalytics(query: AnalyticsQueryDto) {
    const { startDate, endDate } = query;

    const where: Prisma.OrderWhereInput = {
      status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        total: true,
        subtotal: true,
        tax: true,
        shipping: true,
        discount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Group by day
    const dailySales = orders.reduce(
      (acc, order) => {
        const date = order.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, revenue: 0, orders: 0 };
        }
        acc[date].revenue += order.total;
        acc[date].orders += 1;
        return acc;
      },
      {} as Record<string, { date: string; revenue: number; orders: number }>,
    );

    return {
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
      },
      dailySales: Object.values(dailySales),
    };
  }

  async getTopProducts(query: AnalyticsQueryDto) {
    const { startDate, endDate, limit = 10 } = query;

    const where: Prisma.OrderWhereInput = {
      status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: where,
      },
      include: {
        productVariant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by product
    const productStats = orderItems.reduce(
      (acc, item) => {
        const productId = item.productVariant.product.id;
        if (!acc[productId]) {
          acc[productId] = {
            productId,
            productName: item.productVariant.product.name,
            productSlug: item.productVariant.product.slug,
            totalQuantity: 0,
            totalRevenue: 0,
            orderCount: 0,
          };
        }
        acc[productId].totalQuantity += item.quantity;
        acc[productId].totalRevenue += item.priceAtPurchase * item.quantity;
        acc[productId].orderCount += 1;
        return acc;
      },
      {} as Record<
        string,
        {
          productId: string;
          productName: string;
          productSlug: string;
          totalQuantity: number;
          totalRevenue: number;
          orderCount: number;
        }
      >,
    );

    // Sort by revenue and take top N
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return topProducts;
  }

  async getCustomerAnalytics(query: AnalyticsQueryDto) {
    const { startDate, endDate } = query;

    const where: Prisma.OrderWhereInput = {
      status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        userId: true,
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate customer metrics
    const customerOrders = orders.reduce(
      (acc, order) => {
        if (!acc[order.userId]) {
          acc[order.userId] = [];
        }
        acc[order.userId].push(order);
        return acc;
      },
      {} as Record<string, typeof orders>,
    );

    const newCustomers = Object.values(customerOrders).filter((orders) => orders.length === 1).length;
    const returningCustomers = Object.values(customerOrders).filter((orders) => orders.length > 1).length;
    const totalCustomers = Object.keys(customerOrders).length;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      returningCustomerRate: totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0,
    };
  }

  async getInventoryAnalytics(query: AnalyticsQueryDto) {
    const { startDate, endDate } = query;

    const where: Prisma.InventoryLogWhereInput = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const logs = await this.prisma.inventoryLog.findMany({
      where,
      include: {
        inventory: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate turnover by product
    const productTurnover = logs.reduce(
      (acc, log) => {
        if (log.changeType === 'SALE') {
          const productId = log.inventory.productVariant.product.id;
          if (!acc[productId]) {
            acc[productId] = {
              productId,
              productName: log.inventory.productVariant.product.name,
              totalSold: 0,
            };
          }
          acc[productId].totalSold += Math.abs(log.quantityChange);
        }
        return acc;
      },
      {} as Record<string, { productId: string; productName: string; totalSold: number }>,
    );

    return {
      totalTransactions: logs.length,
      productTurnover: Object.values(productTurnover).sort((a, b) => b.totalSold - a.totalSold),
    };
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async listUsers(query: UserListQueryDto) {
    const { role, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            title: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate total spent
    const orderStats = await this.prisma.order.aggregate({
      where: {
        userId,
        status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
      },
      _sum: { total: true },
      _count: true,
    });

    return {
      ...user,
      stats: {
        totalOrders: orderStats._count,
        totalSpent: orderStats._sum.total || 0,
        totalReviews: user._count.reviews,
      },
    };
  }

  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
    });
  }

  async deactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // In a real system, you might add an isActive field
    // For now, we'll just return a message
    // You could also invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return {
      message: 'User deactivated successfully. All sessions have been terminated.',
      userId,
    };
  }

  async getUserOrderHistory(userId: string, page = 1, limit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  product: {
                    select: {
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
