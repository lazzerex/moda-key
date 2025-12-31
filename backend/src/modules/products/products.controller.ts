import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreateProductVariantDto, UpdateProductVariantDto } from './dto/product-variant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Public endpoints
   */

  @Get()
  @ApiOperation({ summary: 'Get all products with pagination' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'brandId', type: String, required: false })
  @ApiQuery({ name: 'categoryId', type: String, required: false })
  @ApiQuery({ name: 'minPrice', type: Number, required: false })
  @ApiQuery({ name: 'maxPrice', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'List of products',
  })
  async getProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    return this.productsService.getProducts(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      {
        search,
        brandId,
        categoryId,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      },
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products by query' })
  @ApiQuery({ name: 'q', type: String, required: true })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  async searchProducts(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.searchProducts(
      query,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({
    status: 200,
    description: 'Product details',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get product by slug' })
  async getProductBySlug(@Param('slug') slug: string) {
    return this.productsService.getProductBySlug(slug);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'Get product variants' })
  async getProductVariants(@Param('id') id: string) {
    return this.productsService.getProductVariants(id);
  }

  /**
   * Admin endpoints
   */

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'VENDOR')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product (Admin/Vendor only)' })
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return this.productsService.createProduct(createProductDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'VENDOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product (Admin/Vendor only)' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product (Admin only)' })
  async deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'VENDOR')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create product variant (Admin/Vendor only)' })
  async createVariant(
    @Param('id') id: string,
    @Body() createVariantDto: CreateProductVariantDto,
  ) {
    return this.productsService.createVariant(id, createVariantDto);
  }

  @Put('variants/:variantId')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'VENDOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product variant (Admin/Vendor only)' })
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() updateVariantDto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(variantId, updateVariantDto);
  }
}
