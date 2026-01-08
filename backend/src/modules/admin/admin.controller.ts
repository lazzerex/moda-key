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
  Request,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignTrackingDto } from './dto/assign-tracking.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { OrderFilterDto } from './dto/order-filter.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ============================================
  // INVENTORY MANAGEMENT
  // ============================================

  @Post('inventory/adjust')
  @ApiOperation({ summary: 'Manually adjust inventory levels' })
  @ApiResponse({ status: 200, description: 'Inventory adjusted successfully' })
  @ApiResponse({ status: 404, description: 'Product variant not found' })
  async adjustInventory(@Body() dto: AdjustInventoryDto, @Request() req) {
    return this.adminService.adjustInventory(dto, req.user.id);
  }

  @Get('inventory/overview')
  @ApiOperation({ summary: 'Get inventory overview for all products' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Inventory overview retrieved' })
  async getInventoryOverview(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getInventoryOverview(page, limit);
  }

  @Get('inventory/low-stock')
  @ApiOperation({ summary: 'Get products with low stock levels' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Low stock products retrieved' })
  async getLowStockProducts(
    @Query('threshold') threshold?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getLowStockProducts(threshold, page, limit);
  }

  @Get('inventory/history/:variantId')
  @ApiOperation({ summary: 'Get inventory history for a variant' })
  @ApiParam({ name: 'variantId', description: 'Product variant ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Inventory history retrieved' })
  @ApiResponse({ status: 404, description: 'Product variant not found' })
  async getInventoryHistory(
    @Param('variantId') variantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getInventoryHistory(variantId, page, limit);
  }

  // ============================================
  // COUPON MANAGEMENT
  // ============================================

  @Post('coupons')
  @ApiOperation({ summary: 'Create a new coupon' })
  @ApiResponse({ status: 201, description: 'Coupon created successfully' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  async createCoupon(@Body() dto: CreateCouponDto) {
    return this.adminService.createCoupon(dto);
  }

  @Put('coupons/:id')
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({ status: 200, description: 'Coupon updated successfully' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.adminService.updateCoupon(id, dto);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Delete (deactivate) a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({ status: 200, description: 'Coupon deleted successfully' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async deleteCoupon(@Param('id') id: string) {
    return this.adminService.deleteCoupon(id);
  }

  @Get('coupons')
  @ApiOperation({ summary: 'List all coupons' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Coupons retrieved successfully' })
  async listCoupons(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listCoupons(page, limit);
  }

  @Get('coupons/:id/usage')
  @ApiOperation({ summary: 'Get coupon usage statistics' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({ status: 200, description: 'Coupon usage retrieved' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async getCouponUsage(@Param('id') id: string) {
    return this.adminService.getCouponUsage(id);
  }

  // ============================================
  // ORDER MANAGEMENT
  // ============================================

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders with filtering' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getOrders(@Query() filter: OrderFilterDto) {
    return this.adminService.getOrders(filter);
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req,
  ) {
    return this.adminService.updateOrderStatus(id, dto, req.user.id);
  }

  @Post('orders/:id/tracking')
  @ApiOperation({ summary: 'Assign tracking number to order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Tracking assigned successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async assignTracking(@Param('id') id: string, @Body() dto: AssignTrackingDto, @Request() req) {
    return this.adminService.assignTracking(id, dto, req.user.id);
  }

  @Post('orders/:id/refund')
  @ApiOperation({ summary: 'Process a refund for an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async processRefund(@Param('id') id: string, @Request() req) {
    return this.adminService.processRefund(id, req.user.id);
  }

  @Get('orders/export')
  @ApiOperation({ summary: 'Export orders to CSV' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="orders.csv"')
  @ApiResponse({ status: 200, description: 'CSV file generated' })
  async exportOrders(@Query() filter: OrderFilterDto) {
    return this.adminService.exportOrders(filter);
  }

  // ============================================
  // ANALYTICS
  // ============================================

  @Get('analytics/sales')
  @ApiOperation({ summary: 'Get sales analytics (revenue, orders over time)' })
  @ApiResponse({ status: 200, description: 'Sales analytics retrieved' })
  async getSalesAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getSalesAnalytics(query);
  }

  @Get('analytics/top-products')
  @ApiOperation({ summary: 'Get best-selling products' })
  @ApiResponse({ status: 200, description: 'Top products retrieved' })
  async getTopProducts(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getTopProducts(query);
  }

  @Get('analytics/customers')
  @ApiOperation({ summary: 'Get customer analytics (new vs returning)' })
  @ApiResponse({ status: 200, description: 'Customer analytics retrieved' })
  async getCustomerAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getCustomerAnalytics(query);
  }

  @Get('analytics/inventory')
  @ApiOperation({ summary: 'Get inventory analytics (turnover rate)' })
  @ApiResponse({ status: 200, description: 'Inventory analytics retrieved' })
  async getInventoryAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getInventoryAnalytics(query);
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async listUsers(@Query() query: UserListQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get detailed user information' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user (ban/suspend)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateUser(@Param('id') id: string) {
    return this.adminService.deactivateUser(id);
  }

  @Get('users/:id/orders')
  @ApiOperation({ summary: "Get user's order history" })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'User order history retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserOrderHistory(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getUserOrderHistory(id, page, limit);
  }
}
