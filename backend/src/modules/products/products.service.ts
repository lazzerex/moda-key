import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreateProductVariantDto, UpdateProductVariantDto } from './dto/product-variant.dto';
import { Product, ProductVariant } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Create a new product
   */
  async createProduct(createProductDto: CreateProductDto): Promise<Product> {
    const { slug, sku, brandId, categoryId } = createProductDto;

    // Check if slug or SKU already exists
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ slug }, { sku }],
      },
    });

    if (existing) {
      throw new ConflictException('Product with this slug or SKU already exists');
    }

    // Verify brand and category exist
    const [brand, category] = await Promise.all([
      this.prisma.brand.findUnique({ where: { id: brandId } }),
      this.prisma.category.findUnique({ where: { id: categoryId } }),
    ]);

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const product = await this.prisma.product.create({
      data: createProductDto,
      include: {
        brand: true,
        category: true,
        variants: true,
      },
    });

    // Invalidate product list cache
    await this.redis.delByPattern('products:list:*');

    this.logger.log(`Product created: ${product.id}`);
    return product;
  }

  /**
   * Get all products with pagination and filters
   */
  async getProducts(
    page: number = 1,
    limit: number = 20,
    filters?: {
      brandId?: string;
      categoryId?: string;
      minPrice?: number;
      maxPrice?: number;
      search?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const cacheKey = `products:list:${page}:${limit}:${JSON.stringify(filters || {})}`;

    // Try cache first
    const cached = await this.redis.getCached(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for products list`);
      return cached;
    }

    // Build where clause
    const where: any = {};

    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.minPrice || filters?.maxPrice) {
      where.basePrice = {};
      if (filters.minPrice) {
        where.basePrice.gte = filters.minPrice;
      }
      if (filters.maxPrice) {
        where.basePrice.lte = filters.maxPrice;
      }
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Fetch data
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: true,
          category: true,
          variants: { include: { inventory: true } },
          images: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache result
    await this.redis.setCached(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string): Promise<Product & any> {
    const cacheKey = `product:${id}`;

    // Try cache first
    const cached = await this.redis.getCached(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product ${id}`);
      return cached;
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        variants: { include: { inventory: true } },
        images: {
          orderBy: { order: 'asc' },
        },
        reviews: {
          where: { isVerified: true },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Cache result
    await this.redis.setCached(cacheKey, product, this.CACHE_TTL);

    return product;
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<Product & any> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        variants: { include: { inventory: true } },
        images: {
          orderBy: { order: 'asc' },
        },
        reviews: {
          where: { isVerified: true },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: {
        brand: true,
        category: true,
        variants: true,
      },
    });

    // Invalidate caches
    await this.redis.delByPattern(`product:${id}`);
    await this.redis.delByPattern('products:list:*');

    this.logger.log(`Product updated: ${id}`);
    return updated;
  }

  /**
   * Delete product
   */
  async deleteProduct(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({
      where: { id },
    });

    // Invalidate caches
    await this.redis.delByPattern(`product:${id}`);
    await this.redis.delByPattern('products:list:*');

    this.logger.log(`Product deleted: ${id}`);
  }

  /**
   * Create product variant
   */
  async createVariant(
    productId: string,
    createVariantDto: CreateProductVariantDto,
  ): Promise<ProductVariant & any> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if SKU already exists
    const existing = await this.prisma.productVariant.findUnique({
      where: { sku: createVariantDto.sku },
    });

    if (existing) {
      throw new ConflictException('Variant with this SKU already exists');
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        ...createVariantDto,
        productId,
      },
    });

    // Create inventory record
    await this.prisma.inventory.create({
      data: {
        productVariantId: variant.id,
        quantity: createVariantDto.stock,
        reservedQuantity: 0,
      },
    });

    // Invalidate product cache
    await this.redis.delByPattern(`product:${productId}`);

    this.logger.log(`Variant created: ${variant.id}`);
    return variant;
  }

  /**
   * Update product variant
   */
  async updateVariant(
    variantId: string,
    updateVariantDto: UpdateProductVariantDto,
  ): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: updateVariantDto,
    });

    // Invalidate product cache
    await this.redis.delByPattern(`product:${variant.productId}`);

    return updated;
  }

  /**
   * Get product variants
   */
  async getProductVariants(productId: string): Promise<any[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productVariant.findMany({
      where: { productId },
      include: { inventory: true },
    });
  }

  /**
   * Search products
   */
  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { brand: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: {
        brand: true,
        category: true,
        variants: { include: { inventory: true } },
        images: true,
      },
      take: limit,
    });
  }
}
